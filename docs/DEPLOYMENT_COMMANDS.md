# Deployment Commands (Windows / PowerShell)

## Set Node Version
nvm use 22.22.0
node -v
npm -v

## Verify Firebase CLI
firebase --version
# If PowerShell resolution is weird, use:
& "$env:APPDATA\npm\firebase.cmd" --version

## Build
npm install
npm run build

## Deploy Hosting
firebase use
firebase deploy --only "hosting"

## Deploy Firestore Rules
firebase deploy --only "firestore:rules"

## One-command deploy (MVP)
npm run deploy:all
# deploys: hosting + firestore rules (no functions)

