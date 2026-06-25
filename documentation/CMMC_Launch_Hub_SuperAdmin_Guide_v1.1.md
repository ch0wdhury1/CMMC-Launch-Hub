# CMMC Launch Hub - SuperAdmin Operations Guide v1.1

**Version:** v1.1  
**Audience:** Cyber Blue Star internal staff, platform administrators, operations staff, and support engineers  
**Purpose:** Operational manual for administering the CMMC Launch Hub SaaS platform  
**Source baseline:** CMMC Launch Hub User Guide v1.1 and v1.1 Baseline Specification

---

## Cover

# CMMC Launch Hub SuperAdmin Operations Guide v1.1

This guide explains how to operate CMMC Launch Hub as a platform administrator. It covers registration management, organization administration, program management, sponsor observer management, marketplace administration, activity monitoring, feedback review, system health, and security boundaries.

> **WARNING**  
> SuperAdmin access provides broad operational authority. Use it only for authorized platform administration, support, and pilot operations.

------------------------------------------------

[SCREENSHOT:
SuperAdmin Main Dashboard
]

------------------------------------------------

---

## Version History

| Version | Date | Description |
| --- | --- | --- |
| v1.1 | Current baseline | SuperAdmin operations guide aligned with CMMC Launch Hub v1.1 features, including programs, sponsor observers, marketplace, vendor engagement analytics, Active Organizations, and Organization Detail pages. |

---

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [SuperAdmin Dashboard](#2-superadmin-dashboard)
3. [Registration Management](#3-registration-management)
4. [Organization Administration](#4-organization-administration)
5. [Program Management](#5-program-management)
6. [Sponsor Observer Management](#6-sponsor-observer-management)
7. [Program Analytics](#7-program-analytics)
8. [Marketplace Administration](#8-marketplace-administration)
9. [User Administration](#9-user-administration)
10. [Activity Center, System Health, and Feedback Review](#10-activity-center-system-health-and-feedback-review)
11. [Security Model](#11-security-model)
12. [Operational Best Practices](#12-operational-best-practices)
13. [Troubleshooting](#13-troubleshooting)
14. [Appendices](#14-appendices)

---

# 1. Platform Overview

## Purpose

CMMC Launch Hub is a multi-tenant CMMC readiness SaaS platform. SuperAdmins operate the platform, manage tenants, review registrations, maintain programs, support sponsor observers, administer marketplace listings, and monitor platform health.

## SuperAdmin Responsibilities

SuperAdmins are responsible for:

- Reviewing commercial and sponsored registrations.
- Approving or cancelling pending registrations.
- Managing organization status, tier, and enrollment type.
- Assigning organizations to commercial or sponsored program enrollment.
- Creating and maintaining programs.
- Managing Sponsor Observer and Program Observer users.
- Reviewing Active Organizations and Organization Detail pages.
- Reviewing program analytics and sponsor-safe program metrics.
- Administering marketplace vendors and review moderation.
- Reviewing activity, feedback, system health, and support issues.

> **BEST PRACTICE**  
> Treat SuperAdmin actions as operational changes. Before changing org status, tier, program assignment, or user access, confirm the business reason and record support context where appropriate.

## System Architecture Overview

For operational purposes, CMMC Launch Hub has these major surfaces:

| Area | Operational purpose |
| --- | --- |
| Public registration | Allows commercial and sponsored organizations to request access. |
| Organization workspace | Customer-facing readiness, evidence, reporting, user, and marketplace workflows. |
| SuperAdmin tools | Platform administration and operational oversight. |
| Sponsor Observer tools | Read-only sponsor/program oversight. |
| Marketplace | Vendor directory, reviews, and engagement tracking. |
| Activity and health | Operational visibility, audit metadata, feedback, and system metrics. |

## Commercial vs Sponsored Organizations

| Organization type | Description | SuperAdmin responsibility |
| --- | --- | --- |
| Commercial | Customer joins directly and requests CMMC Level 1 or Level 2. | Review request, approve, assign tier, confirm active status. |
| Sponsored Program | Organization joins through an approved program. | Review request, assign program metadata, confirm sponsored tier and program visibility. |

## Programs

Programs represent state, sponsor, partner, internal, or commercial enrollment structures. A program can have:

- Program name.
- Program code.
- Sponsor organization.
- State.
- Status.
- L1/L2 eligibility.
- Assigned Sponsor/Program Observers.
- Participant organizations.

## Program Observers

Program Observers are read-only sponsor users scoped to assigned programs. They can view sponsor-safe dashboards and analytics for organizations assigned to their programs.

## Marketplace

Marketplace administration includes:

- Vendor listings.
- Vendor categories.
- Featured vendors.
- Vendor status.
- Review moderation.
- Vendor engagement summaries in analytics.

## Security Boundaries

SuperAdmin views may summarize cross-organization data, but sponsor/program observer views must not expose raw sensitive content.

Restricted content for observers includes:

- Raw evidence files.
- Evidence filenames.
- Private notes.
- Remediation details.
- AI conversations.
- Full report contents.

---

# 2. SuperAdmin Dashboard

------------------------------------------------

[SCREENSHOT:
SuperAdmin Dashboard Overview
]

------------------------------------------------

## Purpose

The SuperAdmin Dashboard is the central administrative landing area. It provides operational visibility into organizations, pending work, system configuration, and platform activity.

## Dashboard Workflow

1. Review pending registration and request counts.
2. Review active organization health.
3. Check pending upgrades and add-user requests.
4. Navigate to Active Orgs for full operational review.
5. Review Program Analytics for sponsored program performance.
6. Check System Health and Feedback Review during daily operations.

## Navigation

The SuperAdmin dropdown includes:

| Navigation item | Purpose |
| --- | --- |
| Main Dashboard | General SuperAdmin overview and org controls. |
| Pilot Dashboard | Pilot/sponsor-style operational summary. |
| Active Orgs | Dedicated active organization list. |
| PROGRAMS | Program management. |
| Program Analytics | Program overview and detail analytics. |
| Marketplace | Marketplace vendor and review administration. |
| Sponsor Observers | Sponsor/Program Observer management. |
| Pending Actions | Pending approvals and requests. |
| Activity Center | Activity and audit metadata. |
| System Health | Platform health and operational metrics. |
| Feedback Review | Pilot/customer feedback queue. |

> **TIP**  
> Use Active Orgs for organization detail review. Use the Main Dashboard for quick administration and pending requests.

---

# 3. Registration Management

------------------------------------------------

[SCREENSHOT:
Pending Actions Page
]

------------------------------------------------

## Purpose

Registration Management allows SuperAdmins to review new organization requests and activate approved organizations.

## Pending Actions

Pending Actions may include:

- Commercial registrations.
- Sponsored registrations.
- Add-user requests.
- Tier upgrade requests.

## Commercial Registrations

Commercial registration requests generally include:

- Company name.
- Primary contact.
- Email.
- Requested CMMC level.
- Requested tier.
- Payment status indicator for pilot workflows.

### Approval Steps

1. Open **Pending Actions** or the pending registrations area.
2. Review company and contact information.
3. Confirm requested level and tier.
4. Select **Approve**.
5. Confirm that the organization appears as active.

### Expected Outcome

The organization is created/activated as a commercial organization, the first user is activated, and the org becomes available in Active Orgs.

## Sponsored Registrations

Sponsored registrations include program information:

- Program name.
- Program code.
- Requested level.
- Sponsored/commercial tier mapping.

### Approval Steps

1. Open **Pending Actions**.
2. Review registration details.
3. Confirm the selected program is correct.
4. Confirm requested tier and CMMC level.
5. Approve the request.
6. Verify that organization program fields are populated.

### Expected Outcome

The organization is created/activated with program assignment. Assigned Program Observers can see sanitized summary data for the organization.

## Cancelling Registrations

Use cancellation when a request is duplicate, invalid, withdrawn, or should not proceed.

> **WARNING**  
> Cancellation prevents the request from being approved. Confirm before cancelling a legitimate customer registration.

## Activation Workflow

| Step | Result |
| --- | --- |
| Registration submitted | Pending request is created. |
| SuperAdmin reviews | Request details are checked. |
| SuperAdmin approves | Org, user, membership, tier, and enrollment fields are activated. |
| SuperAdmin cancels | Request is marked cancelled and does not activate. |

---

# 4. Organization Administration

------------------------------------------------

[SCREENSHOT:
SuperAdmin Active Organizations Page
]

------------------------------------------------

## Active Organizations

The Active Organizations page provides a full operational table of active tenants.

Columns include:

| Column | Purpose |
| --- | --- |
| Company Name | Organization display name. |
| Status | Current org status. |
| Tier | Current entitlement tier. |
| Enrollment Type | Commercial or Program. |
| Program / Commercial | Program name/code or Commercial label. |
| Users Count | Number of users. |
| Practices Completed | Completed assessment count. |
| Readiness % | Completion summary. |
| Evidence Count | Evidence count summary. |
| SSP Generated | Whether SSP was generated. |
| POA&M Generated | Whether POA&M was generated. |
| Last Activity | Most recent activity. |
| Details | Opens dedicated org detail. |

## Inactive Organizations

Inactive organizations remain reviewable but may not have normal active-user access. Use inactive status for organizations that should be paused without deleting data.

## Archived Organizations

Archived organizations are retained for review/history but removed from normal active operation.

> **WARNING**  
> Do not use archive as a substitute for legal retention review. Follow internal data retention policies.

## Organization Detail Page

------------------------------------------------

[SCREENSHOT:
SuperAdmin Organization Detail Page
]

------------------------------------------------

The Organization Detail page includes:

- Company details.
- Users table.
- Enrollment details.
- Assessment/readiness summary.
- Domain readiness.
- Evidence count.
- SSP generated flag.
- POA&M generated flag.
- SPRS score.
- Marketplace engagement table.
- Recent metadata-only activity.

## Company Profile

The Company Profile section summarizes organization identity and readiness context. SuperAdmins should use it to verify whether reports have enough source data.

## Users

The Users table shows name, email, role, status, and joined date.

## Assessment Summaries

Assessment summaries show total practices, completed practices, remaining practices, completion percentage, and domain readiness.

## Evidence Counts

Evidence counts show operational evidence volume. They do not expose raw files in summary tables.

## Reports

Report fields indicate whether major reports have been generated.

## Marketplace Engagement

Marketplace engagement tables show metadata such as vendor name, category, engagement type, status, dates, and updated time.

## Recent Activity

Recent Activity is metadata-only and newest first.

---

# 5. Program Management

------------------------------------------------

[SCREENSHOT:
Program Management Page
]

------------------------------------------------

## Purpose

Program Management allows SuperAdmins to create and maintain programs used for sponsored enrollment and program-scoped observer access.

## Creating Programs

### Steps

1. Open **PROGRAMS**.
2. Select **Add Program**.
3. Enter program name and code.
4. Select program type.
5. Enter state and sponsor organization if applicable.
6. Choose active/inactive/archived status.
7. Set L1/L2 eligibility.
8. Save.

## Editing Programs

Use edit to update program metadata, dates, eligibility, sponsor organization, and observer emails.

## Archiving and Reactivating

| Action | Use when |
| --- | --- |
| Archive | Program should no longer be active but should remain historically available. |
| Reactivate | Program should be restored to active use. |

## Program Types

| Type | Typical use |
| --- | --- |
| STATE | State-sponsored program. |
| SPONSOR | Sponsor-led program. |
| PARTNER | Partner-led program. |
| INTERNAL | Internal pilot or Cyber Blue Star use. |
| COMMERCIAL | Commercial program grouping. |

## Program Observers

Program Observers may be assigned by email or linked by user account. Existing users can be scoped using program IDs and program codes.

## Program Participants

Program participants are organizations with matching program assignment fields.

## Commercial vs Sponsored

Program assignment does not replace tier. Tier controls feature access; program assignment controls enrollment and observer visibility.

---

# 6. Sponsor Observer Management

------------------------------------------------

[SCREENSHOT:
Sponsor Observers Management Page
]

------------------------------------------------

## Purpose

Sponsor Observer Management allows SuperAdmins to create and maintain read-only sponsor/program users.

## Creating Observers

### Steps

1. Open **Sponsor Observers**.
2. Select **Add Sponsor Observer**.
3. Enter name and email.
4. Assign sponsor/program metadata.
5. Enter or generate a temporary password if the creation flow requires it.
6. Save.
7. Share the temporary password securely if applicable.

> **WARNING**  
> Never store observer passwords in notes, tickets, or Firestore-visible fields. Share temporary credentials using approved secure procedures.

## Assigning Observers

Observers may be assigned to one or more programs using program records.

## Removing Observers

Use activate/deactivate or remove-from-program controls where available. Deactivation is preferred when preserving audit history.

## Program Scoping

Program-scoped observers see only organizations assigned to their program IDs.

## Permissions

Sponsor/Program Observers:

- Can access sponsor dashboard views.
- Can access authorized participants and analytics.
- Can browse marketplace records.
- Cannot mutate organization data.
- Cannot approve registrations.
- Cannot access raw evidence files or report contents.

---

# 7. Program Analytics

------------------------------------------------

[SCREENSHOT:
Program Analytics Overview
]

------------------------------------------------

## Purpose

Program Analytics provides sponsor-safe metrics about program performance and participant readiness.

## SuperAdmin Overview

SuperAdmin users first see an overview table of active programs.

| Column | Purpose |
| --- | --- |
| Program Name | Program display name. |
| Program Code | Program identifier. |
| State | Program state. |
| Sponsor | Sponsor organization. |
| Organizations Count | Number of participant orgs. |
| Total Users | Aggregated participant users. |
| Average Completion % | Average readiness completion. |
| Average SPRS Score | Average SPRS metric. |
| Evidence Count | Total evidence count. |
| Reports Generated | Reports generated summary. |
| Last Activity | Most recent activity. |
| View Analytics | Opens program detail. |

## Program Detail KPIs

| KPI | Meaning |
| --- | --- |
| Total Organizations | Total organizations in program scope. |
| Active Organizations | Active organizations in program scope. |
| Total Users | Participant user count. |
| Average Completion | Average readiness completion. |
| Average SPRS Score | Average SPRS score. |
| Evidence Uploaded | Evidence count. |
| SSP Generated | Number of participants with SSP generated. |
| POA&M Generated | Number of participants with POA&M generated. |
| Open POA&M Items | Open remediation item count. |
| Organizations Using Vendors | Participants with vendor engagement records. |
| Total Vendor Engagements | All vendor engagement records. |
| Active Vendor Engagements | Engagements with active status. |

## Charts and Tables

Program Analytics includes:

- Completion distribution.
- Tier split.
- Reports summary.
- Top Marketplace Vendors Used.
- Organization Performance table.
- Recent Program Activity.

## Security

Analytics data is sanitized. Raw evidence, filenames, private notes, remediation details, AI conversations, and report contents are excluded.

---

# 8. Marketplace Administration

------------------------------------------------

[SCREENSHOT:
Marketplace Admin Page
]

------------------------------------------------

## Vendor Management

SuperAdmins can add and edit marketplace vendor records.

Vendor fields may include:

- Company name.
- Logo URL.
- Description.
- Primary category.
- Subcategories.
- CyberAB roles.
- Website.
- Email.
- Phone.
- Address.
- City/state/country.
- Service area.
- Remote availability.
- Languages.
- Years in business.
- Industries served.
- Programs supported.
- Status.
- Featured flag.

## Vendor Statuses

| Status | Meaning |
| --- | --- |
| active | Visible to normal marketplace users. |
| inactive | Retained but not normally visible. |
| archived | Retained for history, not active marketplace use. |

## Featured Vendors

Featured vendors are highlighted in the marketplace.

> **NOTE**  
> Featured status should be used carefully and consistently with business policy.

## Categories

Marketplace categories include Consulting, Software, Hardware, Training, Assessment, and Other.

## Reviews and Moderation

SuperAdmins review submitted marketplace reviews and approve or reject them.

### Moderation Steps

1. Open Marketplace as SuperAdmin.
2. Review pending reviews.
3. Check vendor, organization, rating, and comment preview.
4. Approve or reject.

> **WARNING**  
> Reject reviews that include confidential data, sensitive security details, pricing terms, contract language, or inappropriate content.

## Vendor Engagement Summaries

Vendor engagement summaries appear in Program Analytics and Organization Detail. They are metadata summaries, not contracts or private messages.

---

# 9. User Administration

## Platform Users

User administration includes account activation, organization membership, role assignment, invited login creation, observer management, and inactive user handling.

## Invitations

OrgAdmins can invite organization users. SuperAdmins may support invitation and login issues.

## Activation

Users must be active and associated with an active organization or authorized observer role to access the application.

## Password Issues

Use password reset where possible. For invited or observer accounts, use only the safe temporary password workflow supported by the application.

## Inactive Users

Inactive users should remain inactive rather than deleted when audit history matters.

## Deleting Users

Deletion is restricted and should not be used as a routine support action.

> **BEST PRACTICE**  
> Prefer deactivate/reactivate workflows over deletion. Preserve audit continuity unless a formal data deletion process applies.

---

# 10. Activity Center, System Health, and Feedback Review

------------------------------------------------

[SCREENSHOT:
System Health Dashboard
]

------------------------------------------------

## Activity Center

Activity Center displays audit and operational activity metadata. Use it to troubleshoot recent changes and confirm user actions.

## System Health

System Health provides SuperAdmin-only operational visibility into platform activity, user adoption, evidence processing, reporting, alerts, and recent activity.

## Feedback Review

Feedback Review shows pilot/user feedback. Feedback statuses include:

- New.
- Reviewed.
- Closed.

## Audit Logs

Audit metadata may include actor, action, target type, summary, and timestamp. Sensitive content should not be exposed in audit summary views.

## Troubleshooting Workflow

1. Identify affected user/org.
2. Check Active Orgs or Organization Detail.
3. Review recent activity.
4. Check System Health.
5. Review Feedback if the user submitted an issue.
6. Escalate if the issue involves access, evidence, reports, or data integrity.

---

# 11. Security Model

## Role Matrix

| Capability | SuperAdmin | OrgAdmin | Contributor | Assessor | Viewer | Sponsor/Program Observer |
| --- | --- | --- | --- | --- | --- | --- |
| Platform administration | Yes | No | No | No | No | No |
| Organization management | Yes | Own org | No | No | No | No |
| Assessment edit | Admin context | Own org | Own org where allowed | Own org where allowed | No | No |
| Evidence upload | Admin context | Own org | Own org where allowed | Own org where allowed | No | No |
| Report content | Admin/org context | Own org | Allowed own org | Allowed own org | Read-only allowed | No |
| Program analytics | All | No | No | No | No | Assigned/sponsor-safe |
| Marketplace admin | Yes | No | No | No | No | No |

## Program Isolation

Program Observers with assigned program IDs are limited to organizations assigned to those programs.

## Evidence Protection

Evidence files are protected by organization membership and role boundaries. Sponsor observers do not receive raw evidence file access.

## Marketplace Protection

Marketplace administration and review moderation are SuperAdmin-only.

## Observer Restrictions

Observers cannot:

- Approve or reject pending actions.
- Edit organizations.
- Edit company profile data.
- Upload evidence.
- Read raw evidence files.
- View evidence filenames in sponsor summaries.
- Read private notes.
- Read AI conversations.
- View full report contents.

---

# 12. Operational Best Practices

## Daily

- Check Pending Actions.
- Review Feedback Review.
- Review System Health.
- Check recent activity for unusual events.
- Respond to access issues.

## Weekly

- Review Active Organizations.
- Review Program Analytics.
- Check inactive/archived organizations.
- Review Sponsor Observer assignments.
- Moderate marketplace reviews.

## Monthly

- Audit program assignments.
- Review marketplace vendor status.
- Review system activity trends.
- Confirm documentation and support playbooks remain current.

## Quarterly

- Review role assignments.
- Review sponsor/program observer access.
- Perform access-control regression testing.
- Review storage and evidence access procedures.

## Pilot Administration Checklist

| Item | Cadence |
| --- | --- |
| Pending registrations reviewed | Daily |
| Sponsor observers verified | Weekly |
| Program analytics reviewed | Weekly |
| Feedback triaged | Daily/weekly |
| Marketplace reviews moderated | Weekly |
| Security boundaries reviewed | Monthly |

---

# 13. Troubleshooting

## Common Admin Issues

| Issue | Likely cause | Recovery procedure |
| --- | --- | --- |
| Registration not visible | Request did not submit or status is not pending. | Confirm registration email, check Pending Actions, ask user to resubmit if needed. |
| User cannot log in | Account inactive, missing metadata, wrong password, or org inactive. | Check user status, org status, membership, and password reset. |
| Program observer sees wrong orgs | Program assignment mismatch or legacy observer fallback. | Check observer program IDs and org program assignment. |
| Sponsored program not listed | Program inactive or registration service unavailable. | Confirm program status and safe registration listing. |
| Marketplace review not visible | Review pending moderation. | Approve or reject in Marketplace admin. |
| Active Vendor Engagements incorrect | Engagement status not active or metadata stale. | Check vendor engagement status and refresh analytics. |

## Recovery Procedures

1. Confirm the user's role and status.
2. Confirm organization status.
3. Confirm membership status and role.
4. Check related pending requests.
5. Check recent activity.
6. Use repair controls only when the issue matches an approved repair scenario.
7. Escalate security or data integrity concerns.

---

# 14. Appendices

## Appendix A: Navigation Map

| Area | Navigation |
| --- | --- |
| Main Dashboard | SuperAdmin overview. |
| Active Orgs | Dedicated org list and detail pages. |
| Programs | Program creation/edit/archive/reactivate. |
| Program Analytics | Program overview and detail metrics. |
| Sponsor Observers | Observer account and program assignment. |
| Marketplace | Vendor admin and review moderation. |
| Pending Actions | Pending registration, add-user, and upgrade workflows. |
| Activity Center | Audit metadata. |
| System Health | Operational health. |
| Feedback Review | Customer/pilot feedback. |

## Appendix B: Permission Matrix

| Data | SuperAdmin | Sponsor Observer |
| --- | --- | --- |
| Active org summaries | Yes | Program/pilot summaries only |
| Org detail summary | Yes | Participant detail summary only |
| Evidence files | Admin access | No |
| Evidence filenames | Avoid in summary endpoints | No |
| Report contents | Admin/org context | No |
| Report flags/counts | Yes | Yes |
| Marketplace reviews moderation | Yes | No |

## Appendix C: Workflow Diagrams

### Registration Approval

```text
Registration submitted
  -> Pending Actions
  -> SuperAdmin review
  -> Approve or Cancel
  -> Organization activated or request closed
```

### Program Observer Assignment

```text
Create/identify program
  -> Create Sponsor Observer
  -> Assign program
  -> Confirm programIds/programCodes
  -> Observer sees scoped dashboard
```

## Appendix D: Operational Checklist

- Review Pending Actions.
- Review Active Orgs.
- Check Program Analytics.
- Review Sponsor Observers.
- Moderate Marketplace Reviews.
- Review Feedback.
- Check System Health.
- Document escalations.

## Appendix E: Screenshot List

- SuperAdmin Dashboard.
- Pending Actions.
- Active Organizations.
- Organization Detail.
- Programs.
- Sponsor Observers.
- Program Analytics Overview.
- Program Analytics Detail.
- Marketplace Admin.
- Marketplace Review Moderation.
- Activity Center.
- System Health.
- Feedback Review.

