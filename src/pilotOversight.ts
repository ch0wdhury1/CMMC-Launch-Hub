import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "./firebase";
import { loadActivityEvents, type ActivityEvent } from "./activityLog";
import { loadPilotFeedback } from "./pilotFeedback";

export type PilotOrgSummary = {
  id: string;
  companyName: string;
  town: string;
  state: string;
  startingDate: any;
  tier: string;
  status: string;
  completionPercent: number;
  sprsScore: number;
  usersCount: number;
  evidenceCount: number;
  openPoamCount: number;
  practicesCompleted: number;
  practicesRemaining: number;
  sspGenerated: boolean;
  poamGenerated: boolean;
  policyGenerated: boolean;
  reportsGenerated: number;
  lastActivity: any;
};

export type PilotOversightData = {
  summary: {
    activeOrganizations: number;
    totalPilotUsers: number;
    averageCompletionPercent: number;
    averageSprsScore: number;
    evidenceUploaded: number;
    openPoamItems: number;
    reportsGenerated: number;
    feedbackItems: number;
  };
  organizations: PilotOrgSummary[];
  recentActivity: ActivityEvent[];
  progressHistory: Array<{ label: string; averageCompletionPercent: number }>;
  hasHistoricalSnapshots: boolean;
};

const toTime = (value: any) => {
  const date = value?.toDate ? value.toDate() : value?._seconds ? new Date(value._seconds * 1000) : new Date(value || 0);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

export const formatPilotDate = (value: any) => {
  if (!value) return "Not provided";
  const date = value?.toDate ? value.toDate() : value?._seconds ? new Date(value._seconds * 1000) : new Date(value);
  return Number.isNaN(date.getTime()) ? "Not provided" : date.toLocaleDateString();
};

const orgName = (org: any, id: string) => String(
  org?.companyProfile?.legalName
  || org?.companyProfile?.companyName
  || org?.legalName
  || org?.name
  || org?.displayName
  || id
);

const town = (org: any) => String(
  org?.companyProfile?.address?.city
  || org?.companyProfile?.headquarters?.city
  || org?.address?.city
  || ""
);

const state = (org: any) => String(
  org?.companyProfile?.address?.state
  || org?.companyProfile?.headquarters?.state
  || org?.address?.state
  || ""
);

const numberValue = (...values: any[]) => {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const statusValue = (value: any) => String(value || "").trim().toLowerCase();

async function countCollection(path: string[]) {
  try {
    const snapshot = await getDocs(collection(db, path[0], ...path.slice(1)));
    return snapshot.size;
  } catch {
    return 0;
  }
}

async function loadAssessmentSummary(orgId: string, assessmentId: "default_l1" | "default_l2") {
  try {
    const [practiceRecords, poamItems, scoreSnapshots] = await Promise.all([
      getDocs(collection(db, "orgs", orgId, "assessments", assessmentId, "practiceRecords")),
      getDocs(collection(db, "orgs", orgId, "assessments", assessmentId, "poamItems")),
      getDocs(collection(db, "orgs", orgId, "assessments", assessmentId, "scoreSnapshots")),
    ]);
    const practices = practiceRecords.docs.map(item => item.data() as any);
    const completed = practices.filter(item => ["met", "partial", "not_met"].includes(String(item.status || ""))).length;
    const remaining = Math.max(0, practices.length - completed);
    const completion = practices.length === 0 ? 0 : Math.round((completed / practices.length) * 100);
    const openPoam = poamItems.docs.filter(item => String((item.data() as any)?.status || "").toLowerCase() !== "completed").length;
    const latestScore = scoreSnapshots.docs
      .map(item => item.data() as any)
      .sort((a, b) => toTime(b.createdAt || b.updatedAt) - toTime(a.createdAt || a.updatedAt))[0];
    return {
      practicesCompleted: completed,
      practicesRemaining: remaining,
      completionPercent: numberValue(latestScore?.completionPercent, latestScore?.practiceCompletionScore, completion),
      sprsScore: numberValue(latestScore?.sprsScore),
      openPoamCount: openPoam,
    };
  } catch {
    return { practicesCompleted: 0, practicesRemaining: 0, completionPercent: 0, sprsScore: -250, openPoamCount: 0 };
  }
}

export async function loadPilotOversightData(): Promise<PilotOversightData> {
  const [orgSnapshot, activityEvents, feedbackItems, accessRequests] = await Promise.all([
    getDocs(collection(db, "orgs")),
    loadActivityEvents({ isSuperAdmin: true }),
    loadPilotFeedback().catch(() => []),
    getDocs(query(collection(db, "accessRequests"), where("status", "==", "pending"))).catch(() => null),
  ]);
  const orgs = orgSnapshot.docs.map(item => ({ id: item.id, ...(item.data() as any) }));
  const reportEvents = activityEvents.filter(event => event.action === "report.generated");
  const evidenceEvents = activityEvents.filter(event => event.action === "evidence.uploaded");
  const reportsByOrg = new Map<string, ActivityEvent[]>();
  const activityByOrg = new Map<string, ActivityEvent[]>();
  reportEvents.forEach(event => reportsByOrg.set(event.orgId, [...(reportsByOrg.get(event.orgId) || []), event]));
  activityEvents.forEach(event => activityByOrg.set(event.orgId, [...(activityByOrg.get(event.orgId) || []), event]));

  const organizations = await Promise.all(orgs.map(async org => {
    const assessmentId = String(org.tier || "").toUpperCase() === "COMM_L2" ? "default_l2" : "default_l1";
    const assessment = await loadAssessmentSummary(org.id, assessmentId);
    const usersCount = numberValue(org.activeMemberCount, org.memberCount, await countCollection(["orgs", org.id, "members"]));
    const orgReports = reportsByOrg.get(org.id) || [];
    const orgActivity = activityByOrg.get(org.id) || [];
    const evidenceCount = numberValue(org.evidenceCount, evidenceEvents.filter(event => event.orgId === org.id).length);
    return {
      id: org.id,
      companyName: orgName(org, org.id),
      town: town(org),
      state: state(org),
      startingDate: org.subscriptionStartDate || org.createdAt || org.approvedAt,
      tier: String(org.tier || org.subscriptionTier || "Not provided"),
      status: String(org.status || "active"),
      completionPercent: assessment.completionPercent,
      sprsScore: assessment.sprsScore,
      usersCount,
      evidenceCount,
      openPoamCount: assessment.openPoamCount,
      practicesCompleted: assessment.practicesCompleted,
      practicesRemaining: assessment.practicesRemaining,
      sspGenerated: orgReports.some(event => /ssp|system security plan/i.test(event.targetLabel || event.summary || "")),
      poamGenerated: orgReports.some(event => /poa&m|poam/i.test(event.targetLabel || event.summary || "")),
      policyGenerated: orgReports.some(event => /policy/i.test(event.targetLabel || event.summary || "")),
      reportsGenerated: orgReports.length,
      lastActivity: orgActivity[0]?.createdAt,
    };
  }));

  const activeOrganizations = organizations.filter(org => statusValue(org.status) === "active");
  const averageCompletionPercent = activeOrganizations.length === 0 ? 0 : Math.round(activeOrganizations.reduce((sum, org) => sum + org.completionPercent, 0) / activeOrganizations.length);
  const averageSprsScore = activeOrganizations.length === 0 ? -250 : Math.round(activeOrganizations.reduce((sum, org) => sum + org.sprsScore, 0) / activeOrganizations.length);
  const pendingRegistrations = accessRequests?.docs.filter(item => (item.data() as any)?.type === "orgRegistration").length || 0;

  return {
    summary: {
      activeOrganizations: activeOrganizations.length,
      totalPilotUsers: organizations.reduce((sum, org) => sum + org.usersCount, 0),
      averageCompletionPercent,
      averageSprsScore,
      evidenceUploaded: organizations.reduce((sum, org) => sum + org.evidenceCount, 0),
      openPoamItems: organizations.reduce((sum, org) => sum + org.openPoamCount, 0),
      reportsGenerated: reportEvents.length,
      feedbackItems: feedbackItems.length + pendingRegistrations * 0,
    },
    organizations: organizations.sort((a, b) => a.companyName.localeCompare(b.companyName)),
    recentActivity: activityEvents.slice(0, 20),
    progressHistory: [{ label: "Current", averageCompletionPercent }],
    hasHistoricalSnapshots: false,
  };
}
