import React, { useEffect, useState } from "react";
import { loadSuperAdminActiveOrgs, type SuperAdminOrgSummary } from "../src/superAdminOrgs";

type Props = {
  onDetails: (orgId: string) => void;
};

const formatDate = (value: any) => {
  if (!value) return "Not provided";
  const date = value?.toDate ? value.toDate() : value?._seconds ? new Date(value._seconds * 1000) : new Date(value);
  return Number.isNaN(date.getTime()) ? "Not provided" : date.toLocaleDateString();
};

const programLabel = (org: SuperAdminOrgSummary) => {
  const enrollment = String(org.enrollmentType || "").toUpperCase();
  if (enrollment === "PROGRAM") return org.programCode ? `${org.programName || "Program"} (${org.programCode})` : org.programName || "Program";
  return "Commercial";
};

export const SuperAdminActiveOrgsPage: React.FC<Props> = ({ onDetails }) => {
  const [orgs, setOrgs] = useState<SuperAdminOrgSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const loaded = await loadSuperAdminActiveOrgs();
        if (!cancelled) setOrgs(loaded);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load active organizations.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-5">
      <section className="rounded-lg border bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase text-blue-700">SuperAdmin</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Active Organizations</h1>
        <p className="mt-2 text-sm text-gray-600">Full active organization list with sanitized readiness, evidence-count, reporting, marketplace, and activity metadata.</p>
      </section>
      {error ? <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">{error}</div> : null}
      <section className="rounded-lg border bg-white shadow-sm">
        <div className="border-b p-4"><h2 className="text-lg font-bold text-gray-900">Active Org List</h2></div>
        <div className="overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="p-3">Company Name</th><th className="p-3">Status</th><th className="p-3">Tier</th><th className="p-3">Enrollment Type</th><th className="p-3">Program / Commercial</th><th className="p-3">Users Count</th><th className="p-3">Practices Completed</th><th className="p-3">Readiness %</th><th className="p-3">Evidence Count</th><th className="p-3">SSP Generated</th><th className="p-3">POA&M Generated</th><th className="p-3">Last Activity</th><th className="p-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map(org => (
                <tr key={org.id} className="border-t">
                  <td className="p-3 font-semibold text-gray-900">{org.companyName}</td>
                  <td className="p-3">{org.status}</td>
                  <td className="p-3">{org.tier}</td>
                  <td className="p-3">{org.enrollmentType}</td>
                  <td className="p-3">{programLabel(org)}</td>
                  <td className="p-3">{org.usersCount}</td>
                  <td className="p-3">{org.practicesCompleted}</td>
                  <td className="p-3">{org.completionPercent}%</td>
                  <td className="p-3">{org.evidenceCount}</td>
                  <td className="p-3">{org.sspGenerated ? "Yes" : "No"}</td>
                  <td className="p-3">{org.poamGenerated ? "Yes" : "No"}</td>
                  <td className="p-3">{formatDate(org.lastActivity)}</td>
                  <td className="p-3"><button type="button" onClick={() => onDetails(org.id)} className="rounded border border-blue-200 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50">Details</button></td>
                </tr>
              ))}
              {loading ? <tr><td colSpan={13} className="p-5 text-sm text-gray-500">Loading active organizations...</td></tr> : null}
              {!loading && !orgs.length ? <tr><td colSpan={13} className="p-5 text-sm text-gray-500">No active organizations found.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
