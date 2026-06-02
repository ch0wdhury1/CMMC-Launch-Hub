import { expect, test } from "@playwright/test";
import { expectBlockedOrPending, login } from "./helpers/auth";
import { env } from "./helpers/env";
import { uniqueEmail, uniqueOrgName } from "./helpers/testData";

test("Login page loads", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Login" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Email" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Password" })).toBeVisible();
  await page.getByRole("button", { name: "Register New Organization" }).click();
  await expect(page).toHaveURL(/\/register$/);
});

test("Registration page loads", async ({ page }) => {
  await page.goto("/register");
  await expect(page.getByRole("heading", { name: "REGISTRATION FORM" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Company Information" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "User Information" })).toBeVisible();
  await expect(page.getByPlaceholder("Company Name")).toBeVisible();
  await expect(page.getByRole("button", { name: "REGISTER" })).toBeVisible();
});

test("Registration submits a pending user without app-shell access", async ({ page }) => {
  test.skip(!env.runRegistrationCreate, "Set E2E_RUN_REGISTRATION_CREATE=true only in a disposable QA environment.");
  const email = uniqueEmail("pending-registration");
  const password = `PilotQa-${Date.now()}!`;
  await page.goto("/register");
  await page.getByPlaceholder("Company Name").fill(uniqueOrgName(env.testOrgName));
  await page.getByPlaceholder("Address").fill("100 QA Test Way");
  await page.getByPlaceholder("Phone").fill("555-0100");
  await page.getByPlaceholder("Website (https://example.com)").fill("https://example.test");
  await page.getByPlaceholder("User Full Name").fill("Pending QA User");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password (6+ characters)").fill(password);
  await page.getByRole("button", { name: "REGISTER" }).click();
  await expect(page).toHaveURL(/\/registration-submitted$/);
  await expect(page.getByRole("heading", { name: "Registration Submitted" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Profile", exact: true })).toHaveCount(0);

  await login(page, email, password);
  await expectBlockedOrPending(page);
});
