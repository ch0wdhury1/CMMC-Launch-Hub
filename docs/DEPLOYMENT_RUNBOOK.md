# Deployment Runbook (AI Studio Structure Preserved)

## Goal
Deploy current MVP to Firebase Hosting and keep Firestore rules aligned.

## Preconditions
- Node 22.22.0 active (nvm)
- Firebase CLI installed and resolvable
- Correct Firebase project selected

## Step-by-step
1) Open PowerShell
   - nvm use 22.22.0
   - node -v

2) Verify firebase CLI
   - firebase --version

3) Install deps + build
   - npm install
   - npm run build

4) Deploy hosting
   - firebase use
   - firebase deploy --only hosting

5) Deploy Firestore rules
   - firebase deploy --only firestore:rules

6) Store a copy in GitHub
git status
git add -A
git commit -m "Version name"
git push

EXAMPLE (Version name): "Sidebar: tier-based access matrix (SPONSORED/COMM_L1/COMM_L2)"

## Troubleshooting
### firebase not recognized
- Verify: cmd /c where firebase
- Verify: & "$env:APPDATA\npm\firebase.cmd" --version
- Ensure User PATH includes: C:\Users\<you>\AppData\Roaming\npm

### node not recognized
- Verify NVM symlink PATH includes: C:\nvm4w\nodejs
- Verify: node -v after restarting PowerShell

### Permissions errors in app
- Deploy firestore rules
- Confirm correct Firebase project (firebase use)
- Verify Auth state + org scoping rules
