import HS_PROFILES from "./hs-profiles.js?v=13";

export const RULESET_VERSION = "TradeGuard ruleset v13";

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const formatPrice = (value) => Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });

const FIELD_LABELS = {
  material: "Material / composition",
  qualityGrade: "Quality / grade",
  modelBrand: "Model / brand",
  specification: "Technical specification"
};

const GOODS_CONFLICT_RULES = [
  { test: /^01/, conflicts: ["textile", "fabric", "garment", "machinery", "machine", "computer", "smartphone", "steel", "cement", "furniture", "footwear"], label: "live-animal" },
  { test: /^(02|03|04|05|06|07|08|09|10|11|12|13|14|15|16|17|18|19|20|21|22|23|24)/, conflicts: ["machinery", "machine", "computer", "smartphone", "vehicle", "aircraft", "steel", "cement"], label: "food, plant or animal-product" },
  { test: /^(50|51|52|53|54|55|56|57|58|59|60|61|62|63)/, conflicts: ["bees", "live animal", "machinery", "machine", "steel", "cement", "smartphone", "computer"], label: "textile" },
  { test: /^(72|73|74|75|76|78|79|80|81|82|83)/, conflicts: ["bees", "live animal", "cotton", "textile", "fabric", "rice", "wheat"], label: "metal" },
  { test: /^(84|85|86|87|88|89|90)/, conflicts: ["bees", "live animal"], label: "machinery, equipment or transport" }
];

function cleanHsCode(hsCode) {
  return String(hsCode || "").replace(/\s/g, "");
}

function getHsProfile(hsCode) {
  return HS_PROFILES[cleanHsCode(hsCode)] || null;
}

function getUnitBasis(profile) {
  if (!profile) {
    return "No product-specific unit profile is configured for this HS Code. Confirm the unit from the applicable tariff, contract and supporting documents.";
  }

  if (profile.family === "Live bees") {
    return "Benchmark live bees using the same commercial basis as the transaction—colony, package, piece or weight. Do not compare colony pricing with kilogram pricing.";
  }

  return profile.basis || `Configured product-family profile: ${profile.family}. Use the same unit for the declared price and the market benchmark, and confirm the applicable tariff, contract and product specification.`;
}

export function getExpectedUnitsForHsCode(hsCode) {
  const profile = getHsProfile(hsCode);

  return profile
    ? {
        units: profile.units,
        basis: getUnitBasis(profile),
        configured: true,
        preferredUnit: profile.preferredUnit,
        family: profile.family,
        confidence: profile.confidence,
        fields: profile.fields
      }
    : {
        units: [],
        basis: getUnitBasis(null),
        configured: false
      };
}

function hasConflict(text, conflicts) {
  const normalized = String(text || "").toLowerCase();
  return conflicts.some((term) => normalized.includes(term));
}

function normaliseDescriptionWords(text) {
  const stopWords = new Set(["and", "or", "the", "not", "of", "for", "to", "in"]);
  return [...new Set(String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .map((word) => word.replace(/(ies|ing|ed|s)$/g, (ending) => ending === "ies" ? "y" : ""))
    .filter((word) => word.length > 2 && !stopWords.has(word)))];
}

function descriptionsAlignWithTariff(input, profile) {
  const entered = normaliseDescriptionWords(input.productDescription);
  const tariff = normaliseDescriptionWords(profile?.tariffDescription || input.productName);
  if (!entered.length || !tariff.length) return false;

  const enteredText = entered.join(" ");
  const tariffText = tariff.join(" ");
  if (enteredText.includes(tariffText) || tariffText.includes(enteredText)) return true;

  const overlap = tariff.filter((word) => entered.includes(word)).length;
  return overlap >= Math.max(2, Math.ceil(tariff.length * 0.6));
}

function getGoodsHsMismatch(input) {
  const code = cleanHsCode(input.hsCode);
  const description = String(input.productDescription || "").trim();
  if (!description) return null;

  const profile = getHsProfile(code);
  if (descriptionsAlignWithTariff(input, profile)) return null;

  const rule = GOODS_CONFLICT_RULES.find((item) => item.test.test(code));
  return rule && hasConflict(description, rule.conflicts) ? rule : null;
}

function getVerifiedGoodsAlignment(input) {
  const profile = getHsProfile(input.hsCode);
  const tariffDescription = profile?.tariffDescription || input.productName;
  return input.hsCodeVerified === true && tariffDescription && descriptionsAlignWithTariff(input, profile)
    ? tariffDescription
    : "";
}

export function assessDataIntegrity(input) {
  const configuredProfile = getExpectedUnitsForHsCode(input.hsCode);
  const profile = getHsProfile(input.hsCode);
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
  let totalReconciliation = null;
  let priceScoringEligible = false;
  let priceStatus = "Not assessed — optional price data not provided";

  if (!profileConfigured) {
    issues.push("The HS Code is not present in the loaded tariff profile catalogue.");
  }

  if (profile?.fields) {
    Object.entries(profile.fields).forEach(([key, policy]) => {
      if (policy === "not-applicable" && hasValue(input[key])) {
        issues.push(`${FIELD_LABELS[key]} is not applicable to the configured ${profile.family} profile; remove it or provide a product-relevant attribute.`);
      }
    });
  }

  if (hasValue(input.quantity) && !isPositiveNumber(input.quantity)) {
    issues.push("Quantity must be a positive number when supplied.");
  }

  const sourceConfidence = Number(input.marketSourceConfidence);
  if (hasValue(input.marketSourceConfidence) && (!Number.isFinite(sourceConfidence) || sourceConfidence < 0 || sourceConfidence > 100)) {
    issues.push("Market-source confidence must be a number between 0 and 100.");
  }
  if (hasValue(input.marketSource) && /^\d+(?:\.\d+)?%?$/.test(String(input.marketSource).trim())) {
    warnings.push("Market-price source appears to contain only a numeric value. Record the actual source separately and use the dedicated confidence field for a percentage.");
  }
  if (hasValue(input.marketSourceConfidence) && !hasValue(input.marketSource)) {
    warnings.push("Market-source confidence was supplied without a market source reference.");
  }

  if (hasValue(input.originCountry) && hasValue(input.destinationCountry) && input.originCountry === input.destinationCountry) {
    warnings.push("Origin and destination countries are identical; confirm that this is an intended cross-border case.");
  }
  if (hasValue(input.portLoading) && hasValue(input.portDischarge) && input.portLoading.trim().toLowerCase() === input.portDischarge.trim().toLowerCase()) {
    warnings.push("Loading and discharge locations are identical; confirm the route and transport leg.");
  }
  if (isPositiveNumber(input.invoicePrice) && isPositiveNumber(input.totalValue) && !isPositiveNumber(input.quantity)) {
    warnings.push("Total declared value and unit price were supplied without a positive quantity; value reconciliation was not possible.");
  }

  const priceFieldLabels = {
    invoicePrice: "Declared unit price",
    marketLow: "Market lower range",
    marketHigh: "Market upper range"
  };
  priceFields.forEach((key) => {
    if (hasValue(input[key]) && !isPositiveNumber(input[key])) {
      issues.push(`${priceFieldLabels[key]} must be a positive number when supplied.`);
    }
  });

  if (priceInputsComplete && !validPriceRange) {
    issues.push("Market lower range cannot exceed the market upper range.");
  }

  const goodsHsMismatch = getGoodsHsMismatch(input);
  if (goodsHsMismatch) {
    issues.push(`The entered goods description appears inconsistent with the tariff-linked ${goodsHsMismatch.label} profile.`);
  }

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

  if (goodsHsMismatch) {
    priceScoringEligible = false;
    priceStatus = "Not comparable — goods / HS Code mismatch";
  } else if (!hasValue(input.productDescription)) {
    warnings.push("Extended goods description is not provided; HS-linked commodity text is being used as the minimum reference.");
  }

  if (isPositiveNumber(input.quantity) && isPositiveNumber(input.invoicePrice) && isPositiveNumber(input.totalValue)) {
    const expectedTotal = Number(input.quantity) * Number(input.invoicePrice);
    const totalDifference = Math.abs(Number(input.totalValue) - expectedTotal) / expectedTotal;
    totalReconciliation = {
      expectedTotal,
      declaredTotal: Number(input.totalValue),
      differencePercent: totalDifference * 100,
      reconciles: totalDifference <= 0.1
    };
    if (totalDifference > 0.1) {
      warnings.push(`Quantity × declared unit price does not reconcile with total declared value (${formatPrice(input.quantity)} × ${formatPrice(input.invoicePrice)} = ${formatPrice(expectedTotal)} expected versus ${formatPrice(input.totalValue)} declared; ${Math.round(totalDifference * 100)}% difference). Confirm that all values use the same unit, currency and valuation basis.`);
    }
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
    profile,
    family: configuredProfile.family || "Other goods",
    preferredUnit: configuredProfile.preferredUnit || "",
    unitConfidence: configuredProfile.confidence || "low",
    priceScoringEligible,
    priceDataProvided,
    priceInputsComplete,
    benchmarkMetadataComplete,
    totalReconciliation,
    priceStatus,
    goodsHsMismatch: Boolean(goodsHsMismatch),
    message: priceScoringEligible
      ? "The price component can be calculated for the supplied unit and range. Source, date and valuation basis improve comparability but do not block this demo."
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
  const selectedIndicators = new Set(input.tbmlIndicators || []);
  const addFlag = (flag, { sourceType = "reviewer-observation", indicatorKey = null } = {}) => {
    flags.push({
      ...flag,
      indicatorKey,
      sourceType,
      selectedIndicator: Boolean(indicatorKey && selectedIndicators.has(indicatorKey))
    });
  };
  const suppressedIndicators = [];
  const suppressIndicator = (key) => {
    if (!suppressedIndicators.includes(key)) suppressedIndicators.push(key);
  };
  const deviation = integrity.priceScoringEligible
    ? outsideRangePercentage(invoicePrice, marketLow, marketHigh)
    : null;
  const suppliedRange = input.currency
    ? `${input.currency} ${formatPrice(marketLow)}–${formatPrice(marketHigh)} per ${input.unitOfMeasure || "unit"}`
    : `${formatPrice(marketLow)}–${formatPrice(marketHigh)} per ${input.unitOfMeasure || "unit"}`;
  const declaredPrice = input.currency
    ? `${input.currency} ${formatPrice(invoicePrice)} per ${input.unitOfMeasure || "unit"}`
    : `${formatPrice(invoicePrice)} per ${input.unitOfMeasure || "unit"}`;
  const routeEvidenceLooksRoutine = /\b(direct|normal|ordinary|expected|regular|routine|commercial)\b/i.test(String(input.routeDetails || ""));
  const priceComparisonDetail = deviation > 0
    ? `Declared unit price: ${declaredPrice}; supplied market range: ${suppliedRange}; the declared price is approximately ${Math.round(deviation)}% ${invoicePrice > marketHigh ? "above the upper bound" : "below the lower bound"}.`
    : `Declared unit price: ${declaredPrice}; supplied market range: ${suppliedRange}; the declared price is inside the supplied range.`;

  if (integrity.priceScoringEligible && deviation >= 100) {
    addFlag({
      id: "price-material",
      title: "Material price deviation",
      points: 25,
      detail: priceComparisonDetail,
      action: "Obtain independent price evidence, product specifications and commercial rationale.",
      source: "Automatic price comparison"
    }, { sourceType: "automatic", indicatorKey: "price-value-anomaly" });
  } else if (integrity.priceScoringEligible && deviation >= 50) {
    addFlag({
      id: "price-significant",
      title: "Significant price deviation",
      points: 15,
      detail: priceComparisonDetail,
      action: "Validate the benchmark, grade, quality, Incoterms and pricing rationale.",
      source: "Automatic price comparison"
    }, { sourceType: "automatic", indicatorKey: "price-value-anomaly" });
  }

  if (!integrity.priceScoringEligible && (input.tbmlIndicators || []).includes("price-value-anomaly")) {
    suppressIndicator("price-value-anomaly");
  }

  if (input.relatedParty) {
    addFlag({
      id: "related-party",
      title: "Potential related-party transaction",
      points: 15,
      detail: "The buyer and seller may have a relationship that requires additional understanding.",
      action: "Confirm ownership, control, beneficial ownership and arm's-length pricing.",
      source: "Reviewer-provided observation"
    }, { sourceType: "reviewer-observation", indicatorKey: "related-party-ubo" });
  }

  if (input.thirdPartyPayment) {
    addFlag({
      id: "third-party-payment",
      title: "Third-party payment arrangement",
      points: 10,
      detail: "The payer may differ from the buyer or contractual counterparty.",
      action: "Establish the commercial purpose and documentary basis for the payment chain.",
      source: "Reviewer-provided observation"
    }, { sourceType: "reviewer-observation", indicatorKey: "third-party-payment" });
  }

  if (input.routeMismatch) {
    addFlag({
      id: "route-anomaly",
      title: routeEvidenceLooksRoutine && selectedIndicators.has("route-port-anomaly")
        ? "Selected route concern conflicts with supplied route rationale"
        : "Shipping route anomaly",
      points: 10,
      detail: routeEvidenceLooksRoutine
        ? "The reviewer recorded a route concern, but the supplied route details describe a routine commercial flow. No automatic route anomaly was identified; provide specific route evidence and rationale or clear the observation."
        : "The selected route may not align with the expected commercial flow.",
      action: routeEvidenceLooksRoutine
        ? "Confirm the specific route evidence supporting the concern, or clear it if the ports, transport leg and commercial rationale reconcile."
        : "Review ports, trans-shipment points, vessel details and the business rationale.",
      source: "Reviewer-provided observation"
    }, { sourceType: "reviewer-observation", indicatorKey: "route-port-anomaly" });
  }

  if (input.documentMismatch) {
    addFlag({
      id: "document-mismatch",
      title: "Cross-document inconsistency",
      points: 15,
      detail: "Important values or descriptions may not align across the trade documents.",
      action: "Reconcile the LC, invoice, packing list, Bill of Lading and supporting documents.",
      source: "Reviewer-provided observation"
    }, { sourceType: "reviewer-observation", indicatorKey: "document-inconsistency" });
  }

  if (input.duplicateInvoice) {
    addFlag({
      id: "duplicate-invoice",
      title: "Potential duplicate invoice",
      points: 20,
      detail: "A similar invoice may have been used in another transaction.",
      action: "Search the internal trade record and confirm unique shipment and document identifiers.",
      source: "Reviewer-provided observation"
    }, { sourceType: "reviewer-observation", indicatorKey: "multiple-phantom-shipment" });
  }

  const goodsHsMismatch = integrity.goodsHsMismatch;
  if (goodsHsMismatch) {
    addFlag({
      id: "goods-hs-mismatch-auto",
      title: "Goods / HS Code mismatch concern",
      points: 15,
      detail: "The entered goods description contains terms that appear inconsistent with the tariff-linked product-family profile.",
      action: "Reconcile the HS Code, goods description, specification and supporting commercial documents.",
      source: "Automatic data-integrity check"
    }, { sourceType: "automatic", indicatorKey: "goods-hs-mismatch" });
  }

  const addManualIndicator = ({ key, id, title, points, detail, action, coveredBy, suppressWhen }) => {
    if (!selectedIndicators.has(key)) return;
    if (suppressWhen?.()) {
      suppressIndicator(key);
      return;
    }
    if (coveredBy && coveredBy()) return;

    addFlag({
      id,
      title,
      points,
      detail,
      action,
      source: "Selected TBML indicator"
    }, { sourceType: "selected", indicatorKey: key });
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
    title: getVerifiedGoodsAlignment(input)
      ? "Selected goods / HS concern conflicts with verified description"
      : "Goods / HS Code mismatch concern",
    points: 15,
    detail: getVerifiedGoodsAlignment(input)
      ? `The reviewer selected this concern, but verified HS Code ${input.hsCode} is tariff-described as “${getVerifiedGoodsAlignment(input)}”, which aligns with the entered goods description. No automatic goods / HS conflict was identified; provide a specific rationale or clear the selection.`
      : "The goods description, specification or classification may not align with the declared HS Code.",
    action: getVerifiedGoodsAlignment(input)
      ? "Confirm the specific evidence supporting the concern, or clear the selection if the verified tariff description and goods documents agree."
      : "Reconcile the HS Code with the goods, quality, composition, model and supporting commercial documents.",
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
    title: routeEvidenceLooksRoutine
      ? "Selected route concern conflicts with supplied route rationale"
      : "Route / port anomaly concern",
    points: 10,
    detail: routeEvidenceLooksRoutine
      ? "The reviewer selected this concern, but the supplied route details describe a routine commercial flow. No automatic route anomaly was identified; provide specific route evidence and rationale or clear the selection."
      : "The route, port, trans-shipment point or shipment pattern may require additional commercial explanation.",
    action: routeEvidenceLooksRoutine
      ? "Confirm the specific route evidence supporting the concern, or clear the selection if the ports, transport leg and commercial rationale reconcile."
      : "Review the expected route, ports, vessel details, trans-shipment and business rationale.",
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
  const evidenceGaps = [];
  if (hasManualIndicator && !input.indicatorConfidence) evidenceGaps.push("indicator confidence");
  if (hasManualIndicator && input.evidenceStatus !== "Available for review") evidenceGaps.push("evidence status of Available for review");
  if (hasManualIndicator && !String(input.reviewerEvidenceNote || "").trim()) evidenceGaps.push("reviewer rationale note");
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
    readinessIssues.push(`Decision-readiness evidence is incomplete: provide ${evidenceGaps.join(", ")}.`);
  }

  const routeConcernSelected = input.routeMismatch || selectedIndicators.has("route-port-anomaly");
  const routeContextReady = Boolean(input.portLoading && input.portDischarge && input.routeDetails && input.businessProfile);
  if (routeConcernSelected && !routeContextReady) {
    readinessIssues.push("Route concerns remain indicative until ports, route evidence and business context are provided.");
  }

  if (input.hsCodeVerified === false) {
    readinessIssues.push("The HS Code has not been verified against the tariff reference.");
  }

  const unknownCounterpartyFields = [
    ["beneficial ownership", input.beneficialOwnership],
    ["buyer–seller relationship", input.relatedPartyRelationship],
    ["payer relationship", input.payerRelationship]
  ].filter(([, value]) => ["unknown", "unknown / not provided", "not provided"].includes(String(value || "").trim().toLowerCase()));
  if (unknownCounterpartyFields.length) {
    readinessIssues.push(`Decision-readiness counterparty context is incomplete: confirm ${unknownCounterpartyFields.map(([label]) => label).join(", ")}. “Unknown / not provided” supports triage only.`);
  }

  const decisionReady = readinessIssues.length === 0;
  const score = decisionReady ? cappedScore : null;
  const indicativeScore = flags.length ? cappedScore : null;
  const getBand = (value) => {
    if (value >= 75) return "Critical";
    if (value >= 50) return "High";
    if (value >= 25) return "Medium";
    return "Low";
  };
  const band = decisionReady ? getBand(score) : "Not decision-ready";
  const indicativeBand = indicativeScore === null ? null : getBand(indicativeScore);

  const selectedIndicatorMappings = [...selectedIndicators].map((key) => {
    const relatedFlags = flags.filter((flag) => flag.indicatorKey === key);
    const suppressed = suppressedIndicators.includes(key);
    return {
      key,
      status: suppressed ? "not-assessed" : relatedFlags.length ? "represented" : "selected-only",
      flagIds: relatedFlags.map((flag) => flag.id),
      sources: [...new Set(relatedFlags.map((flag) => flag.sourceType))]
    };
  });
  const reviewerObservationOnlyFlags = flags.filter(
    (flag) => flag.sourceType === "reviewer-observation" && !flag.selectedIndicator
  );
  const automaticFlags = flags.filter((flag) => flag.sourceType === "automatic");

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
      : `Do not use this output for a compliance decision. Resolve the following decision-readiness gaps: ${readinessIssues.join(" ")} Then rerun the case.`;

  return {
    score,
    indicativeScore,
    rawScore,
    cappedScore,
    scoreCapApplied: rawScore > 100,
    band,
    decisionReady,
    decisionStatus: decisionReady
      ? (flags.length ? "Ready for authorised review" : "Indicative demo complete — no scoreable signal")
      : "Not decision-ready",
    evidenceReady,
    evidenceGaps,
    readinessIssues,
    flags,
    deviation,
    integrity,
    priceScoringEligible: integrity.priceScoringEligible,
    suppressedIndicators,
    selectedIndicatorCount: selectedIndicators.size,
    selectedIndicatorMappings,
    reviewerObservationOnlyFlags,
    automaticFlags,
    indicativeBand,
    assessmentTimestamp: new Date().toISOString(),
    rulesetVersion: RULESET_VERSION,
    recommendation
  };
}

export function bandClass(band) {
  return band === "Not decision-ready"
    ? "status-not-ready"
    : `status-${band.toLowerCase()}`;
}
