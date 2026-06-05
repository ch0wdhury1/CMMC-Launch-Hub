# CMMC Launch Hub Pilot Onboarding Guide

Date: 2026-06-03  
Hosted URL: https://cmmc-launch-hub.web.app

## Welcome

CMMC Launch Hub supports organization-scoped CMMC assessment, evidence, and reporting workflows for the controlled pilot. This guide explains the implemented workflows participants should use during onboarding.

## Before You Begin

You need:

- An approved pilot account or invitation.
- The correct organization assignment.
- A supported role: OrgAdmin, Assessor, Contributor, or Viewer.
- A current browser with access to the hosted URL.

Do not share credentials. Report unexpected organization names, users, or data immediately.

## Role Overview

| Role | What You Can Expect |
| ---- | ---- |
| OrgAdmin | Company profile, organization users, invitations, assessment, evidence, and reporting workflows. |
| Assessor | Assessment and permitted evidence workflows. |
| Contributor | Assessment and permitted evidence workflows. |
| Viewer | Read-only access to permitted information without evidence mutation or organization user-management controls. |

## First Sign-In

1. Open https://cmmc-launch-hub.web.app.
2. Sign in with your approved pilot account.
3. Confirm the application shell loads.
4. Confirm Command Dashboard shows your Organization Dashboard.
5. Confirm the displayed organization name is correct.
6. Review tier, subscription status, CMMC access, profile completeness, readiness cards, domain readiness, recent activity, and report shortcuts.
7. Open Profile when you need to verify company profile details.
8. Confirm your role-specific controls match your expected responsibilities.
9. Stop and contact support if you see another organization, unexpected users, SuperAdmin controls, or controls that do not match your role.

Inactive or disabled accounts should receive an Access Disabled screen.

## Use The Organization Dashboard

The Organization Dashboard is the normal landing page for OrgAdmin, OrgOwner, Assessor, Contributor, and Viewer users.

- OrgAdmins and OrgOwners see the full operational snapshot, including profile completeness, user and invitation counts, and admin next actions.
- Contributors and Assessors see readiness, evidence, activity, assigned-work-oriented next actions when available, and permitted report shortcuts.
- Viewers see read-only readiness and report information without mutation or admin actions.

Use the dashboard to decide whether to complete the profile, continue assessment work, review evidence, open POA&M, generate reports, or invite approved team members.

## Forgot Password / Reset Password

1. Open https://cmmc-launch-hub.web.app.
2. Select Forgot Password.
3. Enter the email address you use to sign in.
4. Select Send Password Reset Link.
5. If an account exists for that email, Firebase Auth sends a password reset email.
6. Follow the email instructions and return to the login page.

The reset screen intentionally uses the same success message whether or not an account exists for the submitted email. A password reset does not approve pending registrations, reactivate inactive accounts, change organization membership, or change roles.

If you still need help, contact your organization administrator or CMMC Launch Hub support. Include your organization name and the email address you use to sign in. Do not send or share your password.

## Update Your Information

1. Open Profile.
2. Select Edit My Info.
3. Update supported fields such as name, phone, or title.
4. Save the change.
5. Reload the page and confirm the value remains.

You cannot use this workflow to change your email, role, account status, active state, organization assignment, or SuperAdmin status.

## Complete The Company Profile

OrgAdmins and SuperAdmins can maintain the Company Profile. Contributors, Assessors, and Viewers can review permitted profile information but cannot edit the organization record.

Use Profile as the organization source-of-truth record for:

- Organization identity, contacts, and website.
- CAGE, UEI, optional DUNS, and NAICS codes.
- FCI/CUI, assessment level, MSP/MSSP, employee, user, and location details.
- Headquarters, additional locations, and external providers.
- Read-only readiness metrics and data-quality flags.

Complete missing fields before generating customer-facing reports or SSP exports.

## Navigate Assessments

1. Open Command Dashboard.
2. Select the applicable CMMC level.
3. Select a domain.
4. Select a practice.
5. Review the practice and assessment objectives.

When you make permitted changes:

1. Update the objective status, note, or assignment.
2. Use the header Save action.
3. Wait for Saved before navigating away.

## Work With Evidence

Evidence can be attached to supported practice or objective workflows by permitted roles.

1. Navigate to the target practice or objective.
2. Attach the approved file.
3. Confirm `Storage: uploaded`.
4. Confirm the evidence record appears.
5. Review OCR status and OCR Preview when available.
6. Use View or Download as needed.
7. Archive evidence only when it should no longer appear as active evidence.

Viewer accounts should not see upload, direct file input, archive, unarchive, or other evidence mutation controls.

### If OCR Does Not Complete

OCR can temporarily fail during model high-demand periods. The uploaded file remains available as evidence.

Record the filename and displayed OCR status, then contact support if the failure is repeated or blocks your work. Avoid uploading duplicate copies unless support confirms the original file is missing or unusable.

## Generate Reports

### Executive Readiness Report

1. Expand COMPLIANCE REPORTING.
2. Open Executive Readiness Report.
3. Select Generate Report.
4. Confirm the signed-in organization name appears.
5. Review the Readiness Summary.

### POA&M Report

1. Expand COMPLIANCE REPORTING.
2. Open POA&M.
3. Select POA&M Report.
4. Select Generate Report when available.
5. Confirm the signed-in organization name appears.
6. Review the report or the valid empty state.

Report any missing or incorrect organization name immediately.

## OrgAdmin Onboarding Tasks

OrgAdmins should also:

1. Review Company Profile completeness and data-quality flags.
2. Review Users for the organization.
3. Confirm no users from another organization are visible.
4. Open Activity Center and confirm only your organization activity is visible.
5. Use date and action filters when reviewing onboarding or support activity.
6. Export CSV only when an organization-scoped support record is needed.
7. Invite only approved pilot participants.
8. Assign the least-privileged appropriate role.
9. Review pending invitations regularly.

## How to Request Support

Include:

- Your organization name.
- Your role.
- The page or workflow.
- The time the issue occurred.
- The action you took.
- The expected and actual result.
- A screenshot of the displayed message when possible.

Treat unexpected cross-organization data, unauthorized controls, or missing role restrictions as urgent security concerns.

## Pilot Boundaries

- The pilot is not a formal CMMC certification.
- Direct Firestore and Storage authorization-denial testing is outside the current browser validation suite.
- Registration creation and row-specific approval automated tests remain intentionally limited until disposable fixtures are available.
- Use the application only for approved pilot activities and approved pilot data.
