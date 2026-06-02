import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  loadPendingRequestInventory,
  runPendingRequestControl,
  type PendingAccessRequest,
  type PendingInvitationRequest,
  type PendingRequestControlAction,
  type PendingRequestInventory,
} from "../src/pendingRequestControls";

type Props = {
  onCountsChange?: (counts: {addUser: number; upgrade: number}) => void;
};

const formatDate = (value: any) => {
  if (!value) return "Not provided";
  const date = value?.toDate ? value.toDate() : value?._seconds ? new Date(value._seconds * 1000) : new Date(value);
  return Number.isNaN(date.getTime()) ? "Not provided" : date.toLocaleDateString();
};

export const SuperAdminPendingRequests: React.FC<Props> = ({onCountsChange}) => {
  const [inventory, setInventory] = useState<PendingRequestInventory>({invitations: [], accessRequests: []});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const addUserRequests = useMemo(
    () => inventory.accessRequests.filter(request => request.type === "addUser"),
    [inventory.accessRequests]
  );
  const upgradeRequests = useMemo(
    () => inventory.accessRequests.filter(request => request.type === "upgradeRequest"),
    [inventory.accessRequests]
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = await loadPendingRequestInventory();
      setInventory(next);
      onCountsChange?.({addUser: next.invitations.length + next.accessRequests.filter(request => request.type === "addUser").length, upgrade: next.accessRequests.filter(request => request.type === "upgradeRequest").length});
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load pending requests.");
    } finally {
      setLoading(false);
    }
  }, [onCountsChange]);

  useEffect(() => { void refresh(); }, [refresh]);

  const perform = async (params: {
    id: string;
    orgId: string;
    action: PendingRequestControlAction;
    confirmation: string;
    promptForReason?: boolean;
  }) => {
    if (!window.confirm(params.confirmation)) return;
    const rejectionReason = params.promptForReason ? window.prompt("Reason, optional") || "" : "";
    setBusyId(params.id);
    setMessage("");
    setError("");
    try {
      const result = await runPendingRequestControl({
        action: params.action,
        orgId: params.orgId,
        targetId: params.id,
        rejectionReason,
      });
      setMessage(result.message || "Pending request updated.");
      await refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to update pending request.");
    } finally {
      setBusyId("");
    }
  };

  const invitationRows: Array<PendingInvitationRequest | PendingAccessRequest> = [...inventory.invitations, ...addUserRequests];

  return <div className="space-y-4">
    {(message || error) && <p className={`rounded border px-3 py-2 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{error || message}</p>}
    <section id="pending-add-user-requests" className="scroll-mt-4 rounded-lg border bg-white shadow-sm">
      <div className="border-b p-4">
        <h3 className="font-semibold text-gray-900">Pending Add-User / Invitations</h3>
        <p className="mt-1 text-xs text-gray-500">Approve existing accounts or keep approved invitations pending until the invited user signs in or registers.</p>
      </div>
      {loading ? <p className="p-4 text-sm text-gray-600">Loading pending invitations...</p> : invitationRows.length === 0 ? <p className="p-4 text-sm text-gray-600">No pending add-user or invitation requests.</p> :
      <div className="overflow-auto"><table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-gray-600"><tr><th className="p-3 text-left">Organization</th><th className="p-3 text-left">User</th><th className="p-3 text-left">Role</th><th className="p-3 text-left">Requested By</th><th className="p-3 text-left">Date</th><th className="p-3 text-left">Source</th><th className="p-3 text-left">Status</th><th className="p-3 text-left">Actions</th></tr></thead>
        <tbody>{invitationRows.map(request => {
          const invitation = request.source === "invitation";
          const approvedWaiting = request.superAdminApprovalStatus === "approved";
          return <tr key={`${request.source}:${request.orgId}:${request.id}`} className="border-t">
            <td className="p-3">{request.organization || request.orgId}</td>
            <td className="p-3"><div>{request.fullName || "Not provided"}</div><div className="text-xs text-gray-500">{request.email || "Not provided"}</div></td>
            <td className="p-3">{invitation ? request.role : request.requestedRole || "Not provided"}</td>
            <td className="p-3">{invitation ? request.invitedBy || "Not provided" : request.requestedByUid || "Not provided"}</td>
            <td className="p-3">{formatDate(invitation ? request.invitedAt : request.createdAt)}</td>
            <td className="p-3">{request.source}</td>
            <td className="p-3">{approvedWaiting ? "approved - awaiting user sign-in" : request.status || "pending"}</td>
            <td className="p-3"><div className="flex gap-2">
              <button type="button" disabled={busyId === request.id || approvedWaiting} onClick={() => perform({id: request.id, orgId: request.orgId, action: invitation ? "approve_invitation_request" : "approve_add_user_request", confirmation: "Approve this add-user request? Existing user access will be activated when safe."})} className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-40">Approve</button>
              <button type="button" disabled={busyId === request.id} onClick={() => perform({id: request.id, orgId: request.orgId, action: invitation ? "cancel_invitation_request" : "reject_add_user_request", confirmation: invitation ? "Cancel this invitation?" : "Reject this add-user request?", promptForReason: true})} className="rounded bg-rose-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-40">{invitation ? "Cancel" : "Reject"}</button>
            </div></td>
          </tr>;
        })}</tbody>
      </table></div>}
    </section>
    <section id="pending-upgrade-requests" className="scroll-mt-4 rounded-lg border bg-white shadow-sm">
      <div className="border-b p-4"><h3 className="font-semibold text-gray-900">Pending Upgrade Requests</h3><p className="mt-1 text-xs text-gray-500">Tier upgrades require SuperAdmin approval and never auto-approve.</p></div>
      {loading ? <p className="p-4 text-sm text-gray-600">Loading pending upgrades...</p> : upgradeRequests.length === 0 ? <p className="p-4 text-sm text-gray-600">No pending tier upgrade requests.</p> :
      <div className="overflow-auto"><table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-gray-600"><tr><th className="p-3 text-left">Organization</th><th className="p-3 text-left">Current Tier</th><th className="p-3 text-left">Requested Tier</th><th className="p-3 text-left">Requested By</th><th className="p-3 text-left">Date</th><th className="p-3 text-left">Status</th><th className="p-3 text-left">Actions</th></tr></thead>
        <tbody>{upgradeRequests.map(request => <tr key={request.id} className="border-t">
          <td className="p-3">{request.organization || request.orgId}</td><td className="p-3">{request.currentTier || "Not provided"}</td><td className="p-3">{request.requestedTier || "Not provided"}</td><td className="p-3">{request.requestedByEmail || request.requestedByUid || "Not provided"}</td><td className="p-3">{formatDate(request.createdAt)}</td><td className="p-3">{request.status || "pending"}</td>
          <td className="p-3"><div className="flex gap-2"><button type="button" disabled={busyId === request.id} onClick={() => perform({id: request.id, orgId: request.orgId, action: "approve_upgrade_request", confirmation: `Approve upgrade from ${request.currentTier || "current tier"} to ${request.requestedTier || "requested tier"}?`})} className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-40">Approve</button><button type="button" disabled={busyId === request.id} onClick={() => perform({id: request.id, orgId: request.orgId, action: "reject_upgrade_request", confirmation: "Reject this tier upgrade request?", promptForReason: true})} className="rounded bg-rose-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-40">Reject</button></div></td>
        </tr>)}</tbody>
      </table></div>}
    </section>
  </div>;
};
