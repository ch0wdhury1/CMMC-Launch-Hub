import { auth } from "./firebase";

export type ProgramAnalyticsProgram = {
  id: string;
  name: string;
  programCode: string;
  programType?: string;
  state?: string;
  sponsorName?: string;
  status: string;
};

export type ProgramAnalyticsOrg = {
  id: string;
  companyName: string;
  tier: string;
  status: string;
  usersCount: number;
  completionPercent: number;
  sprsScore: number;
  evidenceCount: number;
  sspGenerated: boolean;
  poamGenerated: boolean;
  reportsGenerated: number;
  openPoamCount: number;
  practicesCompleted: number;
  practicesRemaining: number;
  lastActivity: any;
  attentionFlag: "Needs Attention" | "Low Progress" | "Reports Missing" | "On Track" | string;
};

export type ProgramAnalyticsActivity = {
  id: string;
  orgId: string;
  orgName: string;
  action: string;
  actorName?: string;
  actorEmail?: string;
  targetType?: string;
  targetLabel?: string;
  summary: string;
  createdAt: any;
};

export type ProgramAnalyticsData = {
  programs: ProgramAnalyticsProgram[];
  selectedProgram: ProgramAnalyticsProgram | null;
  scope: {
    isSuperAdmin: boolean;
    isProgramObserver: boolean;
    isLegacyPilotObserver: boolean;
  };
  summary: {
    totalOrganizations: number;
    activeOrganizations: number;
    totalUsers: number;
    averageCompletionPercent: number;
    averageSprsScore: number;
    evidenceUploaded: number;
    sspGeneratedCount: number;
    poamGeneratedCount: number;
    openPoamItems: number;
    lastActivityDate: any;
    completedPractices: number;
    remainingPractices: number;
    averageReadinessPercent: number;
    l1Organizations: number;
    l2Organizations: number;
    organizationsUsingVendors?: number;
    totalVendorEngagements?: number;
    activeVendorEngagements?: number;
    softwareVendorsUsed?: number;
    consultingProvidersUsed?: number;
    trainingProvidersUsed?: number;
  };
  organizations: ProgramAnalyticsOrg[];
  recentActivity: ProgramAnalyticsActivity[];
  charts: {
    completionDistribution: Array<{ label: string; count: number }>;
    tierSplit: { l1: number; l2: number };
    reportsSummary: { ssp: number; poam: number; other: number };
    topMarketplaceVendors?: Array<{
      vendorId: string;
      vendorName: string;
      vendorCategory: string;
      organizationsUsing: number;
      activeEngagements: number;
    }>;
  };
};

const apiBase = () => String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const isLocalDevHost = () => {
  if (typeof window === "undefined") return false;
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
};

export async function loadProgramAnalytics(programId?: string): Promise<ProgramAnalyticsData> {
  const localDev = isLocalDevHost();
  const base = localDev ? "" : apiBase();
  if (!base && !localDev) throw new Error("Missing VITE_API_BASE_URL for Program Analytics.");
  const user = auth.currentUser;
  if (!user) throw new Error("Authentication required.");
  const params = new URLSearchParams();
  if (programId) params.set("programId", programId);
  const url = `${base}/api/program/analytics${params.toString() ? `?${params.toString()}` : ""}`;
  if (localDev) {
    console.log("[ProgramAnalytics] fetching", { url, selectedProgramId: programId || "" });
  }
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${await user.getIdToken()}` },
  });
  const text = await response.text();
  let payload: any = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { errorMessage: text.slice(0, 240) };
  }
  if (localDev) {
    console.log("[ProgramAnalytics] response", {
      url,
      selectedProgramId: programId || "",
      status: response.status,
      body: payload,
    });
  }
  if (!response.ok || payload.success === false) {
    throw new Error(payload.errorMessage || "Program Analytics is unavailable.");
  }
  return payload.data as ProgramAnalyticsData;
}
