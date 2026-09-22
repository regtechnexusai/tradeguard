# TradeGuard transaction-monitoring report update

This package updates the legacy `proactive-monitoring.html` report so it uses the same modern report presentation as the TBML report.

## Replace these files

- `proactive-monitoring.html`
- `proactive-monitoring.js`
- `style.css`
- `regtech-nexus-ai-logo.png`

Keep the existing PDF worker files, `pdf.mjs`, `pdf.worker.mjs`, and other data files unchanged.

## Changes

- Replaced the old Case file visual treatment with the TradeGuard / RegTech Nexus AI report header.
- Added modern score, gauge, evidence-supported and unverified-point presentation.
- Added responsive mobile layout matching the TBML report.
- Added the website disclaimer and final-review warning.
- Added `Print / Save PDF` and retained `Download TXT`.
- Added print CSS that hides the form and prints only the transaction-monitoring report.
- Bumped the page assets to cache version `v=31`.
