import { GlobalWorkerOptions, getDocument } from "./pdf.mjs";

const form = document.querySelector("#proactiveForm");
const sampleButton = document.querySelector("#proactiveSampleButton");
const resetButton = document.querySelector("#proactiveResetButton");
const transactionPdfInput = document.querySelector("#transactionPdfInput");
const analyzePdfButton = document.querySelector("#analyzePdfButton");
const clearPdfButton = document.querySelector("#clearPdfButton");
const fullStatementModeButton = document.querySelector("#fullStatementModeButton");
const transactionOnlyModeButton = document.querySelector("#transactionOnlyModeButton");
const pdfModeNote = document.querySelector("#pdfModeNote");
const transactionPdfStatus = document.querySelector("#transactionPdfStatus");
const pdfPrivacyAcknowledge = document.querySelector("#pdfPrivacyAcknowledge");
const copyButton = document.querySelector("#proactiveCopyButton");
const printButton = document.querySelector("#proactivePrintButton");
const downloadButton = document.querySelector("#proactiveDownloadButton");
const revealAccountButton = document.querySelector("#proactiveRevealAccount");
const accountValue = document.querySelector("#proactiveAccountValue");
const accountNote = document.querySelector("#proactiveAccountNote");
const evidenceGapSummary = document.querySelector("#proactiveEvidenceGap");
const ratioCallout = document.querySelector("#proactiveRatioCallout");
const message = document.querySelector("#proactiveMessage");
const pilotForm = document.querySelector("#pilotForm");
const pilotMessage = document.querySelector("#pilotMessage");
const reportPanel = document.querySelector("#proactiveReport");
const emptyReport = document.querySelector("#proactiveEmpty");
const reportContent = document.querySelector("#proactiveContent");
const headerCaseId = document.querySelector("#proactiveHeaderCaseId");
const headerGeneratedAt = document.querySelector("#proactiveHeaderGeneratedAt");
let latestSummary = "";
const UTF8_BOM = "\uFEFF";
let latestResult = null;
let latestInput = null;
let currentCaseId = "";
let currentGeneratedAt = "";
let accountRevealed = false;
let selectedPdfFiles = [];
let pdfInputMode = "full-statement";
let pdfContextImported = false;

function preparePrintSnapshot(sourceContent, parent) {
  if (!sourceContent || !parent) return null;

  document.querySelector(".tradeguard-print-snapshot")?.remove();
  const snapshot = document.createElement("section");
  snapshot.className = `${sourceContent.closest(".report-panel")?.className || "panel report-panel"} tradeguard-print-snapshot`;
  snapshot.classList.remove("is-empty");
  snapshot.setAttribute("aria-label", "TradeGuard report print snapshot");

  const clone = sourceContent.cloneNode(true);
  clone.removeAttribute("hidden");
  snapshot.appendChild(clone);
  parent.appendChild(snapshot);
  return snapshot;
}

function printSnapshot(sourceContent, parent, modeClass) {
  const clone = sourceContent?.cloneNode(true);
  if (!clone) return;

  clone.removeAttribute("hidden");
  clone.querySelectorAll("img").forEach((image) => {
    const source = image.getAttribute("src");
    if (source) image.src = new URL(source, window.location.href).href;
  });

  const popup = window.open("", "_blank");
  if (!popup) {
    const snapshot = preparePrintSnapshot(sourceContent, parent);
    if (!snapshot) return;
    document.body.classList.add(modeClass);
    window.setTimeout(() => window.print(), 350);
    return;
  }

  const stylesheet = new URL("./style.css?v=39", window.location.href).href;
  const title = "TradeGuard Transaction Monitoring Report";
  popup.document.open();
  popup.document.write(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <link rel="stylesheet" href="${stylesheet}">
  <style>
    @page { size: Letter; margin: .35in; }
    html, body { margin: 0; padding: 0; background: #fff; }
    body { color: #17233a; font-family: Inter, Arial, sans-serif; }
    .print-window-main { width: min(100%, 1040px); margin: 0 auto; }
    .print-window-report { display: block !important; width: auto !important; max-width: none !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; border: 0 !important; border-radius: 0 !important; box-shadow: none !important; background: #fff !important; }
    .print-window-report .report-content { display: block !important; visibility: visible !important; padding: 0 !important; border: 0 !important; box-shadow: none !important; background: #fff !important; }
    .print-window-report .report-footer-note, .print-window-report .recommendation-box, .print-window-report .flag-item { break-inside: avoid; }
  </style>
</head>
<body>
  <main class="print-window-main">
    <section class="panel report-panel case-file-report print-window-report">${clone.outerHTML}</section>
  </main>
</body>
</html>`);
  popup.document.close();

  const startPrint = () => {
    popup.focus();
    window.setTimeout(() => popup.print(), 450);
  };
  if (popup.document.readyState === "complete") startPrint();
  else popup.addEventListener("load", startPrint, { once: true });
}

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_PDF_FILES = 5;
const MAX_TOTAL_PDF_BYTES = 40 * 1024 * 1024;

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

function setPdfMode(mode) {
  pdfInputMode = mode;
  pdfContextImported = false;
  const isTransactionOnly = mode === "transaction-only";
  fullStatementModeButton?.classList.toggle("is-active", !isTransactionOnly);
  transactionOnlyModeButton?.classList.toggle("is-active", isTransactionOnly);
  fullStatementModeButton?.setAttribute("aria-pressed", String(!isTransactionOnly));
  transactionOnlyModeButton?.setAttribute("aria-pressed", String(isTransactionOnly));
  if (pdfModeNote) {
    pdfModeNote.textContent = isTransactionOnly
      ? "Transaction-history-only mode: the PDF is used for transaction patterns and amounts. Enter an anonymised customer/account reference and any available profession, profile, baseline or evidence context below before running the review."
      : "Full-statement mode: available transaction context is used to pre-fill this local review. You can correct or replace any field before running the review.";
  }
  if (isTransactionOnly) {
    setValues({ customerReference: "", profession: "" });
  }
}

function clearPdfAttachment(statusText = "No PDF selected.") {
  selectedPdfFiles = [];
  if (transactionPdfInput) transactionPdfInput.value = "";
  if (analyzePdfButton) analyzePdfButton.disabled = true;
  if (clearPdfButton) clearPdfButton.disabled = true;
  setPdfStatus(statusText);
}

function refreshPdfControls() {
  const acknowledged = Boolean(pdfPrivacyAcknowledge?.checked);
  if (transactionPdfInput) transactionPdfInput.disabled = !acknowledged;
  if (analyzePdfButton) analyzePdfButton.disabled = !selectedPdfFiles.length || !acknowledged;
  if (clearPdfButton) clearPdfButton.disabled = !selectedPdfFiles.length;
}

function formatFileSize(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function extractPdfText(file) {
  GlobalWorkerOptions.workerSrc = "./pdf.worker.mjs";
  const buffer = await file.arrayBuffer();
  const loadingTask = getDocument({ data: new Uint8Array(buffer), isEvalSupported: false });
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

function extractPdfSignals(rawText, fileCount = 1) {
  const lines = String(rawText || "")
    .replaceAll("\u00a0", " ")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const transactionPattern = /credit|debit|deposit|withdraw|transfer|payment|remit|rtgs|beftn|swift|atm|cash|card|online|mobile|beneficiary|sender|\bcr\b|\bdr\b/i;
  const transactionIdPattern = /\b[A-Z]{2,8}-[A-Z0-9]+-\d{3,}\b/gi;
  const transactionIdLines = lines.filter((line) => /\b[A-Z]{2,8}-[A-Z0-9]+-\d{3,}\b/i.test(line));
  const transactionIds = [...new Set(lines.flatMap((line) => [...line.matchAll(transactionIdPattern)].map((match) => match[0].toUpperCase())))];
  const fallbackTransactionLines = lines.filter((line) => transactionPattern.test(line) && /\d/.test(line));
  const transactionLines = transactionIdLines.length >= 5 ? transactionIdLines : fallbackTransactionLines;
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
  const observedTransactions = transactionIds.length >= 5 ? transactionIds.length : transactionLines.length;
  const observedValue = amountMatches.reduce((total, number) => total + number, 0);

  return {
    observedTransactions,
    observedValue,
    transactionDetail: `${fileCount > 1 ? `${fileCount} PDF files` : "PDF extraction"} identified ${observedTransactions} transaction entr${observedTransactions === 1 ? "y" : "ies"} and ${amountMatches.length} amount reference${amountMatches.length === 1 ? "" : "s"}. Extracted values require reviewer confirmation.`,
    rapidInOut: hasInbound && hasOutbound,
    channelChange: channels.length >= 2,
    extractedLineCount: lines.length,
    extractedAmountCount: amountMatches.length,
    channels
  };
}

function detectPotentialIdentifiers(rawText) {
  const text = String(rawText || "");
  const findings = [];
  if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text)) findings.push("email address");
  if (/\b(account|a\/c|acct|iban|routing|sort code|account number|customer number|branch|phone|mobile|passport|national id|nid|date of birth)\b/i.test(text)) {
    findings.push("account or identity labels");
  }
  if (/(?:account|a\/c|acct|iban|routing|sort code|customer number)\D{0,32}\d[\d\s-]{5,}\b/i.test(text)) {
    findings.push("account-like number");
  }
  return [...new Set(findings)];
}

function applyPdfContext(extracted, rawText) {
  const professionOptions = [
    "Student", "Service holder", "Businessperson", "SME owner", "Housewife", "Foreign remitter",
    "Freelancer / self-employed", "Professional practitioner", "Farmer / agricultural worker", "Retired", "Other / not provided"
  ];
  const lowerText = String(rawText || "").toLowerCase();
  const detectedProfession = professionOptions.find((profession) => lowerText.includes(profession.toLowerCase()));
  const detectedCurrency = /\bBDT\b|৳/i.test(rawText) ? "BDT" : value("monitoringCurrency") || "Other / not provided";
  const detectedWindow = /365\s*[- ]?day|12\s*month/i.test(rawText)
    ? "Last 365 days"
    : /180\s*[- ]?day|6\s*month/i.test(rawText)
      ? "Last 180 days"
      : /90\s*[- ]?day|3\s*month/i.test(rawText)
        ? "Last 90 days"
        : value("monitoringWindow") || "Last 90 days";
  const detectedSegment = /\bindividual\b|savings account|housewife/i.test(rawText) ? "Individual" : value("customerSegment") || "Individual";
  const hasExpectedBaseline = Number(value("expectedTransactions")) > 0 || Number(value("expectedValue")) > 0;
  const transactionOnly = pdfInputMode === "transaction-only";

  setValues({
    customerReference: transactionOnly ? value("customerReference") : (value("customerReference") || "Anonymised PDF case"),
    monitoringWindow: transactionOnly ? value("monitoringWindow") : detectedWindow,
    customerSegment: transactionOnly ? value("customerSegment") : detectedSegment,
    profession: transactionOnly ? value("profession") : (value("profession") || detectedProfession || "Other / not provided"),
    baselineWindow: transactionOnly ? value("baselineWindow") : (hasExpectedBaseline ? (value("baselineWindow") || "Trailing 90-day average") : "Not provided - no customer baseline supplied"),
    monitoringCurrency: detectedCurrency,
    ...(extracted.observedTransactions ? { observedTransactions: String(extracted.observedTransactions) } : {}),
    ...(extracted.observedValue ? { observedValue: String(Math.round(extracted.observedValue * 100) / 100) } : {}),
    transactionDetail: extracted.transactionDetail
  });
}

async function analyzePdf() {
  if (!selectedPdfFiles.length) return;
  if (!pdfPrivacyAcknowledge?.checked) {
    setPdfStatus("Acknowledge the public-demo data warning before selecting a PDF.", "is-error");
    return;
  }
  if (analyzePdfButton) analyzePdfButton.disabled = true;
  setPdfStatus(`Reading ${selectedPdfFiles.length} PDF${selectedPdfFiles.length === 1 ? "" : "s"} locally…`, "is-processing");
  let analysisSucceeded = false;

  let rawText = "";
  try {
    const files = [...selectedPdfFiles];
    const textParts = [];
    for (let index = 0; index < files.length; index += 1) {
      setPdfStatus(`Reading PDF ${index + 1} of ${files.length} locally…`, "is-processing");
      textParts.push(await extractPdfText(files[index]));
    }
    rawText = textParts.join("\n");
    if (!rawText.trim()) {
      throw new Error("No selectable text was found. This may be a scanned or image-only PDF; OCR is not included in the public build.");
    }
    const potentialIdentifiers = detectPotentialIdentifiers(rawText);
    const extracted = extractPdfSignals(rawText, files.length);
    applyPdfContext(extracted, rawText);
    rawText = "";

    if (extracted.rapidInOut) {
      const element = document.querySelector("#rapidInOut");
      if (element) element.checked = true;
    }
    if (extracted.channelChange) {
      const element = document.querySelector("#channelChange");
      if (element) element.checked = true;
    }

    analysisSucceeded = true;
    pdfContextImported = true;
    const input = collectInput();
    if (pdfInputMode === "transaction-only") {
      message.textContent = "Transaction history extracted locally. Add or confirm the anonymised context below, then press Run Transaction Review.";
      const identifierNote = potentialIdentifiers.length
        ? ` Potential identifier-like text detected (${potentialIdentifiers.join(", ")}); use only fictional or anonymised data.`
        : "";
      setPdfStatus(`${files.length} transaction PDF${files.length === 1 ? "" : "s"} extracted locally (${extracted.observedTransactions || 0} transaction entries identified). The browser file references were cleared after analysis.${identifierNote}`, potentialIdentifiers.length ? "is-warning" : "is-success");
      document.querySelector("#customerReference")?.focus();
    } else {
      render(calculateSignal(input), input);
      message.textContent = "Full statement PDF analysed locally. No other fields are required for this preliminary review; correct any pre-filled context if needed.";
      const identifierNote = potentialIdentifiers.length
        ? ` Potential identifier-like text detected (${potentialIdentifiers.join(", ")}); use only fictional or anonymised data.`
        : "";
      setPdfStatus(`${files.length} PDF${files.length === 1 ? "" : "s"} analysed locally (${extracted.observedTransactions || 0} transaction entries identified). The browser file references were cleared after analysis.${identifierNote}`, potentialIdentifiers.length ? "is-warning" : "is-success");
      reportPanel?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  } catch (error) {
    setPdfStatus(error instanceof Error ? error.message : "The PDF could not be analysed.", "is-error");
    if (message) message.textContent = "The PDF could not be analysed. Review the file type and try again.";
  } finally {
    rawText = "";
    selectedPdfFiles = [];
    if (transactionPdfInput) transactionPdfInput.value = "";
    refreshPdfControls();
    pdfContextImported = analysisSucceeded;
  }
}

const formatNumber = (number) => Number(number || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
const formatAmount = (number, currency) => Number(number || 0) > 0 ? `${currency} ${formatNumber(number)}` : "not provided";
const ratio = (observed, expected) => Number(expected) > 0 ? `${(Number(observed) / Number(expected)).toFixed(1)}×` : "not available";

function maskAccountReference(reference) {
  const text = String(reference || "").trim();
  if (!text) return "Not provided";
  if (/^Anonymised (PDF|transaction-only)/i.test(text)) return "Anonymised case reference";
  const digits = text.replace(/\D/g, "");
  if (digits.length >= 4) return `•••• •••• ${digits.slice(-2)}`;
  if (/^\d+$/.test(text)) return `${"•".repeat(Math.max(1, text.length - 2))}${text.slice(-2)}`;
  return text;
}

function unverifiedPoints(result) {
  return result.flags.filter((flag) => flag.evidenceGap).reduce((total, flag) => total + flag.points, 0);
}

function evidenceSupportedPoints(result) {
  return Math.max(0, result.score - unverifiedPoints(result));
}

function signalPresentation(result) {
  const unsupported = unverifiedPoints(result);
  if (!result.flags.length) {
    return { label: "NO SIGNAL", className: "status-no-signal", summary: "No signal" };
  }
  if (unsupported > result.score * 0.5) {
    return { label: "PENDING EVIDENCE", className: "status-pending-evidence", summary: "Pending evidence" };
  }
  if (unsupported > 0) {
    return { label: `PROVISIONAL ${result.band.toUpperCase()}`, className: `status-${result.band.toLowerCase()} status-provisional`, summary: `Provisional ${result.band}` };
  }
  return { label: `${result.band.toUpperCase()} PRIORITY`, className: `status-${result.band.toLowerCase()}`, summary: `${result.band} priority` };
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
    "Verify the customer profile and compare observed volume and value with the approved baseline.",
    "Identify and screen any extracted counterparties; if none are available, obtain the counterparty details from the transaction record.",
    "Verify timing, amounts, destinations, channels and transaction purpose; obtain source-of-funds evidence where relevant.",
    "Where the activity relates to trade, request supporting trade documents; otherwise retain the relevant purpose and source-of-funds evidence.",
    "Retain the transaction extract, screening outcomes and this report in the case file."
  ];
}

function baselineNotes(input) {
  const notes = [];
  if (!(input.expectedTransactions > 0)) notes.push("Transaction velocity rule not evaluated: expected transaction baseline not provided.");
  if (!(input.expectedValue > 0)) notes.push("Value-pattern rule not evaluated: expected value baseline not provided.");
  return notes;
}

function buildSummary(result, input) {
  const steps = nextSteps(result);
  const notes = baselineNotes(input);
  const unsupported = unverifiedPoints(result);
  const supported = evidenceSupportedPoints(result);
  const presentation = signalPresentation(result);
  return [
    "TradeGuard Transaction Monitoring Report",
    `Case ID: ${currentCaseId}`,
    `Generated: ${currentGeneratedAt}`,
    `Customer / account: ${maskAccountReference(input.customerReference)}`,
    `Profile: ${input.customerSegment}${input.profession ? ` | Profession: ${input.profession}` : ""}`,
    `Evidence input: ${input.pdfMode}`,
    `Monitoring window: ${input.monitoringWindow}`,
    `Baseline window: ${input.baselineWindow}`,
    `Signal: ${result.score}/100 (${presentation.summary})`,
    `Configured signal score: ${result.score}/100`,
    `Evidence-supported score: ${supported}/100`,
    `Unverified contribution: ${unsupported} points`,
    "Score basis: Sum of configured weighted pattern contributions, capped at 100. Evidence-supported and unverified contributions are shown separately.",
    "Applied threshold bands: Low 0-24; Medium 25-49; High 50-74; Critical 75-100 (institution-configured). Evidence gate: more than 50% unverified keeps the signal pending evidence.",
    notes.length ? `Baseline notes: ${notes.join(" ")}` : "Baseline notes: Expected transaction and value baselines provided.",
    `Evidence gaps: ${unsupported ? `${unsupported} of ${result.score} points are unverified` : "None identified in the selected patterns"}`,
    "Status: Human review required",
    "Detected patterns:",
    result.flags.length ? result.flags.map((flag) => `- ${flag.title} (+${flag.points}) [Risk type: ${flag.riskType}]: ${flagDetail(flag, input)}`).join("\n") : "- No configured pattern was triggered",
    `Typology hypothesis: ${typologyHypothesis(result, input)}`,
    "Suggested next steps:",
    steps.map((step, index) => `${index + 1}. ${step}`).join("\n"),
    "Next step: Human review is required before any further action.",
    "The system identifies potential risk indicators for analyst review; the responsible officer makes the final assessment based on available evidence and applicable laws, regulations and institutional policy.",
    "Assessment output only. It is not a final TBML determination. Final transaction decisions remain with the authorised reviewer under applicable law, regulation and institutional policy."
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
    pdfMode: pdfContextImported ? (pdfInputMode === "transaction-only" ? "Transaction history-only PDF with manually supplied context" : "Full statement PDF with locally extracted context") : "Manual context only",
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

  const riskTypes = {
    "Transaction velocity shift": "Behavioural / velocity risk",
    "Value-pattern shift": "Behavioural / value risk",
    "New counterparty pattern": "Counterparty / network risk",
    "Rapid in-and-out flow": "Funds-flow / layering risk",
    "Route or corridor change": "Geographic / corridor risk",
    "Channel or product change": "Channel / product risk"
  };
  flags.forEach((flag) => {
    flag.riskType = riskTypes[flag.title] || "Transaction-monitoring risk";
  });

  const score = Math.min(flags.reduce((total, flag) => total + flag.points, 0), 100);
  const band = score >= 75 ? "Critical" : score >= 50 ? "High" : score >= 25 ? "Medium" : "Low";
  return { flags, score, band };
}

function render(result, input) {
  if (!currentCaseId) currentCaseId = createCaseId();
  if (!currentGeneratedAt) currentGeneratedAt = generatedAtUtc();
  accountRevealed = false;
  updateAccountDisplay(input.customerReference);
  reportPanel.classList.remove("is-empty");
  emptyReport.hidden = true;
  reportContent.hidden = false;

  document.querySelector("#proactiveScore").textContent = result.score;
  const presentation = signalPresentation(result);
  const unsupported = unverifiedPoints(result);
  const supported = evidenceSupportedPoints(result);
  document.querySelector("#proactiveBand").textContent = presentation.label;
  document.querySelector("#proactiveBand").className = `status-pill ${presentation.className}`;
  document.querySelector("#proactiveGauge").parentElement.style.background = `conic-gradient(#1967d2 ${result.score * 3.6}deg, #dcecf6 0deg)`;
  document.querySelector("#proactiveRawScore").textContent = result.score;
  document.querySelector("#proactiveSupportedScore").textContent = supported;
  document.querySelector("#proactiveUnverifiedScore").textContent = unsupported;
  document.querySelector("#proactiveFlagCount").textContent = `${result.flags.length} ${result.flags.length === 1 ? "flag" : "flags"}`;
  document.querySelector("#proactiveStatusTitle").textContent = "Human review required";
  const notes = baselineNotes(input);
  document.querySelector("#proactiveStatusText").textContent = result.flags.length
    ? `This is an early-warning prioritisation signal, not a final finding. Evidence-supported score: ${supported}/100. ${unsupported ? `${unsupported} points remain unverified. ` : ""}${notes.length ? "Some baseline-dependent rules were not evaluated. " : ""}Review evidence before any further action.`
    : "No configured pattern signal was triggered. This is not a finding of low risk.";
  const summaryText = result.flags.length
    ? "The observed activity contains patterns requiring focused review."
    : "No selected pattern exceeded the configured conditions.";
  document.querySelector("#proactiveSummary").innerHTML = `<strong>${escapeHtml(maskAccountReference(input.customerReference))}</strong> — ${escapeHtml(input.customerSegment)} profile, ${escapeHtml(input.monitoringWindow)}. ${summaryText}`;

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
  if (headerCaseId) headerCaseId.textContent = currentCaseId;
  if (headerGeneratedAt) headerGeneratedAt.textContent = currentGeneratedAt;
  document.querySelector("#proactiveReviewContext").innerHTML = [
    ["Customer / account", maskAccountReference(input.customerReference)],
    ["Evidence input", input.pdfMode],
    ["Profile", input.customerSegment],
    ["Profession", input.profession || "Not provided"],
    ["Monitoring window", input.monitoringWindow],
    ["Baseline window", input.baselineWindow || "Not provided"],
    ["Expected / observed transactions", `${input.expectedTransactions > 0 ? formatNumber(input.expectedTransactions) : "Not provided"} / ${input.observedTransactions > 0 ? formatNumber(input.observedTransactions) : "Not provided"}`],
    ["Expected / observed value", `${formatAmount(input.expectedValue, input.monitoringCurrency)} / ${formatAmount(input.observedValue, input.monitoringCurrency)}`],
    ["Counterparty detail", input.counterpartyDetail || "Not provided"],
    ["Route / corridor detail", input.corridorDetail || "Not provided"],
    ["Transaction / evidence detail", input.transactionDetail || "Not provided"],
    ["Inbound → outbound flow evidence", input.flowEvidence || "Not provided"],
    ["Changed channel / product", input.channelDetail || "Not provided"]
  ].map(([label, text]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(text)}</strong></div>`).join("");
  document.querySelector("#proactiveTypologyHypothesis").textContent = typologyHypothesis(result, input);
  document.querySelector("#proactiveScoreBasis").textContent = `Configured score ${result.score}/100; evidence-supported score ${supported}/100; unverified contribution ${unsupported} points. Applied bands: Low 0-24, Medium 25-49, High 50-74, Critical 75-100. More than 50% unverified keeps the signal pending evidence. ${notes.length ? `${notes.join(" ")} ` : ""}Weights require institutional calibration before operational use.`;

  document.querySelector("#proactiveFlags").innerHTML = result.flags.length
    ? result.flags.map((flag) => `<article class="flag-item${flag.evidenceGap ? " evidence-gap" : ""}"><span class="flag-marker"></span><div><strong>${escapeHtml(flag.title)}</strong><small class="flag-risk-type">Risk type: ${escapeHtml(flag.riskType)}</small>${flag.evidenceGap ? "<span class=\"evidence-warning\">UNVERIFIED — EVIDENCE REQUIRED</span>" : ""}<p>${escapeHtml(flagDetail(flag, input))}</p></div><span class="flag-points">+${flag.points}</span></article>`).join("")
    : `<div class="flag-item"><span class="flag-marker" style="background:#14866b;box-shadow:0 0 0 4px rgba(20,134,107,.13)"></span><div><strong>No configured pattern was triggered</strong><p>Add reliable transaction history and supporting context for a more specific review signal.</p></div><span class="flag-points" style="color:#14866b">—</span></div>`;

  document.querySelector("#proactiveNextSteps").innerHTML = nextSteps(result).map((step) => `<li>${escapeHtml(step)}</li>`).join("");
  latestResult = result;
  latestInput = input;
  latestSummary = buildSummary(result, input);
  if (copyButton) copyButton.disabled = false;
  if (printButton) printButton.disabled = false;
  if (downloadButton) downloadButton.disabled = false;
}

transactionPdfInput?.addEventListener("change", () => {
  const files = [...(transactionPdfInput.files || [])];
  if (!files.length) {
    pdfContextImported = false;
    clearPdfAttachment();
    return;
  }

  if (files.length > MAX_PDF_FILES) {
    pdfContextImported = false;
    clearPdfAttachment(`Select no more than ${MAX_PDF_FILES} PDF files at a time.`);
    return;
  }
  const invalidFile = files.find((file) => !(file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")));
  if (invalidFile) {
    pdfContextImported = false;
    clearPdfAttachment("Only PDF files are allowed.");
    return;
  }
  const oversizedFile = files.find((file) => file.size > MAX_PDF_BYTES);
  if (oversizedFile) {
    pdfContextImported = false;
    clearPdfAttachment(`${oversizedFile.name} is ${formatFileSize(oversizedFile.size)}. The maximum allowed size for each PDF is 10 MB.`);
    return;
  }
  const totalBytes = files.reduce((total, file) => total + file.size, 0);
  if (totalBytes > MAX_TOTAL_PDF_BYTES) {
    pdfContextImported = false;
    clearPdfAttachment(`The selected PDFs total ${formatFileSize(totalBytes)}. The combined maximum is 40 MB.`);
    return;
  }

  selectedPdfFiles = files;
  pdfContextImported = false;
  refreshPdfControls();
  setPdfStatus(`${files.length} PDF${files.length === 1 ? "" : "s"} selected · ${formatFileSize(totalBytes)} total · browser-local processing only; not sent to a TradeGuard server.`);
});

fullStatementModeButton?.addEventListener("click", () => setPdfMode("full-statement"));
transactionOnlyModeButton?.addEventListener("click", () => setPdfMode("transaction-only"));
pdfPrivacyAcknowledge?.addEventListener("change", () => {
  if (!pdfPrivacyAcknowledge.checked && selectedPdfFiles.length) {
    clearPdfAttachment("Acknowledgement removed. No PDF is selected.");
  } else if (pdfPrivacyAcknowledge.checked && !selectedPdfFiles.length) {
    setPdfStatus("Acknowledgement recorded. Choose an anonymised PDF to continue.");
  }
  refreshPdfControls();
});
analyzePdfButton?.addEventListener("click", analyzePdf);
clearPdfButton?.addEventListener("click", () => {
  pdfContextImported = false;
  clearPdfAttachment("PDF cleared from this browser session.");
});

resetButton?.addEventListener("click", () => {
  form?.reset();
  setPdfMode("full-statement");
  pdfContextImported = false;
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
  if (copyButton) {
    copyButton.disabled = true;
    copyButton.textContent = "Copy summary";
  }
  if (downloadButton) downloadButton.disabled = true;
  if (printButton) printButton.disabled = true;
  refreshPdfControls();
});

sampleButton?.addEventListener("click", () => {
  setPdfMode("full-statement");
  pdfContextImported = false;
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
  message.textContent = "Sample case context loaded. Press Run Transaction Review.";
});

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  const input = collectInput();
  if (!input.customerReference && pdfContextImported && pdfInputMode === "transaction-only") {
    input.customerReference = "Anonymised transaction-only case";
    setValues({ customerReference: input.customerReference });
  } else if (!input.customerReference) {
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

downloadButton?.addEventListener("click", () => {
  if (!latestSummary) return;
  const blob = new Blob([UTF8_BOM, latestSummary], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${currentCaseId || "tradeguard-transaction-monitoring-report"}.txt`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
});

printButton?.addEventListener("click", () => {
  if (!latestSummary) return;
  printSnapshot(reportContent, reportPanel?.parentElement, "print-transaction-report-mode");
});

window.addEventListener("afterprint", () => {
  document.body.classList.remove("print-transaction-report-mode");
});

revealAccountButton?.addEventListener("click", () => {
  if (!latestInput) return;
  accountRevealed = !accountRevealed;
  updateAccountDisplay(latestInput.customerReference);
});

pilotForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = document.querySelector("#pilotName")?.value.trim() || "";
  const organisation = document.querySelector("#pilotOrganisation")?.value.trim() || "";
  const type = document.querySelector("#pilotType")?.value || "";
  const mailto = `mailto:regtechnexusai@gmail.com?subject=${encodeURIComponent(`TradeGuard pilot request — ${organisation}`)}&body=${encodeURIComponent([
    "TradeGuard pilot request",
    `Name: ${name}`,
    `Organisation: ${organisation}`,
    `Organisation type: ${type}`,
    "I would like to discuss a TradeGuard transaction-monitoring/TBML review pilot."
  ].join("\n"))}`;
  if (pilotMessage) pilotMessage.textContent = "A draft email is opening. Review it and press Send. If nothing opens, email regtechnexusai@gmail.com directly.";
  window.location.href = mailto;
});

refreshPdfControls();
