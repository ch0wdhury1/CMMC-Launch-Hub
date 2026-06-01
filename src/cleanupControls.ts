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
  assessmentCount: number;
  evidenceCount: number;
  members: CleanupMember[];
  legacyMembers: CleanupMember[];
  invitations: CleanupInvitation[];
}

export interface CleanupAccessRequest {
  id: string;
  orgId?: string;
  uid?: string;
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

export interface CleanupControlsInventory {
  generatedAt: string;
  orgs: CleanupOrgSummary[];
  accessRequests: CleanupAccessRequest[];
  duplicateGroups: CleanupDuplicateGroup[];
}

export interface CleanupControlAction {
  action:
    | "update_org_status"
    | "update_org_subscription"
    | "update_member"
    | "archive_access_request"
    | "cancel_invitation";
  orgId?: string;
  targetId?: string;
  userId?: string;
  updates?: Record<string, unknown>;
  note?: string;
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
