# TradeGuard PDF print fix — v37

## Problem identified

This package builds on v35 and fixes the blank Android “Save as PDF” result shown in the print-preview screenshot. Photo 1 contains the report information; photo 2 is the clean, card-based PDF reference.

The styled PDF must be produced with **Print / Save PDF** from the report screen. **Download TXT** remains available as a plain-text copy.

## Fixes

- Added a UTF-8 BOM to both TXT exports so Android viewers recognise UTF-8 punctuation correctly.
- Corrected TBML print isolation so only the TBML report is printed.
- Corrected Transaction Monitoring print isolation so only the Transaction Monitoring report is printed.
- Added a standalone visible print snapshot for both reports. The snapshot is cloned from the populated report only when the user presses Print / Save PDF, so the Android print service cannot capture the hidden report container or empty state.
- Waits for the cloned logo/fonts and two layout frames before calling `window.print()`.
- Retained print CSS overrides for `[hidden]` report containers and empty-state panels as a compatibility fallback.
- Added an export note explaining the difference between the styled PDF and plain TXT copy.
- Updated `report.js` to import `rules.js?v=37`, matching `main.js` and removing stale ES-module cache drift.
- Standardized top navigation and footer links across all pages.
- Added shared `site-version.js` build metadata: v37, 22 September 2026.
- Standardized copyright output and social-share metadata across all six pages.
- Kept the guide labels aligned with the actual Copy summary, Print / Save PDF and Download TXT controls.
- Preserved the styled Print / Save PDF output, logo, case metadata, evidence gate and website disclaimer.
- Bumped asset versions to v37 to prevent stale browser cache files.
- Included the synchronized guide, Transaction Monitoring page, stylesheet and logo.

## Deployment

Upload the package files to the TradeGuard site root. Keep the existing `rules.js`, `hs-codes.json`, `pdf.mjs`, `pdf.worker.mjs` and other supporting files in the root. The TXT export and PDF print fixes apply to both report modules.
