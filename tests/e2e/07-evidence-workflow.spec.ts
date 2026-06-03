import { expect, test } from "@playwright/test";
import { login } from "./helpers/auth";
import { env, hasCredential } from "./helpers/env";
import { expectEvidenceUploaded, objectiveCard, uploadEvidence } from "./helpers/evidence";
import { qaFixture } from "./helpers/fixtures";
import { goToPractice } from "./helpers/navigation";

test("Evidence upload, OCR, view, download, and archive workflow", async ({ page }) => {
  test.setTimeout(120_000);
  test.skip(!env.runEvidenceUpload || !hasCredential(env.orgAdmin), "Requires E2E_RUN_EVIDENCE_UPLOAD_TESTS=true and a dedicated QA org.");
  await login(page, env.orgAdmin.email, env.orgAdmin.password);
  await goToPractice(page);

  const fileName = `phase-26c-evidence-${Date.now()}.txt`;
  const artifact = await uploadEvidence(page, fileName, "CMMC Launch Hub Phase 26C OCR evidence fixture.");
  await expectEvidenceUploaded(artifact);
  await expect.soft(artifact.getByText(/OCR:\s*completed/i)).toBeVisible({ timeout: 60_000 });
  await expect.soft(artifact.getByText("OCR Preview", { exact: true })).toBeVisible();

  const viewButton = artifact.getByRole("button", { name: "View", exact: true });
  const popupPromise = page.waitForEvent("popup");
  await viewButton.click();
  const popup = await popupPromise;
  await popup.waitForLoadState("domcontentloaded");
  await popup.close();

  const downloadPromise = page.waitForEvent("download", { timeout: 10_000 })
    .then(download => ({ type: "download" as const, fileName: download.suggestedFilename() }));
  const downloadPopupPromise = page.waitForEvent("popup", { timeout: 10_000 })
    .then(async downloadPopup => {
      await downloadPopup.waitForLoadState("domcontentloaded");
      await downloadPopup.close();
      return { type: "popup" as const, fileName };
    });
  await artifact.getByRole("button", { name: "Download", exact: true }).click();
  const downloadResult = await Promise.any([downloadPromise, downloadPopupPromise]);
  expect(downloadResult.fileName).toBe(fileName);

  const handleArchiveDialog = (dialog: import("@playwright/test").Dialog) => {
    void dialog.accept(dialog.type() === "prompt" ? qaFixture.archiveReason : undefined);
  };
  page.on("dialog", handleArchiveDialog);
  await artifact.getByRole("button", { name: "Archive", exact: true }).click();
  page.off("dialog", handleArchiveDialog);
  await expect(objectiveCard(page).getByText(fileName, { exact: true })).toHaveCount(0);
  await objectiveCard(page).getByRole("button", { name: "Show archived evidence", exact: true }).click();
  const archivedArtifact = objectiveCard(page).locator("div").filter({ hasText: new RegExp(`^${fileName}Archived`) }).first();
  await expect(archivedArtifact).toBeVisible();
  await expect(archivedArtifact.getByText("Archived", { exact: true })).toBeVisible();
});

test("Viewer cannot see objective upload controls", async ({ page }) => {
  test.skip(!hasCredential(env.viewer), "Provide E2E_VIEWER credentials.");
  await login(page, env.viewer.email, env.viewer.password);
  await goToPractice(page);
  const objective = objectiveCard(page);
  await expect(objective.locator('input[type="file"]')).toHaveCount(0);
  await expect(objective.getByRole("button", { name: "Attach Existing Evidence", exact: true })).toHaveCount(0);
  await expect(objective.getByRole("button", { name: "Archive", exact: true })).toHaveCount(0);
});
