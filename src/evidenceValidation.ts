import { doc, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { auth, db } from "./firebase";
import { getObjectiveRecordStorageKey, toFirestoreDocId } from "./assessmentFirestore";
import type { EvidenceValidationResult } from "../types";

export type EvidenceValidationTarget = {
  orgId: string;
  assessmentId: string;
  practiceId: string;
  objectiveId?: string;
  evidenceId: string;
};

export type EvidenceValidationRequest = EvidenceValidationTarget & {
  evidenceSource: "uploaded" | "evidenceLibrary";
  practiceTitle: string;
  objectiveTitle?: string;
  fileName: string;
  category?: string;
  description?: string;
  tags?: string[];
  ocrSummary?: string;
};

const validationDoc = (target: EvidenceValidationTarget) => {
  const assessmentPath = ["orgs", target.orgId, "assessments", target.assessmentId];
  if (target.objectiveId) {
    const objectiveDocId = toFirestoreDocId(getObjectiveRecordStorageKey(target.practiceId, target.objectiveId));
    return doc(db, ...assessmentPath, "objectiveRecords", objectiveDocId, "evidenceValidations", toFirestoreDocId(target.evidenceId));
  }
  return doc(db, ...assessmentPath, "practiceRecords", toFirestoreDocId(target.practiceId), "evidenceValidations", toFirestoreDocId(target.evidenceId));
};

function getApiBaseUrl() {
  return String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
}

export async function validateEvidence(input: EvidenceValidationRequest): Promise<EvidenceValidationResult> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Not authenticated");

  const response = await fetch(`${getApiBaseUrl()}/api/evidence/validate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || "Evidence validation failed");
  return data as EvidenceValidationResult;
}

export function subscribeEvidenceValidation(
  target: EvidenceValidationTarget,
  onResult: (result: EvidenceValidationResult | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(validationDoc(target), snapshot => {
    onResult(snapshot.exists()
      ? ({ id: snapshot.id, ...(snapshot.data() as Omit<EvidenceValidationResult, "id">) })
      : null);
  }, onError);
}
