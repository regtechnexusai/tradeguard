import { assessDataIntegrity, bandClass, getExpectedUnitsForHsCode } from "./rules.js?v=12";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-US", {
    maximumFractionDigits: 2
  });
}

const completenessFields = [
  ["Product / commodity from HS Code", "productName"],
  ["HS Code", "hsCode"],
  ["Product / goods description", "productDescription"],
  ["Quality / grade", "qualityGrade"],
  ["Material / composition", "material"],
  ["Model / brand", "modelBrand"],
  ["Technical specification", "specification"],
  ["Business profile / trade rationale", "businessProfile"],
  ["Quantity", "quantity"],
  ["Unit of measure", "unitOfMeasure"],
  ["Declared unit price", "invoicePrice"],
  ["Total declared value", "totalValue"],
  ["Currency", "currency"],
  ["Market lower range", "marketLow"],
  ["Market upper range", "marketHigh"],
  ["Market-price source", "marketSource"],
  ["Market-source confidence", "marketSourceConfidence"],
  ["Market-price date", "marketSourceDate"],
  ["Valuation basis", "valuationBasis"],
  ["Origin country", "originCountry"],
  ["Destination country", "destinationCountry"],
  ["Incoterms", "incoterms"],
  ["Payment terms", "paymentTerms"],
  ["Buyer reference", "buyerReference"],
  ["Seller reference", "sellerReference"],
  ["Beneficial ownership", "beneficialOwnership"],
  ["Related-party relationship", "relatedPartyRelationship"],
  ["Payer relationship", "payerRelationship"],
  ["Port of loading", "portLoading"],
  ["Port of discharge", "portDischarge"],
  ["Route details", "routeDetails"],
  ["Invoice consistency", "invoiceConsistency"],
  ["Packing-list consistency", "packingListConsistency"],
  ["Bill of Lading consistency", "billOfLadingConsistency"]
  , ["Indicator confidence", "indicatorConfidence"]
  , ["Evidence status", "evidenceStatus"]
  , ["Reviewer evidence note", "reviewerEvidenceNote"]
];

export const TBML_INDICATOR_LABELS = {
  "price-value-anomaly": "Price / valuation anomaly",
  "goods-hs-mismatch": "Goods / HS Code mismatch",
  "quantity-unit-mismatch": "Quantity / unit inconsistency",
  "document-inconsistency": "Document inconsistency",
  "route-port-anomaly": "Route / port anomaly",
  "related-party-ubo": "Related party / UBO concern",
  "third-party-payment": "Third-party payment",
  "multiple-phantom-shipment": "Multiple / phantom shipment concern",
  "business-profile-mismatch": "Business-profile mismatch",
  "unusual-payment-terms": "Unusual payment terms"
};

export function calculateDataCompleteness(input) {
  const profile = getExpectedUnitsForHsCode(input.hsCode);
  const applicableFields = completenessFields.filter(([, key]) => profile.fields?.[key] !== "not-applicable");
  const completed = applicableFields.filter(([, key]) => {
    const value = input[key];
    return value !== undefined && value !== null && String(value).trim() !== "";
  }).length;

  const percent = applicableFields.length
    ? Math.round((completed / applicableFields.length) * 100)
    : 0;

  let message =
    `Applicable fields completed: ${completed}/${applicableFields.length}. This is not a decision-readiness result; supporting evidence and authorised reviewer judgement remain necessary.`;

  if (percent >= 80) {
    message =
      `Applicable fields completed: ${completed}/${applicableFields.length}. The information is relatively complete, but completeness does not make the case decision-ready.`;
  } else if (percent >= 50) {
    message =
      `Applicable fields completed: ${completed}/${applicableFields.length}. Additional information is recommended before relying on the assessment for a material decision.`;
  }

  return { completed, total: applicableFields.length, percent, message, excluded: completenessFields.length - applicableFields.length };
}

export function renderReport(result, input) {
  const reportPanel = document.querySelector("#reportPanel");
  const emptyReport = document.querySelector("#emptyReport");
  const reportContent = document.querySelector("#reportContent");
  const score = document.querySelector("#reportScore");
  const scoreSuffix = document.querySelector("#reportScoreSuffix");
  const band = document.querySelector("#reportBand");
  const gauge = document.querySelector("#reportGauge");
  const gaugeShell = gauge.parentElement;
  const decisionReadiness = document.querySelector("#decisionReadiness");
  const decisionStatus = document.querySelector("#decisionStatus");
  const decisionStatusMessage = document.querySelector("#decisionStatusMessage");
  const rawScoreValue = document.querySelector("#rawScoreValue");
  const summary = document.querySelector("#reportSummary");
  const flagCount = document.querySelector("#flagCount");
  const flagList = document.querySelector("#flagList");
  const recommendation = document.querySelector("#recommendationText");
  const completenessValue = document.querySelector("#dataCompletenessValue");
  const completenessBar = document.querySelector("#dataCompletenessBar");
  const completenessMessage = document.querySelector("#dataCompletenessMessage");
  const integrityCard = document.querySelector("#dataIntegrityCard");
  const integrityValue = document.querySelector("#dataIntegrityValue");
  const integrityMessage = document.querySelector("#dataIntegrityMessage");
  const integrityList = document.querySelector("#dataIntegrityList");
  const reviewContext = document.querySelector("#reviewContext");

  const completeness = calculateDataCompleteness(input);
  const integrity = result.integrity || assessDataIntegrity(input);

  reportPanel.classList.remove("is-empty");
  emptyReport.hidden = true;
  reportContent.hidden = false;
  const hasFlags = result.flags.length > 0;
  const indicativeScore = hasFlags ? result.indicativeScore : null;
  const hasIndicativeScore = Number.isFinite(indicativeScore);
  const hasIssuedScore = result.decisionReady && hasFlags;
  score.textContent = hasIssuedScore || hasIndicativeScore ? (result.decisionReady ? result.score : indicativeScore) : "—";
  score.classList.toggle("score-withheld", !result.decisionReady && !hasIndicativeScore);
  score.classList.toggle("score-indicative", !result.decisionReady && hasIndicativeScore);
  score.classList.toggle("score-no-signal", !hasFlags);
  scoreSuffix.textContent = result.decisionReady
    ? (hasFlags ? "/100" : "no scoreable signal")
    : (hasIndicativeScore ? (result.scoreCapApplied ? "indicative / capped" : "indicative") : "no scoreable inputs");
  band.textContent = result.decisionReady
    ? (hasFlags ? result.band.toUpperCase() : "NO SIGNAL")
    : (hasIndicativeScore ? "INDICATIVE ONLY" : "NOT READY");
  band.className = `status-pill ${result.decisionReady ? (hasFlags ? bandClass(result.band) : "status-no-signal") : (hasIndicativeScore ? "status-medium" : "status-not-ready")}`;
  const gaugeScore = result.decisionReady ? result.score : (indicativeScore || 0);
  gaugeShell.style.background = `conic-gradient(#1967d2 ${gaugeScore * 3.6}deg, #dcecf6 0deg)`;
  flagCount.textContent = `${result.flags.length} ${result.flags.length === 1 ? "flag" : "flags"}`;
  rawScoreValue.textContent = hasFlags ? result.rawScore : "—";
  decisionStatus.textContent = result.decisionStatus;
  decisionStatusMessage.textContent = result.decisionReady
    ? (hasFlags
      ? `The score passed the current data-integrity and evidence gates. It remains an indicative review signal.${result.scoreCapApplied ? " Raw indicator points exceeded 100, so the issued score is capped at 100." : ""}`
      : "No configured risk indicator was triggered by the supplied inputs. This is not a finding of low risk.")
    : (hasIndicativeScore
      ? `An indicative score is shown from the supplied inputs. The decision-ready score remains withheld until the listed conditions are resolved.`
      : "No numeric scoreable signal was available from the supplied inputs. Add optional price data or select supported review indicators to generate an indicative signal.");
  decisionReadiness.classList.toggle("is-blocked", !result.decisionReady);
  decisionReadiness.classList.toggle("is-ready", result.decisionReady && hasFlags);
  decisionReadiness.classList.toggle("is-neutral", result.decisionReady && !hasFlags);

  const priceText = result.deviation === null
    ? (integrity.priceDataProvided
      ? "Price comparison was not issued because the supplied price inputs are incomplete or not comparable to the verified HS Code and unit."
      : "Price comparison was not run because the optional price fields were not provided.")
    : result.deviation > 0
      ? `The declared price is approximately ${Math.round(result.deviation)}% outside the supplied market range.`
      : "The declared price falls inside the supplied market range.";

  const hsText = ` HS Code: ${escapeHtml(input.hsCode)}; ${escapeHtml(integrity.family || "Product-family")} tariff-linked profile loaded.`;

  const selectedIndicatorCount = (input.tbmlIndicators || []).length;
  const indicatorText = selectedIndicatorCount
    ? ` ${selectedIndicatorCount} structured TBML indicator${selectedIndicatorCount === 1 ? " is" : "s are"} selected.`
    : " No structured TBML indicator was selected.";

  const readinessText = result.decisionReady
    ? (hasFlags
      ? "This is a prioritisation signal, not a final TBML determination."
      : "No configured signal was triggered by the supplied inputs; this is not a finding of low risk.")
    : (hasIndicativeScore
      ? "An indicative signal is shown, but the decision-ready risk score remains withheld until the listed issues are resolved."
      : "No numeric score was issued because the supplied inputs did not produce a scoreable signal.");
  const suppressedText = result.suppressedIndicators?.length
    ? ` The following selected indicator${result.suppressedIndicators.length === 1 ? " is" : "s are"} not assessed: ${result.suppressedIndicators.map((id) => TBML_INDICATOR_LABELS[id] || id).join(", ")}.`
    : "";
  summary.innerHTML = `<strong>${escapeHtml(input.productName)}</strong> — ${escapeHtml(input.originCountry)} to ${escapeHtml(input.destinationCountry)}. ${priceText}${hsText}${indicatorText}${suppressedText} ${readinessText}`;

  completenessValue.textContent = `${completeness.percent}%`;
  completenessBar.style.width = `${completeness.percent}%`;
  completenessMessage.textContent = completeness.message;

  integrityValue.textContent = integrity.status;
  integrityValue.className = integrity.priceScoringEligible ? "integrity-good" : "integrity-blocked";
  integrityMessage.textContent = integrity.message;
  const integrityItems = [...integrity.issues, ...integrity.warnings];
  if (result.suppressedIndicators?.length) {
    integrityItems.push(`Selected but not assessed: ${result.suppressedIndicators.map((id) => TBML_INDICATOR_LABELS[id] || id).join(", ")}.`);
  }
  integrityList.innerHTML = integrityItems
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
  integrityCard.classList.toggle("is-blocked", !integrity.priceScoringEligible || !result.decisionReady);

  const contextItems = [
    input.productDescription && `Goods: ${input.productDescription}`,
    input.qualityGrade && `Grade: ${input.qualityGrade}`,
    input.material && `Material: ${input.material}`,
    input.unitOfMeasure && `Unit: ${input.unitOfMeasure}`,
    integrity.expectedUnits?.length && `Expected unit profile: ${integrity.expectedUnits.join(" or ")}`,
    integrity.preferredUnit && `Preferred benchmark unit: ${integrity.preferredUnit}`,
    input.currency && `Currency: ${input.currency}`,
    input.totalValue && `Total value: ${formatNumber(input.totalValue)}`,
    input.marketSource && `Market source: ${input.marketSource}`,
    input.marketSourceConfidence && `Market-source confidence: ${input.marketSourceConfidence}%`,
    input.marketSourceDate && `Market source date: ${input.marketSourceDate}`,
    input.valuationBasis && `Valuation basis: ${input.valuationBasis}`,
    input.incoterms && `Incoterms: ${input.incoterms}`,
    input.paymentTerms && `Payment: ${input.paymentTerms}`,
    input.portLoading && `Loading point / port: ${input.portLoading}`,
    input.portDischarge && `Discharge point / port: ${input.portDischarge}`,
    input.businessProfile && `Business profile / rationale: ${input.businessProfile}`,
    input.tbmlIndicators?.length && `TBML indicators: ${input.tbmlIndicators.map((id) => TBML_INDICATOR_LABELS[id] || id).join(", ")}`,
    input.indicatorConfidence && `Indicator confidence: ${input.indicatorConfidence}`,
    input.evidenceStatus && `Evidence status: ${input.evidenceStatus}`,
    input.reviewerEvidenceNote && `Reviewer evidence note: ${input.reviewerEvidenceNote}`
  ].filter(Boolean);

  reviewContext.innerHTML = contextItems.length
    ? `<strong>Additional review context:</strong> ${escapeHtml(contextItems.join(" • "))}`
    : "No optional supporting details were provided.";

  if (!result.flags.length) {
    flagList.innerHTML = `<div class="flag-item"><span class="flag-marker" style="background:#14866b;box-shadow:0 0 0 4px rgba(20,134,107,.13)"></span><div><strong>No configured red flag was triggered</strong><p>This is not a finding of low risk. Add optional transaction data and supporting evidence for a more specific review signal.</p></div><span class="flag-points" style="color:#14866b">—</span></div>`;
  } else {
    flagList.innerHTML = result.flags.map((flag) => `
      <article class="flag-item">
        <span class="flag-marker"></span>
        <div>
          <strong>${escapeHtml(flag.title)}</strong>
          <small class="flag-source">${escapeHtml(flag.source || "Review signal")}</small>
          <p>${escapeHtml(flag.detail)}</p>
        </div>
        <span class="flag-points">+${flag.points}</span>
      </article>
    `).join("");
  }

  recommendation.textContent = `${result.recommendation} ${integrity.priceDataProvided && !result.priceScoringEligible ? "Do not rely on the price component until the data-integrity issues are corrected." : ""} ${completeness.percent < 80 ? "Obtain additional supporting information before relying on this result." : ""}`.trim();

  return [
    "TradeGuard by RegTech Nexus AI",
    `Product: ${input.productName}`,
    `Route: ${input.originCountry} → ${input.destinationCountry}`,
    input.hsCode ? `HS Code: ${input.hsCode}` : "HS Code: Not provided",
    `Decision status: ${result.decisionStatus}`,
    `Raw indicator points: ${result.rawScore}`,
    result.decisionReady && result.flags.length
      ? `Risk score: ${result.score}/100 (${result.band})`
      : result.indicativeScore !== null && result.indicativeScore !== undefined
        ? `Indicative score: ${result.indicativeScore}/100 — decision-ready score withheld`
        : "Risk score: No scoreable signal from the supplied inputs",
    `Score cap applied: ${result.scoreCapApplied ? "Yes — raw indicator points exceeded 100" : "No"}`,
    result.readinessIssues.length ? `Readiness issues: ${result.readinessIssues.join(" | ")}` : "Readiness issues: None identified by configured gates",
    `Data completeness: ${completeness.percent}%`,
    `Data integrity / comparability: ${integrity.status}`,
    integrity.issues.length ? `Integrity issues: ${integrity.issues.join(" | ")}` : "Integrity issues: None identified by configured checks",
    `Price component: ${result.priceScoringEligible ? "Calculated" : integrity.priceDataProvided ? "Not comparable / withheld" : "Not assessed — optional data not provided"}`,
    `TBML indicators selected: ${(input.tbmlIndicators || []).map((id) => TBML_INDICATOR_LABELS[id] || id).join(", ") || "None"}`,
    result.suppressedIndicators?.length
      ? `Selected but not assessed: ${result.suppressedIndicators.map((id) => TBML_INDICATOR_LABELS[id] || id).join(", ")}`
      : null,
    `Indicator confidence: ${input.indicatorConfidence || "Not provided"}`,
    `Evidence status: ${input.evidenceStatus || "Not provided"}`,
    `Detected flags: ${result.flags.length}`,
    ...result.flags.map((flag) => `- ${flag.title} [${flag.source || "Review signal"}]: ${flag.detail}`),
    `Suggested next step: ${result.recommendation}`,
    "Assessment is indicative and depends on the quality, completeness and genuineness of the information provided.",
    "Demo output only. Final decisions remain with the authorised reviewer."
  ].join("\n");
}

export function setSampleValues() {
  const values = {
    hsCode: "52010000",
    productDescription: "Cotton, not carded or combed; illustrative raw cotton shipment",
    qualityGrade: "Commercial grade",
    material: "100% cotton",
    modelBrand: "Demo product",
    specification: "Illustrative sample goods description",
    quantity: "100000",
    unitOfMeasure: "Kilogram",
    invoicePrice: "50",
    totalValue: "5000000",
    currency: "USD",
    marketLow: "10",
    marketHigh: "12",
    marketSource: "Illustrative demo benchmark — replace with a verified market source",
    marketSourceConfidence: "75",
    marketSourceDate: "2026-09-14",
    valuationBasis: "Commercial invoice",
    originCountry: "Bangladesh",
    destinationCountry: "United Arab Emirates",
    incoterms: "FOB",
    paymentTerms: "Sight LC",
    buyerReference: "UAE importer demo",
    sellerReference: "Bangladesh exporter demo",
    beneficialOwnership: "Unknown",
    relatedPartyRelationship: "Unknown",
    payerRelationship: "Third party",
    portLoading: "Chattogram",
    portDischarge: "Jebel Ali",
    routeDetails: "Illustrative direct commercial route",
    businessProfile: "Illustrative textile/raw-cotton trading business",
    invoiceConsistency: "Needs review",
    packingListConsistency: "Consistent",
    billOfLadingConsistency: "Not provided"
    , indicatorConfidence: "Medium"
    , evidenceStatus: "Partially available",
    reviewerEvidenceNote: "Illustrative demo note only; validate selected indicators against genuine commercial and transport evidence."
  };

  Object.entries(values).forEach(([id, value]) => {
    const element = document.querySelector(`#${id}`);
    if (element) element.value = value;
  });

  document.querySelector("#relatedParty").checked = true;
  document.querySelector("#thirdPartyPayment").checked = true;
  document.querySelector("#routeMismatch").checked = false;
  document.querySelector("#documentMismatch").checked = true;
  document.querySelector("#duplicateInvoice").checked = false;

  ["tbmlPriceValue", "tbmlGoodsHsMismatch", "tbmlRelatedUbo", "tbmlThirdPartyPayment", "tbmlDocumentInconsistency"].forEach((id) => {
    const element = document.querySelector(`#${id}`);
    if (element) element.checked = true;
  });
}

export function collectInput() {
  const value = (id) => document.querySelector(`#${id}`)?.value.trim() || "";
  const checked = (id) => Boolean(document.querySelector(`#${id}`)?.checked);
  const relatedPartyRelationship = value("relatedPartyRelationship");
  const payerRelationship = value("payerRelationship");
  const documentStatuses = [
    value("invoiceConsistency"),
    value("packingListConsistency"),
    value("billOfLadingConsistency")
  ];
  const tbmlIndicators = [...document.querySelectorAll("[data-tbml-indicator]:checked")]
    .map((element) => element.dataset.tbmlIndicator)
    .filter(Boolean);

  return {
    productName: value("productCommodity"),
    hsCode: value("hsCode"),
    hsCodeVerified: document.querySelector("#hsCode")?.dataset.verified === "true",
    expectedUnits: JSON.parse(document.querySelector("#hsCode")?.dataset.expectedUnits || "[]"),
    productDescription: value("productDescription"),
    qualityGrade: value("qualityGrade"),
    material: value("material"),
    modelBrand: value("modelBrand"),
    specification: value("specification"),
    quantity: value("quantity"),
    unitOfMeasure: value("unitOfMeasure"),
    invoicePrice: value("invoicePrice"),
    totalValue: value("totalValue"),
    currency: value("currency"),
    marketLow: value("marketLow"),
    marketHigh: value("marketHigh"),
    marketSource: value("marketSource"),
    marketSourceConfidence: value("marketSourceConfidence"),
    marketSourceDate: value("marketSourceDate"),
    valuationBasis: value("valuationBasis"),
    originCountry: value("originCountry"),
    destinationCountry: value("destinationCountry"),
    incoterms: value("incoterms"),
    paymentTerms: value("paymentTerms"),
    buyerReference: value("buyerReference"),
    sellerReference: value("sellerReference"),
    beneficialOwnership: value("beneficialOwnership"),
    relatedPartyRelationship,
    payerRelationship,
    portLoading: value("portLoading"),
    portDischarge: value("portDischarge"),
    routeDetails: value("routeDetails"),
    businessProfile: value("businessProfile"),
    invoiceConsistency: value("invoiceConsistency"),
    packingListConsistency: value("packingListConsistency"),
    billOfLadingConsistency: value("billOfLadingConsistency"),
    tbmlIndicators,
    indicatorConfidence: value("indicatorConfidence"),
    evidenceStatus: value("evidenceStatus"),
    reviewerEvidenceNote: value("reviewerEvidenceNote"),
    relatedParty: checked("relatedParty") || ["Possible relationship", "Confirmed relationship"].includes(relatedPartyRelationship),
    thirdPartyPayment: checked("thirdPartyPayment") || payerRelationship === "Third party",
    routeMismatch: checked("routeMismatch"),
    documentMismatch: checked("documentMismatch") || documentStatuses.includes("Needs review"),
    duplicateInvoice: checked("duplicateInvoice")
  };
}

export function validateInput(input) {
  const errors = {};

  if (!input.hsCode) {
    errors.hsCode = "HS Code is required.";
  } else if (!/^\d{8}$/.test(input.hsCode)) {
    errors.hsCode = "Enter exactly 8 digits for the HS Code.";
  } else if (!input.hsCodeVerified) {
    errors.hsCode = "Verify a valid HS Code from the tariff reference.";
  }

  if (
    input.marketLow &&
    input.marketHigh &&
    Number.isFinite(Number(input.marketLow)) &&
    Number.isFinite(Number(input.marketHigh)) &&
    Number(input.marketHigh) < Number(input.marketLow)
  ) {
    errors.marketLow = "Lower range cannot exceed the upper range.";
    errors.marketHigh = "Upper range must be greater than or equal to the lower range.";
  }

  if (!input.originCountry) {
    errors.originCountry = "Select the country of origin.";
  }

  if (!input.destinationCountry) {
    errors.destinationCountry = "Select the country of destination.";
  }

  const numericFields = [
    ["quantity", "Quantity"],
    ["invoicePrice", "Declared unit price"],
    ["marketLow", "Market lower range"],
    ["marketHigh", "Market upper range"],
    ["totalValue", "Total declared value"]
  ];
  numericFields.forEach(([key, label]) => {
    if (input[key] && (!Number.isFinite(Number(input[key])) || Number(input[key]) <= 0)) {
      errors[key] = `${label} must be a positive number when supplied.`;
    }
  });

  if (!input.beneficialOwnership) {
    errors.beneficialOwnership = "Select a beneficial-ownership status, or choose Unknown / not provided.";
  }

  if (!input.relatedPartyRelationship) {
    errors.relatedPartyRelationship = "Select the buyer–seller relationship status, or choose Unknown / not provided.";
  }

  if (!input.payerRelationship) {
    errors.payerRelationship = "Select the payer relationship, or choose Unknown / not provided.";
  }

  const count = Object.keys(errors).length;

  return {
    errors,
    message: count
      ? `Please correct ${count} required field${count === 1 ? "" : "s"} before submitting.`
      : ""
  };
}
