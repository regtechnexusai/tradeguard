# TradeGuard report export update

This package updates the public TradeGuard report presentation without changing the risk-calculation rules.

## Replace these files

- `index.html`
- `main.js`
- `report.js`
- `style.css`
- `regtech-nexus-ai-logo.png`

Keep the existing `rules.js`, `hs-codes.json`, data files and other website assets unchanged.

## What changed

- Added the RegTech Nexus AI / TradeGuard report header and case metadata.
- Added a `Print / Save PDF` action for browser-based PDF export.
- Kept the plain-text download as `Download TXT`.
- Added the website disclaimer to the rendered and downloaded report.
- Improved price-anomaly wording to identify the upper market range.
- Added cache-busting version `v=30` to the updated stylesheet and modules.
- Added print CSS so the report prints without the input form or surrounding website sections.

After uploading the files, open the site, load a sample case, run the risk check, and select `Print / Save PDF` to save the designed report as PDF.
