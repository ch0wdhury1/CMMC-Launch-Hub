import { test } from "@playwright/test";
import { login } from "./helpers/auth";
import { env, hasCredential } from "./helpers/env";

test.beforeEach(async ({ page }) => {
  test.skip(!hasCredential(env.orgAdmin), "Provide E2E_ORGADMIN credentials.");
  await login(page, env.orgAdmin.email, env.orgAdmin.password);
});

test("Assessment practice library loads", async ({ page }) => {
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
});

test("Practice, objective, note, and assignment persistence", async () => {
  test.skip(!env.runMutatingAssessment, "Set E2E_RUN_MUTATING_ASSESSMENT_TESTS=true for a dedicated QA assessment.");
  test.skip(true, "Choose a stable QA practice/objective fixture before enabling record mutation assertions.");
});
