const form = document.querySelector("#proactiveForm");
const sampleButton = document.querySelector("#proactiveSampleButton");
const resetButton = document.querySelector("#proactiveResetButton");
const transactionPdfInput = document.querySelector("#transactionPdfInput");
const analyzePdfButton = document.querySelector("#analyzePdfButton");
const clearPdfButton = document.querySelector("#clearPdfButton");
const transactionPdfStatus = document.querySelector("#transactionPdfStatus");
const copyButton = document.querySelector("#proactiveCopyButton");
const revealAccountButton = document.querySelector("#proactiveRevealAccount");
const accountValue = document.querySelector("#proactiveAccountValue");
const accountNote = document.querySelector("#proactiveAccountNote");
const evidenceGapSummary = document.querySelector("#proactiveEvidenceGap");
const ratioCallout = document.querySelector("#proactiveRatioCallout");
const dispositionSelect = document.querySelector("#proactiveDisposition");
const dispositionRationale = document.querySelector("#proactiveDispositionRationale");
const dispositionStatus = document.querySelector("#proactiveDispositionStatus");
const confirmDispositionButton = document.querySelector("#proactiveConfirmDisposition");
const message = document.querySelector("#proactiveMessage");
const reportPanel = document.querySelector("#proactiveReport");
const emptyReport = document.querySelector("#proactiveEmpty");
const reportContent = document.querySelector("#proactiveContent");
let latestSummary = "";
let latestResult = null;
let latestInput = null;
let currentCaseId = "";
let currentGeneratedAt = "";
let accountRevealed = false;
let dispositionConfirmed = false;
let selectedPdfFile = null;

const MAX_PDF_BYTES = 10 * 1024 * 1024;

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const value = (id) => document.querySelector(`#${id}`)?.value.trim() || "";
const checked = (id) => Boolean(document.querySelector(`#${id}`)?.checked);

function setPdfStatus(text, state = "") {
  if (!transactionPdfStatus) return;
  transactionPdfStatus.textContent = text;
  transactionPdfStatus.className = `file-status${state ? ` ${state}` : ""}`;
}

function clearPdfAttachment(statusText = "No PDF selected.") {
  selectedPdfFile = null;
  if (transactionPdfInput) transactionPdfInput.value = "";
  if (analyzePdfButton) analyzePdfButton.disabled = true;
  if (clearPdfButton) clearPdfButton.disabled = true;
  setPdfStatus(statusText);
}

function formatFileSize(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function extractPdfText(file) {
  if (!window.pdfjsLib) {
    throw new Error("The PDF reader is unavailable. Check the connection and try again.");
  }

  window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  const buffer = await file.arrayBuffer();
  const loadingTask = window.pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;
  const pages = [];

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const grouped = new Map();
      content.items.forEach((item) => {
        const text = String(item.str || "").trim();
        if (!text) return;
        const y = Math.round(item.transform?.[5] || 0);
        const row = grouped.get(y) || [];
        row.push({ x: item.transform?.[4] || 0, text });
        grouped.set(y, row);
      });
      pages.push([...grouped.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([, row]) => row.sort((a, b) => a.x - b.x).map((item) => item.text).join(" "))
        .join("\n"));
      page.cleanup();
    }
  } finally {
    await pdf.destroy();
  }
  return pages.join("\n");
}

function extractPdfSignals(rawText) {
  const lines = String(rawText || "")
    .replaceAll("\u00a0", " ")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const transactionPattern = /credit|debit|deposit|withdraw|transfer|payment|remit|rtgs|beftn|swift|atm|cash|card|online|mobile|beneficiary|sender|\bcr\b|\bdr\b/i;
  const transactionLines = lines.filter((line) => transactionPattern.test(line) && /\d/.test(line));
  const amountPattern = /(?:BDT|৳|USD|EUR|GBP|INR)?\s*([0-9]{1,3}(?:,[0-9]{3})+(?:\.\d+)?|\d+(?:\.\d{2})?)/gi;
  const amountMatches = [];

  transactionLines.forEach((line) => {
    const matches = [...line.matchAll(amountPattern)]
      .map((match) => Number(String(match[1]).replaceAll(",", "")))
      .filter((number) => Number.isFinite(number) && number >= 100);
    if (matches.length) amountMatches.push(Math.max(...matches));
  });

  const fullText = lines.join(" ");
  const channels = ["atm", "cash", "card", "online", "mobile", "rtgs", "beftn", "swift"]
    .filter((channel) => new RegExp(`\\b${channel}\\b`, "i").test(fullText));
  const hasInbound = /credit|deposit|inward|remit|\bcr\b/i.test(fullText);
  const hasOutbound = /debit|withdraw|outward|payment|transfer|\bdr\b/i.test(fullText);
  const observedTransactions = transactionLines.length;
  const observedValue = amountMatches.reduce((total, number) => total + number, 0);

  return {
    observedTransactions,
    observedValue,
    transactionDetail: `PDF extraction found ${observedTransactions} transaction-like line${observedTransactions === 1 ? "" : "s"} and ${amountMatches.length} amount reference${amountMatches.length === 1 ? "" : "s"}. Extracted values require reviewer confirmation.`,
    rapidInOut: hasInbound && hasOutbound,
    channelChange: channels.length >= 2,
    extractedLineCount: lines.length,
    extractedAmountCount: amountMatches.length,
    channels
  };
}

async function analyzePdf() {
  if (!selectedPdfFile) return;
  const file = selectedPdfFile;
  if (analyzePdfButton) analyzePdfButton.disabled = true;
  setPdfStatus("Reading PDF locally…", "is-processing");

  try {
    let rawText = await extractPdfText(file);
    const extracted = extractPdfSignals(rawText);
    rawText = "";

    if (!value("customerReference")) setValues({ customerReference: "Anonymised PDF case" });
    setValues({
      ...(extracted.observedTransactions ? { observedTransactions: String(extracted.observedTransactions) } : {}),
      ...(extracted.observedValue ? { observedValue: String(Math.round(extracted.observedValue * 100) / 100) } : {}),
      transactionDetail: extracted.transactionDetail
    });

    if (extracted.rapidInOut) {
      const element = document.querySelector("#rapidInOut");
      if (element) element.checked = true;
    }
    if (extracted.channelChange) {
      const element = document.querySelector("#channelChange");
      if (element) element.checked = true;
    }

    message.textContent = "PDF analysed locally. Review the extracted fields, add the expected baseline and run Proactive Review.";
    setPdfStatus(`PDF analysed locally (${extracted.extractedLineCount} text lines). Temporary file data cleared; no PDF retained.`, "is-success");
  } catch (error) {
    setPdfStatus(error instanceof Error ? error.message : "The PDF could not be analysed.", "is-error");
    if (message) message.textContent = "The PDF could not be analysed. Review the file type and try again.";
  } finally {
    selectedPdfFile = null;
    if (transactionPdfInput) transactionPdfInput.value = "";
    if (analyzePdfButton) analyzePdfButton.disabled = true;
    if (clearPdfButton) clearPdfButton.disabled = true;
  }
}

const formatNumber = (number) => Number(number || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
const formatAmount = (number, currency) => Number(number || 0) > 0 ? `${currency} ${formatNumber(number)}` : "not provided";
const ratio = (observed, expected) => Number(expected) > 0 ? `${(Number(observed) / Number(expected)).toFixed(1)}×` : "not available";

function maskAccountReference(reference) {
  const text = String(reference || "").trim();
  if (!text) return "Not provided";
  const digits = text.replace(/\D/g, "");
  if (digits.length >= 4) return `•••• •••• ${digits.slice(-2)}`;
  if (/^\d+$/.test(text)) return `${"•".repeat(Math.max(1, text.length - 2))}${text.slice(-2)}`;
  return text;
}

function unverifiedPoints(result) {
  return result.flags.filter((flag) => flag.evidenceGap).reduce((total, flag) => total + flag.points, 0);
}

function updateAccountDisplay(reference = "") {
  if (!accountValue) return;
  accountValue.textContent = accountRevealed ? (reference || "Not provided") : maskAccountReference(reference);
  if (accountNote) accountNote.textContent = accountRevealed ? "Account reference revealed for this view" : "Masked by default";
  if (revealAccountButton) {
    revealAccountButton.textContent = accountRevealed ? "Mask" : "Reveal";
    revealAccountButton.setAttribute("aria-pressed", String(accountRevealed));
  }
}

function updateDispositionGate() {
  if (!dispositionStatus || !confirmDispositionButton) return;
  const selected = dispositionSelect?.value.trim() || "";
  const rationale = dispositionRationale?.value.trim() || "";
  const ready = Boolean(selected && rationale.length >= 10);
  dispositionStatus.textContent = ready ? "READY TO CONFIRM" : "RATIONALE REQUIRED";
  dispositionStatus.className = `disposition-status ${ready ? "is-ready" : "is-required"}`;
  confirmDispositionButton.disabled = !ready || dispositionConfirmed;
  if (dispositionConfirmed) {
    dispositionStatus.textContent = "DISPOSITION RECORDED";
    dispositionStatus.className = "disposition-status is-confirmed";
    confirmDispositionButton.textContent = "Disposition recorded";
  } else {
    confirmDispositionButton.textContent = "Confirm disposition";
  }
  if (latestResult && latestInput) latestSummary = buildSummary(latestResult, latestInput);
}

function resetDisposition() {
  dispositionConfirmed = false;
  if (dispositionSelect) dispositionSelect.value = "Pending human review";
  if (dispositionRationale) dispositionRationale.value = "";
  updateDispositionGate();
}

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
    "Value-pattern shift": `Observed value is ${formatAmount(input.observedValue, input.monitoringCurrency)} versus ${formatAmount(input.expectedValue, input.monitoringCurrency)} expected (${ratio(input.observedValue, input.expectedValue)} the selected baseline).`,
    "New counterparty pattern": input.counterpartyDetail || "Counterparty identity, jurisdiction and first-seen date require confirmation.",
    "Rapid in-and-out flow": input.flowEvidence || "Timing, amounts and destination of the flow were not provided; verify the transaction sequence.",
    "Route or corridor change": input.corridorDetail || "Origin, destination and the change from the normal corridor require confirmation.",
    "Channel or product change": input.channelDetail || "The changed channel or product and its rationale require supporting evidence."
  };
  return `${flag.detail} ${details[flag.title] || "Supporting transaction evidence is required."}`;
}

function typologyHypothesis(result, input) {
  const titles = result.flags.map((flag) => flag.title);
  const unsupported = unverifiedPoints(result);
  if (!result.flags.length) {
    return "No typology hypothesis is generated because no configured pattern was triggered. This is not a finding of low risk.";
  }
  const evidenceCaveat = unsupported
    ? ` ${formatNumber(unsupported)} of ${formatNumber(result.score)} points rest on unverified contributions; confirm the missing evidence before escalation.`
    : "";
  if (titles.includes("Rapid in-and-out flow") && titles.includes("New counterparty pattern")) {
    return `The combination could be consistent with possible short-cycle layering or pass-through activity.${evidenceCaveat} It does not confirm TBML, money laundering or other wrongdoing.`;
  }
  if (titles.includes("Route or corridor change") && titles.includes("Value-pattern shift")) {
    return `The combination could indicate a change in the economic or geographic rationale of activity and merits focused source-of-funds and commercial review.${evidenceCaveat} It is a hypothesis, not a conclusion.`;
  }
  return `The combination of ${titles.join(", ")} may indicate activity outside the observed customer baseline.${evidenceCaveat} Review the underlying evidence before drawing any conclusion.`;
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
    `Customer / account: ${maskAccountReference(input.customerReference)}`,
    `Profile: ${input.customerSegment}${input.profession ? ` | Profession: ${input.profession}` : ""}`,
    `Monitoring window: ${input.monitoringWindow}`,
    `Baseline window: ${input.baselineWindow}`,
    `Signal: ${result.score}/100 (${result.flags.length ? `${result.band} priority` : "No signal"})`,
    "Score basis: Sum of configured weighted pattern contributions, capped at 100; thresholds require institutional calibration.",
    `Evidence gaps: ${unverifiedPoints(result) ? `${unverifiedPoints(result)} of ${result.score} points are unverified` : "None identified in the selected patterns"}`,
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
    profession: value("profession"),
    baselineWindow: value("baselineWindow"),
    monitoringCurrency: value("monitoringCurrency") || "USD",
    transactionDetail: value("transactionDetail"),
    flowEvidence: value("flowEvidence"),
    channelDetail: value("channelDetail"),
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
    flags.push({ title: "Transaction velocity shift", detail: "Observed transaction frequency is at least twice the expected selected baseline.", points: 20, evidenceGap: false, action: "Compare the activity with the customer profile, stated purpose and supporting records." });
  }

  if (hasExpectedValue && input.observedValue >= input.expectedValue * 2) {
    flags.push({ title: "Value-pattern shift", detail: "Observed transaction value is at least twice the expected selected baseline.", points: 20, evidenceGap: false, action: "Validate the economic rationale, source of funds and supporting transaction evidence." });
  }

  if (input.newCounterparties) flags.push({ title: "New counterparty pattern", detail: "The current activity includes previously unseen counterparties.", points: 15, evidenceGap: !input.counterpartyDetail, action: "Identify the parties, beneficial owners, purpose and expected relationship." });
  if (input.rapidInOut) flags.push({ title: "Rapid in-and-out flow", detail: "Funds may be moving shortly after receipt or crediting.", points: 20, evidenceGap: !input.flowEvidence, action: "Review the funds-flow sequence, purpose and supporting payment evidence." });
  if (input.routeChange) flags.push({ title: "Route or corridor change", detail: "The observed corridor differs from the normal customer pattern.", points: 10, evidenceGap: !input.corridorDetail, action: "Confirm the commercial rationale, counterparties and jurisdictional context." });
  if (input.channelChange) flags.push({ title: "Channel or product change", detail: "A new channel or product is being used compared with the expected pattern.", points: 10, evidenceGap: !input.channelDetail, action: "Confirm customer intent, channel controls and the reason for the change." });

  const score = Math.min(flags.reduce((total, flag) => total + flag.points, 0), 100);
  const band = score >= 75 ? "Critical" : score >= 50 ? "High" : score >= 25 ? "Medium" : "Low";
  return { flags, score, band };
}

function render(result, input) {
  if (!currentCaseId) currentCaseId = createCaseId();
  if (!currentGeneratedAt) currentGeneratedAt = generatedAtUtc();
  resetDisposition();
  accountRevealed = false;
  updateAccountDisplay(input.customerReference);
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
  document.querySelector("#proactiveSummary").innerHTML = `<strong>${escapeHtml(maskAccountReference(input.customerReference))}</strong> — ${escapeHtml(input.customerSegment)} profile, ${escapeHtml(input.monitoringWindow)}. ${summaryText}`;

  const unsupported = unverifiedPoints(result);
  if (evidenceGapSummary) {
    evidenceGapSummary.hidden = !unsupported;
    evidenceGapSummary.textContent = unsupported
      ? `${formatNumber(unsupported)} of ${formatNumber(result.score)} points are unverified`
      : "Evidence supported for selected patterns";
  }
  const valueFlag = result.flags.find((flag) => flag.title === "Value-pattern shift");
  if (ratioCallout) {
    ratioCallout.hidden = !valueFlag || !(input.expectedValue > 0);
    ratioCallout.textContent = valueFlag ? `${ratio(input.observedValue, input.expectedValue)} value baseline ratio` : "";
  }

  document.querySelector("#proactiveCaseId").textContent = currentCaseId;
  document.querySelector("#proactiveGeneratedAt").textContent = currentGeneratedAt;
  document.querySelector("#proactiveReviewContext").innerHTML = [
    ["Customer / account", maskAccountReference(input.customerReference)],
    ["Profile", input.customerSegment],
    ["Profession", input.profession || "Not provided"],
    ["Monitoring window", input.monitoringWindow],
    ["Baseline window", input.baselineWindow || "Not provided"],
    ["Expected / observed transactions", `${formatNumber(input.expectedTransactions)} / ${formatNumber(input.observedTransactions)}`],
    ["Expected / observed value", `${formatAmount(input.expectedValue, input.monitoringCurrency)} / ${formatAmount(input.observedValue, input.monitoringCurrency)}`],
    ["Counterparty detail", input.counterpartyDetail || "Not provided"],
    ["Route / corridor detail", input.corridorDetail || "Not provided"],
    ["Transaction / evidence detail", input.transactionDetail || "Not provided"],
    ["Inbound → outbound flow evidence", input.flowEvidence || "Not provided"],
    ["Changed channel / product", input.channelDetail || "Not provided"]
  ].map(([label, text]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(text)}</strong></div>`).join("");
  document.querySelector("#proactiveTypologyHypothesis").textContent = typologyHypothesis(result, input);
  document.querySelector("#proactiveScoreBasis").textContent = `Sum of configured weighted pattern contributions, capped at 100. ${unsupported ? `${formatNumber(unsupported)} of ${formatNumber(result.score)} points are currently unverified. ` : ""}Thresholds and weights require institutional calibration before operational use.`;

  document.querySelector("#proactiveFlags").innerHTML = result.flags.length
    ? result.flags.map((flag) => `<article class="flag-item${flag.evidenceGap ? " evidence-gap" : ""}"><span class="flag-marker"></span><div><strong>${escapeHtml(flag.title)}</strong>${flag.evidenceGap ? "<span class=\"evidence-warning\">SCORED WITHOUT SUPPORTING DATA</span>" : ""}<p>${escapeHtml(flagDetail(flag, input))}</p></div><span class="flag-points">+${flag.points}</span></article>`).join("")
    : `<div class="flag-item"><span class="flag-marker" style="background:#14866b;box-shadow:0 0 0 4px rgba(20,134,107,.13)"></span><div><strong>No configured pattern was triggered</strong><p>Add reliable transaction history and supporting context for a more specific review signal.</p></div><span class="flag-points" style="color:#14866b">—</span></div>`;

  document.querySelector("#proactiveNextSteps").innerHTML = nextSteps(result).map((step) => `<li>${escapeHtml(step)}</li>`).join("");
  latestResult = result;
  latestInput = input;
  latestSummary = buildSummary(result, input);
  if (copyButton) copyButton.disabled = false;
}

transactionPdfInput?.addEventListener("change", () => {
  const file = transactionPdfInput.files?.[0];
  if (!file) {
    clearPdfAttachment();
    return;
  }

  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) {
    clearPdfAttachment("Only PDF files are allowed.");
    return;
  }
  if (file.size > MAX_PDF_BYTES) {
    clearPdfAttachment(`This PDF is ${formatFileSize(file.size)}. The maximum allowed size is 10 MB.`);
    return;
  }

  selectedPdfFile = file;
  if (analyzePdfButton) analyzePdfButton.disabled = false;
  if (clearPdfButton) clearPdfButton.disabled = false;
  setPdfStatus(`${file.name} selected · ${formatFileSize(file.size)} · temporary browser-local processing only.`);
});

analyzePdfButton?.addEventListener("click", analyzePdf);
clearPdfButton?.addEventListener("click", () => clearPdfAttachment("PDF cleared and deleted from this browser session."));

resetButton?.addEventListener("click", () => {
  form?.reset();
  clearPdfAttachment();
  reportPanel?.classList.add("is-empty");
  if (emptyReport) emptyReport.hidden = false;
  if (reportContent) reportContent.hidden = true;
  if (message) message.textContent = "New case started. Previous monitoring inputs were cleared.";
  latestSummary = "";
  latestResult = null;
  latestInput = null;
  currentCaseId = "";
  currentGeneratedAt = "";
  accountRevealed = false;
  updateAccountDisplay("");
  if (evidenceGapSummary) evidenceGapSummary.hidden = true;
  resetDisposition();
  if (copyButton) {
    copyButton.disabled = true;
    copyButton.textContent = "Copy summary";
  }
});

sampleButton?.addEventListener("click", () => {
  setValues({
    customerReference: "1234567891",
    monitoringWindow: "Last 90 days",
    customerSegment: "Individual",
    profession: "Housewife",
    baselineWindow: "Trailing 90-day average",
    monitoringCurrency: "BDT",
    expectedTransactions: "20",
    observedTransactions: "20",
    expectedValue: "200000",
    observedValue: "7500000",
    transactionDetail: "Additional transaction detail was not provided.",
    flowEvidence: "",
    channelDetail: "",
    counterpartyDetail: "",
    corridorDetail: ""
  });
  ["newCounterparties", "rapidInOut", "routeChange", "channelChange"].forEach((id) => {
    const element = document.querySelector(`#${id}`);
    if (element) element.checked = ["rapidInOut", "channelChange"].includes(id);
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

revealAccountButton?.addEventListener("click", () => {
  if (!latestInput) return;
  accountRevealed = !accountRevealed;
  updateAccountDisplay(latestInput.customerReference);
});

const dispositionChanged = () => {
  dispositionConfirmed = false;
  updateDispositionGate();
};
dispositionSelect?.addEventListener("change", dispositionChanged);
dispositionRationale?.addEventListener("input", dispositionChanged);
confirmDispositionButton?.addEventListener("click", () => {
  if (confirmDispositionButton.disabled) return;
  dispositionConfirmed = true;
  updateDispositionGate();
});

document.querySelector("#year").textContent = new Date().getFullYear();
