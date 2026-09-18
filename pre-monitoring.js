const registryList = document.querySelector("#registryList");
const registryCategory = document.querySelector("#registryCategory");
const registrySummary = document.querySelector("#registrySummary");
const registryTotal = document.querySelector("#registryTotal");
const registryConfigured = document.querySelector("#registryConfigured");
const registryMapped = document.querySelector("#registryMapped");

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const statusClass = (status) => status.startsWith("Configured") ? "registry-status-configured" : "registry-status-mapped";

let registry = null;

function renderRegistry() {
  if (!registry || !registryList) return;

  const selectedCategory = registryCategory?.value || "all";
  const filtered = selectedCategory === "all"
    ? registry.rules
    : registry.rules.filter((rule) => rule.category === selectedCategory);
  const displayLimit = selectedCategory === "all" ? 12 : 30;
  const visible = filtered.slice(0, displayLimit);
  const remaining = Math.max(filtered.length - visible.length, 0);

  if (registrySummary) {
    registrySummary.textContent = selectedCategory === "all"
      ? `Showing ${visible.length} of ${filtered.length} rules across four sheets. Use the sheet filter to inspect a larger section.`
      : `Showing ${visible.length} of ${filtered.length} rules from ${selectedCategory}.${remaining ? ` ${remaining} more remain in the workbook register.` : ""}`;
  }

  registryList.innerHTML = visible.map((rule) => `
    <article class="registry-card">
      <div class="registry-card-top">
        <div>
          <span class="registry-id">${escapeHtml(rule.ruleId)}</span>
          <strong>${escapeHtml(rule.sourceIndicator)}</strong>
        </div>
        <span class="registry-tag ${statusClass(rule.status)}">${escapeHtml(rule.status)}</span>
      </div>
      <p>${escapeHtml(rule.normalizedDefinition)}</p>
      <div class="registry-meta">
        <span><b>Mapping</b> ${escapeHtml(rule.standardsMapping)}</span>
        <span><b>Data</b> ${escapeHtml(rule.requiredData)}</span>
      </div>
    </article>
  `).join("");

  if (remaining) {
    registryList.insertAdjacentHTML("beforeend", `<div class="registry-more">${remaining} additional mapped rule${remaining === 1 ? "" : "s"} are available in the downloadable rule register.</div>`);
  }
}

async function loadRegistry() {
  try {
    const response = await fetch("./rule-registry.json?v=12");
    if (!response.ok) throw new Error("Rule register could not be loaded");
    registry = await response.json();
    registryTotal.textContent = registry.counts.total;
    registryConfigured.textContent = registry.counts.sourceLogicPresent;
    registryMapped.textContent = registry.counts.standardsMapped;
    renderRegistry();
  } catch (error) {
    if (registrySummary) registrySummary.textContent = "The rule register is unavailable in this preview. The standards-mapped workbook remains the source of truth.";
    console.warn("Pre-monitoring register error:", error);
  }
}

registryCategory?.addEventListener("change", renderRegistry);
loadRegistry();
