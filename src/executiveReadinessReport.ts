import { collection, doc, getDoc, getDocs, limit, orderBy, query } from "firebase/firestore";
import { db } from "./firebase";
import { getObjectiveRecordStorageKey, toFirestoreDocId } from "./assessmentFirestore";
import type {
  Domain,
  EvidenceSummary,
  OrgCompanyProfile,
  PoamItem,
  PracticeRecord,
  ScoreSnapshot,
} from "../types";

export type ExecutiveDomainSummary = {
  name: string;
  readinessPercent: number;
};

export type ExecutiveReadinessReportData = {
  generatedAt: Date;
  organization: {
    legalName: string;
    cageCode: string;
    uei: string;
    assessmentLevel: string;
  };
  readiness: {
    overallPercent: number;
    completedCount: number;
    inProgressCount: number;
    notStartedCount: number;
  };
  domains: ExecutiveDomainSummary[];
  topRiskAreas: ExecutiveDomainSummary[];
  poam: {
    openItems: number;
    highPriority: number;
    mediumPriority: number;
    lowPriority: number;
  };
  evidence: {
    libraryCount: number;
    practiceEvidenceCount: number;
    reusedEvidenceCount: number;
    archivedEvidenceCount: number;
  };
  narrative: string;
  recommendations: string[];
};

type BuildExecutiveReadinessReportParams = {
  orgId: string | null;
  assessmentId: string;
  assessmentLevel: string;
  domains: Domain[];
  practiceRecords: PracticeRecord[];
  poamItems: PoamItem[];
  evidenceSummary: EvidenceSummary;
  getDomainCompletion: (domainName: string) => number;
};

const getTrendText = (snapshots: ScoreSnapshot[]): string => {
  if (snapshots.length < 2) return "A readiness trend will become available after additional saved snapshots.";
  const current = Number(snapshots[0]?.completionPercent || 0);
  const previous = Number(snapshots[1]?.completionPercent || 0);
  const delta = current - previous;
  if (delta === 0) return "Readiness is unchanged from the previous saved snapshot.";
  return `Readiness has ${delta > 0 ? "improved" : "declined"} by ${Math.abs(delta)} percentage points since the previous saved snapshot.`;
};

const buildNarrative = (
  overallPercent: number,
  domains: ExecutiveDomainSummary[],
  openPoamCount: number,
  trendText: string
): string => {
  const strongest = [...domains].sort((a, b) => b.readinessPercent - a.readinessPercent).slice(0, 2);
  const weakest = [...domains].sort((a, b) => a.readinessPercent - b.readinessPercent).slice(0, 2);
  const names = (items: ExecutiveDomainSummary[]) => items.map(item => item.name).join(" and ") || "the assessed domains";

  return [
    `The organization is currently ${overallPercent}% ready for its CMMC assessment based on live assessment records.`,
    `${names(strongest)} ${strongest.length === 1 ? "is" : "are"} the strongest-performing domain${strongest.length === 1 ? "" : "s"}.`,
    `${names(weakest)} ${weakest.length === 1 ? "requires" : "require"} the most immediate management attention.`,
    `${openPoamCount} open POA&M item${openPoamCount === 1 ? "" : "s"} remain in the remediation plan.`,
    trendText,
  ].join(" ");
};

const buildRecommendations = (
  topRiskAreas: ExecutiveDomainSummary[],
  openPoamItems: PoamItem[],
  evidenceSummary: EvidenceSummary
): string[] => {
  const recommendations: string[] = [];
  const weakDomains = topRiskAreas.filter(domain => domain.readinessPercent < 100).slice(0, 3);

  if (weakDomains.length > 0) {
    recommendations.push(`Prioritize incomplete work in ${weakDomains.map(domain => domain.name).join(", ")}.`);
  }
  if (openPoamItems.some(item => item.priority === "high")) {
    recommendations.push("Resolve high-priority POA&M items and confirm accountable owners and target dates.");
  }
  if (evidenceSummary.objectivesWithoutEvidence.length > 0) {
    recommendations.push(`Upload or attach evidence for ${evidenceSummary.objectivesWithoutEvidence.length} objective${evidenceSummary.objectivesWithoutEvidence.length === 1 ? "" : "s"} that currently lack support.`);
  }
  if (openPoamItems.length > 0) {
    recommendations.push("Review open POA&M items during the next management readiness meeting.");
  }
  recommendations.push("Conduct a management review of readiness, evidence coverage, and remediation priorities before the next assessment milestone.");
  return recommendations;
};

async function loadSupplementaryReportData(
  orgId: string,
  assessmentId: string,
  domains: Domain[]
): Promise<{
  companyProfile?: OrgCompanyProfile;
  libraryCount: number;
  reusedEvidenceCount: number;
  archivedLibraryCount: number;
  snapshots: ScoreSnapshot[];
}> {
  const orgRef = doc(db, "orgs", orgId);
  const assessmentRef = doc(orgRef, "assessments", assessmentId);
  const refCollections = domains.flatMap(domain => domain.practices.flatMap(practice => [
    collection(assessmentRef, "practiceRecords", toFirestoreDocId(practice.id), "evidenceRefs"),
    ...practice.assessment_objectives.map(objective =>
      collection(
        assessmentRef,
        "objectiveRecords",
        toFirestoreDocId(getObjectiveRecordStorageKey(practice.id, objective.id)),
        "evidenceRefs"
      )
    ),
  ]));

  const [orgSnapshot, librarySnapshot, snapshotHistory, ...evidenceRefSnapshots] = await Promise.all([
    getDoc(orgRef),
    getDocs(collection(orgRef, "evidenceLibrary")),
    getDocs(query(collection(assessmentRef, "scoreSnapshots"), orderBy("createdAt", "desc"), limit(2))),
    ...refCollections.map(refCollection => getDocs(refCollection)),
  ]);

  const libraryItems = librarySnapshot.docs.map(item => item.data() as { status?: string });
  return {
    companyProfile: orgSnapshot.data()?.companyProfile as OrgCompanyProfile | undefined,
    libraryCount: libraryItems.length,
    archivedLibraryCount: libraryItems.filter(item => item.status === "archived").length,
    reusedEvidenceCount: evidenceRefSnapshots.reduce(
      (total, snapshot) => total + snapshot.docs.filter(item => item.data()?.status === "active").length,
      0
    ),
    snapshots: snapshotHistory.docs.map(item => item.data() as ScoreSnapshot),
  };
}

export async function buildExecutiveReadinessReport({
  orgId,
  assessmentId,
  assessmentLevel,
  domains,
  practiceRecords,
  poamItems,
  evidenceSummary,
  getDomainCompletion,
}: BuildExecutiveReadinessReportParams): Promise<ExecutiveReadinessReportData> {
  const recordsById = new Map(practiceRecords.map(record => [record.id, record]));
  const allPractices = domains.flatMap(domain => domain.practices);
  const completedCount = allPractices.filter(practice => recordsById.get(practice.id)?.status === "met").length;
  const inProgressCount = allPractices.filter(practice => recordsById.get(practice.id)?.status === "partial").length;
  const notStartedCount = allPractices.length - completedCount - inProgressCount;
  const overallPercent = allPractices.length === 0
    ? 0
    : Math.round(((completedCount + 0.5 * inProgressCount) / allPractices.length) * 100);
  const domainSummaries = domains
    .map(domain => ({ name: domain.name, readinessPercent: getDomainCompletion(domain.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const topRiskAreas = [...domainSummaries]
    .sort((a, b) => a.readinessPercent - b.readinessPercent || a.name.localeCompare(b.name))
    .slice(0, 5);
  const openPoamItems = poamItems.filter(item => item.status !== "completed");
  const supplementary = orgId
    ? await loadSupplementaryReportData(orgId, assessmentId, domains)
    : { libraryCount: 0, reusedEvidenceCount: 0, archivedLibraryCount: 0, snapshots: [] };
  const archivedPracticeEvidenceCount = Object.values(evidenceSummary.evidenceByPracticeId)
    .flat()
    .filter((artifact, index, artifacts) => artifact.archived && artifacts.findIndex(item => item.id === artifact.id) === index)
    .length;
  const trendText = getTrendText(supplementary.snapshots);

  return {
    generatedAt: new Date(),
    organization: {
      legalName: supplementary.companyProfile?.legalName || "Organization name not provided",
      cageCode: supplementary.companyProfile?.cageCode || "Not provided",
      uei: supplementary.companyProfile?.uei || "Not provided",
      assessmentLevel: supplementary.companyProfile?.cmmc?.assessmentLevel || assessmentLevel,
    },
    readiness: {
      overallPercent,
      completedCount,
      inProgressCount,
      notStartedCount,
    },
    domains: domainSummaries,
    topRiskAreas,
    poam: {
      openItems: openPoamItems.length,
      highPriority: openPoamItems.filter(item => item.priority === "high").length,
      mediumPriority: openPoamItems.filter(item => item.priority === "medium").length,
      lowPriority: openPoamItems.filter(item => item.priority === "low").length,
    },
    evidence: {
      libraryCount: supplementary.libraryCount,
      practiceEvidenceCount: evidenceSummary.totalEvidenceCount,
      reusedEvidenceCount: supplementary.reusedEvidenceCount,
      archivedEvidenceCount: supplementary.archivedLibraryCount + archivedPracticeEvidenceCount,
    },
    narrative: buildNarrative(overallPercent, domainSummaries, openPoamItems.length, trendText),
    recommendations: buildRecommendations(topRiskAreas, openPoamItems, evidenceSummary),
  };
}
