import { expect, type Page } from "@playwright/test";

export const goToLogin = (page: Page) => page.goto("/login");
export const goToRegister = (page: Page) => page.goto("/register");
export async function goToSuperAdmin(page: Page) {
  await page.getByRole("button", { name: "Super Admin", exact: true }).click();
  await expect(page.getByText("Pending Registrations")).toBeVisible();
}
export async function goToAdmin(page: Page) {
  await page.getByRole("button", { name: "Admin", exact: true }).click();
  await expect(page.getByText("Organization Admin")).toBeVisible();
}
export async function goToCompanyProfile(page: Page) {
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await expect(page.getByText("Company Profile")).toBeVisible();
}
export async function goToAssessment(page: Page) {
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await expect(page.getByText(/Command Dashboard|Dashboard/i).first()).toBeVisible();
}
export async function goToReports(page: Page) {
  await page.getByRole("button", { name: /Executive/i }).click();
  await expect(page.getByText("Executive Readiness Report")).toBeVisible();
}
