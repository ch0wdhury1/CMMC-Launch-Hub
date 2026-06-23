import React, { useEffect, useMemo, useState } from "react";
import { Eye, RefreshCcw } from "lucide-react";
import { formatActivityDate } from "../src/activityLog";
import { loadPilotOversightData, pilotParticipantOrganizations, type PilotOrgSummary } from "../src/pilotOversight";

type Props = {
  onParticipantClick: (orgId: string) => void;
};

export const SponsorParticipantsPage: React.FC<Props> = ({ onParticipantClick }) => {
  const [participants, setParticipants] = useState<PilotOrgSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await loadPilotOversightData();
      setParticipants(pilotParticipantOrganizations(data));
    } catch (loadError) {
      console.error("[sponsor-participants] load failed", loadError);
      setError("Participant summary is unavailable. Confirm Sponsor Observer access.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const rows = useMemo(() => participants.slice().sort((a, b) => a.companyName.localeCompare(b.companyName)), [participants]);

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-3 rounded-lg border bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-blue-700">Sponsor Observer</p>
          <h1 className="text-2xl font-bold text-gray-900">Participants</h1>
          <p className="mt-1 text-sm text-gray-600">Active pilot participant organizations only. Internal, SuperAdmin, QA, and test organizations are filtered out.</p>
        </div>
        <button type="button" onClick={() => void load()} className="inline-flex items-center rounded border px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
          <RefreshCcw className="mr-2 h-4 w-4" />
          Refresh
        </button>
      </section>

      {error && <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}</div>}
      <section className="rounded-lg border bg-white shadow-sm">
        <div className="overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="p-3">Company Name</th>
                <th className="p-3">Location</th>
                <th className="p-3">Tier</th>
                <th className="p-3">Users Count</th>
                <th className="p-3">Practices Completed</th>
                <th className="p-3">Practices Remaining</th>
                <th className="p-3">Evidence Count</th>
                <th className="p-3">Last Activity</th>
                <th className="p-3">Detail</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={9} className="p-5 text-sm text-gray-500">Loading participants...</td></tr> : null}
              {!loading && rows.length === 0 ? <tr><td colSpan={9} className="p-5 text-sm text-gray-500">No active pilot participants found.</td></tr> : null}
              {!loading && rows.map(org => (
                <tr key={org.id} className="border-t">
                  <td className="p-3 font-semibold text-gray-900">{org.companyName}</td>
                  <td className="p-3">{[org.town, org.state].filter(Boolean).join(", ") || "Not provided"}</td>
                  <td className="p-3">{org.tier}</td>
                  <td className="p-3">{org.usersCount}</td>
                  <td className="p-3">{org.practicesCompleted}</td>
                  <td className="p-3">{org.practicesRemaining}</td>
                  <td className="p-3">{org.evidenceCount}</td>
                  <td className="p-3">{formatActivityDate(org.lastActivity)}</td>
                  <td className="p-3">
                    <button type="button" onClick={() => onParticipantClick(org.id)} className="inline-flex items-center rounded border px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50">
                      <Eye className="mr-1 h-3.5 w-3.5" />
                      Detail
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <p className="text-xs text-gray-500">Recommended future data marker: set `pilotParticipant: true`, `orgType: "pilot"`, and `isInternal: false` on participant organizations.</p>
    </div>
  );
};
