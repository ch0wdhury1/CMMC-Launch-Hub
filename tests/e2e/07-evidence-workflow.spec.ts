import { expect, test } from "@playwright/test";
import { login } from "./helpers/auth";
import { env, hasCredential } from "./helpers/env";
import { uploadEvidence } from "./helpers/evidence";

test("Evidence upload fixture is available to a dedicated QA assessment", async ({ page }) => {
  test.skip(!env.runEvidenceUpload || !hasCredential(env.orgAdmin), "Requires E2E_RUN_EVIDENCE_UPLOAD_TESTS=true and a dedicated QA org.");
  await login(page, env.orgAdmin.email, env.orgAdmin.password);
  test.skip(true, "Select a stable QA objective before enabling upload, multi-file, archive, view, and download assertions.");
  await uploadEvidence(page, env.uploadFile);
});

test("Viewer cannot see objective upload controls", async ({ page }) => {
  test.skip(!hasCredential(env.viewer), "Provide E2E_VIEWER credentials.");
  await login(page, env.viewer.email, env.viewer.password);
  await expect(page.getByText(/Attach Existing Evidence/i)).toHaveCount(0);
});
