import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type CollectionReference,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import { getObjectiveRecordStorageKey, toFirestoreDocId } from "./assessmentFirestore";
import type { AttachedLibraryEvidence, EvidenceLibraryItem, EvidenceReference } from "../types";

type EvidenceReferenceTarget = {
  orgId: string;
  assessmentId: string;
  practiceId: string;
  objectiveId?: string;
};

const evidenceRefsCollection = (target: EvidenceReferenceTarget): CollectionReference => {
  if (target.objectiveId) {
    const objectiveDocId = toFirestoreDocId(getObjectiveRecordStorageKey(target.practiceId, target.objectiveId));
    return collection(db, "orgs", target.orgId, "assessments", target.assessmentId, "objectiveRecords", objectiveDocId, "evidenceRefs");
  }
  return collection(db, "orgs", target.orgId, "assessments", target.assessmentId, "practiceRecords", toFirestoreDocId(target.practiceId), "evidenceRefs");
};

export async function loadActiveEvidenceLibraryItems(orgId: string): Promise<EvidenceLibraryItem[]> {
  const snapshot = await getDocs(collection(db, "orgs", orgId, "evidenceLibrary"));
  return snapshot.docs
    .map(item => ({ id: item.id, ...(item.data() as Omit<EvidenceLibraryItem, "id">) }))
    .filter(item => item.status === "active")
    .sort((a, b) => a.fileName.localeCompare(b.fileName));
}

export async function attachEvidenceLibraryItem(
  target: EvidenceReferenceTarget,
  evidenceId: string,
  attachedBy: string
): Promise<void> {
  await setDoc(doc(evidenceRefsCollection(target), evidenceId), {
    evidenceId,
    orgId: target.orgId,
    assessmentId: target.assessmentId,
    practiceId: target.practiceId,
    objectiveId: target.objectiveId,
    source: "evidenceLibrary",
    attachedBy,
    attachedAt: serverTimestamp(),
    status: "active",
    detachedAt: null,
    detachedBy: null,
  }, { merge: true });
}

export async function detachEvidenceLibraryItem(
  target: EvidenceReferenceTarget,
  evidenceId: string,
  detachedBy: string
): Promise<void> {
  await setDoc(doc(evidenceRefsCollection(target), evidenceId), {
    status: "detached",
    detachedAt: serverTimestamp(),
    detachedBy,
  }, { merge: true });
}

export function subscribeAttachedLibraryEvidence(
  target: EvidenceReferenceTarget,
  onItems: (items: AttachedLibraryEvidence[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(evidenceRefsCollection(target), async snapshot => {
    try {
      const references = snapshot.docs
        .map(item => ({ evidenceId: item.id, ...(item.data() as Omit<EvidenceReference, "evidenceId">) }))
        .filter(item => item.status === "active");
      const items = await Promise.all(references.map(async reference => {
        const librarySnapshot = await getDoc(doc(db, "orgs", target.orgId, "evidenceLibrary", reference.evidenceId));
        return {
          ...reference,
          libraryItem: librarySnapshot.exists()
            ? ({ id: librarySnapshot.id, ...(librarySnapshot.data() as Omit<EvidenceLibraryItem, "id">) })
            : null,
        };
      }));
      onItems(items);
    } catch (error) {
      onError(error instanceof Error ? error : new Error("Unable to load attached library evidence."));
    }
  }, onError);
}
