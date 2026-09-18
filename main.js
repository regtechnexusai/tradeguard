import { calculateRisk, getExpectedUnitsForHsCode } from "./rules.js?v=16";
import { collectInput, renderReport, setSampleValues, validateInput } from "./report.js?v=16";

const riskForm = document.querySelector("#riskForm");
const sampleButton = document.querySelector("#sampleButton");
const resetButton = document.querySelector("#resetButton");
const formMessage = document.querySelector("#formMessage");
const copyReportButton = document.querySelector("#copyReportButton");
const pilotForm = document.querySelector("#pilotForm");
const pilotMessage = document.querySelector("#pilotMessage");
const lookupHsCode = document.querySelector("#lookupHsCode");
const hsCodeInput = document.querySelector("#hsCode");
const hsCodeDescription = document.querySelector("#hsCodeDescription");
const commodityField = document.querySelector("#commodityField");
const commodityInput = document.querySelector("#productCommodity");
const unitInput = document.querySelector("#unitOfMeasure");
const unitProfileNote = document.querySelector("#unitProfileNote");

let latestReport = "";
let hsCodeIndex = new Map();
let hsCodesLoaded = false;
const allUnitOptions = ["Piece", "Kilogram", "Tonne", "Metre", "Yard", "Litre", "Carton", "Set", "Other"];

function clearFieldError(id) {
  const control = document.querySelector(`#${id}`);
  const field = control?.closest(".field");
  if (!control || !field) return;

  field.classList.remove("has-error");
  control.classList.remove("input-invalid");
  control.removeAttribute("aria-invalid");
  field.querySelector(".field-error")?.remove();
}

function clearValidationErrors() {
  document.querySelectorAll("#riskForm .field.has-error").forEach((field) => {
    field.classList.remove("has-error");
    field.querySelector(".input-invalid")?.classList.remove("input-invalid");
    field.querySelector("[aria-invalid='true']")?.removeAttribute("aria-invalid");
    field.querySelector(".field-error")?.remove();
  });
}

function setFieldError(id, message) {
  const control = document.querySelector(`#${id}`);
  const field = control?.closest(".field");
  if (!control || !field) return;

  field.classList.add("has-error");
  control.classList.add("input-invalid");
  control.setAttribute("aria-invalid", "true");

  let error = field.querySelector(".field-error");
  if (!error) {
    error = document.createElement("small");
    error.className = "field-error";
    field.appendChild(error);
  }
  error.textContent = message;
}

function showValidationErrors(errors) {
  clearValidationErrors();
  Object.entries(errors).forEach(([id, message]) => {
    const control = document.querySelector(`#${id}`);
    control?.closest("details")?.setAttribute("open", "");
    setFieldError(id, message);
  });

  const firstInvalid = document.querySelector("#riskForm .input-invalid");
  firstInvalid?.focus({ preventScroll: true });
}

function clearCommoditySensitiveFields() {
  ["productDescription", "qualityGrade", "material", "modelBrand", "specification", "unitOfMeasure", "invoicePrice", "totalValue", "marketLow", "marketHigh", "marketSource", "marketSourceDate", "currency", "valuationBasis"].forEach((id) => {
    const element = document.querySelector(`#${id}`);
    if (element) element.value = "";
  });
  ["tbmlPriceValue", "tbmlGoodsHsMismatch"].forEach((id) => {
    const element = document.querySelector(`#${id}`);
    if (element) element.checked = false;
  });
}

function setUnitOptions(expectedUnits = []) {
  if (!unitInput) return;

  const currentValue = unitInput.value;
  const options = expectedUnits.length ? expectedUnits : allUnitOptions;
  unitInput.innerHTML = [
    '<option value="">Select unit</option>',
    ...options.map((unit) => `<option>${unit}</option>`)
  ].join("");
  unitInput.value = options.includes(currentValue) ? currentValue : "";
}

const countries = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola",
  "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria",
  "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados",
  "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia",
  "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria",
  "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia", "Cameroon",
  "Canada", "Central African Republic", "Chad", "Chile", "China",
  "Colombia", "Comoros", "Costa Rica", "Côte d'Ivoire", "Croatia",
  "Cuba", "Cyprus", "Czechia", "Democratic Republic of the Congo",
  "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador",
  "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia",
  "Eswatini", "Ethiopia", "Fiji", "Finland", "France", "Gabon",
  "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada",
  "Guatemala", "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Honduras",
  "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland",
  "Israel", "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya",
  "Kiribati", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon",
  "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania",
  "Luxembourg", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali",
  "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico",
  "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco",
  "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal", "Netherlands",
  "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea",
  "North Macedonia", "Norway", "Oman", "Pakistan", "Palau", "Panama",
  "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland",
  "Portugal", "Qatar", "Republic of the Congo", "Romania", "Russia",
  "Rwanda", "Saint Kitts and Nevis", "Saint Lucia",
  "Saint Vincent and the Grenadines", "Samoa", "San Marino",
  "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia",
  "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia",
  "Solomon Islands", "Somalia", "South Africa", "South Korea", "South Sudan",
  "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland",
  "Syria", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo",
  "Tonga", "Trinidad and Tobago", "Tunisia", "Türkiye", "Turkmenistan",
  "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom",
  "United States", "Uruguay", "Uzbekistan", "Vanuatu", "Venezuela",
  "Vietnam", "Yemen", "Zambia", "Zimbabwe", "Holy See (Vatican City)",
  "State of Palestine"
];

function cleanCode(value) {
  return String(value || "").replace(/\s/g, "");
}

function populateCountries() {
  ["originCountry", "destinationCountry"].forEach((id) => {
    const select = document.querySelector(`#${id}`);
    if (!select) return;

    const defaultCountry = select.dataset.defaultCountry;
    select.innerHTML = '<option value="">Select country</option>';

    countries.forEach((country) => {
      const option = document.createElement("option");
      option.value = country;
      option.textContent = country;
      select.appendChild(option);
    });

    select.value = defaultCountry || "";
  });
}

async function loadHsCodes() {
  try {
    let response = await fetch("./hs-codes.json");

    if (!response.ok) {
      response = await fetch("./data/hs-codes.json");
    }

    if (!response.ok) {
      throw new Error("HS code file could not be loaded");
    }

    const data = await response.json();
    const items = Array.isArray(data.items) ? data.items : [];

    hsCodeIndex = new Map(
      items.map((item) => [cleanCode(item.hsCode), item])
    );

    hsCodesLoaded = true;
    if (hsCodeInput?.value) verifyHsCode();
  } catch (error) {
    hsCodesLoaded = false;
    console.warn("HS code dataset error:", error);
  }
}

function verifyHsCode() {
  if (!hsCodeInput || !hsCodeDescription) return false;

  const code = cleanCode(hsCodeInput.value);
  const previousVerifiedCode = hsCodeInput.dataset.verifiedCode || "";
  hsCodeInput.dataset.verified = "false";
  hsCodeInput.dataset.expectedUnits = "[]";
  commodityInput.value = "";
  commodityField.hidden = true;
  if (unitProfileNote) unitProfileNote.textContent = "Verify the HS Code to display the expected unit profile.";

  if (!code) {
    hsCodeDescription.textContent = "Required: enter an 8-digit HS Code from the tariff reference.";
    hsCodeDescription.style.color = "";
    return false;
  }

  if (!/^\d{8}$/.test(code)) {
    hsCodeDescription.textContent = "HS Code must contain exactly 8 digits.";
    hsCodeDescription.style.color = "#b42318";
    return false;
  }

  if (!hsCodesLoaded) {
    hsCodeDescription.textContent =
      "HS Code reference is still loading. Please try again.";
    hsCodeDescription.style.color = "#b42318";
    return false;
  }

  const item = hsCodeIndex.get(code);

  if (!item) {
    hsCodeDescription.textContent =
      "HS Code was not found in the available Bangladesh Customs tariff reference.";
    hsCodeDescription.style.color = "#b42318";
    return false;
  }

  const tariffDescription = String(item.tariffDescription || `HS Code ${code}`).trim();
  const unitProfile = getExpectedUnitsForHsCode(code);
  if (previousVerifiedCode && previousVerifiedCode !== code) clearCommoditySensitiveFields();
  setUnitOptions(unitProfile.units);
  commodityInput.value = tariffDescription;
  commodityField.hidden = false;
  hsCodeInput.dataset.verified = "true";
  hsCodeInput.dataset.verifiedCode = code;
  hsCodeInput.dataset.expectedUnits = JSON.stringify(unitProfile.units);
  hsCodeDescription.textContent =
    `Verified — Chapter ${item.chapter}. Product / commodity populated from the tariff description.`;
  hsCodeDescription.style.color = "#167c62";
  if (unitProfileNote) {
    unitProfileNote.textContent = unitProfile.units.length
      ? `Expected unit profile: ${unitProfile.units.join(" or ")}. ${unitProfile.basis}`
      : unitProfile.basis;
    unitProfileNote.style.color = unitProfile.configured ? "#167c62" : "#b56a0c";
  }
  clearFieldError("unitOfMeasure");
  clearFieldError("hsCode");
  return true;
}

riskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const input = collectInput();
  const validation = validateInput(input);

  if (validation.message) {
    showValidationErrors(validation.errors);
    formMessage.textContent = validation.message;
    return;
  }

  clearValidationErrors();
  formMessage.textContent = "";
  const result = calculateRisk(input);
  latestReport = renderReport(result, input);
  copyReportButton.disabled = false;
  document.querySelector("#reportPanel").scrollIntoView({ behavior: "smooth", block: "start" });
});

sampleButton.addEventListener("click", () => {
  hsCodeInput.dataset.verifiedCode = "";
  setSampleValues();
  verifyHsCode();
  clearValidationErrors();
  formMessage.textContent = "Sample case loaded. Press Run Risk Check.";
});

function resetReport() {
  const reportPanel = document.querySelector("#reportPanel");
  const emptyReport = document.querySelector("#emptyReport");
  const reportContent = document.querySelector("#reportContent");
  reportPanel.classList.add("is-empty");
  emptyReport.hidden = false;
  reportContent.hidden = true;
  copyReportButton.disabled = true;
  latestReport = "";
}

resetButton?.addEventListener("click", () => {
  riskForm.reset();
  hsCodeInput.dataset.verified = "false";
  hsCodeInput.dataset.verifiedCode = "";
  hsCodeInput.dataset.expectedUnits = "[]";
  commodityInput.value = "";
  commodityField.hidden = true;
  setUnitOptions();
  unitProfileNote.textContent = "Verify the HS Code to display the expected unit profile.";
  unitProfileNote.style.color = "";
  document.querySelectorAll("#riskForm input[type='checkbox']").forEach((checkbox) => {
    checkbox.checked = false;
  });
  document.querySelectorAll("#riskForm select").forEach((select) => {
    if (["originCountry", "destinationCountry"].includes(select.id)) select.value = "";
  });
  clearValidationErrors();
  formMessage.textContent = "New case started. Previous transaction inputs were cleared.";
  resetReport();
  hsCodeInput.focus();
});

copyReportButton.addEventListener("click", async () => {
  if (!latestReport) return;

  try {
    await navigator.clipboard.writeText(latestReport);
    copyReportButton.textContent = "Copied ✓";
    window.setTimeout(() => {
      copyReportButton.textContent = "Copy summary";
    }, 1800);
  } catch {
    copyReportButton.textContent = "Select report manually";
  }
});

pilotForm.addEventListener("submit", (event) => {
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

  const subject = `TradeGuard pilot request — ${organisation}`;
  const mailto =
    `mailto:regtechnexusai@gmail.com?subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(message)}`;

  pilotMessage.textContent = "A draft email is opening. Review it and press Send.";
  window.location.href = mailto;
});

populateCountries();
loadHsCodes();
lookupHsCode?.addEventListener("click", verifyHsCode);
hsCodeInput?.addEventListener("input", () => {
  clearFieldError("hsCode");
  hsCodeInput.dataset.verified = "false";
  hsCodeInput.dataset.expectedUnits = "[]";
  commodityInput.value = "";
  commodityField.hidden = true;
  setUnitOptions();
  unitProfileNote.textContent = "Verify the HS Code to display the expected unit profile.";
  unitProfileNote.style.color = "";
  if (cleanCode(hsCodeInput.value).length === 8) verifyHsCode();
});
hsCodeInput?.addEventListener("change", verifyHsCode);

riskForm.addEventListener("input", (event) => {
  if (event.target.id !== "hsCode") clearFieldError(event.target.id);
});

riskForm.addEventListener("change", (event) => {
  clearFieldError(event.target.id);
});

document.querySelector("#year").textContent = new Date().getFullYear();
