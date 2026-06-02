import { auth } from "./firebase";

function getApiBaseUrl() {
  return String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
}

export interface ManagedOrgUser {
  uid: string;
  email?: string;
  fullName?: string;
  displayName?: string;
  phone?: string;
  status?: string;
  isSuperAdmin?: boolean;
  membership: {
    id: string;
    role?: string;
    status?: string;
    active?: boolean;
    createdAt?: unknown;
    joinedAt?: unknown;
  };
}

async function request(path: string, init?: RequestInit) {
  const user = auth.currentUser;
  if (!user) throw new Error("Authentication required");
  const token = await user.getIdToken();
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {"Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init?.headers || {})},
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) throw new Error(payload.errorMessage || "Organization user request failed");
  return payload;
}

export async function loadOrgUsers(orgId: string): Promise<{users: ManagedOrgUser[]; canManageOrgOwner: boolean}> {
  return request(`/api/org/users?orgId=${encodeURIComponent(orgId)}`);
}

export async function updateOrgMember(orgId: string, userId: string, role: string, status: string): Promise<void> {
  await request("/api/org/member-control", {method: "POST", body: JSON.stringify({action: "update_org_member", orgId, userId, updates: {role, status}})});
}

export async function removeUserFromOrg(orgId: string, userId: string, allowLastOwnerRemoval: boolean): Promise<void> {
  await request("/api/org/member-control", {method: "POST", body: JSON.stringify({action: "remove_user_from_org", orgId, userId, allowLastOwnerRemoval})});
}

export async function repairOrgMemberIdentities(orgId: string): Promise<number> {
  const payload = await request("/api/org/repair-member-identities", {method: "POST", body: JSON.stringify({orgId})});
  return Number(payload.repairedCount || 0);
}

export async function repairUserAccessRecord(orgId: string, userId: string): Promise<void> {
  await request("/api/org/repair-user-access-record", {method: "POST", body: JSON.stringify({orgId, userId})});
}
