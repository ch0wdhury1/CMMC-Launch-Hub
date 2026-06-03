import React, { useState } from "react";
import { Download, FileText, Loader2, RefreshCw } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { buildPoamReport, formatPoamReportDate, type PoamReportData, type PoamReportItem } from "../src/poamReport";
import { logActivityEvent } from "../src/activityLog";
import type { PoamItem } from "../types";

type Props = {
  orgId: string | null;
  assessmentId: string;
  assessmentLevel: string;
  poamItems: PoamItem[];
  canExport: boolean;
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="bg-white border rounded-lg p-5 shadow-sm">
    <h2 className="text-lg font-bold text-gray-900 mb-4">{title}</h2>
    {children}
  </section>
);

const Metric = ({ label, value }: { label: string; value: number }) => (
  <div className="border rounded-md p-3 bg-gray-50">
    <div className="text-xs font-semibold uppercase text-gray-500">{label}</div>
    <div className="text-2xl font-bold text-gray-900 mt-1">{value}</div>
  </div>
);

const itemLabel = (item: PoamReportItem) => item.practiceIds.join(", ") || item.id;

const exportPdf = (report: PoamReportData) => {
  const doc = new jsPDF({ orientation: "landscape" });
  const margin = 12;
  let y = 14;
  const addTitle = (title: string) => {
    if (y > 185) {
      doc.addPage();
      y = 14;
    }
    doc.setFontSize(12);
    doc.setTextColor(17, 24, 39);
    doc.text(title, margin, y);
    y += 6;
  };
  const addTable = (head: string[], body: Array<Array<string | number>>) => {
    autoTable(doc, { startY: y, head: [head], body, theme: "grid", styles: { fontSize: 7, cellPadding: 1.8 } });
    y = (doc as any).lastAutoTable.finalY + 7;
  };
  const addList = (items: string[]) => {
    doc.setFontSize(8);
    doc.setTextColor(55, 65, 81);
    items.forEach((item, index) => {
      const lines = doc.splitTextToSize(`${index + 1}. ${item}`, 270);
      if (y + lines.length * 4 > 195) {
        doc.addPage();
        y = 14;
      }
      doc.text(lines, margin, y);
      y += lines.length * 4 + 1;
    });
    y += 3;
  };
  const groupRows = (groups: Array<[string, PoamReportItem[]]>) =>
    groups.flatMap(([priority, items]) => items.length > 0
      ? items.map(item => [priority, itemLabel(item), item.owner, item.status.replace("_", " "), formatPoamReportDate(item.dueDate)])
      : [[priority, "No items", "-", "-", "-"]]);

  doc.setFontSize(17);
  doc.setTextColor(0, 87, 163);
  doc.text("POA&M Report", margin, y);
  y += 7;
  doc.setFontSize(8);
  doc.setTextColor(75, 85, 99);
  doc.text(`Generated ${report.generatedAt.toLocaleString()}`, margin, y);
  y += 8;

  addTitle("Organization Summary");
  addTable(["Organization", "CAGE", "UEI", "Assessment Level"], [[report.organization.legalName, report.organization.cageCode, report.organization.uei, report.organization.assessmentLevel]]);
  addTitle("POA&M Summary Dashboard");
  addTable(["Total", "Open", "In Progress", "Closed", "High", "Medium", "Low", "Overdue"], [[
    report.summary.totalItems, report.summary.openItems, report.summary.inProgressItems, report.summary.closedItems,
    report.summary.highPriorityItems, report.summary.mediumPriorityItems, report.summary.lowPriorityItems, report.summary.overdueItems,
  ]]);
  addTitle("Open Items by Priority");
  addTable(["Priority", "Practice", "Owner", "Status", "Due Date"], groupRows([
    ["High", report.openByPriority.high], ["Medium", report.openByPriority.medium], ["Low", report.openByPriority.low], ["Unassigned / Unknown", report.openByPriority.unknown],
  ]));
  addTitle("Upcoming / Overdue Items");
  addTable(["Group", "Practice", "Owner", "Priority", "Due Date"], groupRows([
    ["Overdue", report.schedule.overdue], ["Due Within 30 Days", report.schedule.dueWithin30Days], ["No Due Date", report.schedule.noDueDate],
  ]));
  addTitle("Owner Responsibility Summary");
  addTable(["Owner", "Open", "In Progress", "Closed", "Overdue"], report.owners.map(owner => [owner.owner, owner.openCount, owner.inProgressCount, owner.closedCount, owner.overdueCount]));
  addTitle("Detailed POA&M Table");
  addTable(["Practice ID", "Objective ID", "Weakness / Gap", "Remediation Plan", "Owner", "Priority", "Status", "Due Date", "Last Updated"], report.details.map(item => [
    item.practiceIds.join(", ") || "-", item.objectiveIds.join(", ") || "-", item.weakness, item.remediationPlan, item.owner,
    item.priority || "unknown", item.status.replace("_", " "), formatPoamReportDate(item.dueDate), formatPoamReportDate(item.lastUpdated),
  ]));
  addTitle("Closed Items Summary");
  addTable(["Practice", "Weakness / Gap", "Owner", "Completed"], report.closedItems.length > 0
    ? report.closedItems.map(item => [itemLabel(item), item.weakness, item.owner, formatPoamReportDate(item.completedDate || item.lastUpdated)])
    : [["-", "No closed items", "-", "-"]]);
  addTitle("Recommended Remediation Focus");
  addList(report.recommendations);
  doc.save(`POAM_Report_${report.generatedAt.toISOString().slice(0, 10)}.pdf`);
};

const ScheduleList = ({ items, emptyText }: { items: PoamReportItem[]; emptyText: string }) => (
  items.length > 0
    ? <ul className="space-y-2 text-sm">{items.map(item => <li key={item.id} className="border-b pb-2"><strong>{itemLabel(item)}</strong><span className="text-gray-500"> · {item.owner} · {formatPoamReportDate(item.dueDate)}</span></li>)}</ul>
    : <p className="text-sm text-gray-500">{emptyText}</p>
);

export const PoamReport: React.FC<Props> = props => {
  const [report, setReport] = useState<PoamReportData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");

  const generate = async () => {
    setIsGenerating(true);
    setError("");
    try {
      const generated = await buildPoamReport(props);
      setReport(generated);
      void logActivityEvent({
        orgId: props.orgId,
        orgName: generated.organization.legalName,
        action: "report.generated",
        targetType: "report",
        targetId: "poam",
        targetLabel: "POA&M Report",
        summary: "POA&M Report generated",
        metadata: {assessmentId: props.assessmentId, assessmentLevel: props.assessmentLevel},
      });
    } catch (reportError) {
      console.error("[poam-report] generation failed", reportError);
      setError("Unable to generate the POA&M report.");
    } finally {
      setIsGenerating(false);
    }
  };

  if (!report) {
    return (
      <div className="bg-white border rounded-lg p-6 shadow-sm animate-fadeIn">
        <div className="flex items-start gap-4">
          <FileText className="h-9 w-9 text-blue-600" />
          <div>
            <h2 className="text-xl font-bold text-gray-900">POA&M Report</h2>
            <p className="text-sm text-gray-600 mt-1">Generate an on-demand remediation report from the current assessment records.</p>
            <button type="button" onClick={generate} disabled={isGenerating} className="mt-5 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-60">
              {isGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
              {isGenerating ? "Generating..." : "Generate Report"}
            </button>
            {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
          </div>
        </div>
      </div>
    );
  }

  if (report.summary.totalItems === 0) {
    return (
      <div className="bg-white border rounded-lg p-6 shadow-sm animate-fadeIn">
        <h2 className="text-xl font-bold text-gray-900">POA&M Report</h2>
        <p className="text-sm font-semibold text-gray-700 mt-1">{report.organization.legalName}</p>
        <p className="text-sm text-gray-600 mt-3">No POA&M items found for this assessment.</p>
        <button type="button" onClick={generate} className="mt-5 inline-flex items-center px-3 py-2 border rounded-md text-sm text-gray-700 hover:bg-gray-50"><RefreshCw className="h-4 w-4 mr-2" /> Refresh</button>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="bg-white border rounded-lg p-5 shadow-sm flex flex-wrap items-start justify-between gap-4">
        <div><h2 className="text-xl font-bold text-gray-900">POA&M Report</h2><p className="text-sm text-gray-500 mt-1">Generated {report.generatedAt.toLocaleString()}</p></div>
        <div className="flex gap-2">
          <button type="button" onClick={generate} disabled={isGenerating} className="inline-flex items-center px-3 py-2 border rounded-md text-sm text-gray-700 hover:bg-gray-50"><RefreshCw className={`h-4 w-4 mr-2 ${isGenerating ? "animate-spin" : ""}`} /> Refresh</button>
          <button type="button" onClick={() => exportPdf(report)} disabled={!props.canExport} title={props.canExport ? "Export PDF" : "PDF export requires Org Admin or SuperAdmin access"} className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"><Download className="h-4 w-4 mr-2" /> Export PDF</button>
        </div>
      </div>

      <Section title="Organization Summary"><dl className="grid grid-cols-1 md:grid-cols-5 gap-3 text-sm">
        <div><dt className="text-gray-500">Legal Company Name</dt><dd className="font-semibold">{report.organization.legalName}</dd></div>
        <div><dt className="text-gray-500">CAGE</dt><dd className="font-semibold">{report.organization.cageCode}</dd></div>
        <div><dt className="text-gray-500">UEI</dt><dd className="font-semibold">{report.organization.uei}</dd></div>
        <div><dt className="text-gray-500">Assessment Level</dt><dd className="font-semibold">{report.organization.assessmentLevel}</dd></div>
        <div><dt className="text-gray-500">Report Date</dt><dd className="font-semibold">{report.generatedAt.toLocaleDateString()}</dd></div>
      </dl></Section>

      <Section title="POA&M Summary Dashboard"><div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric label="Total Items" value={report.summary.totalItems} /><Metric label="Open Items" value={report.summary.openItems} />
        <Metric label="In Progress" value={report.summary.inProgressItems} /><Metric label="Closed Items" value={report.summary.closedItems} />
        <Metric label="High Priority" value={report.summary.highPriorityItems} /><Metric label="Medium Priority" value={report.summary.mediumPriorityItems} />
        <Metric label="Low Priority" value={report.summary.lowPriorityItems} /><Metric label="Overdue Items" value={report.summary.overdueItems} />
      </div></Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Section title="Open Items by Priority">
          {(["high", "medium", "low", "unknown"] as const).map(priority => <div key={priority} className="mb-4"><h3 className="text-sm font-bold capitalize text-gray-700 mb-2">{priority === "unknown" ? "Unassigned / Unknown" : priority}</h3><ScheduleList items={report.openByPriority[priority]} emptyText="No items." /></div>)}
        </Section>
        <Section title="Upcoming / Overdue Items">
          <h3 className="text-sm font-bold text-red-700 mb-2">Overdue</h3><ScheduleList items={report.schedule.overdue} emptyText="No overdue items." />
          <h3 className="text-sm font-bold text-gray-700 mt-4 mb-2">Due Within 30 Days</h3><ScheduleList items={report.schedule.dueWithin30Days} emptyText="No items due within 30 days." />
          <h3 className="text-sm font-bold text-gray-700 mt-4 mb-2">No Due Date</h3><ScheduleList items={report.schedule.noDueDate} emptyText="All active items have due dates." />
        </Section>
      </div>

      <Section title="Owner Responsibility Summary"><div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="text-xs uppercase text-gray-500 border-b"><tr><th className="py-2">Owner</th><th>Open</th><th>In Progress</th><th>Closed</th><th>Overdue</th></tr></thead><tbody>{report.owners.map(owner => <tr key={owner.owner} className="border-b"><td className="py-2 font-semibold">{owner.owner}</td><td>{owner.openCount}</td><td>{owner.inProgressCount}</td><td>{owner.closedCount}</td><td>{owner.overdueCount}</td></tr>)}</tbody></table></div></Section>
      <Section title="Detailed POA&M Table"><div className="overflow-x-auto"><table className="w-full text-xs text-left"><thead className="uppercase text-gray-500 border-b"><tr><th className="py-2 pr-3">Practice ID</th><th className="pr-3">Objective ID</th><th className="pr-3">Weakness / Gap</th><th className="pr-3">Remediation Plan</th><th className="pr-3">Owner</th><th className="pr-3">Priority</th><th className="pr-3">Status</th><th className="pr-3">Due Date</th><th>Last Updated</th></tr></thead><tbody>{report.details.map(item => <tr key={item.id} className="border-b align-top"><td className="py-2 pr-3">{item.practiceIds.join(", ") || "-"}</td><td className="pr-3">{item.objectiveIds.join(", ") || "-"}</td><td className="pr-3">{item.weakness}</td><td className="pr-3">{item.remediationPlan}</td><td className="pr-3">{item.owner}</td><td className="pr-3 capitalize">{item.priority || "unknown"}</td><td className="pr-3 capitalize">{item.status.replace("_", " ")}</td><td className="pr-3">{formatPoamReportDate(item.dueDate)}</td><td>{formatPoamReportDate(item.lastUpdated)}</td></tr>)}</tbody></table></div></Section>
      <Section title="Closed Items Summary"><ScheduleList items={report.closedItems} emptyText="No closed POA&M items are available." /></Section>
      <Section title="Recommended Remediation Focus"><ol className="list-decimal pl-5 space-y-2 text-sm text-gray-700">{report.recommendations.map(item => <li key={item}>{item}</li>)}</ol></Section>
    </div>
  );
};
