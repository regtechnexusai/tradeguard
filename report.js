import { assessDataIntegrity, bandClass, getExpectedUnitsForHsCode, RULESET_VERSION } from "./rules.js?v=14";

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

const sourceTypeLabels = {
  automatic: "Automatic check",
  "reviewer-observation": "Reviewer observation",
  selected: "Selected TBML indicator"
};

function flagSourceText(flag) {
  const base = flag.source || sourceTypeLabels[flag.sourceType] || "Review signal";
  if (flag.sourceType === "automatic" && flag.selectedIndicator) return `${base} + selected TBML indicator`;
  if (flag.sourceType === "automatic") return `${base} — not in selected list`;
  if (flag.sourceType === "reviewer-observation" && flag.selectedIndicator) return "Selected TBML indicator + reviewer observation";
  if (flag.sourceType === "reviewer-observation") return `${base} — outside selected list`;
  return base;
}

function sourceClass(flag) {
  return flag.sourceType === "reviewer-observation" && !flag.selectedIndicator
    ? "source-outside"
    : `source-${flag.sourceType || "review"}`;
}

function mappingStatusText(status) {
  return {
    represented: "represented in review signals",
    "not-assessed": "not assessed",
    "selected-only": "selected; no separate signal recorded"
  }[status] || status;
}

export function calculateDataCompleteness(input) {
  const profile = getExpectedUnitsForHsCode(input.hsCode);
  const applicableFields = completenessFields.filter(([, key]) => profile.fields?.[key] !== "not-applicable");
  const knownValueFields = new Set(["beneficialOwnership", "relatedPartyRelationship", "payerRelationship"]);
  const completed = applicableFields.filter(([, key]) => {
    const value = input[key];
    const normalized = String(value ?? "").trim().toLowerCase();
    if (!normalized) return false;
    return !knownValueFields.has(key) || !["unknown", "unknown / not provided", "not provided"].includes(normalized);
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

  const unknownCoreFields = [
    ["Beneficial ownership", input.beneficialOwnership],
    ["Buyer–seller relationship", input.relatedPartyRelationship],
    ["Payer relationship", input.payerRelationship]
  ].filter(([, value]) => ["unknown", "unknown / not provided", "not provided"].includes(String(value || "").trim().toLowerCase()));
  if (unknownCoreFields.length) {
    message += ` ${unknownCoreFields.map(([label]) => label).join(", ")} ${unknownCoreFields.length === 1 ? "is" : "are"} marked unknown; this supports triage but not a decision-ready review.`;
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
  const indicatorMapping = document.querySelector("#indicatorMapping");
  const auditMetadata = document.querySelector("#auditMetadata");

  const completeness = calculateDataCompleteness(input);
  const integrity = result.integrity || assessDataIntegrity(input);

  reportPanel.classList.remove("is-empty");
  emptyReport.hidden = true;
  reportContent.hidden = false;
  const hasFlags = result.flags.length > 0;
  const indicativeScore = hasFlags ? result.indicativeScore : null;
  const hasIndicativeScore = Number.isFinite(indicativeScore);
  const hasIssuedScore = result.decisionReady && hasFlags;
  score.textContent = hasIssuedScore ? result.score : result.decisionReady ? "—" : "Withheld";
  score.classList.toggle("score-withheld", !result.decisionReady);
  score.classList.toggle("score-indicative", false);
  score.classList.toggle("score-no-signal", !hasFlags && result.decisionReady);
  scoreSuffix.textContent = result.decisionReady
    ? (hasFlags ? "/100" : "no scoreable signal")
    : "decision-ready score withheld";
  band.textContent = result.decisionReady
    ? (hasFlags ? result.band.toUpperCase() : "NO SIGNAL")
    : (hasIndicativeScore ? `INDICATIVE ${result.indicativeBand.toUpperCase()}` : "NOT READY");
  band.className = `status-pill ${result.decisionReady ? (hasFlags ? bandClass(result.band) : "status-no-signal") : (hasIndicativeScore ? bandClass(result.indicativeBand) : "status-not-ready")}`;
  const gaugeScore = result.decisionReady ? result.score : 0;
  gaugeShell.style.background = `conic-gradient(#1967d2 ${gaugeScore * 3.6}deg, #dcecf6 0deg)`;
  flagCount.textContent = `${result.flags.length} ${result.flags.length === 1 ? "review signal" : "review signals"}`;
  rawScoreValue.textContent = hasFlags ? result.rawScore : "—";
  decisionStatus.textContent = result.decisionStatus;
  decisionStatusMessage.textContent = result.decisionReady
    ? (hasFlags
      ? `The score passed the current data-integrity and evidence gates. It remains an indicative review signal.${result.scoreCapApplied ? " Raw indicator points exceeded 100, so the issued score is capped at 100." : ""}`
      : "No configured risk indicator was triggered by the supplied inputs. This is not a finding of low risk.")
    : (hasIndicativeScore
      ? `The decision-ready score is withheld. Raw indicator points are retained for triage only; the indicative signal band is ${result.indicativeBand.toUpperCase()}. Resolve these gaps before relying on an overall score: ${result.readinessIssues.join(" ")}`
      : `No numeric scoreable signal was available from the supplied inputs. Add optional price data or select supported review indicators to generate an indicative signal. ${result.readinessIssues.length ? `Resolve these gaps: ${result.readinessIssues.join(" ")}` : ""}`);
  decisionReadiness.classList.toggle("is-blocked", !result.decisionReady);
  decisionReadiness.classList.toggle("is-ready", result.decisionReady && hasFlags);
  decisionReadiness.classList.toggle("is-neutral", result.decisionReady && !hasFlags);

  const priceText = result.deviation === null
    ? (integrity.priceDataProvided
      ? "Price comparison was not issued because the supplied price inputs are incomplete or not comparable to the verified HS Code and unit."
      : "Price comparison was not run because the optional price fields were not provided.")
    : result.deviation > 0
      ? `Declared price ${escapeHtml(input.currency)} ${formatNumber(input.invoicePrice)} per ${escapeHtml(input.unitOfMeasure)}; supplied market range ${escapeHtml(input.currency)} ${formatNumber(input.marketLow)}–${formatNumber(input.marketHigh)} per ${escapeHtml(input.unitOfMeasure)}; approximately ${Math.round(result.deviation)}% ${input.invoicePrice > input.marketHigh ? "above the upper bound" : "below the lower bound"}.`
      : `Declared price ${escapeHtml(input.currency)} ${formatNumber(input.invoicePrice)} per ${escapeHtml(input.unitOfMeasure)}; supplied market range ${escapeHtml(input.currency)} ${formatNumber(input.marketLow)}–${formatNumber(input.marketHigh)} per ${escapeHtml(input.unitOfMeasure)}; inside the supplied range.`;

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
      ? "The decision-ready score is withheld. Raw indicator points are for triage only; resolve the listed decision-readiness gaps before relying on the assessment."
      : "No numeric score was issued because the supplied inputs did not produce a scoreable signal.");
  const suppressedText = result.suppressedIndicators?.length
    ? ` The following selected indicator${result.suppressedIndicators.length === 1 ? " is" : "s are"} not assessed: ${result.suppressedIndicators.map((id) => TBML_INDICATOR_LABELS[id] || id).join(", ")}.`
    : "";
  summary.innerHTML = `<strong>${escapeHtml(input.productName)}</strong> — ${escapeHtml(input.originCountry)} to ${escapeHtml(input.destinationCountry)}. ${priceText}${hsText}${indicatorText}${suppressedText} ${readinessText}`;

  completenessValue.textContent = `${completeness.percent}%`;
  completenessBar.style.width = `${completeness.percent}%`;
  completenessMessage.textContent = completeness.message;

  integrityValue.textContent = integrity.status;
  const integrityBlocked = integrity.issues.length > 0 || (integrity.priceDataProvided && !integrity.priceScoringEligible);
  const integrityWarning = !integrityBlocked && integrity.warnings.length > 0;
  integrityValue.className = integrityBlocked ? "integrity-blocked" : integrityWarning ? "integrity-warning" : "integrity-good";
  integrityMessage.textContent = integrity.message;
  const integrityItems = [...integrity.issues, ...integrity.warnings];
  if (result.suppressedIndicators?.length) {
    integrityItems.push(`Selected but not assessed: ${result.suppressedIndicators.map((id) => TBML_INDICATOR_LABELS[id] || id).join(", ")}.`);
  }
  integrityList.innerHTML = integrityItems
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
  integrityCard.classList.toggle("is-blocked", integrityBlocked);
  integrityCard.classList.toggle("is-warning", integrityWarning);

  const contextItems = [
    input.productDescription && `Goods: ${input.productDescription}`,
    input.qualityGrade && `Grade: ${input.qualityGrade}`,
    input.material && `Material: ${input.material}`,
    input.unitOfMeasure && `Unit: ${input.unitOfMeasure}`,
    integrity.expectedUnits?.length && `Expected unit profile: ${integrity.expectedUnits.join(" or ")}`,
    integrity.preferredUnit && `Preferred benchmark unit: ${integrity.preferredUnit}`,
    input.currency && `Currency: ${input.currency}`,
    input.totalValue && `Total value: ${formatNumber(input.totalValue)}`,
    integrity.totalReconciliation && `Value reconciliation: ${formatNumber(input.quantity)} × ${formatNumber(input.invoicePrice)} = ${formatNumber(integrity.totalReconciliation.expectedTotal)} expected vs ${formatNumber(integrity.totalReconciliation.declaredTotal)} declared (${Math.round(integrity.totalReconciliation.differencePercent)}% difference)`,
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

  const selectedMappings = result.selectedIndicatorMappings || [];
  const reviewerObservationOnly = result.reviewerObservationOnlyFlags || [];
  const automaticFlags = result.automaticFlags || [];
  const selectedMappingItems = selectedMappings.map((mapping) => {
    const label = TBML_INDICATOR_LABELS[mapping.key] || mapping.key;
    return `<li><strong>${escapeHtml(label)}</strong><span>${escapeHtml(mappingStatusText(mapping.status))}</span></li>`;
  }).join("");
  const outsideObservationItems = reviewerObservationOnly.map((flag) =>
    `<li><strong>${escapeHtml(flag.title)}</strong><span>${escapeHtml(flag.source || "Reviewer observation")}</span></li>`
  ).join("");
  indicatorMapping.innerHTML = `
    <div class="mapping-header"><strong>Selected vs recorded signal mapping</strong><span>${selectedMappings.length} selected</span></div>
    <p class="mapping-note">A selected indicator is a reviewer input, not proof of TBML. Automatic checks and quick reviewer observations are shown separately so the source of each signal remains auditable.</p>
    <div class="mapping-counts">
      <div><span>Selected indicators</span><strong>${selectedMappings.length}</strong></div>
      <div><span>Automatic checks</span><strong>${automaticFlags.length}</strong></div>
      <div><span>Reviewer observations outside selection</span><strong>${reviewerObservationOnly.length}</strong></div>
    </div>
    ${selectedMappings.length ? `<div class="mapping-group"><span class="mapping-label">Structured selections</span><ul class="mapping-list">${selectedMappingItems}</ul></div>` : ""}
    ${reviewerObservationOnly.length ? `<div class="mapping-group"><span class="mapping-label">Reviewer observations outside the selected list</span><ul class="mapping-list">${outsideObservationItems}</ul></div>` : ""}
  `;

  const auditTimestamp = result.assessmentTimestamp || new Date().toISOString();
  const auditComplete = Boolean(input.caseReference && input.reviewerIdentity);
  auditMetadata.innerHTML = `
    <div class="audit-header"><strong>Audit record</strong><span class="audit-status ${auditComplete ? "audit-complete" : "audit-incomplete"}">${auditComplete ? "Reference details supplied" : "Reference details incomplete"}</span></div>
    <dl class="audit-grid">
      <div><dt>Case reference</dt><dd>${escapeHtml(input.caseReference || "Not provided")}</dd></div>
      <div><dt>Reviewer identity</dt><dd>${escapeHtml(input.reviewerIdentity || "Not provided")}</dd></div>
      <div><dt>Assessment timestamp (UTC)</dt><dd>${escapeHtml(auditTimestamp)}</dd></div>
      <div><dt>Tool / ruleset</dt><dd>${escapeHtml(RULESET_VERSION)}</dd></div>
    </dl>
    ${auditComplete ? "" : "<p class=\"audit-note\">Add a case reference and reviewer identity before treating this output as an auditable review record.</p>"}
  `;

  if (!result.flags.length) {
    flagList.innerHTML = `<div class="flag-item"><span class="flag-marker" style="background:#14866b;box-shadow:0 0 0 4px rgba(20,134,107,.13)"></span><div><strong>No configured review signal was recorded</strong><p>This is not a finding of low risk. Add optional transaction data and supporting evidence for a more specific review signal.</p></div><span class="flag-points" style="color:#14866b">—</span></div>`;
  } else {
    flagList.innerHTML = result.flags.map((flag) => `
      <article class="flag-item">
        <span class="flag-marker"></span>
        <div>
          <strong>${escapeHtml(flag.title)}</strong>
          <small class="flag-source ${sourceClass(flag)}">${escapeHtml(flagSourceText(flag))}</small>
          <p>${escapeHtml(flag.detail)}</p>
          ${flag.action ? `<small class="flag-action">Next: ${escapeHtml(flag.action)}</small>` : ""}
        </div>
        <span class="flag-points">+${flag.points}</span>
      </article>
    `).join("");
  }

  const recommendationAdditions = [];
  if (integrity.priceDataProvided && !result.priceScoringEligible) {
    recommendationAdditions.push("Do not rely on the price component until the comparability issues are corrected.");
  }
  if (completeness.percent < 80) {
    recommendationAdditions.push("Obtain additional supporting information before relying on this result.");
  }
  recommendation.textContent = [result.recommendation, ...recommendationAdditions].join(" ").trim();

  return [
    "TradeGuard by RegTech Nexus AI",
    `Case reference: ${input.caseReference || "Not provided"}`,
    `Reviewer identity: ${input.reviewerIdentity || "Not provided"}`,
    `Assessment timestamp (UTC): ${result.assessmentTimestamp || new Date().toISOString()}`,
    `Tool / ruleset: ${RULESET_VERSION}`,
    `Product: ${input.productName}`,
    `Route: ${input.originCountry} → ${input.destinationCountry}`,
    input.hsCode ? `HS Code: ${input.hsCode}` : "HS Code: Not provided",
    `Decision status: ${result.decisionStatus}`,
    `Raw indicator points: ${result.rawScore}`,
    result.decisionReady && result.flags.length
      ? `Risk score: ${result.score}/100 (${result.band})`
      : result.indicativeScore !== null && result.indicativeScore !== undefined
        ? `Risk score: WITHHELD — raw indicator points retained for triage only (${result.indicativeBand} indicative signal band)`
        : "Risk score: No scoreable signal from the supplied inputs",
    `Score cap applied: ${result.scoreCapApplied ? "Yes — raw indicator points exceeded 100" : "No"}`,
    result.readinessIssues.length ? `Readiness issues: ${result.readinessIssues.join(" | ")}` : "Readiness issues: None identified by configured gates",
    `Data completeness: ${completeness.percent}%`,
    `Data integrity / comparability: ${integrity.status}`,
    integrity.issues.length ? `Integrity issues: ${integrity.issues.join(" | ")}` : "Integrity issues: None identified by configured checks",
    integrity.totalReconciliation
      ? `Value reconciliation: ${formatNumber(input.quantity)} × ${formatNumber(input.invoicePrice)} = ${formatNumber(integrity.totalReconciliation.expectedTotal)} expected vs ${formatNumber(integrity.totalReconciliation.declaredTotal)} declared (${Math.round(integrity.totalReconciliation.differencePercent)}% difference)`
      : null,
    `Price component: ${result.priceScoringEligible ? "Calculated" : integrity.priceDataProvided ? "Not comparable / withheld" : "Not assessed — optional data not provided"}`,
    `Structured TBML indicators selected: ${(input.tbmlIndicators || []).map((id) => TBML_INDICATOR_LABELS[id] || id).join(", ") || "None"}`,
    result.selectedIndicatorMappings?.length
      ? `Selected indicator mapping: ${result.selectedIndicatorMappings.map((mapping) => `${TBML_INDICATOR_LABELS[mapping.key] || mapping.key} — ${mappingStatusText(mapping.status)}`).join("; ")}`
      : null,
    result.reviewerObservationOnlyFlags?.length
      ? `Reviewer observations outside selected list: ${result.reviewerObservationOnlyFlags.map((flag) => flag.title).join(", ")}`
      : null,
    result.automaticFlags?.length
      ? `Automatic checks: ${result.automaticFlags.map((flag) => flag.title).join(", ")}`
      : null,
    result.suppressedIndicators?.length
      ? `Selected but not assessed: ${result.suppressedIndicators.map((id) => TBML_INDICATOR_LABELS[id] || id).join(", ")}`
      : null,
    `Indicator confidence: ${input.indicatorConfidence || "Not provided"}`,
    `Evidence status: ${input.evidenceStatus || "Not provided"}`,
    `Review signals recorded: ${result.flags.length}`,
    ...result.flags.map((flag) => `- ${flag.title} [${flagSourceText(flag)}]: ${flag.detail}${flag.action ? ` Next: ${flag.action}` : ""}`),
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
    reviewerEvidenceNote: "Illustrative demo note only; validate selected indicators against genuine commercial and transport evidence.",
    caseReference: "DEMO-2026-001",
    reviewerIdentity: "Demo reviewer"
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
    caseReference: value("caseReference"),
    reviewerIdentity: value("reviewerIdentity"),
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
