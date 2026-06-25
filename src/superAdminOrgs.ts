import { auth } from "./firebase";

export type SuperAdminOrgSummary = {
  id: string;
  companyName: string;
  location?: string;
  primaryEmail?: string;
  tier: string;
  enrollmentType: string;
  programName?: string;
  programCode?: string;
  status: string;
  createdAt?: any;
  approvedAt?: any;
  lastActivity?: any;
  usersCount: number;
  practicesCompleted: number;
  practicesRemaining: number;
  totalPractices: number;
  completionPercent: number;
  domainReadiness: Array<{ domain: string; completed: number; remaining: number; total: number; readinessPercent: number; status: string }>;
  sprsScore: number;
  evidenceCount: number;
  sspGenerated: boolean;
  poamGenerated: boolean;
  reportsGenerated: number;
  marketplaceEngagements: Array<{
    id?: string;
    vendorId: string;
    vendorName: string;
    vendorCategory?: string;
    engagementType: string;
    status: string;
    startDate?: string;
    endDate?: string;
    serviceDescription?: string;
    updatedAt?: any;
  }>;
};

export type SuperAdminOrgUser = {
  uid: string;
  name: string;
  email: string;
  role: string;
  status: string;
  joinedAt?: any;
};

export type SuperAdminOrgActivity = {
  id: string;
  action: string;
  actorName?: string;
  actorEmail?: string;
  targetType?: string;
  targetLabel?: string;
  summary: string;
  createdAt?: any;
};

const apiBase = () => String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const isLocalDevHost = () => {
  if (typeof window === "undefined") return false;
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
};

const apiUrl = (path: string) => `${isLocalDevHost() ? "" : apiBase()}${path}`;

async function request(path: string) {
  const user = auth.currentUser;
  if (!user) throw new Error("Authentication required.");
  const response = await fetch(apiUrl(path), {
    headers: { Authorization: `Bearer ${await user.getIdToken()}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) throw new Error(payload.errorMessage || "SuperAdmin organization request failed.");
  return payload;
}

export async function loadSuperAdminActiveOrgs(): Promise<SuperAdminOrgSummary[]> {
  const payload = await request("/api/admin/active-orgs");
  return payload.orgs || [];
}

export async function loadSuperAdminOrgDetail(orgId: string): Promise<{
  org: SuperAdminOrgSummary;
  users: SuperAdminOrgUser[];
  recentActivity: SuperAdminOrgActivity[];
}> {
  const payload = await request(`/api/admin/org/${encodeURIComponent(orgId)}/detail`);
  return { org: payload.org, users: payload.users || [], recentActivity: payload.recentActivity || [] };
}
