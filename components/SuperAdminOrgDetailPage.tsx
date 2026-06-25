import React, { useEffect, useState } from "react";
import { loadSuperAdminOrgDetail, type SuperAdminOrgActivity, type SuperAdminOrgSummary, type SuperAdminOrgUser } from "../src/superAdminOrgs";

type Props = {
  orgId: string;
  onBack: () => void;
};

const formatDate = (value: any) => {
  if (!value) return "Not provided";
  const date = value?.toDate ? value.toDate() : value?._seconds ? new Date(value._seconds * 1000) : new Date(value);
  return Number.isNaN(date.getTime()) ? "Not provided" : date.toLocaleDateString();
};

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="rounded border bg-gray-50 p-3">
    <div className="text-xs font-semibold uppercase text-gray-500">{label}</div>
    <div className="mt-1 text-sm font-semibold text-gray-900">{value || "Not provided"}</div>
  </div>
);

const programLabel = (org: SuperAdminOrgSummary) => String(org.enrollmentType || "").toUpperCase() === "PROGRAM"
  ? org.programCode ? `${org.programName || "Program"} (${org.programCode})` : org.programName || "Program"
  : "Commercial";

export const SuperAdminOrgDetailPage: React.FC<Props> = ({ orgId, onBack }) => {
  const [org, setOrg] = useState<SuperAdminOrgSummary | null>(null);
  const [users, setUsers] = useState<SuperAdminOrgUser[]>([]);
  const [activity, setActivity] = useState<SuperAdminOrgActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const result = await loadSuperAdminOrgDetail(orgId);
        if (!cancelled) {
          setOrg(result.org);
          setUsers(result.users);
          setActivity(result.recentActivity);
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load organization detail.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [orgId]);

  if (loading) return <div className="rounded-lg border bg-white p-6 text-sm text-gray-600">Loading organization detail...</div>;
  if (error) return <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm font-semibold text-amber-900">{error}</div>;
  if (!org) return null;

  return (
    <div className="space-y-5">
      <section className="rounded-lg border bg-white p-5 shadow-sm">
        <button type="button" onClick={onBack} className="mb-4 text-sm font-semibold text-blue-700 hover:underline">Back to Active Orgs</button>
        <p className="text-xs font-semibold uppercase text-blue-700">SuperAdmin Org Detail</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">{org.companyName}</h1>
        <p className="mt-2 text-sm text-gray-600">Sanitized operational summary. Raw evidence files, filenames, AI conversations, private notes, and report contents are not shown.</p>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <Row label="Company Name" value={org.companyName} />
        <Row label="Location" value={org.location} />
        <Row label="Primary Email" value={org.primaryEmail} />
        <Row label="Tier" value={org.tier} />
        <Row label="Enrollment Type" value={org.enrollmentType} />
        <Row label="Program / Commercial" value={programLabel(org)} />
        <Row label="Status" value={org.status} />
        <Row label="Created / Approved" value={`${formatDate(org.createdAt)} / ${formatDate(org.approvedAt)}`} />
        <Row label="Last Activity" value={formatDate(org.lastActivity)} />
      </section>

      <TableSection title="Users">
        <thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Role</th><th className="p-3">Status</th><th className="p-3">Joined</th></tr></thead>
        <tbody>{users.map(user => <tr key={user.uid} className="border-t"><td className="p-3">{user.name || "Not provided"}</td><td className="p-3">{user.email}</td><td className="p-3">{user.role}</td><td className="p-3">{user.status}</td><td className="p-3">{formatDate(user.joinedAt)}</td></tr>)}</tbody>
      </TableSection>

      <section className="grid gap-3 md:grid-cols-4">
        <Row label="Total Practices" value={org.totalPractices} />
        <Row label="Practices Completed" value={org.practicesCompleted} />
        <Row label="Practices Remaining" value={org.practicesRemaining} />
        <Row label="Completion %" value={`${org.completionPercent}%`} />
        <Row label="SPRS Score" value={org.sprsScore} />
        <Row label="SSP Generated" value={org.sspGenerated ? "Yes" : "No"} />
        <Row label="POA&M Generated" value={org.poamGenerated ? "Yes" : "No"} />
        <Row label="Evidence Count" value={org.evidenceCount} />
      </section>

      <TableSection title="Domain Readiness">
        <thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="p-3">Domain</th><th className="p-3">Completed</th><th className="p-3">Remaining</th><th className="p-3">Total</th><th className="p-3">Readiness %</th><th className="p-3">Status</th></tr></thead>
        <tbody>{org.domainReadiness.map(domain => <tr key={domain.domain} className="border-t"><td className="p-3 font-semibold">{domain.domain}</td><td className="p-3">{domain.completed}</td><td className="p-3">{domain.remaining}</td><td className="p-3">{domain.total}</td><td className="p-3">{domain.readinessPercent}%</td><td className="p-3">{domain.status}</td></tr>)}</tbody>
      </TableSection>

      <TableSection title="Vendor Engagements">
        <thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="p-3">Vendor</th><th className="p-3">Category</th><th className="p-3">Engagement Type</th><th className="p-3">Status</th><th className="p-3">Start</th><th className="p-3">End</th><th className="p-3">Last Updated</th></tr></thead>
        <tbody>{org.marketplaceEngagements.map(engagement => <tr key={engagement.id || engagement.vendorId} className="border-t"><td className="p-3 font-semibold">{engagement.vendorName}</td><td className="p-3">{engagement.vendorCategory || "Not provided"}</td><td className="p-3">{engagement.engagementType}</td><td className="p-3">{engagement.status}</td><td className="p-3">{engagement.startDate || "Not provided"}</td><td className="p-3">{engagement.endDate || "Not provided"}</td><td className="p-3">{formatDate(engagement.updatedAt)}</td></tr>)}</tbody>
      </TableSection>

      <TableSection title="Recent Activity">
        <thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="p-3">Date</th><th className="p-3">User</th><th className="p-3">Action</th><th className="p-3">Target</th><th className="p-3">Summary</th></tr></thead>
        <tbody>{activity.map(event => <tr key={event.id} className="border-t"><td className="p-3">{formatDate(event.createdAt)}</td><td className="p-3">{event.actorName || event.actorEmail || "System"}</td><td className="p-3">{event.action}</td><td className="p-3">{event.targetType}</td><td className="p-3">{event.summary}</td></tr>)}</tbody>
      </TableSection>
    </div>
  );
};

const TableSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="rounded-lg border bg-white shadow-sm">
    <div className="border-b p-4"><h2 className="text-lg font-bold text-gray-900">{title}</h2></div>
    <div className="overflow-auto"><table className="min-w-full text-left text-sm">{children}</table></div>
  </section>
);
