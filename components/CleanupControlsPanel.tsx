import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import {
  CleanupControlAction,
  CleanupMember,
  CleanupOrgSummary,
  loadCleanupControlsInventory,
  runCleanupControlAction,
  type CleanupControlsInventory,
} from "../src/cleanupControls";

const orgStatuses = ["active", "inactive", "archived"];
const tiers = ["SPONSORED", "COMM_L1", "COMM_L2"];
const subscriptionStatuses = ["active", "trial", "expired", "cancelled"];
const billingCycles = ["monthly", "annual", "sponsored", "manual"];
const memberStatuses = ["active", "inactive", "disabled"];
const memberRoles = ["orgOwner", "orgAdmin", "contributor", "viewer", "assessor"];

const dateInput = (value: any) => {
  if (!value) return "";
  const parsed = value?._seconds ? new Date(value._seconds * 1000) : new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
};

const displayDate = (value: any) => dateInput(value) || "-";

const isStalePendingRequest = (request: {status?: string; createdAt?: unknown}) => {
  if (request.status !== "pending" || !request.createdAt) return false;
  const value = request.createdAt as any;
  const createdAt = value?._seconds ? new Date(value._seconds * 1000) : new Date(value);
  return !Number.isNaN(createdAt.getTime()) && Date.now() - createdAt.getTime() > 14 * 24 * 60 * 60 * 1000;
};

const memberLabel = (member: CleanupMember) =>
  member.displayName || member.name || member.email || member.uid || member.id;

const promptCleanupNote = () => window.prompt("Add a cleanup note (optional).", "") || "";

export const CleanupControlsPanel: React.FC = () => {
  const [inventory, setInventory] = useState<CleanupControlsInventory | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [orgStatus, setOrgStatus] = useState("active");
  const [tier, setTier] = useState("COMM_L2");
  const [subscriptionStatus, setSubscriptionStatus] = useState("active");
  const [subscriptionStart, setSubscriptionStart] = useState("");
  const [subscriptionEnd, setSubscriptionEnd] = useState("");
  const [billingCycle, setBillingCycle] = useState("manual");

  const selectedOrg = useMemo(
    () => inventory?.orgs.find(org => org.id === selectedOrgId) || null,
    [inventory, selectedOrgId]
  );
  const staleRequests = useMemo(
    () => inventory?.accessRequests.filter(isStalePendingRequest) || [],
    [inventory]
  );

  useEffect(() => {
    if (!selectedOrg) return;
    setOrgStatus(selectedOrg.status || "active");
    setTier(selectedOrg.tier || "COMM_L2");
    setSubscriptionStatus(selectedOrg.subscriptionStatus || "active");
    setSubscriptionStart(dateInput(selectedOrg.subscriptionStart));
    setSubscriptionEnd(dateInput(selectedOrg.subscriptionEnd));
    setBillingCycle(selectedOrg.billingCycle || "manual");
  }, [selectedOrg]);

  const loadInventory = async () => {
    setIsLoading(true);
    setError("");
    try {
      const next = await loadCleanupControlsInventory();
      setInventory(next);
      setSelectedOrgId(current => current || next.orgs[0]?.id || "");
    } catch (loadError) {
      console.warn("[cleanup-controls] inventory failed", loadError);
      setError(loadError instanceof Error ? loadError.message : "Unable to load cleanup controls.");
    } finally {
      setIsLoading(false);
    }
  };

  const perform = async (key: string, action: CleanupControlAction, confirmation: string) => {
    if (!window.confirm(confirmation)) return;
    setPendingAction(key);
    setError("");
    setSuccess("");
    try {
      await runCleanupControlAction(action);
      setSuccess("Cleanup action completed and logged.");
      await loadInventory();
    } catch (actionError) {
      console.warn("[cleanup-controls] action failed", actionError);
      setError(actionError instanceof Error ? actionError.message : "Cleanup action failed.");
    } finally {
      setPendingAction("");
    }
  };

  const updateMember = (member: CleanupMember, updates: Record<string, unknown>, confirmation: string) =>
    perform(`member:${member.id}`, {
      action: "update_member",
      orgId: selectedOrgId,
      userId: member.uid || member.id,
      updates: {
        status: member.status || "active",
        active: member.active !== false,
        role: member.role || "viewer",
        ...updates,
      },
    }, confirmation);

  return (
    <section className="space-y-3">
      <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Cleanup Controls</h4>
      <div className="rounded border border-amber-900/80 bg-amber-950/30 p-3 text-[11px] text-amber-100 space-y-1">
        <p className="font-semibold flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> SuperAdmin controlled metadata updates only</p>
        <p>Archive does not delete data. Disable does not delete a user account. Tier changes may affect feature access. Cleanup actions are logged.</p>
      </div>
      <button type="button" onClick={loadInventory} disabled={isLoading} className="flex items-center px-3 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-md hover:bg-indigo-500 disabled:opacity-60">
        {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
        {isLoading ? "Loading cleanup controls..." : inventory ? "Refresh Cleanup Controls" : "Load Cleanup Controls"}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {success && <p className="text-xs text-emerald-400">{success}</p>}
      {inventory && (
        <div className="space-y-4">
          <label className="block text-xs text-gray-300">
            Organization
            <select value={selectedOrgId} onChange={event => setSelectedOrgId(event.target.value)} className="mt-1 w-full bg-gray-800 border border-gray-700 rounded p-2 text-xs">
              {inventory.orgs.map(org => <option key={org.id} value={org.id}>{org.name} ({org.id})</option>)}
            </select>
          </label>

          {selectedOrg && (
            <>
              <div className="space-y-2 rounded border border-gray-800 p-3">
                <h5 className="text-xs font-bold text-white">Organization Status</h5>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="text-[10px] text-gray-400">Status<select value={orgStatus} onChange={event => setOrgStatus(event.target.value)} className="block mt-1 bg-gray-800 border border-gray-700 rounded p-2 text-xs">{orgStatuses.map(value => <option key={value}>{value}</option>)}</select></label>
                  <button type="button" disabled={pendingAction === "org-status"} onClick={() => perform("org-status", {action: "update_org_status", orgId: selectedOrg.id, updates: {status: orgStatus}, note: promptCleanupNote()}, orgStatus === "archived" ? "Archive this organization? This will not delete data." : "Change this organization status?")} className="px-3 py-2 bg-gray-700 text-xs font-semibold rounded hover:bg-gray-600 disabled:opacity-60">Apply Status</button>
                </div>
                {selectedOrg.cleanupNote && <p className="text-[10px] text-gray-400">Last cleanup note: {selectedOrg.cleanupNote}</p>}
              </div>

              <div className="space-y-2 rounded border border-gray-800 p-3">
                <h5 className="text-xs font-bold text-white">Tier & Subscription</h5>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[10px] text-gray-400">Tier<select value={tier} onChange={event => setTier(event.target.value)} className="block mt-1 w-full bg-gray-800 border border-gray-700 rounded p-2 text-xs">{tiers.map(value => <option key={value}>{value}</option>)}</select></label>
                  <label className="text-[10px] text-gray-400">Subscription<select value={subscriptionStatus} onChange={event => setSubscriptionStatus(event.target.value)} className="block mt-1 w-full bg-gray-800 border border-gray-700 rounded p-2 text-xs">{subscriptionStatuses.map(value => <option key={value}>{value}</option>)}</select></label>
                  <label className="text-[10px] text-gray-400">Start<input type="date" value={subscriptionStart} onChange={event => setSubscriptionStart(event.target.value)} className="block mt-1 w-full bg-gray-800 border border-gray-700 rounded p-2 text-xs" /></label>
                  <label className="text-[10px] text-gray-400">End<input type="date" value={subscriptionEnd} onChange={event => setSubscriptionEnd(event.target.value)} className="block mt-1 w-full bg-gray-800 border border-gray-700 rounded p-2 text-xs" /></label>
                  <label className="text-[10px] text-gray-400">Billing Cycle<select value={billingCycle} onChange={event => setBillingCycle(event.target.value)} className="block mt-1 w-full bg-gray-800 border border-gray-700 rounded p-2 text-xs">{billingCycles.map(value => <option key={value}>{value}</option>)}</select></label>
                </div>
                <button type="button" disabled={pendingAction === "org-subscription"} onClick={() => perform("org-subscription", {action: "update_org_subscription", orgId: selectedOrg.id, updates: {tier, subscriptionStatus, subscriptionStart, subscriptionEnd, billingCycle}}, "Change this org tier or subscription? Tier changes may affect feature access.")} className="px-3 py-2 bg-gray-700 text-xs font-semibold rounded hover:bg-gray-600 disabled:opacity-60">Apply Subscription</button>
              </div>

              <div className="space-y-2 rounded border border-gray-800 p-3">
                <h5 className="text-xs font-bold text-white">Organization Members</h5>
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px] text-left">
                    <thead className="text-gray-500 uppercase"><tr><th className="p-1">Member</th><th className="p-1">Role</th><th className="p-1">Status</th><th className="p-1">Active</th></tr></thead>
                    <tbody>{selectedOrg.members.map(member => <tr key={member.id} className="border-t border-gray-800">
                      <td className="p-1"><p>{memberLabel(member)}</p><p className="font-mono text-gray-500">{member.uid || member.id}</p></td>
                      <td className="p-1"><select value={member.role || "viewer"} onChange={event => updateMember(member, {role: event.target.value}, "Change this member role?")} className="bg-gray-800 border border-gray-700 rounded p-1">{memberRoles.map(value => <option key={value}>{value}</option>)}</select></td>
                      <td className="p-1"><select value={member.status || "active"} onChange={event => updateMember(member, {status: event.target.value, active: event.target.value === "active"}, event.target.value === "disabled" ? "Disable this member? They may lose org access." : "Change this member status?")} className="bg-gray-800 border border-gray-700 rounded p-1">{memberStatuses.map(value => <option key={value}>{value}</option>)}</select></td>
                      <td className="p-1"><input type="checkbox" checked={member.active !== false} onChange={event => updateMember(member, {active: event.target.checked}, event.target.checked ? "Activate this member?" : "Disable this member? They may lose org access.")} /></td>
                    </tr>)}</tbody>
                  </table>
                  {selectedOrg.members.length === 0 && <p className="text-xs text-gray-500 py-2">No current org members found.</p>}
                </div>
                {selectedOrg.legacyMembers.length > 0 && <div><p className="text-[10px] font-semibold text-amber-300">Legacy membership references</p>{selectedOrg.legacyMembers.map(member => <p key={member.id} className="text-[10px] text-gray-400">{memberLabel(member)} ({member.role || "unknown role"})</p>)}</div>}
              </div>

              <div className="space-y-2 rounded border border-gray-800 p-3">
                <h5 className="text-xs font-bold text-white">Pending Invitations</h5>
                {selectedOrg.invitations.filter(invitation => invitation.status === "pending").map(invitation => <div key={invitation.id} className="flex items-center justify-between gap-2 border-t border-gray-800 py-2 text-xs"><span>{invitation.email} ({invitation.role})</span><button type="button" onClick={() => perform(`invite:${invitation.id}`, {action: "cancel_invitation", orgId: selectedOrg.id, targetId: invitation.id}, "Cancel this invitation?")} className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600">Cancel</button></div>)}
                {!selectedOrg.invitations.some(invitation => invitation.status === "pending") && <p className="text-xs text-gray-500">No pending invitations.</p>}
              </div>
            </>
          )}

          <div className="space-y-2 rounded border border-gray-800 p-3">
            <h5 className="text-xs font-bold text-white">Stale Access Requests</h5>
            {staleRequests.map(request => <div key={request.id} className="flex items-center justify-between gap-2 border-t border-gray-800 py-2 text-xs"><span>{request.email || request.uid || request.id} ({request.orgId || "no org"})</span><button type="button" onClick={() => perform(`request:${request.id}`, {action: "archive_access_request", targetId: request.id, note: promptCleanupNote()}, "Archive this access request? This will not delete data.")} className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600">Archive</button></div>)}
            {staleRequests.length === 0 && <p className="text-xs text-gray-500">No pending requests older than 14 days.</p>}
          </div>

          <div className="space-y-2 rounded border border-gray-800 p-3">
            <h5 className="text-xs font-bold text-white flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-400" /> Duplicate Org Review</h5>
            {inventory.duplicateGroups.map(group => <div key={group.id} className="border-t border-gray-800 pt-2">
              <p className="text-[10px] font-semibold text-amber-300">{group.reason}</p>
              {group.orgs.map(org => <div key={org.id} className="mt-2 flex items-start justify-between gap-2 text-[10px]">
                <span><strong>{org.name}</strong> <span className="font-mono">{org.id}</span><br />Contact {org.ownerEmail || org.companyProfile?.contacts?.primary?.email || org.ownerUid || "-"} · Created {displayDate(org.createdAt)}<br />Tier {org.tier || "-"} · Status {org.status || "-"} · Members {org.memberCount} · Assessments {org.assessmentCount} · Evidence {org.evidenceCount}</span>
                <button type="button" onClick={() => perform(`duplicate:${org.id}`, {action: "update_org_status", orgId: org.id, updates: {status: "archived"}, note: promptCleanupNote()}, "Archive this duplicate organization? This will not delete data.")} className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600">Archive</button>
              </div>)}
            </div>)}
            {inventory.duplicateGroups.length === 0 && <p className="text-xs text-gray-500">No duplicate org groups detected.</p>}
          </div>
        </div>
      )}
    </section>
  );
};
