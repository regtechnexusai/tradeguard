# TradeGuard by RegTech Nexus AI

A static, low-cost public MVP (v29) for an explainable, rule-based trade-finance and TBML risk-review workspace.

## What this version does

- Presents the TradeGuard product concept through two separate workspaces: TBML Check and Transaction Monitoring.
- Accepts fictional or anonymised sample transaction inputs.
- Applies transparent rule-based red-flag scoring with raw and capped points; the public preview arithmetic reconciles visibly.
- Lets a visitor run an indicative risk check with only HS Code, route countries and core counterparty status; detailed fields remain optional.
- Shows an indicative score when supported signals are available, while withholding the decision-ready score when evidence or integrity gates are not met.
- Separates data completeness from data integrity/comparability.
- Withholds price scoring when HS Code, goods description, unit or price inputs cannot be compared reliably; missing optional benchmark metadata is shown as a limitation rather than a form blocker.
- Does not display a misleading 0/100 when no scoreable signal is available.
- Keeps evidence, confidence and rationale as readiness information for manually selected indicators instead of blocking the public assessment.
- Maps HS 0206 edible offal to a weight-based unit profile and limits the unit selector to the verified HS profile.
- Provides a “Start new case” reset flow to prevent prior-case carry-over.
- Provides a separate `proactive-monitoring.html` Transaction Monitoring workspace with a functional early-warning review.
- Accepts a transaction-statement PDF up to 10 MB for browser-local text extraction using the pinned self-hosted PDF.js 6.3.289 build at repository root for simple GitHub mobile upload.
- Accepts up to five PDF files together, with a 40 MB combined limit, for local aggregation of selectable transaction text.
- Provides 7, 30, 90, 180 and 365-day monitoring windows, visible risk-type labels, a simple user guide and downloadable text reports.
- Supports two PDF paths: full-statement mode for available context pre-fill, and transaction-history-only mode for anonymised transaction rows plus manually supplied context.
- Requires an acknowledgement that the file is fictional, synthetic or anonymised; warns on account/email/identity-like text, clears the browser file input and temporary extracted text after analysis, and has no upload endpoint or case database.
- Shows a clear privacy and PDF-handling notice, plus a methodology and limitations page.
- States clearly that OCR for scanned/image-only PDFs and structured AOF/KYC, trade-document and credit-document analysis are institutional roadmap items, not public-demo capabilities.
- Includes an About and security-boundary page that separates public-demo capability from institutional deployment requirements.
- Publishes the supplied RegTech Nexus AI / Travel To Know publisher relationship, office and phone details without inventing an unprovided registered entity number.
- Prepares a pilot request in a pre-filled email draft. A configured mail client is required for the mailto action; a direct email fallback and publisher phone are shown.
- Uses glossy, raised 3D styling for primary, navigation, utility and workspace buttons.
- Keeps “Human review required” visible as the review principle.
- Adds review-only context controls for jurisdiction risk, PEP/screening, restricted or dual-use goods, payment transparency and source of funds/wealth.
- Keeps control-only findings outside the numeric score; they require evidence and authorised human review.
- Accepts a 6–10 digit HS-code format; six-digit harmonised inputs and country-specific 8/10-digit extensions remain subject to exact tariff-reference verification.
- Separates FATF/AML-CFT controls from BCBS governance and IFRS 9 credit-risk / expected-credit-loss evidence paths.

This public version does **not** upload or store documents on a TradeGuard server, call an AI API, connect to a bank, provide live sanctions/PEP screening, save cases, or make a regulatory determination. It uses deterministic browser-side rules and is not audit-grade or institutionally certified.

Read [`privacy.html`](./privacy.html) for PDF handling and public-demo privacy limitations. Read [`methodology.html`](./methodology.html) for indicator weights, score bands, price-deviation logic, evidence gating, reference families, data boundaries and production-readiness limits.

## Run locally

No database or build step is required.

### Option 1: VS Code Live Server

1. Open this folder in VS Code.
2. Install the **Live Server** extension.
3. Right-click `index.html` and choose **Open with Live Server**.

### Option 2: Python local server

```bash
python3 -m http.server 5500
```

Then open `http://localhost:5500`.

## Publish through GitHub and Cloudflare Pages

1. Create a GitHub repository.
2. Upload all files in this folder.
3. In Cloudflare: **Workers & Pages → Create application → Pages → Connect to Git**.
4. Select the GitHub repository.
5. For a static site, leave the build command empty and use `.` as the output directory, or use the repository root as the publish directory.
6. Deploy.

## Next development stage

After user validation, add:

1. A hosted lead-capture form with a privacy notice and consent record.
2. Authentication, role-based access and saved cases.
3. Secure server-side document processing or an approved on-premise deployment model.
4. Human-reviewed OCR and structured transaction extraction.
5. Evidence-linked case reports and server-side audit logging.
6. Live sanctions, PEP, adverse-media and restricted-goods integrations subject to approved data contracts.
7. Institution-specific rule calibration, version approval, testing, monitoring and independent security review.

Do not upload real bank or customer documents to this public version.
