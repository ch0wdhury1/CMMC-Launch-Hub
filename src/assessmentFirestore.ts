import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import type {
  AssessmentDoc,
  AssessmentLevel,
  EvidenceRecord,
  FirestoreObjectiveRecord,
  FirestorePoamItem,
  FirestorePracticeRecord,
  NoteRecord,
  ScoreSnapshot,
} from "../types";

const DEFAULT_FRAMEWORK_ID = "cmmc_2_0_combined";

export type AssessmentState = {
  assessment: AssessmentDoc | null;
  practiceRecords: FirestorePracticeRecord[];
  objectiveRecords: FirestoreObjectiveRecord[];
  evidence: EvidenceRecord[];
  notes: NoteRecord[];
  poamItems: FirestorePoamItem[];
  scoreSnapshots: ScoreSnapshot[];
};

export type GetOrCreateAssessmentInput = {
  orgId: string;
  uid: string;
  level: AssessmentLevel;
  frameworkId?: string;
};

export function isFirestoreAssessmentsEnabled(): boolean {
  return String(import.meta.env.VITE_FIRESTORE_ASSESSMENTS || "false").toLowerCase() === "true";
}

export function getDefaultAssessmentId(level: AssessmentLevel): string {
  return level === 2 ? "default_l2" : "default_l1";
}

export function getObjectiveRecordStorageKey(practiceId: string, objectiveId: string): string {
  return `${practiceId}::${objectiveId}`;
}

export function getObjectiveNoteId(practiceId: string, objectiveId: string): string {
  return `assessor_review::${getObjectiveRecordStorageKey(practiceId, objectiveId)}`;
}

function cleanDocId(id: string): string {
  return encodeURIComponent(id).replace(/\./g, "%2E");
}

function assessmentName(level: AssessmentLevel): string {
  return `Default CMMC Level ${level} Assessment`;
}

function stripUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined)) as Partial<T>;
}

export async function getOrCreateDefaultAssessment({
  orgId,
  uid,
  level,
  frameworkId = DEFAULT_FRAMEWORK_ID,
}: GetOrCreateAssessmentInput): Promise<AssessmentDoc> {
  const assessmentId = getDefaultAssessmentId(level);
  const ref = doc(db, "orgs", orgId, "assessments", assessmentId);
  console.info("[assessmentFirestore] checking assessment shell", {
    orgId,
    assessmentId,
    level,
  });
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const existing = { assessmentId, ...(snap.data() as Omit<AssessmentDoc, "assessmentId">) };
    console.info("[assessmentFirestore] retrieved existing assessment shell", {
      orgId,
      assessmentId,
      level,
    });
    return existing;
  }

  const assessment: AssessmentDoc = {
    assessmentId,
    orgId,
    frameworkId,
    level,
    name: assessmentName(level),
    status: "draft",
    state: "DRAFT",
    stateVersion: 1,
    ownerUid: uid,
    createdByUid: uid,
    updatedByUid: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  console.info("[assessmentFirestore] creating missing assessment shell", {
    orgId,
    assessmentId,
    level,
  });
  await setDoc(ref, assessment, { merge: true });
  console.info("[assessmentFirestore] created assessment shell", {
    orgId,
    assessmentId,
    level,
  });
  return assessment;
}

export async function loadAssessmentState(orgId: string, assessmentId: string): Promise<AssessmentState> {
  const assessmentRef = doc(db, "orgs", orgId, "assessments", assessmentId);
  const assessmentSnap = await getDoc(assessmentRef);
  const assessment = assessmentSnap.exists()
    ? ({ assessmentId, ...(assessmentSnap.data() as Omit<AssessmentDoc, "assessmentId">) } as AssessmentDoc)
    : null;

  console.info("[assessmentFirestore] loaded assessment shell", {
    orgId,
    assessmentId,
    exists: assessment !== null,
  });

  const [
    practiceRecordsSnap,
    objectiveRecordsSnap,
    evidenceSnap,
    notesSnap,
    poamItemsSnap,
    scoreSnapshotsSnap,
  ] = await Promise.all([
    getDocs(collection(assessmentRef, "practiceRecords")),
    getDocs(collection(assessmentRef, "objectiveRecords")),
    getDocs(collection(db, "orgs", orgId, "evidence")),
    loadNoteRecords(orgId, assessmentId),
    loadPoamItems(orgId, assessmentId),
    getDocs(query(collection(assessmentRef, "scoreSnapshots"), orderBy("createdAt", "desc"))),
  ]);

  return {
    assessment,
    practiceRecords: practiceRecordsSnap.docs.map((d) => ({
      practiceId: decodeURIComponent(d.id),
      ...(d.data() as Omit<FirestorePracticeRecord, "practiceId">),
    })),
    objectiveRecords: objectiveRecordsSnap.docs.map((d) => ({
      ...(d.data() as FirestoreObjectiveRecord),
      objectiveId: (d.data() as FirestoreObjectiveRecord).objectiveId || decodeURIComponent(d.id),
    })),
    evidence: evidenceSnap.docs
      .map((d) => ({ evidenceId: d.id, ...(d.data() as Omit<EvidenceRecord, "evidenceId">) }))
      .filter((e) => e.assessmentId === assessmentId),
    notes: notesSnap,
    poamItems: poamItemsSnap,
    scoreSnapshots: scoreSnapshotsSnap.docs.map((d) => ({
      snapshotId: d.id,
      ...(d.data() as Omit<ScoreSnapshot, "snapshotId">),
    })),
  };
}

export async function loadNoteRecords(orgId: string, assessmentId: string): Promise<NoteRecord[]> {
  const notesSnap = await getDocs(collection(db, "orgs", orgId, "notes"));
  return notesSnap.docs
    .map((d) => ({ noteId: d.id, ...(d.data() as Omit<NoteRecord, "noteId">) }))
    .filter((note) => note.assessmentId === assessmentId);
}

export async function loadPoamItems(orgId: string, assessmentId: string): Promise<FirestorePoamItem[]> {
  const poamItemsSnap = await getDocs(collection(db, "orgs", orgId, "assessments", assessmentId, "poamItems"));
  return poamItemsSnap.docs.map((d) => ({
    poamId: decodeURIComponent(d.id),
    id: decodeURIComponent(d.id),
    ...(d.data() as Omit<FirestorePoamItem, "poamId" | "id">),
  }));
}

export async function savePracticeRecord(
  orgId: string,
  assessmentId: string,
  record: FirestorePracticeRecord
): Promise<void> {
  const practiceId = record.practiceId;
  const ref = doc(db, "orgs", orgId, "assessments", assessmentId, "practiceRecords", cleanDocId(practiceId));
  const payload = stripUndefined({
    practiceId,
    orgId,
    assessmentId,
    status: record.status,
    statusSource: record.statusSource,
    note: record.note || "",
    lastUpdated: record.lastUpdated,
    updatedByUid: record.updatedByUid,
    updatedAt: serverTimestamp(),
  });

  await setDoc(ref, payload, { merge: true });
  console.info("[assessmentFirestore] saved practice record", {
    orgId,
    assessmentId,
    practiceId,
  });
}

export async function saveObjectiveRecord(
  orgId: string,
  assessmentId: string,
  record: FirestoreObjectiveRecord
): Promise<void> {
  const objectiveId = record.objectiveId;
  const storageKey = getObjectiveRecordStorageKey(record.practiceId, objectiveId);
  const ref = doc(db, "orgs", orgId, "assessments", assessmentId, "objectiveRecords", cleanDocId(storageKey));
  const payload = stripUndefined({
    objectiveId,
    storageKey,
    practiceId: record.practiceId,
    orgId,
    assessmentId,
    status: record.status,
    note: record.note || "",
    actionPoints: record.actionPoints,
    actionPointsSummary: record.actionPointsSummary,
    updatedByUid: record.updatedByUid,
    updatedAt: serverTimestamp(),
  });

  await setDoc(ref, payload, { merge: true });
  console.info("[assessmentFirestore] saved objective record", {
    orgId,
    assessmentId,
    practiceId: record.practiceId,
    objectiveId,
    storageKey,
  });
}

export async function saveEvidenceRecord(
  orgId: string,
  record: EvidenceRecord
): Promise<void> {
  const evidenceId = record.evidenceId;
  const ref = doc(db, "orgs", orgId, "evidence", cleanDocId(evidenceId));
  const payload = stripUndefined({
    evidenceId,
    orgId,
    assessmentId: record.assessmentId,
    practiceIds: record.practiceIds,
    objectiveIds: record.objectiveIds,
    title: record.title || record.name || record.fileName,
    name: record.name,
    description: record.description,
    fileName: record.fileName,
    fileType: record.fileType,
    fileSize: record.fileSize,
    ocrSummary: record.ocrSummary,
    processingStatus: record.processingStatus,
    processingError: record.processingError,
    uploadedByUid: record.uploadedByUid,
    reviewStatus: "uploaded",
    source: "local_upload_metadata",
    createdAt: record.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await setDoc(ref, payload, { merge: true });
  console.info("[assessmentFirestore] saved evidence metadata", {
    orgId,
    assessmentId: record.assessmentId,
    evidenceId,
    practiceIds: record.practiceIds,
    objectiveIds: record.objectiveIds,
  });
}

export async function saveNoteRecord(
  orgId: string,
  record: NoteRecord
): Promise<void> {
  const noteId = record.noteId;
  const ref = doc(db, "orgs", orgId, "notes", cleanDocId(noteId));
  const snap = await getDoc(ref);
  const payload = stripUndefined({
    noteId,
    orgId,
    assessmentId: record.assessmentId,
    practiceId: record.practiceId,
    objectiveId: record.objectiveId,
    noteType: "assessor_review",
    content: record.content,
    updatedByUid: record.updatedByUid,
    createdAt: snap.exists() ? undefined : serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await setDoc(ref, payload, { merge: true });
  console.info("[assessmentFirestore] saved assessor review note", {
    orgId,
    assessmentId: record.assessmentId,
    noteId,
    practiceId: record.practiceId,
    objectiveId: record.objectiveId,
  });
}

export async function savePoamItem(
  orgId: string,
  assessmentId: string,
  record: FirestorePoamItem
): Promise<void> {
  const poamId = record.poamId;
  const ref = doc(db, "orgs", orgId, "assessments", assessmentId, "poamItems", cleanDocId(poamId));
  const snap = await getDoc(ref);
  const payload = stripUndefined({
    poamId,
    orgId,
    assessmentId,
    title: record.title,
    description: record.description,
    relatedPracticeIds: record.relatedPracticeIds,
    relatedObjectiveIds: record.relatedObjectiveIds,
    priority: record.priority,
    status: record.status,
    ownerUid: record.ownerUid,
    ownerName: record.ownerName || record.owner,
    targetDate: record.targetDate,
    completedDate: record.completedDate,
    source: record.source,
    riskStatement: record.riskStatement,
    remediationPlan: record.remediationPlan,
    milestones: record.milestones,
    category: record.category,
    notes: record.notes,
    createdByUid: snap.exists() ? undefined : record.createdByUid,
    updatedByUid: record.updatedByUid,
    createdAt: snap.exists() ? undefined : record.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await setDoc(ref, payload, { merge: true });
  console.info("[assessmentFirestore] saved POA&M item", {
    orgId,
    assessmentId,
    poamId,
  });
}

export const toFirestoreDocId = cleanDocId;
