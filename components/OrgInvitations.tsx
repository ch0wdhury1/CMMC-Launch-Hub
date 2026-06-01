import React, { useEffect, useMemo, useState } from "react";
import { Ban, Loader2, Send, UserPlus } from "lucide-react";
import {
  cancelOrgInvitation,
  createOrgInvitation,
  isValidInvitationEmail,
  ORG_INVITATION_ROLES,
  subscribeOrgInvitations,
} from "../src/orgInvitations";
import type { OrgInvitation, OrgInvitationRole } from "../types";

type Props = {
  orgId: string | null;
  uid: string | null;
  role?: string;
  isSuperAdmin: boolean;
};

const formatDate = (value: any) => {
  if (!value) return "Pending";
  const date = value?.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? "Unavailable" : date.toLocaleString();
};

export const OrgInvitations: React.FC<Props> = ({ orgId, uid, role, isSuperAdmin }) => {
  const [invitations, setInvitations] = useState<OrgInvitation[]>([]);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrgInvitationRole>("contributor");
  const [message, setMessage] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const canManage = Boolean(uid && (isSuperAdmin || role === "orgAdmin"));

  useEffect(() => {
    if (!orgId) {
      setInvitations([]);
      return;
    }
    return subscribeOrgInvitations(orgId, setInvitations, error => {
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
      await createOrgInvitation({ orgId, email, role: inviteRole, invitedBy: uid });
      setEmail("");
      setInviteRole("contributor");
      setMessage("Invitation created. Ask the user to sign in with this email. The invitation will appear after login.");
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
      <div className="bg-white border rounded-lg p-5 shadow-sm">
        <h2 className="text-xl font-bold text-gray-900">Organization Invitations</h2>
        <p className="text-sm text-gray-600 mt-1">Invite users into the current organization using the established membership model.</p>
      </div>

      <div className="bg-white border rounded-lg p-5 shadow-sm">
        <h3 className="font-bold text-gray-900 flex items-center gap-2"><UserPlus className="h-5 w-5 text-blue-600" /> Create Invitation</h3>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_220px_auto] gap-3 mt-4">
          <input value={email} onChange={event => setEmail(event.target.value)} disabled={!canManage || isCreating} placeholder="user@example.com" className="border rounded-md px-3 py-2 text-sm" />
          <select value={inviteRole} onChange={event => setInviteRole(event.target.value as OrgInvitationRole)} disabled={!canManage || isCreating} className="border rounded-md px-3 py-2 text-sm bg-white">
            {ORG_INVITATION_ROLES.map(option => <option key={option} value={option}>{option}</option>)}
          </select>
          <button type="button" onClick={createInvitation} disabled={!canManage || isCreating} className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50">
            {isCreating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Create Invitation
          </button>
        </div>
        {!canManage && <p className="text-xs text-gray-500 mt-3">Only Org Admin and SuperAdmin users can create or cancel invitations.</p>}
        {message && <p className="text-sm text-gray-700 mt-3">{message}</p>}
      </div>

      <div className="bg-white border rounded-lg p-5 shadow-sm">
        <h3 className="font-bold text-gray-900">Pending Invitations</h3>
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase text-gray-500 border-b"><tr><th className="py-2 pr-3">Email</th><th className="pr-3">Role</th><th className="pr-3">Status</th><th className="pr-3">Invited</th><th className="pr-3">Invited By</th><th>Actions</th></tr></thead>
            <tbody>{pendingInvitations.map(invitation => <tr key={invitation.id} className="border-b"><td className="py-3 pr-3">{invitation.email}</td><td className="pr-3">{invitation.role}</td><td className="pr-3 capitalize">{invitation.status}</td><td className="pr-3">{formatDate(invitation.invitedAt)}</td><td className="pr-3 font-mono text-xs">{invitation.invitedBy}</td><td><button type="button" onClick={() => cancelInvitation(invitation)} disabled={!canManage || cancellingId === invitation.id} title="Cancel invitation" className="p-1 text-red-700 disabled:text-gray-300">{cancellingId === invitation.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}</button></td></tr>)}</tbody>
          </table>
          {pendingInvitations.length === 0 && <p className="py-6 text-sm text-gray-500 text-center">No pending invitations.</p>}
        </div>
      </div>
    </div>
  );
};
