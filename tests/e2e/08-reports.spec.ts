import { expect, test } from "@playwright/test";
import { login } from "./helpers/auth";
import { env, hasCredential } from "./helpers/env";
import { goToReports } from "./helpers/navigation";

test.beforeEach(async ({ page }) => {
  test.skip(!hasCredential(env.orgAdmin), "Provide E2E_ORGADMIN credentials.");
  await login(page, env.orgAdmin.email, env.orgAdmin.password);
});

test("Executive report generates from live assessment data", async ({ page }) => {
  await goToReports(page, "Executive Readiness Report");
  await page.getByRole("button", { name: "Generate Report" }).click();
  await expect(page.getByRole("heading", { name: "Readiness Summary", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Export PDF" })).toBeVisible();
});

test("POA&M report page generates or shows its empty state", async ({ page }) => {
  await goToReports(page, "POA&M Report");
  const generate = page.getByRole("button", { name: "Generate Report" });
  if (await generate.isVisible()) await generate.click();
  await expect(page.getByRole("heading", { name: "POA&M Report", exact: true }).first()).toBeVisible();
  await expect(page.getByText(env.testOrgName, { exact: true }).first()).toBeVisible();
});
