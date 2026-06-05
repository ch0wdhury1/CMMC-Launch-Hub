import { expect, test, type Page } from "@playwright/test";
import { expectAppShell, login, logout } from "./helpers/auth";
import { env, hasCredential } from "./helpers/env";

const accessControlLabel = "Access Control (AC)";
const l2Token = "__L2__:AC";

async function openL1AccessControl(page: Page) {
  await page.getByRole("button", { name: "CMMC LEVEL 1", exact: true }).click();
  await page.getByRole("button", { name: accessControlLabel, exact: true }).click();
}

async function tryOpenL2AccessControl(page: Page) {
  await page.getByRole("button", { name: "CMMC LEVEL 2", exact: true }).click();
  const l2Button = page.getByRole("complementary").getByRole("button", { name: accessControlLabel, exact: true });
  try {
    await l2Button.waitFor({ state: "visible", timeout: 5000 });
    await l2Button.click();
    return true;
  } catch {
    return false;
  }
}

async function expectDomainDisplay(page: Page) {
  const main = page.getByRole("main");
  await expect(main.locator("header h1")).toHaveText(accessControlLabel);
  await expect(main.locator(".text-sm.text-gray-500").first().getByText(accessControlLabel, { exact: true })).toBeVisible();
  await expect(main.getByText(l2Token, { exact: true })).toHaveCount(0);
}

test("L1 domain title rendering remains display-safe", async ({ page }) => {
  test.skip(!hasCredential(env.orgAdmin), "Provide E2E_ORGADMIN credentials.");
  await login(page, env.orgAdmin.email, env.orgAdmin.password);
  await expectAppShell(page);
  await openL1AccessControl(page);
  await expectDomainDisplay(page);
  await logout(page);
});

test("L2 domain title rendering hides internal routing token", async ({ page }) => {
  const candidates = [env.superAdmin, env.orgAdmin, env.isolationAdmin].filter(hasCredential);
  test.skip(candidates.length === 0, "Provide at least one configured QA credential.");

  for (const credential of candidates) {
    await login(page, credential.email, credential.password);
    await expectAppShell(page);
    const hasL2Access = await tryOpenL2AccessControl(page);
    if (hasL2Access) {
      await expectDomainDisplay(page);
      return;
    }
    await logout(page);
  }

  test.skip(true, "No configured QA credential exposed CMMC Level 2 Access Control.");
});
