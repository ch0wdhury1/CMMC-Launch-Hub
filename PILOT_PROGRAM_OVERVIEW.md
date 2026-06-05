# CMMC Launch Hub Pilot Program Overview

Date: 2026-06-05  
Pilot Status: Controlled launch package  
Initial Audience: Connecticut manufacturers and defense contractors

## Purpose

CMMC Launch Hub helps small and mid-sized defense industrial base organizations organize CMMC readiness work in one guided, organization-scoped workspace.

The controlled pilot is designed for 3-5 initial organizations with guided onboarding and direct founder support. The pilot validates usability, evidence workflows, reporting quality, operational support procedures, and tier fit before broader rollout.

## Pilot Participants

Ideal pilot participants are Connecticut manufacturers, suppliers, engineering firms, and defense contractors that need a practical way to:

- Understand CMMC Level 1 or Level 2 readiness.
- Track assessment status by practice and objective.
- Centralize company profile and compliance scope information.
- Upload and review evidence.
- Generate readable pilot reports.
- Coordinate internal owners and external provider responsibilities.

## Implemented Capabilities

### Organization Management

SuperAdmins can review organization requests and monitor active, inactive, and archived organizations. Organization users are scoped to their assigned organization.

### User Management

OrgAdmins and OrgOwners can review users, create invitations, and manage organization-level user access according to implemented role permissions. Contributor, Assessor, and Viewer users do not receive organization user-management controls.

### Company Profile

Company Profile is the organization source-of-truth record for legal identity, contacts, government identifiers, compliance profile, scope, external providers, readiness metrics, completeness, and data-quality flags.

### Organization Dashboard

Command Dashboard is the standard landing page for non-SuperAdmin users. It shows organization readiness, domain status, next actions, evidence snapshot, recent activity, and tier-aware reporting shortcuts.

### Assessments

Users can navigate CMMC practices and objectives, update assessment status and notes when permitted, assign work, and save assessment progress.

### Evidence Library And OCR

Permitted roles can upload evidence, confirm storage status, review OCR preview when available, view/download evidence, and archive evidence. Viewer accounts are read-only and do not see evidence mutation controls.

### Reporting

Implemented reports include Executive Readiness Report, POA&M Report, SPRS Scorecard, SSP export, and Responsibility Matrix export where tier and role permissions allow.

### Audit Center And System Health

Activity Center records pilot-critical events such as profile updates, invitations, assessment saves, evidence actions, and report generation. System Health is SuperAdmin-only and provides operational visibility into pilot activity, OCR health, reporting health, organization health, and alerts.

### Tiering

The pilot supports Sponsored, COMM_L1, and COMM_L2 access patterns. COMM_L1 receives Level 1-oriented workflows. COMM_L2 receives advanced Level 2 reporting and tooling where implemented.

## Pilot Operating Model

- Initial cohort: 3-5 organizations.
- Geography and market: Connecticut manufacturers and defense contractors.
- Onboarding: guided setup with direct founder support.
- Support: direct founder-led intake, triage, and resolution tracking.
- Feedback: structured weekly pilot feedback and issue review.

## Success Criteria

The pilot is successful when participating organizations can onboard users, complete company profiles, assess practices, upload evidence, review OCR, generate reports, and use the dashboard without security, isolation, or critical workflow blockers.

## Pilot Boundaries

- The pilot is not formal CMMC certification.
- Direct Firestore and Storage authorization-denial testing remains a recommended future validation area.
- OCR may temporarily fail during model high-demand periods; uploaded files remain available as evidence.
- Billing, email notifications, and advanced remediation sequencing are not included in the current implemented pilot.
