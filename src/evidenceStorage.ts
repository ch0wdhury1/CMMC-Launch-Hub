import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "./firebase";

export type UploadEvidenceFileInput = {
  orgId: string;
  evidenceId: string;
  file: File;
};

export type UploadedEvidenceFile = {
  storagePath: string;
  downloadUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
};

function cleanStorageSegment(value: string): string {
  return value.trim().replace(/[\\/]+/g, "_").replace(/[^a-zA-Z0-9._() -]+/g, "_") || "file";
}

export function buildEvidenceStoragePath(orgId: string, evidenceId: string, fileName: string): string {
  return `orgs/${cleanStorageSegment(orgId)}/evidence/${cleanStorageSegment(evidenceId)}/${cleanStorageSegment(fileName)}`;
}

export async function getEvidenceDownloadUrl(storagePath: string): Promise<string> {
  return getDownloadURL(ref(storage, storagePath));
}

export async function uploadEvidenceFile({
  orgId,
  evidenceId,
  file,
}: UploadEvidenceFileInput): Promise<UploadedEvidenceFile> {
  const storagePath = buildEvidenceStoragePath(orgId, evidenceId, file.name);
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, file, {
    contentType: file.type || "application/octet-stream",
  });

  return {
    storagePath,
    downloadUrl: await getEvidenceDownloadUrl(storagePath),
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
    uploadedAt: new Date().toISOString(),
  };
}
