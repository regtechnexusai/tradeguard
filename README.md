# TradeGuard PDF print fix — v36

## Problem identified

This package builds on v35 and fixes the blank Android “Save as PDF” result shown in the print-preview screenshot. Photo 1 contains the report information; photo 2 is the clean, card-based PDF reference.

The styled PDF must be produced with **Print / Save PDF** from the report screen. **Download TXT** remains available as a plain-text copy.

## Fixes

- Added a UTF-8 BOM to both TXT exports so Android viewers recognise UTF-8 punctuation correctly.
- Corrected TBML print isolation so only the TBML report is printed.
- Corrected Transaction Monitoring print isolation so only the Transaction Monitoring report is printed.
- Forced both report containers visible before `window.print()` and added a short print-preview delay so Android captures the rendered report instead of an empty page.
- Added print CSS overrides for `[hidden]` report containers and empty-state panels.
- Added an export note explaining the difference between the styled PDF and plain TXT copy.
- Updated `report.js` to import `rules.js?v=35`, matching `main.js` and removing stale ES-module cache drift.
- Standardized top navigation and footer links across all six pages.
- Added shared `site-version.js` build metadata: v35, 22 September 2026.
- Standardized copyright output and social-share metadata across all six pages.
- Kept the guide labels aligned with the actual Copy summary, Print / Save PDF and Download TXT controls.
- Preserved the styled Print / Save PDF output, logo, case metadata, evidence gate and website disclaimer.
- Bumped asset versions to v36 to prevent stale browser cache files.
- Included the synchronized guide, Transaction Monitoring page, stylesheet and logo.

## Deployment

Upload the package files to the TradeGuard site root. Keep the existing `rules.js`, `hs-codes.json`, `pdf.mjs`, `pdf.worker.mjs` and other supporting files in the root. The TXT export and PDF print fixes apply to both report modules.
