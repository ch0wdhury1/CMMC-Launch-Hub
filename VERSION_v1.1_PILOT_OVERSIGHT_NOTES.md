# CMMC Launch Hub v1.1 - Pilot Oversight Release

## Summary

Version 1.1 adds a read-only pilot oversight layer for CMMC Launch Hub operations. The release introduces a Pilot Observer access model, a centralized CMMC Pilot Dashboard, SuperAdmin header dropdown navigation, Active Orgs monitoring enhancements, and a consolidated Pending Actions page.

## Pilot Observer

`pilotObserver` is a read-only role for pilot-level monitoring. Pilot observers can view aggregate organization status, readiness summaries, pilot activity, feedback counts, and company-level detail summaries. They cannot approve registrations, approve invitations, approve tier upgrades, edit organizations, edit users, mutate assessments, upload/archive evidence, or access raw evidence files.

## Sponsor Observer Management

Sponsor Observer is the user-facing label for the internal `pilotObserver` role. SuperAdmin users can manage Sponsor Observer accounts from the SuperAdmin dropdown by selecting Sponsor Observers.

Sponsor Observer records include:

- Name
- Email
- Status
- Sponsor Program
- Sponsor Program Other, when applicable
- Created and updated metadata

Initial Sponsor Program options:

- CT Manufacturing Pilot
- CCAT Sponsored Pilot
- DECD / Office of Manufacturing Pilot
- APEX Accelerator Pilot
- Cyber Blue Star Internal Pilot
- Other

Temporary passwords are used only during Auth account creation and are not stored in Firestore.

## Pilot Dashboard

The CMMC Pilot Dashboard includes:

- Active Organizations
- Total Pilot Users
- Average Completion %
- Average SPRS Score
- Evidence Uploaded
- Open POA&M Items
- Reports Generated
- Feedback Items
- Active Orgs table with completion and SPRS score
- Company detail modal with readiness, reporting, evidence count, POA&M count, users count, and last activity
- Current progress snapshot with a note that history begins from this release

## SuperAdmin Navigation

The SuperAdmin header control now opens a dropdown with:

- Main Dashboard
- Pilot Dashboard
- Active Orgs
- Sponsor Observers
- Pending Actions
- Activity Center
- System Health
- Feedback Review

## Pending Actions

The Pending Actions page consolidates:

- Pending Registrations
- Pending Add-User / Invitations
- Pending Upgrade Requests

Approval and rejection controls remain SuperAdmin-only.

## Security Notes

- SuperAdmin retains full administrative access.
- Pilot Observer receives read-only oversight access.
- Sponsor Observer users map to `roles.pilotObserver = true`.
- OrgAdmin, Contributor, Assessor, and Viewer remain scoped to their own organization.
- Pilot Observer cannot mutate data or access raw evidence file contents.
- Firestore rule updates are narrow and read-only for pilot observer summary access.

## Deployment Targets

Required deployment targets for v1.1:

- Hosting
- Firestore rules

No functions or storage rules deployment is required by this release.
