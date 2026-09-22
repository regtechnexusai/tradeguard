# TradeGuard guide alignment update — v32

Checked against the live TradeGuard build on 22 September 2026.

## Confirmed live capabilities

- Transaction Monitoring accepts up to 5 PDFs, 10 MB per file and 40 MB combined.
- Monitoring windows include 7, 30, 90, 180 and 365 days.
- The Transaction Monitoring report includes Copy summary, Print / Save PDF and Download TXT.

## Changes in this package

- Updated `guide.html` to v32.
- Updated the TBML report guidance to name all available retention actions.
- Added the indicative 0–3, 3–6 and 6–12 month OCR/document-controls roadmap.
- Clarified that risk-type/typology wording is indicative and not a FATF determination.
- Included the synchronized Transaction Monitoring page, module and stylesheet with v32 cache versions.

OCR-based KYC/AOF/loan/credit-document analysis is not implemented in the public build; this update records it as a roadmap item only.

## Deployment

Copy the package files into the TradeGuard site root, preserving the existing PDF worker/module and supporting data files. No server-side service is required for these changes.
