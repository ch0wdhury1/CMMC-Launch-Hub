# AI Studio → Export → GitHub → Local → Deploy (Rock-Solid Pipeline)

## Purpose
Make it possible to start a new ChatGPT chat with near-zero retraining.

## Workflow Overview
1) Prototype in Google AI Studio
2) Export source
3) Commit to GitHub
4) Pull to local
5) Integrate into Core App Shell (UI-only)
6) Build
7) Deploy

## Rules (Non-Negotiable)
- AI Studio pages are UI modules only.
- No business logic (tiers/usage/auth rules/Gemini calls) inside exported pages.
- All business logic lives in Core App Shell services:
  - auth + org/role resolution
  - entitlements (tiers)
  - usage metering
  - Gemini gateway client
  - Firestore schema + rules
- Keep exports isolated in /src/aistudio/ or /src/pages/aistudio/ to avoid diff noise.

## Repo Structure (Recommended)
- /docs/
- /src/
  - /core/            (Core App Shell services)
    - auth/
    - entitlements/
    - usage/
    - gemini/
    - db/
  - /pages/           (App pages)
  - /aistudio/        (Imported AI Studio UI modules)
- /functions/ or /cloudrun/ (Gemini Gateway)

## Integration Checklist (per new exported page)
- Place page/component in /src/aistudio/<feature>/
- Wrap with:
  - requireAuth()
  - requireOrg()
  - requireEntitlement(featureKey)
- On action:
  - trackUsage(featureKey)
  - callGeminiGateway(payload)
- Ensure Firestore reads/writes are org-scoped.

## Deploy Checklist
- npm run build
- firebase deploy --only "hosting"
- firebase deploy --only "firestore:rules"
