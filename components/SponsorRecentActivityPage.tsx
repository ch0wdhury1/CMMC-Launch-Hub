import React, { useEffect, useMemo, useState } from "react";
import { formatActivityDate, loadActivityEvents, type ActivityEvent } from "../src/activityLog";
import { loadPilotOversightData } from "../src/pilotOversight";

const categoryForAction = (action: string) => {
  if (action.startsWith("evidence.")) return "Evidence";
  if (action.startsWith("assessment.")) return "Assessment";
  if (action.startsWith("report.")) return "Reporting";
  if (action.startsWith("invitation.") || action.startsWith("user.")) return "Users";
  if (action.startsWith("tier.")) return "Tier";
  if (action.startsWith("profile.")) return "Profile";
  if (action.startsWith("login.")) return "Authentication";
  return "Activity";
};

const safeSummary = (event: ActivityEvent) => {
  const action = String(event.action || "");
  if (action.startsWith("evidence.")) return action === "evidence.uploaded" ? "Evidence uploaded" : "Evidence status changed";
  if (action === "assessment.saved") return "Assessment progress saved";
  return event.summary || action;
};

export const SponsorRecentActivityPage: React.FC = () => {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [data, activity] = await Promise.all([
          loadPilotOversightData(),
          loadActivityEvents({ isSuperAdmin: true }),
        ]);
        const allowedOrgIds = new Set(data.organizations.map(org => org.id));
        if (!cancelled) setEvents(activity.filter(event => allowedOrgIds.has(event.orgId)));
      } catch (loadError) {
        console.error("[sponsor-activity] load failed", loadError);
        if (!cancelled) setError("Recent activity is unavailable.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(events.length / pageSize));
  const rows = useMemo(() => events.slice((page - 1) * pageSize, page * pageSize), [events, page]);

  return (
    <div className="space-y-4">
      <section className="rounded-lg border bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase text-blue-700">Sponsor Observer</p>
        <h1 className="text-2xl font-bold text-gray-900">Recent Activity</h1>
        <p className="mt-1 text-sm text-gray-600">Metadata-level pilot activity only. Evidence contents, filenames, notes, and remediation details are not shown.</p>
      </section>
      {error && <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}</div>}
      <section className="rounded-lg border bg-white shadow-sm">
        <div className="overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr><th className="p-3">Date/Time</th><th className="p-3">Organization</th><th className="p-3">User</th><th className="p-3">Activity</th><th className="p-3">Category</th><th className="p-3">Details / Summary</th></tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="p-5 text-sm text-gray-500">Loading recent activity...</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={6} className="p-5 text-sm text-gray-500">No recent pilot activity found.</td></tr>}
              {!loading && rows.map(event => (
                <tr key={event.id} className="border-t">
                  <td className="p-3">{formatActivityDate(event.createdAt)}</td>
                  <td className="p-3">{event.orgName || event.orgId}</td>
                  <td className="p-3">{event.actorName || event.actorEmail || "System"}</td>
                  <td className="p-3">{event.action}</td>
                  <td className="p-3">{categoryForAction(String(event.action || ""))}</td>
                  <td className="p-3">{safeSummary(event)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t p-3 text-sm">
          <span className="text-gray-600">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage(current => Math.max(1, current - 1))} className="rounded border px-3 py-1 font-semibold text-gray-700 disabled:opacity-40">Previous</button>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage(current => Math.min(totalPages, current + 1))} className="rounded border px-3 py-1 font-semibold text-gray-700 disabled:opacity-40">Next</button>
          </div>
        </div>
      </section>
    </div>
  );
};

