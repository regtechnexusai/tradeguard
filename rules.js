const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const formatPrice = (value) => Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });

const UNIT_PROFILES = [
  {
    test: /^0206/,
    units: ["Kilogram", "Tonne"],
    basis: "HS 0206 edible offal is assessed on a weight basis for this assessment; confirm the applicable tariff, product condition and contract unit."
  },
  {
    test: /^0205/,
    units: ["Kilogram", "Tonne"],
    basis: "HS 0205 meat is assessed on a weight basis for this assessment; confirm the applicable tariff and contract unit."
  },
  {
    test: /^5201/,
    units: ["Kilogram", "Tonne"],
    basis: "HS 5201 raw cotton is assessed on a weight basis for this assessment; confirm the applicable tariff and contract unit."
  },
  {
    test: /^(5208|5209|5210|5211|5212)/,
    units: ["Metre", "Yard"],
    basis: "Woven textile fabric is commonly benchmarked by length; confirm the applicable tariff and contract unit."
  },
  {
    test: /^52/,
    units: ["Kilogram", "Tonne", "Metre", "Yard"],
    basis: "Chapter 52 contains multiple cotton products; confirm the product-specific tariff and contract unit."
  }
];

const CATEGORY_RULES = [
  { test: /^0205/, conflicts: ["cotton", "textile", "fabric", "yarn", "cloth"], label: "animal-protein goods" },
  { test: /^0206/, conflicts: ["cotton", "textile", "fabric", "yarn", "cloth", "garment"], label: "edible-offal goods" },
  { test: /^5201/, conflicts: ["horse", "meat", "beef", "poultry", "animal"], label: "raw cotton" }
];

export function getExpectedUnitsForHsCode(hsCode) {
  const code = String(hsCode || "").replace(/\s/g, "");
  const profile = UNIT_PROFILES.find((item) => item.test.test(code));

  return profile
    ? { units: profile.units, basis: profile.basis, configured: true }
    : {
        units: [],
        basis: "No product-specific unit profile is configured for this HS Code. Confirm the unit from the applicable tariff, contract and supporting documents.",
        configured: false
      };
}

function getCategoryRule(hsCode) {
  const code = String(hsCode || "").replace(/\s/g, "");
  return CATEGORY_RULES.find((item) => item.test.test(code));
}

function hasConflict(text, conflicts) {
  const normalized = String(text || "").toLowerCase();
  return conflicts.some((term) => normalized.includes(term));
}

export function assessDataIntegrity(input) {
  const configuredProfile = getExpectedUnitsForHsCode(input.hsCode);
  const expected = configuredProfile.units;
  const profileConfigured = configuredProfile.configured;
  const issues = [];
  const warnings = [];
  const hasValue = (value) => String(value ?? "").trim() !== "";
  const isPositiveNumber = (value) => hasValue(value) && Number.isFinite(Number(value)) && Number(value) > 0;
  const priceFields = ["invoicePrice", "marketLow", "marketHigh"];
  const priceDataProvided = priceFields.some((key) => hasValue(input[key]));
  const priceInputsComplete = priceFields.every((key) => isPositiveNumber(input[key]));
  const validPriceRange = priceInputsComplete && Number(input.marketHigh) >= Number(input.marketLow);
  const benchmarkMetadataKeys = ["marketSource", "marketSourceDate", "valuationBasis"];
  let priceScoringEligible = false;
  let priceStatus = "Not assessed — optional price data not provided";

  if (!priceDataProvided) {
    warnings.push("Optional price data was not provided; price comparison was not assessed.");
  } else if (!priceInputsComplete || !validPriceRange) {
    warnings.push("Complete positive values for declared price and market lower/upper range to enable price comparison.");
    priceStatus = "Incomplete — price score not assessed";
  } else if (!input.unitOfMeasure) {
    issues.push("Unit of measure is not provided for the supplied price data.");
    priceStatus = "Not comparable — price score withheld";
  } else if (!profileConfigured || !expected.length) {
    issues.push("The expected unit profile for this HS Code is not configured.");
    priceStatus = "Not comparable — price score withheld";
  } else if (!expected.includes(input.unitOfMeasure)) {
    issues.push("Selected unit “" + input.unitOfMeasure + "” does not match the expected unit profile: " + expected.join(" or ") + ".");
    priceStatus = "Not comparable — price score withheld";
  } else if (!hasValue(input.currency)) {
    warnings.push("Currency is not provided; the numeric price comparison was withheld.");
    priceStatus = "Incomplete — currency required for price comparison";
  } else {
    priceScoringEligible = true;
    priceStatus = "Comparable for supplied unit and range";
    const missingMetadata = benchmarkMetadataKeys
      .filter((key) => !hasValue(input[key]))
      .map((key) => key === "marketSource" ? "source" : key === "marketSourceDate" ? "date" : "valuation basis");
    if (missingMetadata.length) {
      warnings.push("Benchmark metadata is incomplete (" + missingMetadata.join(", ") + "); the price signal remains indicative.");
    }
  }

  const categoryRule = getCategoryRule(input.hsCode);
  if (categoryRule && input.productDescription && hasConflict(input.productDescription, categoryRule.conflicts)) {
    issues.push(`The entered goods description appears inconsistent with the tariff-linked ${categoryRule.label} profile.`);
    priceScoringEligible = false;
    priceStatus = "Not comparable — goods / HS Code mismatch";
  } else if (!hasValue(input.productDescription)) {
    warnings.push("Extended goods description is not provided; HS-linked commodity text is being used as the minimum reference.");
  }

  if (priceScoringEligible) {
    warnings.push("Benchmark comparability still depends on the source, date, grade/specification and valuation basis being genuine and applicable.");
  }

  const benchmarkMetadataComplete = priceScoringEligible && benchmarkMetadataKeys.every((key) => hasValue(input[key]));
  let status = priceStatus;
  if (priceScoringEligible && !benchmarkMetadataComplete) status = "Comparable with limitations";
  if (issues.length) status = "Not comparable — price score withheld";

  return {
    status,
    issues,
    warnings,
    expectedUnits: expected,
    profileConfigured,
    priceScoringEligible,
    priceDataProvided,
    priceInputsComplete,
    benchmarkMetadataComplete,
    priceStatus,
    message: priceScoringEligible
      ? "The price component can be calculated for the supplied unit and range. Source, date and valuation basis improve comparability but do not block this assessment."
      : priceDataProvided
        ? "The price component was not calculated because the optional price inputs are incomplete or cannot be compared to the verified HS Code and unit."
        : "No price component was calculated because the optional price data was not provided."
  };
}

function outsideRangePercentage(price, low, high) {
  if (price >= low && price <= high) return 0;
  if (price > high) return ((price - high) / high) * 100;
  return ((low - price) / low) * 100;
}

export function calculateRisk(input) {
  const invoicePrice = Number(input.invoicePrice);
  const marketLow = Number(input.marketLow);
  const marketHigh = Number(input.marketHigh);
  const integrity = assessDataIntegrity(input);
  const flags = [];
  const suppressedIndicators = [];
  const deviation = integrity.priceScoringEligible
    ? outsideRangePercentage(invoicePrice, marketLow, marketHigh)
    : null;
  const suppliedRange = input.currency
    ? ` (${input.currency} ${formatPrice(marketLow)}–${formatPrice(marketHigh)} per ${input.unitOfMeasure || "unit"})`
    : "";

  if (integrity.priceScoringEligible && deviation >= 100) {
    flags.push({
      id: "price-material",
      title: "Material price deviation",
      points: 25,
      detail: `The declared price is approximately ${Math.round(deviation)}% outside the supplied market range${suppliedRange}.`,
      action: "Obtain independent price evidence, product specifications and commercial rationale."
    });
  } else if (integrity.priceScoringEligible && deviation >= 50) {
    flags.push({
      id: "price-significant",
      title: "Significant price deviation",
      points: 15,
      detail: `The declared price is approximately ${Math.round(deviation)}% outside the supplied market range${suppliedRange}.`,
      action: "Validate the benchmark, grade, quality, Incoterms and pricing rationale."
    });
  }

  if (!integrity.priceScoringEligible && (input.tbmlIndicators || []).includes("price-value-anomaly")) {
    suppressedIndicators.push("price-value-anomaly");
  }

  if (input.relatedParty) {
    flags.push({
      id: "related-party",
      title: "Potential related-party transaction",
      points: 15,
      detail: "The buyer and seller may have a relationship that requires additional understanding.",
      action: "Confirm ownership, control, beneficial ownership and arm's-length pricing."
    });
  }

  if (input.thirdPartyPayment) {
    flags.push({
      id: "third-party-payment",
      title: "Third-party payment arrangement",
      points: 10,
      detail: "The payer may differ from the buyer or contractual counterparty.",
      action: "Establish the commercial purpose and documentary basis for the payment chain."
    });
  }

  if (input.routeMismatch) {
    flags.push({
      id: "route-anomaly",
      title: "Shipping route anomaly",
      points: 10,
      detail: "The selected route may not align with the expected commercial flow.",
      action: "Review ports, trans-shipment points, vessel details and the business rationale."
    });
  }

  if (input.documentMismatch) {
    flags.push({
      id: "document-mismatch",
      title: "Cross-document inconsistency",
      points: 15,
      detail: "Important values or descriptions may not align across the trade documents.",
      action: "Reconcile the LC, invoice, packing list, Bill of Lading and supporting documents."
    });
  }

  if (input.duplicateInvoice) {
    flags.push({
      id: "duplicate-invoice",
      title: "Potential duplicate invoice",
      points: 20,
      detail: "A similar invoice may have been used in another transaction.",
      action: "Search the internal trade record and confirm unique shipment and document identifiers."
    });
  }

  const categoryRule = getCategoryRule(input.hsCode);
  if (categoryRule && input.productDescription && hasConflict(input.productDescription, categoryRule.conflicts)) {
    flags.push({
      id: "goods-hs-mismatch-auto",
      title: "Goods / HS Code mismatch concern",
      points: 15,
      detail: "The entered goods description contains terms that appear inconsistent with the tariff-linked HS Code profile.",
      action: "Reconcile the HS Code, goods description, specification and supporting commercial documents.",
      source: "Automatic data-integrity check"
    });
  }

  const selectedIndicators = new Set(input.tbmlIndicators || []);
  const addManualIndicator = ({ key, id, title, points, detail, action, coveredBy, suppressWhen }) => {
    if (!selectedIndicators.has(key)) return;
    if (suppressWhen?.()) {
      suppressedIndicators.push(key);
      return;
    }
    if (coveredBy && coveredBy()) return;

    flags.push({
      id,
      title,
      points,
      detail,
      action,
      source: "Selected TBML indicator"
    });
  };

  addManualIndicator({
    key: "price-value-anomaly",
    id: "tbml-price-value-anomaly",
    title: "Reported price / valuation concern",
    points: 10,
    detail: "The supplied information indicates a possible price or valuation concern requiring supporting commercial evidence.",
    action: "Confirm the valuation basis, benchmark source, product grade, Incoterms and pricing rationale.",
    coveredBy: () => flags.some((flag) => flag.id.startsWith("price-")),
    suppressWhen: () => !integrity.priceScoringEligible
  });

  addManualIndicator({
    key: "goods-hs-mismatch",
    id: "tbml-goods-hs-mismatch",
    title: "Goods / HS Code mismatch concern",
    points: 15,
    detail: "The goods description, specification or classification may not align with the declared HS Code.",
    action: "Reconcile the HS Code with the goods, quality, composition, model and supporting commercial documents.",
    coveredBy: () => flags.some((flag) => flag.id === "goods-hs-mismatch-auto")
  });

  addManualIndicator({
    key: "quantity-unit-mismatch",
    id: "tbml-quantity-unit-mismatch",
    title: "Quantity / unit inconsistency",
    points: 10,
    detail: "The quantity or unit of measure may not align across the transaction information and supporting documents.",
    action: "Reconcile quantity, unit of measure, packing details and shipment records."
  });

  addManualIndicator({
    key: "document-inconsistency",
    id: "tbml-document-inconsistency",
    title: "Document inconsistency concern",
    points: 15,
    detail: "The invoice, packing list, Bill of Lading or related trade documents may contain inconsistent information.",
    action: "Obtain and reconcile the relevant documents before final processing.",
    coveredBy: () => flags.some((flag) => flag.id === "document-mismatch")
  });

  addManualIndicator({
    key: "route-port-anomaly",
    id: "tbml-route-port-anomaly",
    title: "Route / port anomaly concern",
    points: 10,
    detail: "The route, port, trans-shipment point or shipment pattern may require additional commercial explanation.",
    action: "Review the expected route, ports, vessel details, trans-shipment and business rationale.",
    coveredBy: () => flags.some((flag) => flag.id === "route-anomaly")
  });

  addManualIndicator({
    key: "related-party-ubo",
    id: "tbml-related-party-ubo",
    title: "Related-party / UBO concern",
    points: 15,
    detail: "Ownership, control, beneficial ownership or the relationship between the parties may require further understanding.",
    action: "Confirm ownership, control, beneficial ownership and arm's-length pricing.",
    coveredBy: () => flags.some((flag) => flag.id === "related-party")
  });

  addManualIndicator({
    key: "third-party-payment",
    id: "tbml-third-party-payment",
    title: "Third-party payment concern",
    points: 10,
    detail: "The payer may not be clearly linked to the buyer, seller or contractual purpose of the transaction.",
    action: "Establish the commercial purpose and documentary basis for the payment chain.",
    coveredBy: () => flags.some((flag) => flag.id === "third-party-payment")
  });

  addManualIndicator({
    key: "multiple-phantom-shipment",
    id: "tbml-multiple-phantom-shipment",
    title: "Multiple / phantom shipment concern",
    points: 20,
    detail: "The shipment or invoice may be repeated, unsupported or not sufficiently evidenced by goods movement.",
    action: "Check unique shipment identifiers, customs records, transport evidence and internal trade history."
  });

  addManualIndicator({
    key: "business-profile-mismatch",
    id: "tbml-business-profile-mismatch",
    title: "Business-profile mismatch",
    points: 10,
    detail: "The transaction may not align with the customer’s known business activity, capacity or expected trade pattern.",
    action: "Compare the transaction with the customer profile, capacity, past trade and stated business purpose."
  });

  addManualIndicator({
    key: "unusual-payment-terms",
    id: "tbml-unusual-payment-terms",
    title: "Unusual payment terms",
    points: 10,
    detail: "The payment structure may be unusual for the goods, counterparties or stated commercial rationale.",
    action: "Obtain the rationale, contractual basis and supporting approval for the payment terms."
  });

  const addControlFinding = ({ id, title, detail, action, source }) => {
    flags.push({
      id,
      title,
      points: 0,
      detail,
      action,
      source,
      controlOnly: true
    });
  };

  if (["Increased monitoring", "Call for action", "Sanctions / TF/PF concern"].includes(input.jurisdictionRisk)) {
    addControlFinding({
      id: "jurisdiction-risk-context",
      title: "Jurisdictional risk context",
      detail: `The selected jurisdiction status is “${input.jurisdictionRisk}”. This is a risk-based control context, not an automatic sanctions conclusion.`,
      action: "Confirm the current country-risk source, applicable local measures, targeted financial sanctions screening and the institution's escalation procedure.",
      source: "FATF R1, R6, R7"
    });
  }

  if (["Possible PEP", "Confirmed PEP"].includes(input.pepStatus)) {
    addControlFinding({
      id: "pep-screening-context",
      title: "PEP / screening control finding",
      detail: `The screening status is “${input.pepStatus}”. PEP handling requires enhanced review under the institution's approved policy.`,
      action: "Confirm identity resolution, source of wealth/funds, senior approval and ongoing monitoring requirements.",
      source: "FATF R10, R12"
    });
  }

  if (["Possible restricted / dual-use", "Confirmed restricted / sanctions concern"].includes(input.restrictedGoodsStatus)) {
    addControlFinding({
      id: "restricted-goods-context",
      title: "Restricted / dual-use goods screening finding",
      detail: `The goods screening status is “${input.restrictedGoodsStatus}”. The result requires a documented classification and sanctions/export-control review.`,
      action: "Confirm goods classification, end-use/end-user, applicable export controls and targeted financial sanctions before processing.",
      source: "FATF R6, R7; local export-control policy"
    });
  }

  if (["Incomplete", "Third-party chain", "Not provided"].includes(input.paymentInformationStatus)) {
    addControlFinding({
      id: "payment-transparency-context",
      title: "Payment transparency control finding",
      detail: `Payment information is marked “${input.paymentInformationStatus}”. The payment chain is not fully transparent in the supplied case context.`,
      action: "Complete payer, payee, beneficiary and intermediary information and reconcile it to the underlying commercial purpose.",
      source: "FATF R10, R16"
    });
  }

  if (["Unexplained", "Not provided"].includes(input.sourceOfFundsStatus)) {
    addControlFinding({
      id: "source-of-funds-context",
      title: "Source-of-funds control finding",
      detail: `Source-of-funds / wealth status is marked “${input.sourceOfFundsStatus}”. The economic rationale is not sufficiently supported in the supplied context.`,
      action: "Obtain proportionate source-of-funds/wealth evidence and document the rationale for the transaction.",
      source: "FATF R10, R12"
    });
  }

  const scoredFlags = flags.filter((flag) => !flag.controlOnly);
  const rawScore = scoredFlags.reduce((total, flag) => total + flag.points, 0);
  const cappedScore = clamp(rawScore, 0, 100);
  const hasManualIndicator = selectedIndicators.size > 0 || flags.some((flag) => flag.controlOnly) || [
    input.relatedParty,
    input.thirdPartyPayment,
    input.routeMismatch,
    input.documentMismatch,
    input.duplicateInvoice
  ].some(Boolean);
  const evidenceReady = !hasManualIndicator || Boolean(
    input.indicatorConfidence &&
    input.evidenceStatus === "Available for review" &&
    String(input.reviewerEvidenceNote || "").trim()
  );
  const readinessIssues = [];

  if (integrity.issues.length) {
    readinessIssues.push("Data-integrity issues must be resolved before relying on an overall score.");
  }

  if (selectedIndicators.has("price-value-anomaly") && !integrity.priceScoringEligible) {
    readinessIssues.push("The selected price / valuation indicator needs comparable price inputs before it can be assessed.");
  }

  if (flags.some((flag) => flag.id.startsWith("price-")) && !integrity.benchmarkMetadataComplete) {
    readinessIssues.push("The price signal is indicative because benchmark source, date or valuation basis is incomplete.");
  }

  if (hasManualIndicator && !evidenceReady) {
    readinessIssues.push("Selected indicators require available evidence, confidence and a reviewer rationale note.");
  }

  const routeConcernSelected = input.routeMismatch || selectedIndicators.has("route-port-anomaly");
  const routeContextReady = Boolean(input.portLoading && input.portDischarge && input.routeDetails && input.businessProfile);
  if (routeConcernSelected && !routeContextReady) {
    readinessIssues.push("Route concerns remain indicative until ports, route evidence and business context are provided.");
  }

  if (input.hsCodeVerified === false) {
    readinessIssues.push("The HS Code has not been verified against the tariff reference.");
  }

  const decisionReady = readinessIssues.length === 0;
  const score = decisionReady ? cappedScore : null;
  const indicativeScore = scoredFlags.length ? cappedScore : null;
  let band = "Not decision-ready";
  if (decisionReady) {
    band = "Low";
    if (score >= 75) band = "Critical";
    else if (score >= 50) band = "High";
    else if (score >= 25) band = "Medium";
  }

  const recommendations = {
    Low: "Proceed with normal controls, while retaining the supporting documents and review rationale.",
    Medium: "Route the transaction for focused review and obtain additional evidence for the identified indicators.",
    High: "Place the transaction in an enhanced review queue before final processing or escalation.",
    Critical: "Pause routine processing and escalate for senior compliance review under the institution's approved procedure."
  };

  const recommendation = !flags.length
    ? "No configured risk indicator was triggered by the supplied inputs. This is not a finding of low risk; add optional transaction data and supporting evidence for a more specific signal."
    : decisionReady
      ? recommendations[band]
      : "Do not use this output for a compliance decision. Resolve the listed evidence and data-integrity issues, then rerun the case.";

  return {
    score,
    indicativeScore,
    rawScore,
    cappedScore,
    scoreCapApplied: rawScore > 100,
    scoredFlagCount: scoredFlags.length,
    controlFindingCount: flags.filter((flag) => flag.controlOnly).length,
    band,
    decisionReady,
    decisionStatus: decisionReady
      ? (flags.length ? "Ready for authorised review" : "Assessment complete — no scoreable signal")
      : "Not decision-ready",
    evidenceReady,
    readinessIssues,
    flags,
    deviation,
    integrity,
    priceScoringEligible: integrity.priceScoringEligible,
    suppressedIndicators,
    selectedIndicatorCount: selectedIndicators.size,
    recommendation
  };
}

export function bandClass(band) {
  return band === "Not decision-ready"
    ? "status-not-ready"
    : `status-${band.toLowerCase()}`;
}
