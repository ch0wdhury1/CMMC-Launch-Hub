import { expect, type Page } from "@playwright/test";

export async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Email" }).fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill(password);
  await page.getByRole("button", { name: "Login", exact: true }).click();
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
}

export async function expectBlockedOrPending(page: Page) {
  await expect(page.getByText(/pending approval|inactive or disabled|access disabled/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Logout", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Profile", exact: true })).toHaveCount(0);
}

export async function expectAppShell(page: Page) {
  await expect(page.getByRole("heading", { name: "CMMC Launch Hub" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Logout", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Profile", exact: true })).toBeVisible();
}
