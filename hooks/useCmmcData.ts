
import { useState, useEffect, useCallback, useMemo } from "react";
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
  SubscriptionLevel
} from "../types";

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

export const useCmmcData = () => {
  const [rawDomains, setRawDomains] = useState<Domain[]>([]);
  const [rawPractices, setRawPractices] = useState<Practice[]>([]);
  const [minedPractices, setMinedPractices] = useState<Practice[]>([]);
  const [highRiskPractices, setHighRiskPractices] = useState<string[]>([]);
  const [practiceRecords, setPracticeRecords] = useState<PracticeRecord[]>([]);
  const [analyzerAnswers, setAnalyzerAnswers] = useState<ReadinessAnswers>(initialAnswers);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [poamItems, setPoamItems] = useState<PoamItem[]>([]);
  const [responsibilityMatrix, setResponsibilityMatrix] = useState<ResponsibilityMatrixEntry[]>([]);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [subscriptionLevel, setSubscriptionLevel] = useState<SubscriptionLevel>("L1");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataSourceInfo, setDataSourceInfo] = useState<string>("Initializing...");

  useEffect(() => {
    const initializeData = async () => {
      setLoading(true);
      setError(null);
      try {
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
  const updatePracticeNote = (id: string, note: string) => setPracticeRecords(prev => prev.map(p => p.id === id ? { ...p, note, lastUpdated: new Date().toISOString() } : p));
  
  const updateObjectiveRecord = useCallback((practiceId: string, objectiveId: string, updates: Partial<ObjectiveRecord>) => {
    setPracticeRecords(prevRecords => prevRecords.map(p => {
      if (p.id !== practiceId) return p;
      const newObjectiveRecords = {
        ...p.objectiveRecords,
        [objectiveId]: { ...(p.objectiveRecords[objectiveId] || { status: ObjectiveStatus.Pending, note: '', artifacts: [] }), ...updates }
      };
      
      const objectives = Object.values(newObjectiveRecords) as ObjectiveRecord[];
      const hasNotMet = objectives.some(o => o.status === ObjectiveStatus.NotMet);
      const allMetOrNA = objectives.every(o => o.status === ObjectiveStatus.Met || o.status === ObjectiveStatus.NotApplicable);
      const anyProgress = objectives.some(o => o.status !== ObjectiveStatus.Pending);

      let newStatus: PracticeStatus = 'not_assessed';
      if (hasNotMet) newStatus = 'not_met';
      else if (allMetOrNA && objectives.length > 0) newStatus = 'met';
      else if (anyProgress) newStatus = 'partial';

      return { ...p, objectiveRecords: newObjectiveRecords, status: newStatus, statusSource: 'auto' as StatusSource, lastUpdated: new Date().toISOString() };
    }));
  }, []);

  const updatePoamItem = (item: PoamItem) => setPoamItems(prev => prev.map(p => p.id === item.id ? item : p));
  const addPoamItem = (item: Omit<PoamItem, 'id' | 'createdAt' | 'source'>) => {
    setPoamItems(prev => [...prev, { ...item, id: crypto.randomUUID(), createdAt: new Date().toISOString(), source: 'manual' as const }]);
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
    poamItems, 
    responsibilityMatrix,
    subscriptionLevel, 
    upgradeSubscription,
    commitMinedRequirement, 
    updateCompanyProfile, 
    addUserToCompany, 
    updatePracticeNote, 
    updateObjectiveRecord,
    updatePoamItem, 
    addPoamItem, 
    updateResponsibilityMatrixEntry, 
    applyAnalyzerSuggestion: () => {},
    runAnalyzer: async () => {}, 
    saveReport, 
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
