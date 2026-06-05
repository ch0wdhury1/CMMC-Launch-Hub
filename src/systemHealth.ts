import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import { loadActivityEvents, type ActivityEvent } from "./activityLog";

type OrgRow = {
  id: string;
  name: string;
  tier: string;
  status: string;
  activeUserCount: number;
  evidenceCount: number;
  reportCount: number;
  lastActivityAt: any;
};

type HealthAlert = {
  level: "Info" | "Warning" | "Critical";
  title: string;
  detail: string;
};

type OcrFailure = {
  date: any;
  organization: string;
  filename: string;
  status: string;
};

export type SystemHealthData = {
  summary: {
    activeOrganizations: number;
    activeUsers: number;
    pendingRegistrations: number;
    pendingInvitations: number;
    pendingTierUpgrades: number;
    evidenceUploadsLast30Days: number;
    reportsGeneratedLast30Days: number;
    passwordResetRequests: number | null;
    storageObjectsCount: number | null;
    recentActivityLast24Hours: number;
  };
  ocr: {
    successCount30Days: number;
    failureCount30Days: number;
    successRate: number;
    recentFailures: OcrFailure[];
  };
  reporting: {
    executiveReports: number;
    poamReports: number;
    otherReports: number;
    lastGeneratedReport: ActivityEvent | null;
    mostActiveOrganization: string;
  };
  organizations: OrgRow[];
  alerts: HealthAlert[];
  recentActivity: ActivityEvent[];
  generatedAt: Date;
};

const toTime = (value: any) => {
  const date = value?.toDate ? value.toDate() : value?._seconds ? new Date(value._seconds * 1000) : new Date(value || 0);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

const orgName = (org: any, id: string) => String(
  org?.companyProfile?.legalName
  || org?.companyProfile?.companyName
  || org?.legalName
  || org?.name
  || org?.displayName
  || id
);

const statusValue = (value: any) => String(value || "").trim().toLowerCase();

const isLastDays = (value: any, days: number) => toTime(value) >= Date.now() - days * 24 * 60 * 60 * 1000;

export async function loadSystemHealthData(): Promise<SystemHealthData> {
  const [orgsSnapshot, usersSnapshot, accessRequestsSnapshot, activityEvents] = await Promise.all([
    getDocs(collection(db, "orgs")),
    getDocs(collection(db, "users")),
    getDocs(collection(db, "accessRequests")),
    loadActivityEvents({isSuperAdmin: true}),
  ]);

  const orgs = orgsSnapshot.docs.map(item => ({id: item.id, ...(item.data() as any)}));
  const users = usersSnapshot.docs.map(item => ({id: item.id, ...(item.data() as any)}));
  const accessRequests = accessRequestsSnapshot.docs.map(item => ({id: item.id, ...(item.data() as any)}));
  const orgDisplay = new Map(orgs.map(org => [org.id, orgName(org, org.id)]));

  const perOrgCollections = await Promise.all(orgs.map(async org => {
    const [invitations, evidence] = await Promise.all([
      getDocs(collection(db, "orgs", org.id, "invitations")).catch(() => null),
      getDocs(collection(db, "orgs", org.id, "evidence")).catch(() => null),
    ]);
    return {
      orgId: org.id,
      invitations: invitations?.docs.map(item => ({id: item.id, ...(item.data() as any)})) || [],
      evidence: evidence?.docs.map(item => ({id: item.id, ...(item.data() as any)})) || [],
    };
  }));

  const invitationsByOrg = new Map(perOrgCollections.map(item => [item.orgId, item.invitations]));
  const evidenceByOrg = new Map(perOrgCollections.map(item => [item.orgId, item.evidence]));
  const allEvidence = perOrgCollections.flatMap(item => item.evidence.map(evidence => ({...evidence, orgId: item.orgId})));
  const reportEvents = activityEvents.filter(event => event.action === "report.generated");
  const reportEventsLast30 = reportEvents.filter(event => isLastDays(event.createdAt, 30));
  const evidenceUploadEventsLast30 = activityEvents.filter(event => event.action === "evidence.uploaded" && isLastDays(event.createdAt, 30));
  const recentActivityLast24 = activityEvents.filter(event => isLastDays(event.createdAt, 1));
  const evidenceLast30 = allEvidence.filter(evidence => isLastDays(evidence.uploadedAt || evidence.createdAt || evidence.updatedAt, 30));
  const ocrSuccess = evidenceLast30.filter(evidence => evidence.processingStatus === "ocr_completed" || evidence.ocrStatus === "completed");
  const ocrFailed = evidenceLast30.filter(evidence => evidence.processingStatus === "ocr_failed" || evidence.ocrStatus === "failed");
  const totalOcrTerminal = ocrSuccess.length + ocrFailed.length;
  const reportCountsByOrg = new Map<string, number>();
  const activityCountsByOrg = new Map<string, number>();

  reportEvents.forEach(event => reportCountsByOrg.set(event.orgId, (reportCountsByOrg.get(event.orgId) || 0) + 1));
  activityEvents.forEach(event => activityCountsByOrg.set(event.orgId, (activityCountsByOrg.get(event.orgId) || 0) + 1));

  const organizations: OrgRow[] = orgs.map(org => {
    const orgUsers = users.filter(user => user.orgId === org.id && statusValue(user.status || "active") === "active");
    const lastActivityAt = activityEvents.find(event => event.orgId === org.id)?.createdAt;
    return {
      id: org.id,
      name: orgDisplay.get(org.id) || org.id,
      tier: String(org.tier || org.subscriptionTier || "Not provided"),
      status: String(org.status || "active"),
      activeUserCount: orgUsers.length,
      evidenceCount: evidenceByOrg.get(org.id)?.length || 0,
      reportCount: reportCountsByOrg.get(org.id) || 0,
      lastActivityAt,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  const pendingRegistrations = accessRequests.filter(request => request.type === "orgRegistration" && statusValue(request.status) === "pending").length;
  const pendingTierUpgrades = accessRequests.filter(request => request.type === "upgradeRequest" && statusValue(request.status) === "pending").length;
  const pendingInvitations = Array.from(invitationsByOrg.values()).flat().filter(invitation => statusValue(invitation.status) === "pending").length;
  const executiveReports = reportEvents.filter(event => event.targetId === "executive-readiness" || /executive/i.test(event.targetLabel || event.summary || "")).length;
  const poamReports = reportEvents.filter(event => event.targetId === "poam" || /poa&m|poam/i.test(event.targetLabel || event.summary || "")).length;
  const otherReports = Math.max(0, reportEvents.length - executiveReports - poamReports);
  const mostActiveOrgId = Array.from(activityCountsByOrg.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  const activeOrgWithoutRecentActivity = organizations.filter(org => statusValue(org.status) === "active" && (!org.lastActivityAt || !isLastDays(org.lastActivityAt, 30)));

  const alerts: HealthAlert[] = [];
  if (ocrFailed.length >= 5 || (ocrFailed.length >= 3 && totalOcrTerminal > 0 && ocrFailed.length / totalOcrTerminal >= 0.25)) {
    alerts.push({level: ocrFailed.length >= 10 ? "Critical" : "Warning", title: "OCR Failure Spike", detail: `${ocrFailed.length} OCR failures detected in the last 30 days.`});
  }
  organizations.filter(org => ["inactive", "disabled", "archived"].includes(statusValue(org.status))).forEach(org => {
    alerts.push({level: "Info", title: "Organization Disabled", detail: `${org.name} is currently ${org.status}.`});
  });
  if (pendingRegistrations >= 5) alerts.push({level: pendingRegistrations >= 10 ? "Critical" : "Warning", title: "High Pending Registration Count", detail: `${pendingRegistrations} pending registration requests need review.`});
  if (pendingInvitations >= 10) alerts.push({level: pendingInvitations >= 20 ? "Critical" : "Warning", title: "High Pending Invitation Count", detail: `${pendingInvitations} pending invitations are open.`});
  activeOrgWithoutRecentActivity.slice(0, 8).forEach(org => alerts.push({level: "Info", title: "No Activity > 30 Days", detail: `${org.name} has no recorded activity in the last 30 days.`}));

  return {
    summary: {
      activeOrganizations: organizations.filter(org => statusValue(org.status) === "active").length,
      activeUsers: users.filter(user => statusValue(user.status || "active") === "active").length,
      pendingRegistrations,
      pendingInvitations,
      pendingTierUpgrades,
      evidenceUploadsLast30Days: Math.max(evidenceUploadEventsLast30.length, evidenceLast30.length),
      reportsGeneratedLast30Days: reportEventsLast30.length,
      passwordResetRequests: null,
      storageObjectsCount: null,
      recentActivityLast24Hours: recentActivityLast24.length,
    },
    ocr: {
      successCount30Days: ocrSuccess.length,
      failureCount30Days: ocrFailed.length,
      successRate: totalOcrTerminal === 0 ? 0 : Math.round((ocrSuccess.length / totalOcrTerminal) * 100),
      recentFailures: ocrFailed
        .sort((a, b) => toTime(b.updatedAt || b.uploadedAt) - toTime(a.updatedAt || a.uploadedAt))
        .slice(0, 10)
        .map(evidence => ({
          date: evidence.updatedAt || evidence.uploadedAt || evidence.createdAt,
          organization: orgDisplay.get(evidence.orgId) || evidence.orgId,
          filename: evidence.fileName || evidence.name || evidence.id,
          status: evidence.processingStatus || evidence.ocrStatus || "failed",
        })),
    },
    reporting: {
      executiveReports,
      poamReports,
      otherReports,
      lastGeneratedReport: reportEvents[0] || null,
      mostActiveOrganization: mostActiveOrgId ? orgDisplay.get(mostActiveOrgId) || mostActiveOrgId : "No activity recorded",
    },
    organizations,
    alerts,
    recentActivity: activityEvents.slice(0, 20),
    generatedAt: new Date(),
  };
}
