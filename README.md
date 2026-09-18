# TradeGuard by RegTech Nexus AI

A static, low-cost MVP for an explainable trade-finance and TBML risk-review demo.

## What this version does

- Presents the TradeGuard product concept.
- Accepts fictional or anonymised sample transaction inputs.
- Applies transparent rule-based red-flag scoring with raw and capped points.
- Lets a visitor run an indicative risk check with only HS Code, route countries and core counterparty status; detailed fields remain optional.
- Shows an indicative score when supported signals are available, while withholding the decision-ready score when evidence or integrity gates are not met.
- Separates data completeness from data integrity/comparability.
- Withholds price scoring when HS Code, goods description, unit or price inputs cannot be compared reliably; missing optional benchmark metadata is shown as a limitation rather than a form blocker.
- Does not display a misleading 0/100 when no scoreable signal is available.
- Keeps evidence, confidence and rationale as readiness information for manually selected indicators instead of blocking the public demo.
- Maps HS 0206 edible offal to a weight-based unit profile and limits the unit selector to the verified HS profile.
- Provides a “Start new case” reset flow to prevent prior-case carry-over.
- Prepares a pilot request that can be copied into email, Facebook or LinkedIn.
- Shows separate TBML Monitoring and Proactive Monitoring entry points.
- Adds a separate `proactive-monitoring.html` workspace with a functional early-warning demo.
- Uses glossy, raised 3D styling for primary, navigation, utility and workspace buttons.
- Keeps “Human review required” visible as the review principle.
- Adds review-only context controls for jurisdiction risk, PEP/screening, restricted or dual-use goods, payment transparency and source of funds/wealth.
- Keeps control-only findings outside the numeric score; they require evidence and authorised human review.
- Separates FATF/AML-CFT controls from BCBS governance and IFRS 9 credit-risk / expected-credit-loss evidence paths.

This version does **not** upload or store documents, call an AI API, connect to a bank, or make a regulatory determination.

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

1. Google Form or Supabase lead capture.
2. Authentication and saved cases.
3. Secure document upload.
4. Human-reviewed OCR extraction.
5. Evidence-linked PDF case reports.
6. Institution-specific rule calibration, version approval, testing and audit logging.

Do not upload real bank or customer documents to this demo version.
