import { expect, test } from "@playwright/test";
import { login } from "./helpers/auth";
import { env, hasCredential } from "./helpers/env";
import { qaFixture } from "./helpers/fixtures";
import { goToAssessment, goToPractice, saveAssessment } from "./helpers/navigation";
import { objectiveCard } from "./helpers/evidence";

test.beforeEach(async ({ page }) => {
  test.skip(!hasCredential(env.orgAdmin), "Provide E2E_ORGADMIN credentials.");
  await login(page, env.orgAdmin.email, env.orgAdmin.password);
});

test("Assessment practice library loads", async ({ page }) => {
  await goToAssessment(page);
  await goToPractice(page);
  await expect(page.getByText(qaFixture.objectiveText, { exact: true })).toBeVisible();
});

test("Objective status, note, and assignment persistence", async ({ page }) => {
  test.skip(!env.runMutatingAssessment, "Set E2E_RUN_MUTATING_ASSESSMENT_TESTS=true for a dedicated QA assessment.");
  await goToPractice(page);
  const objective = objectiveCard(page);
  const note = objective.getByPlaceholder("Document implementation details or N/A justification here...");
  const assignment = objective.locator("select").first();
  const practiceNote = page.getByPlaceholder("Add high-level implementation summary...");

  await objective.getByRole("button", { name: "NOT MET", exact: true }).click();
  await practiceNote.fill(qaFixture.practiceNote);
  await note.fill(qaFixture.assessmentNote);
  await assignment.selectOption({ index: 1 });
  const assignedValue = await assignment.inputValue();
  expect(assignedValue).not.toBe("");
  await saveAssessment(page);

  await page.reload();
  await goToPractice(page);
  const persisted = objectiveCard(page);
  await expect(page.getByText("Practice: NOT MET", { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder("Add high-level implementation summary...")).toHaveValue(qaFixture.practiceNote);
  await expect(persisted.getByRole("button", { name: "NOT MET", exact: true })).toHaveClass(/bg-red-500/);
  await expect(persisted.getByPlaceholder("Document implementation details or N/A justification here...")).toHaveValue(qaFixture.assessmentNote);
  await expect(persisted.locator("select").first()).toHaveValue(assignedValue);
});
