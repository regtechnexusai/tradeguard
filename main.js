import { calculateRisk } from "./rules.js";
import { collectInput, renderReport, setSampleValues, validateInput } from "./report.js";

const riskForm = document.querySelector("#riskForm");
const sampleButton = document.querySelector("#sampleButton");
const formMessage = document.querySelector("#formMessage");
const copyReportButton = document.querySelector("#copyReportButton");
const pilotForm = document.querySelector("#pilotForm");
const pilotMessage = document.querySelector("#pilotMessage");
const lookupHsCode = document.querySelector("#lookupHsCode");
const hsCodeInput = document.querySelector("#hsCode");
const hsCodeDescription = document.querySelector("#hsCodeDescription");

let latestReport = "";
let hsCodeIndex = new Map();
let hsCodesLoaded = false;

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
  } catch (error) {
    hsCodesLoaded = false;
    console.warn("HS code dataset error:", error);
  }
}

function verifyHsCode() {
  if (!hsCodeInput || !hsCodeDescription) return;

  const code = cleanCode(hsCodeInput.value);

  if (!code) {
    hsCodeDescription.textContent =
      "Optional: enter an 8-digit HS Code to verify it against the tariff reference.";
    hsCodeDescription.style.color = "";
    return;
  }

  if (!/^\d{8}$/.test(code)) {
    hsCodeDescription.textContent = "HS Code must contain exactly 8 digits.";
    hsCodeDescription.style.color = "#b42318";
    return;
  }

  if (!hsCodesLoaded) {
    hsCodeDescription.textContent =
      "HS Code reference is still loading. Please try again.";
    hsCodeDescription.style.color = "#b42318";
    return;
  }

  const item = hsCodeIndex.get(code);

  if (!item) {
    hsCodeDescription.textContent =
      "HS Code was not found in the available Bangladesh Customs tariff reference.";
    hsCodeDescription.style.color = "#b42318";
    return;
  }

  const productText = [
    document.querySelector("#productName")?.value || "",
    document.querySelector("#productDescription")?.value || ""
  ].join(" ").toLowerCase();

  const tariffText = String(item.tariffDescription || "").toLowerCase();
  const stopWords = new Set(["with", "from", "other", "and", "the", "not"]);
  const productWords = productText
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 3 && !stopWords.has(word));
  const possibleMatch = productWords.some((word) => tariffText.includes(word));

  if (possibleMatch) {
    hsCodeDescription.textContent =
      `${item.tariffDescription} — Chapter ${item.chapter}. Possible description match; confirm manually.`;
    hsCodeDescription.style.color = "#167c62";
  } else {
    hsCodeDescription.textContent =
      `${item.tariffDescription} — Chapter ${item.chapter}. Product-description match not established; manual review required.`;
    hsCodeDescription.style.color = "#b56a0c";
  }
}

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
  verifyHsCode();
  formMessage.textContent = "Sample case loaded. Press Analyse sample transaction.";
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

  const subject = "TradeGuard pilot request";
  const mailto =
    `mailto:regtechnexusai@gmail.com?subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(message)}`;

  pilotMessage.textContent = "Opening your email app…";
  window.location.href = mailto;
});

populateCountries();
loadHsCodes();
lookupHsCode?.addEventListener("click", verifyHsCode);
hsCodeInput?.addEventListener("change", verifyHsCode);
document.querySelector("#productName")?.addEventListener("change", () => {
  if (hsCodeInput?.value) verifyHsCode();
});
document.querySelector("#productDescription")?.addEventListener("change", () => {
  if (hsCodeInput?.value) verifyHsCode();
});
document.querySelector("#year").textContent = new Date().getFullYear();
