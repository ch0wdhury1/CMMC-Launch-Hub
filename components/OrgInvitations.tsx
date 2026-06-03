import React, { useEffect, useMemo, useState } from "react";
import { Ban, Loader2, Send, UserPlus, X } from "lucide-react";
import {
  cancelOrgInvitation,
  createOrgInvitation,
  isValidInvitationEmail,
  loadInvitationInviterDisplays,
  ORG_INVITATION_ROLES,
  subscribeOrgInvitations,
} from "../src/orgInvitations";
import { logActivityEvent } from "../src/activityLog";
import type { OrgInvitation, OrgInvitationRole } from "../types";

type Props = {
  orgId: string | null;
  uid: string | null;
  role?: string;
  isSuperAdmin: boolean;
  embedded?: boolean;
};

const formatDate = (value: any) => {
  if (!value) return "Pending";
  const date = value?.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? "Unavailable" : date.toLocaleString();
};

export const OrgInvitations: React.FC<Props> = ({ orgId, uid, role, isSuperAdmin, embedded = false }) => {
  const [invitations, setInvitations] = useState<OrgInvitation[]>([]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrgInvitationRole>("contributor");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const canManage = Boolean(uid && (isSuperAdmin || role === "orgOwner" || role === "orgAdmin"));
  const canInviteOrgAdmin = isSuperAdmin || role === "orgOwner";
  const availableRoles = useMemo(() => ORG_INVITATION_ROLES.filter(option => option !== "orgAdmin" || canInviteOrgAdmin), [canInviteOrgAdmin]);

  useEffect(() => {
    if (!orgId) {
      setInvitations([]);
      return;
    }
    return subscribeOrgInvitations(orgId, loadedInvitations => {
      setInvitations(loadedInvitations);
      void loadInvitationInviterDisplays(orgId).then(displays => {
        setInvitations(current => current.map(invitation => ({...invitation, ...displays[invitation.id]})));
      }).catch(error => console.warn("[org-invitations] inviter display hydration failed", error));
    }, error => {
      console.error("[org-invitations] load failed", error);
      setMessage("Unable to load invitations.");
    });
  }, [orgId]);

  const pendingInvitations = useMemo(() => invitations.filter(invitation => invitation.status === "pending"), [invitations]);

  const createInvitation = async () => {
    if (!orgId || !uid || !canManage) return;
    if (!isValidInvitationEmail(email)) {
      setMessage("Enter a valid email address.");
      return;
    }
    setIsCreating(true);
    setMessage("");
    try {
      await createOrgInvitation({ orgId, email, role: inviteRole, invitedBy: uid, fullName });
      void logActivityEvent({
        orgId,
        action: "invitation.created",
        actorUid: uid,
        targetType: "invitation",
        targetLabel: email,
        summary: `Invitation created for ${email}`,
        metadata: {role: inviteRole, fullName},
      });
      setFullName("");
      setEmail("");
      setInviteRole("contributor");
      setIsModalOpen(false);
      setMessage("Invitation created. Ask the user to register or sign in with this email.");
    } catch (error) {
      console.error("[org-invitations] create failed", error);
      setMessage(error instanceof Error ? error.message : "Unable to create invitation.");
    } finally {
      setIsCreating(false);
    }
  };

  const cancelInvitation = async (invitation: OrgInvitation) => {
    if (!orgId || !uid || !canManage) return;
    if (!window.confirm(`Cancel the pending invitation for ${invitation.email}?`)) return;
    setCancellingId(invitation.id);
    setMessage("");
    try {
      await cancelOrgInvitation(orgId, invitation.id, uid);
      void logActivityEvent({
        orgId,
        action: "invitation.cancelled",
        actorUid: uid,
        targetType: "invitation",
        targetId: invitation.id,
        targetLabel: invitation.email,
        summary: `Invitation cancelled for ${invitation.email}`,
        metadata: {role: invitation.role},
      });
      setMessage("Invitation cancelled.");
    } catch (error) {
      console.error("[org-invitations] cancellation failed", error);
      setMessage("Unable to cancel invitation.");
    } finally {
      setCancellingId(null);
    }
  };

  if (!orgId) return <div className="bg-white border rounded-lg p-6">Current organization is unavailable.</div>;

  return (
    <div className="space-y-5 animate-fadeIn">
      {!embedded && <div className="bg-white border rounded-lg p-5 shadow-sm">
        <h2 className="text-xl font-bold text-gray-900">Organization Invitations</h2>
        <p className="text-sm text-gray-600 mt-1">Invite users into the current organization using the established membership model.</p>
      </div>}

      <div className="bg-white border rounded-lg p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3"><h3 className="font-bold text-gray-900 flex items-center gap-2"><UserPlus className="h-5 w-5 text-blue-600" /> Pending Invitations</h3>{canManage && <button type="button" onClick={() => setIsModalOpen(true)} className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"><UserPlus className="mr-1 h-4 w-4" /> Add User</button>}</div>
        {!canManage && <p className="text-xs text-gray-500 mt-3">Only Org Owner, Org Admin, and SuperAdmin users can create or cancel invitations.</p>}
        {message && <p className="text-sm text-gray-700 mt-3">{message}</p>}
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase text-gray-500 border-b"><tr><th className="py-2 pr-3">Email</th><th className="pr-3">Role</th><th className="pr-3">Status</th><th className="pr-3">Invited</th><th className="pr-3">Invited By</th><th>Actions</th></tr></thead>
            <tbody>{pendingInvitations.map(invitation => <tr key={invitation.id} className="border-b"><td className="py-3 pr-3">{invitation.email}</td><td className="pr-3">{invitation.role}</td><td className="pr-3 capitalize">{invitation.status}</td><td className="pr-3">{formatDate(invitation.invitedAt)}</td><td className="pr-3 text-xs">{invitation.invitedByDisplay || invitation.invitedByName || invitation.invitedByEmail || invitation.invitedBy}</td><td><button type="button" onClick={() => cancelInvitation(invitation)} disabled={!canManage || cancellingId === invitation.id} title="Cancel invitation" className="p-1 text-red-700 disabled:text-gray-300">{cancellingId === invitation.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}</button></td></tr>)}</tbody>
          </table>
          {pendingInvitations.length === 0 && <p className="py-6 text-sm text-gray-500 text-center">No pending invitations.</p>}
        </div>
      </div>
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4" onClick={() => setIsModalOpen(false)}>
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl" onClick={event => event.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="text-lg font-bold text-gray-900">Add User</h3><button type="button" onClick={() => setIsModalOpen(false)} title="Close add user" className="p-1 text-gray-500 hover:text-gray-900"><X className="h-5 w-5" /></button></div>
            <div className="mt-4 space-y-3">
              <input value={fullName} onChange={event => setFullName(event.target.value)} disabled={isCreating} placeholder="Full Name (optional)" className="w-full rounded-md border px-3 py-2 text-sm" />
              <input value={email} onChange={event => setEmail(event.target.value)} disabled={isCreating} placeholder="Email *" className="w-full rounded-md border px-3 py-2 text-sm" />
              <select value={inviteRole} onChange={event => setInviteRole(event.target.value as OrgInvitationRole)} disabled={isCreating} className="w-full rounded-md border bg-white px-3 py-2 text-sm">{availableRoles.map(option => <option key={option} value={option}>{option}</option>)}</select>
              <button type="button" onClick={createInvitation} disabled={isCreating} className="inline-flex w-full items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} Create Invitation</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
