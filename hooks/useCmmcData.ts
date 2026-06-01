
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Domain,
  Practice,
  AssessmentObjective,
  ObjectiveStatus,
  PersistedState,
  CompanyProfile,
  UserProfile,
  SavedTemplate,
  PracticeRecord,
  PracticeStatus,
  ReadinessAnswers,
  SavedReport,
  ReadinessScores,
  ObjectiveRecord,
  StatusSource,
  PoamItem,
  ResponsibilityMatrixEntry,
  L2ExtractionResult,
  SubscriptionLevel,
  AssessmentLevel,
  ActivityLogEntry,
  FirestoreObjectiveStatus,
  FirestorePracticeRecord,
  FirestoreObjectiveRecord,
  EvidenceRecord,
  EvidenceFileUpload,
  EvidenceSummary,
  RecoveryDiagnostics,
  NoteRecord,
  FirestorePoamItem,
  Artifact,
  ScoreSnapshot
} from "../types";
import {
  getOrCreateDefaultAssessment,
  buildRecoverySummary,
  getDefaultAssessmentId,
  getObjectiveNoteId,
  getObjectiveRecordStorageKey,
  isFirestoreAssessmentsEnabled,
  loadAssessmentState,
  saveEvidenceRecord,
  saveNoteRecord,
  saveObjectiveRecord,
  savePoamItem,
  savePracticeRecord,
  saveAssessmentLastSavedAt,
  saveActivityLogEntry,
  archiveEvidenceRecord,
  saveScoreSnapshot,
} from "../src/assessmentFirestore";
import { uploadEvidenceFile } from "../src/evidenceStorage";
import { requestEvidenceOcr } from "../src/evidenceOcr";

import { generateReadinessReport } from '../services/geminiService';
import { READINESS_QUESTIONS } from '../data/readinessQuestions';
import {
  LOCAL_STORAGE_KEY,
  SAVED_TEMPLATES_KEY,
  STORAGE_VERSION,
  LEVEL_1_PRACTICE_IDS
} from "../constants";

const getAllQuestionIds = () => {
  return READINESS_QUESTIONS.flatMap(section => section.questions.map(q => q.id));
};

const initialAnswers = getAllQuestionIds().reduce((acc, id) => {
  acc[id] = '';
  return acc;
}, {} as ReadinessAnswers);

const DOMAIN_SORT_ORDER = ["AC", "AU", "AT", "CM", "IA", "IR", "MA", "MP", "PS", "PE", "RA", "CA", "SC", "SI"];

const canonicalizeDomainName = (name: string): string => {
  const n = name.trim();
  if (n.includes('(AC)')) return 'Access Control (AC)';
  if (n.includes('(AU)')) return 'Audit and Accountability (AU)';
  if (n.includes('(AT)')) return 'Awareness and Training (AT)';
  if (n.includes('(CM)')) return 'Configuration Management (CM)';
  if (n.includes('(IA)')) return 'Identification and Authentication (IA)';
  if (n.includes('(IR)')) return 'Incident Response (IR)';
  if (n.includes('(MA)')) return 'Maintenance (MA)';
  if (n.includes('(MP)')) return 'Media Protection (MP)';
  if (n.includes('(PS)')) return 'Personnel Security (PS)';
  if (n.includes('(PE)')) return 'Physical Protection (PE)';
  if (n.includes('(RA)')) return 'Risk Assessment (RA)';
  if (n.includes('(CA)')) return 'Security Assessment (CA)';
  if (n.includes('(SC)')) return 'System and Communications Protection (SC)';
  if (n.includes('(SI)')) return 'System and Information Integrity (SI)';
  return n;
};

const getDomainSortIndex = (name: string): number => {
  const match = name.match(/\(([A-Z]+)\)/);
  if (match && match[1]) {
    const idx = DOMAIN_SORT_ORDER.indexOf(match[1]);
    return idx !== -1 ? idx : 999;
  }
  return 999;
};

const normalizeTextBlock = (v: any): string[] => {
  if (!v) return [];
  return Array.isArray(v) ? v : [String(v)];
};

/**
 * Authoritative check for Level 1 practices based on the '.L1-' pattern in requirementId.
 */
const isLevel1Practice = (id: string): boolean => {
  return id.includes(".L1-");
};

const normalizePractice = (domainName: string, raw: any): Practice => {
  const id = raw.id || raw.requirementId;
  const name = raw.name || raw.requirementName;
  const rawObjectives = raw.assessment_objectives || raw.assessmentObjectives || [];
  const objectives: AssessmentObjective[] = rawObjectives.map((o: any) => ({
    id: o.id || o.objectiveId,
    text: o.text || o.determinationStatement,
    status: ObjectiveStatus.Pending,
    note: '',
    artifacts: []
  }));

  const level = isLevel1Practice(id) ? 1 : 2;

  return {
    uid: `${domainName}-${id}`,
    id: id,
    level,
    domainName: domainName,
    name: name,
    brief_description: raw.brief_description || raw.requirementStatement || "",
    assessment_objectives: objectives,
    potential_assessment_methods_and_objects: normalizeTextBlock(raw.potential_assessment_methods_and_objects || raw.assessmentMethods),
    discussion: normalizeTextBlock(raw.discussion),
    further_discussion: raw.further_discussion || raw.furtherDiscussion ? normalizeTextBlock(raw.further_discussion || raw.furtherDiscussion) : undefined,
    key_references: raw.key_references || raw.references || [],
    sprsWeight: raw.sprsWeight || (level === 1 ? 1 : 3),
  };
};

function loadPersistedState(): PersistedState | undefined {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!saved) return undefined;
    const parsed = JSON.parse(saved);
    if (parsed.version !== STORAGE_VERSION) {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      return undefined;
    }
    return parsed as PersistedState;
  } catch {
    return undefined;
  }
}

function savePersistedState(state: Omit<PersistedState, 'version'>) {
  const payload: PersistedState = { ...state, version: STORAGE_VERSION };
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
}

const defaultCompanyProfile: CompanyProfile = {
  id: crypto.randomUUID(),
  companyName: "My Company",
  users: [],
};

type UseCmmcDataOptions = {
  orgId?: string | null;
  uid?: string | null;
  actorEmail?: string | null;
  firestoreEnabled?: boolean;
  assessmentLevel?: SubscriptionLevel | "COMM_L1" | "COMM_L2" | "SPONSORED" | string | null;
};

const toAssessmentLevel = (level?: UseCmmcDataOptions["assessmentLevel"]): AssessmentLevel => {
  return String(level || "").includes("L2") ? 2 : 1;
};

const toSubscriptionLevel = (level?: UseCmmcDataOptions["assessmentLevel"]): SubscriptionLevel => {
  return toAssessmentLevel(level) === 2 ? "L2" : "L1";
};

const toLocalObjectiveStatus = (status?: FirestoreObjectiveStatus | ObjectiveStatus | string): ObjectiveStatus => {
  switch (status) {
    case "met":
    case ObjectiveStatus.Met:
      return ObjectiveStatus.Met;
    case "not_met":
    case ObjectiveStatus.NotMet:
      return ObjectiveStatus.NotMet;
    case "not_applicable":
    case ObjectiveStatus.NotApplicable:
      return ObjectiveStatus.NotApplicable;
    default:
      return ObjectiveStatus.Pending;
  }
};

const toFirestoreObjectiveStatus = (status: ObjectiveStatus): FirestoreObjectiveStatus => {
  switch (status) {
    case ObjectiveStatus.Met:
      return "met";
    case ObjectiveStatus.NotMet:
      return "not_met";
    case ObjectiveStatus.NotApplicable:
      return "not_applicable";
    default:
      return "pending";
  }
};

const createInitialRecords = (practices: Practice[]): PracticeRecord[] => {
  const now = new Date().toISOString();
  return practices.map(p => ({
    id: p.id,
    status: 'not_assessed',
    statusSource: 'none',
    lastUpdated: now,
    note: '',
    objectiveRecords: p.assessment_objectives.reduce((acc, obj) => {
      acc[obj.id] = { status: ObjectiveStatus.Pending, note: '', artifacts: [] };
      return acc;
    }, {} as { [key: string]: ObjectiveRecord }),
  }));
};

const toEvidenceUploadedAt = (evidence: EvidenceRecord): string => {
  if (typeof evidence.uploadedAt === "string") return evidence.uploadedAt;
  if (typeof evidence.createdAt === "string") return evidence.createdAt;
  if (evidence.createdAt?.toDate) return evidence.createdAt.toDate().toISOString();
  return new Date().toISOString();
};

const toPoamDate = (value: any): string | undefined => {
  if (typeof value === "string") return value;
  if (value?.toDate) return value.toDate().toISOString();
  return undefined;
};

const toLocalPoamItem = (item: FirestorePoamItem): PoamItem => ({
  id: item.id || item.poamId,
  title: item.title,
  description: item.description,
  relatedPracticeIds: item.relatedPracticeIds || [],
  category: item.category || "other",
  priority: item.priority,
  status: item.status,
  owner: item.owner || item.ownerName,
  assignedTo: item.assignedTo,
  assignedToName: item.assignedToName,
  assignedToEmail: item.assignedToEmail,
  assignedAt: item.assignedAt,
  assignedBy: item.assignedBy,
  createdAt: toPoamDate(item.createdAt) || new Date().toISOString(),
  targetDate: item.targetDate,
  completedDate: item.completedDate,
  source: item.source === "objective_gap" || item.source === "ai_generated" || item.source === "assessor"
    ? "manual"
    : item.source,
  notes: item.notes,
});

const mergeFirestorePracticeRecords = (
  baseRecords: PracticeRecord[],
  firestorePracticeRecords: FirestorePracticeRecord[],
  firestoreObjectiveRecords: FirestoreObjectiveRecord[],
  evidenceRecords: EvidenceRecord[],
  noteRecords: NoteRecord[]
): PracticeRecord[] => {
  const practiceMap = new Map(firestorePracticeRecords.map(r => [r.practiceId, r]));
  const objectiveMap = new Map(firestoreObjectiveRecords.map(r => [
    getObjectiveRecordStorageKey(r.practiceId, r.objectiveId),
    r,
  ]));
  const evidenceByObjective = new Map<string, EvidenceRecord[]>();
  evidenceRecords.forEach(e => {
    (e.practiceIds || []).forEach(practiceId => {
      (e.objectiveIds || []).forEach(objectiveId => {
        const storageKey = getObjectiveRecordStorageKey(practiceId, objectiveId);
        const current = evidenceByObjective.get(storageKey) || [];
        evidenceByObjective.set(storageKey, [...current, e]);
      });
    });
  });
  const notesByTarget = new Map(noteRecords.map(n => [`${n.targetType}:${n.targetId}`, n]));
  const objectiveNotes = new Map(noteRecords
    .filter(note => note.noteType === "assessor_review" && note.practiceId && note.objectiveId)
    .map(note => [getObjectiveRecordStorageKey(note.practiceId!, note.objectiveId!), note.content]));

  return baseRecords.map(record => {
    const fsPractice = practiceMap.get(record.id);
    const practiceNote = notesByTarget.get(`practice:${record.id}`)?.body;

    const objectiveRecords = Object.fromEntries(
      Object.entries(record.objectiveRecords).map(([objectiveId, objective]) => {
        const fsObjective = objectiveMap.get(getObjectiveRecordStorageKey(record.id, objectiveId));
        const objectiveNote = objectiveNotes.get(getObjectiveRecordStorageKey(record.id, objectiveId))
          ?? notesByTarget.get(`objective:${objectiveId}`)?.body;
        const evidenceArtifacts = (evidenceByObjective.get(getObjectiveRecordStorageKey(record.id, objectiveId)) || []).map(e => ({
          id: e.evidenceId,
          name: e.name || e.fileName || e.title || "Evidence",
          fileName: e.fileName,
          fileType: e.fileType || "",
          fileSize: e.fileSize,
          ocrSummary: e.ocrSummary || "",
          processingStatus: e.processingStatus,
          processingError: e.processingError,
          storagePath: e.storagePath,
          downloadUrl: e.downloadUrl,
          storageStatus: e.storageStatus,
          storageError: e.storageError,
          archived: e.archived,
          active: e.active,
          archivedAt: e.archivedAt,
          archivedByUid: e.archivedByUid,
          archiveReason: e.archiveReason,
          uploadedAt: toEvidenceUploadedAt(e),
          isFinalForm: e.isFinalForm ?? true,
        }));
        const mergedArtifacts = new Map(objective.artifacts.map(artifact => [artifact.id, artifact]));
        evidenceArtifacts.forEach(artifact => {
          mergedArtifacts.set(artifact.id, { ...mergedArtifacts.get(artifact.id), ...artifact });
        });

        return [objectiveId, {
          ...objective,
          status: toLocalObjectiveStatus(fsObjective?.status ?? objective.status),
          note: objectiveNote ?? fsObjective?.note ?? fsObjective?.noteSummary ?? objective.note,
          actionPoints: fsObjective?.actionPoints ?? objective.actionPoints,
          actionPointsSummary: fsObjective?.actionPointsSummary ?? fsObjective?.aiGuidanceSummary ?? objective.actionPointsSummary,
          assignedTo: fsObjective?.assignedTo ?? objective.assignedTo,
          assignedToName: fsObjective?.assignedToName ?? objective.assignedToName,
          assignedToEmail: fsObjective?.assignedToEmail ?? objective.assignedToEmail,
          assignedAt: fsObjective?.assignedAt ?? objective.assignedAt,
          assignedBy: fsObjective?.assignedBy ?? objective.assignedBy,
          artifacts: Array.from(mergedArtifacts.values()),
        }];
      })
    ) as { [objectiveId: string]: ObjectiveRecord };

    return {
      ...record,
      status: fsPractice?.status ?? record.status,
      statusSource: fsPractice?.statusSource ?? record.statusSource,
      lastUpdated: fsPractice?.lastUpdated ?? record.lastUpdated,
      note: fsPractice?.note ?? practiceNote ?? record.note,
      assignedTo: fsPractice?.assignedTo ?? record.assignedTo,
      assignedToName: fsPractice?.assignedToName ?? record.assignedToName,
      assignedToEmail: fsPractice?.assignedToEmail ?? record.assignedToEmail,
      assignedAt: fsPractice?.assignedAt ?? record.assignedAt,
      assignedBy: fsPractice?.assignedBy ?? record.assignedBy,
      objectiveRecords,
    };
  });
};

export const useCmmcData = (options: UseCmmcDataOptions = {}) => {
  const firestoreEnabled = options.firestoreEnabled ?? isFirestoreAssessmentsEnabled();
  const orgId = firestoreEnabled ? options.orgId || null : null;
  const uid = firestoreEnabled ? options.uid || null : null;
  const actorEmail = firestoreEnabled ? options.actorEmail || "" : "";
  const requestedAssessmentLevel = firestoreEnabled ? toAssessmentLevel(options.assessmentLevel) : 1;
  const [rawDomains, setRawDomains] = useState<Domain[]>([]);
  const [rawPractices, setRawPractices] = useState<Practice[]>([]);
  const [minedPractices, setMinedPractices] = useState<Practice[]>([]);
  const [highRiskPractices, setHighRiskPractices] = useState<string[]>([]);
  const [practiceRecords, setPracticeRecords] = useState<PracticeRecord[]>([]);
  const practiceRecordsRef = useRef<PracticeRecord[]>([]);
  const scoreSnapshotBaselineRef = useRef<{ contextKey: string; fingerprint: string } | null>(null);
  const scoreSnapshotTimeoutRef = useRef<number | null>(null);
  const noteActivityTimeoutsRef = useRef<Map<string, number>>(new Map());
  const [analyzerAnswers, setAnalyzerAnswers] = useState<ReadinessAnswers>(initialAnswers);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [poamItems, setPoamItems] = useState<PoamItem[]>([]);
  const [activityLogEntries, setActivityLogEntries] = useState<ActivityLogEntry[]>([]);
  const [responsibilityMatrix, setResponsibilityMatrix] = useState<ResponsibilityMatrixEntry[]>([]);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [subscriptionLevel, setSubscriptionLevel] = useState<SubscriptionLevel>("L1");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataSourceInfo, setDataSourceInfo] = useState<string>("Initializing...");
  const [firestoreLoadKey, setFirestoreLoadKey] = useState<string | null>(null);
  const [recoveryDiagnostics, setRecoveryDiagnostics] = useState<RecoveryDiagnostics>({
    assessmentShellLoaded: false,
    practicesLoaded: 0,
    objectivesLoaded: 0,
    evidenceLoaded: 0,
    notesLoaded: 0,
    poamLoaded: 0,
    snapshotsLoaded: 0,
    activityEntriesLoaded: 0,
    sourceOfTruthMode: firestoreEnabled ? "Firestore" : "localStorage",
  });

  useEffect(() => {
    practiceRecordsRef.current = practiceRecords;
  }, [practiceRecords]);

  useEffect(() => () => {
    noteActivityTimeoutsRef.current.forEach(timeoutId => window.clearTimeout(timeoutId));
    noteActivityTimeoutsRef.current.clear();
  }, []);

  useEffect(() => {
    const initializeData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Static JSON is the reference library for CMMC practice and objective content.
        // localStorage initializes the working state as a cache and offline fallback.
        const l1Url = '/cmmc_l1_prepop.json';
        const l2Url = '/cmmc_l2_prepop.json';

        const [l1Res, l2Res] = await Promise.all([
          fetch(l1Url),
          fetch(l2Url)
        ]);

        if (!l1Res.ok) throw new Error(`Failed to load L1 data`);
        if (!l2Res.ok) throw new Error(`Failed to load L2 data`);

        const l1Data = await l1Res.json();
        const l2Data = await l2Res.json();

        setDataSourceInfo(`/cmmc_l2_prepop.json | Version: ${l2Data.version || '1.0'} | Loaded OK`);

        const persisted = loadPersistedState();
        
        if (persisted) {
            setSubscriptionLevel(persisted.subscriptionLevel || "L2");
        } else if (firestoreEnabled && options.assessmentLevel) {
            setSubscriptionLevel(toSubscriptionLevel(options.assessmentLevel));
        } else {
            setSubscriptionLevel("L1");
        }

        const storedMined = persisted?.minedPractices || [];
        setMinedPractices(storedMined);

        const domainMap = new Map<string, Map<string, Practice>>();
        
        const mergeIntoMap = (data: any) => {
          if (!data || !data.domains) return;
          data.domains.forEach((d: any) => {
            const canonicalName = canonicalizeDomainName(d.domain_name);
            if (!domainMap.has(canonicalName)) {
              domainMap.set(canonicalName, new Map<string, Practice>());
            }
            const innerMap = domainMap.get(canonicalName)!;
            d.practices.forEach((p: any) => {
              const normalized = normalizePractice(canonicalName, p);
              innerMap.set(normalized.id, normalized);
            });
          });
        };

        // Merge L2 first, then L1 overrides to ensure base L2 set is complete
        mergeIntoMap(l2Data);
        mergeIntoMap(l1Data);
        
        storedMined.forEach(p => {
          const canonicalName = canonicalizeDomainName(p.domainName);
          if (!domainMap.has(canonicalName)) {
            domainMap.set(canonicalName, new Map<string, Practice>());
          }
          domainMap.get(canonicalName)!.set(p.id, p);
        });

        const finalDomains: Domain[] = Array.from(domainMap.entries())
          .map(([name, practiceMap]) => ({
            name,
            practices: Array.from(practiceMap.values()).sort((a, b) => a.id.localeCompare(b.id))
          }))
          .sort((a, b) => getDomainSortIndex(a.name) - getDomainSortIndex(b.name));

        const staticPractices = finalDomains.flatMap(d => d.practices);
        
        setRawDomains(finalDomains);
        setRawPractices(staticPractices);
        setHighRiskPractices(l1Data.high_risk_practices || []);

        if (persisted) {
          const mergedRecords = staticPractices.map(p => {
              const persistedRecord = persisted.practiceRecords.find(pr => pr.id === p.id);
              return {
                id: p.id,
                status: persistedRecord?.status || 'not_assessed',
                statusSource: persistedRecord?.statusSource || 'none',
                lastUpdated: persistedRecord?.lastUpdated || new Date().toISOString(),
                note: persistedRecord?.note || '',
                objectiveRecords: p.assessment_objectives.reduce((acc, obj) => {
                  acc[obj.id] = persistedRecord?.objectiveRecords?.[obj.id] || { status: ObjectiveStatus.Pending, note: '', artifacts: [] };
                  return acc;
                }, {} as { [key: string]: ObjectiveRecord })
              };
          });
          setCompanyProfile(persisted.companyProfile || defaultCompanyProfile);
          setPracticeRecords(mergedRecords);
          setAnalyzerAnswers(persisted.analyzerAnswers || initialAnswers);
          setSavedReports(persisted.savedReports || []);
          setPoamItems(persisted.poamItems || []);
          setResponsibilityMatrix(persisted.responsibilityMatrix || []);
        } else {
          const initialRecords: PracticeRecord[] = staticPractices.map(p => ({
            id: p.id,
            status: 'not_assessed',
            statusSource: 'none',
            lastUpdated: new Date().toISOString(),
            note: '',
            objectiveRecords: p.assessment_objectives.reduce((acc, obj) => {
                acc[obj.id] = { status: ObjectiveStatus.Pending, note: '', artifacts: [] };
                return acc;
            }, {} as { [key: string]: ObjectiveRecord }),
          }));
          setPracticeRecords(initialRecords);
          setCompanyProfile(defaultCompanyProfile);
          setResponsibilityMatrix(staticPractices.map(p => ({
            id: p.id, practiceId: p.id, practiceName: p.name.split('–')[1]?.trim() || p.name,
            domain: p.domainName, responsibility: 'customer', lastUpdated: new Date().toISOString()
          })));
        }
      } catch (err: any) {
        console.error("Critical Data Load Error:", err);
        setError(`Failed to load assessment data: ${err.message}.`);
      } finally {
        setLoading(false);
      }
    };
    initializeData();
  }, []);

  useEffect(() => {
    if (!firestoreEnabled || loading || error || !orgId || !uid) return;

    const key = `${orgId}:${requestedAssessmentLevel}`;
    if (firestoreLoadKey === key) return;

    let cancelled = false;
    const loadFirestoreOverlay = async () => {
      try {
        const assessment = await getOrCreateDefaultAssessment({
          orgId,
          uid,
          level: requestedAssessmentLevel,
        });
        const firestoreState = await loadAssessmentState(orgId, assessment.assessmentId);
        const recoverySummary = buildRecoverySummary(firestoreState);

        if (cancelled) return;

        // With Firestore enabled, persisted Firestore records are the source of truth.
        // Existing localStorage state remains only as fallback for records not yet present in Firestore.
        setPracticeRecords(prev => mergeFirestorePracticeRecords(
          prev,
          firestoreState.practiceRecords,
          firestoreState.objectiveRecords,
          firestoreState.evidence,
          firestoreState.notes
        ));

        if (firestoreState.poamItems.length > 0) {
          setPoamItems(prev => {
            const merged = new Map(prev.map(item => [item.id, item]));
            firestoreState.poamItems.forEach(item => {
              const localItem = toLocalPoamItem(item);
              merged.set(localItem.id, localItem);
            });
            return Array.from(merged.values());
          });
        }
        // Loaded for future audit timeline, assessor history, collaboration feed,
        // and report support. There is intentionally no visible UI in this phase.
        setActivityLogEntries(firestoreState.activityLogEntries);
        setRecoveryDiagnostics({
          assessmentShellLoaded: firestoreState.assessment !== null,
          ...recoverySummary,
          activityEntriesLoaded: firestoreState.activityLogEntries.length,
          sourceOfTruthMode: "Firestore",
          lastSavedAt: firestoreState.assessment?.lastSavedAt,
        });

        setDataSourceInfo(prev => `${prev} | Firestore assessment: ${assessment.assessmentId}`);
        setFirestoreLoadKey(key);
        console.info("[SourceOfTruth] Firestore assessment state applied");
      } catch (firestoreErr) {
        console.warn("Firestore assessment load skipped; using local state.", firestoreErr);
        if (!cancelled) {
          setRecoveryDiagnostics(prev => ({ ...prev, sourceOfTruthMode: "localStorage" }));
          setFirestoreLoadKey(key);
        }
      }
    };

    loadFirestoreOverlay();

    return () => {
      cancelled = true;
    };
  }, [firestoreEnabled, loading, error, orgId, uid, requestedAssessmentLevel, firestoreLoadKey]);

  useEffect(() => {
    if (!loading && !error) {
      savePersistedState({ 
        subscriptionLevel,
        companyProfile: companyProfile || undefined,
        practiceRecords,
        minedPractices,
        analyzerAnswers,
        savedReports,
        poamItems, 
        responsibilityMatrix,
      });
    }
  }, [subscriptionLevel, companyProfile, practiceRecords, minedPractices, analyzerAnswers, savedReports, poamItems, responsibilityMatrix, loading, error]);

  /**
   * Filtered list of all practices for current assessment level.
   * Scopes strictly based on '.L1-' pattern for Level 1.
   */
  const allPractices = useMemo(() => {
    if (subscriptionLevel === "L1") {
      return rawPractices.filter(p => isLevel1Practice(p.id));
    }
    return rawPractices;
  }, [rawPractices, subscriptionLevel]);

  /**
   * Filtered domains containing only practices for current assessment level.
   */
  const domains = useMemo(() => {
    return rawDomains
      .map(d => ({
        ...d,
        practices: subscriptionLevel === "L1" 
          ? d.practices.filter(p => isLevel1Practice(p.id))
          : d.practices
      }))
      .filter(d => d.practices.length > 0);
  }, [rawDomains, subscriptionLevel]);

  const upgradeSubscription = useCallback(() => {
    setSubscriptionLevel("L2");
  }, []);

  const commitMinedRequirement = useCallback((mined: L2ExtractionResult) => {
    const canonicalName = canonicalizeDomainName(mined.domain + " Domain");
    const normalized = normalizePractice(canonicalName, mined);
    
    setMinedPractices(prev => {
      const idx = prev.findIndex(p => p.id === normalized.id);
      if (idx !== -1) {
        const updated = [...prev];
        updated[idx] = normalized;
        return updated;
      }
      return [...prev, normalized];
    });

    setRawPractices(prev => {
      const idx = prev.findIndex(p => p.id === normalized.id);
      if (idx !== -1) {
        const updated = [...prev];
        updated[idx] = normalized;
        return updated;
      }
      return [...prev, normalized];
    });

    setRawDomains(prev => {
      const domainIdx = prev.findIndex(d => d.name === canonicalName);
      if (domainIdx === -1) {
        const newDomains = [...prev, { name: canonicalName, practices: [normalized] }];
        return newDomains.sort((a, b) => getDomainSortIndex(a.name) - getDomainSortIndex(b.name));
      }
      const newDomains = [...prev];
      const pIdx = newDomains[domainIdx].practices.findIndex(p => p.id === normalized.id);
      if (pIdx !== -1) {
        newDomains[domainIdx].practices[pIdx] = normalized;
      } else {
        newDomains[domainIdx].practices = [...newDomains[domainIdx].practices, normalized];
      }
      return newDomains;
    });

    setPracticeRecords(prev => {
      if (prev.find(r => r.id === normalized.id)) return prev;
      return [...prev, {
        id: normalized.id, status: 'not_assessed', statusSource: 'none',
        lastUpdated: new Date().toISOString(), note: '',
        objectiveRecords: normalized.assessment_objectives.reduce((acc, obj) => {
          acc[obj.id] = { status: ObjectiveStatus.Pending, note: '', artifacts: [] };
          return acc;
        }, {} as { [key: string]: ObjectiveRecord }),
      }];
    });

    setResponsibilityMatrix(prev => {
      if (prev.find(e => e.practiceId === normalized.id)) return prev;
      return [...prev, {
        id: normalized.id, practiceId: normalized.id,
        practiceName: normalized.name.split('–')[1]?.trim() || normalized.name,
        domain: normalized.domainName, responsibility: 'customer', lastUpdated: new Date().toISOString()
      }];
    });
  }, []);

  const updateCompanyProfile = (updates: Partial<CompanyProfile>) => setCompanyProfile(prev => prev ? { ...prev, ...updates } : null);
  const addUserToCompany = (user: UserProfile) => setCompanyProfile(prev => prev ? { ...prev, users: [...prev.users, user] } : null);
  const persistPracticeRecord = useCallback((record: PracticeRecord) => {
    if (!firestoreEnabled || !orgId || !uid) return;

    const assessmentId = getDefaultAssessmentId(requestedAssessmentLevel);
    void savePracticeRecord(orgId, assessmentId, {
      practiceId: record.id,
      orgId,
      assessmentId,
      status: record.status,
      statusSource: record.statusSource,
      note: record.note,
      lastUpdated: record.lastUpdated,
      assignedTo: record.assignedTo,
      assignedToName: record.assignedToName,
      assignedToEmail: record.assignedToEmail,
      assignedAt: record.assignedAt,
      assignedBy: record.assignedBy,
      updatedByUid: uid,
    }).catch(error => {
      console.error("[assessmentFirestore] practice record save failed; local state retained", {
        orgId,
        assessmentId,
        practiceId: record.id,
        error,
      });
    });
  }, [firestoreEnabled, orgId, uid, requestedAssessmentLevel]);

  const persistObjectiveRecord = useCallback((practiceId: string, objectiveId: string, record: ObjectiveRecord) => {
    if (!firestoreEnabled || !orgId || !uid) return;

    const assessmentId = getDefaultAssessmentId(requestedAssessmentLevel);
    void saveObjectiveRecord(orgId, assessmentId, {
      objectiveId,
      practiceId,
      orgId,
      assessmentId,
      status: toFirestoreObjectiveStatus(record.status),
      note: record.note,
      actionPoints: record.actionPoints,
      actionPointsSummary: record.actionPointsSummary,
      assignedTo: record.assignedTo,
      assignedToName: record.assignedToName,
      assignedToEmail: record.assignedToEmail,
      assignedAt: record.assignedAt,
      assignedBy: record.assignedBy,
      updatedByUid: uid,
    }).catch(error => {
      console.error("[assessmentFirestore] objective record save failed; local state retained", {
        orgId,
        assessmentId,
        practiceId,
        objectiveId,
        error,
      });
    });
  }, [firestoreEnabled, orgId, uid, requestedAssessmentLevel]);

  const logActivity = useCallback((entry: Omit<ActivityLogEntry, "activityId" | "orgId" | "assessmentId" | "actorUid" | "actorEmail">) => {
    if (!firestoreEnabled || !orgId || !uid) return;

    const assessmentId = getDefaultAssessmentId(requestedAssessmentLevel);
    const activityId = crypto.randomUUID();
    void saveActivityLogEntry(orgId, assessmentId, {
      ...entry,
      activityId,
      orgId,
      assessmentId,
      actorUid: uid,
      actorEmail,
    }).catch(error => {
      console.error("[assessmentFirestore] activity log save failed; primary action retained", {
        orgId,
        assessmentId,
        activityId,
        action: entry.action,
        error,
      });
    });
  }, [actorEmail, firestoreEnabled, orgId, requestedAssessmentLevel, uid]);

  const updateCachedArtifact = useCallback((
    practiceId: string,
    objectiveId: string,
    evidenceId: string,
    updates: Partial<Artifact>
  ) => {
    setPracticeRecords(prev => {
      const next = prev.map(practice => practice.id === practiceId
        ? {
            ...practice,
            objectiveRecords: {
              ...practice.objectiveRecords,
              [objectiveId]: {
                ...practice.objectiveRecords[objectiveId],
                artifacts: (practice.objectiveRecords[objectiveId]?.artifacts || []).map(artifact =>
                  artifact.id === evidenceId ? {...artifact, ...updates} : artifact
                ),
              },
            },
          }
        : practice
      );
      practiceRecordsRef.current = next;
      return next;
    });
  }, []);

  const persistEvidenceRecords = useCallback((practiceId: string, objectiveId: string, artifacts: Artifact[], evidenceFiles: EvidenceFileUpload[] = []) => {
    if (!firestoreEnabled || !orgId || !uid) return;

    const assessmentId = getDefaultAssessmentId(requestedAssessmentLevel);
    artifacts.forEach(artifact => {
      const evidenceFile = evidenceFiles.find(upload => upload.evidenceId === artifact.id)?.file;
      const baseRecord: EvidenceRecord = {
        evidenceId: artifact.id,
        orgId,
        assessmentId,
        practiceIds: [practiceId],
        objectiveIds: [objectiveId],
        title: artifact.name,
        name: artifact.name,
        description: artifact.description,
        fileName: artifact.fileName || artifact.name,
        fileType: artifact.fileType,
        fileSize: artifact.fileSize,
        ocrSummary: artifact.ocrSummary,
        processingStatus: artifact.processingStatus,
        processingError: artifact.processingError,
        uploadedByUid: uid,
        reviewStatus: "uploaded",
        source: "local_upload_metadata",
      };
      const persistRecord = async () => {
        if (!evidenceFile) {
          await saveEvidenceRecord(orgId, baseRecord);
          return baseRecord;
        }

        let recordToSave: EvidenceRecord;
        try {
          const uploaded = await uploadEvidenceFile({
            orgId,
            evidenceId: artifact.id,
            file: evidenceFile,
          });
          recordToSave = {
            ...baseRecord,
            ...uploaded,
            storageStatus: "uploaded",
          };
        } catch (storageError) {
          const rawMessage = storageError instanceof Error ? storageError.message : "";
          recordToSave = {
            ...baseRecord,
            uploadedAt: artifact.uploadedAt,
            storageStatus: "upload_failed",
            storageError: rawMessage.trim().replace(/\s+/g, " ").slice(0, 160) || "Storage upload failed",
            processingStatus: "ocr_failed",
            processingError: "OCR skipped because Storage upload failed",
          };
        }

        await saveEvidenceRecord(orgId, recordToSave);
        return recordToSave;
      };

      void persistRecord().then(savedRecord => {
        updateCachedArtifact(practiceId, objectiveId, artifact.id, {
          name: savedRecord.name || savedRecord.fileName || artifact.name,
          fileName: savedRecord.fileName || artifact.fileName,
          fileType: savedRecord.fileType || artifact.fileType,
          fileSize: savedRecord.fileSize ?? artifact.fileSize,
          storagePath: savedRecord.storagePath,
          downloadUrl: savedRecord.downloadUrl,
          storageStatus: savedRecord.storageStatus,
          storageError: savedRecord.storageError,
        });
        logActivity({
          action: "evidence.uploaded",
          targetType: "evidence",
          targetId: artifact.id,
          practiceId,
          objectiveId,
          summary: `Evidence metadata uploaded: ${artifact.name}`,
          metadata: {
            fileName: artifact.fileName || artifact.name,
            fileType: artifact.fileType,
            fileSize: artifact.fileSize,
            storageStatus: savedRecord.storageStatus,
          },
        });
        if (savedRecord.storageStatus !== "uploaded" || !savedRecord.storagePath) {
          updateCachedArtifact(practiceId, objectiveId, artifact.id, {
            processingStatus: "ocr_failed",
            processingError: savedRecord.processingError || "OCR skipped because Storage upload failed",
          });
          return;
        }

        void requestEvidenceOcr({
          orgId,
          assessmentId,
          evidenceId: artifact.id,
          storagePath: savedRecord.storagePath,
          fileName: savedRecord.fileName || artifact.name,
          fileType: savedRecord.fileType || artifact.fileType,
          fileSize: savedRecord.fileSize ?? artifact.fileSize ?? 0,
          practiceIds: savedRecord.practiceIds,
          objectiveIds: savedRecord.objectiveIds,
        }).then(result => {
          updateCachedArtifact(practiceId, objectiveId, artifact.id, {
            ocrSummary: result.ocrSummary,
            processingStatus: "ocr_completed",
            processingError: undefined,
          });
        }).catch(error => {
          const rawMessage = error instanceof Error ? error.message : "";
          const processingError = rawMessage.trim().replace(/\s+/g, " ").slice(0, 160) || "OCR processing failed";
          console.warn("[evidence-ocr] OCR failed; uploaded evidence retained", {
            orgId,
            assessmentId,
            evidenceId: artifact.id,
            error: processingError,
          });
          updateCachedArtifact(practiceId, objectiveId, artifact.id, {
            processingStatus: "ocr_failed",
            processingError,
          });
        });
      }).catch(error => {
        console.error("[assessmentFirestore] evidence metadata save failed; local state retained", {
          orgId,
          assessmentId,
          evidenceId: artifact.id,
          practiceId,
          objectiveId,
          error,
        });
      });
    });
  }, [firestoreEnabled, logActivity, orgId, uid, requestedAssessmentLevel, updateCachedArtifact]);

  const archiveEvidence = useCallback(async (
    practiceId: string,
    objectiveId: string,
    artifact: Artifact,
    archiveReason: string
  ) => {
    if (!firestoreEnabled || !orgId || !uid) {
      throw new Error("Evidence archive requires Firestore assessment mode.");
    }

    await archiveEvidenceRecord(orgId, artifact.id, uid, archiveReason);
    updateCachedArtifact(practiceId, objectiveId, artifact.id, {
      archived: true,
      active: false,
      archivedAt: new Date().toISOString(),
      archivedByUid: uid,
      archiveReason,
    });
    logActivity({
      action: "evidence.archived",
      targetType: "evidence",
      targetId: artifact.id,
      practiceId,
      objectiveId,
      summary: "Evidence archived",
      metadata: {
        evidenceId: artifact.id,
        fileName: artifact.fileName || artifact.name,
        archiveReason,
      },
    });
  }, [firestoreEnabled, logActivity, orgId, uid, updateCachedArtifact]);

  const persistObjectiveNote = useCallback((practiceId: string, objectiveId: string, content: string) => {
    if (!firestoreEnabled || !orgId || !uid) return;

    const assessmentId = getDefaultAssessmentId(requestedAssessmentLevel);
    const noteId = getObjectiveNoteId(practiceId, objectiveId);
    void saveNoteRecord(orgId, {
      noteId,
      orgId,
      assessmentId,
      practiceId,
      objectiveId,
      noteType: "assessor_review",
      content,
      updatedByUid: uid,
    }).catch(error => {
      console.error("[assessmentFirestore] assessor review note save failed; local state retained", {
        orgId,
        assessmentId,
        noteId,
        practiceId,
        objectiveId,
        error,
      });
    });
  }, [firestoreEnabled, orgId, uid, requestedAssessmentLevel]);

  const updatePracticeNote = useCallback((id: string, note: string) => {
    const nextRecords = practiceRecordsRef.current.map(p => p.id === id
      ? { ...p, note, lastUpdated: new Date().toISOString() }
      : p
    );
    practiceRecordsRef.current = nextRecords;
    setPracticeRecords(nextRecords);

    const updatedRecord = nextRecords.find(p => p.id === id);
    if (updatedRecord) persistPracticeRecord(updatedRecord);
  }, [persistPracticeRecord]);

  const updatePracticeAssignment = useCallback((id: string, assignment: Pick<
    PracticeRecord,
    "assignedTo" | "assignedToName" | "assignedToEmail" | "assignedAt" | "assignedBy"
  >) => {
    const nextRecords = practiceRecordsRef.current.map(p => p.id === id
      ? { ...p, ...assignment, lastUpdated: new Date().toISOString() }
      : p
    );
    practiceRecordsRef.current = nextRecords;
    setPracticeRecords(nextRecords);

    const updatedRecord = nextRecords.find(p => p.id === id);
    if (updatedRecord) persistPracticeRecord(updatedRecord);
  }, [persistPracticeRecord]);

  const updateObjectiveRecord = useCallback((practiceId: string, objectiveId: string, updates: Partial<ObjectiveRecord>, evidenceFiles: EvidenceFileUpload[] = []) => {
    let updatedObjective: ObjectiveRecord | undefined;
    let updatedPractice: PracticeRecord | undefined;
    let addedArtifacts: Artifact[] = [];
    let previousStatus: ObjectiveStatus | undefined;
    const nextRecords = practiceRecordsRef.current.map(p => {
      if (p.id !== practiceId) return p;
      const previousObjective = p.objectiveRecords[objectiveId] || { status: ObjectiveStatus.Pending, note: '', artifacts: [] };
      previousStatus = previousObjective.status;
      if (updates.artifacts) {
        const existingArtifactIds = new Set(previousObjective.artifacts.map(artifact => artifact.id));
        addedArtifacts = updates.artifacts.filter(artifact => !existingArtifactIds.has(artifact.id));
      }
      const newObjectiveRecords = {
        ...p.objectiveRecords,
        [objectiveId]: { ...previousObjective, ...updates }
      };
      
      const objectives = Object.values(newObjectiveRecords) as ObjectiveRecord[];
      const hasNotMet = objectives.some(o => o.status === ObjectiveStatus.NotMet);
      const allMetOrNA = objectives.every(o => o.status === ObjectiveStatus.Met || o.status === ObjectiveStatus.NotApplicable);
      const anyProgress = objectives.some(o => o.status !== ObjectiveStatus.Pending);

      let newStatus: PracticeStatus = 'not_assessed';
      if (hasNotMet) newStatus = 'not_met';
      else if (allMetOrNA && objectives.length > 0) newStatus = 'met';
      else if (anyProgress) newStatus = 'partial';

      updatedObjective = newObjectiveRecords[objectiveId];
      updatedPractice = { ...p, objectiveRecords: newObjectiveRecords, status: newStatus, statusSource: 'auto' as StatusSource, lastUpdated: new Date().toISOString() };
      return updatedPractice;
    });

    practiceRecordsRef.current = nextRecords;
    setPracticeRecords(nextRecords);

    if (updatedObjective) persistObjectiveRecord(practiceId, objectiveId, updatedObjective);
    if (updatedPractice) persistPracticeRecord(updatedPractice);
    if (addedArtifacts.length) persistEvidenceRecords(practiceId, objectiveId, addedArtifacts, evidenceFiles);
    if (updates.note !== undefined) persistObjectiveNote(practiceId, objectiveId, updates.note);
    if (updates.status !== undefined && updates.status !== previousStatus) {
      logActivity({
        action: "objective.status.changed",
        targetType: "objective",
        targetId: getObjectiveRecordStorageKey(practiceId, objectiveId),
        practiceId,
        objectiveId,
        summary: `Objective status changed from ${previousStatus || ObjectiveStatus.Pending} to ${updates.status}`,
        metadata: {
          previousStatus: previousStatus || ObjectiveStatus.Pending,
          status: updates.status,
        },
      });
    }
    if (updates.note !== undefined) {
      const activityKey = getObjectiveRecordStorageKey(practiceId, objectiveId);
      const existingTimeout = noteActivityTimeoutsRef.current.get(activityKey);
      if (existingTimeout !== undefined) window.clearTimeout(existingTimeout);
      const timeoutId = window.setTimeout(() => {
        noteActivityTimeoutsRef.current.delete(activityKey);
        logActivity({
          action: "objective.note.updated",
          targetType: "objective",
          targetId: activityKey,
          practiceId,
          objectiveId,
          summary: "Objective assessor review note updated",
        });
      }, 1200);
      noteActivityTimeoutsRef.current.set(activityKey, timeoutId);
    }
  }, [logActivity, persistEvidenceRecords, persistObjectiveNote, persistObjectiveRecord, persistPracticeRecord]);

  const persistPoamItem = useCallback((item: PoamItem, action: "poam.created" | "poam.updated") => {
    if (!firestoreEnabled || !orgId || !uid) return;

    const assessmentId = getDefaultAssessmentId(requestedAssessmentLevel);
    void savePoamItem(orgId, assessmentId, {
      ...item,
      poamId: item.id,
      orgId,
      assessmentId,
      ownerName: item.owner,
      createdByUid: uid,
      updatedByUid: uid,
    }).then(() => {
      logActivity({
        action,
        targetType: "poam",
        targetId: item.id,
        summary: action === "poam.created" ? `POA&M item created: ${item.title}` : `POA&M item updated: ${item.title}`,
        metadata: {
          priority: item.priority,
          status: item.status,
        },
      });
    }).catch(error => {
      console.error("[assessmentFirestore] POA&M item save failed; local state retained", {
        orgId,
        assessmentId,
        poamId: item.id,
        error,
      });
    });
  }, [firestoreEnabled, logActivity, orgId, uid, requestedAssessmentLevel]);

  const updatePoamItem = (item: PoamItem) => {
    setPoamItems(prev => prev.map(p => p.id === item.id ? item : p));
    persistPoamItem(item, "poam.updated");
  };
  const addPoamItem = (item: Omit<PoamItem, 'id' | 'createdAt' | 'source'>) => {
    const newItem = { ...item, id: crypto.randomUUID(), createdAt: new Date().toISOString(), source: 'manual' as const };
    setPoamItems(prev => [...prev, newItem]);
    persistPoamItem(newItem, "poam.created");
  };

  const updateResponsibilityMatrixEntry = (id: string, updates: Partial<ResponsibilityMatrixEntry>) => {
    setResponsibilityMatrix(prev => prev.map(e => e.id === id ? { ...e, ...updates, lastUpdated: new Date().toISOString() } : e));
  };

  const scores = useMemo((): ReadinessScores => {
      const activePractices = allPractices;
      const totalCount = activePractices.length;
      if (totalCount === 0) return { practiceCompletionScore: 0, controlsPostureScore: 0, overallReadinessScore: 0 };
      
      const recordMap = new Map(practiceRecords.map(r => [r.id, r]));
      
      let metCount = 0;
      let partialCount = 0;

      activePractices.forEach(p => {
          const r = recordMap.get(p.id);
          if (r?.status === "met") metCount++;
          else if (r?.status === "partial") partialCount++;
      });

      const score = ((metCount + 0.5 * partialCount) / totalCount) * 100;
      return { 
          practiceCompletionScore: Math.round(score), 
          controlsPostureScore: Math.round(score), 
          overallReadinessScore: Math.round(score) 
      };
  }, [practiceRecords, allPractices]);

  const evidenceSummary = useMemo((): EvidenceSummary => {
    const recordMap = new Map(practiceRecords.map(record => [record.id, record]));
    const evidenceById = new Map<string, Artifact>();
    const evidenceByPracticeId: Record<string, Artifact[]> = {};
    const evidenceByObjectiveId: Record<string, Artifact[]> = {};
    const evidenceByDomain: Record<string, Artifact[]> = {};
    const practicesWithoutEvidence: string[] = [];
    const objectivesWithoutEvidence: string[] = [];

    allPractices.forEach(practice => {
      const practiceRecord = recordMap.get(practice.id);
      const practiceEvidence = new Map<string, Artifact>();

      practice.assessment_objectives.forEach(objective => {
        const artifacts = practiceRecord?.objectiveRecords[objective.id]?.artifacts || [];
        evidenceByObjectiveId[getObjectiveRecordStorageKey(practice.id, objective.id)] = artifacts;
        if (artifacts.length === 0) {
          objectivesWithoutEvidence.push(getObjectiveRecordStorageKey(practice.id, objective.id));
        }

        artifacts.forEach(artifact => {
          evidenceById.set(artifact.id, artifact);
          practiceEvidence.set(artifact.id, artifact);
        });
      });

      const practiceArtifacts = Array.from(practiceEvidence.values());
      evidenceByPracticeId[practice.id] = practiceArtifacts;
      if (practiceArtifacts.length === 0) practicesWithoutEvidence.push(practice.id);

      const domainArtifacts = new Map(
        (evidenceByDomain[practice.domainName] || []).map(artifact => [artifact.id, artifact])
      );
      practiceArtifacts.forEach(artifact => domainArtifacts.set(artifact.id, artifact));
      evidenceByDomain[practice.domainName] = Array.from(domainArtifacts.values());
    });

    const evidence = Array.from(evidenceById.values());
    const summary = {
      totalEvidenceCount: evidence.length,
      evidenceWithStorageCount: evidence.filter(artifact => artifact.storageStatus === "uploaded" || Boolean(artifact.storagePath)).length,
      evidenceWithoutStorageCount: evidence.filter(artifact => artifact.storageStatus !== "uploaded" && !artifact.storagePath).length,
      ocrCompletedCount: evidence.filter(artifact => artifact.processingStatus === "ocr_completed").length,
      ocrFailedCount: evidence.filter(artifact => artifact.processingStatus === "ocr_failed").length,
      ocrPendingCount: evidence.filter(artifact => artifact.processingStatus !== "ocr_completed" && artifact.processingStatus !== "ocr_failed").length,
      evidenceByPracticeId,
      evidenceByObjectiveId,
      evidenceByDomain,
      practicesWithoutEvidence,
      objectivesWithoutEvidence,
    };
    console.info("[EvidenceSummary] Built evidence summary", {
      totalEvidenceCount: summary.totalEvidenceCount,
      practicesWithoutEvidence: summary.practicesWithoutEvidence.length,
      objectivesWithoutEvidence: summary.objectivesWithoutEvidence.length,
    });
    return summary;
  }, [allPractices, practiceRecords]);

  const scoreSnapshotFingerprint = useMemo(() => {
    const activePracticeIds = new Set(allPractices.map(practice => practice.id));
    return JSON.stringify({
    practices: practiceRecords.filter(record => activePracticeIds.has(record.id)).map(record => ({
      id: record.id,
      status: record.status,
      objectives: Object.entries(record.objectiveRecords).map(([objectiveId, objective]) => ({
        objectiveId,
        status: objective.status,
        evidenceIds: objective.artifacts.map(artifact => artifact.id).sort(),
      })),
    })),
    poamItems: poamItems.map(item => ({
      id: item.id,
      status: item.status,
      priority: item.priority,
      targetDate: item.targetDate,
      completedDate: item.completedDate,
    })),
  });
  }, [allPractices, practiceRecords, poamItems]);

  const buildScoreSnapshot = useCallback((): ScoreSnapshot | null => {
    if (!orgId || !uid) return null;

    const recordMap = new Map(practiceRecords.map(record => [record.id, record]));
    const activeRecords = allPractices.map(practice => recordMap.get(practice.id)).filter(Boolean) as PracticeRecord[];
    const totalPractices = allPractices.length;
    const totalObjectives = allPractices.reduce((total, practice) => total + practice.assessment_objectives.length, 0);
    const metCount = activeRecords.filter(record => record.status === "met").length;
    const partialCount = activeRecords.filter(record => record.status === "partial").length;
    const notMetCount = activeRecords.filter(record => record.status === "not_met").length;
    const notAssessedCount = activeRecords.filter(record => record.status === "not_assessed").length;
    const evidenceIds = new Set(activeRecords.flatMap(record =>
      Object.values(record.objectiveRecords).flatMap(objective => objective.artifacts.map(artifact => artifact.id))
    ));
    const byDomain = Object.fromEntries(domains.map(domain => {
      const domainRecords = domain.practices.map(practice => recordMap.get(practice.id)).filter(Boolean) as PracticeRecord[];
      const completed = domainRecords.filter(record => record.status === "met").length;
      const partial = domainRecords.filter(record => record.status === "partial").length;
      const percent = domain.practices.length > 0
        ? Math.round(((completed + 0.5 * partial) / domain.practices.length) * 100)
        : 0;
      return [domain.name, percent];
    }));

    return {
      snapshotId: crypto.randomUUID(),
      orgId,
      assessmentId: getDefaultAssessmentId(requestedAssessmentLevel),
      level: requestedAssessmentLevel,
      completionPercent: scores.practiceCompletionScore,
      totalPractices,
      totalObjectives,
      metCount,
      partialCount,
      notMetCount,
      notAssessedCount,
      evidenceCount: evidenceIds.size,
      poamOpenCount: poamItems.filter(item => item.status === "open" || item.status === "in_progress").length,
      poamCompletedCount: poamItems.filter(item => item.status === "completed").length,
      byDomain,
      practiceCompletionScore: scores.practiceCompletionScore,
      controlsPostureScore: scores.controlsPostureScore,
      overallReadinessScore: scores.overallReadinessScore,
      source: "client_mvp",
      createdByUid: uid,
    };
  }, [allPractices, domains, orgId, poamItems, practiceRecords, requestedAssessmentLevel, scores, uid]);

  useEffect(() => {
    if (!firestoreEnabled || loading || error || !orgId || !uid) return;

    const contextKey = `${orgId}:${requestedAssessmentLevel}`;
    if (firestoreLoadKey !== contextKey) return;

    if (scoreSnapshotBaselineRef.current?.contextKey !== contextKey) {
      scoreSnapshotBaselineRef.current = { contextKey, fingerprint: scoreSnapshotFingerprint };
      return;
    }

    if (scoreSnapshotBaselineRef.current.fingerprint === scoreSnapshotFingerprint) return;
    scoreSnapshotBaselineRef.current = { contextKey, fingerprint: scoreSnapshotFingerprint };

    scoreSnapshotTimeoutRef.current = window.setTimeout(() => {
      const snapshot = buildScoreSnapshot();
      if (!snapshot) return;

      void saveScoreSnapshot(orgId, snapshot.assessmentId, snapshot).catch(snapshotError => {
        console.error("[assessmentFirestore] score snapshot save failed; live score retained", {
          orgId,
          assessmentId: snapshot.assessmentId,
          snapshotId: snapshot.snapshotId,
          error: snapshotError,
        });
      });
    }, 1500);

    return () => {
      if (scoreSnapshotTimeoutRef.current !== null) {
        window.clearTimeout(scoreSnapshotTimeoutRef.current);
        scoreSnapshotTimeoutRef.current = null;
      }
    };
  }, [
    buildScoreSnapshot,
    error,
    firestoreEnabled,
    firestoreLoadKey,
    loading,
    orgId,
    requestedAssessmentLevel,
    scoreSnapshotFingerprint,
    uid,
  ]);

  /*
   * RECOVERY TEST
   *
   * 1 Login
   * 2 Change objective status
   * 3 Add note
   * 4 Add evidence metadata
   * 5 Add POAM
   * 6 Click Save
   * 7 Logout
   * 8 Clear localStorage
   * 9 Login again
   *
   * Expected:
   * Objective restored
   * Note restored
   * Evidence restored
   * POAM restored
   * Shell restored
   * Snapshots preserved
   */
  const saveAssessment = useCallback(async () => {
    savePersistedState({
      subscriptionLevel,
      companyProfile: companyProfile || undefined,
      practiceRecords,
      minedPractices,
      analyzerAnswers,
      savedReports,
      poamItems,
      responsibilityMatrix,
    });

    if (!firestoreEnabled) return;
    if (!orgId || !uid) throw new Error("Assessment save requires an active organization and user.");

    if (scoreSnapshotTimeoutRef.current !== null) {
      window.clearTimeout(scoreSnapshotTimeoutRef.current);
      scoreSnapshotTimeoutRef.current = null;
    }
    scoreSnapshotBaselineRef.current = {
      contextKey: `${orgId}:${requestedAssessmentLevel}`,
      fingerprint: scoreSnapshotFingerprint,
    };

    const assessmentId = getDefaultAssessmentId(requestedAssessmentLevel);
    const snapshot = buildScoreSnapshot();
    if (!snapshot) throw new Error("Could not prepare assessment score snapshot.");

    await Promise.all([
      saveAssessmentLastSavedAt(orgId, assessmentId, uid),
      saveScoreSnapshot(orgId, assessmentId, snapshot),
    ]);
    logActivity({
      action: "assessment.saved",
      targetType: "assessment",
      targetId: assessmentId,
      summary: "Assessment saved",
      metadata: {
        snapshotId: snapshot.snapshotId,
      },
    });
  }, [
    analyzerAnswers,
    buildScoreSnapshot,
    companyProfile,
    firestoreEnabled,
    logActivity,
    minedPractices,
    orgId,
    poamItems,
    practiceRecords,
    requestedAssessmentLevel,
    responsibilityMatrix,
    savedReports,
    scoreSnapshotFingerprint,
    subscriptionLevel,
    uid,
  ]);

  const getSavedTemplates = useCallback((): SavedTemplate[] => {
    try {
      const saved = localStorage.getItem(SAVED_TEMPLATES_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }, []);

  const storeTemplate = useCallback((template: SavedTemplate) => {
    const templates = getSavedTemplates();
    localStorage.setItem(SAVED_TEMPLATES_KEY, JSON.stringify([...templates, template]));
  }, [getSavedTemplates]);

  const deleteSavedTemplate = useCallback((id: string) => {
    const templates = getSavedTemplates();
    localStorage.setItem(SAVED_TEMPLATES_KEY, JSON.stringify(templates.filter(t => t.id !== id)));
  }, [getSavedTemplates]);

  const saveReport = useCallback((report: SavedReport) => {
    setSavedReports(prev => [...prev, report]);
  }, []);

  return {
    domains, 
    allPractices, 
    rawDomains,
    rawPractices,
    highRiskPractices, 
    practiceMap: new Map<string, Practice>(rawPractices.map(p => [p.id, p])),
    companyProfile, 
    practiceRecords, 
    practiceRecordMap: new Map<string, PracticeRecord>(practiceRecords.map(r => [r.id, r])),
    analyzerAnswers, 
    savedReports, 
    scores, 
    evidenceSummary,
    recoveryDiagnostics,
    poamItems, 
    activityLogEntries,
    responsibilityMatrix,
    subscriptionLevel, 
    upgradeSubscription,
    commitMinedRequirement, 
    updateCompanyProfile, 
    addUserToCompany, 
    updatePracticeNote, 
    updatePracticeAssignment,
    updateObjectiveRecord,
    archiveEvidence,
    updatePoamItem, 
    addPoamItem, 
    updateResponsibilityMatrixEntry, 
    applyAnalyzerSuggestion: () => {},
    runAnalyzer: async () => {}, 
    saveReport, 
    saveAssessment,
    setAnalyzerAnswers, 
    storeTemplate, 
    getSavedTemplates, 
    deleteSavedTemplate,
    loading, 
    error, 
    dataSourceInfo, 
    // Fix: Explicitly use a record map to resolve 'unknown' status property error.
    getDomainCompletion: (name: string) => {
      const domain = domains.find(d => d.name === canonicalizeDomainName(name));
      if (!domain) return 0;
      
      const activePractices = domain.practices;
      if (activePractices.length === 0) return 0;
      
      const recordLookup = new Map<string, PracticeRecord>(practiceRecords.map(r => [r.id, r]));

      const matchedRecords = activePractices
        .map(p => recordLookup.get(p.id))
        .filter((r): r is PracticeRecord => !!r);

      // Fix: Ensured 'r' is typed as PracticeRecord within the filter callbacks
      const metCount = matchedRecords.filter((r) => (r as PracticeRecord).status === 'met').length;
      const partialCount = matchedRecords.filter((r) => (r as PracticeRecord).status === 'partial').length;
      return Math.round(((metCount + 0.5 * partialCount) / activePractices.length) * 100);
    }
  };
};
