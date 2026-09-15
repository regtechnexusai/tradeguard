const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const formatPrice = (value) => Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });

const UNIT_PROFILES = [
  {
    test: /^0206/,
    units: ["Kilogram", "Tonne"],
    basis: "HS 0206 edible offal is assessed on a weight basis for this demo; confirm the applicable tariff, product condition and contract unit."
  },
  {
    test: /^0205/,
    units: ["Kilogram", "Tonne"],
    basis: "HS 0205 meat is assessed on a weight basis for this demo; confirm the applicable tariff and contract unit."
  },
  {
    test: /^5201/,
    units: ["Kilogram", "Tonne"],
    basis: "HS 5201 raw cotton is assessed on a weight basis for this demo; confirm the applicable tariff and contract unit."
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
  let priceScoringEligible = true;

  if (!input.unitOfMeasure) {
    issues.push("Unit of measure is not provided.");
    priceScoringEligible = false;
  } else if (!profileConfigured || !expected.length) {
    issues.push("The expected unit profile for this HS Code is not configured.");
    priceScoringEligible = false;
  } else if (!expected.includes(input.unitOfMeasure)) {
    issues.push(`Selected unit “${input.unitOfMeasure}” does not match the expected unit profile: ${expected.join(" or ")}.`);
    priceScoringEligible = false;
  }

  [
    ["marketSource", "Market-price source"],
    ["marketSourceDate", "Market-price date"],
    ["currency", "Benchmark currency"],
    ["valuationBasis", "Valuation basis"]
  ].forEach(([key, label]) => {
    if (!String(input[key] || "").trim()) {
      issues.push(`${label} is not provided.`);
      priceScoringEligible = false;
    }
  });

  const categoryRule = getCategoryRule(input.hsCode);
  if (categoryRule && input.productDescription && hasConflict(input.productDescription, categoryRule.conflicts)) {
    issues.push(`The entered goods description appears inconsistent with the tariff-linked ${categoryRule.label} profile.`);
    priceScoringEligible = false;
  } else if (!input.productDescription) {
    warnings.push("Extended goods description is not provided; HS-linked commodity text is being used as the minimum reference.");
  }

  if (input.marketLow && input.marketHigh && input.unitOfMeasure && expected.length && expected.includes(input.unitOfMeasure)) {
    warnings.push("Benchmark comparability still depends on the source, date, grade/specification and valuation basis being genuine and applicable.");
  }

  let status = "Comparable for supplied benchmark";
  if (issues.length) status = "Not comparable — price score withheld";
  else if (warnings.length) status = "Comparable with limitations";

  return {
    status,
    issues,
    warnings,
    expectedUnits: expected,
    profileConfigured,
    priceScoringEligible,
    message: priceScoringEligible
      ? "The price component can be calculated for the supplied unit and benchmark metadata. This remains an indicative signal."
      : "The price component is withheld because the HS Code, unit, goods description or benchmark metadata cannot yet be treated as comparable."
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

  const rawScore = flags.reduce((total, flag) => total + flag.points, 0);
  const cappedScore = clamp(rawScore, 0, 100);
  const hasManualIndicator = selectedIndicators.size > 0 || [
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

  if (!integrity.priceScoringEligible) {
    readinessIssues.push("Price scoring is withheld because the supplied data is not comparable.");
  }

  if (hasManualIndicator && !evidenceReady) {
    readinessIssues.push("Selected indicators require available evidence, confidence and a reviewer rationale note.");
  }

  if (input.hsCodeVerified === false) {
    readinessIssues.push("The HS Code has not been verified against the tariff reference.");
  }

  const decisionReady = readinessIssues.length === 0;
  const score = decisionReady ? cappedScore : null;
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

  const recommendation = decisionReady
    ? recommendations[band]
    : "Do not use this output for a compliance decision. Resolve the data-integrity and evidence issues, then rerun the case.";

  return {
    score,
    rawScore,
    cappedScore,
    scoreCapApplied: rawScore > 100,
    band,
    decisionReady,
    decisionStatus: decisionReady ? "Ready for authorised review" : "Not decision-ready",
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
