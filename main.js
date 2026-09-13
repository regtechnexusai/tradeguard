import { calculateRisk } from "./rules.js";
import { collectInput, renderReport, setSampleValues, validateInput } from "./report.js";

const riskForm = document.querySelector("#riskForm");
const sampleButton = document.querySelector("#sampleButton");
const formMessage = document.querySelector("#formMessage");
const copyReportButton = document.querySelector("#copyReportButton");
const pilotForm = document.querySelector("#pilotForm");
const pilotMessage = document.querySelector("#pilotMessage");
let latestReport = "";

riskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const input = collectInput();
  const validationMessage = validateInput(input);

  if (validationMessage) {
    formMessage.textContent = validationMessage;
    return;
  }

  formMessage.textContent = "";
  const result = calculateRisk(input);
  latestReport = renderReport(result, input);
  copyReportButton.disabled = false;
  document.querySelector("#reportPanel").scrollIntoView({ behavior: "smooth", block: "start" });
});

sampleButton.addEventListener("click", () => {
  setSampleValues();
  formMessage.textContent = "Sample case loaded. Press Analyse sample transaction.";
});

copyReportButton.addEventListener("click", async () => {
  if (!latestReport) return;
  try {
    await navigator.clipboard.writeText(latestReport);
    copyReportButton.textContent = "Copied ✓";
    window.setTimeout(() => { copyReportButton.textContent = "Copy summary"; }, 1800);
  } catch {
    copyReportButton.textContent = "Select report manually";
  }
});

pilotForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = document.querySelector("#pilotName").value.trim();
  const organisation = document.querySelector("#pilotOrganisation").value.trim();
  const type = document.querySelector("#pilotType").value;
  const message = [
    "TradeGuard pilot request",
    `Name: ${name}`,
    `Organisation: ${organisation}`,
    `Organisation type: ${type}`,
    "I would like to discuss a TradeGuard trade-finance/TBML review pilot."
  ].join("\n");

  try {
    await navigator.clipboard.writeText(message);
    pilotMessage.textContent = "Pilot request copied. Paste it into your LinkedIn, Facebook or email message.";
  } catch {
    pilotMessage.textContent = message;
  }
});

document.querySelector("#year").textContent = new Date().getFullYear();
