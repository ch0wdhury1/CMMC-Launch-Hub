# MVP Core App Shell Blueprint (CMMC Launch Hub)

## MVP Goals
- Keep Google AI Studio export structure intact (importmap/CDNs) for UI iteration speed.
- Stabilize backend logic in “Core App Shell” so UI pages remain mostly dumb.
- Enforce org-based tiers: SPONSORED (single-user), COMM_L1 (multi-user), COMM_L2 (multi-user).
- Admin creates orgs + assigns users.
- Firebase Auth password reset enabled (never store passwords in Firestore).
- Deploy loop: `npm run deploy:all` (hosting + firestore rules only). Functions later.

## Architecture Split
### A) AI Studio UI Pages
- Location: `/src/aistudio/**` (recommended) or your existing UI folders
- Role: components/pages only
- Must call Core services for:
  - auth/org bootstrap
  - entitlement checks
  - usage tracking
  - AI calls (future)

### B) Core App Shell (stable services)
Recommended folder: `/src/core/`
- `/core/auth/`        : load current user profile, auth guards
- `/core/org/`         : load org, members, tier
- `/core/entitlements/`: compute locks/unlocks for sidebar + routes
- `/core/usage/`       : daily counters + events (optional)
- `/core/admin/`       : admin-only actions (create org, assign tier, assign user)
- `/core/gemini/`      : client that calls server gateway (future)
- `/core/db/`          : typed Firestore helpers

## Data Model (High Level)
- users/{uid}: identity + orgId + roles
- orgs/{orgId}: tier + limits + metadata
- orgMembers/{orgId}/members/{uid}: membership (for multi-user tiers)
- system/activation: global feature flags (admin-only write)
- usageDaily/{orgId_YYYYMMDD}: counters per feature
- usageEvents/{eventId} (optional): audit trail

## Tier Policy (Org-based)
- SPONSORED:
  - maxUsers = 1 (enforced)
  - L1 pages allowed
  - L2 pages locked
- COMM_L1:
  - multi-user
  - L1 pages allowed
  - L2 pages locked
- COMM_L2:
  - multi-user
  - L1 + L2 pages allowed

## Auth Bootstrap Flow (on app load)
1) Wait for Firebase Auth user
2) Load `users/{uid}`
3) Load `orgs/{orgId}` (if orgId exists)
4) Compute entitlements from org tier
5) Render app; apply sidebar locks and route guards

## Admin MVP Functions
- Create org
- Set org tier
- Assign user to org
- (Optional MVP) Disable user
- View users list + their org + tier

## Enforcement Strategy (must be both)
- UI: sidebar lock icons + disable/redirect routes
- Rules: deny cross-org reads/writes; allow only superAdmin to write tiers/system config

## Gemini Gateway (Phase 2)
- Use Firebase Cloud Functions first
- Add back hosting rewrite: `/api/**` -> function
- Never expose Gemini API key to client
