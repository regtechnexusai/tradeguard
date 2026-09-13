import { bandClass } from "./rules.js";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
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

  summary.innerHTML = `<strong>${escapeHtml(input.productName)}</strong> — ${escapeHtml(input.originCountry)} to ${escapeHtml(input.destinationCountry)}. ${priceText} This is a prioritisation signal, not a final TBML determination.`;

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

  recommendation.textContent = result.recommendation;

  return [
    "TradeGuard by RegTech Nexus AI",
    `Product: ${input.productName}`,
    `Route: ${input.originCountry} → ${input.destinationCountry}`,
    `Risk score: ${result.score}/100 (${result.band})`,
    `Detected flags: ${result.flags.length}`,
    ...result.flags.map((flag) => `- ${flag.title}: ${flag.detail}`),
    `Suggested next step: ${result.recommendation}`,
    "Demo output only. Final decisions remain with the authorised reviewer."
  ].join("\n");
}

export function setSampleValues() {
  document.querySelector("#productName").value = "Cotton textile";
  document.querySelector("#quantity").value = "100000";
  document.querySelector("#invoicePrice").value = "50";
  document.querySelector("#marketLow").value = "10";
  document.querySelector("#marketHigh").value = "12";
  document.querySelector("#originCountry").value = "Bangladesh";
  document.querySelector("#destinationCountry").value = "United Arab Emirates";
  document.querySelector("#relatedParty").checked = true;
  document.querySelector("#thirdPartyPayment").checked = true;
  document.querySelector("#routeMismatch").checked = false;
  document.querySelector("#documentMismatch").checked = true;
  document.querySelector("#duplicateInvoice").checked = false;
}

export function collectInput() {
  return {
    productName: document.querySelector("#productName").value.trim(),
    quantity: document.querySelector("#quantity").value,
    invoicePrice: document.querySelector("#invoicePrice").value,
    marketLow: document.querySelector("#marketLow").value,
    marketHigh: document.querySelector("#marketHigh").value,
    originCountry: document.querySelector("#originCountry").value,
    destinationCountry: document.querySelector("#destinationCountry").value,
    relatedParty: document.querySelector("#relatedParty").checked,
    thirdPartyPayment: document.querySelector("#thirdPartyPayment").checked,
    routeMismatch: document.querySelector("#routeMismatch").checked,
    documentMismatch: document.querySelector("#documentMismatch").checked,
    duplicateInvoice: document.querySelector("#duplicateInvoice").checked
  };
}

export function validateInput(input) {
  if (!input.productName) return "Please enter a product or commodity.";
  if (Number(input.quantity) <= 0) return "Please enter a valid quantity.";
  if (Number(input.invoicePrice) <= 0) return "Please enter a valid declared unit price.";
  if (Number(input.marketLow) <= 0 || Number(input.marketHigh) <= 0) return "Please enter a valid market price range.";
  if (Number(input.marketHigh) < Number(input.marketLow)) return "Market upper range must be greater than the lower range.";
  return "";
}
