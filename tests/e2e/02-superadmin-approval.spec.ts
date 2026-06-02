import { expect, test } from "@playwright/test";
import { expectAppShell, login } from "./helpers/auth";
import { env, hasCredential } from "./helpers/env";
import { goToSuperAdmin } from "./helpers/navigation";

test.beforeEach(async ({ page }) => {
  test.skip(!hasCredential(env.superAdmin), "Provide E2E_SUPERADMIN credentials.");
  await login(page, env.superAdmin.email, env.superAdmin.password);
  await expectAppShell(page);
  await goToSuperAdmin(page);
});

test("SuperAdmin login and pending registrations load", async ({ page }) => {
  await expect(page.getByText("Pending Registrations")).toBeVisible();
});

test("Active, inactive, and archived org tabs load", async ({ page }) => {
  await expect(page.getByRole("button", { name: "Active Orgs" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Inactive Orgs" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Archived Orgs" })).toBeVisible();
});

test("Approve a QA registration", async () => {
  test.skip(!env.runMutatingAdmin, "Set E2E_RUN_MUTATING_ADMIN_TESTS=true after creating a disposable QA registration.");
  test.skip(true, "Select a known disposable pending registration before enabling this row-specific approval test.");
});
