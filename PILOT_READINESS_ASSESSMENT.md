# CMMC Launch Hub Controlled Pilot Readiness Assessment

Date: 2026-06-05  
Assessment Scope: Current platform and pilot launch package  
Recommended Pilot Audience: Connecticut manufacturers and defense contractors  
Recommended Initial Cohort: 3-5 organizations

## 1. Executive Summary

CMMC Launch Hub is ready for a controlled pilot with a small, guided cohort. The platform now has the core workflows needed to support pilot organizations: organization onboarding, role-based access, Company Profile source-of-truth data, Organization Dashboard, assessment workflows, evidence upload and OCR, reporting, tier-aware navigation, Activity Center, System Health, and a complete pilot documentation package.

The platform has already passed hosted pilot validation for the most critical workflows: login, role access, inactive-user blocking, Company Profile access, invitations, assessment persistence, evidence upload/OCR/view/download/archive, Executive and POA&M reporting, cross-organization isolation, and viewer evidence-control restrictions. The latest pilot package adds the operational materials needed to run a small launch with direct founder support.

The assessment recommendation is **Go for controlled pilot** with strict boundaries:

- Start with 3-5 organizations.
- Use guided onboarding.
- Provide direct founder support.
- Monitor OCR, onboarding friction, report quality, tier confusion, and security/isolation concerns.
- Do not expand beyond the controlled pilot until remaining yellow risks are addressed or accepted.

## 2. Green Findings

### Organization Onboarding

- SuperAdmin workflows support reviewing and managing organization requests.
- The pilot enrollment guide now defines candidate fit, required setup information, first-session workflow, and onboarding completion criteria.
- Organization records can carry source-of-truth profile fields needed for reports and operations.

### Registration Approval

- Registration and pending approval pages have been validated at the browser level.
- SuperAdmin pending registration workflows exist.
- The intentionally destructive registration creation and row-specific approval tests remain skipped until disposable fixtures are available, but the workflow is documented.

### User Management

- OrgAdmin and OrgOwner user-management workflows exist.
- Invitations are supported.
- Active, inactive, and disabled access behaviors have been tested, including inactive Viewer blocking.
- Contributor, Assessor, and Viewer users do not receive organization user-management controls.

### Company Profile

- Company Profile has been upgraded into the organization source-of-truth record.
- It now includes organization identity, contacts, government identifiers, compliance profile, scope, external providers, readiness metrics, completeness, and data-quality flags.
- OrgAdmin and SuperAdmin edit access is preserved.
- Contributor, Assessor, and Viewer behavior remains read-only.

### Assessments

- CMMC practice and objective navigation is implemented.
- Objective status, practice note, objective note, and assignment persistence passed hosted validation.
- The Command Dashboard now provides an organization-level landing page before deeper assessment navigation.

### Evidence Workflows

- Evidence upload, storage confirmation, OCR display, View, Download, Archive, and archived evidence display passed hosted validation.
- Viewer evidence mutation controls were fixed and validated.
- Evidence workflows are documented in onboarding, support, and operations materials.

### OCR

- OCR preview works when processing succeeds.
- The application preserves uploaded evidence if OCR fails.
- OCR failure support guidance exists in the operations and support materials.

### Reporting

- Executive Readiness and POA&M reports generate or show valid empty states with signed-in organization identity.
- Report identity defects from earlier QA were fixed and validated.
- Reporting polish work improved PDF readability for major exports.

### SSP

- SSP PDF export is formatted for pilot use and remains tier-gated.
- The Phase 27G blank-screen regression was fixed by safely rendering structured address data on the SSP page.
- COMM_L1 no longer sees the SSP PDF download button; COMM_L2 remains the intended advanced SSP export tier.

### SPRS

- SPRS Scorecard export was rebuilt as a scorecard-focused report.
- The old full CMMC practice/objective dump was removed from the SPRS export.
- SPRS is available as a pilot reporting shortcut where tier policy permits.

### POA&M

- POA&M report generation/empty-state handling is validated.
- POA&M PDF layout was improved.
- POA&M navigation was simplified to keep the management page as the primary entry point, with report access from the POA&M page.

### Responsibility Matrix

- Responsibility Matrix is implemented and PDF export formatting has been polished.
- Responsibility Matrix is treated as advanced COMM_L2 functionality.

### Activity Center

- Activity Center exists for audit and support review.
- OrgAdmin/OrgOwner access is organization-scoped.
- SuperAdmin can view all pilot activity.
- Pilot-critical events such as invitations, profile updates, assessment saves, evidence actions, and report generation are logged.

### System Health

- System Health Dashboard is implemented for SuperAdmin only.
- It provides operational visibility into organizations, users, registrations, invitations, tier upgrades, evidence uploads, reports, OCR health, organization health, alerts, and recent activity.

### Organization Dashboard

- Organization Dashboard v1 is implemented as the normal landing page for non-SuperAdmin users.
- It shows organization identity, tier, profile completeness, readiness cards, domain readiness, next actions, evidence snapshot, recent activity, and tier-aware reporting shortcuts.
- Targeted Playwright coverage passed for OrgAdmin, Contributor, Viewer, dashboard cards, and COMM_L1 shortcut hiding.

### Tier Enforcement

- Tier enforcement has been audited.
- SPONSORED and COMM_L1 are blocked from Level 2 navigation.
- COMM_L2 receives the advanced platform paths.
- SSP PDF export is gated to COMM_L2.
- Invitation capacity checks account for active users and pending invitations in the normal application path.

### Pilot Documentation

- The pilot launch package is complete.
- Operations, onboarding, support, sponsor, enrollment, FAQ, pricing/tier, and success metric documents are present.
- The documentation reflects implemented functionality rather than future features.

## 3. Yellow Findings

### Registration Approval Test Coverage

Registration creation and row-specific approval tests remain intentionally skipped until safe disposable fixtures are available. This is acceptable for a guided pilot but should be addressed before wider self-service onboarding.

### OCR Reliability

OCR can temporarily fail during model high-demand periods. The app handles the failure state and preserves evidence, but pilot support must monitor recurrence and participant confusion.

### Direct Rules-Level Authorization Testing

Browser-based cross-organization isolation testing passed, but direct Firestore and Storage authorization-denial testing is not yet part of the automated suite.

### Tier Fixture Coverage

There are not yet dedicated hosted fixtures proving SPONSORED, COMM_L1, and COMM_L2 behavior side-by-side in Playwright. Current tier enforcement is supported by code audit and targeted validation, but broader automated tier coverage is recommended.

### Seat Counter Authority

Application logic checks active users and pending invitations, and rules use cached capacity where available. Firestore rules cannot aggregate subcollections dynamically, so authoritative seat counters should eventually be maintained by backend transaction or Cloud Function.

### Centralized Entitlement Policy

Tier enforcement exists through navigation, component props, and service checks. A future central entitlement module would reduce drift as the product grows.

### AI Feature Enforcement

AI-related capabilities are not consistently centralized behind a single entitlement policy. OCR is treated as evidence-processing infrastructure, but future AI bundles or billing would need stronger policy boundaries.

### SSP Preview Visibility

COMM_L1 no longer receives SSP PDF export, but the tier audit notes that SSP preview visibility is still broader than export visibility. This is not a pilot blocker if intentional, but expectations should be clear.

### Support Load

The pilot assumes direct founder support. This is appropriate for 3-5 organizations, but not yet scalable for a larger cohort without triage tooling and support staffing.

## 4. Red Findings

No active red findings block a controlled pilot.

The prior red-class defects have been remediated:

- Viewer evidence upload and archive controls exposed: fixed and validated.
- Edit My Info not persisting: fixed and validated.
- Report identity missing organization name: fixed and validated.
- SSP page blank-screen regression after Company Profile expansion: fixed and locally validated.

Red conditions that would immediately trigger a pilot pause:

- Any cross-organization data visibility.
- Unauthorized SuperAdmin controls for non-SuperAdmin users.
- Viewer evidence mutation controls.
- Report identity showing another organization.
- Evidence access or download crossing organization boundaries.
- Repeated profile, assessment, or evidence save failures across multiple pilot organizations.

## 5. Pilot Risks

| Risk | Level | Assessment |
| ---- | ---- | ---- |
| Participant onboarding confusion | Medium | Guided onboarding and enrollment docs reduce risk. |
| OCR inconsistency | Medium | Known limitation; support workflow exists. |
| Tier expectation mismatch | Medium | Pricing/tier doc and dashboard shortcut gating reduce risk. |
| Report interpretation as certification | Medium | Docs clearly state pilot is not formal certification. |
| Small sample bias | Medium | 3-5 organizations are enough for controlled validation, not market proof. |
| Support dependency on founder | Medium | Acceptable for controlled pilot, risky for expansion. |

## 6. Operational Risks

- Support workflows are documented but depend on disciplined issue logging.
- Direct founder support is feasible only for the recommended small cohort.
- Registration approval remains partially manually validated.
- Disposable fixture strategy is not complete for destructive onboarding tests.
- Pilot feedback must be actively collected; passive feedback will under-detect friction.
- System Health and Activity Center should be reviewed regularly during launch, not only during incidents.

## 7. Technical Risks

- Large frontend bundle warning remains during build; not a pilot blocker, but code-splitting should be considered later.
- Central entitlement enforcement is not yet consolidated.
- Firestore rules cannot dynamically count users/invitations; cached counters need future authoritative maintenance.
- Direct authorization-denial testing should be added.
- OCR depends on model/service availability.
- AI feature gating should be revisited before billing, usage limits, or premium AI packaging.

## 8. Security Review

### Validated Security Strengths

- OrgAdmin does not receive SuperAdmin controls.
- Contributor, Assessor, and Viewer do not receive organization user-management controls.
- Viewer cannot see evidence upload, direct file input, archive, or unarchive controls.
- Inactive Viewer access is blocked.
- Organization profile, user list, assessment markers, evidence markers, and report identity have passed cross-org isolation checks.
- No Firestore or Storage rules were loosened during pilot remediation.

### Security Gaps To Address Before Broader Launch

- Add direct Firestore authorization-denial tests.
- Add direct Storage authorization-denial tests.
- Add side-by-side SPONSORED/COMM_L1/COMM_L2 Playwright fixtures.
- Centralize entitlement checks for reports, exports, AI features, and advanced tools.
- Add formal security review before expanding beyond pilot participants.

### Security Go Criteria For Controlled Pilot

The platform meets controlled pilot security criteria if pilot staff monitor for cross-org visibility, unauthorized controls, evidence mutation exposure, and report identity errors, and if any such issue triggers immediate escalation.

## 9. Support Readiness

Support readiness is strong for a small, guided cohort.

Ready support assets:

- Pilot Operations Runbook.
- Pilot Support Playbook.
- Pilot Admin Checklist.
- Pilot Onboarding Guide.
- Pilot Enrollment Guide.
- Pilot FAQ.
- Pilot Success Metrics.
- Pilot escalation workflow.
- Pilot feedback collection process.

Support model:

- Direct founder support.
- Guided onboarding.
- Weekly feedback and issue review.
- Activity Center and System Health for support triage.

Support gaps:

- No in-app support ticketing.
- No email notification system.
- No scalable support staffing model.
- No automated sponsor-facing aggregate dashboard.

These gaps do not block a 3-5 organization pilot but do block a larger unattended rollout.

## 10. Recommended Pilot Size

Recommended pilot size: **3-5 organizations**.

Rationale:

- Small enough for direct founder support.
- Large enough to test multiple organization profiles, roles, evidence patterns, and report expectations.
- Appropriate for Connecticut manufacturers and defense contractors with guided onboarding.
- Limits risk while validating real workflows.

Recommended participant mix:

- 1-2 Level 1-focused organizations.
- 1-2 Level 2-interested organizations.
- 1 sponsor-supported or early-discovery organization if available.

## 11. Recommended Pilot Duration

Recommended duration: **6-8 weeks**.

Suggested schedule:

| Period | Focus |
| ---- | ---- |
| Week 1 | Enrollment, account setup, Company Profile completion, dashboard walkthrough. |
| Weeks 2-3 | Assessment navigation, evidence upload, OCR review, early support feedback. |
| Weeks 4-5 | Reporting, POA&M review, Responsibility Matrix/SSP for eligible tiers. |
| Week 6 | Feedback consolidation, support issue review, success metrics checkpoint. |
| Weeks 7-8 | Optional extension for Level 2 workflows, sponsor review, and remediation validation. |

## 12. Go / No-Go Recommendation

Recommendation: **GO for controlled pilot**.

Conditions:

- Keep the cohort to 3-5 organizations.
- Use guided onboarding.
- Provide direct founder support.
- Monitor OCR, evidence, report identity, tier confusion, and cross-organization isolation daily during initial onboarding.
- Do not enable broad self-service enrollment yet.
- Do not market the platform as certification or assessment replacement.
- Do not expand beyond the controlled pilot until yellow findings are reviewed.

No-Go triggers:

- Any unresolved cross-organization data visibility.
- Any unauthorized evidence mutation controls for Viewer.
- Any report showing the wrong organization identity.
- Any repeated evidence upload or assessment-save failure across organizations.
- Any inability to support pilot users within the promised response window.

Final assessment: CMMC Launch Hub is **Controlled Pilot Ready** for a small, closely supported launch with documented risks and clear escalation procedures.
