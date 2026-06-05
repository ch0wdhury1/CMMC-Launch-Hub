import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { Activity, AlertTriangle, ArrowRight, BarChart3, Database, FileText, ShieldCheck, Users } from "lucide-react";
import { db } from "../src/firebase";
import { formatActivityDate, loadActivityEvents, type ActivityEvent } from "../src/activityLog";
import type { CompanyProfile, Domain, EvidenceSummary, PoamItem, PracticeRecord, ReadinessScores } from "../types";

type DashboardRole = "orgOwner" | "orgAdmin" | "assessor" | "contributor" | "viewer" | string;

type Props = {
  orgId: string | null;
  role?: DashboardRole | null;
  companyProfile: CompanyProfile | null;
  subscriptionLevel: string;
  domains: Domain[];
  practiceRecords: PracticeRecord[];
  scores: ReadinessScores;
  evidenceSummary: EvidenceSummary;
  poamItems: PoamItem[];
  sprsScore: number;
  onProfileClick: () => void;
  onPracticeClick: (practiceId: string) => void;
  onEvidenceLibraryClick: () => void;
  onExecutiveReportClick: () => void;
  onSprsClick: () => void;
  onPoamClick: () => void;
  onSspClick: () => void;
  onResponsibilityMatrixClick: () => void;
  onInvitationsClick: () => void;
};

type OrgSnapshot = {
  name?: string;
  tier?: string;
  subscriptionStatus?: string;
  companyProfile?: any;
};

type OrgStats = {
  activeUsers: number | null;
  pendingInvitations: number | null;
};

const isFilled = (value: unknown) => String(value || "").trim().length > 0;

const addressText = (address: CompanyProfile["address"]) => {
  if (!address) return "";
  if (typeof address === "string") return address;
  return [address.street, address.city, address.state, address.zip, address.country].filter(Boolean).join(", ");
};

const companyName = (profile: CompanyProfile | null | undefined, org?: OrgSnapshot | null, fallback = "Your Organization") =>
  String((profile as any)?.legalName || profile?.companyName || org?.companyProfile?.legalName || org?.name || fallback);

const profileCompleteness = (profile: CompanyProfile | null | undefined) => {
  const cmmc = (profile as any)?.cmmc || {};
  const contacts = (profile as any)?.contacts || {};
  const scope = (profile as any)?.scope || {};
  const providers = (profile as any)?.providers || {};
  const required = [
    (profile as any)?.legalName || profile?.companyName,
    profile?.website,
    contacts.primary?.name || profile?.primaryContactName,
    contacts.primary?.email || profile?.primaryContactEmail,
    contacts.primary?.phone || profile?.primaryContactPhone,
    (profile as any)?.cageCode,
    (profile as any)?.uei,
    (profile as any)?.naicsCodes || (profile as any)?.naics,
    cmmc.assessmentLevel,
    cmmc.handlesFCI,
    cmmc.handlesCUI,
    cmmc.employeeCount,
    cmmc.userCount,
    cmmc.locationCount,
    scope.headquarters || addressText(profile?.address),
    providers.cloudProvider || cmmc.cloudProviders,
    providers.emailProvider,
  ];
  const missing = required.filter(item => !isFilled(item)).length;
  return {
    missing,
    percent: Math.round(((required.length - missing) / required.length) * 100),
  };
};

const archivedEvidenceCount = (summary: EvidenceSummary) => {
  const byId = new Map<string, boolean>();
  Object.values(summary.evidenceByObjectiveId || {}).flat().forEach(item => {
    if (item?.id) byId.set(item.id, Boolean(item.archived));
  });
  Object.values(summary.evidenceByPracticeId || {}).flat().forEach(item => {
    if (item?.id) byId.set(item.id, Boolean(item.archived));
  });
  return Array.from(byId.values()).filter(Boolean).length;
};

const activeEvidenceCount = (summary: EvidenceSummary) => Math.max(0, summary.totalEvidenceCount - archivedEvidenceCount(summary));

const SummaryCard = ({ label, value, note }: { label: string; value: string | number; note?: string }) => (
  <div className="rounded-lg border bg-white p-4 shadow-sm">
    <div className="text-xs font-semibold uppercase text-gray-500">{label}</div>
    <div className="mt-2 text-2xl font-bold text-gray-900">{value}</div>
    {note && <div className="mt-1 text-xs text-gray-500">{note}</div>}
  </div>
);

const ShortcutButton = ({ label, onClick, icon: Icon }: { label: string; onClick: () => void; icon: React.ComponentType<{ className?: string }> }) => (
  <button type="button" onClick={onClick} className="inline-flex items-center justify-between gap-3 rounded-md border bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-blue-50 hover:text-blue-800">
    <span className="inline-flex items-center gap-2"><Icon className="h-4 w-4 text-blue-700" /> {label}</span>
    <ArrowRight className="h-4 w-4" />
  </button>
);

export const OrganizationDashboard: React.FC<Props> = ({
  orgId,
  role,
  companyProfile,
  subscriptionLevel,
  domains,
  practiceRecords,
  scores,
  evidenceSummary,
  poamItems,
  sprsScore,
  onProfileClick,
  onPracticeClick,
  onEvidenceLibraryClick,
  onExecutiveReportClick,
  onSprsClick,
  onPoamClick,
  onSspClick,
  onResponsibilityMatrixClick,
  onInvitationsClick,
}) => {
  const [org, setOrg] = useState<OrgSnapshot | null>(null);
  const [orgStats, setOrgStats] = useState<OrgStats>({ activeUsers: null, pendingInvitations: null });
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [activityError, setActivityError] = useState("");
  const isOrgAdmin = role === "orgOwner" || role === "orgAdmin";
  const isViewer = role === "viewer";
  const isL2 = subscriptionLevel === "COMM_L2";
  const completion = profileCompleteness(companyProfile);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!orgId) return;
      try {
        const orgSnapshot = await getDoc(doc(db, "orgs", orgId));
        if (!cancelled && orgSnapshot.exists()) setOrg(orgSnapshot.data() as OrgSnapshot);
      } catch (error) {
        console.warn("[org-dashboard] org snapshot unavailable", error);
      }
      if (isOrgAdmin) {
        try {
          const [members, invitations] = await Promise.all([
            getDocs(collection(db, "orgs", orgId, "members")),
            getDocs(collection(db, "orgs", orgId, "invitations")),
          ]);
          if (!cancelled) {
            setOrgStats({
              activeUsers: members.docs.filter(item => String(item.data()?.status || "active").toLowerCase() === "active").length,
              pendingInvitations: invitations.docs.filter(item => String(item.data()?.status || "").toLowerCase() === "pending").length,
            });
          }
        } catch (error) {
          console.warn("[org-dashboard] org admin stats unavailable", error);
        }
      }
      try {
        const events = await loadActivityEvents({ orgId, isSuperAdmin: false });
        if (!cancelled) setActivity(events.slice(0, 10));
      } catch (error) {
        if (!cancelled) setActivityError("Recent activity is unavailable.");
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [isOrgAdmin, orgId]);

  const recordMap = useMemo(() => new Map(practiceRecords.map(record => [record.id, record])), [practiceRecords]);

  const domainSummaries = useMemo(() => domains.map(domain => {
    const records = domain.practices.map(practice => recordMap.get(practice.id)).filter((record): record is PracticeRecord => Boolean(record));
    const met = records.filter(record => record.status === "met").length;
    const partial = records.filter(record => record.status === "partial").length;
    const notMet = records.filter(record => record.status === "not_met").length;
    const notAssessed = Math.max(0, domain.practices.length - met - partial - notMet);
    const completionPercent = domain.practices.length === 0 ? 0 : Math.round(((met + partial * 0.5) / domain.practices.length) * 100);
    return { name: domain.name, practices: domain.practices.length, met, partial, notMet, notAssessed, completionPercent };
  }), [domains, recordMap]);

  const assessedPractices = practiceRecords.filter(record => record.status !== "not_assessed").length;
  const openPoam = poamItems.filter(item => item.status !== "completed");
  const highPriorityPoam = openPoam.filter(item => item.priority === "high").length;
  const firstUnassessed = practiceRecords.find(record => record.status === "not_assessed");
  const lastActivity = activity.length > 0 ? activity[0] : null;
  const missingEvidencePractices = domains.flatMap(domain => domain.practices)
    .filter(practice => (evidenceSummary.evidenceByPracticeId[practice.id] || []).filter(item => !item.archived).length === 0)
    .slice(0, 3);

  const nextActions = [
    completion.percent < 100 ? { title: "Complete company profile", reason: `${completion.missing} source-of-truth field${completion.missing === 1 ? "" : "s"} still missing.`, onClick: onProfileClick, adminOnly: true } : null,
    missingEvidencePractices.length > 0 && !isViewer ? { title: "Upload evidence for missing practices", reason: `${missingEvidencePractices.length} visible practice${missingEvidencePractices.length === 1 ? "" : "s"} sampled with no active evidence.`, onClick: onEvidenceLibraryClick } : null,
    openPoam.length > 0 && isL2 ? { title: "Review open POA&M items", reason: `${openPoam.length} open remediation item${openPoam.length === 1 ? "" : "s"} need review.`, onClick: onPoamClick } : null,
    assessedPractices < practiceRecords.length && firstUnassessed ? { title: "Complete unassessed practices", reason: `${practiceRecords.length - assessedPractices} practice${practiceRecords.length - assessedPractices === 1 ? "" : "s"} remain unassessed.`, onClick: () => onPracticeClick(firstUnassessed.id) } : null,
    isOrgAdmin ? { title: "Invite team members", reason: "Add approved pilot participants with least-privileged roles.", onClick: onInvitationsClick, adminOnly: true } : null,
    { title: "Generate Executive Readiness Report", reason: "Review readiness narrative and reporting identity.", onClick: onExecutiveReportClick },
  ].filter((item): item is { title: string; reason: string; onClick: () => void; adminOnly?: boolean } => Boolean(item) && (!item?.adminOnly || isOrgAdmin));

  const shortcutButtons = [
    { label: "Executive Readiness Report", onClick: onExecutiveReportClick, icon: FileText, visible: true },
    { label: "SPRS Scorecard", onClick: onSprsClick, icon: BarChart3, visible: true },
    { label: "POA&M", onClick: onPoamClick, icon: AlertTriangle, visible: isL2 },
    { label: "System Security Plan", onClick: onSspClick, icon: ShieldCheck, visible: isL2 },
    { label: "Responsibility Matrix", onClick: onResponsibilityMatrixClick, icon: Users, visible: isL2 },
  ].filter(item => item.visible);

  return <div className="space-y-5 animate-fadeIn pb-8">
    <section className="rounded-lg border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Organization Dashboard</h2>
          <p className="mt-1 text-sm text-gray-600">{companyName(companyProfile, org)}</p>
          <p className="mt-2 text-xs text-gray-500">Last activity: {lastActivity ? formatActivityDate(lastActivity.createdAt) : "No recent activity yet"}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
          <div className="rounded border bg-gray-50 p-2"><div className="font-semibold uppercase text-gray-500">Tier</div><div className="mt-1 font-bold text-gray-900">{org?.tier || subscriptionLevel}</div></div>
          <div className="rounded border bg-gray-50 p-2"><div className="font-semibold uppercase text-gray-500">Status</div><div className="mt-1 font-bold capitalize text-gray-900">{org?.subscriptionStatus || "Active"}</div></div>
          <div className="rounded border bg-gray-50 p-2"><div className="font-semibold uppercase text-gray-500">CMMC Access</div><div className="mt-1 font-bold text-gray-900">{isL2 ? "L1 + L2" : "L1"}</div></div>
          <div className="rounded border bg-blue-50 p-2"><div className="font-semibold uppercase text-blue-700">Profile</div><div className="mt-1 font-bold text-blue-950">{completion.percent}% complete</div></div>
        </div>
      </div>
    </section>

    <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
      <SummaryCard label="Overall Completion" value={`${Math.round(scores.practiceCompletionScore || scores.overallReadinessScore || 0)}%`} />
      <SummaryCard label="SPRS Score" value={sprsScore} />
      <SummaryCard label="Practices Assessed" value={`${assessedPractices}/${practiceRecords.length}`} />
      <SummaryCard label="Evidence Count" value={activeEvidenceCount(evidenceSummary)} />
      <SummaryCard label="Open POA&M" value={openPoam.length} />
      <SummaryCard label="High Priority POA&M" value={highPriorityPoam} />
      <SummaryCard label="Users Active" value={isOrgAdmin ? orgStats.activeUsers ?? "..." : "Admin only"} />
      <SummaryCard label="Pending Invitations" value={isOrgAdmin ? orgStats.pendingInvitations ?? "..." : "Admin only"} />
    </section>

    <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
      <section className="rounded-lg border bg-white shadow-sm xl:col-span-2">
        <div className="border-b p-4"><h3 className="font-bold text-gray-900">Domain Readiness</h3></div>
        {domainSummaries.length === 0 ? <p className="p-6 text-sm text-gray-500">No assessment domains are available yet.</p> :
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="p-3">Domain</th><th className="p-3">Practices</th><th className="p-3">Met</th><th className="p-3">Not Met</th><th className="p-3">Not Assessed</th><th className="p-3">Completion</th></tr></thead>
            <tbody>{domainSummaries.map(domain => <tr key={domain.name} className="border-t">
              <td className="p-3 font-semibold text-gray-900">{domain.name}</td>
              <td className="p-3">{domain.practices}</td>
              <td className="p-3">{domain.met}</td>
              <td className="p-3">{domain.notMet}</td>
              <td className="p-3">{domain.notAssessed}</td>
              <td className="p-3">{domain.completionPercent}%</td>
            </tr>)}</tbody>
          </table>
        </div>}
      </section>

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <h3 className="font-bold text-gray-900">Next Actions</h3>
        <div className="mt-3 space-y-3">
          {nextActions.length === 0 ? <p className="text-sm text-gray-500">No immediate next actions. Continue monitoring assessment and evidence activity.</p> :
          nextActions.slice(0, 6).map(action => <button key={action.title} type="button" onClick={action.onClick} className="block w-full rounded border p-3 text-left hover:bg-blue-50">
            <div className="font-semibold text-gray-900">{action.title}</div>
            <div className="mt-1 text-xs text-gray-600">{action.reason}</div>
          </button>)}
        </div>
      </section>
    </div>

    <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <h3 className="flex items-center gap-2 font-bold text-gray-900"><Database className="h-4 w-4 text-blue-700" /> Evidence Snapshot</h3>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <SummaryCard label="Total Evidence" value={evidenceSummary.totalEvidenceCount} />
          <SummaryCard label="Uploaded" value={evidenceSummary.evidenceWithStorageCount} />
          <SummaryCard label="OCR Failed" value={evidenceSummary.ocrFailedCount} />
          <SummaryCard label="Archived" value={archivedEvidenceCount(evidenceSummary)} />
        </div>
        {evidenceSummary.totalEvidenceCount === 0 && <p className="mt-3 text-sm text-gray-500">No evidence uploaded yet.</p>}
        <button type="button" onClick={onEvidenceLibraryClick} className="mt-3 inline-flex items-center rounded border px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50">Open Evidence Library</button>
      </section>

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <h3 className="font-bold text-gray-900">Reporting Shortcuts</h3>
        <div className="mt-3 grid grid-cols-1 gap-2">
          {shortcutButtons.map(shortcut => <ShortcutButton key={shortcut.label} {...shortcut} />)}
        </div>
        {!isL2 && <p className="mt-3 text-xs text-gray-500">Advanced L2 reporting shortcuts are hidden for the current tier.</p>}
      </section>

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <h3 className="flex items-center gap-2 font-bold text-gray-900"><Activity className="h-4 w-4 text-blue-700" /> Recent Activity</h3>
        {activityError && <p className="mt-3 text-sm text-amber-700">{activityError}</p>}
        {!activityError && activity.length === 0 ? <p className="mt-3 text-sm text-gray-500">No recent activity yet.</p> :
        <div className="mt-3 space-y-3">
          {activity.map(event => <div key={event.id} className="rounded border bg-gray-50 p-3 text-sm">
            <div className="font-semibold text-gray-900">{event.summary || event.action}</div>
            <div className="mt-1 text-xs text-gray-500">{formatActivityDate(event.createdAt)} · {event.action}</div>
          </div>)}
        </div>}
      </section>
    </div>
  </div>;
};
