import { expect, type Page } from "@playwright/test";
import { qaFixture } from "./fixtures";

export function objectiveCard(page: Page, objectiveText = qaFixture.objectiveText) {
  return page.getByText(objectiveText, { exact: true }).locator("xpath=ancestor::div[contains(@class,'mb-6')][1]");
}

export async function uploadEvidence(page: Page, fileName: string, content: string) {
  const card = objectiveCard(page);
  await card.locator('input[type="file"]').setInputFiles({
    name: fileName,
    mimeType: "text/plain",
    buffer: Buffer.from(content),
  });
  return card.getByText(fileName, { exact: true }).locator("xpath=ancestor::div[contains(@class,'border-gray-200')][1]");
}

export async function expectEvidenceUploaded(artifact: ReturnType<typeof objectiveCard>) {
  await expect(artifact.getByText(/Storage:\s*uploaded/i)).toBeVisible({ timeout: 60_000 });
}
