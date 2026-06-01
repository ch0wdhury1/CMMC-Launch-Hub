import { collection, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { db } from "./firebase";

export interface ActiveOrgMember {
  uid: string;
  name: string;
  email?: string;
  role?: string;
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
      const members = snapshot.docs
        .map((document) =>
          toActiveOrgMember(document.id, document.data() as Record<string, unknown>),
        )
        .filter((member): member is ActiveOrgMember => Boolean(member))
        .sort((left, right) => left.name.localeCompare(right.name));
      onMembers(members);
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
