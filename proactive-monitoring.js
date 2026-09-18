const form = document.querySelector("#proactiveForm");
const sampleButton = document.querySelector("#proactiveSampleButton");
const resetButton = document.querySelector("#proactiveResetButton");
const copyButton = document.querySelector("#proactiveCopyButton");
const message = document.querySelector("#proactiveMessage");
const reportPanel = document.querySelector("#proactiveReport");
const emptyReport = document.querySelector("#proactiveEmpty");
const reportContent = document.querySelector("#proactiveContent");
let latestSummary = "";
let latestResult = null;
let latestInput = null;
let currentCaseId = "";
let currentGeneratedAt = "";

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const value = (id) => document.querySelector(`#${id}`)?.value.trim() || "";
const checked = (id) => Boolean(document.querySelector(`#${id}`)?.checked);

const formatNumber = (number) => Number(number || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
const formatAmount = (number, currency) => Number(number || 0) > 0 ? `${currency} ${formatNumber(number)}` : "not provided";

function createCaseId() {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const suffix = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 6).toUpperCase()
    : Math.random().toString(36).slice(2, 8).toUpperCase();
  return `TG-${stamp}-${suffix}`;
}

function generatedAtUtc() {
  return new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
}

function flagDetail(flag, input) {
  const details = {
    "Transaction velocity shift": `Observed ${formatNumber(input.observedTransactions)} transactions versus ${formatNumber(input.expectedTransactions)} expected for the selected baseline.`,
    "Value-pattern shift": `Observed value is ${formatAmount(input.observedValue, input.monitoringCurrency)} versus ${formatAmount(input.expectedValue, input.monitoringCurrency)} expected.`,
    "New counterparty pattern": input.counterpartyDetail || "Counterparty identity, jurisdiction and first-seen date require confirmation.",
    "Rapid in-and-out flow": input.transactionDetail || "Timing, amounts and destination of the flow were not provided; verify the transaction sequence.",
    "Route or corridor change": input.corridorDetail || "Origin, destination and the change from the normal corridor require confirmation.",
    "Channel or product change": input.transactionDetail || "The changed channel or product and its rationale require supporting evidence."
  };
  return `${flag.detail} ${details[flag.title] || "Supporting transaction evidence is required."}`;
}

function typologyHypothesis(result, input) {
  const titles = result.flags.map((flag) => flag.title);
  if (!result.flags.length) {
    return "No typology hypothesis is generated because no configured pattern was triggered. This is not a finding of low risk.";
  }
  if (titles.includes("Rapid in-and-out flow") && titles.includes("New counterparty pattern")) {
    return "The combination could be consistent with possible short-cycle layering or pass-through activity. It does not confirm TBML, money laundering or other wrongdoing.";
  }
  if (titles.includes("Route or corridor change") && titles.includes("Value-pattern shift")) {
    return "The combination could indicate a change in the economic or geographic rationale of activity and merits focused source-of-funds and commercial review. It is a hypothesis, not a conclusion.";
  }
  return `The combination of ${titles.join(", ")} may indicate activity outside the observed customer baseline. Review the underlying evidence before drawing any conclusion.`;
}

function nextSteps(result) {
  if (!result.flags.length) {
    return [
      "Continue normal monitoring and refresh the customer baseline when reliable new information becomes available.",
      "Document why no configured signal was triggered and retain the supporting data used for the review."
    ];
  }
  return [
    "Compare the KYC/customer profile with the observed counterparty, value and corridor activity.",
    "Cross-check the flagged counterparties against sanctions, PEP and adverse-media screening, refreshing screening where necessary.",
    "Request supporting transaction and, where relevant, trade documents for the flagged activity.",
    "Compare observed volume and value against a reliable customer baseline and relevant market references.",
    "Retain the transaction extract, screening outcomes and this report in the case file."
  ];
}

function buildSummary(result, input) {
  const disposition = document.querySelector("#proactiveDisposition")?.value || "Pending human review";
  const rationale = document.querySelector("#proactiveDispositionRationale")?.value.trim();
  const steps = nextSteps(result);
  return [
    "TradeGuard Proactive Monitoring Report",
    `Case ID: ${currentCaseId}`,
    `Generated: ${currentGeneratedAt}`,
    `Reviewer assigned: Authorised reviewer`,
    `Customer / account: ${input.customerReference}`,
    `Profile: ${input.customerSegment}${input.sectorBusinessType ? ` | Sector / business type: ${input.sectorBusinessType}` : ""}`,
    `Monitoring window: ${input.monitoringWindow}`,
    `Baseline window: ${input.baselineWindow}`,
    `Signal: ${result.score}/100 (${result.flags.length ? `${result.band} priority` : "No signal"})`,
    "Score basis: Sum of configured weighted pattern contributions, capped at 100; thresholds require institutional calibration.",
    "Status: Human review required",
    "Detected patterns:",
    result.flags.length ? result.flags.map((flag) => `- ${flag.title} (+${flag.points}): ${flagDetail(flag, input)}`).join("\n") : "- No configured pattern was triggered",
    `Typology hypothesis: ${typologyHypothesis(result, input)}`,
    "Suggested next steps:",
    steps.map((step, index) => `${index + 1}. ${step}`).join("\n"),
    `Reviewer disposition: ${disposition}`,
    rationale ? `Reviewer rationale: ${rationale}` : "Reviewer rationale: Not recorded"
  ].join("\n");
}

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
    sectorBusinessType: value("sectorBusinessType"),
    baselineWindow: value("baselineWindow"),
    monitoringCurrency: value("monitoringCurrency") || "USD",
    transactionDetail: value("transactionDetail"),
    counterpartyDetail: value("counterpartyDetail"),
    corridorDetail: value("corridorDetail"),
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
  if (!currentCaseId) currentCaseId = createCaseId();
  if (!currentGeneratedAt) currentGeneratedAt = generatedAtUtc();
  reportPanel.classList.remove("is-empty");
  emptyReport.hidden = true;
  reportContent.hidden = false;

  document.querySelector("#proactiveScore").textContent = result.score;
  document.querySelector("#proactiveBand").textContent = result.flags.length ? `${result.band.toUpperCase()} PRIORITY` : "NO SIGNAL";
  document.querySelector("#proactiveBand").className = `status-pill ${result.flags.length ? `status-${result.band.toLowerCase()}` : "status-no-signal"}`;
  document.querySelector("#proactiveGauge").parentElement.style.background = `conic-gradient(#1967d2 ${result.score * 3.6}deg, #dcecf6 0deg)`;
  document.querySelector("#proactiveRawScore").textContent = result.score;
  document.querySelector("#proactiveFlagCount").textContent = `${result.flags.length} ${result.flags.length === 1 ? "flag" : "flags"}`;
  document.querySelector("#proactiveStatusTitle").textContent = "Human review required";
  document.querySelector("#proactiveStatusText").textContent = result.flags.length
    ? "This is an early-warning prioritisation signal, not a final finding. Review evidence before escalation."
    : "No configured pattern signal was triggered. This is not a finding of low risk.";
  const summaryText = result.flags.length
    ? "The observed activity contains patterns requiring focused review."
    : "No selected pattern exceeded the configured conditions.";
  document.querySelector("#proactiveSummary").innerHTML = `<strong>${escapeHtml(input.customerReference)}</strong> — ${escapeHtml(input.customerSegment)} profile, ${escapeHtml(input.monitoringWindow)}. ${summaryText}`;

  document.querySelector("#proactiveCaseId").textContent = currentCaseId;
  document.querySelector("#proactiveGeneratedAt").textContent = currentGeneratedAt;
  document.querySelector("#proactiveReviewContext").innerHTML = [
    ["Customer / account", input.customerReference],
    ["Profile", input.customerSegment],
    ["Sector / business type", input.sectorBusinessType || "Not provided"],
    ["Monitoring window", input.monitoringWindow],
    ["Baseline window", input.baselineWindow || "Not provided"],
    ["Expected / observed transactions", `${formatNumber(input.expectedTransactions)} / ${formatNumber(input.observedTransactions)}`],
    ["Expected / observed value", `${formatAmount(input.expectedValue, input.monitoringCurrency)} / ${formatAmount(input.observedValue, input.monitoringCurrency)}`],
    ["Counterparty detail", input.counterpartyDetail || "Not provided"],
    ["Route / corridor detail", input.corridorDetail || "Not provided"],
    ["Transaction / evidence detail", input.transactionDetail || "Not provided"]
  ].map(([label, text]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(text)}</strong></div>`).join("");
  document.querySelector("#proactiveTypologyHypothesis").textContent = typologyHypothesis(result, input);
  document.querySelector("#proactiveScoreBasis").textContent = "Sum of configured weighted pattern contributions, capped at 100. Thresholds and weights require institutional calibration before operational use.";

  document.querySelector("#proactiveFlags").innerHTML = result.flags.length
    ? result.flags.map((flag) => `<article class="flag-item"><span class="flag-marker"></span><div><strong>${escapeHtml(flag.title)}</strong><p>${escapeHtml(flagDetail(flag, input))}</p></div><span class="flag-points">+${flag.points}</span></article>`).join("")
    : `<div class="flag-item"><span class="flag-marker" style="background:#14866b;box-shadow:0 0 0 4px rgba(20,134,107,.13)"></span><div><strong>No configured pattern was triggered</strong><p>Add reliable transaction history and supporting context for a more specific review signal.</p></div><span class="flag-points" style="color:#14866b">—</span></div>`;

  document.querySelector("#proactiveNextSteps").innerHTML = nextSteps(result).map((step) => `<li>${escapeHtml(step)}</li>`).join("");
  latestResult = result;
  latestInput = input;
  latestSummary = buildSummary(result, input);
  if (copyButton) copyButton.disabled = false;
}

resetButton?.addEventListener("click", () => {
  form?.reset();
  reportPanel?.classList.add("is-empty");
  if (emptyReport) emptyReport.hidden = false;
  if (reportContent) reportContent.hidden = true;
  if (message) message.textContent = "New case started. Previous monitoring inputs were cleared.";
  latestSummary = "";
  latestResult = null;
  latestInput = null;
  currentCaseId = "";
  currentGeneratedAt = "";
  if (copyButton) {
    copyButton.disabled = true;
    copyButton.textContent = "Copy summary";
  }
});

sampleButton?.addEventListener("click", () => {
  setValues({
    customerReference: "Anonymised customer 001",
    monitoringWindow: "Last 30 days",
    customerSegment: "SME",
    sectorBusinessType: "General trading / textiles",
    baselineWindow: "Trailing 90-day average",
    monitoringCurrency: "USD",
    expectedTransactions: "20",
    observedTransactions: "48",
    expectedValue: "100000",
    observedValue: "280000",
    transactionDetail: "Observed 48 transactions / USD 280,000; review timestamps and payment references for short-cycle flows.",
    counterpartyDetail: "Three newly observed counterparties; verify names, jurisdictions and first-seen dates during review.",
    corridorDetail: "Bangladesh → United Arab Emirates; differs from the usual customer corridor."
  });
  ["newCounterparties", "rapidInOut", "routeChange", "channelChange"].forEach((id) => {
    const element = document.querySelector(`#${id}`);
    if (element) element.checked = id !== "channelChange";
  });
  message.textContent = "Sample case context loaded. Press Run Proactive Review.";
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

copyButton?.addEventListener("click", async () => {
  if (!latestSummary) return;
  try {
    await navigator.clipboard.writeText(latestSummary);
    copyButton.textContent = "Copied ✓";
    window.setTimeout(() => { copyButton.textContent = "Copy summary"; }, 1800);
  } catch {
    copyButton.textContent = "Select report manually";
  }
});

document.querySelector("#proactiveDisposition")?.addEventListener("change", () => {
  if (latestResult && latestInput) latestSummary = buildSummary(latestResult, latestInput);
});
document.querySelector("#proactiveDispositionRationale")?.addEventListener("input", () => {
  if (latestResult && latestInput) latestSummary = buildSummary(latestResult, latestInput);
});

document.querySelector("#year").textContent = new Date().getFullYear();
