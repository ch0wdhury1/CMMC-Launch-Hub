# CMMC Launch Hub Pilot Operations Runbook

Date: 2026-06-03  
Release Status: Pilot Ready  
Hosted URL: https://cmmc-launch-hub.web.app

## Purpose

This runbook defines the routine operating procedures for the CMMC Launch Hub controlled pilot. It is based on the Phase 26D hosted validation and covers only implemented pilot functionality.

## Operating Roles

| Role | Primary Pilot Responsibilities |
| ---- | ---- |
| SuperAdmin | Review organization requests, monitor organization status, and support organization-level access issues. |
| OrgAdmin | Maintain company profile information, manage organization users and invitations, coordinate assessments, evidence, and reports. |
| Assessor | Participate in assessment and evidence workflows according to organization policy. |
| Contributor | Participate in assessment and evidence workflows according to organization policy. |
| Viewer | Review permitted information without evidence mutation or organization user-management controls. |

## Daily Operations

1. Open the hosted application and confirm the login page loads.
2. Sign in with an approved pilot account.
3. Confirm the expected application shell, role-specific controls, and organization identity are present.
4. Review active pilot issues before making organization or assessment changes.
5. Use the header Save action after assessment changes and wait for the Saved state before navigating away or reloading.
6. Record any unexpected access, persistence, evidence, OCR, or reporting behavior in the pilot support log.

## Pilot Launch Workflows

### Pilot Onboarding Workflow

1. Confirm the organization fits the initial pilot profile: Connecticut manufacturer, supplier, or defense contractor.
2. Confirm the intended tier and whether the organization needs Level 1 or Level 2 workflows.
3. Identify the primary OrgAdmin and initial pilot users.
4. Collect source-of-truth organization profile fields before or during onboarding.
5. Approve or activate the organization through the SuperAdmin workflow.
6. Confirm the OrgAdmin can sign in and sees the correct organization.
7. Open Command Dashboard and review Organization Dashboard.
8. Open Profile and complete Company Profile source-of-truth fields.
9. Invite approved pilot users with least-privileged roles.
10. Walk through one assessment practice, one evidence upload, OCR expectations, and report generation.
11. Record onboarding completion, open questions, and follow-up actions.

### Pilot Support Workflow

1. Capture organization, user, role, page, time, browser, expected result, and actual result.
2. Ask for screenshots or exact displayed messages when available.
3. Classify the issue as access, profile, assessment, evidence/OCR, reporting, dashboard, activity, tiering, or documentation.
4. Check Organization Dashboard, Activity Center, and System Health where the role permits.
5. Reproduce with the least-privileged appropriate test account when practical.
6. Distinguish fixture limitation, user/data issue, documentation issue, and application defect.
7. Provide a workaround only when it does not weaken security or change data structures.
8. Record resolution and whether follow-up validation is required.

### Pilot Escalation Workflow

Escalate immediately when any of the following occur:

- Cross-organization data appears.
- Unauthorized SuperAdmin controls appear.
- Viewer users see evidence upload, archive, unarchive, or mutation controls.
- Report identity shows the wrong organization.
- Evidence is unavailable after successful upload.
- Profile or assessment saves fail repeatedly.
- OCR failures spike across multiple organizations.

Escalation steps:

1. Stop the affected workflow and preserve screenshots, filenames, timestamps, and account details.
2. Do not change credentials, Firestore rules, Storage rules, or data structures as an ad hoc fix.
3. Notify pilot technical support and pilot leadership.
4. Review Activity Center and System Health.
5. Reproduce in a controlled account when safe.
6. Patch only verified defects.
7. Run targeted validation before resuming the workflow.

### Pilot Feedback Collection Process

Collect feedback during onboarding, weekly check-ins, and closeout.

Feedback categories:

- Onboarding clarity.
- Organization Dashboard usefulness.
- Company Profile field clarity.
- Assessment workflow.
- Evidence upload and OCR.
- Report readability.
- Tier/package fit.
- Support responsiveness.

For each feedback item, record:

- Organization.
- Role.
- Workflow.
- Pain point or requested improvement.
- Severity.
- Whether it blocks pilot success.
- Recommended follow-up phase.

## SuperAdmin Procedures

### Review System Health Dashboard

1. Sign in with a SuperAdmin account.
2. Open System Health from System Tools.
3. Review health summary cards for organization, user, pending request, evidence, reporting, and recent activity counts.
4. Review OCR Health for 30-day success, failure, success-rate, and recent failure details.
5. Review Reporting Health for Executive, POA&M, other report counts, last generated report, and most active organization.
6. Review Organization Health by active, inactive, or archived status.
7. Review System Alerts for OCR failure spikes, disabled organizations, high pending counts, and organizations with no activity for more than 30 days.
8. Use View Full Activity Center when an alert or metric requires audit-level review.

The System Health Dashboard is read-only and SuperAdmin-only. It does not send notifications, change access, change tiers, change membership, or change billing.

### Review Activity Center

1. Sign in with a SuperAdmin account.
2. Open Activity Center from System Tools.
3. Review activity across pilot organizations.
4. Use the organization, action, and date filters to narrow the operational history.
5. Export CSV when an audit extract is needed for pilot support or incident review.
6. Treat missing or cross-organization activity visibility as a security concern.

### Review Organization Requests

1. Sign in with a SuperAdmin account.
2. Open the Super Admin area.
3. Review Pending Registrations.
4. Review the active, inactive, and archived organization tabs as needed.
5. Confirm the request identity and intended organization before taking any approval or status action.
6. Record the action in the pilot support log.

Registration creation and row-specific approval are implemented workflows, but their destructive automated tests remain intentionally skipped until disposable fixtures are available. Use additional care during the pilot.

### Support Organization Access

1. Confirm the user belongs to the expected organization.
2. Confirm the organization is active.
3. Confirm the user status and organization membership status are active.
4. Confirm the assigned role is appropriate.
5. For inactive or disabled users, verify that the Access Disabled screen is expected.
6. Escalate any cross-organization visibility concern immediately as a security incident.

## OrgAdmin Procedures

### Use Organization Dashboard

1. Open Command Dashboard after sign-in.
2. Review the organization header for tier, subscription status, CMMC level access, profile completeness, and last activity.
3. Review readiness summary cards for completion, SPRS score, practices assessed, evidence, POA&M, active users, and pending invitations.
4. Review Domain Readiness to identify incomplete or unassessed domains.
5. Use Next Actions for simple operational follow-up such as completing the company profile, reviewing POA&M, inviting team members, uploading evidence, or generating reports.
6. Review Recent Activity for the last organization-scoped activity records.
7. Use Reporting Shortcuts only when the current tier exposes the report.

### Review Organization Activity

1. Open Activity Center from System Tools.
2. Confirm only the signed-in organization activity is visible.
3. Use date and action filters to review relevant activity.
4. Export CSV when an organization-scoped support record is needed.
5. Escalate immediately if another organization appears.

### Account Recovery Support

1. Direct users who forgot a password to the Forgot Password link on the hosted login page.
2. Confirm users enter the email address they use to sign in.
3. Confirm the generic reset message appears.
4. Do not ask users for passwords and do not record passwords in support notes.
5. If the user remains blocked after reset, review account status, organization status, membership status, and role.
6. Distinguish password recovery from access approval: reset emails do not approve pending registrations, reactivate inactive users, change organization membership, or change roles.

### Maintain Company Profile

1. Open Profile.
2. Review Company Information and the displayed organization name.
3. Use Edit to update supported company profile fields.
4. Save the profile and confirm the updated values display.

### Maintain Personal Information

1. Open Profile.
2. Select Edit My Info.
3. Update supported safe identity fields such as name, phone, or title.
4. Save the change.
5. Reload the page and confirm the value persists.

Email, role, status, active state, organization ID, and SuperAdmin status are not self-editable fields.

### Manage Users and Invitations

1. Open Profile.
2. Review Users for the signed-in organization.
3. Confirm no users from another organization are visible.
4. Use the Pending Invitations area to add an approved pilot user.
5. Assign the intended role and confirm the invitation details before submission.
6. Record the invitation in the pilot support log.

## Assessment Procedures

1. Open Command Dashboard.
2. Select the applicable CMMC level.
3. Select a domain and practice.
4. Update objective status, notes, or assignments as required.
5. Use the header Save action.
6. Wait for the Saved state.
7. Reload when practical and confirm critical changes persist.

## Evidence and OCR Procedures

### Upload Evidence

1. Navigate to the target practice or objective.
2. Confirm the signed-in role is permitted to manage evidence.
3. Attach the approved evidence file.
4. Confirm the application reports `Storage: uploaded`.
5. Confirm the evidence record appears.
6. Review the OCR status and OCR Preview when available.

Viewer accounts must not see upload, direct file input, archive, unarchive, or other evidence mutation controls.

### View, Download, and Archive Evidence

1. Use View to inspect the evidence record.
2. Use Download when a local copy is required.
3. Archive evidence only when it should no longer appear as active evidence.
4. Use Show Archived Evidence to confirm the record remains available with Archived status.

### OCR Support

If OCR completes, verify that the OCR Preview is associated with the correct file.

If OCR fails because of temporary model demand:

1. Confirm the file upload still succeeded.
2. Tell the user the file remains available as evidence.
3. Record the filename, organization, time, and displayed OCR status.
4. Avoid duplicate uploads unless the original file is missing or unusable.
5. Escalate repeated or widespread OCR failures to pilot technical support.

## Reporting Procedures

### Executive Readiness Report

1. Expand COMPLIANCE REPORTING.
2. Open Executive Readiness Report.
3. Select Generate Report.
4. Confirm the Readiness Summary appears.
5. Confirm the signed-in organization name is displayed.
6. Confirm no other pilot organization identity is present.
7. Export PDF only when the role permits it.

### POA&M Report

1. Expand COMPLIANCE REPORTING.
2. Open POA&M Report.
3. Select Generate Report when available.
4. Confirm the signed-in organization name is displayed.
5. Review the report or its valid empty state.
6. Export PDF only when the role permits it.

## Audit and Activity Center Procedures

The Activity Center records pilot-critical activity including login, registration approval, invitations, user activation and removal, profile updates, tier requests and decisions, assessment saves, evidence upload and archive actions, and report generation.

Access expectations:

- SuperAdmin can view all activity.
- OrgOwner and OrgAdmin can view only their organization activity.
- Viewer, Contributor, and Assessor do not have Activity Center access.

Operational checks:

1. Review Activity Center during onboarding, support triage, and incident response.
2. Filter by date range, organization when SuperAdmin, and action type.
3. Export CSV for support records when needed.
4. Compare Activity Center entries with user-reported times and workflows.
5. Do not edit or delete audit records.

## Incident Response

### Severity Guidance

| Severity | Examples | Initial Response |
| ---- | ---- | ---- |
| Critical | Cross-organization data visibility, Viewer evidence mutation controls, unauthorized SuperAdmin controls | Stop the affected workflow, preserve evidence, notify pilot leadership immediately. |
| High | Profile or assessment changes do not persist, report identity is incorrect, evidence upload unavailable | Capture evidence, limit further changes, escalate to technical support. |
| Medium | OCR capacity failure, isolated UI issue, invitation workflow issue | Record details, provide workaround, monitor recurrence. |
| Low | Documentation question or minor usability concern | Log and address during routine support review. |

### Incident Handling Steps

1. Record the reporter, organization, role, time, page, and action.
2. Capture screenshots and exact displayed messages.
3. Do not change credentials, rules, or organization data structures as an ad hoc fix.
4. Determine whether the issue is isolated or reproducible.
5. For security or isolation concerns, stop testing with affected accounts until reviewed.
6. Escalate using the Pilot Support Playbook.
7. Document resolution and any required follow-up validation.

## Deployment Operations

The Phase 26D Pilot Ready deployment used Firebase Hosting only.

Before any future pilot deployment:

1. Confirm the approved change scope.
2. Run `npm run build`.
3. Run the required Playwright validation.
4. Deploy only the required Firebase target.
5. Do not deploy Functions, Firestore rules, or Storage rules unless actual approved changes require them.
6. Record the deployment and hosted verification result.

## Known Limitations

- OCR may temporarily fail during model high-demand periods.
- Direct browser-level Firestore and Storage authorization-denial tests are not part of the current suite.
- Registration creation and row-specific approval automated tests remain intentionally skipped until disposable fixtures are available.
- Pilot readiness is not a substitute for formal CMMC certification, penetration testing, or production security assessment.
