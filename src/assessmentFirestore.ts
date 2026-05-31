import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import type {
  AssessmentDoc,
  AssessmentLevel,
  ActivityLogEntry,
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
  activityLogEntries: ActivityLogEntry[];
};

export type RecoverySummary = {
  practicesLoaded: number;
  objectivesLoaded: number;
  evidenceLoaded: number;
  notesLoaded: number;
  poamLoaded: number;
  snapshotsLoaded: number;
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

export function buildRecoverySummary(state: Pick<
  AssessmentState,
  "practiceRecords" | "objectiveRecords" | "evidence" | "notes" | "poamItems" | "scoreSnapshots"
>): RecoverySummary {
  return {
    practicesLoaded: state.practiceRecords.length,
    objectivesLoaded: state.objectiveRecords.length,
    evidenceLoaded: state.evidence.length,
    notesLoaded: state.notes.length,
    poamLoaded: state.poamItems.length,
    snapshotsLoaded: state.scoreSnapshots.length,
  };
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
  console.info("[Recovery] Loading assessment shell");
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
    activityLogEntriesSnap,
  ] = await Promise.all([
    getDocs(collection(assessmentRef, "practiceRecords")),
    getDocs(collection(assessmentRef, "objectiveRecords")),
    getDocs(collection(db, "orgs", orgId, "evidence")),
    loadNoteRecords(orgId, assessmentId),
    loadPoamItems(orgId, assessmentId),
    loadScoreSnapshots(orgId, assessmentId),
    loadActivityLogEntries(orgId, assessmentId),
  ]);

  const state: AssessmentState = {
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
    scoreSnapshots: scoreSnapshotsSnap,
    activityLogEntries: activityLogEntriesSnap,
  };

  const summary = buildRecoverySummary(state);
  console.info(`[Recovery] Loaded ${summary.practicesLoaded} practice records`);
  console.info(`[Recovery] Loaded ${summary.objectivesLoaded} objective records`);
  console.info(`[Recovery] Loaded ${summary.evidenceLoaded} evidence records`);
  console.info(`[Recovery] Loaded ${summary.notesLoaded} notes`);
  console.info(`[Recovery] Loaded ${summary.poamLoaded} poam items`);
  console.info(`[Recovery] Loaded ${summary.snapshotsLoaded} score snapshots`);

  return state;
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

export async function loadScoreSnapshots(orgId: string, assessmentId: string): Promise<ScoreSnapshot[]> {
  const snapshotsRef = collection(db, "orgs", orgId, "assessments", assessmentId, "scoreSnapshots");
  const snapshotsSnap = await getDocs(query(snapshotsRef, orderBy("createdAt", "desc"), limit(25)));
  return snapshotsSnap.docs.map((d) => ({
    snapshotId: decodeURIComponent(d.id),
    ...(d.data() as Omit<ScoreSnapshot, "snapshotId">),
  }));
}

/**
 * History feed reserved for a future audit timeline, assessor history,
 * collaboration feed, and report support.
 */
export async function loadActivityLogEntries(orgId: string, assessmentId: string, entryLimit = 50): Promise<ActivityLogEntry[]> {
  const activityRef = collection(db, "orgs", orgId, "assessments", assessmentId, "activityLog");
  try {
    const activitySnap = await getDocs(query(activityRef, orderBy("createdAt", "desc"), limit(entryLimit)));
    const entries = activitySnap.docs.map((d) => ({
      activityId: decodeURIComponent(d.id),
      ...(d.data() as Omit<ActivityLogEntry, "activityId">),
    }));
    console.info(`[ActivityLog] Loaded ${entries.length} activity entries`);
    return entries;
  } catch (error) {
    console.warn("[ActivityLog] Activity retrieval skipped; assessment load will continue.", error);
    console.info("[ActivityLog] Loaded 0 activity entries");
    return [];
  }
}

export const getLatestActivityEntries = loadActivityLogEntries;

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
    storagePath: record.storagePath,
    downloadUrl: record.downloadUrl,
    storageStatus: record.storageStatus,
    storageError: record.storageError,
    ocrSummary: record.ocrSummary,
    processingStatus: record.processingStatus,
    processingError: record.processingError,
    uploadedByUid: record.uploadedByUid,
    uploadedAt: record.uploadedAt,
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

export async function saveScoreSnapshot(
  orgId: string,
  assessmentId: string,
  snapshot: ScoreSnapshot
): Promise<void> {
  const snapshotId = snapshot.snapshotId;
  const ref = doc(db, "orgs", orgId, "assessments", assessmentId, "scoreSnapshots", cleanDocId(snapshotId));
  const payload = stripUndefined({
    snapshotId,
    orgId,
    assessmentId,
    level: snapshot.level,
    completionPercent: snapshot.completionPercent,
    sprsScore: snapshot.sprsScore,
    totalPractices: snapshot.totalPractices,
    totalObjectives: snapshot.totalObjectives,
    metCount: snapshot.metCount,
    partialCount: snapshot.partialCount,
    notMetCount: snapshot.notMetCount,
    notAssessedCount: snapshot.notAssessedCount,
    evidenceCount: snapshot.evidenceCount,
    poamOpenCount: snapshot.poamOpenCount,
    poamCompletedCount: snapshot.poamCompletedCount,
    byDomain: snapshot.byDomain,
    practiceCompletionScore: snapshot.practiceCompletionScore,
    controlsPostureScore: snapshot.controlsPostureScore,
    overallReadinessScore: snapshot.overallReadinessScore,
    source: "client_mvp",
    createdByUid: snapshot.createdByUid,
    createdAt: serverTimestamp(),
  });

  await setDoc(ref, payload);
  console.info("[assessmentFirestore] saved score snapshot", {
    orgId,
    assessmentId,
    snapshotId,
  });
}

export async function saveAssessmentLastSavedAt(
  orgId: string,
  assessmentId: string,
  uid: string
): Promise<void> {
  const ref = doc(db, "orgs", orgId, "assessments", assessmentId);
  await setDoc(ref, {
    lastSavedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedByUid: uid,
  }, { merge: true });
  console.info("[assessmentFirestore] updated assessment lastSavedAt", {
    orgId,
    assessmentId,
  });
}

export async function saveActivityLogEntry(
  orgId: string,
  assessmentId: string,
  entry: ActivityLogEntry
): Promise<void> {
  const ref = doc(db, "orgs", orgId, "assessments", assessmentId, "activityLog", cleanDocId(entry.activityId));
  const payload = stripUndefined({
    activityId: entry.activityId,
    orgId,
    assessmentId,
    actorUid: entry.actorUid,
    actorEmail: entry.actorEmail,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    practiceId: entry.practiceId,
    objectiveId: entry.objectiveId,
    summary: entry.summary,
    metadata: entry.metadata ? stripUndefined(entry.metadata) : undefined,
    createdAt: serverTimestamp(),
  });

  await setDoc(ref, payload);
  console.info("[assessmentFirestore] saved activity log entry", {
    orgId,
    assessmentId,
    activityId: entry.activityId,
    action: entry.action,
  });
}

export const toFirestoreDocId = cleanDocId;
