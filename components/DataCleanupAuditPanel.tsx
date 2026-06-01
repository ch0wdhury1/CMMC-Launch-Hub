import React, { useMemo, useState } from "react";
import { Download, Loader2, Search } from "lucide-react";
import { runCleanupAudit } from "../src/cleanupAudit";
import type { CleanupAuditFinding, CleanupAuditResult } from "../types";

const categories: Array<CleanupAuditFinding["category"]> = [
  "duplicate_org",
  "missing_org_fields",
  "no_active_members",
  "orphaned_user",
  "orphaned_membership",
  "stale_request",
  "evidence_metadata_issue",
  "assessment_integrity_issue",
  "invitation_membership_issue",
];

const downloadJson = (result: CleanupAuditResult) => {
  const blobUrl = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], {type: "application/json"}));
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = `cmmc-launch-hub-cleanup-audit-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(blobUrl);
};

export const DataCleanupAuditPanel: React.FC = () => {
  const [result, setResult] = useState<CleanupAuditResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("all");
  const [severity, setSeverity] = useState("all");
  const [recommendation, setRecommendation] = useState("all");

  const findings = useMemo(() => (result?.findings || [])
    .filter(finding => category === "all" || finding.category === category)
    .filter(finding => severity === "all" || finding.severity === severity)
    .filter(finding => recommendation === "all" || finding.recommendation === recommendation),
  [category, recommendation, result, severity]);

  const runAudit = async () => {
    setIsRunning(true);
    setError("");
    try {
      setResult(await runCleanupAudit());
    } catch (auditError) {
      console.warn("[cleanup-audit] audit failed", auditError);
      setError("Cleanup audit failed.");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <section className="space-y-3">
      <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Data Cleanup Audit</h4>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={runAudit} disabled={isRunning} className="flex items-center px-3 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-md hover:bg-indigo-500 disabled:opacity-60">
          {isRunning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
          {isRunning ? "Running cleanup audit..." : "Run Cleanup Audit"}
        </button>
        {result && <button type="button" onClick={() => downloadJson(result)} className="flex items-center px-3 py-2 bg-gray-700 text-white text-xs font-semibold rounded-md hover:bg-gray-600"><Download className="h-4 w-4 mr-2" /> Export Audit JSON</button>}
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {result && (
        <>
          <div className="grid grid-cols-2 gap-2">
            {[
              ["Total Findings", result.totalFindings],
              ["High Severity", result.highCount],
              ["Medium Severity", result.mediumCount],
              ["Low Severity", result.lowCount],
              ["Safe to Archive", result.safeToArchiveCount],
              ["Needs Review", result.needsReviewCount],
              ["Do Not Touch", result.doNotTouchCount],
            ].map(([label, value]) => <div key={label} className="p-2 bg-gray-800 rounded border border-gray-700"><p className="text-[9px] uppercase text-gray-500">{label}</p><p className="text-lg font-bold text-white">{value}</p></div>)}
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={category} onChange={event => setCategory(event.target.value)} className="bg-gray-800 border border-gray-700 text-xs rounded p-2"><option value="all">All categories</option>{categories.map(value => <option key={value} value={value}>{value}</option>)}</select>
            <select value={severity} onChange={event => setSeverity(event.target.value)} className="bg-gray-800 border border-gray-700 text-xs rounded p-2"><option value="all">All severities</option><option value="high">high</option><option value="medium">medium</option><option value="low">low</option></select>
            <select value={recommendation} onChange={event => setRecommendation(event.target.value)} className="bg-gray-800 border border-gray-700 text-xs rounded p-2"><option value="all">All recommendations</option><option value="safe_to_archive">safe_to_archive</option><option value="needs_review">needs_review</option><option value="do_not_touch">do_not_touch</option></select>
          </div>
          <div className="overflow-x-auto border border-gray-800 rounded">
            <table className="w-full text-[10px] text-left">
              <thead className="bg-gray-800 text-gray-400 uppercase"><tr><th className="p-2">Severity</th><th className="p-2">Category</th><th className="p-2">Recommendation</th><th className="p-2">Title</th><th className="p-2">Description</th><th className="p-2">Org ID</th><th className="p-2">User ID</th><th className="p-2">Related IDs</th></tr></thead>
              <tbody className="divide-y divide-gray-800">{findings.map(finding => <tr key={finding.id}><td className="p-2">{finding.severity}</td><td className="p-2">{finding.category}</td><td className="p-2">{finding.recommendation}</td><td className="p-2">{finding.title}</td><td className="p-2 min-w-72">{finding.description}</td><td className="p-2 font-mono">{finding.orgId || "-"}</td><td className="p-2 font-mono">{finding.userId || "-"}</td><td className="p-2 font-mono">{finding.relatedIds?.join(", ") || "-"}</td></tr>)}</tbody>
            </table>
            {findings.length === 0 && <p className="p-3 text-xs text-gray-500">No findings match the current filters.</p>}
          </div>
        </>
      )}
    </section>
  );
};
