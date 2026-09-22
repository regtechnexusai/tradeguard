# TradeGuard report export fix — v33

## Problem identified

The styled report PDF is valid, but the downloaded TXT file shown in photo 3 is being opened by some Android viewers as legacy ANSI text. UTF-8 punctuation is therefore displayed as mojibake such as `â€“`, `â€™` and `â€¢`.

The attached `TG-20260922133816-828F49-report.txt` is a text export, not a PDF. The styled report PDF must be produced with **Print / Save PDF** from the report screen.

## Fixes

- Added a UTF-8 BOM to the TBML Check TXT export.
- Added the same UTF-8 BOM to the Transaction Monitoring TXT export.
- Preserved the styled Print / Save PDF output, logo, case metadata, evidence gate and website disclaimer.
- Bumped asset versions to v33 to prevent stale browser cache files.
- Included the synchronized guide, Transaction Monitoring page, stylesheet and logo.

## Deployment

Upload the package files to the TradeGuard site root. Keep the existing `rules.js`, `hs-codes.json`, `pdf.mjs`, `pdf.worker.mjs` and other supporting files in the root. The TXT export fix applies to both report modules.
