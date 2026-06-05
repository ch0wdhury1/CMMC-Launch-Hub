# CMMC Launch Hub Pilot Launch Checklist

## Purpose

This checklist prepares CMMC Launch Hub for onboarding the first controlled pilot organizations. It reflects the current pilot platform: organization onboarding, SuperAdmin approval, user management, Company Profile, assessments, Evidence Library, OCR, SSP, SPRS, POA&M, Responsibility Matrix, Executive Reporting, Activity Center, System Health, Organization Dashboard, tiering, Support Page, and Feedback Center.

## Pilot Scope

- Initial cohort: 3-5 Connecticut manufacturers or defense contractors.
- Support model: guided onboarding with direct founder support.
- Environment: Firebase Hosting production pilot environment.
- Deployment posture: deploy only approved hosting changes unless functions or security rules are intentionally changed in a future approved phase.

## Pre-Launch Readiness

- Confirm Firebase Hosting is reachable.
- Confirm SuperAdmin account can sign in.
- Confirm pilot organization records are approved and active.
- Confirm each pilot organization has the intended tier:
  - SPONSORED for limited Level 1 access.
  - COMM_L1 for commercial Level 1 access.
  - COMM_L2 for full platform access.
- Confirm QA accounts and production pilot accounts are separate.
- Confirm Organization Dashboard loads for non-SuperAdmin users.
- Confirm SuperAdmin panel, Activity Center, System Health, and Feedback Review are SuperAdmin-visible as intended.
- Confirm OrgAdmin, Contributor, Assessor, and Viewer role access remains least-privileged.

## Onboarding Steps

1. Register the pilot organization or confirm an existing registration request.
2. SuperAdmin reviews and approves the registration.
3. Confirm organization identity, tier, subscription status, and pilot participant status.
4. OrgAdmin signs in and completes Company Profile source-of-truth fields.
5. OrgAdmin invites approved pilot participants with least-privileged roles.
6. Pilot users sign in and confirm Command Dashboard access.
7. OrgAdmin or Assessor reviews Level 1 or Level 2 assessment scope based on tier.
8. Contributors and Assessors upload evidence where authorized.
9. OrgAdmin reviews OCR output, evidence records, POA&M items, and report outputs.
10. Pilot team generates Executive Readiness, SPRS, POA&M, SSP, and Responsibility Matrix reports only where tier permits.

## Support Workflow

1. Pilot participant opens the Support Page from System Tools or the pilot banner.
2. Participant uses Send Feedback from any authenticated page.
3. Participant selects category:
   - Bug
   - Feature Request
   - Question
   - Other
4. Participant includes page context, expected result, observed result, and impact.
5. SuperAdmin reviews the feedback queue from System Tools > Feedback Review.
6. SuperAdmin marks feedback as New, Reviewed, or Closed.
7. Confirmed application defects are tracked for a controlled remediation phase.
8. Fixture limitations, training questions, and documentation gaps are handled separately from defects.

## Feedback Workflow

- New: feedback has been submitted and has not yet been triaged.
- Reviewed: SuperAdmin has inspected the feedback and determined the support path.
- Closed: feedback has been answered, documented, or moved into a planned remediation item.

Feedback triage should capture:

- Organization.
- User role.
- Page or workflow.
- Category.
- Severity and pilot impact.
- Whether the issue is a training question, fixture limitation, documentation gap, or confirmed defect.

## Pilot Review Cadence

- Daily during the first week:
  - Review Feedback Review queue.
  - Review System Health alerts and recent activity.
  - Check OCR failures and report generation activity.
  - Check pending registrations and invitations.
- Weekly during the active pilot:
  - Review pilot success metrics.
  - Review top feedback themes.
  - Review tier enforcement and role-access issues.
  - Review support response time.
  - Review readiness progress per organization.
- End of pilot:
  - Export final reports for each participating organization as applicable.
  - Summarize validated workflows, known limitations, defects, and requested enhancements.
  - Prepare Phase 29 planning recommendations.

## Go-Live Checks

- Build passes.
- Targeted Playwright smoke tests pass or skipped only because credentials are not configured.
- No Firestore or Storage rules are loosened.
- No unapproved functions deployment is required.
- No production credentials are changed.
- SuperAdmin can access Feedback Review.
- Non-SuperAdmin users cannot access Feedback Review.
- Organization users can access Support Page.
- Organization users can open Send Feedback modal.
- Pilot participant banner appears for organization users.

## Escalation Paths

- Critical blocker: impacts login, access control, evidence, report generation, or organization isolation.
- High priority: prevents a core pilot workflow for one organization.
- Medium priority: creates confusion but has a documented workaround.
- Low priority: cosmetic, copy, or documentation issue.

Critical and high-priority issues should be reviewed before expanding the pilot cohort.
