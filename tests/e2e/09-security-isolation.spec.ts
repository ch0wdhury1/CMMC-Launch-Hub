import { expect, test } from "@playwright/test";
import { expectAppShell, login, logout } from "./helpers/auth";
import { env, hasCredential } from "./helpers/env";
import { objectiveCard, uploadEvidence } from "./helpers/evidence";
import { goToCompanyProfile, goToPractice, goToReports, saveAssessment } from "./helpers/navigation";

test("OrgAdmin does not receive SuperAdmin controls", async ({ page }) => {
  test.skip(!hasCredential(env.orgAdmin), "Provide E2E_ORGADMIN credentials.");
  await login(page, env.orgAdmin.email, env.orgAdmin.password);
  await expectAppShell(page);
  await expect(page.getByRole("button", { name: "Super Admin", exact: true })).toHaveCount(0);
});

test("Approved org context survives localStorage clearing", async ({ page }) => {
  test.skip(!hasCredential(env.orgAdmin), "Provide E2E_ORGADMIN credentials.");
  await page.goto("/login");
  await page.evaluate(() => localStorage.clear());
  await login(page, env.orgAdmin.email, env.orgAdmin.password);
  await expectAppShell(page);
  await expect(page.getByRole("button", { name: "Super Admin", exact: true })).toHaveCount(0);
});

test("QA Test Company and QA Isolation Company profiles and users are isolated", async ({ page }) => {
  test.skip(!hasCredential(env.orgAdmin) || !hasCredential(env.isolationAdmin), "Provide both QA organization admin credentials.");

  await login(page, env.orgAdmin.email, env.orgAdmin.password);
  await goToCompanyProfile(page);
  await expect(page.getByText(env.testOrgName, { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: `Users for ${env.testOrgName}`, exact: true })).toBeVisible();
  await expect(page.getByText(env.isolationOrgName, { exact: true })).toHaveCount(0);
  await expect(page.getByText(env.isolationAdmin.email, { exact: true })).toHaveCount(0);
  await logout(page);

  await login(page, env.isolationAdmin.email, env.isolationAdmin.password);
  await goToCompanyProfile(page);
  await expect(page.getByText(env.isolationOrgName, { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: `Users for ${env.isolationOrgName}`, exact: true })).toBeVisible();
  await expect(page.getByText(env.testOrgName, { exact: true })).toHaveCount(0);
  await expect(page.getByText(env.orgAdmin.email, { exact: true })).toHaveCount(0);
});

test("Assessment and evidence markers do not cross organization boundaries", async ({ page }) => {
  test.skip(!env.runMutatingAssessment || !env.runEvidenceUpload || !hasCredential(env.orgAdmin) || !hasCredential(env.isolationAdmin), "Requires both QA admins and hosted mutation flags.");

  const assessmentMarker = `Phase 26C assessment isolation ${Date.now()}`;
  const evidenceMarker = `phase-26c-isolation-${Date.now()}.txt`;

  await login(page, env.orgAdmin.email, env.orgAdmin.password);
  await goToPractice(page);
  const testCompanyObjective = objectiveCard(page);
  await testCompanyObjective.getByPlaceholder("Document implementation details or N/A justification here...").fill(assessmentMarker);
  await uploadEvidence(page, evidenceMarker, "Phase 26C cross-organization evidence isolation fixture.");
  await expect(testCompanyObjective.getByText(evidenceMarker, { exact: true })).toBeVisible();
  await saveAssessment(page);
  await logout(page);

  await login(page, env.isolationAdmin.email, env.isolationAdmin.password);
  await goToPractice(page);
  const isolationObjective = objectiveCard(page);
  await expect(isolationObjective.getByPlaceholder("Document implementation details or N/A justification here...")).not.toHaveValue(assessmentMarker);
  await expect(isolationObjective.getByText(evidenceMarker, { exact: true })).toHaveCount(0);
});

test("Executive reports remain scoped to the signed-in organization", async ({ page }) => {
  test.skip(!hasCredential(env.orgAdmin) || !hasCredential(env.isolationAdmin), "Provide both QA organization admin credentials.");

  await login(page, env.orgAdmin.email, env.orgAdmin.password);
  await goToReports(page, "Executive Readiness Report");
  await page.getByRole("button", { name: "Generate Report", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Organization Summary", exact: true })).toBeVisible();
  await expect(page.getByText(env.testOrgName, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(env.isolationOrgName, { exact: true })).toHaveCount(0);
  await logout(page);

  await login(page, env.isolationAdmin.email, env.isolationAdmin.password);
  await goToReports(page, "Executive Readiness Report");
  await page.getByRole("button", { name: "Generate Report", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Organization Summary", exact: true })).toBeVisible();
  await expect(page.getByText(env.isolationOrgName, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(env.testOrgName, { exact: true })).toHaveCount(0);
});
