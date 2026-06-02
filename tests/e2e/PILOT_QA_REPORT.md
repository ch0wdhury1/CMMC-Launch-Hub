# Pilot QA Report

Date: 2026-06-02
Environment: Local development baseline
Base URL: http://127.0.0.1:5173
Build/Commit: codex-migration / 40e8c2b

## Summary

Passed: 2
Failed: 0
Skipped: 22
Warnings: Safe QA credentials were not available in the workspace. Credentialed and mutating pilot validation remains outstanding.

The Playwright HTML report was generated in `playwright-report/`. The local `.env.e2e` file exists and is ignored by Git. Its credential fields remain empty so no production or personal secrets are introduced.

## Results by Area

| Area | Result | Notes |
| ---- | ------ | ----- |
| Registration/Login | PARTIAL | Login and registration page-load smoke tests passed. Pending registration creation was intentionally skipped because the opt-in flag is disabled. |
| SuperAdmin Approval | NOT RUN | Safe SuperAdmin QA credentials were not supplied. |
| Role Access | NOT RUN | OrgAdmin, contributor, assessor, viewer, and inactive QA credentials were not supplied. |
| Org Isolation | NOT RUN | Requires approved QA org credentials. |
| Company Profile | NOT RUN | Requires approved OrgAdmin QA credentials. |
| Invitations/User Management | NOT RUN | Requires approved OrgAdmin QA credentials. Mutation remains opt-in. |
| Assessment Persistence | NOT RUN | Requires approved QA assessment credentials. Record mutation remains opt-in. |
| Evidence Upload/OCR | NOT RUN | Requires a dedicated QA org and explicit evidence-upload opt-in. |
| Reports | NOT RUN | Requires approved OrgAdmin QA credentials. |
| Security Isolation | NOT RUN | Requires role-specific QA credentials. |
| Pilot Simulation | NOT RUN | Requires approved OrgAdmin QA credentials. |

## Blocking Issues

| Severity | Area | Issue | Recommended Fix |
| -------- | ---- | ----- | --------------- |
| HIGH | Pilot QA | Dedicated safe QA account credentials were not available, so authenticated pilot flows could not be validated. | Populate the ignored `.env.e2e` locally with staging or disposable QA credentials and rerun the non-mutating suite. |
| HIGH | Pilot QA | Mutating QA flows were not run because no dedicated disposable QA org was confirmed. | Confirm a disposable QA org, enable mutation flags selectively, and rerun the affected specs. |

## Non-Blocking Issues

| Area | Issue | Recommendation |
| ---- | ----- | -------------- |
| Build | Vite reports a production chunk larger than 500 kB after minification. | Track code splitting as a post-pilot performance task unless load-time testing identifies a blocker. |

## Recommendation

* Not Pilot Ready

The public authentication surface is healthy, but authenticated access, org isolation, profile management, persistence, evidence, reports, and the pilot simulation still require execution with dedicated QA accounts before a pilot-ready recommendation can be made.
