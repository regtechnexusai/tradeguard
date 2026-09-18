const form = document.querySelector("#proactiveForm");
const sampleButton = document.querySelector("#proactiveSampleButton");
const message = document.querySelector("#proactiveMessage");
const reportPanel = document.querySelector("#proactiveReport");
const emptyReport = document.querySelector("#proactiveEmpty");
const reportContent = document.querySelector("#proactiveContent");

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const value = (id) => document.querySelector(`#${id}`)?.value.trim() || "";
const checked = (id) => Boolean(document.querySelector(`#${id}`)?.checked);

function setValues(values) {
  Object.entries(values).forEach(([id, item]) => {
    const element = document.querySelector(`#${id}`);
    if (element) element.value = item;
  });
}

function collectInput() {
  return {
    customerReference: value("customerReference"),
    monitoringWindow: value("monitoringWindow"),
    customerSegment: value("customerSegment"),
    expectedTransactions: Number(value("expectedTransactions")),
    observedTransactions: Number(value("observedTransactions")),
    expectedValue: Number(value("expectedValue")),
    observedValue: Number(value("observedValue")),
    newCounterparties: checked("newCounterparties"),
    rapidInOut: checked("rapidInOut"),
    routeChange: checked("routeChange"),
    channelChange: checked("channelChange")
  };
}

function calculateSignal(input) {
  const flags = [];
  const hasExpectedTransactions = input.expectedTransactions > 0;
  const hasExpectedValue = input.expectedValue > 0;

  if (hasExpectedTransactions && input.observedTransactions >= input.expectedTransactions * 2) {
    flags.push({ title: "Transaction velocity shift", detail: "Observed transaction frequency is at least twice the expected monthly baseline.", points: 20, action: "Compare the activity with the customer profile, stated purpose and supporting records." });
  }

  if (hasExpectedValue && input.observedValue >= input.expectedValue * 2) {
    flags.push({ title: "Value-pattern shift", detail: "Observed transaction value is at least twice the expected monthly baseline.", points: 20, action: "Validate the economic rationale, source of funds and supporting transaction evidence." });
  }

  if (input.newCounterparties) flags.push({ title: "New counterparty pattern", detail: "The current activity includes previously unseen counterparties.", points: 15, action: "Identify the parties, beneficial owners, purpose and expected relationship." });
  if (input.rapidInOut) flags.push({ title: "Rapid in-and-out flow", detail: "Funds may be moving shortly after receipt or crediting.", points: 20, action: "Review the funds-flow sequence, purpose and supporting payment evidence." });
  if (input.routeChange) flags.push({ title: "Route or corridor change", detail: "The observed corridor differs from the normal customer pattern.", points: 10, action: "Confirm the commercial rationale, counterparties and jurisdictional context." });
  if (input.channelChange) flags.push({ title: "Channel or product change", detail: "A new channel or product is being used compared with the expected pattern.", points: 10, action: "Confirm customer intent, channel controls and the reason for the change." });

  const score = Math.min(flags.reduce((total, flag) => total + flag.points, 0), 100);
  const band = score >= 75 ? "Critical" : score >= 50 ? "High" : score >= 25 ? "Medium" : "Low";
  return { flags, score, band };
}

function render(result, input) {
  reportPanel.classList.remove("is-empty");
  emptyReport.hidden = true;
  reportContent.hidden = false;

  document.querySelector("#proactiveScore").textContent = result.score;
  document.querySelector("#proactiveBand").textContent = result.flags.length ? result.band.toUpperCase() : "NO SIGNAL";
  document.querySelector("#proactiveBand").className = `status-pill ${result.flags.length ? `status-${result.band.toLowerCase()}` : "status-no-signal"}`;
  document.querySelector("#proactiveGauge").parentElement.style.background = `conic-gradient(#1967d2 ${result.score * 3.6}deg, #dcecf6 0deg)`;
  document.querySelector("#proactiveRawScore").textContent = result.score;
  document.querySelector("#proactiveFlagCount").textContent = `${result.flags.length} ${result.flags.length === 1 ? "flag" : "flags"}`;
  document.querySelector("#proactiveStatusTitle").textContent = result.flags.length ? "Human review required" : "No configured signal";
  document.querySelector("#proactiveStatusText").textContent = result.flags.length
    ? "This is an early-warning prioritisation signal, not a final finding. Review evidence before escalation."
    : "No configured pattern signal was triggered. This is not a finding of low risk.";
  document.querySelector("#proactiveSummary").innerHTML = `<strong>${escapeHtml(input.customerReference)}</strong> — ${escapeHtml(input.customerSegment)} profile, ${escapeHtml(input.monitoringWindow)}. ${result.flags.length ? "The observed activity contains patterns requiring focused review." : "No selected pattern exceeded the configured demo conditions."}`;
  document.querySelector("#proactiveRecommendation").textContent = result.flags.length
    ? "Reconcile the observed activity with the customer profile and retain the supporting evidence for authorised review."
    : "Continue normal monitoring and refresh the customer baseline when reliable new information becomes available.";

  document.querySelector("#proactiveFlags").innerHTML = result.flags.length
    ? result.flags.map((flag) => `<article class="flag-item"><span class="flag-marker"></span><div><strong>${escapeHtml(flag.title)}</strong><p>${escapeHtml(flag.detail)}</p></div><span class="flag-points">+${flag.points}</span></article>`).join("")
    : `<div class="flag-item"><span class="flag-marker" style="background:#14866b;box-shadow:0 0 0 4px rgba(20,134,107,.13)"></span><div><strong>No configured pattern was triggered</strong><p>Add reliable transaction history and supporting context for a more specific review signal.</p></div><span class="flag-points" style="color:#14866b">—</span></div>`;
}

sampleButton?.addEventListener("click", () => {
  setValues({
    customerReference: "Anonymised customer 001",
    monitoringWindow: "Last 30 days",
    customerSegment: "SME",
    expectedTransactions: "20",
    observedTransactions: "48",
    expectedValue: "100000",
    observedValue: "280000"
  });
  ["newCounterparties", "rapidInOut", "routeChange", "channelChange"].forEach((id) => {
    const element = document.querySelector(`#${id}`);
    if (element) element.checked = id !== "channelChange";
  });
  message.textContent = "Sample monitoring context loaded. Press Run Proactive Review.";
});

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  const input = collectInput();
  if (!input.customerReference) {
    message.textContent = "Enter an anonymised customer or account reference before running the review.";
    document.querySelector("#customerReference")?.focus();
    return;
  }
  message.textContent = "";
  render(calculateSignal(input), input);
  reportPanel.scrollIntoView({ behavior: "smooth", block: "start" });
});

document.querySelector("#year").textContent = new Date().getFullYear();
