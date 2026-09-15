import { bandClass } from "./rules.js";

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
  ["Product / commodity", "productName"],
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
];

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

  const hsText = input.hsCode
    ? ` HS Code provided: ${escapeHtml(input.hsCode)}.`
    : " HS Code was not provided.";

  summary.innerHTML = `<strong>${escapeHtml(input.productName)}</strong> — ${escapeHtml(input.originCountry)} to ${escapeHtml(input.destinationCountry)}. ${priceText}${hsText} This is a prioritisation signal, not a final TBML determination.`;

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
    input.portDischarge && `Discharge port: ${input.portDischarge}`
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
    `Detected flags: ${result.flags.length}`,
    ...result.flags.map((flag) => `- ${flag.title}: ${flag.detail}`),
    `Suggested next step: ${result.recommendation}`,
    "Assessment is indicative and depends on the quality, completeness and genuineness of the information provided.",
    "Demo output only. Final decisions remain with the authorised reviewer."
  ].join("\n");
}

export function setSampleValues() {
  const values = {
    productName: "Cotton textile",
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

  return {
    productName: value("productName"),
    hsCode: value("hsCode"),
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
    relatedParty: checked("relatedParty") || ["Possible relationship", "Confirmed relationship"].includes(relatedPartyRelationship),
    thirdPartyPayment: checked("thirdPartyPayment") || payerRelationship === "Third party",
    routeMismatch: checked("routeMismatch"),
    documentMismatch: checked("documentMismatch") || documentStatuses.includes("Needs review"),
    duplicateInvoice: checked("duplicateInvoice")
  };
}

export function validateInput(input) {
  if (!input.productName) return "Please enter a product or commodity.";
  if (!input.originCountry || !input.destinationCountry) return "Please select the origin and destination countries.";
  if (input.hsCode && !/^\d{8}$/.test(input.hsCode)) return "HS Code must contain exactly 8 digits or be left blank.";
  if (Number(input.quantity) <= 0) return "Please enter a valid quantity.";
  if (Number(input.invoicePrice) <= 0) return "Please enter a valid declared unit price.";
  if (Number(input.marketLow) <= 0 || Number(input.marketHigh) <= 0) return "Please enter a valid market price range.";
  if (Number(input.marketHigh) < Number(input.marketLow)) return "Market upper range must be greater than the lower range.";
  return "";
}
