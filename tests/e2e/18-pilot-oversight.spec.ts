import { expect, test } from "@playwright/test";
import { expectAppShell, login, logout } from "./helpers/auth";
import { env, hasCredential } from "./helpers/env";

async function openSuperAdminMenu(page: any) {
  await page.getByRole("button", { name: "SuperAdmin", exact: true }).click();
}

test("SuperAdmin can access Pilot Dashboard", async ({ page }) => {
  test.skip(!hasCredential(env.superAdmin), "Provide E2E_SUPERADMIN credentials.");
  await login(page, env.superAdmin.email, env.superAdmin.password);
  await expectAppShell(page);
  await openSuperAdminMenu(page);
  await page.getByRole("button", { name: "Pilot Dashboard", exact: true }).click();
  await expect(page.getByRole("heading", { name: "CMMC Pilot Dashboard", exact: true }).nth(1)).toBeVisible();
  await expect(page.getByText("Active Organizations", { exact: true })).toBeVisible();
  await expect(page.getByText("Average SPRS Score", { exact: true })).toBeVisible();
  await logout(page);
});

test("SuperAdmin dropdown includes required links", async ({ page }) => {
  test.skip(!hasCredential(env.superAdmin), "Provide E2E_SUPERADMIN credentials.");
  await login(page, env.superAdmin.email, env.superAdmin.password);
  await expectAppShell(page);
  await openSuperAdminMenu(page);
  for (const label of ["Main Dashboard", "Pilot Dashboard", "Active Orgs", "Sponsor Observers", "Pending Actions", "Activity Center", "System Health", "Feedback Review"]) {
    await expect(page.getByRole("button", { name: label, exact: true })).toBeVisible();
  }
  await logout(page);
});

test("Active Orgs table renders completion and SPRS columns", async ({ page }) => {
  test.skip(!hasCredential(env.superAdmin), "Provide E2E_SUPERADMIN credentials.");
  await login(page, env.superAdmin.email, env.superAdmin.password);
  await expectAppShell(page);
  await openSuperAdminMenu(page);
  await page.getByRole("button", { name: "Pilot Dashboard", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Active Orgs", exact: true })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "% Completed", exact: true })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "SPRS Score", exact: true })).toBeVisible();
  await logout(page);
});

test("Pending Actions page renders the three pending sections", async ({ page }) => {
  test.skip(!hasCredential(env.superAdmin), "Provide E2E_SUPERADMIN credentials.");
  await login(page, env.superAdmin.email, env.superAdmin.password);
  await expectAppShell(page);
  await openSuperAdminMenu(page);
  await page.getByRole("button", { name: "Pending Actions", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Pending Actions", exact: true }).nth(1)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pending Registrations", exact: true })).toBeVisible();
  await expect(page.getByText("Loading pending registrations...")).toHaveCount(0, { timeout: 15000 });
  const noPendingRegistrations = page.getByText("No pending registrations.", { exact: true });
  if (!(await noPendingRegistrations.isVisible().catch(() => false))) {
    await expect(page.getByRole("columnheader", { name: "Actions", exact: true }).first()).toBeVisible();
    const pendingRegistrationRows = page.getByRole("row").filter({ has: page.getByRole("button", { name: "Approve", exact: true }) });
    await expect(pendingRegistrationRows.first().getByRole("button", { name: "Approve", exact: true })).toBeVisible();
    await expect(pendingRegistrationRows.first().getByRole("button", { name: "Cancel", exact: true })).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: "Pending Add-User / Invitations", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pending Upgrade Requests", exact: true })).toBeVisible();
  await logout(page);
});

test("SuperAdmin can see Sponsor Observers management UI and Sponsor Program field", async ({ page }) => {
  test.skip(!hasCredential(env.superAdmin), "Provide E2E_SUPERADMIN credentials.");
  await login(page, env.superAdmin.email, env.superAdmin.password);
  await expectAppShell(page);
  await openSuperAdminMenu(page);
  await page.getByRole("button", { name: "Sponsor Observers", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Sponsor Observers", exact: true }).first()).toBeVisible();
  await expect(page.getByText("Manage sponsor/program observer accounts with read-only pilot oversight access.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add Sponsor Observer", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Add Sponsor Observer", exact: true })).toBeVisible();
  await expect(page.getByLabel("Sponsor for this Program")).toBeVisible();
  await expect(page.getByLabel("Sponsor for this Program").locator("option", { hasText: "CT Manufacturing Pilot" })).toHaveCount(1);
  await expect(page.getByText("Share this temporary password securely with the sponsor observer. They can change it later using password reset.", { exact: true })).toBeVisible();
  await page.getByTitle("Close Sponsor Observer form").click();
  await logout(page);
});

test("pilotObserver can access Pilot Dashboard without approval controls", async ({ page }) => {
  test.skip(!hasCredential(env.pilotObserver), "Provide E2E_PILOT_OBSERVER credentials.");
  await login(page, env.pilotObserver.email, env.pilotObserver.password);
  await expect(page.getByRole("main").getByRole("heading", { name: "CMMC Pilot Dashboard", exact: true })).toBeVisible();
  await expect(page.getByText("Pilot Observer read-only oversight", { exact: true })).toBeVisible();
  for (const label of ["Dashboard", "Participants", "Recent Activity", "My Profile", "Logout"]) {
    await expect(page.getByRole("button", { name: label, exact: true })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Command Dashboard", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "CMMC LEVEL 1", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "COMPLIANCE REPORTING", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Approve", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reject", exact: true })).toHaveCount(0);
  await logout(page);
});

test("pilotObserver can access Participants and Recent Activity pages", async ({ page }) => {
  test.skip(!hasCredential(env.pilotObserver), "Provide E2E_PILOT_OBSERVER credentials.");
  await login(page, env.pilotObserver.email, env.pilotObserver.password);
  await page.getByRole("button", { name: "Participants", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Participants", exact: true })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Company Name", exact: true })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Evidence Count", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Recent Activity", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Recent Activity", exact: true })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Details / Summary", exact: true })).toBeVisible();
  await logout(page);
});

test("OrgAdmin cannot access Pilot Dashboard navigation", async ({ page }) => {
  test.skip(!hasCredential(env.orgAdmin), "Provide E2E_ORGADMIN credentials.");
  await login(page, env.orgAdmin.email, env.orgAdmin.password);
  await expectAppShell(page);
  await expect(page.getByRole("button", { name: "SuperAdmin", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Participants", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Recent Activity", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sponsor Observers", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "CMMC Pilot Dashboard", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Sponsor Observers", exact: true })).toHaveCount(0);
  await logout(page);
});
