# TradeGuard — RegTech Nexus AI

TradeGuard is a lightweight, explainable trade-finance and TBML risk-review workspace. The public build uses deterministic browser-side rules and sample data to surface potential price, party, route, transaction-pattern and document-review indicators for human assessment.

## Public workspaces

- **TBML Check:** `https://regtechnexusai.com/tradeguard/`
- **Transaction Monitoring:** `https://regtechnexusai.com/tradeguard/proactive-monitoring.html`
- **Document Assessment:** `https://regtechnexusai.com/tradeguard/document-assessment.html`
- **User guide:** `https://regtechnexusai.com/tradeguard/guide.html`
- **Methodology and limitations:** `https://regtechnexusai.com/tradeguard/methodology.html`

## Implementation boundary

The public workflow runs in the browser and does not make an autonomous compliance decision. It is not a sanctions-screening service, an STR filing system, a regulatory determination, or a substitute for an institution's approved controls. Document extraction and rule flags are preliminary signals; reviewers must verify source documents, currencies, units, parties, dates and applicable requirements.

Use fictional, synthetic or anonymised data only. Do not upload confidential bank statements, customer records, identity documents or other sensitive institutional information to the public demonstration.

## Release consistency

The public release identifier is maintained in `site-version.js`. HTML pages and JavaScript module imports use matching cache keys to reduce stale-browser asset drift. The GitHub Actions quality workflow checks canonical URLs, local relative assets, module imports and release metadata on pull requests and pushes to `main`.

## Deployment

This repository is published through GitHub Pages with the custom domain configured for RegTech Nexus AI. Changes should be made on a feature branch, validated by the quality workflow, and merged through a pull request. Keep the rule engine, scoring weights, thresholds and calculation logic unchanged unless a separately scoped and tested change is approved.
