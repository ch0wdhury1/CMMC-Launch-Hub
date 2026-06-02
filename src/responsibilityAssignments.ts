import { collection, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { auth, db } from "./firebase";

export interface ActiveOrgMember {
  uid: string;
  name: string;
  email?: string;
  role?: string;
}

function getApiBaseUrl() {
  return String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
}

async function loadHydratedActiveOrgMembers(orgId: string): Promise<ActiveOrgMember[]> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) return [];
  const response = await fetch(`${getApiBaseUrl()}/api/org/active-members?orgId=${encodeURIComponent(orgId)}`, {
    headers: {Authorization: `Bearer ${token}`},
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) throw new Error(payload.errorMessage || "Unable to load active organization members");
  return (payload.members || []).map((member: any) => ({
    uid: member.uid,
    name: member.displayName || member.name || member.fullName || member.email || member.uid,
    email: member.email || undefined,
    role: member.role || undefined,
  }));
}

export interface ResponsibilityAssignmentUpdate {
  assignedTo: string | null;
  assignedToName: string | null;
  assignedToEmail: string | null;
  assignedAt: string | null;
  assignedBy: string | null;
}

const toActiveOrgMember = (
  uid: string,
  data: Record<string, unknown>,
): ActiveOrgMember | null => {
  const status = typeof data.status === "string" ? data.status : undefined;
  const active = data.active === true;
  if (status !== "active" && !active) return null;

  const email = typeof data.email === "string" ? data.email : undefined;
  const displayName =
    (typeof data.displayName === "string" && data.displayName) ||
    (typeof data.name === "string" && data.name) ||
    (typeof data.fullName === "string" && data.fullName) ||
    email ||
    uid;

  return {
    uid,
    name: displayName,
    email,
    role: typeof data.role === "string" ? data.role : undefined,
  };
};

export const subscribeActiveOrgMembers = (
  orgId: string,
  onMembers: (members: ActiveOrgMember[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe =>
  onSnapshot(
    collection(db, "orgs", orgId, "members"),
    (snapshot) => {
      const localMembers = snapshot.docs
        .map((document) =>
          toActiveOrgMember(document.id, document.data() as Record<string, unknown>),
        )
        .filter((member): member is ActiveOrgMember => Boolean(member))
        .sort((left, right) => left.name.localeCompare(right.name));
      onMembers(localMembers);
      void loadHydratedActiveOrgMembers(orgId)
        .then(members => onMembers(members.sort((left, right) => left.name.localeCompare(right.name))))
        .catch(error => {
          console.warn("[responsibility-assignments] member profile hydration failed; member records retained", error);
        });
    },
    (error) => onError?.(error),
  );

export const buildResponsibilityAssignment = (
  member: ActiveOrgMember | undefined,
  assignedBy: string,
): ResponsibilityAssignmentUpdate =>
  member
    ? {
        assignedTo: member.uid,
        assignedToName: member.name,
        assignedToEmail: member.email || null,
        assignedAt: new Date().toISOString(),
        assignedBy,
      }
    : {
        assignedTo: null,
        assignedToName: null,
        assignedToEmail: null,
        assignedAt: null,
        assignedBy: null,
      };
