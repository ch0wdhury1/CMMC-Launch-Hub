import { expect, test } from "@playwright/test";
import { expectAppShell, login, logout } from "./helpers/auth";
import { env, hasCredential } from "./helpers/env";
import { goToFeedbackReview, goToPilotSupport } from "./helpers/navigation";

const quickStartGuidePath = /\/user-guides\/CMMC_Launch_Hub_Quick_Start_Guide_v1\.0\.pdf$/;
const welcomeAudioPath = "/audio/audio-01-welcome-note.mp3";

test("OrgAdmin sees pilot banner, Support page, and feedback modal categories", async ({ page }) => {
  test.skip(!hasCredential(env.orgAdmin), "Provide E2E_ORGADMIN credentials.");
  await login(page, env.orgAdmin.email, env.orgAdmin.password);
  await expectAppShell(page);

  await expect(page.getByText("Controlled Pilot Participant", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Quick Start Guide", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Command Dashboard", exact: true }).click();
  await expect(page.getByRole("heading", { name: "New to CMMC Launch Hub?", exact: true })).toBeVisible();
  await expect(page.getByText("Welcome Audio Tour", { exact: true })).toBeVisible();
  await expect(page.locator(`audio source[src="${welcomeAudioPath}"]`)).toHaveCount(1);
  const audioResponse = await page.request.get(welcomeAudioPath);
  expect(audioResponse.ok()).toBeTruthy();
  await expect(page.getByRole("button", { name: "Open Quick Start Guide", exact: true })).toBeVisible();
  const guideResponse = await page.request.get("/user-guides/CMMC_Launch_Hub_Quick_Start_Guide_v1.0.pdf");
  expect(guideResponse.ok()).toBeTruthy();
  await page.evaluate(() => {
    (window as any).__quickStartGuideUrl = "";
    window.open = ((url?: string | URL) => {
      (window as any).__quickStartGuideUrl = String(url || "");
      return null;
    }) as typeof window.open;
  });
  await page.getByRole("button", { name: "Open Quick Start Guide", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__quickStartGuideUrl)).toMatch(quickStartGuidePath);

  await goToPilotSupport(page);
  await expect(page.getByText("Primary support channel", { exact: true })).toBeVisible();
  await expect(page.getByText("Feedback categories", { exact: true })).toBeVisible();

  await page.getByRole("complementary").getByRole("button", { name: "Send Feedback", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Send Feedback", exact: true })).toBeVisible();
  const category = page.getByLabel("Category");
  for (const option of ["Bug", "Feature Request", "Question", "Other"]) {
    await expect(category.locator("option", { hasText: option })).toHaveCount(1);
  }
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await logout(page);
});

test("SuperAdmin can access Feedback Review", async ({ page }) => {
  test.skip(!hasCredential(env.superAdmin), "Provide E2E_SUPERADMIN credentials.");
  await login(page, env.superAdmin.email, env.superAdmin.password);
  await expectAppShell(page);
  await goToFeedbackReview(page);
  await expect(page.getByText("Review controlled pilot feedback", { exact: false })).toBeVisible();
});

test("Org users do not see SuperAdmin Feedback Review navigation", async ({ page }) => {
  test.skip(!hasCredential(env.viewer), "Provide E2E_VIEWER credentials.");
  await login(page, env.viewer.email, env.viewer.password);
  await expectAppShell(page);
  await page.getByRole("button", { name: "SYSTEM TOOLS", exact: true }).click();
  await expect(page.getByRole("button", { name: "Feedback Review", exact: true })).toHaveCount(0);
  await logout(page);
});
