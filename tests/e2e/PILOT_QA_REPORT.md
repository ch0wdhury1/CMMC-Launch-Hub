# Pilot QA Report

Date: 2026-06-03
Phase: 26D - Pilot Deployment Validation
Environment: Firebase Hosting hosted pilot QA
Base URL: https://cmmc-launch-hub.web.app
Branch / Baseline Commit: `codex-migration` / `233a424`
Command: `npm run test:e2e -- --grep "Edit My Info|Viewer cannot see objective upload controls|Executive reports remain scoped|POA&M report page generates"`

## Summary

| Result | Count |
| ---- | ----: |
| Passed | 25 |
| Failed | 0 |
| Skipped | 2 |
| Total | 27 |
| Duration | 2.8 minutes |

Recommendation: **Pilot Ready**

The hosted baseline completed with 22 passed, 3 failed, and 2 skipped. The three failures were confirmed application defects, not QA framework failures. The scoped fixes now pass the targeted set and the full fixed-code suite against the live Firebase QA backend.

**Hosted Verification Complete**

The approved Phase 26C bundle was deployed to Firebase Hosting only. The first hosted target run passed Viewer evidence controls, Edit My Info persistence, and Executive report identity, and exposed that the POA&M empty state did not render its already-loaded organization identity. That scoped report-display correction was rebuilt and redeployed to Hosting only. The final hosted target run passed all four requested validations.

## Defect Fix Validation

| Defect | Fix | Targeted Result | Full Fixed-Code Result |
| ---- | ---- | ---- | ---- |
| Viewer evidence upload control exposed | Objective and Evidence Library upload, direct file input, archive, and unarchive controls are gated by evidence-management permission. Viewer receives no file input or evidence mutation control in the DOM. | PASS | PASS |
| Edit My Info does not persist | Safe identity fields are written atomically to `users/{uid}` and `orgs/{orgId}/members/{uid}`, confirmed by server reads, and the app no longer reloads organization access when non-access profile fields change. | PASS | PASS |
| Reports missing organization name | Executive and POA&M report identity use the signed-in organization with the required company-profile, top-level name, display-name, and org ID fallback order. | PASS | PASS |

Validation results:

- Before hosted result: 22 passed, 3 failed, 2 skipped.
- Targeted fixed-code result: 3 passed, 0 failed.
- Full fixed-code result: 25 passed, 0 failed, 2 skipped.
- Final hosted targeted result: 4 passed, 0 failed.
- Production build: passed.
- Firebase Hosting deployment: passed.
- `git diff --check`: passed.
- Functions build: not required; no Functions code changed.
- Security rules: unchanged and not loosened.

## Artifacts

| Artifact | Location | Result |
| ---- | ---- | ---- |
| HTML report | `playwright-report/index.html` | Generated |
| JUnit XML | `test-results/junit.xml` | Generated |
| Failure screenshots | `test-results/**/test-failed-1.png` | 3 generated |
| Failure traces | `test-results/**/trace.zip` | 3 generated |
| Failure videos | `test-results/**/video.webm` | 3 generated |
| Error contexts | `test-results/**/error-context.md` | 3 generated |
| Production build | `npm run build` | Passed |
| Console / network failures | Retained failure traces | No error-level console, page-error, or permission-denied events; aborted requests appear in the profile failure trace during reload |

## Passed Tests

| Area | Passed Validation |
| ---- | ---- |
| Authentication | Login page and registration page load. |
| SuperAdmin | Pending registrations load; active, inactive, and archived organization tabs load. |
| Role Access | Contributor, Assessor, Viewer, and OrgAdmin receive the expected app shell and profile access. |
| Inactive User | Viewer status can be changed to inactive, login is blocked, and the fixture restores the account to active. |
| Company Profile | OrgAdmin can open company profile editing. |
| Invitations | Invitation area loads and a disposable Viewer invitation can be created. |
| Assessment | Stable practice `AC.L1-3.1.1` loads. |
| Assessment Persistence | Objective status, practice note, objective note, and assignment persist after explicit assessment save and reload. |
| Evidence | Upload, storage confirmation, OCR display, View, Download, Archive, and archived-evidence display pass. |
| Reporting | Executive Readiness Report and POA&M Report pages generate or show their valid state. |
| Security | OrgAdmin does not receive SuperAdmin controls; approved org context survives localStorage clearing. |
| Cross-Org Isolation | Profile, user, assessment-note marker, and evidence marker isolation pass across both QA organizations. |
| Pilot Simulation | Non-destructive pilot candidate smoke passes. |

## Baseline Failed Tests

| Area | Test | Classification | Finding |
| ---- | ---- | ---- | ---- |
| Company Profile | Edit My Info saves a safe identity field | Resolved in fixed code | The full user profile object triggered an organization-access reload during the write, tearing down the save flow before persistence completed. |
| Evidence Security | Viewer cannot see objective upload controls | Resolved in fixed code | The hosted Viewer objective contains one direct `input[type="file"]`; the fixed code gates all evidence mutation controls. |
| Report Isolation | Executive reports remain scoped to the signed-in organization | Resolved in fixed code | The hosted report renders `Organization name not provided`; the fixed code resolves identity from the signed-in organization record. |

## Skipped Tests

| Area | Test | Reason |
| ---- | ---- | ---- |
| Registration | Registration submits a pending user without app-shell access | `E2E_RUN_REGISTRATION_CREATE=false`; creation remains intentionally disabled. |
| SuperAdmin Approval | Approve a QA registration | No known disposable pending registration was selected for row-specific approval. |

## QA Framework Findings

| Result | Finding |
| ---- | ---- |
| RESOLVED | Ambiguous text locators were replaced with role-based, exact-match, and scoped locators. |
| RESOLVED | Assessment navigation now follows `Command Dashboard`, CMMC Level 1, domain, and stable practice controls. |
| RESOLVED | Report navigation now expands the `COMPLIANCE REPORTING` accordion before selecting a report. |
| RESOLVED | Hosted mutation tests use one worker because they share disposable QA organizations. |
| RESOLVED | Assessment tests explicitly use the header Save/Saved state before reload. |
| RESOLVED | The inactive-user fixture signs out blocked sessions and restores the Viewer account in `finally`. |
| OBSERVATION | A prior hosted run uploaded evidence successfully but received `OCR: failed` with a temporary model high-demand message. The final hosted run completed OCR successfully. |

## Security And Role-Access Findings

| Result | Finding |
| ---- | ---- |
| PASS | OrgAdmin does not receive SuperAdmin controls. |
| PASS | Contributor, Assessor, and Viewer do not receive organization user-management controls on Company Profile. |
| PASS | Inactive Viewer login is blocked with the Access Disabled screen. |
| PASS IN FIXED CODE | Viewer receives no objective or Evidence Library upload, file input, archive, or unarchive control. |
| NOT VALIDATED | Direct Firestore and Storage authorization-denial tests are not part of this browser suite. |

## Evidence Upload Findings

| Result | Finding |
| ---- | ---- |
| PASS | OrgAdmin evidence upload reaches `Storage: uploaded`. |
| PASS | OCR completion and OCR Preview display passed in the final run. |
| PASS | View and Download actions passed. |
| PASS | Archive removes the active artifact and Show Archived Evidence reveals it with Archived status. |
| PASS IN FIXED CODE | Viewer cannot see a direct upload input or evidence mutation control. |
| OBSERVATION | OCR can fail temporarily under model high demand; the UI preserves the uploaded file and explains that it may still be used as evidence. |

## Reporting Findings

| Result | Finding |
| ---- | ---- |
| PASS | Executive Readiness Report generation completes. |
| PASS | POA&M Report generation or valid empty state completes. |
| PASS IN FIXED CODE | Executive report displays the signed-in organization identity. |
| PASS IN FIXED CODE | POA&M report uses the same signed-in organization identity fallback. |

## Cross-Org Isolation Findings

| Boundary | Result | Finding |
| ---- | ---- | ---- |
| Profile | PASS | Each OrgAdmin sees only its own organization profile identity. |
| Users | PASS | Each OrgAdmin sees only its own organization user list and not the other admin email. |
| Assessment | PASS | A unique QA Test Company objective-note marker is absent in QA Isolation Company. |
| Evidence | PASS | A unique QA Test Company evidence filename is absent in QA Isolation Company. |
| Reports | PASS IN FIXED CODE | Executive report identity remains scoped to the signed-in organization. |

## Pilot Blockers

| Severity | Area | Blocker |
| ---- | ---- | ---- |
| MEDIUM | OCR Reliability | Temporary model high-demand failures were observed in an earlier hosted run. |
| MEDIUM | Registration / Approval | Registration creation and row-specific approval remain intentionally unvalidated. |

## Recommended Follow-Up

1. Monitor OCR failure rates and retain the existing temporary-capacity guidance.
2. Preserve the two intentionally skipped destructive-registration tests until disposable fixtures are available.

## Change Safety

- Firebase Hosting only was deployed.
- Functions, Firestore rules, and Storage rules were not deployed.
- No credentials were changed.
- No security rules were loosened.
- No Firestore data structures were changed.
- Application behavior was modified only for defects proven by hosted QA evidence.
