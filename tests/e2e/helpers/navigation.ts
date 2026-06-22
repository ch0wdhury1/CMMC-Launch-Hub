import { expect, type Page } from "@playwright/test";
import { qaFixture } from "./fixtures";

export const goToLogin = (page: Page) => page.goto("/login");
export const goToRegister = (page: Page) => page.goto("/register");
export async function goToSuperAdmin(page: Page) {
  await page.getByRole("button", { name: "SuperAdmin", exact: true }).click();
  await page.getByRole("button", { name: "Main Dashboard", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Pending Registrations", exact: true })).toBeVisible();
}
export async function goToSystemHealth(page: Page) {
  await page.getByRole("button", { name: "SYSTEM TOOLS", exact: true }).click();
  await page.getByRole("button", { name: "System Health", exact: true }).click();
  await expect(page.getByRole("heading", { name: "System Health", exact: true })).toBeVisible();
}
export async function goToPilotSupport(page: Page) {
  await page.getByRole("button", { name: "SYSTEM TOOLS", exact: true }).click();
  await page.getByRole("complementary").getByRole("button", { name: "Pilot Support", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Support Page", exact: true })).toBeVisible();
}
export async function goToFeedbackReview(page: Page) {
  await page.getByRole("button", { name: "SYSTEM TOOLS", exact: true }).click();
  await page.getByRole("button", { name: "Feedback Review", exact: true }).click();
  await expect(page.getByRole("heading", { name: "SuperAdmin Feedback Review", exact: true })).toBeVisible();
}
export async function goToAdmin(page: Page) {
  await page.getByRole("button", { name: "Admin", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Organization Admin", exact: true })).toBeVisible();
}
export async function goToCompanyProfile(page: Page) {
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Company Profile", exact: true })).toBeVisible();
}
export async function goToAssessment(page: Page) {
  await page.getByRole("button", { name: "Command Dashboard", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Command Dashboard", exact: true })).toBeVisible();
}
export async function goToPractice(page: Page, practiceId = qaFixture.practiceId) {
  await page.getByRole("button", { name: "CMMC LEVEL 1", exact: true }).click();
  await page.getByRole("button", { name: qaFixture.domainName, exact: true }).click();
  await page.getByRole("button", { name: new RegExp(`^${escapeRegex(practiceId)}\\b`) }).click();
  await expect(page.getByText(qaFixture.objectiveText, { exact: true })).toBeVisible();
}
export async function goToReports(page: Page, reportName: "Executive Readiness Report" | "POA&M Report" = "Executive Readiness Report") {
  await page.getByRole("button", { name: "COMPLIANCE REPORTING", exact: true }).click();
  if (reportName === "POA&M Report") {
    await page.getByRole("button", { name: "POA&M", exact: true }).click();
    await expect(page.getByRole("heading", { name: /Plan of Action & Milestones|POA&M/i }).first()).toBeVisible();
    await page.getByRole("button", { name: "POA&M Report", exact: true }).click();
    await expect(page.getByRole("heading", { name: reportName, exact: true }).first()).toBeVisible();
    return;
  }
  await page.getByRole("button", { name: reportName, exact: true }).click();
  await expect(page.getByRole("heading", { name: reportName, exact: true }).first()).toBeVisible();
}
export async function saveAssessment(page: Page) {
  const header = page.getByRole("banner");
  await header.getByRole("button", { name: "Save", exact: true }).click();
  await expect(header.getByRole("button", { name: "Saved", exact: true })).toBeVisible();
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
