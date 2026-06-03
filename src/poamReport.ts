import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import type { FirestorePoamItem, OrgCompanyProfile, PoamItem, PoamPriority, PoamStatus } from "../types";

export type PoamReportItem = {
  id: string;
  practiceIds: string[];
  objectiveIds: string[];
  weakness: string;
  remediationPlan: string;
  owner: string;
  priority?: PoamPriority;
  status: PoamStatus;
  dueDate?: string;
  completedDate?: string;
  lastUpdated?: any;
};

export type PoamOwnerSummary = {
  owner: string;
  openCount: number;
  inProgressCount: number;
  closedCount: number;
  overdueCount: number;
};

export type PoamReportData = {
  generatedAt: Date;
  organization: {
    legalName: string;
    cageCode: string;
    uei: string;
    assessmentLevel: string;
  };
  summary: {
    totalItems: number;
    openItems: number;
    inProgressItems: number;
    closedItems: number;
    highPriorityItems: number;
    mediumPriorityItems: number;
    lowPriorityItems: number;
    overdueItems: number;
  };
  openByPriority: {
    high: PoamReportItem[];
    medium: PoamReportItem[];
    low: PoamReportItem[];
    unknown: PoamReportItem[];
  };
  schedule: {
    overdue: PoamReportItem[];
    dueWithin30Days: PoamReportItem[];
    noDueDate: PoamReportItem[];
  };
  owners: PoamOwnerSummary[];
  details: PoamReportItem[];
  closedItems: PoamReportItem[];
  recommendations: string[];
};

type BuildPoamReportParams = {
  orgId: string | null;
  assessmentId: string;
  assessmentLevel: string;
  poamItems: PoamItem[];
};

const toDate = (value: any): Date | null => {
  if (!value) return null;
  const date = value?.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatPoamReportDate = (value: any): string => {
  const date = toDate(value);
  return date ? date.toLocaleDateString() : "Not provided";
};

const isActive = (item: PoamReportItem) => item.status === "open" || item.status === "in_progress";

const isOverdue = (item: PoamReportItem, now: Date) => {
  const dueDate = toDate(item.dueDate);
  return isActive(item) && Boolean(dueDate && dueDate.getTime() < now.getTime());
};

const toReportItem = (local: PoamItem, firestore?: FirestorePoamItem): PoamReportItem => ({
  id: local.id,
  practiceIds: firestore?.relatedPracticeIds || local.relatedPracticeIds || [],
  objectiveIds: firestore?.relatedObjectiveIds || [],
  weakness: firestore?.riskStatement || local.description || local.title,
  remediationPlan: firestore?.remediationPlan || local.notes || local.description || "Not provided",
  owner: firestore?.ownerName || local.owner || "Unassigned",
  priority: firestore?.priority || local.priority,
  status: firestore?.status || local.status,
  dueDate: firestore?.targetDate || local.targetDate,
  completedDate: firestore?.completedDate || local.completedDate,
  lastUpdated: firestore?.updatedAt || firestore?.createdAt || local.createdAt,
});

const buildRecommendations = (details: PoamReportItem[], now: Date): string[] => {
  const active = details.filter(isActive);
  const recommendations: string[] = [];
  const overdueHighPriority = active.filter(item => item.priority === "high" && isOverdue(item, now));
  const unassigned = active.filter(item => item.owner === "Unassigned");
  const withoutDueDate = active.filter(item => !toDate(item.dueDate));
  const openByPractice = new Map<string, number>();

  active.forEach(item => item.practiceIds.forEach(practiceId =>
    openByPractice.set(practiceId, (openByPractice.get(practiceId) || 0) + 1)
  ));
  const repeatedPractices = [...openByPractice.entries()].filter(([, count]) => count > 1);

  if (overdueHighPriority.length > 0) recommendations.push("Address overdue high-priority items first.");
  if (unassigned.length > 0) recommendations.push(`Assign owners to ${unassigned.length} unassigned POA&M item${unassigned.length === 1 ? "" : "s"}.`);
  if (withoutDueDate.length > 0) recommendations.push(`Add due dates to ${withoutDueDate.length} item${withoutDueDate.length === 1 ? "" : "s"} without target completion dates.`);
  if (active.some(item => item.priority === "high")) recommendations.push("Close high-risk weaknesses before the next management review.");
  if (repeatedPractices.length > 0) recommendations.push(`Review practices with multiple open POA&M items: ${repeatedPractices.map(([practiceId]) => practiceId).join(", ")}.`);
  if (recommendations.length === 0) recommendations.push("Continue management review of remediation progress and confirm completed items are ready for closure.");
  return recommendations;
};

const resolveOrganizationName = (orgData: any, orgId: string): string =>
  String(
    orgData?.companyProfile?.legalName
    || orgData?.companyProfile?.companyName
    || orgData?.legalName
    || orgData?.name
    || orgData?.displayName
    || orgId
  ).trim();

async function loadReportSourceData(orgId: string, assessmentId: string) {
  const orgRef = doc(db, "orgs", orgId);
  const [orgSnapshot, poamSnapshot] = await Promise.all([
    getDoc(orgRef),
    getDocs(collection(orgRef, "assessments", assessmentId, "poamItems")),
  ]);
  const orgData = orgSnapshot.data();
  return {
    companyProfile: orgData?.companyProfile as OrgCompanyProfile | undefined,
    orgName: resolveOrganizationName(orgData, orgId),
    poamItems: poamSnapshot.docs.map(item => ({
      poamId: item.id,
      id: item.data()?.id || item.data()?.poamId || item.id,
      ...(item.data() as Omit<FirestorePoamItem, "poamId">),
    })),
  };
}

export async function buildPoamReport({
  orgId,
  assessmentId,
  assessmentLevel,
  poamItems,
}: BuildPoamReportParams): Promise<PoamReportData> {
  let companyProfile: OrgCompanyProfile | undefined;
  let orgName: string | undefined;
  let firestoreItems: FirestorePoamItem[] = [];
  if (orgId) {
    try {
      const source = await loadReportSourceData(orgId, assessmentId);
      companyProfile = source.companyProfile;
      orgName = source.orgName;
      firestoreItems = source.poamItems;
    } catch (error) {
      console.warn("[poam-report] Firestore enrichment unavailable; using loaded assessment state", error);
    }
  }

  const firestoreById = new Map(firestoreItems.map(item => [item.id || item.poamId, item]));
  const details = poamItems.map(item => toReportItem(item, firestoreById.get(item.id)));
  const now = new Date();
  const thirtyDaysFromNow = new Date(now);
  thirtyDaysFromNow.setDate(now.getDate() + 30);
  const activeItems = details.filter(isActive);
  const overdue = activeItems.filter(item => isOverdue(item, now));
  const dueWithin30Days = activeItems.filter(item => {
    const dueDate = toDate(item.dueDate);
    return Boolean(dueDate && dueDate.getTime() >= now.getTime() && dueDate.getTime() <= thirtyDaysFromNow.getTime());
  });
  const noDueDate = activeItems.filter(item => !toDate(item.dueDate));
  const ownerMap = new Map<string, PoamOwnerSummary>();

  details.forEach(item => {
    const summary = ownerMap.get(item.owner) || { owner: item.owner, openCount: 0, inProgressCount: 0, closedCount: 0, overdueCount: 0 };
    if (item.status === "open") summary.openCount += 1;
    if (item.status === "in_progress") summary.inProgressCount += 1;
    if (item.status === "completed") summary.closedCount += 1;
    if (isOverdue(item, now)) summary.overdueCount += 1;
    ownerMap.set(item.owner, summary);
  });

  return {
    generatedAt: now,
    organization: {
      legalName: companyProfile?.legalName || orgName || "Organization name not provided",
      cageCode: companyProfile?.cageCode || "Not provided",
      uei: companyProfile?.uei || "Not provided",
      assessmentLevel: companyProfile?.cmmc?.assessmentLevel || assessmentLevel,
    },
    summary: {
      totalItems: details.length,
      openItems: details.filter(item => item.status === "open").length,
      inProgressItems: details.filter(item => item.status === "in_progress").length,
      closedItems: details.filter(item => item.status === "completed").length,
      highPriorityItems: details.filter(item => item.priority === "high").length,
      mediumPriorityItems: details.filter(item => item.priority === "medium").length,
      lowPriorityItems: details.filter(item => item.priority === "low").length,
      overdueItems: overdue.length,
    },
    openByPriority: {
      high: activeItems.filter(item => item.priority === "high"),
      medium: activeItems.filter(item => item.priority === "medium"),
      low: activeItems.filter(item => item.priority === "low"),
      unknown: activeItems.filter(item => !item.priority),
    },
    schedule: { overdue, dueWithin30Days, noDueDate },
    owners: [...ownerMap.values()].sort((a, b) => a.owner.localeCompare(b.owner)),
    details,
    closedItems: details
      .filter(item => item.status === "completed")
      .sort((a, b) => (toDate(b.completedDate || b.lastUpdated)?.getTime() || 0) - (toDate(a.completedDate || a.lastUpdated)?.getTime() || 0))
      .slice(0, 10),
    recommendations: buildRecommendations(details, now),
  };
}
