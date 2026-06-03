import { expect, test } from "@playwright/test";
import { env } from "./helpers/env";
import { uniqueEmail } from "./helpers/testData";

const genericResetMessage = "If an account exists for this email, a password reset link has been sent.";

test("Forgot Password link visible on Login page", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Login" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Forgot Password?" })).toBeVisible();
});

test("Forgot Password page loads", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Forgot Password?" }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await expect(page.getByRole("heading", { name: "Forgot Password" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Email" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Send Password Reset Link" })).toBeVisible();
  await expect(page.getByText("Still need help? Contact your organization administrator or CMMC Launch Hub support.")).toBeVisible();
});

test("Forgot Password invalid email validation works", async ({ page }) => {
  await page.goto("/forgot-password");
  await page.getByRole("textbox", { name: "Email" }).fill("not-an-email");
  await page.getByRole("button", { name: "Send Password Reset Link" }).click();
  await expect(page.getByText("Please enter a valid email address.")).toBeVisible();
});

test("Forgot Password valid email submission shows generic success message", async ({ page }) => {
  await page.goto("/forgot-password");
  await page.getByRole("textbox", { name: "Email" }).fill(env.orgAdmin.email);
  await page.getByRole("button", { name: "Send Password Reset Link" }).click();
  await expect(page.getByText(genericResetMessage)).toBeVisible({ timeout: 15000 });
});

test("Forgot Password unknown email submission shows same generic success message", async ({ page }) => {
  await page.goto("/forgot-password");
  await page.getByRole("textbox", { name: "Email" }).fill(uniqueEmail("unknown-reset"));
  await page.getByRole("button", { name: "Send Password Reset Link" }).click();
  await expect(page.getByText(genericResetMessage)).toBeVisible({ timeout: 15000 });
});

test("Forgot Password does not show raw Firebase errors", async ({ page }) => {
  await page.goto("/forgot-password");
  await page.getByRole("textbox", { name: "Email" }).fill(uniqueEmail("raw-error-check"));
  await page.getByRole("button", { name: "Send Password Reset Link" }).click();
  await expect(page.getByText(/auth\/|Firebase|user-not-found|invalid-credential/i)).toHaveCount(0);
});
