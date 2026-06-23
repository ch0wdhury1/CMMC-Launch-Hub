import { auth } from "./firebase";
import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";

export type PendingInvitationRequest = {
  id: string;
  orgId: string;
  organization?: string;
  source: "invitation";
  email?: string;
  fullName?: string;
  role?: string;
  status?: string;
  invitedBy?: string;
  invitedByUid?: string;
  invitedByName?: string;
  invitedByEmail?: string;
  invitedByDisplay?: string;
  invitedAt?: unknown;
  superAdminApprovalStatus?: string;
};

export type PendingAccessRequest = {
  id: string;
  orgId: string;
  organization?: string;
  source: "accessRequest";
  type?: "addUser" | "upgradeRequest";
  email?: string;
  fullName?: string;
  requestedRole?: string;
  currentTier?: string;
  requestedTier?: string;
  requestedByUid?: string;
  requestedByEmail?: string;
  companyName?: string;
  createdAt?: unknown;
  status?: string;
  superAdminApprovalStatus?: string;
};

export type PendingRequestInventory = {
  invitations: PendingInvitationRequest[];
  accessRequests: PendingAccessRequest[];
};

export type PendingRequestControlAction =
  | "approve_add_user_request"
  | "reject_add_user_request"
  | "approve_invitation_request"
  | "cancel_invitation_request"
  | "approve_upgrade_request"
  | "reject_upgrade_request";

const apiBase = () => String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

async function authenticatedRequest(path: string, init?: RequestInit) {
  const user = auth.currentUser;
  if (!user) throw new Error("Authentication required");
  const response = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await user.getIdToken()}`,
      ...(init?.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    throw new Error(payload.errorMessage || "Pending request action failed");
  }
  return payload;
}

export async function loadPendingRequestInventory(): Promise<PendingRequestInventory> {
  const payload = await authenticatedRequest("/api/admin/pending-requests");
  const orgSnapshot = await getDocs(collection(db, "orgs")).catch(() => null);
  const orgNameMap = new Map<string, string>();
  orgSnapshot?.docs.forEach(orgDoc => {
    const org = orgDoc.data() as any;
    const name = cleanOrgName(
      org?.companyProfile?.companyName,
      org?.name,
      undefined,
      "Unknown Organization"
    );
    orgNameMap.set(orgDoc.id, name);
  });
  const accessRequests = (payload.accessRequests || []).map((request: PendingAccessRequest) => {
    if (request.type !== "upgradeRequest") return request;
    const resolved = orgNameMap.get(request.orgId) || cleanOrgName(request.companyName, undefined, request.organization, "Unknown Organization");
    return {...request, organization: resolved};
  });
  return {...payload, accessRequests};
}

function cleanOrgName(primary?: unknown, secondary?: unknown, tertiary?: unknown, fallback = "Unknown Organization") {
  for (const value of [primary, secondary, tertiary]) {
    const text = String(value || "").trim();
    if (!text) continue;
    if (text.toLowerCase() === "my company") continue;
    return text;
  }
  return fallback;
}

export async function runPendingRequestControl(params: {
  action: PendingRequestControlAction;
  orgId: string;
  targetId: string;
  rejectionReason?: string;
}): Promise<{awaitingUser?: boolean; activatedUser?: boolean; message?: string}> {
  return authenticatedRequest("/api/admin/pending-request-control", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function createInvitedUserLogin(params: {
  orgId: string;
  invitationId: string;
  temporaryPassword: string;
}): Promise<{email: string; displayName: string; message: string}> {
  return authenticatedRequest("/api/admin/create-invited-user-login", {
    method: "POST",
    body: JSON.stringify(params),
  });
}
