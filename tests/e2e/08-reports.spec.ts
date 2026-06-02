import { expect, test } from "@playwright/test";
import { login } from "./helpers/auth";
import { env, hasCredential } from "./helpers/env";

test.beforeEach(async ({ page }) => {
  test.skip(!hasCredential(env.orgAdmin), "Provide E2E_ORGADMIN credentials.");
  await login(page, env.orgAdmin.email, env.orgAdmin.password);
});

test("Executive report generates from live assessment data", async ({ page }) => {
  await page.getByRole("button", { name: /Executive/i }).click();
  await page.getByRole("button", { name: "Generate Report" }).click();
  await expect(page.getByText("Readiness Summary")).toBeVisible();
  await expect(page.getByRole("button", { name: "Export PDF" })).toBeVisible();
});

test("POA&M report page generates or shows its empty state", async ({ page }) => {
  await page.getByRole("button", { name: /POA&M Report/i }).click();
  const generate = page.getByRole("button", { name: "Generate Report" });
  if (await generate.isVisible()) await generate.click();
  await expect(page.getByText(/POA&M Report|No POA&M items found/i).first()).toBeVisible();
});
