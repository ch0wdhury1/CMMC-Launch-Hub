import { expect, test } from "@playwright/test";
import { expectAppShell, expectBlockedOrPending, login, logout } from "./helpers/auth";
import { env, hasCredential } from "./helpers/env";
import { goToCompanyProfile } from "./helpers/navigation";

for (const [label, credential] of Object.entries({ contributor: env.contributor, assessor: env.assessor, viewer: env.viewer })) {
  test(`${label} sees app shell and a read-only company profile`, async ({ page }) => {
    test.skip(!hasCredential(credential), `Provide E2E_${label.toUpperCase()} credentials.`);
    await login(page, credential.email, credential.password);
    await expectAppShell(page);
    await expect(page.getByRole("button", { name: "Super Admin", exact: true })).toHaveCount(0);
    await goToCompanyProfile(page);
    await expect(page.getByRole("button", { name: "Edit My Info" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save Profile" })).toHaveCount(0);
    await expect(page.getByText("Organization Users")).toHaveCount(0);
    await logout(page);
  });
}

test("OrgAdmin sees app shell, Admin, and Profile", async ({ page }) => {
  test.skip(!hasCredential(env.orgAdmin), "Provide E2E_ORGADMIN credentials.");
  await login(page, env.orgAdmin.email, env.orgAdmin.password);
  await expectAppShell(page);
  await expect(page.getByRole("button", { name: "Admin", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Profile", exact: true })).toBeVisible();
});

test("Inactive or disabled user is blocked", async ({ page }) => {
  test.skip(!hasCredential(env.inactive), "Provide optional E2E_INACTIVE credentials.");
  await login(page, env.inactive.email, env.inactive.password);
  await expectBlockedOrPending(page);
});
