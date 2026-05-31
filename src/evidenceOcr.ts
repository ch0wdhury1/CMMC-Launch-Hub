import { auth } from "./firebase";

export type EvidenceOcrRequest = {
  orgId: string;
  assessmentId: string;
  evidenceId: string;
  storagePath: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  practiceIds: string[];
  objectiveIds: string[];
};

export type EvidenceOcrResult = {
  ok: true;
  ocrSummary: string;
  processingStatus: "ocr_completed";
  ocrModel: string;
};

function getApiBaseUrl() {
  return String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
}

export async function requestEvidenceOcr(input: EvidenceOcrRequest): Promise<EvidenceOcrResult> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Not authenticated");

  const response = await fetch(`${getApiBaseUrl()}/api/evidence/ocr`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || "Evidence OCR request failed");
  return data as EvidenceOcrResult;
}
