import { auth } from "./firebase";

export type UploadEvidenceFileInput = {
  orgId: string;
  evidenceId: string;
  file: File;
  assessmentId?: string;
  practiceId?: string;
  objectiveId?: string;
};

export type UploadedEvidenceFile = {
  evidenceId: string;
  storagePath: string;
  downloadUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  storageStatus: "uploaded";
  status: "active";
  active: true;
  source: "backend_upload";
  processingStatus: "ocr_pending";
};

function getApiBaseUrl() {
  return String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const separator = result.indexOf(",");
      if (separator < 0) return reject(new Error("Evidence file could not be read."));
      resolve(result.slice(separator + 1));
    };
    reader.onerror = () => reject(new Error("Evidence file could not be read."));
    reader.readAsDataURL(file);
  });
}

export async function uploadEvidenceFile({
  orgId,
  evidenceId,
  file,
  assessmentId,
  practiceId,
  objectiveId,
}: UploadEvidenceFileInput): Promise<UploadedEvidenceFile> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("NOT_AUTHENTICATED: Authentication is required to upload evidence.");
  if (!assessmentId || !practiceId) throw new Error("INVALID_REQUEST: Assessment and practice are required to upload evidence.");

  const response = await fetch(`${getApiBaseUrl()}/api/evidence/upload`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      orgId,
      assessmentId,
      practiceId,
      objectiveId,
      evidenceId,
      fileName: file.name,
      fileType: file.type || "application/octet-stream",
      fileSize: file.size,
      fileBase64: await fileToBase64(file),
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success !== true) {
    const errorCode = typeof payload.errorCode === "string" ? payload.errorCode : "UPLOAD_FAILED";
    const errorMessage = typeof payload.errorMessage === "string" ? payload.errorMessage : "Evidence upload failed.";
    const error: any = new Error(`${errorCode}: ${errorMessage}`);
    error.code = errorCode;
    throw error;
  }
  return payload as UploadedEvidenceFile;
}
