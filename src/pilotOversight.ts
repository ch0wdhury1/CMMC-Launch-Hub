import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "./firebase";
import { loadActivityEvents, type ActivityEvent } from "./activityLog";
import { loadPilotFeedback } from "./pilotFeedback";

export type DomainReadinessSummary = {
  domain: string;
  completed: number;
  remaining: number;
  total: number;
  readinessPercent: number;
  status: "Complete" | "In Progress" | "Not Started";
};

export type PilotOrgSummary = {
  id: string;
  companyName: string;
  name?: string;
  companyProfile?: any;
  programId?: string;
  programName?: string;
  programCode?: string;
  town: string;
  state: string;
  startingDate: any;
  tier: string;
  status: string;
  pilotParticipant?: boolean;
  orgType?: string;
  isInternal?: boolean;
  internal?: boolean;
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
  primaryContactEmail?: string;
  primaryUserId?: string;
  overallReadinessPercent: number;
  domainReadiness: DomainReadinessSummary[];
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
  org?.name
  || org?.companyProfile?.companyName
  || org?.companyProfile?.legalName
  || org?.legalName
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
const apiBase = () => String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

export function getObserverProgramScope(profile: any) {
  const roles = profile?.roles || {};
  const programIds = Array.isArray(profile?.programIds) ? profile.programIds.map(String).filter(Boolean) : [];
  const programCodes = Array.isArray(profile?.programCodes) ? profile.programCodes.map(String).filter(Boolean) : [];
  return {
    isProgramScoped: roles.programObserver === true && programIds.length > 0,
    programIds,
    programCodes,
    isLegacyPilotObserver: roles.pilotObserver === true,
  };
}

const emptyPilotOversightData = (): PilotOversightData => ({
  summary: {
    activeOrganizations: 0,
    totalPilotUsers: 0,
    averageCompletionPercent: 0,
    averageSprsScore: -250,
    evidenceUploaded: 0,
    openPoamItems: 0,
    reportsGenerated: 0,
    feedbackItems: 0,
  },
  organizations: [],
  recentActivity: [],
  progressHistory: [{ label: "Current", averageCompletionPercent: 0 }],
  hasHistoricalSnapshots: false,
});

async function loadCurrentUserProfile() {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;
  const snapshot = await getDoc(doc(db, "users", uid));
  return snapshot.exists() ? ({ uid, ...(snapshot.data() as any) }) : null;
}

async function loadScopedPilotOversightData(): Promise<PilotOversightData> {
  const base = apiBase();
  if (!base) throw new Error("Missing VITE_API_BASE_URL for program-scoped observer dashboard.");
  const user = auth.currentUser;
  if (!user) throw new Error("Authentication required.");
  const response = await fetch(`${base}/api/pilot/oversight`, {
    headers: { Authorization: `Bearer ${await user.getIdToken()}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    throw new Error(payload.errorMessage || "Program-scoped oversight data is unavailable.");
  }
  return payload.data as PilotOversightData;
}

const isLocalhost = () => typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname);

const loadCurrentRoleFlags = async () => {
  const uid = auth.currentUser?.uid;
  if (!uid) return {};
  try {
    const snapshot = await getDoc(doc(db, "users", uid));
    const data = snapshot.data() as any;
    return data?.roles && typeof data.roles === "object" ? data.roles : {};
  } catch (error) {
    console.debug("[pilot-oversight] role diagnostic unavailable", error);
    return {};
  }
};

const logPilotDiagnostics = async (input: {
  orgsLoaded: number;
  activeOrgs: number;
  participantOrgs: number;
}) => {
  if (!isLocalhost()) return;
  console.debug("[pilot-oversight] participant load diagnostics", {
    orgsLoadedBeforeFilter: input.orgsLoaded,
    orgsAfterActiveFilter: input.activeOrgs,
    orgsAfterInternalExclusion: input.participantOrgs,
    currentUserRoleFlags: await loadCurrentRoleFlags(),
  });
};

const logPilotReadIssue = (source: string, error: unknown) => {
  if (!isLocalhost()) return;
  const detail = error as any;
  console.warn("[pilot-oversight] Firestore read diagnostic", {
    source,
    code: detail?.code || "",
    message: detail?.message || String(error),
  });
};

export function isPilotParticipantOrg(org: any) {
  const id = String(org.id || "").toLowerCase();
  const name = String(org.companyName || orgName(org, String(org.id || ""))).toLowerCase();
  const orgType = String(org.orgType || org.type || "").toLowerCase();
  const status = statusValue(org.status || "active");
  if (status !== "active") return false;
  if (org.isInternal === true || org.internal === true) return false;
  if (["internal", "superadmin"].includes(orgType)) return false;
  if (id.includes("cyber_blue_star") || id.includes("superadmin") || id.includes("internal")) return false;
  if (name.includes("cyber blue star") || name.includes("superadmin") || name.includes("internal")) return false;
  if (org.pilotParticipant === true) return true;

  // TODO: replace this fallback with explicit org fields:
  // pilotParticipant: true, orgType: "pilot", isInternal: false.
  return true;
}

async function countCollection(path: string[]) {
  try {
    const snapshot = await getDocs(collection(db, path[0], ...path.slice(1)));
    return snapshot.size;
  } catch {
    return 0;
  }
}

type FrameworkDomain = {
  id: string;
  name: string;
  practiceIds: string[];
};

const frameworkCache = new Map<string, Promise<FrameworkDomain[]>>();

async function loadFrameworkDomains(level: "default_l1" | "default_l2"): Promise<FrameworkDomain[]> {
  const cacheKey = level;
  if (!frameworkCache.has(cacheKey)) {
    frameworkCache.set(cacheKey, (async () => {
      const url = level === "default_l2" ? "/cmmc_l2_prepop.json" : "/cmmc_l1_prepop.json";
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Unable to load ${url}`);
      const data = await response.json();
      return (data?.domains || []).map((domain: any) => ({
        id: String(domain.domain_id || domain.id || domain.name || ""),
        name: String(domain.domain_name || domain.name || domain.domain_id || "Unknown Domain"),
        practiceIds: (domain.practices || [])
          .map((practice: any) => String(practice.id || practice.requirementId || practice.practiceId || ""))
          .filter(Boolean),
      })).filter((domain: FrameworkDomain) => domain.id && domain.practiceIds.length > 0);
    })());
  }
  return frameworkCache.get(cacheKey)!;
}

const practiceStatus = (record: any) => String(record?.status || record?.state || "not_assessed").toLowerCase();

const isCompletedPractice = (record: any) => ["met", "partial", "not_met"].includes(practiceStatus(record));

async function loadAssessmentSummary(orgId: string, assessmentId: "default_l1" | "default_l2") {
  try {
    const [practiceRecords, poamItems, scoreSnapshots, frameworkDomains] = await Promise.all([
      getDocs(collection(db, "orgs", orgId, "assessments", assessmentId, "practiceRecords")),
      getDocs(collection(db, "orgs", orgId, "assessments", assessmentId, "poamItems")),
      getDocs(collection(db, "orgs", orgId, "assessments", assessmentId, "scoreSnapshots")),
      loadFrameworkDomains(assessmentId).catch(() => []),
    ]);
    const practices = practiceRecords.docs.map(item => ({ practiceId: decodeURIComponent(item.id), ...(item.data() as any) }));
    const practiceMap = new Map(practices.map(item => [String(item.practiceId || item.id || ""), item]));
    const totalPracticeCount = frameworkDomains.reduce((sum, domain) => sum + domain.practiceIds.length, 0) || practices.length;
    const completed = frameworkDomains.length > 0
      ? frameworkDomains.reduce((sum, domain) => sum + domain.practiceIds.filter(practiceId => isCompletedPractice(practiceMap.get(practiceId))).length, 0)
      : practices.filter(isCompletedPractice).length;
    const remaining = Math.max(0, totalPracticeCount - completed);
    const completion = totalPracticeCount === 0 ? 0 : Math.round((completed / totalPracticeCount) * 100);
    const domainReadiness = frameworkDomains.map(domain => {
      const domainCompleted = domain.practiceIds.filter(practiceId => isCompletedPractice(practiceMap.get(practiceId))).length;
      const domainRemaining = Math.max(0, domain.practiceIds.length - domainCompleted);
      const readinessPercent = domain.practiceIds.length === 0 ? 0 : Math.round((domainCompleted / domain.practiceIds.length) * 100);
      return {
        domain: domain.name,
        completed: domainCompleted,
        remaining: domainRemaining,
        total: domain.practiceIds.length,
        readinessPercent,
        status: readinessPercent >= 100 ? "Complete" as const : domainCompleted > 0 ? "In Progress" as const : "Not Started" as const,
      };
    });
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
      domainReadiness,
    };
  } catch {
    return { practicesCompleted: 0, practicesRemaining: 0, completionPercent: 0, sprsScore: -250, openPoamCount: 0, domainReadiness: [] };
  }
}

export function pilotParticipantOrganizations(data: PilotOversightData) {
  return data.organizations.filter(org => statusValue(org.status) === "active");
}

export async function loadPilotOversightData(): Promise<PilotOversightData> {
  const currentProfile = await loadCurrentUserProfile().catch(() => null);
  const scope = getObserverProgramScope(currentProfile);
  if (scope.isProgramScoped) return loadScopedPilotOversightData();
  if (currentProfile?.roles?.programObserver === true && !scope.isLegacyPilotObserver) return emptyPilotOversightData();

  const [orgSnapshot, activityEvents, feedbackItems, accessRequests] = await Promise.all([
    getDocs(collection(db, "orgs")).catch(error => {
      logPilotReadIssue("orgs", error);
      throw error;
    }),
    loadActivityEvents({ isSuperAdmin: true }).catch(error => {
      logPilotReadIssue("activityEvents", error);
      return [];
    }),
    loadPilotFeedback().catch(error => {
      logPilotReadIssue("pilotFeedback", error);
      return [];
    }),
    getDocs(query(collection(db, "accessRequests"), where("status", "==", "pending"))).catch(error => {
      logPilotReadIssue("accessRequests", error);
      return null;
    }),
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
    const evidenceCount = numberValue(org.evidenceCount, org.readiness?.evidenceCount, evidenceEvents.filter(event => event.orgId === org.id).length);
    const participantName = orgName(org, org.id);
    return {
      id: org.id,
      companyName: participantName,
      name: org.name,
      companyProfile: org.companyProfile,
      programId: String(org.programId || ""),
      programName: String(org.programName || ""),
      programCode: String(org.programCode || ""),
      town: town(org),
      state: state(org),
      startingDate: org.subscriptionStartDate || org.createdAt || org.approvedAt,
      tier: String(org.tier || org.subscriptionTier || "Not provided"),
      status: String(org.status || "active"),
      pilotParticipant: org.pilotParticipant === true,
      orgType: String(org.orgType || org.type || ""),
      isInternal: org.isInternal === true,
      internal: org.internal === true,
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
      primaryContactEmail: String(org.companyProfile?.primaryContactEmail || org.primaryContactEmail || org.ownerEmail || ""),
      primaryUserId: String(org.ownerUid || org.primaryUserId || ""),
      overallReadinessPercent: assessment.completionPercent,
      domainReadiness: assessment.domainReadiness,
    };
  }));

  const activeStatusOrganizations = organizations.filter(org => statusValue(org.status) === "active");
  const activeOrganizations = activeStatusOrganizations.filter(isPilotParticipantOrg);
  await logPilotDiagnostics({
    orgsLoaded: orgs.length,
    activeOrgs: activeStatusOrganizations.length,
    participantOrgs: activeOrganizations.length,
  });
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
    organizations: organizations.filter(isPilotParticipantOrg).sort((a, b) => a.companyName.localeCompare(b.companyName)),
    recentActivity: activityEvents.filter(event => organizations.some(org => org.id === event.orgId && isPilotParticipantOrg(org))).slice(0, 20),
    progressHistory: [{ label: "Current", averageCompletionPercent }],
    hasHistoricalSnapshots: false,
  };
}

export async function loadPilotParticipantDetail(orgId: string): Promise<{
  organization: PilotOrgSummary | null;
  activity: ActivityEvent[];
}> {
  const data = await loadPilotOversightData();
  const organization = data.organizations.find(org => org.id === orgId) || null;
  if (!organization) return { organization: null, activity: [] };
  const activity = data.recentActivity
    .filter(event => event.orgId === orgId)
    .sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt));
  return { organization, activity };
}
