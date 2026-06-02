import { expect, type Page } from "@playwright/test";

export async function uploadEvidence(page: Page, filePath: string) {
  await page.locator('input[type="file"]').first().setInputFiles(filePath);
}
export async function expectEvidenceUploaded(page: Page) {
  await expect(page.getByText(/Storage:\s*uploaded/i).first()).toBeVisible();
}
