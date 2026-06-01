import {
  doc,
  serverTimestamp,
  writeBatch,
  type DocumentReference,
} from "firebase/firestore";
import { db } from "./firebase";
import { getObjectiveRecordStorageKey, toFirestoreDocId } from "./assessmentFirestore";
import { validateRestoreBackupJson } from "./restoreValidation";

export interface RestoreExecutionResult {
  success: boolean;
  restoredAssessmentId?: string;
  assessmentWritten: boolean;
  practicesWritten: number;
  objectivesWritten: number;
  notesWritten: number;
  poamsWritten: number;
  evidenceMetadataWritten: number;
  warnings: string[];
  errors: string[];
}

type RestoreAssessmentBackupParams = {
  backup: any;
  orgId: string;
  userId: string;
  isSuperAdmin: boolean;
};

type RestoreWrite = {
  ref: DocumentReference;
  data: Record<string, any>;
};

const emptyResult = (): RestoreExecutionResult => ({
  success: false,
  assessmentWritten: false,
  practicesWritten: 0,
  objectivesWritten: 0,
  notesWritten: 0,
  poamsWritten: 0,
  evidenceMetadataWritten: 0,
  warnings: [],
  errors: [],
});

const chunkArray = <T,>(items: T[], size = 450): T[][] => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const omitUndefined = (value: Record<string, any>): Record<string, any> =>
  Object.fromEntries(Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined));

const asRecords = (value: unknown): Record<string, any>[] =>
  Array.isArray(value) ? value.filter(item => item && typeof item === "object") : [];

const fallbackId = (...parts: Array<string | number | undefined>): string =>
  parts.filter(part => part !== undefined && part !== "").join("::");

export async function restoreAssessmentBackup({
  backup,
  orgId,
  userId,
  isSuperAdmin,
}: RestoreAssessmentBackupParams): Promise<RestoreExecutionResult> {
  const result = emptyResult();
  const assessment = backup?.assessment;
  const assessmentId = typeof assessment?.id === "string" ? assessment.id.trim() : "";
  const validation = validateRestoreBackupJson(JSON.stringify(backup));

  if (!isSuperAdmin) result.errors.push("SuperAdmin access is required.");
  if (!validation.valid) result.errors.push("Backup must pass restore validation before restore.");
  if (!orgId) result.errors.push("Current organization is required.");
  if (!userId) result.errors.push("Current user is required.");
  if (!assessmentId) result.errors.push("Backup assessment id is required.");
  if (assessment?.orgId !== orgId) {
    result.errors.push("Backup assessment orgId does not match the current organization.");
  }
  if (result.errors.length > 0) return result;

  result.restoredAssessmentId = assessmentId;
  const assessmentRef = doc(db, "orgs", orgId, "assessments", assessmentId);
  const writes: RestoreWrite[] = [];

  writes.push({
    ref: assessmentRef,
    data: omitUndefined({
      ...assessment,
      id: undefined,
      assessmentId,
      orgId,
      updatedAt: serverTimestamp(),
      updatedByUid: userId,
    }),
  });

  const practiceRecords = asRecords(backup.practiceRecords);
  practiceRecords.forEach(record => {
    const practiceId = String(record.practiceId);
    writes.push({
      ref: doc(assessmentRef, "practiceRecords", toFirestoreDocId(practiceId)),
      data: omitUndefined({
        ...record,
        id: undefined,
        practiceId,
        assessmentId,
        orgId,
        updatedAt: serverTimestamp(),
        updatedByUid: userId,
      }),
    });
  });

  const objectiveRecords = asRecords(backup.objectiveRecords);
  objectiveRecords.forEach(record => {
    const objectiveId = String(record.objectiveId);
    const practiceId = String(record.practiceId);
    const storageKey = getObjectiveRecordStorageKey(practiceId, objectiveId);
    writes.push({
      ref: doc(assessmentRef, "objectiveRecords", toFirestoreDocId(storageKey)),
      data: omitUndefined({
        ...record,
        id: undefined,
        objectiveId,
        practiceId,
        storageKey,
        assessmentId,
        orgId,
        updatedAt: serverTimestamp(),
        updatedByUid: userId,
      }),
    });
  });

  const notes = asRecords(backup.notes);
  notes.forEach((record, index) => {
    const noteId = String(record.noteId || record.id || fallbackId(
      "restore",
      assessmentId,
      record.practiceId,
      record.objectiveId,
      index
    ));
    writes.push({
      ref: doc(db, "orgs", orgId, "notes", toFirestoreDocId(noteId)),
      data: omitUndefined({
        ...record,
        id: undefined,
        noteId,
        assessmentId,
        orgId,
        updatedAt: serverTimestamp(),
        updatedByUid: userId,
      }),
    });
  });

  const poamItems = asRecords(backup.poamItems);
  poamItems.forEach((record, index) => {
    const poamId = String(record.poamId || record.id || fallbackId("restore", assessmentId, "poam", index));
    writes.push({
      ref: doc(assessmentRef, "poamItems", toFirestoreDocId(poamId)),
      data: omitUndefined({
        ...record,
        id: undefined,
        poamId,
        assessmentId,
        orgId,
        updatedAt: serverTimestamp(),
        updatedByUid: userId,
      }),
    });
  });

  const evidence = asRecords(backup.evidence);
  evidence.forEach(record => {
    const evidenceId = String(record.evidenceId || record.id);
    if (!record.storagePath) {
      result.warnings.push(`Evidence ${evidenceId} has no storagePath.`);
    }
    writes.push({
      ref: doc(db, "orgs", orgId, "evidence", toFirestoreDocId(evidenceId)),
      data: omitUndefined({
        ...record,
        id: undefined,
        evidenceId,
        orgId,
        assessmentId,
        downloadUrl: record.downloadUrl || record.downloadURL,
        downloadURL: undefined,
        updatedAt: serverTimestamp(),
      }),
    });
  });
  if (evidence.length > 0) {
    result.warnings.push("Evidence file availability was not verified. Phase 17B restores metadata only.");
  }

  const activityId = crypto.randomUUID();
  writes.push({
    ref: doc(assessmentRef, "activityLog", toFirestoreDocId(activityId)),
    data: {
      activityId,
      type: "assessment_restore",
      action: "Assessment backup restored",
      actorUid: userId,
      restoredBy: userId,
      restoredAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      orgId,
      assessmentId,
      targetType: "assessment",
      targetId: assessmentId,
      summary: "Assessment backup restored",
      counts: {
        practices: practiceRecords.length,
        objectives: objectiveRecords.length,
        notes: notes.length,
        poams: poamItems.length,
        evidenceMetadata: evidence.length,
      },
    },
  });

  try {
    for (const writeChunk of chunkArray(writes)) {
      const batch = writeBatch(db);
      writeChunk.forEach(write => batch.set(write.ref, write.data, { merge: true }));
      await batch.commit();
    }
    result.success = true;
    result.assessmentWritten = true;
    result.practicesWritten = practiceRecords.length;
    result.objectivesWritten = objectiveRecords.length;
    result.notesWritten = notes.length;
    result.poamsWritten = poamItems.length;
    result.evidenceMetadataWritten = evidence.length;
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : "Assessment restore failed.");
  }

  return result;
}
