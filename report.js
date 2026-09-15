import { bandClass } from "./rules.js?v=8";

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
  ["Quantity", "quantity"],
  ["Unit of measure", "unitOfMeasure"],
  ["Declared unit price", "invoicePrice"],
  ["Total declared value", "totalValue"],
  ["Currency", "currency"],
  ["Market lower range", "marketLow"],
  ["Market upper range", "marketHigh"],
  ["Market-price source", "marketSource"],
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
  const completed = completenessFields.filter(([, key]) => {
    const value = input[key];
    return value !== undefined && value !== null && String(value).trim() !== "";
  }).length;

  const percent = Math.round((completed / completenessFields.length) * 100);

  let message =
    "More supporting information is required for a reliable assessment. Treat this as an indicative risk signal only.";

  if (percent >= 80) {
    message =
      "The supplied information is relatively complete. Supporting evidence and authorised reviewer judgement remain necessary.";
  } else if (percent >= 50) {
    message =
      "Additional information is recommended before relying on the assessment for a material decision.";
  }

  return { completed, total: completenessFields.length, percent, message };
}

export function renderReport(result, input) {
  const reportPanel = document.querySelector("#reportPanel");
  const emptyReport = document.querySelector("#emptyReport");
  const reportContent = document.querySelector("#reportContent");
  const score = document.querySelector("#reportScore");
  const band = document.querySelector("#reportBand");
  const gauge = document.querySelector("#reportGauge");
  const gaugeShell = gauge.parentElement;
  const summary = document.querySelector("#reportSummary");
  const flagCount = document.querySelector("#flagCount");
  const flagList = document.querySelector("#flagList");
  const recommendation = document.querySelector("#recommendationText");
  const completenessValue = document.querySelector("#dataCompletenessValue");
  const completenessBar = document.querySelector("#dataCompletenessBar");
  const completenessMessage = document.querySelector("#dataCompletenessMessage");
  const reviewContext = document.querySelector("#reviewContext");

  const completeness = calculateDataCompleteness(input);

  reportPanel.classList.remove("is-empty");
  emptyReport.hidden = true;
  reportContent.hidden = false;
  score.textContent = result.score;
  band.textContent = result.band.toUpperCase();
  band.className = `status-pill ${bandClass(result.band)}`;
  gaugeShell.style.background = `conic-gradient(#1967d2 ${result.score * 3.6}deg, #dcecf6 0deg)`;
  flagCount.textContent = `${result.flags.length} ${result.flags.length === 1 ? "flag" : "flags"}`;

  const priceText = result.deviation > 0
    ? `The declared price is approximately ${Math.round(result.deviation)}% outside the supplied market range.`
    : "The declared price falls inside the supplied market range.";

  const hsText = ` HS Code: ${escapeHtml(input.hsCode)}; product/commodity was populated from the verified tariff description.`;

  const selectedIndicatorCount = (input.tbmlIndicators || []).length;
  const indicatorText = selectedIndicatorCount
    ? ` ${selectedIndicatorCount} structured TBML indicator${selectedIndicatorCount === 1 ? " is" : "s are"} selected.`
    : " No structured TBML indicator was selected.";

  summary.innerHTML = `<strong>${escapeHtml(input.productName)}</strong> — ${escapeHtml(input.originCountry)} to ${escapeHtml(input.destinationCountry)}. ${priceText}${hsText}${indicatorText} This is a prioritisation signal, not a final TBML determination.`;

  completenessValue.textContent = `${completeness.percent}%`;
  completenessBar.style.width = `${completeness.percent}%`;
  completenessMessage.textContent = completeness.message;

  const contextItems = [
    input.productDescription && `Goods: ${input.productDescription}`,
    input.qualityGrade && `Grade: ${input.qualityGrade}`,
    input.material && `Material: ${input.material}`,
    input.unitOfMeasure && `Unit: ${input.unitOfMeasure}`,
    input.currency && `Currency: ${input.currency}`,
    input.totalValue && `Total value: ${formatNumber(input.totalValue)}`,
    input.valuationBasis && `Valuation basis: ${input.valuationBasis}`,
    input.incoterms && `Incoterms: ${input.incoterms}`,
    input.paymentTerms && `Payment: ${input.paymentTerms}`,
    input.portLoading && `Loading port: ${input.portLoading}`,
    input.portDischarge && `Discharge port: ${input.portDischarge}`,
    input.tbmlIndicators?.length && `TBML indicators: ${input.tbmlIndicators.map((id) => TBML_INDICATOR_LABELS[id] || id).join(", ")}`,
    input.indicatorConfidence && `Indicator confidence: ${input.indicatorConfidence}`,
    input.evidenceStatus && `Evidence status: ${input.evidenceStatus}`
  ].filter(Boolean);

  reviewContext.innerHTML = contextItems.length
    ? `<strong>Additional review context:</strong> ${escapeHtml(contextItems.join(" • "))}`
    : "No optional supporting details were provided.";

  if (!result.flags.length) {
    flagList.innerHTML = `<div class="flag-item"><span class="flag-marker" style="background:#14866b;box-shadow:0 0 0 4px rgba(20,134,107,.13)"></span><div><strong>No configured red flag was triggered</strong><p>Retain the supporting evidence and continue normal controls.</p></div><span class="flag-points" style="color:#14866b">0</span></div>`;
  } else {
    flagList.innerHTML = result.flags.map((flag) => `
      <article class="flag-item">
        <span class="flag-marker"></span>
        <div>
          <strong>${escapeHtml(flag.title)}</strong>
          <p>${escapeHtml(flag.detail)}</p>
        </div>
        <span class="flag-points">+${flag.points}</span>
      </article>
    `).join("");
  }

  recommendation.textContent = `${result.recommendation} ${completeness.percent < 80 ? "Obtain additional supporting information before relying on this result." : ""}`.trim();

  return [
    "TradeGuard by RegTech Nexus AI",
    `Product: ${input.productName}`,
    `Route: ${input.originCountry} → ${input.destinationCountry}`,
    input.hsCode ? `HS Code: ${input.hsCode}` : "HS Code: Not provided",
    `Risk score: ${result.score}/100 (${result.band})`,
    `Data completeness: ${completeness.percent}%`,
    `TBML indicators selected: ${(input.tbmlIndicators || []).map((id) => TBML_INDICATOR_LABELS[id] || id).join(", ") || "None"}`,
    `Indicator confidence: ${input.indicatorConfidence || "Not provided"}`,
    `Evidence status: ${input.evidenceStatus || "Not provided"}`,
    `Detected flags: ${result.flags.length}`,
    ...result.flags.map((flag) => `- ${flag.title}: ${flag.detail}`),
    `Suggested next step: ${result.recommendation}`,
    "Assessment is indicative and depends on the quality, completeness and genuineness of the information provided.",
    "Demo output only. Final decisions remain with the authorised reviewer."
  ].join("\n");
}

export function setSampleValues() {
  const values = {
    hsCode: "52010000",
    productDescription: "Cotton, not carded or combed; illustrative textile shipment",
    qualityGrade: "Commercial grade",
    material: "100% cotton",
    modelBrand: "Demo product",
    specification: "Illustrative sample goods description",
    quantity: "100000",
    unitOfMeasure: "Yard",
    invoicePrice: "50",
    totalValue: "5000000",
    currency: "USD",
    marketLow: "10",
    marketHigh: "12",
    marketSource: "Illustrative market range",
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
    invoiceConsistency: "Needs review",
    packingListConsistency: "Consistent",
    billOfLadingConsistency: "Not provided"
    , indicatorConfidence: "Medium"
    , evidenceStatus: "Partially available"
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
    invoiceConsistency: value("invoiceConsistency"),
    packingListConsistency: value("packingListConsistency"),
    billOfLadingConsistency: value("billOfLadingConsistency"),
    tbmlIndicators,
    indicatorConfidence: value("indicatorConfidence"),
    evidenceStatus: value("evidenceStatus"),
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

  if (!input.quantity || !Number.isFinite(Number(input.quantity)) || Number(input.quantity) <= 0) {
    errors.quantity = "Enter a quantity greater than zero.";
  }

  if (!input.invoicePrice || !Number.isFinite(Number(input.invoicePrice)) || Number(input.invoicePrice) <= 0) {
    errors.invoicePrice = "Enter a declared unit price greater than zero.";
  }

  if (!input.marketLow || !Number.isFinite(Number(input.marketLow)) || Number(input.marketLow) <= 0) {
    errors.marketLow = "Enter the lower market range greater than zero.";
  }

  if (!input.marketHigh || !Number.isFinite(Number(input.marketHigh)) || Number(input.marketHigh) <= 0) {
    errors.marketHigh = "Enter the upper market range greater than zero.";
  }

  if (
    input.marketLow &&
    input.marketHigh &&
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

  const count = Object.keys(errors).length;

  return {
    errors,
    message: count
      ? `Please correct ${count} required field${count === 1 ? "" : "s"} before submitting.`
      : ""
  };
}
