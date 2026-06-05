import { expect, test } from "@playwright/test";
import { expectAppShell, login, logout } from "./helpers/auth";
import { env, hasCredential } from "./helpers/env";
import { goToSuperAdmin } from "./helpers/navigation";

async function tryOpenUpgradeModal(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "CMMC LEVEL 2", exact: true }).click();
  const upgradeButton = page.getByRole("button", { name: "Upgrade to unlock Level 2", exact: true });
  if (!(await upgradeButton.isVisible().catch(() => false))) return false;
  await upgradeButton.click();
  await expect(page.getByRole("heading", { name: "Upgrade", exact: true })).toBeVisible();
  return true;
}

test("Upgrade modal CTA creates or detects a pending COMM_L2 request", async ({ page }) => {
  test.skip(!env.runMutatingAdmin, "Set E2E_RUN_MUTATING_ADMIN_TESTS=true to create hosted upgrade requests.");
  test.skip(!hasCredential(env.orgAdmin), "Provide E2E_ORGADMIN credentials.");
  test.skip(!hasCredential(env.superAdmin), "Provide E2E_SUPERADMIN credentials.");
  await login(page, env.orgAdmin.email, env.orgAdmin.password);
  await expectAppShell(page);

  const hasUpgradeFlow = await tryOpenUpgradeModal(page);
  test.skip(!hasUpgradeFlow, "Configured OrgAdmin is not seeing the COMM_L1 Level 2 upgrade CTA.");
  await page.getByRole("button", { name: "Upgrade Now", exact: true }).click();
  await expect(page.getByText(/Upgrade request submitted\. A SuperAdmin will review your request\.|Upgrade request already pending\./)).toBeVisible();

  await page.getByRole("button", { name: "Upgrade Now", exact: true }).click();
  await expect(page.getByText("Upgrade request already pending.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Maybe Later", exact: true }).click();
  await logout(page);

  await login(page, env.superAdmin.email, env.superAdmin.password);
  await expectAppShell(page);
  await goToSuperAdmin(page);
  await page.getByRole("button", { name: /Pending Upgrades/ }).click();
  await expect(page.getByRole("heading", { name: "Pending Upgrade Requests", exact: true })).toBeVisible();
  await expect(page.getByText("COMM_L2", { exact: true }).first()).toBeVisible();
});

test("COMM_L2-capable users do not see the locked Level 2 upgrade CTA", async ({ page }) => {
  const candidates = [env.superAdmin, env.orgAdmin, env.isolationAdmin].filter(hasCredential);
  test.skip(candidates.length === 0, "Provide at least one configured QA credential.");

  for (const credential of candidates) {
    await login(page, credential.email, credential.password);
    await expectAppShell(page);
    await page.getByRole("button", { name: "CMMC LEVEL 2", exact: true }).click();
    const l2Domain = page.getByRole("complementary").getByRole("button", { name: "Access Control (AC)", exact: true });
    if (await l2Domain.isVisible().catch(() => false)) {
      await expect(page.getByRole("button", { name: "Upgrade to unlock Level 2", exact: true })).toHaveCount(0);
      return;
    }
    await logout(page);
  }

  test.skip(true, "No configured QA credential exposed COMM_L2 navigation.");
});
