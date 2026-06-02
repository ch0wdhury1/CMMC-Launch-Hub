import { auth } from "./firebase";

function getApiBaseUrl() {
  return String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
}

export interface CleanupMember {
  id: string;
  uid?: string;
  displayName?: string;
  name?: string;
  email?: string;
  role?: string;
  status?: string;
  active?: boolean;
  createdAt?: unknown;
  joinedAt?: unknown;
  source?: string;
}

export interface CleanupInvitation {
  id: string;
  email?: string;
  role?: string;
  status?: string;
  invitedAt?: unknown;
  invitedBy?: string;
}

export interface CleanupOrgSummary {
  id: string;
  name: string;
  ownerUid?: string;
  ownerEmail?: string;
  tier?: string;
  status?: string;
  subscriptionStatus?: string;
  subscriptionStart?: unknown;
  subscriptionEnd?: unknown;
  billingCycle?: string;
  cleanupNote?: string;
  createdAt?: unknown;
  companyProfile?: {
    legalName?: string;
    cageCode?: string;
    uei?: string;
    contacts?: { primary?: { email?: string } };
  };
  memberCount: number;
  activeMemberCount?: number;
  assessmentCount: number;
  evidenceCount: number;
  evidenceLibraryCount: number;
  pendingInvitationCount: number;
  pendingAccessRequestCount: number;
  pendingAddUserCount: number;
  pendingUpgradeCount: number;
  safeDeleteEligible: boolean;
  safeDeleteBlockers: string[];
  members: CleanupMember[];
  legacyMembers: CleanupMember[];
  invitations: CleanupInvitation[];
  evidenceIssues: Array<{ id: string; fileName?: string; issue: string }>;
  assessmentWarnings: Array<{ id: string; issue: string }>;
}

export interface CleanupAccessRequest {
  id: string;
  orgId?: string;
  uid?: string;
  requestedByUid?: string;
  email?: string;
  requestType?: string;
  status?: string;
  createdAt?: unknown;
}

export interface CleanupDuplicateGroup {
  id: string;
  reason: string;
  orgs: CleanupOrgSummary[];
}

export interface CleanupOrphanUser {
  id: string;
  email?: string;
  displayName?: string;
  name?: string;
  orgId?: string;
  status?: string;
  roles?: { superAdmin?: boolean; orgRole?: string };
}

export interface CleanupControlsInventory {
  generatedAt: string;
  orgs: CleanupOrgSummary[];
  accessRequests: CleanupAccessRequest[];
  duplicateGroups: CleanupDuplicateGroup[];
  orphanUsers: CleanupOrphanUser[];
  protectedOrgIds: string[];
  phase23cDuplicateOrgIds: string[];
}

export interface CleanupControlAction {
  action:
    | "update_org_status"
    | "update_org_subscription"
    | "update_member"
    | "archive_access_request"
    | "cancel_invitation"
    | "disable_orphan_user"
    | "repair_org_fields"
    | "update_org_admin_fields"
    | "archive_org_from_table"
    | "safe_delete_empty_org";
  orgId?: string;
  targetId?: string;
  userId?: string;
  updates?: Record<string, unknown>;
  note?: string;
  cleanupPhase?: "23C" | "23C-UI";
}

async function authenticatedRequest(path: string, init?: RequestInit) {
  const user = auth.currentUser;
  if (!user) throw new Error("Authentication required");
  const token = await user.getIdToken();
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    throw new Error(payload.errorMessage || "Cleanup control request failed");
  }
  return payload;
}

export async function loadCleanupControlsInventory(): Promise<CleanupControlsInventory> {
  const payload = await authenticatedRequest(`${getApiBaseUrl()}/api/admin/cleanup-controls`);
  return payload.inventory;
}

export async function runCleanupControlAction(action: CleanupControlAction): Promise<void> {
  await authenticatedRequest(`${getApiBaseUrl()}/api/admin/cleanup-control`, {
    method: "POST",
    body: JSON.stringify(action),
  });
}
