import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import type { OrgInvitation, OrgInvitationRole } from "../types";

export const ORG_INVITATION_ROLES: OrgInvitationRole[] = ["orgAdmin", "contributor", "viewer", "assessor"];

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const apiBase = () => String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

export const isValidInvitationEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));

const invitationFromSnapshot = (snapshot: any): OrgInvitation => ({
  id: snapshot.id,
  ...(snapshot.data() as Omit<OrgInvitation, "id">),
});

export function subscribeOrgInvitations(
  orgId: string,
  onInvitations: (invitations: OrgInvitation[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const invitationQuery = query(collection(db, "orgs", orgId, "invitations"), orderBy("invitedAt", "desc"));
  return onSnapshot(invitationQuery, snapshot => {
    onInvitations(snapshot.docs.map(invitationFromSnapshot));
  }, onError);
}

export async function loadInvitationInviterDisplays(orgId: string): Promise<Record<string, {
  invitedByUid: string;
  invitedByName: string;
  invitedByEmail: string;
  invitedByDisplay: string;
}>> {
  const user = auth.currentUser;
  if (!user) throw new Error("Authentication required");
  const response = await fetch(`${apiBase()}/api/org/invitation-inviters?orgId=${encodeURIComponent(orgId)}`, {
    headers: {Authorization: `Bearer ${await user.getIdToken()}`},
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) throw new Error(payload.errorMessage || "Unable to load inviter details");
  return payload.displays || {};
}

export function subscribeMyPendingInvitations(
  email: string,
  onInvitations: (invitations: OrgInvitation[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const normalizedEmail = normalizeEmail(email);
  const invitationQuery = query(collectionGroup(db, "invitations"), where("email", "==", normalizedEmail));
  return onSnapshot(invitationQuery, snapshot => {
    onInvitations(snapshot.docs
      .map(invitationFromSnapshot)
      .filter(invitation => invitation.status === "pending" && invitation.superAdminApprovalStatus === "approved"));
  }, onError);
}

export async function createOrgInvitation(params: {
  orgId: string;
  email: string;
  role: OrgInvitationRole;
  invitedBy: string;
  fullName?: string;
}): Promise<string> {
  const email = normalizeEmail(params.email);
  if (!isValidInvitationEmail(email)) throw new Error("Enter a valid email address.");
  if (!ORG_INVITATION_ROLES.includes(params.role)) throw new Error("Select a valid invitation role.");

  const existing = await getDocs(collection(db, "orgs", params.orgId, "invitations"));
  if (existing.docs.some(invitation => invitation.data()?.email === email && invitation.data()?.status === "pending")) {
    throw new Error("A pending invitation already exists for this email.");
  }

  const [orgSnapshot] = await Promise.all([getDoc(doc(db, "orgs", params.orgId))]);
  const invitationId = crypto.randomUUID();
  const invitedByName = auth.currentUser?.displayName || "";
  const invitedByEmail = auth.currentUser?.email || "";
  await setDoc(doc(db, "orgs", params.orgId, "invitations", invitationId), {
    id: invitationId,
    orgId: params.orgId,
    orgName: orgSnapshot.data()?.companyProfile?.legalName || orgSnapshot.data()?.name || params.orgId,
    email,
    fullName: params.fullName?.trim() || "",
    role: params.role,
    status: "pending",
    invitedBy: params.invitedBy,
    invitedByUid: params.invitedBy,
    invitedByName,
    invitedByEmail,
    invitedByDisplay: invitedByName || invitedByEmail || params.invitedBy,
    invitedAt: serverTimestamp(),
  });
  return invitationId;
}

export async function cancelOrgInvitation(orgId: string, invitationId: string, cancelledBy: string): Promise<void> {
  await setDoc(doc(db, "orgs", orgId, "invitations", invitationId), {
    status: "cancelled",
    cancelledBy,
    cancelledAt: serverTimestamp(),
  }, { merge: true });
}

export async function acceptOrgInvitation(invitation: OrgInvitation, uid: string): Promise<{ alreadyMember: boolean }> {
  const invitationRef = doc(db, "orgs", invitation.orgId, "invitations", invitation.id);
  const memberRef = doc(db, "orgs", invitation.orgId, "members", uid);
  const userRef = doc(db, "users", uid);
  const [freshInvitation, membership, user] = await Promise.all([
    getDoc(invitationRef),
    getDoc(memberRef),
    getDoc(userRef),
  ]);

  if (!freshInvitation.exists() || freshInvitation.data()?.status !== "pending") {
    throw new Error("This invitation is no longer pending.");
  }
  if (freshInvitation.data()?.superAdminApprovalStatus !== "approved") {
    throw new Error("This invitation is awaiting administrator approval.");
  }

  const existingMembership = membership.exists() ? membership.data() : null;
  const alreadyMember = existingMembership?.status === "active";
  const role = alreadyMember ? existingMembership?.role : invitation.role;
  const displayName = user.data()?.displayName || user.data()?.fullName || invitation.fullName || invitation.email;
  const batch = writeBatch(db);

  batch.set(memberRef, {
    uid,
    displayName,
    role,
    status: "active",
    active: true,
    superAdmin: false,
    email: invitation.email,
    invitationId: invitation.id,
    joinedAt: existingMembership?.joinedAt || serverTimestamp(),
    createdAt: existingMembership?.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });

  batch.set(userRef, {
    uid,
    displayName,
    email: invitation.email,
    orgId: invitation.orgId,
    status: "active",
    roles: {
      ...((user.exists() ? user.data()?.roles : {}) || {}),
      orgRole: role,
    },
    updatedAt: serverTimestamp(),
  }, { merge: true });
  batch.set(invitationRef, {
    status: "accepted",
    acceptedBy: uid,
    acceptedAt: serverTimestamp(),
  }, { merge: true });
  await batch.commit();
  return { alreadyMember };
}
