# CMMC Launch Hub — STATE (Single Source of Truth)

## Local Paths
- Repo root: C:\Users\chowd\Sync\AI APPLICATIONS\CMMC LAUNCH PAD\DEPLOYMENT\CMMC-Launch-Hub

## Project
- Name: CMMC Launch Hub
- Deployment lane: Firebase Hosting + Firestore + (Functions/Cloud Run) Gemini Gateway
- Firebase project id: cmmc-launch-hub
- Hosting URL: https://cmmc-launch-hub.web.app

## Repo
- Repo: <paste url>
- Branch: <paste>
- Last commit: <paste>

## Known Good Deployment
- npm run deploy:all ✅ (hosting + firestore:rules only)
- Functions deploy intentionally excluded until Gemini Gateway is implemented

## Local Tooling (Known Good)
- OS: Windows
- Node: 22.22.0 via nvm-windows
- npm: 10.x (current)
- Firebase CLI: 15.4.0

## Entry Points (Current)
- index.html includes: `<script type="module" src="/index.tsx"></script>`
- App entry file: `/index.tsx` (project root)
- NOTE: We are keeping Google AI Studio export structure (importmap/CDNs) for now.

## What Works
- `npm run build` ✅
- Firebase Hosting deploy works (once firebase CLI is available) ✅
- NVM installed and Node 22 active ✅
- Firebase CLI installed via npm global ✅

## Current Decisions
- Keep AI Studio structure now; bundle later.
- Split architecture:
  - Core App Shell = auth/roles/tiers/usage/db/Gemini gateway/rules
  - AI Studio UI Pages = UI modules only

## Current Blockers
- <list current blocker(s)>

## Next Actions (Today)
- <1–5 bullet list>
