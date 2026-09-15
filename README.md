# TradeGuard by RegTech Nexus AI

A static, low-cost MVP for an explainable trade-finance and TBML risk-review demo.

## What this version does

- Presents the TradeGuard product concept.
- Accepts fictional or anonymised sample transaction inputs.
- Applies transparent rule-based red-flag scoring.
- Shows a risk band and reviewer-oriented next step.
- Separates data completeness from data integrity/comparability.
- Withholds price scoring when HS Code, goods description, unit or benchmark metadata cannot be compared reliably.
- Requires evidence and rationale for manually selected indicators and business context for route concerns.
- Provides a “Start new case” reset flow to prevent prior-case carry-over.
- Prepares a pilot request that can be copied into email, Facebook or LinkedIn.

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

Do not upload real bank or customer documents to this demo version.
