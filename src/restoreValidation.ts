export interface RestoreValidationResult {
  valid: boolean;
  version?: string;
  assessmentCount: number;
  practiceCount: number;
  objectiveCount: number;
  noteCount: number;
  poamCount: number;
  evidenceCount: number;
  errors: string[];
  warnings: string[];
}

const emptyResult = (): RestoreValidationResult => ({
  valid: false,
  assessmentCount: 0,
  practiceCount: 0,
  objectiveCount: 0,
  noteCount: 0,
  poamCount: 0,
  evidenceCount: 0,
  errors: [],
  warnings: [],
});

const isRecord = (value: unknown): value is Record<string, any> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getArray = (
  backup: Record<string, any>,
  key: string,
  warnings: string[]
): Record<string, any>[] => {
  const value = backup[key];
  if (value === undefined) {
    warnings.push(`${key} collection is missing; treating it as empty.`);
    return [];
  }
  if (!Array.isArray(value)) {
    warnings.push(`${key} collection is not an array; treating it as empty.`);
    return [];
  }
  return value.filter(isRecord);
};

export function validateRestoreBackupJson(contents: string): RestoreValidationResult {
  const result = emptyResult();
  let backup: unknown;

  try {
    backup = JSON.parse(contents);
  } catch {
    result.errors.push("Backup file is not valid JSON.");
    return result;
  }

  if (!isRecord(backup)) {
    result.errors.push("Backup root must be a JSON object.");
    return result;
  }

  const metadata = isRecord(backup.metadata) ? backup.metadata : {};
  const version = typeof metadata.exportVersion === "string"
    ? metadata.exportVersion
    : typeof backup.version === "string"
      ? backup.version
      : undefined;
  result.version = version;
  if (!version) {
    result.errors.push("Backup version is required.");
  } else if (version !== "backup_v1") {
    result.errors.push(`Unsupported backup version: ${version}.`);
  }

  const exportedAt = metadata.exportedAt ?? backup.exportedAt;
  if (typeof exportedAt !== "string" || Number.isNaN(Date.parse(exportedAt))) {
    result.errors.push("A valid exportedAt timestamp is required.");
  }

  const assessment = backup.assessment;
  if (!isRecord(assessment)) {
    result.errors.push("Assessment record is required.");
  } else {
    result.assessmentCount = 1;
    if (!assessment.id) result.errors.push("Assessment id is required.");
    if (!assessment.level) result.errors.push("Assessment level is required.");
    if (!assessment.orgId) result.errors.push("Assessment orgId is required.");
  }

  const practiceRecords = getArray(backup, "practiceRecords", result.warnings);
  const objectiveRecords = getArray(backup, "objectiveRecords", result.warnings);
  const notes = getArray(backup, "notes", result.warnings);
  const poamItems = getArray(backup, "poamItems", result.warnings);
  const evidence = getArray(backup, "evidence", result.warnings);

  result.practiceCount = practiceRecords.length;
  result.objectiveCount = objectiveRecords.length;
  result.noteCount = notes.length;
  result.poamCount = poamItems.length;
  result.evidenceCount = evidence.length;

  practiceRecords.forEach((record, index) => {
    if (!record.practiceId) result.errors.push(`Practice record ${index + 1} is missing practiceId.`);
  });
  objectiveRecords.forEach((record, index) => {
    if (!record.objectiveId) result.errors.push(`Objective record ${index + 1} is missing objectiveId.`);
    if (!record.practiceId) result.errors.push(`Objective record ${index + 1} is missing practiceId.`);
  });
  evidence.forEach((record, index) => {
    if (!record.id) result.errors.push(`Evidence record ${index + 1} is missing id.`);
    if (!record.fileName) result.errors.push(`Evidence record ${index + 1} is missing fileName.`);
  });

  result.valid = result.errors.length === 0;
  return result;
}
