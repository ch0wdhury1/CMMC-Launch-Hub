import React, { useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, Building2, Eye, FileText, MessageSquare, RefreshCcw, ShieldCheck, Users, X } from "lucide-react";
import { formatActivityDate } from "../src/activityLog";
import { formatPilotDate, loadPilotOversightData, type PilotOrgSummary, type PilotOversightData } from "../src/pilotOversight";
import { APP_VERSION_LABEL } from "../src/appVersion";

type Props = {
  canView: boolean;
  viewerLabel: "SuperAdmin" | "Pilot Observer";
  sponsorProgram?: string;
};

const SummaryCard = ({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ComponentType<{ className?: string }> }) => (
  <div className="rounded-lg border bg-white p-4 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-semibold uppercase text-gray-500">{label}</span>
      <Icon className="h-4 w-4 text-blue-700" />
    </div>
    <div className="mt-2 text-2xl font-bold text-gray-900">{value}</div>
  </div>
);

const DetailRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="rounded border bg-gray-50 p-3">
    <div className="text-xs font-semibold uppercase text-gray-500">{label}</div>
    <div className="mt-1 text-sm font-semibold text-gray-900">{value}</div>
  </div>
);

export const PilotDashboard: React.FC<Props> = ({ canView, viewerLabel, sponsorProgram }) => {
  const [data, setData] = useState<PilotOversightData | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<PilotOrgSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    if (!canView) return;
    setLoading(true);
    setError("");
    try {
      setData(await loadPilotOversightData());
    } catch (loadError) {
      console.error("[pilot-dashboard] load failed", loadError);
      setError("Pilot dashboard data is unavailable. Confirm oversight read access.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [canView]);

  const activeOrgs = useMemo(
    () => (data?.organizations || []).filter(org => String(org.status || "").toLowerCase() === "active"),
    [data]
  );

  if (!canView) {
    return (
      <section className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-900">
        <h1 className="text-xl font-bold">CMMC Pilot Dashboard</h1>
        <p className="mt-2 text-sm">Pilot oversight access is required.</p>
      </section>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      <section className="rounded-lg border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-blue-700">{viewerLabel} read-only oversight</p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">CMMC Pilot Dashboard</h1>
            <p className="mt-2 text-sm text-gray-600">{APP_VERSION_LABEL}</p>
            {viewerLabel === "Pilot Observer" && sponsorProgram ? <p className="mt-2 text-sm font-semibold text-blue-800">Sponsor Program: {sponsorProgram}</p> : null}
          </div>
          <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </section>

      {error && <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}</div>}
      {loading && <div className="rounded-lg border bg-white p-5 text-sm text-gray-600">Loading pilot dashboard...</div>}

      {data && (
        <>
          <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <SummaryCard label="Active Organizations" value={data.summary.activeOrganizations} icon={Building2} />
            <SummaryCard label="Total Pilot Users" value={data.summary.totalPilotUsers} icon={Users} />
            <SummaryCard label="Average Completion %" value={`${data.summary.averageCompletionPercent}%`} icon={BarChart3} />
            <SummaryCard label="Average SPRS Score" value={data.summary.averageSprsScore} icon={ShieldCheck} />
            <SummaryCard label="Evidence Uploaded" value={data.summary.evidenceUploaded} icon={FileText} />
            <SummaryCard label="Open POA&M Items" value={data.summary.openPoamItems} icon={FileText} />
            <SummaryCard label="Reports Generated" value={data.summary.reportsGenerated} icon={FileText} />
            <SummaryCard label="Feedback Items" value={data.summary.feedbackItems} icon={MessageSquare} />
          </section>

          <section className="rounded-lg border bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900">All Companies Progress Over Time</h2>
            <div className="mt-4 h-48 rounded border bg-gray-50 p-4">
              <div className="flex h-full items-end gap-4">
                {data.progressHistory.map(point => (
                  <div key={point.label} className="flex h-full flex-1 flex-col justify-end">
                    <div className="rounded-t bg-blue-600" style={{ height: `${Math.max(4, point.averageCompletionPercent)}%` }} />
                    <div className="mt-2 text-center text-xs font-semibold text-gray-600">{point.label}</div>
                  </div>
                ))}
              </div>
            </div>
            {!data.hasHistoricalSnapshots && <p className="mt-3 text-sm text-gray-500">Progress history will begin tracking from this release forward.</p>}
          </section>

          <section className="rounded-lg border bg-white shadow-sm">
            <div className="border-b p-4">
              <h2 className="text-lg font-bold text-gray-900">Active Orgs</h2>
              <p className="mt-1 text-sm text-gray-600">Read-only pilot organization health summary. Evidence contents are not shown.</p>
            </div>
            <div className="overflow-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="p-3">Company Name</th>
                    <th className="p-3">Town</th>
                    <th className="p-3">Starting Date</th>
                    <th className="p-3">Tier</th>
                    <th className="p-3">% Completed</th>
                    <th className="p-3">SPRS Score</th>
                    <th className="p-3">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {activeOrgs.map(org => (
                    <tr key={org.id} className="border-t">
                      <td className="p-3 font-semibold text-gray-900">{org.companyName}</td>
                      <td className="p-3">{[org.town, org.state].filter(Boolean).join(", ") || "Not provided"}</td>
                      <td className="p-3">{formatPilotDate(org.startingDate)}</td>
                      <td className="p-3">{org.tier}</td>
                      <td className="p-3">{org.completionPercent}%</td>
                      <td className="p-3">{org.sprsScore}</td>
                      <td className="p-3">
                        <button type="button" onClick={() => setSelectedOrg(org)} className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50">
                          <Eye className="h-3.5 w-3.5" /> Detail
                        </button>
                      </td>
                    </tr>
                  ))}
                  {activeOrgs.length === 0 && <tr><td colSpan={7} className="p-5 text-sm text-gray-500">No active organizations found.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-lg border bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900"><Activity className="h-5 w-5 text-blue-700" /> Recent Pilot Activity</h2>
            <div className="mt-3 grid gap-3">
              {data.recentActivity.slice(0, 8).map(event => (
                <div key={event.id} className="rounded border bg-gray-50 p-3 text-sm">
                  <div className="font-semibold text-gray-900">{event.summary || event.action}</div>
                  <div className="mt-1 text-xs text-gray-500">{event.orgName || event.orgId} - {formatActivityDate(event.createdAt)}</div>
                </div>
              ))}
              {data.recentActivity.length === 0 && <p className="text-sm text-gray-500">No recent pilot activity yet.</p>}
            </div>
          </section>
        </>
      )}

      {selectedOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelectedOrg(null)}>
          <div className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-5 shadow-xl" onClick={event => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{selectedOrg.companyName}</h2>
                <p className="mt-1 text-sm text-gray-600">{[selectedOrg.town, selectedOrg.state].filter(Boolean).join(", ") || "Location not provided"}</p>
              </div>
              <button type="button" onClick={() => setSelectedOrg(null)} title="Close detail" className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <DetailRow label="Starting Date" value={formatPilotDate(selectedOrg.startingDate)} />
              <DetailRow label="Tier" value={selectedOrg.tier} />
              <DetailRow label="Users Count" value={selectedOrg.usersCount} />
              <DetailRow label="Practices Completed" value={selectedOrg.practicesCompleted} />
              <DetailRow label="Practices Remaining" value={selectedOrg.practicesRemaining} />
              <DetailRow label="Evidence Count" value={selectedOrg.evidenceCount} />
              <DetailRow label="Open POA&M Count" value={selectedOrg.openPoamCount} />
              <DetailRow label="SSP Generated" value={selectedOrg.sspGenerated ? "Yes" : "No"} />
              <DetailRow label="POA&M Generated" value={selectedOrg.poamGenerated ? "Yes" : "No"} />
              <DetailRow label="Policy Generated" value={selectedOrg.policyGenerated ? "Yes" : "No"} />
              <DetailRow label="Last Activity" value={formatActivityDate(selectedOrg.lastActivity)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
