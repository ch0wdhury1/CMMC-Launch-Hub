import { expect, test } from "@playwright/test";
import { expectAppShell, login } from "./helpers/auth";
import { env, hasCredential } from "./helpers/env";

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
