# CMMC Launch Hub Pilot Support Playbook

Date: 2026-06-03  
Release Status: Pilot Ready  
Hosted URL: https://cmmc-launch-hub.web.app  
Source of Truth: `PILOT_READINESS_CERTIFICATION.md`, `tests/e2e/PILOT_QA_REPORT.md`, `PILOT_OPERATIONS_RUNBOOK.md`, `PILOT_ADMIN_CHECKLIST.md`, `PILOT_ONBOARDING_GUIDE.md`

## Purpose

This playbook defines support intake, troubleshooting, escalation, and closure workflows for the CMMC Launch Hub controlled pilot. It reflects implemented functionality only.

## Support Roles

| Support Role | Responsibility |
| ---- | ---- |
| Pilot Support Intake | Receives issues, records details, confirms severity, and provides first-response guidance. |
| Pilot Coordinator | Owns pilot communications, participant coordination, and business-priority decisions. |
| Technical Owner | Investigates application defects, deployment issues, data persistence issues, and failed validations. |
| Security Reviewer | Reviews suspected authorization, role-access, and cross-organization isolation issues. |
| SuperAdmin Operator | Reviews organization requests, organization status, and organization-level access state. |
| OrgAdmin Contact | Confirms organization-level user, invitation, assessment, evidence, and report context. |

## Intake Requirements

For every support request, collect:

- Reporter name and contact.
- Organization name.
- User email and role.
- Date and time observed.
- Page or workflow.
- Exact action taken.
- Expected result.
- Actual result.
- Screenshot or copied error text when available.
- File name for evidence or OCR issues.
- Report name for reporting issues.
- Whether the behavior persists after reload.
- Whether another approved account can reproduce the issue.

Do not request passwords. Do not ask users to share credentials.

## Severity Matrix

| Severity | Criteria | Initial Response | Escalation |
| ---- | ---- | ---- | ---- |
| Critical | Cross-organization data visibility, unauthorized SuperAdmin controls, Viewer evidence mutation controls, suspected privilege escalation, or broad hosted outage | Stop the affected workflow, preserve evidence, notify leadership immediately | Pilot Coordinator, Technical Owner, Security Reviewer |
| High | Pilot-critical workflow blocked, profile or assessment persistence failure, evidence upload unavailable, report identity incorrect | Capture reproduction details and limit repeated mutation attempts | Technical Owner and Pilot Coordinator |
| Medium | OCR temporary failure, isolated invitation issue, role-specific UI question, report empty-state concern with no data exposure | Provide workaround or monitoring guidance | Pilot Support Intake, then Technical Owner if repeated |
| Low | Documentation question, training issue, minor usability concern | Answer or route to onboarding material | Pilot Support Intake |

## Escalation Paths

1. Security or isolation issue: Pilot Support Intake -> Pilot Coordinator -> Security Reviewer and Technical Owner.
2. Hosted deployment issue: Pilot Support Intake -> Technical Owner -> Pilot Coordinator.
3. SuperAdmin or organization status issue: Pilot Support Intake -> SuperAdmin Operator -> Pilot Coordinator if unresolved.
4. OrgAdmin user, invitation, or organization profile issue: Pilot Support Intake -> OrgAdmin Contact -> Technical Owner if persistence or access behavior is incorrect.
5. Evidence or OCR issue: Pilot Support Intake -> OrgAdmin Contact -> Technical Owner if upload, view, download, archive, or OCR association fails.
6. Reporting issue: Pilot Support Intake -> OrgAdmin Contact -> Technical Owner if organization identity, generation, empty state, or export behavior is incorrect.
7. Audit or Activity Center issue: Pilot Support Intake -> Security Reviewer and Technical Owner if activity visibility crosses organization boundaries or unauthorized roles can access audit data.

## General Troubleshooting Workflow

1. Confirm the user is on `https://cmmc-launch-hub.web.app`.
2. Confirm the signed-in organization identity.
3. Confirm the user role and expected permissions.
4. Ask what page and control were used.
5. Confirm whether the user saved when the workflow requires it.
6. Ask whether reload changes the result.
7. Compare the behavior to the implemented pilot workflows below.
8. Escalate if the result suggests a defect, unauthorized access, cross-organization visibility, or data persistence failure.

## Access Troubleshooting

### User Cannot Access the App

1. Confirm the user has an approved pilot account or invitation.
2. Confirm the user is using the hosted URL.
3. Confirm whether the Access Disabled screen appears.
4. If Access Disabled appears, ask the SuperAdmin Operator or OrgAdmin Contact to confirm status and membership state.
5. If the user sees another organization, treat as Critical.
6. If the expected organization is unavailable, escalate to the Technical Owner.

### Forgot Password / Password Reset

1. Ask the user to open the hosted login page.
2. Select Forgot Password.
3. Enter the email address used to sign in.
4. Select Send Password Reset Link.
5. Confirm the generic message appears: "If an account exists for this email, a password reset link has been sent."
6. Remind the user to check inbox, spam, and any email filtering system.
7. If the user still cannot access the app after resetting their password, verify account, organization, membership, and role status.

Do not ask for or record passwords. Do not tell the user whether an email exists in Firebase Auth.

### Pending or Inactive Account Distinction

- Pending message: "Your registration is pending approval."
- Inactive or disabled message: "Your account is inactive or disabled. Contact your organization administrator."
- Password reset does not approve a pending registration.
- Password reset does not reactivate an inactive or disabled user.
- Password reset does not change organization membership or role.

### Unexpected Controls

1. Record the user role and visible controls.
2. Confirm OrgAdmin does not see SuperAdmin controls.
3. Confirm Contributor, Assessor, and Viewer do not see organization user-management controls.
4. Confirm Viewer does not see evidence upload, direct file input, archive, unarchive, or mutation controls.
5. Escalate unauthorized controls as Critical.

## SuperAdmin Support Workflow

Use this workflow for organization requests and organization-level access support.

1. Sign in with a SuperAdmin account.
2. Open the Super Admin area.
3. Review Pending Registrations.
4. Review active, inactive, and archived organization tabs.
5. Confirm the request or organization identity before taking action.
6. Confirm user and organization membership alignment.
7. Record the action and reason in the pilot support log.

Registration creation and row-specific approval are implemented operational workflows, but destructive automated coverage remains intentionally skipped until disposable fixtures are available. Use extra care and manual verification.

## System Health Dashboard Troubleshooting

Use this workflow for pilot monitoring, metric review, and operational alerts.

1. Sign in with a SuperAdmin account.
2. Open System Tools, then System Health.
3. Confirm health summary cards render.
4. Review OCR Health when evidence processing issues are reported.
5. Review Reporting Health when report generation or report identity issues are reported.
6. Review Organization Health and apply active, inactive, or archived filters.
7. Review System Alerts for OCR failure spikes, disabled organizations, high pending registrations, high pending invitations, and organizations with no activity for more than 30 days.
8. Use View Full Activity Center to inspect the underlying audit entries.

Access expectations:

- SuperAdmin can access System Health.
- OrgAdmin, Viewer, Contributor, and Assessor cannot access System Health.
- The dashboard is read-only and does not send notifications or mutate pilot data.

Escalate if System Health shows another role can access the page, if metrics indicate cross-organization visibility outside SuperAdmin use, or if critical alerts line up with user-reported incidents.

## OrgAdmin Support Workflow

Use this workflow for organization user, invitation, company profile, assessment, evidence, and report support.

1. Ask the OrgAdmin to open Profile.
2. Confirm the displayed organization name is correct.
3. Confirm Users for the organization does not include users from another organization.
4. Confirm pending invitations are intended.
5. Confirm company profile values are current.
6. For personal profile issues, use Edit My Info and reload to verify persistence.
7. For assessment, evidence, or reporting issues, follow the workflow-specific sections below.

## Audit and Activity Center Troubleshooting

1. Confirm the user role.
2. Confirm SuperAdmin can open Activity Center and use date, organization, and action filters.
3. Confirm OrgAdmin can open Activity Center and sees only the signed-in organization.
4. Confirm Viewer, Contributor, and Assessor do not have Activity Center access.
5. Confirm CSV export contains only the currently filtered visible rows.
6. For a reported workflow, compare the user-reported time with matching activity records.

Escalate immediately if an OrgAdmin sees another organization, if a restricted role can access audit data, or if audit export includes activity outside the permitted scope.

## Profile Troubleshooting

### Edit My Info

1. Open Profile.
2. Select Edit My Info.
3. Update supported safe fields: name, phone, or title.
4. Save the change.
5. Reload the page.
6. Confirm the value remains visible.

Unsupported self-edit fields include email, role, status, active state, organization ID, and SuperAdmin status. Escalate if supported safe fields do not persist after reload.

## Assessment Troubleshooting

1. Navigate through Command Dashboard.
2. Select the correct CMMC level, domain, and practice.
3. Confirm the intended objective is visible.
4. Make the permitted status, note, or assignment change.
5. Use the header Save action.
6. Wait for the Saved state.
7. Reload and confirm persistence.

Escalate if saved objective status, note, or assignment values do not persist.

## Evidence and OCR Troubleshooting

### Upload, View, Download, and Archive

1. Confirm the role is permitted to manage evidence.
2. Confirm the evidence is attached to the intended practice or objective.
3. Confirm `Storage: uploaded` appears.
4. Confirm the evidence record appears.
5. Use View to inspect the evidence.
6. Use Download if a local copy is required.
7. Archive only when the evidence should leave the active list.
8. Use Show Archived Evidence to confirm archived status.

Escalate immediately if evidence appears under the wrong organization, if a Viewer sees mutation controls, or if uploaded evidence is unavailable.

### OCR

If OCR completes:

1. Confirm OCR Preview appears.
2. Confirm the preview belongs to the intended evidence file.

If OCR fails:

1. Confirm the evidence file uploaded successfully.
2. Record the filename, organization, time, and displayed OCR status.
3. Tell the user the uploaded file remains available as evidence.
4. Avoid duplicate uploads unless the original file is missing or unusable.
5. Escalate repeated or widespread OCR failures to the Technical Owner.

Known limitation: OCR can temporarily fail during model high-demand periods.

## Reporting Troubleshooting

### Executive Readiness Report

1. Expand COMPLIANCE REPORTING.
2. Open Executive Readiness Report.
3. Select Generate Report.
4. Confirm Readiness Summary appears.
5. Confirm the signed-in organization name appears.
6. Confirm no other organization identity appears.

### POA&M Report

1. Expand COMPLIANCE REPORTING.
2. Open POA&M Report.
3. Select Generate Report when available.
4. Confirm the signed-in organization name appears.
5. Review the report or its valid empty state.

Escalate missing organization identity, incorrect organization identity, cross-organization identity, or report generation failure.

## Security Incident Procedure

Use this procedure for suspected cross-organization data exposure, unauthorized controls, unauthorized evidence mutation, or privilege escalation.

1. Stop the affected workflow.
2. Preserve screenshots, account role, organization name, page, time, and reproduction steps.
3. Do not change credentials, Firestore rules, Storage rules, Functions, or data structures as an ad hoc fix.
4. Notify the Pilot Coordinator, Security Reviewer, and Technical Owner.
5. Determine whether other accounts or organizations may be affected.
6. Suspend affected pilot activity if continued use could expose or mutate data.
7. Require targeted hosted validation before closure.

## Deployment Incident Procedure

1. Confirm whether the issue began after a deployment.
2. Record the hosted URL, deployment time if known, and affected workflow.
3. Confirm the deployed scope.
4. Phase 26D deployed Firebase Hosting only; Functions, Firestore rules, and Storage rules were not deployed.
5. Run targeted tests for the affected workflow.
6. Do not deploy additional Firebase targets unless actual approved changes require them.
7. Record validation results before closure.

## Closure Criteria

Close a support issue only when:

- The outcome is explained or corrected.
- The user has a verified path forward.
- Any data persistence issue has been rechecked after reload.
- Any hosted fix has targeted validation evidence.
- Any security or isolation issue has Security Reviewer approval.
- The support log records the resolution, owner, and follow-up.

## Known Pilot Limitations

- OCR can temporarily fail during model high-demand periods.
- Direct browser-level Firestore and Storage authorization-denial tests are not yet included.
- Registration creation and row-specific SuperAdmin approval automated tests remain intentionally skipped until disposable fixtures are available.
- Pilot readiness is not formal CMMC certification, penetration testing, or a production security assessment.
