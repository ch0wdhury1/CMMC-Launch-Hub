import React, { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, BarChart3, FileText, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { formatActivityDate } from "../src/activityLog";
import { loadSystemHealthData, type SystemHealthData } from "../src/systemHealth";

type Props = {
  isSuperAdmin: boolean;
  onActivityCenterClick: () => void;
};

const cardClass = "rounded-lg border bg-white p-4 shadow-sm";
const labelClass = "text-xs font-semibold uppercase text-gray-500";

const displayNumber = (value: number | null) => value === null ? "Unavailable" : value.toLocaleString();

const alertTone = (level: string) => {
  if (level === "Critical") return "border-red-200 bg-red-50 text-red-800";
  if (level === "Warning") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-blue-200 bg-blue-50 text-blue-800";
};

const SummaryCard = ({label, value}: {label: string; value: number | null}) => (
  <div className={cardClass}>
    <div className={labelClass}>{label}</div>
    <div className="mt-2 text-2xl font-bold text-gray-900">{displayNumber(value)}</div>
  </div>
);

const InlineMetric = ({label, value}: {label: string; value: number | null}) => (
  <div className="rounded bg-gray-50 p-3">
    <div className={labelClass}>{label}</div>
    <div className="mt-2 text-xl font-bold text-gray-900">{displayNumber(value)}</div>
  </div>
);

export const SystemHealthDashboard: React.FC<Props> = ({isSuperAdmin, onActivityCenterClick}) => {
  const [data, setData] = useState<SystemHealthData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [orgStatusFilter, setOrgStatusFilter] = useState<"all" | "active" | "inactive" | "archived">("all");

  const load = async () => {
    if (!isSuperAdmin) return;
    setLoading(true);
    setError("");
    try {
      setData(await loadSystemHealthData());
    } catch (loadError) {
      console.error("[system-health] load failed", loadError);
      setError(loadError instanceof Error ? loadError.message : "Unable to load system health.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [isSuperAdmin]);

  const filteredOrgs = useMemo(() => {
    if (!data) return [];
    if (orgStatusFilter === "all") return data.organizations;
    return data.organizations.filter(org => String(org.status || "").toLowerCase() === orgStatusFilter);
  }, [data, orgStatusFilter]);

  if (!isSuperAdmin) {
    return <section className="rounded-lg border bg-white p-6 text-sm text-red-700">System Health access requires SuperAdmin.</section>;
  }

  if (loading && !data) {
    return <div className="flex items-center rounded-lg border bg-white p-6 text-sm text-gray-600"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading system health...</div>;
  }

  return <div className="space-y-6 animate-fadeIn">
    <section className="rounded-lg border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-900"><ShieldCheck className="h-6 w-6 text-blue-700" /> System Health</h2>
          <p className="mt-1 text-sm text-gray-600">SuperAdmin pilot monitoring for platform health, adoption, evidence processing, reporting, and alerts.</p>
          {data && <p className="mt-1 text-xs text-gray-500">Last refreshed {data.generatedAt.toLocaleString()}</p>}
        </div>
        <button type="button" onClick={load} disabled={loading} className="inline-flex items-center rounded border px-3 py-2 text-sm font-semibold text-gray-700 disabled:opacity-50"><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh</button>
      </div>
      {error && <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </section>

    {data && <>
      <section>
        <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-gray-900"><BarChart3 className="h-5 w-5 text-blue-700" /> Health Summary</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <SummaryCard label="Active Organizations" value={data.summary.activeOrganizations} />
          <SummaryCard label="Active Users" value={data.summary.activeUsers} />
          <SummaryCard label="Pending Registrations" value={data.summary.pendingRegistrations} />
          <SummaryCard label="Pending Invitations" value={data.summary.pendingInvitations} />
          <SummaryCard label="Pending Tier Upgrades" value={data.summary.pendingTierUpgrades} />
          <SummaryCard label="Evidence Uploads (Last 30 Days)" value={data.summary.evidenceUploadsLast30Days} />
          <SummaryCard label="Reports Generated (Last 30 Days)" value={data.summary.reportsGeneratedLast30Days} />
          <SummaryCard label="Password Reset Requests" value={data.summary.passwordResetRequests} />
          <SummaryCard label="Storage Objects Count" value={data.summary.storageObjectsCount} />
          <SummaryCard label="Recent Activity Count (Last 24 Hours)" value={data.summary.recentActivityLast24Hours} />
        </div>
      </section>

      <section className={cardClass}>
        <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900"><Activity className="h-5 w-5 text-blue-700" /> OCR Health</h3>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <InlineMetric label="OCR Success Count (30 Days)" value={data.ocr.successCount30Days} />
          <InlineMetric label="OCR Failure Count (30 Days)" value={data.ocr.failureCount30Days} />
          <InlineMetric label="Success Rate %" value={data.ocr.successRate} />
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="p-3">Date</th><th className="p-3">Organization</th><th className="p-3">Filename</th><th className="p-3">Status</th></tr></thead>
            <tbody>{data.ocr.recentFailures.length === 0 ? <tr><td colSpan={4} className="p-4 text-center text-gray-500">No recent OCR failures.</td></tr> : data.ocr.recentFailures.map((failure, index) => <tr key={`${failure.filename}:${index}`} className="border-t">
              <td className="p-3 whitespace-nowrap">{formatActivityDate(failure.date)}</td>
              <td className="p-3">{failure.organization}</td>
              <td className="p-3 break-all">{failure.filename}</td>
              <td className="p-3 font-mono text-xs">{failure.status}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className={cardClass}>
        <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900"><FileText className="h-5 w-5 text-blue-700" /> Reporting Health</h3>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <InlineMetric label="Executive Reports Generated" value={data.reporting.executiveReports} />
          <InlineMetric label="POA&M Reports Generated" value={data.reporting.poamReports} />
          <InlineMetric label="Other Reports Generated" value={data.reporting.otherReports} />
        </div>
        <dl className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div><dt className={labelClass}>Last Generated Report</dt><dd className="mt-1 text-sm text-gray-800">{data.reporting.lastGeneratedReport ? `${data.reporting.lastGeneratedReport.targetLabel || data.reporting.lastGeneratedReport.targetId || "Report"} at ${formatActivityDate(data.reporting.lastGeneratedReport.createdAt)}` : "No reports generated"}</dd></div>
          <div><dt className={labelClass}>Most Active Organization</dt><dd className="mt-1 text-sm text-gray-800">{data.reporting.mostActiveOrganization}</dd></div>
        </dl>
      </section>

      <section className={cardClass}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-gray-900">Organization Health</h3>
          <div className="flex gap-2">{(["all", "active", "inactive", "archived"] as const).map(filter => <button key={filter} type="button" onClick={() => setOrgStatusFilter(filter)} className={`rounded border px-3 py-1 text-xs font-semibold capitalize ${orgStatusFilter === filter ? "border-blue-700 bg-blue-700 text-white" : "border-gray-200 bg-white text-gray-700"}`}>{filter === "all" ? "All" : filter}</button>)}</div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="p-3">Organization</th><th className="p-3">Tier</th><th className="p-3">Users</th><th className="p-3">Last Activity</th><th className="p-3">Evidence Count</th><th className="p-3">Reports Generated</th><th className="p-3">Status</th></tr></thead>
            <tbody>{filteredOrgs.length === 0 ? <tr><td colSpan={7} className="p-4 text-center text-gray-500">No organizations match this filter.</td></tr> : filteredOrgs.map(org => <tr key={org.id} className="border-t">
              <td className="p-3"><div>{org.name}</div><div className="text-xs text-gray-500">{org.id}</div></td>
              <td className="p-3">{org.tier}</td>
              <td className="p-3">{org.activeUserCount}</td>
              <td className="p-3 whitespace-nowrap">{org.lastActivityAt ? formatActivityDate(org.lastActivityAt) : "No activity recorded"}</td>
              <td className="p-3">{org.evidenceCount}</td>
              <td className="p-3">{org.reportCount}</td>
              <td className="p-3 capitalize">{org.status}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className={cardClass}>
        <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900"><AlertTriangle className="h-5 w-5 text-amber-600" /> System Alerts</h3>
        <div className="mt-4 space-y-2">{data.alerts.length === 0 ? <p className="text-sm text-gray-500">No operational alerts detected.</p> : data.alerts.map((alert, index) => <div key={`${alert.title}:${index}`} className={`rounded border px-3 py-2 text-sm ${alertTone(alert.level)}`}><strong>{alert.level}: {alert.title}</strong><div>{alert.detail}</div></div>)}</div>
      </section>

      <section className={cardClass}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-gray-900">Recent Activity (Last 20)</h3>
          <button type="button" onClick={onActivityCenterClick} className="rounded border px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50">View Full Activity Center</button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="p-3">Created</th><th className="p-3">Organization</th><th className="p-3">Action</th><th className="p-3">Summary</th></tr></thead>
            <tbody>{data.recentActivity.length === 0 ? <tr><td colSpan={4} className="p-4 text-center text-gray-500">No recent activity recorded.</td></tr> : data.recentActivity.map(event => <tr key={event.id} className="border-t">
              <td className="p-3 whitespace-nowrap">{formatActivityDate(event.createdAt)}</td>
              <td className="p-3">{event.orgName || event.orgId}</td>
              <td className="p-3 font-mono text-xs">{event.action}</td>
              <td className="p-3">{event.summary}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </section>
    </>}
  </div>;
};
