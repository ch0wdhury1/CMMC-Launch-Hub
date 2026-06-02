import { expect, test } from "@playwright/test";
import { expectAppShell, login, logout } from "./helpers/auth";
import { env, hasCredential } from "./helpers/env";
import { goToCompanyProfile } from "./helpers/navigation";

test("Pilot candidate non-destructive smoke", async ({ page }) => {
  test.skip(!hasCredential(env.orgAdmin), "Provide E2E_ORGADMIN credentials.");
  await login(page, env.orgAdmin.email, env.orgAdmin.password);
  await expectAppShell(page);
  await goToCompanyProfile(page);
  await expect(page.getByRole("button", { name: "Edit My Info" })).toBeVisible();
  await logout(page);
  await login(page, env.orgAdmin.email, env.orgAdmin.password);
  await expectAppShell(page);
});
