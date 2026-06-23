import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { formatActivityDate, type ActivityEvent } from "../src/activityLog";
import { formatPilotDate, loadPilotParticipantDetail, type PilotOrgSummary } from "../src/pilotOversight";

type Props = {
  orgId: string;
  onBack: () => void;
};

const DetailMetric = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="rounded border bg-gray-50 p-3">
    <div className="text-xs font-semibold uppercase text-gray-500">{label}</div>
    <div className="mt-1 text-sm font-semibold text-gray-900">{value}</div>
  </div>
);

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

const safeActivitySummary = (event: ActivityEvent) => {
  const action = String(event.action || "activity");
  if (action.startsWith("evidence.")) return action === "evidence.uploaded" ? "Evidence uploaded" : "Evidence status changed";
  if (action === "assessment.saved") return "Assessment progress saved";
  return event.summary || action;
};

export const SponsorParticipantDetailPage: React.FC<Props> = ({ orgId, onBack }) => {
  const [organization, setOrganization] = useState<PilotOrgSummary | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const result = await loadPilotParticipantDetail(orgId);
        if (!cancelled) {
          setOrganization(result.organization);
          setActivity(result.activity);
        }
      } catch (loadError) {
        console.error("[sponsor-participant-detail] load failed", loadError);
        if (!cancelled) setError("Participant detail is unavailable.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [orgId]);

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(activity.length / pageSize));
  const pageRows = useMemo(() => activity.slice((page - 1) * pageSize, page * pageSize), [activity, page]);

  if (loading) return <div className="rounded-lg border bg-white p-6 text-sm text-gray-600">Loading participant detail...</div>;
  if (error) return <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">{error}</div>;
  if (!organization) {
    return (
      <section className="rounded-lg border bg-white p-6 shadow-sm">
        <button type="button" onClick={onBack} className="mb-4 inline-flex items-center text-sm font-semibold text-blue-700 hover:underline"><ArrowLeft className="mr-1 h-4 w-4" /> Back to Participants</button>
        <h1 className="text-xl font-bold text-gray-900">Participant Not Available</h1>
        <p className="mt-2 text-sm text-gray-600">This organization is not available to Sponsor Observers or is not marked as an active pilot participant.</p>
      </section>
    );
  }

  const completed = organization.practicesCompleted;
  const remaining = organization.practicesRemaining;
  const total = Math.max(1, completed + remaining);
  const inProgress = organization.domainReadiness.filter(domain => domain.status === "In Progress").length;
  const completedPercent = Math.round((completed / total) * 100);
  const remainingPercent = Math.max(0, 100 - completedPercent);

  return (
    <div className="space-y-4">
      <section className="rounded-lg border bg-white p-5 shadow-sm">
        <button type="button" onClick={onBack} className="mb-4 inline-flex items-center text-sm font-semibold text-blue-700 hover:underline"><ArrowLeft className="mr-1 h-4 w-4" /> Back to Participants</button>
        <p className="text-xs font-semibold uppercase text-blue-700">Pilot Participant Detail</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">{organization.companyName}</h1>
        <p className="mt-1 text-sm text-gray-600">Read-only sponsor summary. Raw evidence files, filenames, notes, and remediation details are intentionally hidden.</p>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <DetailMetric label="Company Name" value={organization.companyName} />
        <DetailMetric label="Company Location" value={[organization.town, organization.state].filter(Boolean).join(", ") || "Not provided"} />
        <DetailMetric label="Email / Primary User ID" value={organization.primaryContactEmail || organization.primaryUserId || "Not provided"} />
        <DetailMetric label="Starting Date" value={formatPilotDate(organization.startingDate)} />
        <DetailMetric label="Tier" value={organization.tier} />
        <DetailMetric label="Users Count" value={organization.usersCount} />
        <DetailMetric label="Practices Completed" value={organization.practicesCompleted} />
        <DetailMetric label="Practices Remaining" value={organization.practicesRemaining} />
        <DetailMetric label="Evidence Count" value={organization.evidenceCount} />
        <DetailMetric label="SSP Generated" value={organization.sspGenerated ? "Yes" : "No"} />
        <DetailMetric label="POA&M Generated" value={organization.poamGenerated ? "Yes" : "No"} />
        <DetailMetric label="Last Activity" value={formatActivityDate(organization.lastActivity)} />
        <DetailMetric label="Overall Readiness %" value={`${organization.overallReadinessPercent}%`} />
      </section>

      <section className="rounded-lg border bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900"><BarChart3 className="h-5 w-5 text-blue-700" /> Progress</h2>
        <div className="mt-4 overflow-hidden rounded-full bg-gray-200">
          <div className="h-5 bg-emerald-600" style={{ width: `${completedPercent}%` }} />
        </div>
        <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
          <DetailMetric label="Completed" value={`${completed} practices (${completedPercent}%)`} />
          <DetailMetric label="In Progress Domains" value={inProgress} />
          <DetailMetric label="Not Started / Remaining" value={`${remaining} practices (${remainingPercent}%)`} />
        </div>
      </section>

      <section className="rounded-lg border bg-white shadow-sm">
        <div className="border-b p-4"><h2 className="text-lg font-bold text-gray-900">Domain Readiness</h2></div>
        <div className="overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr><th className="p-3">Domain</th><th className="p-3">Completed</th><th className="p-3">Remaining</th><th className="p-3">Total</th><th className="p-3">Readiness %</th><th className="p-3">Status</th></tr>
            </thead>
            <tbody>
              {organization.domainReadiness.map(domain => (
                <tr key={domain.domain} className="border-t">
                  <td className="p-3 font-semibold text-gray-900">{domain.domain}</td>
                  <td className="p-3">{domain.completed}</td>
                  <td className="p-3">{domain.remaining}</td>
                  <td className="p-3">{domain.total}</td>
                  <td className="p-3">{domain.readinessPercent}%</td>
                  <td className="p-3">{domain.status}</td>
                </tr>
              ))}
              {organization.domainReadiness.length === 0 && <tr><td colSpan={6} className="p-5 text-sm text-gray-500">No domain readiness summary available.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border bg-white shadow-sm">
        <div className="border-b p-4"><h2 className="text-lg font-bold text-gray-900">Recent Activity</h2></div>
        <div className="overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr><th className="p-3">Date/Time</th><th className="p-3">User</th><th className="p-3">Activity</th><th className="p-3">Category</th><th className="p-3">Details / Summary</th></tr>
            </thead>
            <tbody>
              {pageRows.map(event => (
                <tr key={event.id} className="border-t">
                  <td className="p-3">{formatActivityDate(event.createdAt)}</td>
                  <td className="p-3">{event.actorName || event.actorEmail || "System"}</td>
                  <td className="p-3">{event.action}</td>
                  <td className="p-3">{categoryForAction(String(event.action || ""))}</td>
                  <td className="p-3">{safeActivitySummary(event)}</td>
                </tr>
              ))}
              {pageRows.length === 0 && <tr><td colSpan={5} className="p-5 text-sm text-gray-500">No recent activity for this participant.</td></tr>}
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

