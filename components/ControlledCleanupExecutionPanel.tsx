import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckSquare, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import type { CleanupAuditResult } from "../types";
import { runCleanupAudit } from "../src/cleanupAudit";
import {
  CleanupControlAction,
  loadCleanupControlsInventory,
  runCleanupControlAction,
  type CleanupControlsInventory,
} from "../src/cleanupControls";

const BRUCE_ORG_IDS = [
  "org_bruce_inc", "org_bruce_inc_8e0i", "org_bruce_inc_99oz", "org_bruce_inc_e05f",
  "org_bruce_inc_fpmg", "org_bruce_inc_rz2f", "org_bruce_inc_whji", "org_bruce_inc_wnrv",
];
const phaseNote = "Archived during Phase 23C duplicate org cleanup";
const staleRequestNote = "Archived during Phase 23C stale request cleanup";
const dateValue = (value: any) => {
  if (!value) return "-";
  const date = value?._seconds ? new Date(value._seconds * 1000) : new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toISOString().slice(0, 10);
};
const isStale = (value: any) => {
  if (!value) return false;
  const date = value?._seconds ? new Date(value._seconds * 1000) : new Date(value);
  return !Number.isNaN(date.getTime()) && Date.now() - date.getTime() > 14 * 24 * 60 * 60 * 1000;
};
export const ControlledCleanupExecutionPanel: React.FC = () => {
  const [inventory, setInventory] = useState<CleanupControlsInventory | null>(null);
  const [backupConfirmed, setBackupConfirmed] = useState(false);
  const [primaryOrgConfirmed, setPrimaryOrgConfirmed] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState("cyber_blue_star");
  const [bruceKeepId, setBruceKeepId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [previousAudit, setPreviousAudit] = useState<CleanupAuditResult | null>(null);
  const [latestAudit, setLatestAudit] = useState<CleanupAuditResult | null>(null);
  const [orgRepair, setOrgRepair] = useState({status: "active", tier: "COMM_L2", subscriptionStatus: "active", legalName: "", primaryContactEmail: ""});

  const selectedOrg = useMemo(() => inventory?.orgs.find(org => org.id === selectedOrgId) || null, [inventory, selectedOrgId]);
  const bruceOrgs = useMemo(() => (inventory?.orgs || []).filter(org => BRUCE_ORG_IDS.includes(org.id)), [inventory]);
  const staleRequests = useMemo(() => (inventory?.accessRequests || []).filter(request => request.status === "pending" && isStale(request.createdAt)), [inventory]);
  const staleInvitations = useMemo(() => (inventory?.orgs || []).flatMap(org => org.invitations.filter(invitation => invitation.status === "pending" && isStale(invitation.invitedAt)).map(invitation => ({...invitation, orgId: org.id}))), [inventory]);

  useEffect(() => {
    if (!selectedOrg) return;
    setOrgRepair({
      status: selectedOrg.status || "active",
      tier: selectedOrg.tier || (selectedOrg.id === "cyber_blue_star" ? "COMM_L2" : "COMM_L1"),
      subscriptionStatus: selectedOrg.subscriptionStatus || "active",
      legalName: selectedOrg.companyProfile?.legalName || selectedOrg.name || (selectedOrg.id === "cyber_blue_star" ? "Cyber Blue Star" : ""),
      primaryContactEmail: selectedOrg.companyProfile?.contacts?.primary?.email || selectedOrg.ownerEmail || "",
    });
  }, [selectedOrg]);

  const refresh = async () => {
    setIsLoading(true);
    setError("");
    try {
      const next = await loadCleanupControlsInventory();
      setInventory(next);
      if (!next.orgs.some(org => org.id === selectedOrgId)) setSelectedOrgId(next.orgs[0]?.id || "");
    } catch (loadError) {
      console.warn("[controlled-cleanup] inventory failed", loadError);
      setError(loadError instanceof Error ? loadError.message : "Unable to load cleanup inventory.");
    } finally {
      setIsLoading(false);
    }
  };

  const execute = async (key: string, action: CleanupControlAction, confirmation: string) => {
    if (!backupConfirmed) return;
    if (!window.confirm(confirmation)) return;
    setPending(key);
    setError("");
    setSuccess("");
    try {
      await runCleanupControlAction({...action, cleanupPhase: "23C"});
      setSuccess("Cleanup action completed and logged.");
      await refresh();
    } catch (actionError) {
      console.warn("[controlled-cleanup] action failed", actionError);
      setError(actionError instanceof Error ? actionError.message : "Cleanup action failed.");
    } finally {
      setPending("");
    }
  };

  const rerunAudit = async () => {
    setPending("audit");
    setError("");
    try {
      const result = await runCleanupAudit();
      if (!previousAudit) setPreviousAudit(result);
      setLatestAudit(result);
    } catch (auditError) {
      console.warn("[controlled-cleanup] audit failed", auditError);
      setError("Cleanup audit failed.");
    } finally {
      setPending("");
    }
  };

  const section = "space-y-2 rounded border border-gray-800 p-3";
  const actionButton = "px-2 py-1 bg-gray-700 text-[10px] font-semibold rounded hover:bg-gray-600 disabled:opacity-50";
  const input = "mt-1 w-full bg-gray-800 border border-gray-700 rounded p-2 text-xs";

  return (
    <section className="space-y-3">
      <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Controlled Cleanup Execution</h4>
      <div className="rounded border border-amber-900/80 bg-amber-950/30 p-3 text-[11px] text-amber-100 space-y-1">
        <p className="font-semibold flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Phase 23C preserves data and recovery history</p>
        <p>No hard deletes, Auth deletion, Storage deletion, or automatic bulk cleanup. Every enabled action requires confirmation and writes an immutable cleanup activity entry.</p>
      </div>
      <button type="button" onClick={refresh} disabled={isLoading} className="flex items-center px-3 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-md hover:bg-indigo-500 disabled:opacity-60">
        {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
        {isLoading ? "Loading cleanup execution..." : inventory ? "Refresh Execution Inventory" : "Load Cleanup Execution"}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {success && <p className="text-xs text-emerald-400">{success}</p>}
      {inventory && (
        <div className="space-y-4">
          <div className={section}>
            <h5 className="text-xs font-bold text-white flex items-center gap-2"><CheckSquare className="h-4 w-4" /> Pre-cleanup Backup Confirmation</h5>
            <label className="flex gap-2 text-xs text-gray-300"><input type="checkbox" checked={backupConfirmed} onChange={event => setBackupConfirmed(event.target.checked)} /> I have exported a current backup and understand this cleanup will archive/inactivate records but not delete data.</label>
          </div>

          <div className={section}>
            <h5 className="text-xs font-bold text-white">Primary Org Confirmation</h5>
            <p className="text-xs text-gray-300"><strong>cyber_blue_star</strong> is protected by the backend and must remain active. SuperAdmin users cannot be disabled or marked inactive.</p>
            <label className="flex gap-2 text-xs text-gray-300"><input type="checkbox" checked={primaryOrgConfirmed} onChange={event => setPrimaryOrgConfirmed(event.target.checked)} /> I confirmed the Cyber Blue Star / SuperAdmin baseline.</label>
          </div>

          <div className={section}>
            <h5 className="text-xs font-bold text-white">Duplicate Org Cleanup: Bruce Inc</h5>
            <label className="block text-[10px] text-gray-400">Keep / review org<select value={bruceKeepId} onChange={event => setBruceKeepId(event.target.value)} className={input}><option value="">Select one org to keep or review</option>{bruceOrgs.map(org => <option key={org.id} value={org.id}>{org.id}</option>)}</select></label>
            {bruceOrgs.map(org => <div key={org.id} className="flex items-start justify-between gap-2 border-t border-gray-800 py-2 text-[10px]">
              <span><strong>{org.id}</strong> {org.name}<br />Tier {org.tier || "-"} · Status {org.status || "-"} · Members {org.memberCount} · Assessments {org.assessmentCount} · Evidence {org.evidenceCount} · Created {dateValue(org.createdAt)}<br />Note: {org.cleanupNote || "-"}</span>
              <button type="button" disabled={!backupConfirmed || !bruceKeepId || org.id === bruceKeepId || org.status === "archived"} onClick={() => execute(`duplicate:${org.id}`, {action: "update_org_status", orgId: org.id, updates: {status: "archived"}, note: phaseNote}, `Archive ${org.id}? This will not delete data.`)} className={actionButton}>{org.id === bruceKeepId ? "Keep / Review" : "Archive"}</button>
            </div>)}
            {bruceOrgs.length === 0 && <p className="text-xs text-gray-500">No known Bruce Inc duplicate org documents loaded.</p>}
          </div>

          <div className={section}>
            <h5 className="text-xs font-bold text-white">Stale Request Cleanup</h5>
            {staleRequests.map(request => <div key={request.id} className="flex items-center justify-between gap-2 border-t border-gray-800 py-2 text-[10px]"><span>Request {request.id} · Org {request.orgId || "-"} · User {request.uid || request.requestedByUid || "-"} · Created {dateValue(request.createdAt)} · Status {request.status}</span><button disabled={!backupConfirmed} onClick={() => execute(`request:${request.id}`, {action: "archive_access_request", targetId: request.id, note: staleRequestNote}, "Archive this stale access request? This will not delete data.")} className={actionButton}>Archive</button></div>)}
            {staleRequests.length === 0 && <p className="text-xs text-gray-500">No stale pending access requests older than 14 days.</p>}
            {staleInvitations.map(invitation => <div key={`${invitation.orgId}:${invitation.id}`} className="flex items-center justify-between gap-2 border-t border-gray-800 py-2 text-[10px]"><span>Invitation {invitation.email || invitation.id} · Org {invitation.orgId} · Invited {dateValue(invitation.invitedAt)}</span><button disabled={!backupConfirmed} onClick={() => execute(`invitation:${invitation.id}`, {action: "cancel_invitation", orgId: invitation.orgId, targetId: invitation.id}, "Cancel this stale invitation?")} className={actionButton}>Cancel</button></div>)}
          </div>

          <div className={section}>
            <h5 className="text-xs font-bold text-white">Orphan User / Member Cleanup</h5>
            {inventory.orphanUsers.map(user => <div key={user.id} className="flex items-center justify-between gap-2 border-t border-gray-800 py-2 text-[10px]"><span>{user.displayName || user.name || user.email || user.id} · Org {user.orgId || "none"} · Status {user.status || "-"}</span><button disabled={!backupConfirmed} onClick={() => execute(`user:${user.id}`, {action: "disable_orphan_user", userId: user.id, updates: {status: "inactive"}, note: "Marked inactive during Phase 23C orphan user cleanup"}, "Mark this orphan user inactive? This will not delete the user document or Auth account.")} className={actionButton}>Mark Inactive</button></div>)}
            {inventory.orphanUsers.length === 0 && <p className="text-xs text-gray-500">No orphan non-SuperAdmin users detected.</p>}
          </div>

          <div className={section}>
            <h5 className="text-xs font-bold text-white">Essential Org Field & Membership Repair</h5>
            <select value={selectedOrgId} onChange={event => setSelectedOrgId(event.target.value)} className={input}>{inventory.orgs.map(org => <option key={org.id} value={org.id}>{org.name} ({org.id})</option>)}</select>
            {selectedOrg && <>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[10px] text-gray-400">Status<select value={orgRepair.status} onChange={event => setOrgRepair(current => ({...current, status: event.target.value}))} className={input}><option>active</option><option>inactive</option><option>archived</option></select></label>
                <label className="text-[10px] text-gray-400">Tier<select value={orgRepair.tier} onChange={event => setOrgRepair(current => ({...current, tier: event.target.value}))} className={input}><option>SPONSORED</option><option>COMM_L1</option><option>COMM_L2</option></select></label>
                <label className="text-[10px] text-gray-400">Subscription<select value={orgRepair.subscriptionStatus} onChange={event => setOrgRepair(current => ({...current, subscriptionStatus: event.target.value}))} className={input}><option>active</option><option>trial</option><option>expired</option><option>cancelled</option></select></label>
                <label className="text-[10px] text-gray-400">Legal Name<input value={orgRepair.legalName} onChange={event => setOrgRepair(current => ({...current, legalName: event.target.value}))} className={input} /></label>
                <label className="text-[10px] text-gray-400 col-span-2">Primary Contact Email<input type="email" value={orgRepair.primaryContactEmail} onChange={event => setOrgRepair(current => ({...current, primaryContactEmail: event.target.value}))} className={input} /></label>
              </div>
              <button disabled={!backupConfirmed || (selectedOrg.id === "cyber_blue_star" && !primaryOrgConfirmed)} onClick={() => execute(`repair-org:${selectedOrg.id}`, {action: "repair_org_fields", orgId: selectedOrg.id, updates: orgRepair, note: "Reviewed during Phase 23C essential org field repair"}, "Repair these retained organization fields? This uses a merge update and will be logged.")} className={actionButton}>Repair Org Fields</button>
              <div className="mt-2">
                <p className="text-[10px] font-semibold text-gray-300">Current membership records</p>
                {selectedOrg.members.map(member => <div key={member.id} className="flex items-center justify-between gap-2 border-t border-gray-800 py-2 text-[10px]"><span>{member.email || member.name || member.id} · {member.role || "viewer"} · {member.status || "-"} · Active {String(member.active !== false)}</span><button disabled={!backupConfirmed} onClick={() => execute(`repair-member:${member.id}`, {action: "update_member", orgId: selectedOrg.id, userId: member.uid || member.id, updates: {status: "active", active: true, role: member.role || "viewer"}, note: "Repaired during Phase 23C membership review"}, "Repair this member as active? This will not create or delete a user account.")} className={actionButton}>Repair Active</button></div>)}
                {selectedOrg.legacyMembers.length > 0 && <><p className="text-[10px] font-semibold text-amber-300">Legacy membership references: review only</p>{selectedOrg.legacyMembers.map(member => <p key={member.id} className="text-[10px] text-gray-400">{member.email || member.name || member.id} · {member.role || "-"} · {member.status || "-"}</p>)}</>}
              </div>
            </>}
          </div>

          <div className={section}>
            <h5 className="text-xs font-bold text-white flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-400" /> Manual Review Only</h5>
            {(inventory.orgs.flatMap(org => org.evidenceIssues.map(issue => ({...issue, orgId: org.id})))).map(issue => <p key={`${issue.orgId}:${issue.id}`} className="text-[10px] text-amber-200">Evidence {issue.id} · Org {issue.orgId}: {issue.issue}</p>)}
            {(inventory.orgs.flatMap(org => org.assessmentWarnings.map(issue => ({...issue, orgId: org.id})))).map(issue => <p key={`${issue.orgId}:${issue.id}`} className="text-[10px] text-amber-200">Assessment {issue.id} · Org {issue.orgId}: {issue.issue}</p>)}
          </div>

          <div className={section}>
            <h5 className="text-xs font-bold text-white">Post-cleanup Audit</h5>
            <button onClick={rerunAudit} disabled={pending === "audit"} className={actionButton}>{pending === "audit" ? "Running cleanup audit..." : "Re-run Cleanup Audit"}</button>
            {latestAudit && <div className="grid grid-cols-2 gap-2 text-[10px]"><p>Previous findings: {previousAudit?.totalFindings ?? "-"}</p><p>Current findings: {latestAudit.totalFindings}</p><p>High: {previousAudit?.highCount ?? "-"} to {latestAudit.highCount}</p><p>Medium: {previousAudit?.mediumCount ?? "-"} to {latestAudit.mediumCount}</p><p>Low: {previousAudit?.lowCount ?? "-"} to {latestAudit.lowCount}</p><p>Do not touch: {latestAudit.doNotTouchCount}</p><p>Needs review: {latestAudit.needsReviewCount}</p></div>}
          </div>
        </div>
      )}
    </section>
  );
};
