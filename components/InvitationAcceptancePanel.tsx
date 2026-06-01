import React, { useEffect, useState } from "react";
import { CheckCircle, Loader2, UserPlus } from "lucide-react";
import { acceptOrgInvitation, subscribeMyPendingInvitations } from "../src/orgInvitations";
import type { OrgInvitation } from "../types";

type Props = {
  uid: string;
  email: string | null;
};

export const InvitationAcceptancePanel: React.FC<Props> = ({ uid, email }) => {
  const [invitations, setInvitations] = useState<OrgInvitation[]>([]);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!email) {
      setInvitations([]);
      return;
    }
    return subscribeMyPendingInvitations(email, setInvitations, error => {
      console.warn("[org-invitations] pending invitation lookup failed", error);
    });
  }, [email]);

  const accept = async (invitation: OrgInvitation) => {
    setAcceptingId(invitation.id);
    setMessage("");
    try {
      const result = await acceptOrgInvitation(invitation, uid);
      setMessage(result.alreadyMember ? "Invitation accepted. You were already an active organization member." : "Invitation accepted. Organization access is active.");
    } catch (error) {
      console.error("[org-invitations] acceptance failed", error);
      setMessage(error instanceof Error ? error.message : "Unable to accept invitation.");
    } finally {
      setAcceptingId(null);
    }
  };

  if (invitations.length === 0 && !message) return null;

  return (
    <div className="border-b border-blue-200 bg-blue-50 px-4 py-3">
      <div className="max-w-7xl mx-auto space-y-2">
        {invitations.map(invitation => <div key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 text-sm text-blue-950">
          <span className="flex items-center gap-2"><UserPlus className="h-4 w-4" /> You are invited to join <strong>{invitation.orgName || invitation.orgId}</strong> as <strong>{invitation.role}</strong>.</span>
          <button type="button" onClick={() => accept(invitation)} disabled={acceptingId === invitation.id} className="inline-flex items-center px-3 py-1.5 bg-blue-700 text-white rounded-md hover:bg-blue-800 disabled:opacity-60">
            {acceptingId === invitation.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
            Accept Invitation
          </button>
        </div>)}
        {message && <p className="text-sm text-blue-900">{message}</p>}
      </div>
    </div>
  );
};
