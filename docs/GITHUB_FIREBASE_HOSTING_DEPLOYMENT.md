
-----------------------------------------------------
GITHUB DEPLOYMENT:
-----------------------------------------------------
Confirm you’re in the repo root
In PowerShell at:
C:\Users\chowd\Sync\AI APPLICATIONS\CMMC LAUNCH PAD\DEPLOYMENT\CMMC-Launch-Hub

----
Run:
git status
---
Add a .gitignore fix (so this never comes back)
Run this in PowerShell from repo root: 
Run:
Add-Content -Path .gitignore -Value "`n# Firebase local cache`n.firebase/`n"
---
Now stop tracking the already-modified cache file: 
Run:
git rm --cached .firebase/hosting.ZGlzdA.cache
---
Stage ONLY the real files (safe staging)
Run:
git add App.tsx components/PracticeView.tsx components/Sidebar.tsx src/login.tsx .gitignore
---
Now verify staged content:
Run:
git status
---
Commit with a clean message
Run:
git commit -m "Fix L2 practice fields + tier-based sidebar access"
---
Push to GitHub
Run:
git push origin main
---


-----------------------------------------------------
FIREBASE DEPLOYMENT: (Firebase Hosting (production))
-----------------------------------------------------
Build
Run:
npm run build
---
Deploy hosting
Run:
firebase deploy --only hosting
---





