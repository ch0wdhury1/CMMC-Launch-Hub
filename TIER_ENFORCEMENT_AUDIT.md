# Tier Enforcement Audit

Phase 27E audit date: June 5, 2026  
Branch: `codex-migration`  
Deployment: Not deployed during this phase

## Executive Summary

The application uses the signed-in organization tier as the primary entitlement source. `App.tsx` resolves the effective subscription from the organization document first, then the user profile tier, then defaults to `COMM_L1`; inactive subscriptions are reduced to `COMM_L1`. `Sidebar.tsx` applies the visible navigation access matrix, while report and assessment modules receive the effective assessment level from `App.tsx`.

The audit found that normal Level 2 navigation is blocked for `SPONSORED` and `COMM_L1`, and `COMM_L2` receives the full assessment path. Two verified enforcement gaps were fixed:

- Invitation creation and acceptance did not account for pending invitations or current active users before consuming seats.
- System Security Plan PDF export was available to `COMM_L1`, which conflicts with the requirement that L2 SSP exports remain `COMM_L2` only.

No deployment was performed.

## Tier Findings

### SPONSORED

Status: Mostly enforced.

Validated behavior:

- `SPONSORED` is normalized and treated as baseline Level 1 for basic navigation.
- Level 2 domain navigation is locked because `access.nav.l2` is false.
- Sponsored-specific restrictions disable:
  - Template Assist
  - System Security Plan
  - POA&M workspace
  - Readiness Vault
  - Verified Updates
  - Responsibility Matrix

Findings:

- No verified application defect was found in the primary navigation matrix for Sponsored Level 2 access.
- Sponsored user-limit enforcement depends on `maxUsers` being set to 1 at organization approval and on the invitation/member capacity checks fixed in this phase.

### COMM_L1

Status: Improved.

Validated behavior:

- Level 1 assessment access is enabled.
- Level 2 domain navigation is locked because `access.nav.l2` is false.
- Responsibility Matrix, Readiness Vault, POA&M workspace, and Verified Updates are Level 2-only.
- Executive and POA&M reports receive `assessmentLevel="L1"` when the org is not `COMM_L2`.

Verified gap fixed:

- `COMM_L1` could access the System Security Plan PDF export through the SSP page. SSP PDF export is now gated with `canExport={hasL2}`, so export requires an effective `COMM_L2` organization tier. Phase 27E-FIX also hides the export button entirely for unauthorized tiers.

Remaining risk:

- The SSP preview page is still available to `COMM_L1` because the existing navigation matrix allows `reporting.ssp` for L1. This phase only fixed the explicit export gap and did not redesign SSP visibility.

### COMM_L2

Status: Enforced by current matrix.

Validated behavior:

- Level 2 domain navigation is available.
- Full reporting/tool access is available through the sidebar matrix.
- The active assessment id switches to `default_l2`.
- SSP PDF export remains enabled for `COMM_L2`.

No verified defects were found for COMM_L2 access.

## User Limit Enforcement

Status: Fixed in normal application flow; rules-side protection tightened where Firestore can verify cached capacity.

Verified gaps fixed:

- `createOrgInvitation` previously checked only duplicate pending invitations by email. It now checks active members plus pending invitations against `org.maxUsers` before creating a new invitation.
- `acceptOrgInvitation` previously allowed an approved invitation to activate membership without checking org capacity. It now checks active member count against `org.maxUsers` before activating a new member.
- Firestore rules now require cached user capacity for:
  - `orgs/{orgId}/invitations/{invitationId}` create
  - invitation-based `orgs/{orgId}/members/{memberUid}` create/update
  - legacy `orgMembers/{orgId}/members/{memberUid}` create

Pending invitation handling:

- Pending invitations now count against available seats in the app service path.
- Duplicate pending invitations for the same email remain blocked.

Remaining risk:

- Firestore rules cannot count active members or pending invitation documents dynamically. Rules use `org.activeMemberCount` and `org.maxUsers` when present. If `activeMemberCount` is missing or stale, client-side checks provide the normal-path enforcement, but a future backend transaction or Cloud Function should maintain authoritative seat counters.

## Reporting And Export Access

Status: Improved.

Validated behavior:

- Executive Readiness Report uses `assessmentLevel="L1"` for non-`COMM_L2` orgs and `assessmentLevel="L2"` for `COMM_L2`.
- POA&M Report uses the same assessment-level scoping.
- PDF export for Executive and POA&M reports remains role-gated by OrgAdmin/SuperAdmin.

Verified gap fixed:

- SSP PDF export is now tier-gated to `COMM_L2`.

Remaining risks:

- Executive and POA&M export authorization is currently role-gated, not centrally entitlement-gated. Because report level is derived from tier, no L2 report data exposure was verified for `COMM_L1`, but a future entitlement service should enforce report/export policy at the report component boundary.
- Readiness Vault visibility is L2-only in navigation, but direct in-memory view state is not independently guarded. No URL route was found for bypass during this audit.

## AI Feature Enforcement

Status: Partially enforced by navigation; future central enforcement recommended.

Validated behavior:

- Template Assist is disabled for `SPONSORED` and allowed for commercial tiers.
- Verified Updates and Responsibility Matrix are `COMM_L2` only.

Future enforcement gaps:

- Gemini-backed helper functions are not protected by a central entitlement API.
- Objective-level AI guidance, audio generation, readiness analysis, OCR, and training video generation are not consistently tier-gated at the service-call boundary.
- OCR is currently treated as evidence-processing infrastructure rather than a plan-specific AI entitlement.

Recommendation:

- Add a single entitlement policy module for AI features before exposing billing, usage limits, or premium AI bundles.

## Fixes Implemented

Files changed:

- `src/orgInvitations.ts`
  - Added active member and pending invitation capacity checks.
  - Blocks new invitations when active members plus pending invitations meet `maxUsers`.
  - Blocks invitation acceptance for new members when active members meet `maxUsers`.

- `firestore.rules`
  - Added `orgHasCachedUserCapacity`.
  - Applied cached capacity enforcement to invitation creation and invitation-based membership writes.

- `components/SystemSecurityPlan.tsx`
  - Added `canExport` and `exportDisabledReason`.
  - Blocks SSP PDF export when the caller lacks export entitlement.
  - Phase 27E-FIX hides the SSP PDF export button entirely for unauthorized tiers.

- `components/SprsScorecard.tsx`
  - Phase 27E-FIX rebuilt the SPRS PDF export as a scorecard-only document.
  - Summary content is isolated on page 1 and mapped controls begin on a new page.
  - Removed the full CMMC practice/objective dump from the SPRS export.
  - Preserved the `CMMC Launch Hub — SPRS Scorecard` footer with page numbers.

- `services/sspGenerator.ts`
  - Phase 27F rebuilt SSP PDF formatting while preserving the existing COMM_L2 export gate.
  - SSP export behavior remains tier-controlled by `canExport={hasL2}` from `App.tsx`.

- `App.tsx`
  - Passes `canExport={hasL2}` to System Security Plan.

## Validation

Required validation for this phase:

- `npm run build`
- `git diff --check`
- Targeted Playwright validation where applicable

Validation results:

- `npm run build`: Passed. Vite completed production build successfully. Existing large chunk warning remains.
- `git diff --check`: Passed. Git reported line-ending warnings only; no whitespace errors.
- Targeted Playwright: Passed.
  - Command: `npm run test:e2e -- --grep "invitation|report|POA&M|Executive"`
  - Base URL: `https://cmmc-launch-hub.web.app`
  - Result: 5 passed, 0 failed.
  - Covered hosted invitation area, disposable invitation creation, Executive report generation, POA&M report generation/empty state, and Executive report org isolation.
- Phase 27E-FIX local manual validation:
  - Built local preview from current `dist`.
  - Generated `test-results/manual-sprs/SPRS_Scorecard_Current_Assessment.pdf` from the app.
  - PDF inspection found 6 pages, no blank pages, mapped controls present, old CMMC practice/objective dump absent, and footer present on every page.
  - Local QA org did not expose an unauthorized SSP download path. A positive COMM_L2 visual check requires a COMM_L2 fixture/account in the validation environment.
- Phase 27F reporting polish validation:
  - Generated and inspected Executive, POA&M, SPRS, SSP, and SRM PDFs locally.
  - SSP/SRM were validated through the local Vite module graph because the current QA org tier hides those entries in the app.

Validation limitation:

- Hosted Playwright tests ran against the deployed pilot site. Because Phase 27E was not deployed, hosted Playwright validates the current environment and related workflows, but the local SSP export and capacity-rule changes require deployment before hosted end-to-end proof.

## Remaining Risks

- No dedicated hosted fixtures currently prove `SPONSORED`, `COMM_L1`, and `COMM_L2` behavior side-by-side in Playwright.
- Firestore rules rely on cached `activeMemberCount` for capacity enforcement because rules cannot aggregate subcollections.
- AI entitlement enforcement is not centralized.
- Report export entitlement should eventually move from component props to a shared policy service.

## Pilot Readiness Assessment

Phase 27E status: Pilot Ready Candidate after build and targeted validation, with known follow-up work for centralized entitlement policy and authoritative seat counters.
