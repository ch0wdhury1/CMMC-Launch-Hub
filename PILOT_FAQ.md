# CMMC Launch Hub Pilot FAQ

Date: 2026-06-05

## What is CMMC Launch Hub?

CMMC Launch Hub is a pilot-ready application for organizing CMMC readiness work, company profile data, assessment status, evidence, OCR review, reports, activity, and operational monitoring.

## Who is the pilot for?

The initial pilot is intended for 3-5 Connecticut manufacturers and defense contractors that want a guided readiness workspace and are willing to provide structured feedback.

## Is this a formal CMMC certification?

No. The pilot helps organize readiness work and reporting, but it is not a formal CMMC certification, assessment, legal opinion, or substitute for a certified third-party assessment when one is required.

## What roles are supported?

The implemented roles are SuperAdmin, OrgAdmin, OrgOwner, Assessor, Contributor, Viewer, and inactive/disabled users. Regular organization users are scoped to their own organization.

## What does Command Dashboard show?

Command Dashboard shows Organization Dashboard v1 for regular users. It includes organization identity, tier, profile completeness, readiness metrics, domain readiness, next actions, evidence snapshot, recent activity, and tier-aware reporting shortcuts.

## What information belongs in Company Profile?

Company Profile is the source-of-truth record for legal identity, contacts, government identifiers, compliance profile, scope, external providers, readiness metrics, completeness, and data-quality flags.

## Can users upload evidence?

Permitted roles can upload evidence to supported assessment workflows and the Evidence Library. Viewer users are read-only and do not see upload, direct file input, archive, unarchive, or other evidence mutation controls.

## What does OCR do?

OCR attempts to extract and preview evidence text. OCR can temporarily fail during model high-demand periods, but the uploaded file remains available as evidence.

## What reports are available?

Implemented reporting includes Executive Readiness Report, POA&M Report, SPRS Scorecard, SSP PDF export, and Responsibility Matrix export where role and tier permissions allow.

## Why can I not see some reports?

Tiering controls visibility. COMM_L1 users do not see Level 2-only shortcuts such as POA&M workspace, SSP export shortcut, and Responsibility Matrix shortcut. COMM_L2 users receive the advanced reporting/tooling paths currently implemented.

## Does the app track activity?

Yes. Activity Center records pilot-critical actions such as invitations, profile updates, assessment saves, evidence uploads and archives, and report generation. OrgAdmins see only their organization activity. SuperAdmins can see all pilot organization activity.

## What is System Health?

System Health is a SuperAdmin-only operational dashboard for pilot monitoring. It shows health summary cards, OCR health, reporting health, organization health, alerts, and recent activity.

## How is support handled?

The pilot includes guided onboarding and direct founder support. Users should report organization name, role, page/workflow, time, expected result, actual result, and screenshots when possible.

## What should be escalated immediately?

Escalate cross-organization data visibility, unauthorized SuperAdmin controls, Viewer mutation controls, missing role restrictions, report identity mix-ups, and evidence access issues immediately.

## Are billing or notifications included?

No. Billing and email notifications are not implemented in the current pilot scope.
