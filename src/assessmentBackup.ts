import { auth } from "./firebase";

function getApiBaseUrl() {
  return String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
}

export async function exportAssessmentBackup(orgId: string, assessmentId: string) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Not authenticated");

  const query = new URLSearchParams({orgId, assessmentId});
  const response = await fetch(`${getApiBaseUrl()}/api/admin/export-assessment?${query}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || "Assessment export failed");
  return data;
}
