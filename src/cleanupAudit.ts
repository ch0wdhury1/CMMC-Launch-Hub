import { auth } from "./firebase";
import type { CleanupAuditResult } from "../types";

function getApiBaseUrl() {
  return String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
}

export async function runCleanupAudit(): Promise<CleanupAuditResult> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Not authenticated");

  const response = await fetch(`${getApiBaseUrl()}/api/admin/cleanup-audit`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || "Cleanup audit failed");
  return data as CleanupAuditResult;
}
