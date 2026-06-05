# Reporting Polish Notes

Phase: 27F — Reporting Polish  
Date: June 5, 2026  
Deployment: Not deployed

## Reports Reviewed

- System Security Plan / SSP PDF
- Executive Readiness Report PDF
- POA&M Report PDF
- SPRS Scorecard PDF
- Shared Responsibility Matrix PDF
- Training / Awareness: no dedicated training PDF export was found in the current implemented training module

## Fixes Made

### System Security Plan PDF

- Replaced HTML-rendered header/cover generation with direct jsPDF layout.
- Added a clean cover page with organization, assessment, CMMC level, generated date, contact details, prepared-by text, readiness summary, and disclaimer.
- Added an organization profile page.
- Added a system / assessment scope page with clean `Not provided` fallbacks.
- Rebuilt practice/objective detail as a paginated table with:
  - practice ID and title
  - domain
  - status
  - assignee
  - implementation notes
  - evidence count
  - responsibility summary
  - assessment objectives
- Added consistent footer: `CMMC Launch Hub — System Security Plan | Page X of Y`.
- Preserved existing SSP tier gate. Unauthorized tiers still do not see the SSP PDF button.

### Executive Readiness Report PDF

- Added consistent report footer and page numbering.
- Improved title/summary layout.
- Added safer fallbacks for missing report values.
- Improved table wrapping and cell padding.
- Kept report data and scoring logic unchanged.

### POA&M Report PDF

- Added consistent report footer and page numbering.
- Improved table wrapping and column widths for long weakness/remediation text.
- Added an export path for the professional empty-state report.
- Kept POA&M data and status logic unchanged.

### SPRS Scorecard PDF

- Regression checked the Phase 27E-FIX export.
- Confirmed page 1 remains summary-only.
- Confirmed mapped controls begin after the summary.
- Confirmed no CMMC practice/objective dump is included.

### Shared Responsibility Matrix PDF

- Replaced HTML-rendered header with direct jsPDF layout.
- Improved table column widths and text wrapping.
- Added consistent footer and page numbering.

## Shared Formatting Helpers

Created `services/reportPdfUtils.ts` with:

- `notProvided`
- `cleanFilePart`
- `companyName`
- `drawCompanyHeader`
- `addReportFooter`
- `sectionTitle`
- `keyValueTable`
- `addWrappedParagraph`
- shared report colors

## Manual Validation Checklist

Build:

- `npm run build` passed.
- Existing Vite large chunk warning remains.

Diff hygiene:

- `git diff --check` passed with line-ending warnings only.

Generated and inspected PDFs:

- `test-results/phase27f-pdfs/executive-Executive_Readiness_Report_2026-06-05.pdf`
- `test-results/phase27f-pdfs/poam-POAM_Report_2026-06-05.pdf`
- `test-results/phase27f-pdfs/sprs-SPRS_Scorecard_Current_Assessment.pdf`
- `test-results/phase27f-pdfs/ssp-SSP_QA_Test_Company_2026-06-05.pdf`
- `test-results/phase27f-pdfs/srm-SRM_QA_Test_Company_2026-06-05.pdf`

Inspection results:

- No blank pages found.
- Required section markers were present.
- Organization names appeared correctly in generated validation PDFs.
- SPRS did not include the old CMMC practice/objective dump.
- Footers were present.
- Browser PDF generation produced no console errors.

## Remaining Report Limitations

- Phase 27F-FIX 3 removed the direct left-navigation entry for `POA&M Report`; the report remains available from the POA&M management page via the `POA&M Report` button.
- Phase 27F-FIX 3 tightened the POA&M detailed PDF table widths so the landscape export stays within the printable page width.
- Phase 27F-FIX 3 split the SSP practice/objective detail into two landscape tables: a practice summary table and an objective/detail table. This preserves table formatting while giving Assessment Objectives enough width to wrap cleanly.
- Current desktop sandbox validation could not complete `npm run build` because `npm` is unavailable on PATH and the equivalent Vite build through the bundled Node runtime was blocked by the managed filesystem approval limit. `git diff --check` passed.
- The current QA org used for local app validation does not expose SSP or SRM because those entries are tier-gated. SSP and SRM generator output was validated through the local Vite module graph with representative data instead of changing organization tier or Firestore data.
- The POA&M validation dataset was empty, so the generated POA&M PDF validates the empty-state export path. A populated POA&M dataset should be used before customer demos that emphasize remediation item layout.
- Training / Awareness does not currently provide a dedicated PDF export to polish.

## Tier Enforcement Preservation

- COMM_L1 remains unable to see the SSP PDF export button.
- COMM_L2 remains the effective tier required for SSP PDF export.
- No Firestore rules were changed during Phase 27F.
- No Storage rules were changed during Phase 27F.
