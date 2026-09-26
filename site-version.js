const BUILD_VERSION = "v42";
const BUILD_DATE = "22 September 2026";

document.querySelectorAll("[data-build-version]").forEach((element) => {
  const format = element.dataset.buildFormat || "label";
  const label = element.dataset.buildLabel || "Public build";

  if (format === "footer") {
    element.textContent = `© 2026 RegTech Nexus AI · ${BUILD_VERSION}`;
  } else if (format === "last-updated") {
    element.textContent = `Last updated: ${BUILD_DATE} · public build ${BUILD_VERSION}`;
  } else if (format === "effective-date") {
    element.textContent = `Effective date: ${BUILD_DATE} · public build ${BUILD_VERSION}`;
  } else {
    element.textContent = `${label} · ${BUILD_VERSION} · ${BUILD_DATE}`;
  }
});
