import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "./firebase";
import type { EvidenceLibraryItem } from "../types";

export const EVIDENCE_LIBRARY_CATEGORIES = [
  "Policy",
  "Procedure",
  "Screenshot",
  "Log",
  "Training",
  "Diagram",
  "Vendor Document",
  "System Document",
  "Other",
] as const;

const cleanStorageSegment = (value: string): string =>
  value.trim().replace(/[\\/]+/g, "_").replace(/[^a-zA-Z0-9._() -]+/g, "_") || "file";

export function buildEvidenceLibraryStoragePath(orgId: string, evidenceId: string, fileName: string): string {
  return `orgs/${cleanStorageSegment(orgId)}/evidenceLibrary/${cleanStorageSegment(evidenceId)}/${cleanStorageSegment(fileName)}`;
}

export function subscribeEvidenceLibraryItems(
  orgId: string,
  onItems: (items: EvidenceLibraryItem[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const libraryQuery = query(collection(db, "orgs", orgId, "evidenceLibrary"), orderBy("uploadedAt", "desc"));
  return onSnapshot(libraryQuery, snapshot => {
    onItems(snapshot.docs.map(item => ({ id: item.id, ...(item.data() as Omit<EvidenceLibraryItem, "id">) })));
  }, onError);
}

export async function uploadEvidenceLibraryItem(params: {
  orgId: string;
  evidenceId: string;
  file: File;
  category: string;
  description: string;
  tags: string[];
  uploadedBy: string;
}): Promise<void> {
  const storagePath = buildEvidenceLibraryStoragePath(params.orgId, params.evidenceId, params.file.name);
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, params.file, { contentType: params.file.type || "application/octet-stream" });
  await setDoc(doc(db, "orgs", params.orgId, "evidenceLibrary", params.evidenceId), {
    id: params.evidenceId,
    orgId: params.orgId,
    fileName: params.file.name,
    fileType: params.file.type,
    fileSize: params.file.size,
    storagePath,
    downloadURL: await getDownloadURL(storageRef),
    category: params.category,
    description: params.description,
    tags: params.tags,
    status: "active",
    uploadedBy: params.uploadedBy,
    uploadedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function setEvidenceLibraryItemStatus(
  orgId: string,
  evidenceId: string,
  status: "active" | "archived",
  updatedBy: string
): Promise<void> {
  await setDoc(doc(db, "orgs", orgId, "evidenceLibrary", evidenceId), {
    status,
    archivedAt: status === "archived" ? serverTimestamp() : null,
    archivedBy: status === "archived" ? updatedBy : null,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}
