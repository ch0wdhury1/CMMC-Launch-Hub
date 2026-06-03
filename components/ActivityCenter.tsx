import React, { useEffect, useMemo, useState } from "react";
import { Download, Loader2, RefreshCw } from "lucide-react";
import {
  ACTIVITY_ACTIONS,
  formatActivityDate,
  loadActivityEvents,
  type ActivityEvent,
} from "../src/activityLog";

type Props = {
  orgId: string | null;
  isSuperAdmin: boolean;
  canView: boolean;
};

const eventTime = (event: ActivityEvent) => {
  const date = event.createdAt?.toDate ? event.createdAt.toDate() : new Date(event.createdAt || 0);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

const csvValue = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;

export const ActivityCenter: React.FC<Props> = ({orgId, isSuperAdmin, canView}) => {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [orgFilter, setOrgFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  const load = async () => {
    if (!canView) return;
    setLoading(true);
    setError("");
    try {
      setEvents(await loadActivityEvents({orgId, isSuperAdmin}));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load activity events.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [orgId, isSuperAdmin, canView]);

  const organizations = useMemo(() => Array.from(new Map<string, string>(events.map(event => [event.orgId, event.orgName || event.orgId])).entries())
    .sort((a, b) => a[1].localeCompare(b[1])), [events]);
  const actions = useMemo(() => Array.from(new Set([...ACTIVITY_ACTIONS, ...events.map(event => event.action)]))
    .sort((a, b) => a.localeCompare(b)), [events]);

  const filtered = useMemo(() => {
    const start = startDate ? new Date(`${startDate}T00:00:00`).getTime() : null;
    const end = endDate ? new Date(`${endDate}T23:59:59`).getTime() : null;
    return events.filter(event => {
      const created = eventTime(event);
      if (start !== null && created < start) return false;
      if (end !== null && created > end) return false;
      if (orgFilter && event.orgId !== orgFilter) return false;
      if (actionFilter && event.action !== actionFilter) return false;
      return true;
    });
  }, [actionFilter, endDate, events, orgFilter, startDate]);

  const exportCsv = () => {
    const header = ["Created", "Organization", "Org ID", "Action", "Actor", "Actor Email", "Target", "Summary"];
    const rows = filtered.map(event => [
      formatActivityDate(event.createdAt),
      event.orgName || event.orgId,
      event.orgId,
      event.action,
      event.actorName || event.actorUid,
      event.actorEmail || "",
      event.targetLabel || event.targetId || "",
      event.summary,
    ]);
    const csv = [header, ...rows].map(row => row.map(csvValue).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], {type: "text/csv;charset=utf-8"}));
    const link = document.createElement("a");
    link.href = url;
    link.download = `cmmc-launch-hub-activity-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!canView) {
    return <section className="rounded-lg border bg-white p-6 text-sm text-red-700">Activity Center access requires OrgAdmin, OrgOwner, or SuperAdmin.</section>;
  }

  return <div className="space-y-5 animate-fadeIn">
    <section className="rounded-lg border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{isSuperAdmin ? "SuperAdmin Activity Center" : "OrgAdmin Activity Center"}</h2>
          <p className="mt-1 text-sm text-gray-600">{isSuperAdmin ? "All pilot organization activity." : "Activity for your organization only."}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={load} disabled={loading} className="inline-flex items-center rounded border px-3 py-2 text-sm font-semibold text-gray-700 disabled:opacity-50"><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh</button>
          <button type="button" onClick={exportCsv} disabled={filtered.length === 0} className="inline-flex items-center rounded bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Download className="mr-2 h-4 w-4" /> Export CSV</button>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-4">
        <label className="text-xs font-semibold uppercase text-gray-500">Start Date<input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} className="mt-1 w-full rounded border px-3 py-2 text-sm font-normal normal-case text-gray-900" /></label>
        <label className="text-xs font-semibold uppercase text-gray-500">End Date<input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} className="mt-1 w-full rounded border px-3 py-2 text-sm font-normal normal-case text-gray-900" /></label>
        <label className="text-xs font-semibold uppercase text-gray-500">Organization<select value={orgFilter} onChange={event => setOrgFilter(event.target.value)} disabled={!isSuperAdmin} className="mt-1 w-full rounded border bg-white px-3 py-2 text-sm font-normal normal-case text-gray-900"><option value="">All visible organizations</option>{organizations.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        <label className="text-xs font-semibold uppercase text-gray-500">Action<select value={actionFilter} onChange={event => setActionFilter(event.target.value)} className="mt-1 w-full rounded border bg-white px-3 py-2 text-sm font-normal normal-case text-gray-900"><option value="">All actions</option>{actions.map(action => <option key={action} value={action}>{action}</option>)}</select></label>
      </div>
      {error && <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </section>

    <section className="rounded-lg border bg-white shadow-sm">
      <div className="border-b p-4 text-sm text-gray-600">{filtered.length} event{filtered.length === 1 ? "" : "s"} shown</div>
      {loading ? <div className="flex items-center p-4 text-sm text-gray-600"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading activity...</div> :
      filtered.length === 0 ? <p className="p-6 text-center text-sm text-gray-500">No activity matches the current filters.</p> :
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="p-3">Created</th><th className="p-3">Organization</th><th className="p-3">Action</th><th className="p-3">Actor</th><th className="p-3">Target</th><th className="p-3">Summary</th></tr></thead>
          <tbody>{filtered.map(event => <tr key={event.id} className="border-t align-top">
            <td className="p-3 whitespace-nowrap">{formatActivityDate(event.createdAt)}</td>
            <td className="p-3"><div>{event.orgName || event.orgId}</div><div className="text-xs text-gray-500">{event.orgId}</div></td>
            <td className="p-3 font-mono text-xs">{event.action}</td>
            <td className="p-3"><div>{event.actorName || event.actorUid}</div><div className="text-xs text-gray-500">{event.actorEmail}</div></td>
            <td className="p-3">{event.targetLabel || event.targetId || "-"}</td>
            <td className="p-3">{event.summary}</td>
          </tr>)}</tbody>
        </table>
      </div>}
    </section>
  </div>;
};
