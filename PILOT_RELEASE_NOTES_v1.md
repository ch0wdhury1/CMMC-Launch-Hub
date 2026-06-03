# CMMC Launch Hub Pilot Release Notes v1

Release Date: 2026-06-03  
Release Status: Pilot Ready  
Hosted URL: https://cmmc-launch-hub.web.app  
Certification Basis: Phase 26D - Pilot Deployment Validation  
Source of Truth: `PILOT_READINESS_CERTIFICATION.md` and `tests/e2e/PILOT_QA_REPORT.md`

## Release Summary

CMMC Launch Hub Pilot Release v1 is approved for controlled pilot use. The hosted application supports implemented organization-scoped CMMC assessment, evidence, and reporting workflows with role-aware access for SuperAdmin, OrgAdmin, Assessor, Contributor, Viewer, and inactive users.

The Phase 26D release completed hosted verification after deployment to Firebase Hosting. No Functions, Firestore rules, Storage rules, credentials, or Firestore data structures were deployed or changed as part of Phase 26D.

## Pilot Readiness Declaration

CMMC Launch Hub is declared **Pilot Ready** for controlled pilot operations.

No application-defect failures remain in the validated pilot-critical workflows. The hosted application passed the required evidence authorization, profile persistence, report identity, and organization isolation checks. Known limitations are documented and do not block the controlled pilot.

## Implemented Functionality Included

| Area | Implemented Capability |
| ---- | ---- |
| Authentication | Login and registration pages load. |
| SuperAdmin | Pending registrations and active, inactive, and archived organization views load. |
| OrgAdmin | Company profile, organization user list, invitations, assessment, evidence, and reporting workflows. |
| Activity Center | SuperAdmin all-organization audit review and OrgAdmin organization-scoped audit review with date, organization, action filters, and CSV export. |
| Role Access | Contributor, Assessor, Viewer, and OrgAdmin receive expected application shell and profile access. |
| Inactive User Handling | Inactive Viewer login is blocked with the Access Disabled screen. |
| Company Profile | OrgAdmin can edit company profile fields and safe personal identity fields. |
| Assessment | Practice navigation, objective status, notes, and assignment persistence. |
| Evidence | Upload, storage confirmation, OCR display, View, Download, Archive, and archived-evidence display. |
| Reporting | Executive Readiness Report and POA&M Report generation or valid empty state with signed-in organization identity. |
| Isolation | Profile, user, assessment marker, evidence marker, and report identity isolation across QA organizations. |

## Pilot-Critical Fixes Included

| Defect | Release Resolution |
| ---- | ---- |
| Viewer evidence upload control exposed | Viewer no longer receives objective or Evidence Library upload, direct file input, archive, unarchive, or other evidence mutation controls. |
| Edit My Info did not persist | Supported safe identity fields persist after save and reload. |
| Executive report organization name missing | Executive report displays the signed-in organization identity. |
| POA&M report organization name missing | POA&M report displays the signed-in organization identity, including the valid empty state. |

## QA Results

| Validation | Result |
| ---- | ---- |
| Full fixed-code Playwright suite | 25 passed, 0 failed, 2 skipped |
| Final hosted targeted validation | 4 passed, 0 failed |
| Production build | Passed |
| Firebase Hosting deployment | Passed |
| `git diff --check` | Passed |

The final hosted targeted validation confirmed:

- Viewer cannot see evidence upload controls.
- Edit My Info persists after reload.
- Executive Report displays the correct organization name.
- POA&M Report displays the correct organization name, including its empty state.

## Deployment Scope

| Firebase Target | Phase 26D Status |
| ---- | ---- |
| Hosting | Deployed |
| Functions | Not deployed |
| Firestore rules | Not deployed |
| Storage rules | Not deployed |

Additional deployment constraints:

- Credentials were unchanged.
- Firestore data structures were unchanged.
- Security rules were not loosened.
- Application behavior was modified only for defects proven by hosted QA evidence.

## Security and Role-Access Results

Validated security outcomes:

- OrgAdmin does not receive SuperAdmin controls.
- OrgAdmin Activity Center access is scoped to the signed-in organization.
- SuperAdmin Activity Center access includes all pilot organization activity.
- Viewer, Contributor, and Assessor do not receive Activity Center access.
- Contributor, Assessor, and Viewer do not receive organization user-management controls on Company Profile.
- Inactive Viewer access is blocked.
- Viewer receives no evidence upload, file input, archive, unarchive, or mutation controls.
- Approved organization context survives localStorage clearing.
- QA Test Company and QA Isolation Company profile, user, assessment, and evidence markers remain isolated.
- Executive report identity remains scoped to the signed-in organization.

Not yet included in the browser suite:

- Direct Firestore authorization-denial tests.
- Direct Storage authorization-denial tests.

## Known Limitations

- OCR can temporarily fail during model high-demand periods. The uploaded evidence file remains available and may still be used as evidence.
- Registration creation remains intentionally disabled in automated testing with `E2E_RUN_REGISTRATION_CREATE=false`.
- Row-specific SuperAdmin approval automation remains intentionally skipped until a disposable pending-registration fixture is available.
- Pilot readiness is not formal CMMC certification, penetration testing, or a production security assessment.

## Support Notes

Use `PILOT_SUPPORT_PLAYBOOK.md` for support intake, troubleshooting, escalation, incident response, and closure criteria.

Common support checks:

- Confirm the user is on `https://cmmc-launch-hub.web.app`.
- Confirm the signed-in organization identity.
- Confirm the expected role and controls.
- Ask users to reload after persistence workflows.
- Require targeted hosted validation after any hosted defect fix.
- Treat cross-organization visibility or unauthorized mutation controls as Critical.

## Operations Notes

Use `PILOT_OPERATIONS_RUNBOOK.md`, `PILOT_ADMIN_CHECKLIST.md`, and `PILOT_ONBOARDING_GUIDE.md` for pilot operations.

Core operating reminders:

- Use the header Save action and wait for Saved after assessment changes.
- Viewer accounts must not see evidence mutation controls.
- Reports must display the signed-in organization identity.
- Use Activity Center for pilot support triage, audit review, and CSV exports.
- OCR failures should be logged with filename, organization, time, and displayed status.
- Do not deploy Functions, Firestore rules, or Storage rules unless an approved change requires those targets.

## Supporting Documents

- `PILOT_READINESS_CERTIFICATION.md`
- `tests/e2e/PILOT_QA_REPORT.md`
- `PILOT_OPERATIONS_RUNBOOK.md`
- `PILOT_ADMIN_CHECKLIST.md`
- `PILOT_ONBOARDING_GUIDE.md`
- `PILOT_SUPPORT_PLAYBOOK.md`
