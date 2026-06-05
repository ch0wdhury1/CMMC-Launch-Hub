import { expect, test } from "@playwright/test";
import { expectAppShell, login, logout } from "./helpers/auth";
import { env, hasCredential } from "./helpers/env";
import { goToSystemHealth } from "./helpers/navigation";

test("SuperAdmin can access System Health dashboard", async ({ page }) => {
  test.skip(!hasCredential(env.superAdmin), "Provide E2E_SUPERADMIN credentials.");
  await login(page, env.superAdmin.email, env.superAdmin.password);
  await expectAppShell(page);
  await goToSystemHealth(page);
  await expect(page.getByText("SuperAdmin pilot monitoring")).toBeVisible();
});

test("System Health dashboard cards render", async ({ page }) => {
  test.skip(!hasCredential(env.superAdmin), "Provide E2E_SUPERADMIN credentials.");
  await login(page, env.superAdmin.email, env.superAdmin.password);
  await expectAppShell(page);
  await goToSystemHealth(page);
  for (const label of [
    "Active Organizations",
    "Active Users",
    "Pending Registrations",
    "Pending Invitations",
    "Pending Tier Upgrades",
    "Evidence Uploads (Last 30 Days)",
    "Reports Generated (Last 30 Days)",
    "Recent Activity Count (Last 24 Hours)",
  ]) {
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: "OCR Health" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Reporting Health" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Organization Health" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "System Alerts" })).toBeVisible();
});

test("System Health recent activity renders and links to Activity Center", async ({ page }) => {
  test.skip(!hasCredential(env.superAdmin), "Provide E2E_SUPERADMIN credentials.");
  await login(page, env.superAdmin.email, env.superAdmin.password);
  await expectAppShell(page);
  await goToSystemHealth(page);
  await expect(page.getByRole("heading", { name: "Recent Activity (Last 20)" })).toBeVisible();
  await page.getByRole("button", { name: "View Full Activity Center", exact: true }).click();
  await expect(page.getByRole("heading", { name: "SuperAdmin Activity Center", exact: true })).toBeVisible();
});

test("OrgAdmin cannot access System Health dashboard", async ({ page }) => {
  test.skip(!hasCredential(env.orgAdmin), "Provide E2E_ORGADMIN credentials.");
  await login(page, env.orgAdmin.email, env.orgAdmin.password);
  await expectAppShell(page);
  await page.getByRole("button", { name: "SYSTEM TOOLS", exact: true }).click();
  await expect(page.getByRole("button", { name: "System Health", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "System Health", exact: true })).toHaveCount(0);
  await logout(page);
});

for (const [label, credential] of Object.entries({viewer: env.viewer, contributor: env.contributor, assessor: env.assessor})) {
  test(`${label} does not receive System Health access`, async ({ page }) => {
    test.skip(!hasCredential(credential), `Provide E2E_${label.toUpperCase()} credentials.`);
    await login(page, credential.email, credential.password);
    await expectAppShell(page);
    await page.getByRole("button", { name: "SYSTEM TOOLS", exact: true }).click();
    await expect(page.getByRole("button", { name: "System Health", exact: true })).toHaveCount(0);
    await logout(page);
  });
}
