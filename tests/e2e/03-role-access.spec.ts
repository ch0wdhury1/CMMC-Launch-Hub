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
    await expect(page.getByRole("heading", { name: /^Users for / })).toHaveCount(0);
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
  test.skip(!env.runMutatingAdmin || !hasCredential(env.orgAdmin) || !hasCredential(env.viewer), "Requires OrgAdmin and viewer credentials plus E2E_RUN_MUTATING_ADMIN_TESTS=true.");

  const setViewerStatus = async (status: "active" | "inactive") => {
    const logoutButton = page.getByRole("button", { name: "Logout", exact: true });
    if (await logoutButton.isVisible().catch(() => false)) {
      await logout(page);
    }
    await login(page, env.orgAdmin.email, env.orgAdmin.password);
    await goToCompanyProfile(page);
    const row = page.getByRole("row", { name: new RegExp(env.viewer.email, "i") });
    await row.locator("select").first().selectOption(status);
    page.once("dialog", dialog => dialog.accept());
    await row.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Organization user updated.", { exact: true })).toBeVisible();
    await logout(page);
  };

  await setViewerStatus("inactive");
  try {
    await login(page, env.viewer.email, env.viewer.password);
    await expectBlockedOrPending(page);
    await logout(page);
  } finally {
    await setViewerStatus("active");
  }
});
