export const env = {
  superAdmin: credential("E2E_SUPERADMIN"),
  orgAdmin: credential("E2E_ORGADMIN"),
  contributor: credential("E2E_CONTRIBUTOR"),
  assessor: credential("E2E_ASSESSOR"),
  viewer: credential("E2E_VIEWER"),
  inactive: credential("E2E_INACTIVE"),
  isolationAdmin: credential("E2E_ISOLATION_ADMIN"),
  testOrgName: process.env.E2E_TEST_ORG_NAME || "QA Test Company",
  isolationOrgName: process.env.E2E_ISOLATION_ORG_NAME || "QA Isolation Company",
  uploadFile: process.env.E2E_TEST_UPLOAD_FILE || "tests/e2e/fixtures/sample-evidence.txt",
  runRegistrationCreate: enabled("E2E_RUN_REGISTRATION_CREATE"),
  runMutatingAdmin: enabled("E2E_RUN_MUTATING_ADMIN_TESTS"),
  runMutatingAssessment: enabled("E2E_RUN_MUTATING_ASSESSMENT_TESTS"),
  runEvidenceUpload: enabled("E2E_RUN_EVIDENCE_UPLOAD_TESTS"),
};

function credential(prefix: string) {
  return { email: process.env[`${prefix}_EMAIL`] || "", password: process.env[`${prefix}_PASSWORD`] || "" };
}

function enabled(name: string) {
  return String(process.env[name] || "").toLowerCase() === "true";
}

export const hasCredential = (value: { email: string; password: string }) => Boolean(value.email && value.password);
