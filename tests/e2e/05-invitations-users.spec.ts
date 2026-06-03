import { expect, test } from "@playwright/test";
import { login } from "./helpers/auth";
import { env, hasCredential } from "./helpers/env";
import { goToAdmin } from "./helpers/navigation";
import { uniqueEmail } from "./helpers/testData";

test("OrgAdmin invitation area loads", async ({ page }) => {
  test.skip(!hasCredential(env.orgAdmin), "Provide E2E_ORGADMIN credentials.");
  await login(page, env.orgAdmin.email, env.orgAdmin.password);
  await goToAdmin(page);
  await expect(page.getByRole("heading", { name: "Pending Invitations", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add User" })).toBeVisible();
});

test("OrgAdmin can create a disposable viewer invitation", async ({ page }) => {
  test.skip(!env.runMutatingAdmin || !hasCredential(env.orgAdmin), "Requires E2E_RUN_MUTATING_ADMIN_TESTS=true and a disposable QA org.");
  await login(page, env.orgAdmin.email, env.orgAdmin.password);
  await goToAdmin(page);
  await page.getByRole("button", { name: "Add User" }).click();
  const email = uniqueEmail("invited-viewer");
  await page.getByPlaceholder("Email *").fill(email);
  await page.locator("select").last().selectOption("viewer");
  await page.getByRole("button", { name: "Create Invitation" }).click();
  await expect(page.getByText(email)).toBeVisible();
});
