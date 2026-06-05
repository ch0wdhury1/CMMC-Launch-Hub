import { expect, test } from "@playwright/test";
import { login, logout } from "./helpers/auth";
import { env, hasCredential } from "./helpers/env";

async function expectDashboardCards(page: import("@playwright/test").Page) {
  await expect(page.getByRole("heading", { name: "Organization Dashboard", exact: true })).toBeVisible();
  await expect(page.getByText("Overall Completion", { exact: true })).toBeVisible();
  await expect(page.getByText("SPRS Score", { exact: true })).toBeVisible();
  await expect(page.getByText("Practices Assessed", { exact: true })).toBeVisible();
  await expect(page.getByText("Evidence Count", { exact: true })).toBeVisible();
  await expect(page.getByText("Domain Readiness", { exact: true })).toBeVisible();
  await expect(page.getByText("Recent Activity", { exact: true })).toBeVisible();
}

test("OrgAdmin can view Organization Dashboard", async ({ page }) => {
  test.skip(!hasCredential(env.orgAdmin), "Provide E2E_ORGADMIN credentials.");
  await login(page, env.orgAdmin.email, env.orgAdmin.password);
  await expectDashboardCards(page);
  await expect(page.getByText("Users Active", { exact: true })).toBeVisible();
  await expect(page.getByText("Pending Invitations", { exact: true })).toBeVisible();
  await expect(page.getByText("Complete company profile", { exact: true }).or(page.getByText("Invite team members", { exact: true })).first()).toBeVisible();
});

test("Contributor can view read-only Organization Dashboard", async ({ page }) => {
  test.skip(!hasCredential(env.contributor), "Provide E2E_CONTRIBUTOR credentials.");
  await login(page, env.contributor.email, env.contributor.password);
  await expectDashboardCards(page);
  await expect(page.getByText("Admin only", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Invite team members", { exact: true })).toHaveCount(0);
  await logout(page);
});

test("Viewer cannot see dashboard admin actions", async ({ page }) => {
  test.skip(!hasCredential(env.viewer), "Provide E2E_VIEWER credentials.");
  await login(page, env.viewer.email, env.viewer.password);
  await expectDashboardCards(page);
  await expect(page.getByText("Invite team members", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Complete company profile", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Upload evidence for missing practices", { exact: true })).toHaveCount(0);
  await logout(page);
});

test("COMM_L1 dashboard hides L2-only report shortcuts", async ({ page }) => {
  test.skip(!hasCredential(env.orgAdmin), "Provide E2E_ORGADMIN credentials.");
  await login(page, env.orgAdmin.email, env.orgAdmin.password);
  await expectDashboardCards(page);
  await expect(page.getByRole("button", { name: "Executive Readiness Report", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "SPRS Scorecard", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Responsibility Matrix/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^System Security Plan/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^POA&M$/ })).toHaveCount(0);
});
