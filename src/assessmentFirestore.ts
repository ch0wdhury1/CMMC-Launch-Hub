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

function cleanDocId(id: string): string {
  return encodeURIComponent(id).replace(/\./g, "%2E");
}

function assessmentName(level: AssessmentLevel): string {
  return `Default CMMC Level ${level} Assessment`;
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
    getDocs(collection(db, "orgs", orgId, "notes")),
    getDocs(collection(assessmentRef, "poamItems")),
    getDocs(query(collection(assessmentRef, "scoreSnapshots"), orderBy("createdAt", "desc"))),
  ]);

  return {
    assessment,
    practiceRecords: practiceRecordsSnap.docs.map((d) => ({
      practiceId: decodeURIComponent(d.id),
      ...(d.data() as Omit<FirestorePracticeRecord, "practiceId">),
    })),
    objectiveRecords: objectiveRecordsSnap.docs.map((d) => ({
      objectiveId: decodeURIComponent(d.id),
      ...(d.data() as Omit<FirestoreObjectiveRecord, "objectiveId">),
    })),
    evidence: evidenceSnap.docs
      .map((d) => ({ evidenceId: d.id, ...(d.data() as Omit<EvidenceRecord, "evidenceId">) }))
      .filter((e) => e.assessmentId === assessmentId),
    notes: notesSnap.docs
      .map((d) => ({ noteId: d.id, ...(d.data() as Omit<NoteRecord, "noteId">) }))
      .filter((n) => n.assessmentId === assessmentId),
    poamItems: poamItemsSnap.docs.map((d) => ({
      poamId: d.id,
      id: d.id,
      ...(d.data() as Omit<FirestorePoamItem, "poamId" | "id">),
    })),
    scoreSnapshots: scoreSnapshotsSnap.docs.map((d) => ({
      snapshotId: d.id,
      ...(d.data() as Omit<ScoreSnapshot, "snapshotId">),
    })),
  };
}

export const toFirestoreDocId = cleanDocId;
