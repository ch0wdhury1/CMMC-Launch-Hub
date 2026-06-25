# CMMC Launch Hub v1.1 Baseline Specification

Version: v1.1 Baseline  
Branch: `feature/phase-25a-program-management`  
Status: Documentation baseline after Phase 26D  
Prepared for: Founder/product owner, development team, cybersecurity/CMMC advisors, sponsor organizations, and IP counsel

## 1. Executive Summary

CMMC Launch Hub is currently a multi-tenant CMMC readiness SaaS platform that supports commercial organizations, sponsored program participants, sponsor/program observers, and platform-level SuperAdmin operations.

At the v1.1 baseline, the platform combines:

- Commercial and sponsored program enrollment.
- Organization and user management.
- CMMC Level 1 and Level 2 assessment workflows.
- Evidence upload, evidence library, metadata, OCR, and evidence reuse workflows.
- Executive, SSP, SPRS, POA&M, and responsibility reporting.
- Sponsor/program oversight with sanitized participant summaries.
- Program management and program analytics.
- CMMC Marketplace vendor directory, ratings/reviews, and vendor engagement tracking.
- SuperAdmin operational pages, including Active Orgs and organization detail summaries.
- Activity and audit metadata for operational visibility.

The product is not a certification authority and does not certify compliance by itself. It is a readiness, evidence, workflow, reporting, and oversight platform intended to help organizations prepare, coordinate, document, and manage CMMC readiness activity.

## 2. Release Identity

| Item | Baseline |
| --- | --- |
| Product name | CMMC Launch Hub |
| Version | v1.1 Baseline |
| Branch | `feature/phase-25a-program-management` |
| Frontend | React + TypeScript + Vite |
| Hosting | Firebase Hosting |
| Backend | Firebase Functions v2 HTTPS Express API |
| Database | Cloud Firestore |
| Authentication | Firebase Authentication |
| File storage | Firebase Storage |
| AI integration | Gemini API through Firebase Functions |
| Current production URL | `https://cmmc-launch-hub.web.app` observed in prior pilot validation context; verify during final QA |
| Deployment targets for current changed baseline | Hosting and Functions for Phase 26D changes; Firestore rules and Storage rules unchanged |

## 3. Core Platform Architecture

| Layer | Current implementation |
| --- | --- |
| Client application | React components in `App.tsx` and `components/*`, with TypeScript service modules in `src/*`. |
| Routing model | Mostly state-driven in `App.tsx`; selected SuperAdmin and sponsor views also synchronize browser paths. |
| Hosting | Firebase Hosting serves the Vite build output. |
| API | Firebase Functions v2 Express app exported as `api`. |
| API path pattern | Primary paths use `/api/...`; compatibility aliases include direct paths such as `/program/analytics` and doubled rewrite paths such as `/api/api/...`. |
| Database | Firestore collections and subcollections store users, orgs, assessments, evidence metadata, activity, programs, marketplace records, and requests. |
| Auth | Firebase Authentication with Firestore `users/{uid}` metadata and role flags. |
| Storage | Firebase Storage under `orgs/{orgId}/...`; read/write scoped by active org membership or SuperAdmin. |
| AI | Gemini calls are mediated through `/api/ai/gemini` and evidence/practice helper endpoints. |
| Sanitized data approach | Sponsor/program observer and SuperAdmin summary endpoints intentionally return metadata summaries, counts, flags, and sanitized rows instead of raw evidence files, filenames, AI conversations, private notes, or report contents. |

## 4. User Roles and Access Model

### Role Definitions

| Role | Purpose | Major permissions | Restricted actions | Marketplace permissions | Program visibility |
| --- | --- | --- | --- | --- | --- |
| SuperAdmin | Platform operator and pilot administrator. | Manage orgs, programs, pending actions, sponsor observers, marketplace vendors/reviews, system health, active org summaries, and org detail summaries. | No client delete for sensitive program/access/audit records; must use guarded controls. | Full vendor management, review moderation, marketplace admin visibility. | All programs and all active org summary/detail data through SuperAdmin endpoints. |
| OrgAdmin | Organization administrator. | Manage org profile, users/invitations, assessment work, evidence, reports, feedback, activity center for own org. | Cannot access SuperAdmin pages, other orgs, sponsor management, or raw cross-org data. | Can browse vendors, submit reviews if allowed, and manage own org vendor engagements. | Own organization only. |
| Contributor | Organization contributor. | Help complete assessment, notes, evidence, and assigned work if role policy permits. | Cannot manage users, SuperAdmin actions, or broader org settings. | Can browse vendors and may manage/review marketplace engagement where UI permits authenticated org-user actions. | Own organization only. |
| Assessor | Review-oriented org role. | Review assessment/evidence and participate in readiness workflows. | Cannot manage users or SuperAdmin controls. | Can browse vendors; mutation permissions follow org-user UI and backend checks. | Own organization only. |
| Viewer | Read-only organization user. | View readiness and reports as allowed by role/tier. | No mutation controls, upload/archive evidence controls, user management, or admin actions. | Read-only marketplace browse; no administrative vendor actions. | Own organization only. |
| pilotObserver | Legacy sponsor observer. | Read-only pilot dashboard, participants, analytics, marketplace, recent activity, profile. | No org mutation, approvals, raw evidence files, filenames, private notes, remediation details, AI conversations, or report contents. | Read-only browse and sponsor-safe marketplace visibility. | Legacy broad pilot-visible org scope when no programIds are assigned. |
| programObserver | Program-scoped sponsor observer. | Read-only sponsor/program dashboard, participants, analytics, marketplace, recent activity, profile for assigned program(s). | Same observer restrictions as pilotObserver; cannot self-assign programs. | Read-only browse and sponsor-safe marketplace visibility. | Server-side scoped to `programIds`; legacy fallback does not apply when `programIds` are present. |

### Role-Permission Matrix

| Capability | SuperAdmin | OrgAdmin | Contributor | Assessor | Viewer | pilotObserver | programObserver |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Login without org membership | Yes | No | No | No | No | Yes | Yes |
| Manage organizations | Yes | Own org safe fields | No | No | No | No | No |
| Manage programs | Yes | No | No | No | No | No | No |
| Approve registrations/upgrades | Yes | No | No | No | No | No | No |
| Manage org users/invitations | Yes | Own org | No | No | No | No | No |
| Edit assessment | Yes | Own org | Own org where allowed | Own org where allowed | No | No | No |
| Upload/archive evidence | Yes | Own org where allowed | Own org where allowed | Own org where allowed | No | No | No |
| Read raw evidence files | Yes by Storage rules | Own org | Own org | Own org | Own org read, if role policy allows | No | No |
| View report contents | Yes | Own org | Own org where allowed | Own org where allowed | Own org where allowed | Summary flags/counts only | Summary flags/counts only |
| Marketplace vendor admin | Yes | No | No | No | No | No | No |
| Marketplace review moderation | Yes | No | No | No | No | No | No |
| Submit vendor review | No special org context | Own org where UI allows | Own org where UI allows | Own org where UI allows | Restricted/read-only | No | No |
| Manage vendor engagement | No special org context | Own org | Own org where UI allows | Own org where UI allows | Restricted/read-only | No | No |
| Program analytics | All programs | No | No | No | No | Legacy pilot scope | Assigned programs only |
| Active Orgs page | Yes | No | No | No | No | No | No |

## 5. Organization and Tenant Model

Primary tenant data is stored under `orgs/{orgId}` with user metadata in `users/{uid}` and membership under both observed membership paths:

- `orgs/{orgId}/members/{uid}`
- `orgMembers/{orgId}/members/{uid}`

Observed/inferred from code; verify during final QA that both membership paths remain intentionally supported.

### Key Organization Fields

| Field | Purpose |
| --- | --- |
| `name` | Organization display name fallback. |
| `companyProfile` | Expanded source-of-truth profile record used by reports and SSP. |
| `status` | Organization status such as `active`, `inactive`, or `archived`. |
| `tier` | Entitlement tier such as `SPONSORED`, `COMM_L1`, or `COMM_L2`. |
| `subscriptionStatus` | Subscription operational status. |
| `maxUsers` | User cap by tier/program. |
| `activeMemberCount` | Cached active user count. |
| `ownerUid` | Primary owner user id. |
| `enrollmentType` | `COMMERCIAL` or `PROGRAM`. |
| `programId` | Program document id when enrolled through a program. |
| `programName` | Program display name snapshot. |
| `programCode` | Program code snapshot. |
| `createdAt`, `approvedAt`, `updatedAt` | Lifecycle timestamps where available. |

### Tier Model

| Tier | Current meaning |
| --- | --- |
| `SPONSORED` | Sponsored/program baseline, treated like L1 for many navigation decisions while preserving sponsor-specific limitations. |
| `COMM_L1` | Commercial Level 1 access; Level 2 assessment/reporting features are gated. |
| `COMM_L2` | Full platform access, including Level 2 assessment/reporting features. |

## 6. Commercial vs Program Enrollment Architecture

Registration supports two enrollment paths.

| Path | User choice | Expected mapping |
| --- | --- | --- |
| Commercial Subscription | Commercial registration with requested CMMC level. | `enrollmentType = "COMMERCIAL"`, tier maps to `COMM_L1` or `COMM_L2`, program fields are null. |
| State / Sponsored Program | Registration through active sponsored program list. | `enrollmentType = "PROGRAM"`, sponsored L1 maps to `SPONSORED`, program fields are populated from sanitized program list. |

### Registration Flow

1. Public registration creates a Firebase Auth user.
2. Registration creates `accessRequests/{requestId}` with `type = "orgRegistration"` and `status = "pending"`.
3. Pending Actions/SuperAdmin queue displays pending registrations.
4. SuperAdmin approves or cancels.
5. Approval creates/updates org, user doc, org membership, and enrollment/program fields.
6. Program orgs become visible to assigned program observers through server-side program scoping.

### Sponsored Program List

The registration page loads programs from a sanitized backend endpoint rather than direct Firestore reads:

- `GET /api/registration/programs`

Safe fields returned:

- `id`
- `name`
- `programCode`
- `programType`
- `state`
- `sponsorName`
- `allowL1`
- `allowL2`
- `status`

The endpoint excludes observer emails/uids, created/updated by fields, internal notes, archived programs, and inactive programs.

## 7. Program Management Architecture

Programs are first-class enrollment and oversight records stored in `programs/{programId}`.

### Program Fields

| Field | Purpose |
| --- | --- |
| `id` | Firestore document id, also written back into the document. |
| `name` | Program display name. |
| `programCode` | Uppercase program code, unique in the UI service. |
| `programType` | `STATE`, `SPONSOR`, `PARTNER`, `INTERNAL`, or `COMMERCIAL`. |
| `state` | State/region indicator, such as `CT`. |
| `sponsorName` | Sponsor organization name. |
| `description` | Program description. |
| `status` | `active`, `inactive`, or `archived`. |
| `allowL1`, `allowL2` | Eligibility flags used by registration and program configuration. |
| `startDate`, `endDate` | Optional program date range. |
| `sponsorObserverEmails` | Observer emails assigned or pending link. |
| `sponsorObserverUids` | Linked observer UIDs. |
| `createdAt`, `updatedAt`, `createdBy`, `updatedBy` | Operational metadata. |

### Program Management UI

SuperAdmin can:

- Add programs.
- Edit program metadata.
- Archive and reactivate programs.
- Assign observer emails.
- Link existing users as program observers.
- View participant count and observer count.
- Assign orgs to programs through SuperAdmin org controls.

Firestore rules include a narrow program block:

```text
match /programs/{programId} {
  allow read, create, update: if isSuperAdmin();
  allow delete: if false;
}
```

No non-SuperAdmin role can read, create, update, or delete `programs` directly in this baseline.

## 8. Program Observer and Sponsor Oversight

Sponsor observer users use internal role flags:

- `roles.pilotObserver = true`
- `roles.programObserver = true`

Program-scoped observers additionally use:

- `programIds: string[]`
- `programCodes: string[]`
- `observerType = "program"`

### Navigation

Sponsor Observer header navigation contains:

- Dashboard
- Participants
- Program Analytics
- Marketplace
- Recent Activity
- My Profile
- Logout

### Program Scope Rules

| Observer state | Behavior |
| --- | --- |
| `roles.programObserver = true` and `programIds.length > 0` | Server-side program-scoped filtering only. Orgs without matching `org.programId` are excluded. |
| Legacy `roles.pilotObserver = true` with no `programIds` | Legacy pilot-visible fallback applies. |
| `programObserver` without program IDs and no legacy observer role | Empty/safe observer data. |

### Sponsor-Visible Data

Sponsor/program observers see sanitized summaries:

- Organization readiness and progress metrics.
- Domain readiness summaries.
- Evidence counts, not raw files.
- Report generated flags/counts, not report content.
- Metadata-only recent activity.
- Sanitized marketplace engagement summaries.

They do not see raw evidence files, filenames, AI conversations, private notes, remediation details, or report contents.

## 9. Program Analytics Dashboard

Program Analytics supports:

- SuperAdmin overview of all active programs.
- SuperAdmin drill-down into a selected program.
- Program Observer direct scoped analytics for assigned program(s).

### SuperAdmin Overview Columns

| Column | Meaning |
| --- | --- |
| Program Name | Program display name. |
| Program Code | Program code. |
| State | Program state. |
| Sponsor | Sponsor organization. |
| Organizations Count | Number of organizations in program scope. |
| Total Users | Aggregated user count. |
| Average Completion % | Average completion percentage. |
| Average SPRS Score | Average SPRS score. |
| Evidence Count | Aggregated evidence count. |
| Reports Generated | SSP + POA&M + other report count. |
| Last Activity | Most recent activity timestamp. |
| Action | View Analytics. |

### Program Detail KPIs

- Total Organizations
- Active Organizations
- Total Users
- Average Completion
- Average SPRS Score
- Evidence Uploaded
- SSP Generated
- POA&M Generated
- Open POA&M Items
- Last Activity
- Organizations Using Vendors
- Total Vendor Engagements
- Active Vendor Engagements
- Software Vendors Used
- Consulting Providers Used
- Training Providers Used

### Marketplace Analytics

Vendor engagement metrics are aggregated from `orgs/{orgId}/vendorEngagements/{engagementId}` records. Phase 26D fixed active vendor engagement counting so `Active Vendor Engagements` counts engagements where normalized `status === "active"` while preserving Top Marketplace Vendors Used.

The analytics endpoint returns sanitized counts and summaries only.

## 10. CMMC Assessment Capabilities

The platform supports CMMC Level 1 and Level 2 workflows.

| Capability | Current state |
| --- | --- |
| Level 1 data | Loaded from `public/cmmc_l1_prepop.json`. |
| Level 2 data | Loaded from `public/cmmc_l2_prepop.json`; L2 sidebar domain tokens use `__L2__:{domainId}` internally. |
| Practices/objectives | Rendered through domain/practice views and stored under assessment subcollections. |
| Status tracking | Practice and objective records support statuses such as met, partial, not met, and not assessed. |
| Completion tracking | Completion percentage calculated from practice records and framework domains. |
| SPRS support | Score snapshots and SPRS scorecard support are present. |
| Domain readiness | Domain readiness tables summarize completed, remaining, total, readiness percent, and status. |
| Role-aware access | Org members can read/write according to role policy; viewers remain read-only in UI; sponsor observers receive sanitized summaries only. |

## 11. Evidence Management

Evidence capabilities include:

- Evidence Library.
- Evidence upload.
- Evidence reuse via evidence references.
- Evidence count tracking.
- Evidence metadata storage.
- OCR/validation support through backend endpoints.
- Archive/status handling where implemented.

### Evidence Collections

Observed/inferred from code; verify during final QA:

- `orgs/{orgId}/evidence/{evidenceId}`
- `orgs/{orgId}/evidenceLibrary/{evidenceId}`
- `orgs/{orgId}/assessments/{assessmentId}/practiceRecords/{practiceId}/evidenceRefs/{evidenceId}`
- `orgs/{orgId}/assessments/{assessmentId}/objectiveRecords/{objectiveId}/evidenceRefs/{evidenceId}`
- `evidenceValidations` subcollections under practice/objective records.

### Evidence Security Principles

- Storage paths are org-scoped.
- SuperAdmin can read/write org storage by rule.
- Active org members can read their org storage.
- Upload/update storage access is restricted to SuperAdmin or active org members with roles in `orgOwner`, `orgAdmin`, `assessor`, or `contributor`.
- Storage delete is denied.
- Sponsor/program observers do not receive raw evidence files or filenames in sponsor dashboards.

## 12. Reporting Capabilities

Current reporting capabilities include:

| Report | Purpose | Notes |
| --- | --- | --- |
| Executive Readiness Report | Sponsor/customer-ready readiness summary. | Organization name fallback and PDF polish implemented in prior phases. |
| POA&M | Management and report workflows for Plans of Action and Milestones. | PDF table layout polished in prior reporting phases. |
| System Security Plan (SSP) | SSP export and report generation. | Tier gated; COMM_L1/SPONSORED do not see unauthorized SSP PDF button unless entitled. |
| SPRS Scorecard | SPRS scoring and export. | PDF summary/table layout polished. |
| Shared Responsibility Matrix | Responsibility matrix report/tool where tier allows. | L2/tier gated. |

Report activity is tracked through metadata such as `report.generated` events, report generated flags, and counts. Sponsor/program observer surfaces show report flags/counts only, not report contents.

## 13. Activity and Audit Visibility

Activity tracking is stored in `activityEvents/{eventId}` with fields such as:

- `orgId`
- `orgName`
- `action`
- `actorUid`
- `actorEmail`
- `actorName`
- `targetType`
- `targetId`
- `targetLabel`
- `summary`
- `metadata`
- `createdAt`

Activity Center and recent activity views provide operational visibility for:

- Login events.
- Registration approvals.
- Invitations.
- User actions.
- Profile updates.
- Assessment saves.
- Evidence uploads/status changes.
- Report generation.
- Tier requests/approvals.
- Program/pilot activity.

Sponsor and program observer activity views are metadata-only. Evidence activity summaries are sanitized to avoid raw evidence filenames or file content.

## 14. SuperAdmin Capabilities

SuperAdmin capabilities include:

- Main Dashboard / Super Admin panel.
- Pending Actions.
- Pending registrations approve/cancel.
- Pending upgrade requests.
- Active Orgs page.
- Dedicated Org Detail page.
- Program Management.
- Program Analytics Overview and Detail.
- Sponsor Observer Management.
- Marketplace vendor management.
- Marketplace review moderation.
- System Health.
- Feedback Review.
- Organization assignment controls for commercial/program enrollment.
- User and org overview.

### Active Orgs Page

Route:

- `/superadmin/active-orgs`

Columns:

- Company Name
- Status
- Tier
- Enrollment Type
- Program / Commercial
- Users Count
- Practices Completed
- Readiness %
- Evidence Count
- SSP Generated
- POA&M Generated
- Last Activity
- Details

### Org Detail Page

Route:

- `/superadmin/orgs/:orgId`

Sections:

- Company details.
- Users table.
- Program/commercial enrollment details.
- Assessment/readiness summary.
- Domain readiness table.
- Evidence count.
- SSP generated.
- POA&M generated.
- SPRS score.
- Vendor engagements table.
- Recent metadata-only activity.

The detail page is backed by SuperAdmin-only API endpoints and intentionally excludes raw evidence files, filenames, AI conversations, private notes, and report contents.

## 15. Marketplace Foundation

Marketplace vendor records are stored in `marketplaceVendors/{vendorId}`.

### Vendor Directory Features

- Vendor directory.
- Search and filters.
- Categories: `CONSULTING`, `SOFTWARE`, `HARDWARE`, `TRAINING`, `ASSESSMENT`, `OTHER`.
- Vendor cards.
- Vendor profile modal.
- Featured vendor flag.
- Remote availability.
- State/service area filters.
- Program support filters.
- SuperAdmin vendor add/edit.
- Vendor status: `active`, `inactive`, `archived`.

### Marketplace Backend Endpoints

- `GET /api/marketplace/vendors`
- `GET /api/admin/marketplace/vendors`
- `POST /api/admin/marketplace/vendor`

Compatibility aliases exist for direct paths and `/api/api/...` variants.

## 16. Marketplace Ratings and Reviews

Marketplace reviews are stored in `marketplaceVendorReviews/{reviewId}`.

### Review Flow

1. Authenticated org user submits review for a vendor.
2. Review is stored with `status = "pending"`.
3. SuperAdmin moderates review.
4. Approved reviews appear publicly in the vendor profile.
5. Vendor average rating and review count are updated/included.

### Review Fields

- `vendorId`
- `vendorName`
- `orgId`
- `orgName`
- `reviewerUid`
- `reviewerName`
- `reviewerEmail`
- `overallRating`
- Optional category ratings.
- `comment`
- `status`
- `createdAt`, `updatedAt`, `moderatedAt`, `moderatedBy`

Reviewer email is operational moderation data and is shown only in SuperAdmin moderation context.

### Review Endpoints

- `GET /api/marketplace/vendor/:vendorId/reviews`
- `POST /api/marketplace/vendor/:vendorId/review`
- `GET /api/admin/marketplace/reviews`
- `POST /api/admin/marketplace/review/moderate`

## 17. Vendor Engagement Tracking

Vendor engagements are stored under:

- `orgs/{orgId}/vendorEngagements/{engagementId}`

### UI Workflows

- Working With This Vendor.
- Manage Engagement.
- My Vendor Engagements.

### Engagement Statuses

- `evaluating`
- `active`
- `completed`
- `paused`
- `cancelled`

### Engagement Fields

- `vendorId`
- `vendorName`
- `vendorCategory`
- `vendorSubcategories`
- `vendorCyberAbRoles`
- `engagementType`
- `status`
- `startDate`
- `endDate`
- `serviceDescription`
- timestamps

The implementation stores engagement metadata only. It does not store pricing, contracts, private messages, or raw file content as part of the vendor engagement record.

Program Analytics and participant detail use sanitized engagement summaries.

## 18. Navigation Map

### Org User Left Sidebar

| Area | Navigation |
| --- | --- |
| Top | Command Dashboard |
| CMMC Level 1 | L1 domains from Level 1 framework |
| CMMC Level 2 | L2 domains if tier allows; otherwise Upgrade prompt |
| Awareness & Training | Interactive Modules; Verified Updates if tier allows |
| System Tools | Readiness Analyzer, Responsibility Matrix, Starter Kits, Template Assist, Evidence Library, Pilot Support, Organization Invitations, Activity Center, System Health, Feedback Review where role permits |
| Compliance Reporting | Executive Readiness Report, Readiness Vault, SPRS Scorecard, SSP, POA&M |
| Sidebar footer | Marketplace, Quick Start Guide, Support, Send Feedback, Current Tier |

Marketplace is standalone in the sidebar footer and is outside Compliance Reporting.

### SuperAdmin Dropdown/Navigation

Observed in `App.tsx`, SuperAdmin menu includes:

- Main Dashboard
- Pilot Dashboard
- Active Orgs
- PROGRAMS
- Program Analytics
- Marketplace
- Sponsor Observers
- Pending Actions
- Activity Center
- System Health
- Feedback Review

### Sponsor Observer Header Navigation

- Dashboard
- Participants
- Program Analytics
- Marketplace
- Recent Activity
- My Profile
- Logout

## 19. Firestore Collections Inventory

| Collection/path | Purpose |
| --- | --- |
| `users` | Auth-linked user metadata, roles, status, orgId, observer program scope. |
| `orgs` | Organization tenant records, tier, status, profile, enrollment/program metadata. |
| `orgs/{orgId}/members` | Organization membership records. |
| `orgMembers/{orgId}/members` | Legacy/parallel membership records used in registration/approval logic. |
| `accessRequests` | Org registrations, add-user requests, and tier upgrade requests. |
| `programs` | Program management records. |
| `marketplaceVendors` | Marketplace vendor directory records. |
| `marketplaceVendorReviews` | Marketplace vendor reviews and moderation state. |
| `orgs/{orgId}/vendorEngagements` | Organization vendor engagement metadata. |
| `activityEvents` | Platform/org activity audit metadata. |
| `pilotFeedback` | Pilot feedback queue and review status. |
| `system` | System activation/config and cleanup activity subcollection. |
| `orgs/{orgId}/assessments` | Assessment shells by level/assessment id. |
| `orgs/{orgId}/assessments/{assessmentId}/practiceRecords` | Practice status and notes records. |
| `orgs/{orgId}/assessments/{assessmentId}/objectiveRecords` | Objective-level records. |
| `orgs/{orgId}/assessments/{assessmentId}/poamItems` | POA&M items. |
| `orgs/{orgId}/assessments/{assessmentId}/scoreSnapshots` | SPRS/completion snapshots. |
| `orgs/{orgId}/evidence` | Evidence metadata records. |
| `orgs/{orgId}/evidenceLibrary` | Reusable evidence library records. |
| `orgs/{orgId}/notes` | Assessment notes. |
| `usageDaily`, `usageEvents` | Usage telemetry/operational data. |

Observed/inferred from code; verify exact naming and active production use during final QA.

## 20. Firebase Functions Endpoint Inventory

Firebase Functions exports an Express app as:

```text
export const api = onRequest({ secrets: [GEMINI_API_KEY] }, app);
```

Primary route aliases include `/api/...` and selected compatibility paths such as `/api/api/...`.

### Registration

| Method | Path | Purpose | Access | Security notes |
| --- | --- | --- | --- | --- |
| GET | `/api/registration/programs` | Public safe active program list for registration. | Public/sanitized. | Returns active safe fields only; excludes observer/internal fields. |
| GET | `/registration/programs` | Compatibility alias. | Public/sanitized. | Same handler. |
| GET | `/api/api/registration/programs` | Firebase rewrite compatibility alias. | Public/sanitized. | Same handler. |

### Evidence, OCR, AI, and Assessment Helpers

| Method | Path | Purpose | Access | Security notes |
| --- | --- | --- | --- | --- |
| POST | `/api/evidence/upload` | Backend evidence upload gateway. | Authenticated upload authorization. | Uses evidence upload auth; org-scoped. |
| POST | `/api/evidence/ocr` | OCR processing for evidence. | Authenticated. | Org/evidence authorization required. |
| POST | `/api/evidence/validate` | Evidence validation. | Authenticated. | Writes validation metadata; no client writes to validation subcollections. |
| POST | `/api/practice/copilot` | Practice-level AI assistance. | Authenticated. | Stores latest copilot result; mediated by backend. |
| POST | `/api/ai/gemini` | Gemini API proxy. | Authenticated. | Secret held in Functions environment; not exposed to client. |
| GET | `/api/admin/export-assessment` | Assessment export. | Authenticated, admin-checked. | Export authorization enforced server-side. |

### Admin/User/Org Operations

| Method | Path | Purpose | Access | Security notes |
| --- | --- | --- | --- | --- |
| GET | `/api/admin/cleanup-audit` | Cleanup/audit inventory. | SuperAdmin. | Operational metadata. |
| GET | `/api/admin/cleanup-controls` | Cleanup control inventory. | SuperAdmin. | Operational metadata. |
| POST | `/api/admin/cleanup-control` | Run cleanup/admin control. | SuperAdmin. | Guarded admin action. |
| GET | `/api/org/users` | Organization user list. | Authenticated org/SuperAdmin. | Org-scoped. |
| GET | `/api/org/invitation-inviters` | Invitation inviter display support. | Authenticated org/SuperAdmin. | Org-scoped. |
| GET | `/api/admin/pending-requests` | Pending add-user/upgrade requests. | SuperAdmin. | Admin inbox data. |
| POST | `/api/admin/pending-request-control` | Approve/reject pending action. | SuperAdmin. | Status control only. |
| POST | `/api/admin/create-invited-user-login` | Create invited user login. | SuperAdmin/admin flow. | Does not store passwords in Firestore. |
| GET | `/api/admin/sponsor-observers` | Sponsor observer list. | SuperAdmin. | Observer metadata. |
| POST | `/api/admin/sponsor-observer` | Create/update sponsor observer. | SuperAdmin. | Platform-level observer account management. |
| GET | `/api/org/active-members` | Active org members. | Authenticated org. | Org-scoped. |
| POST | `/api/org/repair-member-identities` | Member identity repair. | Authorized admin. | Operational repair. |
| POST | `/api/org/repair-user-access-record` | User access repair. | Authorized admin. | Operational repair. |
| POST | `/api/org/member-control` | Member activation/removal/control. | Authorized admin. | Org/user controls. |
| GET | `/api/me` | Current user/profile. | Authenticated. | Current user context. |
| POST | `/api/bootstrap` | Bootstrap user access. | Authenticated. | Initial/account setup support. |

### Sponsor/Program Oversight

| Method | Path | Purpose | Access | Security notes |
| --- | --- | --- | --- | --- |
| GET | `/api/pilot/oversight` | Sponsor/program observer dashboard data. | SuperAdmin, pilotObserver, programObserver. | ProgramObserver is server-scoped by `programIds`; sanitized summaries only. |
| GET | `/api/program/analytics` | Program analytics data. | SuperAdmin or authorized observer. | Sanitized metrics; no raw evidence/report contents. |
| GET | `/program/analytics` | Compatibility alias. | Same. | Same handler. |
| GET | `/api/api/program/analytics` | Compatibility alias. | Same. | Same handler. |

### SuperAdmin Active Orgs

| Method | Path | Purpose | Access | Security notes |
| --- | --- | --- | --- | --- |
| GET | `/api/admin/active-orgs` | Active organization summary list. | SuperAdmin only. | Sanitized readiness/evidence/report/vendor metadata. |
| GET | `/admin/active-orgs` | Compatibility alias. | SuperAdmin only. | Same handler. |
| GET | `/api/api/admin/active-orgs` | Compatibility alias. | SuperAdmin only. | Same handler. |
| GET | `/api/admin/org/:orgId/detail` | SuperAdmin organization detail summary. | SuperAdmin only. | Sanitized; no raw evidence filenames/files/AI/private notes/report content. |
| GET | `/admin/org/:orgId/detail` | Compatibility alias. | SuperAdmin only. | Same handler. |
| GET | `/api/api/admin/org/:orgId/detail` | Compatibility alias. | SuperAdmin only. | Same handler. |

### Marketplace Vendors

| Method | Path | Purpose | Access | Security notes |
| --- | --- | --- | --- | --- |
| GET | `/api/marketplace/vendors` | Active marketplace vendor list. | Authenticated. | Non-admin visibility filters active vendors. |
| GET | `/marketplace/vendors` | Compatibility alias. | Authenticated. | Same handler. |
| GET | `/api/api/marketplace/vendors` | Compatibility alias. | Authenticated. | Same handler. |
| GET | `/api/admin/marketplace/vendors` | Admin vendor list. | SuperAdmin. | Includes admin-visible statuses. |
| POST | `/api/admin/marketplace/vendor` | Create/update vendor. | SuperAdmin. | Admin-only mutation. |

### Marketplace Reviews

| Method | Path | Purpose | Access | Security notes |
| --- | --- | --- | --- | --- |
| GET | `/api/marketplace/vendor/:vendorId/reviews` | Approved vendor reviews. | Authenticated. | Public approved review subset. |
| POST | `/api/marketplace/vendor/:vendorId/review` | Submit review. | Authenticated org user. | Creates pending review. |
| GET | `/api/admin/marketplace/reviews` | Review moderation queue. | SuperAdmin. | Shows moderation data. |
| POST | `/api/admin/marketplace/review/moderate` | Approve/reject review. | SuperAdmin. | Updates status and vendor rating metadata. |

### Vendor Engagements

| Method | Path | Purpose | Access | Security notes |
| --- | --- | --- | --- | --- |
| GET | `/api/marketplace/engagements` | Current org vendor engagements. | Authenticated org user. | Own org only. |
| POST | `/api/marketplace/engagement` | Save current org vendor engagement. | Authenticated org user. | Own org only; metadata only. |

Compatibility aliases exist for marketplace and engagement routes under direct paths and `/api/api/...` variants where registered.

## 21. Security Baseline

Security controls observed in code:

- Firebase Auth is required for authenticated application access.
- Firestore `users/{uid}` documents determine role flags and status.
- SuperAdmin status requires `users/{uid}.status == "active"` and `roles.superAdmin == true`.
- Org user access requires active user status, active org, active membership, and role.
- `programs/{programId}` is SuperAdmin-only for read/create/update; delete is denied.
- `accessRequests` reads/writes are scoped to SuperAdmin or owning org admin/owner where applicable; delete is denied.
- Sensitive audit/activity records are append-only from the client; update/delete denied.
- Evidence validation/copilot subcollections are backend-controlled.
- Storage is org-scoped; delete is denied.
- ProgramObserver data is server-side scoped by assigned `programIds`.
- Sponsor/program observer APIs return sanitized summaries and exclude raw evidence files, filenames, AI conversations, private notes, remediation details, and report contents.
- Marketplace admin and review moderation are SuperAdmin-only.

## 22. Data Visibility Matrix

| Data category | SuperAdmin | OrgAdmin | Contributor | Assessor | Viewer | pilotObserver | programObserver |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Assessment data | All org summaries/detail; raw own/admin access per rules | Own org | Own org | Own org | Own org read-only | Sanitized summaries | Sanitized assigned-program summaries |
| Evidence metadata | All org summary/counts; raw metadata where admin accesses org | Own org | Own org | Own org | Own org read-only if policy allows | Counts/summary only | Counts/summary only |
| Evidence files | Yes by Storage rules | Own org | Own org | Own org | Own org read if policy allows | No | No |
| Evidence filenames | Avoided in sponsor/SuperAdmin summary endpoints | Own org | Own org | Own org | Own org read if policy allows | No | No |
| Report contents | SuperAdmin/admin report flows | Own org | Own org where allowed | Own org where allowed | Own org where allowed | No | No |
| Report flags/counts | Yes | Own org | Own org | Own org | Own org | Yes | Assigned program only |
| Marketplace vendors | All including admin statuses | Active vendors | Active vendors | Active vendors | Active vendors | Active vendors | Active vendors |
| Marketplace reviews | Moderation queue | Approved/public; own submissions | Approved/public; own submissions | Approved/public; own submissions | Approved/public read | Approved/public read | Approved/public read |
| Vendor engagements | Aggregated sanitized summaries; admin detail summary | Own org | Own org where allowed | Own org where allowed | Read-only if surfaced | Sanitized summaries | Sanitized assigned-program summaries |
| Program analytics | All programs | No | No | No | No | Legacy scope | Assigned programs |
| Org details | Active Orgs and Org Detail summaries | Own org profile/admin | Own org limited | Own org limited | Own org read-only | Participant summaries | Assigned participant summaries |

## 23. Current Deployment Targets

| Change type | Deployment target |
| --- | --- |
| React components, routes, services, docs copied into public assets | Hosting |
| Firebase Functions endpoint or aggregation changes | Functions |
| Firestore security rule changes | Firestore rules |
| Firebase Storage rule changes | Storage rules |
| Documentation-only files under `docs/` | No deployment unless intentionally publishing docs |

For Phase 26D implementation specifically:

- Hosting: yes
- Functions: yes
- Firestore rules: no
- Storage rules: no

## 24. Completed Phase History

| Phase | Objective | Major features | Deployment targets |
| --- | --- | --- | --- |
| Phase 24A | Sponsor Oversight and Pilot Administration. | Pilot Dashboard, sponsor observer read-only navigation, participant summaries, recent activity, sponsor-safe visibility. | Hosting, Functions, rules as required at time. |
| Phase 25A.1 | Program Management Architecture Foundation. | `programs` collection, Program Management page, add/edit/archive/reactivate, org program assignment, SuperAdmin-only program rules. | Hosting, Firestore rules. |
| Phase 25A.2 | Program Observer assignment. | Sponsor/Program Observer program assignment, `programIds`, `programCodes`, observer table/dropdowns. | Hosting; Functions only if observer endpoint changed. |
| Phase 25A.3 | Registration and Enrollment Flow. | Commercial vs Program registration, sanitized program list endpoint, pending accessRequests, approval mapping to org enrollment/program fields. | Hosting, Functions. |
| Phase 25A.4 | Program Analytics. | Program analytics endpoint/page, observer scoping, SuperAdmin overview table, program detail metrics. | Hosting, Functions. |
| Phase 26A | Marketplace Foundation. | Vendor directory, categories, search/filter, vendor profiles, SuperAdmin vendor management. | Hosting, Functions. |
| Phase 26B | Marketplace Ratings and Reviews. | Review submission, pending moderation, approve/reject, approved public reviews, ratings/counts. | Hosting, Functions. |
| Phase 26C | Vendor Engagement Tracking. | Working With This Vendor, Manage Engagement, My Vendor Engagements, org vendorEngagements subcollection. | Hosting, Functions. |
| Phase 26D | Marketplace Analytics Fix and SuperAdmin Org Detail Pages. | Active Vendor Engagements KPI fix, `/superadmin/active-orgs`, `/superadmin/orgs/:orgId`, SuperAdmin dropdown routing, sanitized active org/detail endpoints. | Hosting, Functions. |

## 25. Known Limitations / Future Work

- Marketplace "request missing vendor" workflow is not implemented.
- AI readiness-aware vendor recommendations are not implemented.
- Payment/Stripe commercial subscription activation is not implemented.
- Advanced program exports are not implemented.
- Program analytics overview currently performs per-program analytics loading from the frontend; consider a single backend overview endpoint if scale increases.
- Additional QA regression coverage is recommended for enrollment, observer scoping, marketplace engagement metrics, and SuperAdmin org detail pages.
- Production readiness should include security review, monitoring review, deployment rehearsal, and support runbook validation.
- Some collection naming is observed/inferred from code and should be verified against production data before legal/IP packaging.

## 26. Recommended Next Roadmap

Recommended next roadmap:

1. Phase 27 Pilot Production Readiness.
2. Security audit and access-control review.
3. UX polish for SuperAdmin and sponsor workflows.
4. Expanded Playwright regression coverage.
5. Program exports and sponsor reporting packages.
6. Marketplace request-vendor workflow.
7. Readiness-aware marketplace recommendations.
8. Production monitoring and alerting refinements.
9. Documentation package conversion for sponsor/customer distribution.

## 27. Appendix

### Glossary

| Term | Definition |
| --- | --- |
| Program | A sponsored, state, partner, internal, or commercial program record used to enroll and scope organizations. |
| Commercial enrollment | An organization joins through the commercial subscription path and receives `COMM_L1` or `COMM_L2`. |
| Sponsored enrollment | An organization joins through a sponsor/program path and is linked to `programId`, `programName`, and `programCode`. |
| Sponsor Observer | User-facing label for platform-level read-only sponsor oversight roles. |
| pilotObserver | Legacy internal role flag for broad pilot observer access. |
| programObserver | Internal role flag for program-scoped observer access. |
| Vendor engagement | Organization-level metadata indicating a vendor is being evaluated, actively used, completed, paused, or cancelled. |
| Marketplace review | Moderated vendor review submitted by an org user and approved/rejected by SuperAdmin. |
| Readiness summary | Sanitized summary of assessment completion, SPRS, domain readiness, evidence counts, report flags, and activity metadata. |
| SSP | System Security Plan. |
| SPRS | Supplier Performance Risk System. |
| POA&M | Plan of Action and Milestones. |
| FCI | Federal Contract Information. |
| CUI | Controlled Unclassified Information. |

### Key Baseline Principles

- Use backend endpoints for cross-org, sponsor, program, and SuperAdmin summaries.
- Keep direct Firestore access org-scoped unless rules explicitly allow SuperAdmin.
- Preserve programObserver scoping precedence over legacy pilotObserver fallback.
- Do not expose raw evidence files, filenames, AI conversations, private notes, remediation details, or report contents in sponsor/program observer views.
- Treat marketplace as an ecosystem directory and engagement tracker, not a contracting, pricing, or private messaging system.
