import React, { useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarClock, FileText, ShieldCheck, Users } from "lucide-react";
import { loadProgramAnalytics, type ProgramAnalyticsData } from "../src/programAnalytics";

type Props = {
  isSuperAdmin?: boolean;
};

type ProgramOverviewRow = {
  id: string;
  name: string;
  programCode: string;
  state?: string;
  sponsorName?: string;
  organizationsCount: number;
  totalUsers: number;
  averageCompletionPercent: number;
  averageSprsScore: number;
  evidenceCount: number;
  reportsGenerated: number;
  lastActivityDate: any;
};

const formatDate = (value: any) => {
  if (!value) return "Not provided";
  const date = value?.toDate ? value.toDate() : value?._seconds ? new Date(value._seconds * 1000) : new Date(value);
  return Number.isNaN(date.getTime()) ? "Not provided" : date.toLocaleDateString();
};

const KpiCard = ({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon: React.ComponentType<{ className?: string }> }) => (
  <div className="rounded-lg border bg-white p-4 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase text-gray-500">{label}</p>
        <div className="mt-2 text-2xl font-bold text-gray-900">{value}</div>
      </div>
      <span className="rounded-md bg-blue-50 p-2 text-blue-700"><Icon className="h-5 w-5" /></span>
    </div>
  </div>
);

const attentionClass = (flag: string) => {
  if (flag === "On Track") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (flag === "Reports Missing") return "bg-blue-50 text-blue-700 border-blue-200";
  if (flag === "Low Progress") return "bg-amber-50 text-amber-800 border-amber-200";
  return "bg-rose-50 text-rose-700 border-rose-200";
};

export const ProgramAnalyticsPage: React.FC<Props> = ({ isSuperAdmin = false }) => {
  const [data, setData] = useState<ProgramAnalyticsData | null>(null);
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [detailProgramId, setDetailProgramId] = useState("");
  const [overviewRows, setOverviewRows] = useState<ProgramOverviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const requestedProgramId = isSuperAdmin && !detailProgramId ? undefined : selectedProgramId || undefined;
        const result = await loadProgramAnalytics(requestedProgramId);
        if (!cancelled) {
          setData(result);
          if (!selectedProgramId && result.selectedProgram?.id && (!isSuperAdmin || detailProgramId)) {
            setSelectedProgramId(result.selectedProgram.id);
          }
          if (isSuperAdmin && !detailProgramId) {
            setOverviewLoading(true);
            const rows = await Promise.all(result.programs.map(async program => {
              const programData = await loadProgramAnalytics(program.id);
              return {
                id: program.id,
                name: program.name,
                programCode: program.programCode,
                state: program.state,
                sponsorName: program.sponsorName,
                organizationsCount: programData.summary.totalOrganizations,
                totalUsers: programData.summary.totalUsers,
                averageCompletionPercent: programData.summary.averageCompletionPercent,
                averageSprsScore: programData.summary.averageSprsScore,
                evidenceCount: programData.summary.evidenceUploaded,
                reportsGenerated: programData.summary.sspGeneratedCount + programData.summary.poamGeneratedCount + programData.charts.reportsSummary.other,
                lastActivityDate: programData.summary.lastActivityDate,
              };
            }));
            if (!cancelled) setOverviewRows(rows);
          }
        }
      } catch (loadError) {
        console.error("[program-analytics] load failed", loadError);
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Program Analytics is unavailable.");
      } finally {
        if (!cancelled) {
          setLoading(false);
          setOverviewLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [detailProgramId, isSuperAdmin, selectedProgramId]);

  const maxDistribution = useMemo(() => Math.max(1, ...(data?.charts.completionDistribution || []).map(item => item.count)), [data]);

  if (loading && !data) return <div className="rounded-lg border bg-white p-6 text-sm text-gray-600">Loading Program Analytics...</div>;
  if (error) return <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm font-semibold text-amber-900">{error}</div>;
  if (!data) return null;

  const selectedProgram = data.selectedProgram;
  const canSwitchPrograms = isSuperAdmin || data.programs.length > 1;

  if (isSuperAdmin && !detailProgramId) {
    return (
      <div className="space-y-5">
        <section className="rounded-lg border bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase text-blue-700">SuperAdmin overview</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">Program Analytics Overview</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-600">All active programs with sanitized readiness, usage, evidence-count, and reporting metrics. Raw evidence, filenames, notes, remediation details, AI conversations, and report contents are excluded.</p>
        </section>
        <section className="rounded-lg border bg-white shadow-sm">
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="text-lg font-bold text-gray-900">Active Programs</h2>
            {overviewLoading ? <span className="text-xs font-semibold text-blue-700">Refreshing metrics...</span> : null}
          </div>
          <div className="overflow-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="p-3">Program Name</th>
                  <th className="p-3">Program Code</th>
                  <th className="p-3">State</th>
                  <th className="p-3">Sponsor</th>
                  <th className="p-3">Organizations Count</th>
                  <th className="p-3">Total Users</th>
                  <th className="p-3">Average Completion %</th>
                  <th className="p-3">Average SPRS Score</th>
                  <th className="p-3">Evidence Count</th>
                  <th className="p-3">Reports Generated</th>
                  <th className="p-3">Last Activity</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {overviewRows.map(row => (
                  <tr key={row.id} className="border-t">
                    <td className="p-3 font-semibold text-gray-900">{row.name}</td>
                    <td className="p-3">{row.programCode}</td>
                    <td className="p-3">{row.state || "Not provided"}</td>
                    <td className="p-3">{row.sponsorName || "Not provided"}</td>
                    <td className="p-3">{row.organizationsCount}</td>
                    <td className="p-3">{row.totalUsers}</td>
                    <td className="p-3">{row.averageCompletionPercent}%</td>
                    <td className="p-3">{row.averageSprsScore}</td>
                    <td className="p-3">{row.evidenceCount}</td>
                    <td className="p-3">{row.reportsGenerated}</td>
                    <td className="p-3">{formatDate(row.lastActivityDate)}</td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedProgramId(row.id);
                          setDetailProgramId(row.id);
                        }}
                        className="rounded border border-blue-200 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                      >
                        View Analytics
                      </button>
                    </td>
                  </tr>
                ))}
                {!overviewRows.length ? <tr><td colSpan={12} className="p-5 text-sm text-gray-500">No active programs are available.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            {isSuperAdmin ? (
              <button
                type="button"
                onClick={() => {
                  setDetailProgramId("");
                  setSelectedProgramId("");
                }}
                className="mb-3 rounded border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Back to Program Overview
              </button>
            ) : null}
            <p className="text-xs font-semibold uppercase text-blue-700">Read-only program performance</p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">Program Analytics</h1>
            <p className="mt-2 max-w-3xl text-sm text-gray-600">Sponsor-friendly participant readiness summary. Evidence files, filenames, raw notes, remediation details, AI conversations, and report contents are intentionally excluded.</p>
            {selectedProgram ? (
              <p className="mt-3 text-sm font-semibold text-blue-800">
                Sponsor Program: {selectedProgram.name} ({selectedProgram.programCode})
              </p>
            ) : null}
          </div>
          <div className="w-full lg:w-80">
            <label className="text-xs font-semibold uppercase text-gray-500" htmlFor="program-analytics-selector">Program</label>
            <select
              id="program-analytics-selector"
              value={selectedProgramId}
              disabled={!canSwitchPrograms}
              onChange={event => setSelectedProgramId(event.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
            >
              {data.programs.map(program => (
                <option key={program.id} value={program.id}>{program.name} ({program.programCode})</option>
              ))}
            </select>
            {!data.programs.length ? <p className="mt-2 text-xs text-amber-700">No active programs are available for this account.</p> : null}
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Total Organizations" value={data.summary.totalOrganizations} icon={ShieldCheck} />
        <KpiCard label="Active Organizations" value={data.summary.activeOrganizations} icon={ShieldCheck} />
        <KpiCard label="Total Users" value={data.summary.totalUsers} icon={Users} />
        <KpiCard label="Average Completion" value={`${data.summary.averageCompletionPercent}%`} icon={BarChart3} />
        <KpiCard label="Average SPRS Score" value={data.summary.averageSprsScore} icon={BarChart3} />
        <KpiCard label="Evidence Uploaded" value={data.summary.evidenceUploaded} icon={FileText} />
        <KpiCard label="SSP Generated" value={data.summary.sspGeneratedCount} icon={FileText} />
        <KpiCard label="POA&M Generated" value={data.summary.poamGeneratedCount} icon={FileText} />
        <KpiCard label="Open POA&M Items" value={data.summary.openPoamItems} icon={FileText} />
        <KpiCard label="Last Activity" value={formatDate(data.summary.lastActivityDate)} icon={CalendarClock} />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-lg border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900">Program Readiness Summary</h2>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-gray-600">Completed Practices</span><strong>{data.summary.completedPractices}</strong></div>
            <div className="flex justify-between"><span className="text-gray-600">Remaining Practices</span><strong>{data.summary.remainingPractices}</strong></div>
            <div className="flex justify-between"><span className="text-gray-600">Average Readiness</span><strong>{data.summary.averageReadinessPercent}%</strong></div>
            <div className="flex justify-between"><span className="text-gray-600">L1 Organizations</span><strong>{data.summary.l1Organizations}</strong></div>
            <div className="flex justify-between"><span className="text-gray-600">L2 Organizations</span><strong>{data.summary.l2Organizations}</strong></div>
          </div>
        </div>
        <div className="rounded-lg border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900">Completion Distribution</h2>
          <div className="mt-4 space-y-3">
            {data.charts.completionDistribution.map(item => (
              <div key={item.label}>
                <div className="mb-1 flex justify-between text-xs font-semibold text-gray-600"><span>{item.label}</span><span>{item.count}</span></div>
                <div className="h-3 overflow-hidden rounded-full bg-gray-100"><div className="h-full bg-blue-600" style={{ width: `${Math.max(4, (item.count / maxDistribution) * 100)}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900">Reports and Tier Split</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded border bg-gray-50 p-3"><div className="text-xs uppercase text-gray-500">L1</div><strong>{data.charts.tierSplit.l1}</strong></div>
            <div className="rounded border bg-gray-50 p-3"><div className="text-xs uppercase text-gray-500">L2</div><strong>{data.charts.tierSplit.l2}</strong></div>
            <div className="rounded border bg-gray-50 p-3"><div className="text-xs uppercase text-gray-500">SSP</div><strong>{data.charts.reportsSummary.ssp}</strong></div>
            <div className="rounded border bg-gray-50 p-3"><div className="text-xs uppercase text-gray-500">POA&M</div><strong>{data.charts.reportsSummary.poam}</strong></div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border bg-white shadow-sm">
        <div className="border-b p-4">
          <h2 className="text-lg font-bold text-gray-900">Organization Performance</h2>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="p-3">Company Name</th>
                <th className="p-3">Tier</th>
                <th className="p-3">Users</th>
                <th className="p-3">Completion</th>
                <th className="p-3">SPRS</th>
                <th className="p-3">Evidence</th>
                <th className="p-3">SSP</th>
                <th className="p-3">POA&M</th>
                <th className="p-3">Last Activity</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.organizations.map(org => (
                <tr key={org.id} className="border-t">
                  <td className="p-3 font-semibold text-gray-900">{org.companyName}</td>
                  <td className="p-3">{org.tier}</td>
                  <td className="p-3">{org.usersCount}</td>
                  <td className="p-3">{org.completionPercent}%</td>
                  <td className="p-3">{org.sprsScore}</td>
                  <td className="p-3">{org.evidenceCount}</td>
                  <td className="p-3">{org.sspGenerated ? "Yes" : "No"}</td>
                  <td className="p-3">{org.poamGenerated ? "Yes" : "No"}</td>
                  <td className="p-3">{formatDate(org.lastActivity)}</td>
                  <td className="p-3"><span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${attentionClass(org.attentionFlag)}`}>{org.attentionFlag}</span></td>
                </tr>
              ))}
              {!data.organizations.length ? <tr><td colSpan={10} className="p-5 text-sm text-gray-500">No organizations are assigned to this program yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border bg-white shadow-sm">
        <div className="border-b p-4">
          <h2 className="text-lg font-bold text-gray-900">Recent Program Activity</h2>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr><th className="p-3">Date</th><th className="p-3">Organization</th><th className="p-3">Activity</th><th className="p-3">User</th><th className="p-3">Summary</th></tr>
            </thead>
            <tbody>
              {data.recentActivity.map(event => (
                <tr key={event.id} className="border-t">
                  <td className="p-3">{formatDate(event.createdAt)}</td>
                  <td className="p-3">{event.orgName || event.orgId}</td>
                  <td className="p-3">{event.action}</td>
                  <td className="p-3">{event.actorName || event.actorEmail || "System"}</td>
                  <td className="p-3">{event.summary}</td>
                </tr>
              ))}
              {!data.recentActivity.length ? <tr><td colSpan={5} className="p-5 text-sm text-gray-500">No recent program activity available.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
