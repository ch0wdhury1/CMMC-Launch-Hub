import { expect, test } from "@playwright/test";
import { expectAppShell, login } from "./helpers/auth";
import { env, hasCredential } from "./helpers/env";
import { goToCompanyProfile } from "./helpers/navigation";

test("OrgAdmin can open company profile editing", async ({ page }) => {
  test.skip(!hasCredential(env.orgAdmin), "Provide E2E_ORGADMIN credentials.");
  await login(page, env.orgAdmin.email, env.orgAdmin.password);
  await expectAppShell(page);
  await goToCompanyProfile(page);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save Profile" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeVisible();
});

test("Edit My Info saves a safe identity field", async ({ page }) => {
  test.skip(!env.runMutatingAdmin || !hasCredential(env.orgAdmin), "Requires org-admin credentials and E2E_RUN_MUTATING_ADMIN_TESTS=true.");
  await login(page, env.orgAdmin.email, env.orgAdmin.password);
  await goToCompanyProfile(page);
  await page.getByRole("button", { name: "Edit My Info" }).click();
  const phone = `555-${String(Date.now()).slice(-7)}`;
  await page.getByPlaceholder("Phone").fill(phone);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("My information saved.")).toBeVisible();
  await page.reload();
  await goToCompanyProfile(page);
  await expect(page.getByText(phone)).toBeVisible();
});
