import { GlobalWorkerOptions, getDocument } from "./pdf.mjs";

GlobalWorkerOptions.workerSrc = "./pdf.worker.mjs";

const form = document.querySelector("#documentForm");
const typeInput = document.querySelector("#documentAssessmentType");
const fileInput = document.querySelector("#documentFileInput");
const privacyInput = document.querySelector("#documentPrivacyAcknowledge");
const fileStatus = document.querySelector("#documentFileStatus");
const formMessage = document.querySelector("#documentFormMessage");
const runButton = document.querySelector("#runDocumentAssessment");
const resetButton = document.querySelector("#documentResetButton");
const reportPanel = document.querySelector("#documentReport");
const emptyReport = document.querySelector("#documentEmpty");
const reportContent = document.querySelector("#documentReportContent");
const copyButton = document.querySelector("#documentCopyButton");
const printButton = document.querySelector("#documentPrintButton");
const downloadButton = document.querySelector("#documentDownloadButton");
const profileHint = document.querySelector("#documentAssessmentHint");

const MAX_FILES = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 40 * 1024 * 1024;
const OCR_MODULE_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.esm.min.js";
const UTF8_BOM = "\uFEFF";

let latestSummary = "";
let latestAssessment = null;
let ocrWorkerPromise = null;
let currentCaseId = "";

const profiles = {
  "kyc-aof": {
    label: "KYC / AOF documents",
    description: "Checks identity, address, occupation, beneficial ownership, source-of-funds and signature evidence.",
    required: [
      { label: "identity evidence", terms: ["national id", "nid", "passport", "identity", "identification", "driving licence"] },
      { label: "address evidence", terms: ["address", "residential", "utility bill", "proof of address"] },
      { label: "customer information", terms: ["name", "date of birth", "occupation", "applicant"] },
      { label: "signature or declaration", terms: ["signature", "signed", "declaration", "consent"] }
    ],
    minFiles: 1,
    setHint: "For KYC/AOF, upload the application and supporting identity/address documents where available."
  },
  "trade-documents": {
    label: "Trade documents",
    description: "Checks commercial and shipping document signals across invoice, packing list, bill of lading, parties, goods, price and route.",
    required: [
      { label: "commercial invoice", terms: ["invoice", "commercial invoice"] },
      { label: "shipping or transport evidence", terms: ["bill of lading", "bill of lading", "air waybill", "transport document", "shipment"] },
      { label: "goods and quantity", terms: ["hs code", "quantity", "unit price", "commodity", "goods", "description"] },
      { label: "trade parties or route", terms: ["shipper", "consignee", "buyer", "seller", "origin", "destination", "port"] }
    ],
    minFiles: 2,
    setHint: "For trade review, compare the invoice, packing list, transport document and supporting contract where available."
  },
  "loan-credit": {
    label: "Loan / credit documents",
    description: "Checks application, facility, purpose, repayment, approval, financial and security evidence signals.",
    required: [
      { label: "borrower or applicant", terms: ["borrower", "applicant", "customer", "company", "name"] },
      { label: "facility and amount", terms: ["loan", "facility", "credit", "amount", "limit"] },
      { label: "purpose and repayment", terms: ["purpose", "repayment", "tenor", "maturity", "instalment", "installment"] },
      { label: "approval or sanction", terms: ["approval", "sanction", "credit committee", "authorised", "authorized"] },
      { label: "security or financial support", terms: ["collateral", "security", "financial statement", "guarantee", "cash flow"] }
    ],
    minFiles: 2,
    setHint: "For credit review, upload the application or sanction document together with financial and security documents."
  },
  "financial-statements": {
    label: "Financial statements",
    description: "Checks statement structure, reporting period, balance-sheet, income, cash-flow and audit evidence signals.",
    required: [
      { label: "reporting period", terms: ["year ended", "period ended", "financial year", "quarter ended", "as at"] },
      { label: "balance sheet", terms: ["balance sheet", "statement of financial position", "assets", "liabilities", "equity"] },
      { label: "income or profit and loss", terms: ["income statement", "profit and loss", "revenue", "turnover", "net profit"] },
      { label: "cash flow or notes", terms: ["cash flow", "cash flows", "notes to the financial statements", "accounting policy"] },
      { label: "audit evidence", terms: ["auditor", "independent auditor", "audit report", "signed"] }
    ],
    minFiles: 1,
    setHint: "For financial statements, upload the relevant reporting period and any comparative or audited version available."
  },
  "collateral": {
    label: "Collateral / security documents",
    description: "Checks ownership, title, valuation, encumbrance, insurance, mortgage or charge and document-date signals.",
    required: [
      { label: "collateral or security description", terms: ["collateral", "security", "property", "asset", "land", "equipment"] },
      { label: "ownership or title", terms: ["owner", "ownership", "title", "deed", "registration", "mutation"] },
      { label: "valuation", terms: ["valuation", "valuer", "market value", "forced sale value", "appraisal"] },
      { label: "encumbrance or charge", terms: ["encumbrance", "mortgage", "charge", "lien", "no objection"] },
      { label: "insurance or date", terms: ["insurance", "policy", "valid until", "date", "expiry", "expiration"] }
    ],
    minFiles: 1,
    setHint: "For collateral review, upload title/ownership, valuation and insurance or charge documents where available."
  }
};

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function generatedAtUtc() {
  return new Date().toISOString();
}

function createCaseId() {
  const stamp = generatedAtUtc().replace(/[-:TZ.]/g, "").slice(0, 14);
  const suffix = Math.random().toString(16).slice(2, 8).toUpperCase();
  return "DG-" + stamp + "-" + suffix;
}

function normalise(text) {
  return String(text || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function hasTerm(text, terms) {
  return terms.some((term) => text.includes(term));
}

function updateStatus(text, state) {
  fileStatus.textContent = text;
  fileStatus.className = "file-status" + (state ? " " + state : "");
}

function setProgress(text) {
  formMessage.textContent = text;
  formMessage.className = "form-message form-message-info";
}

function getSelectedFiles() {
  return [...(fileInput.files || [])];
}

function validateFiles(files) {
  if (!files.length) return "Select at least one PDF or image file.";
  if (files.length > MAX_FILES) return "Select no more than " + MAX_FILES + " files.";
  const total = files.reduce((sum, file) => sum + file.size, 0);
  if (total > MAX_TOTAL_BYTES) return "The combined file size must not exceed 40 MB.";
  const invalid = files.find((file) => file.size > MAX_FILE_BYTES);
  if (invalid) return invalid.name + " exceeds the 10 MB per-file limit.";
  const supported = files.every((file) => /^(application\/pdf|image\/(png|jpeg|webp))$/i.test(file.type) || /\.(pdf|png|jpe?g|webp)$/i.test(file.name));
  return supported ? "" : "Use PDF, PNG, JPEG or WebP files only.";
}

async function loadOcrWorker() {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = import(OCR_MODULE_URL).then(async (module) => {
      const createWorker = module.createWorker || (module.default && module.default.createWorker);
      if (!createWorker) throw new Error("OCR engine did not load.");
      return createWorker("eng", 1, {
        logger: (message) => {
          if (message && message.status) setProgress("OCR: " + message.status + (message.progress ? " " + Math.round(message.progress * 100) + "%" : ""));
        }
      });
    }).catch((error) => {
      ocrWorkerPromise = null;
      throw error;
    });
  }
  return ocrWorkerPromise;
}

async function recogniseCanvas(canvas) {
  const worker = await loadOcrWorker();
  const result = await worker.recognize(canvas);
  return String(result && result.data && result.data.text ? result.data.text : "");
}

async function imageCanvas(file) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error("The image could not be decoded."));
    });
    const scale = Math.min(2, 1800 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext("2d", { willReadFrequently: true }).drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function extractPdf(file) {
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocument({ data }).promise;
  let selectableText = "";
  const pageCount = pdf.numPages;
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    selectableText += content.items.map((item) => item.str || "").join(" ") + "\n";
  }

  const selectableChars = selectableText.replace(/\s/g, "").length;
  let text = selectableText;
  let method = "Selectable text";
  let ocrAttempted = false;
  let ocrError = "";

  if (selectableChars < 80) {
    ocrAttempted = true;
    method = "OCR-assisted";
    const ocrParts = [];
    try {
      const pageLimit = Math.min(pageCount, 3);
      for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
        setProgress("Rendering scanned PDF page " + pageNumber + " of " + pageLimit + "…");
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await page.render({ canvasContext: canvas.getContext("2d", { willReadFrequently: true }), viewport }).promise;
        ocrParts.push(await recogniseCanvas(canvas));
      }
      text = [selectableText, ...ocrParts].join("\n");
    } catch (error) {
      ocrError = error && error.message ? error.message : "OCR could not be completed.";
    }
  }

  return {
    name: file.name,
    type: "PDF",
    size: file.size,
    pages: pageCount,
    text,
    selectableChars,
    method,
    ocrAttempted,
    ocrError
  };
}

async function extractImage(file) {
  let text = "";
  let error = "";
  try {
    setProgress("Preparing OCR for " + file.name + "…");
    text = await recogniseCanvas(await imageCanvas(file));
  } catch (reason) {
    error = reason && reason.message ? reason.message : "OCR could not be completed.";
  }
  return {
    name: file.name,
    type: "Image",
    size: file.size,
    pages: 1,
    text,
    selectableChars: 0,
    method: "OCR-assisted",
    ocrAttempted: true,
    ocrError: error
  };
}

async function extractFile(file) {
  if (/application\/pdf/i.test(file.type) || /\.pdf$/i.test(file.name)) return extractPdf(file);
  return extractImage(file);
}

function buildFlags(profile, results) {
  const combined = normalise(results.map((result) => result.text).join(" "));
  const flags = [];
  const missing = profile.required.filter((item) => !hasTerm(combined, item.terms));
  const ocrFailures = results.filter((result) => result.ocrAttempted && (result.ocrError || normalise(result.text).length < 20));

  if (ocrFailures.length) {
    flags.push({
      title: "Low-confidence OCR or text extraction",
      detail: ocrFailures.length + " document(s) returned little usable text or could not complete OCR. Review the original pages manually.",
      points: 25,
      riskType: "Document quality / extraction risk"
    });
  }

  if (missing.length) {
    flags.push({
      title: "Expected document fields not located",
      detail: "The selected profile did not locate: " + missing.map((item) => item.label).join(", ") + ". This may indicate an incomplete set, a different document format or an extraction limitation.",
      points: Math.min(45, missing.length * 9),
      riskType: "Document completeness risk"
    });
  }

  const anomalyTerms = ["mismatch", "inconsistent", "inconsistency", "discrepancy", "altered", "expired", "unverified", "unsigned", "manual correction", "different from"];
  const foundAnomalies = anomalyTerms.filter((term) => combined.includes(term));
  if (foundAnomalies.length) {
    flags.push({
      title: "Potential document inconsistency language",
      detail: "The extracted content contains review terms such as " + foundAnomalies.join(", ") + ". Confirm the underlying values, dates and supporting evidence.",
      points: Math.min(25, foundAnomalies.length * 8),
      riskType: "Document integrity risk"
    });
  }

  if (results.length < profile.minFiles) {
    flags.push({
      title: "Document set may be incomplete",
      detail: "The selected profile normally benefits from at least " + profile.minFiles + " related document(s). Compare the supplied files with the institution's checklist.",
      points: 15,
      riskType: "Document completeness risk"
    });
  }

  const score = Math.min(100, flags.reduce((total, flag) => total + flag.points, 0));
  return { flags, score, missingCount: missing.length, ocrFailures: ocrFailures.length };
}

function fileResultMarkup(result) {
  const extraction = result.ocrError ? "OCR unavailable" : result.method;
  const chars = normalise(result.text).length;
  return "<article class="document-file-result"><div><strong>" + escapeHtml(result.name) + "</strong><small>" + escapeHtml(result.type) + " · " + result.pages + " page(s) · " + Math.round(result.size / 1024) + " KB</small></div><span>" + escapeHtml(extraction) + "<br><small>" + chars + " extracted characters</small></span></article>";
}

function buildSummary(profile, results, analysis, generatedAt) {
  const lines = [
    "TradeGuard Document Assessment",
    "Assessment: " + profile.label,
    "Case ID: " + currentCaseId,
    "Generated: " + generatedAt,
    "Indicative document signal: " + analysis.score + "/100",
    "Status: Human review required",
    "Documents reviewed: " + results.length,
    "OCR / extraction issues: " + analysis.ocrFailures,
    "Detected flags: " + analysis.flags.length
  ];
  analysis.flags.forEach((flag, index) => {
    lines.push((index + 1) + ". " + flag.title + " [" + flag.riskType + "]: " + flag.detail);
  });
  lines.push("Suggested next step: Review the original documents, confirm the missing fields and resolve any inconsistencies before relying on the assessment.");
  lines.push("Assessment output only. It is not a final KYC, AML, TBML, credit or legal determination.");
  return lines.join("\n");
}

function renderReport(profile, results, analysis) {
  const generated = generatedAtUtc();
  currentCaseId = createCaseId();
  reportPanel.classList.remove("is-empty");
  emptyReport.hidden = true;
  reportContent.hidden = false;
  document.querySelector("#documentHeaderCaseId").textContent = currentCaseId;
  document.querySelector("#documentHeaderGeneratedAt").textContent = generated;
  document.querySelector("#documentScore").textContent = analysis.score;
  document.querySelector("#documentBand").textContent = analysis.flags.length ? "HUMAN REVIEW" : "NO CONFIGURED FLAG";
  document.querySelector("#documentBand").className = "status-pill " + (analysis.flags.length ? "status-not-ready" : "status-low");
  document.querySelector("#documentStatus").textContent = analysis.flags.length ? "Human review required" : "No configured anomaly detected";
  document.querySelector("#documentStatusMessage").textContent = "Document signals are indicative and require verification against the original files.";
  document.querySelector("#documentCount").textContent = results.length;
  document.querySelector("#documentProfileLabel").textContent = profile.label;
  document.querySelector("#documentProfileDescription").textContent = profile.description;
  document.querySelector("#documentOcrBadge").textContent = analysis.ocrFailures ? "OCR / REVIEW" : "OCR / TEXT";
  document.querySelector("#documentOcrBadgeNote").textContent = analysis.ocrFailures ? "Extraction requires manual confirmation" : "Browser-local extraction completed";
  document.querySelector("#documentFlagCount").textContent = analysis.flags.length + (analysis.flags.length === 1 ? " flag" : " flags");
  document.querySelector("#documentFlags").innerHTML = analysis.flags.length
    ? analysis.flags.map((flag) => "<article class="flag-item evidence-gap"><span class="flag-marker"></span><div><strong>" + escapeHtml(flag.title) + "</strong><small class="flag-risk-type">Risk type: " + escapeHtml(flag.riskType) + "</small><p>" + escapeHtml(flag.detail) + "</p></div><span class="flag-points">+" + flag.points + "</span></article>").join("")
    : "<article class=\"flag-item\"><span class=\"flag-marker\" style=\"background:#14866b\"></span><div><strong>No configured anomaly detected</strong><p>Continue with human review and the institution's document checklist.</p></div><span class=\"flag-points\">—</span></article>";
  document.querySelector("#documentFileResults").innerHTML = results.map(fileResultMarkup).join("");
  document.querySelector("#documentNextSteps").innerHTML = [
    "Inspect the original documents and validate all extracted fields.",
    analysis.missingCount ? "Obtain the missing document fields or supporting files identified above." : "Reconcile the document set against the applicable checklist.",
    "Escalate inconsistencies, suspected alteration or unresolved OCR uncertainty under the approved review procedure."
  ].map((step) => "<li>" + escapeHtml(step) + "</li>").join("");
  latestSummary = buildSummary(profile, results, analysis, generated);
  latestAssessment = { profile, results, analysis };
  copyButton.disabled = false;
  printButton.disabled = false;
  downloadButton.disabled = false;
}

async function runAssessment() {
  const profile = profiles[typeInput.value];
  const files = getSelectedFiles();
  const validation = validateFiles(files);
  if (!profile) {
    formMessage.textContent = "Select an assessment type.";
    return;
  }
  if (validation) {
    formMessage.textContent = validation;
    return;
  }
  if (!privacyInput.checked) {
    formMessage.textContent = "Confirm that you are using fictional or anonymised documents.";
    return;
  }

  runButton.disabled = true;
  formMessage.textContent = "";
  updateStatus("Reading " + files.length + " document(s)…", "is-processing");
  try {
    const results = [];
    for (const file of files) {
      setProgress("Extracting " + file.name + "…");
      results.push(await extractFile(file));
    }
    const analysis = buildFlags(profile, results);
    renderReport(profile, results, analysis);
    updateStatus("Assessment complete. Review the report and original documents.", "is-ready");
    formMessage.textContent = "Assessment complete. The output is indicative and requires human review.";
  } catch (error) {
    formMessage.textContent = error && error.message ? error.message : "The assessment could not be completed.";
    updateStatus("Assessment failed.", "is-error");
  } finally {
    runButton.disabled = false;
  }
}

function preparePrintSnapshot() {
  document.querySelector(".document-print-snapshot")?.remove();
  const snapshot = document.createElement("section");
  snapshot.className = "panel document-print-snapshot";
  const clone = reportContent.cloneNode(true);
  clone.removeAttribute("hidden");
  snapshot.appendChild(clone);
  document.querySelector("#documentCheck").appendChild(snapshot);
  document.body.classList.add("document-print-mode");
  window.setTimeout(() => window.print(), 350);
}

typeInput.addEventListener("change", () => {
  const profile = profiles[typeInput.value];
  profileHint.textContent = profile ? profile.setHint : "The selected profile controls the expected document fields and anomaly checks.";
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  runAssessment();
});

copyButton.addEventListener("click", async () => {
  if (!latestSummary) return;
  try {
    await navigator.clipboard.writeText(latestSummary);
    copyButton.textContent = "Copied ✓";
    window.setTimeout(() => { copyButton.textContent = "Copy summary"; }, 1800);
  } catch {
    copyButton.textContent = "Select report manually";
  }
});

downloadButton.addEventListener("click", () => {
  if (!latestSummary) return;
  const blob = new Blob([UTF8_BOM, latestSummary], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = (currentCaseId || "tradeguard-document-assessment") + ".txt";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
});

printButton.addEventListener("click", () => {
  if (latestSummary) preparePrintSnapshot();
});

resetButton.addEventListener("click", () => {
  form.reset();
  reportPanel.classList.add("is-empty");
  emptyReport.hidden = false;
  reportContent.hidden = true;
  copyButton.disabled = true;
  printButton.disabled = true;
  downloadButton.disabled = true;
  latestSummary = "";
  latestAssessment = null;
  currentCaseId = "";
  updateStatus("No documents selected.");
  formMessage.textContent = "";
  profileHint.textContent = "The selected profile controls the expected document fields and anomaly checks.";
});

window.addEventListener("afterprint", () => {
  document.body.classList.remove("document-print-mode");
});
