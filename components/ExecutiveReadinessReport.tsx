import React, { useState } from "react";
import { Download, FileBarChart, Loader2, RefreshCw } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  buildExecutiveReadinessReport,
  type ExecutiveReadinessReportData,
} from "../src/executiveReadinessReport";
import type { Domain, EvidenceSummary, PoamItem, PracticeRecord } from "../types";

type Props = {
  orgId: string | null;
  assessmentId: string;
  assessmentLevel: string;
  domains: Domain[];
  practiceRecords: PracticeRecord[];
  poamItems: PoamItem[];
  evidenceSummary: EvidenceSummary;
  getDomainCompletion: (domainName: string) => number;
  canExport: boolean;
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="bg-white border rounded-lg p-5 shadow-sm">
    <h2 className="text-lg font-bold text-gray-900 mb-4">{title}</h2>
    {children}
  </section>
);

const Metric = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="border rounded-md p-3 bg-gray-50">
    <div className="text-xs font-semibold uppercase text-gray-500">{label}</div>
    <div className="text-2xl font-bold text-gray-900 mt-1">{value}</div>
  </div>
);

const exportPdf = (report: ExecutiveReadinessReportData) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 16;
  const addTitle = (title: string) => {
    if (y > 265) {
      doc.addPage();
      y = 16;
    }
    doc.setFontSize(13);
    doc.setTextColor(17, 24, 39);
    doc.text(title, margin, y);
    y += 7;
  };
  const addWrappedText = (text: string) => {
    doc.setFontSize(9);
    doc.setTextColor(55, 65, 81);
    const lines = doc.splitTextToSize(text, pageWidth - margin * 2);
    if (y + lines.length * 4 > 280) {
      doc.addPage();
      y = 16;
    }
    doc.text(lines, margin, y);
    y += lines.length * 4 + 4;
  };
  const addTable = (head: string[], body: Array<Array<string | number>>) => {
    autoTable(doc, { startY: y, head: [head], body, theme: "grid", styles: { fontSize: 8 } });
    y = (doc as any).lastAutoTable.finalY + 8;
  };

  doc.setFontSize(18);
  doc.setTextColor(0, 87, 163);
  doc.text("Executive Readiness Report", margin, y);
  y += 8;
  doc.setFontSize(9);
  doc.setTextColor(75, 85, 99);
  doc.text(`Generated ${report.generatedAt.toLocaleString()}`, margin, y);
  y += 9;

  addTitle("Organization Summary");
  addTable(["Organization", "CAGE", "UEI", "Assessment Level"], [[
    report.organization.legalName,
    report.organization.cageCode,
    report.organization.uei,
    report.organization.assessmentLevel,
  ]]);

  addTitle("Readiness Summary");
  addTable(["Overall Readiness", "Completed", "In Progress", "Not Started"], [[
    `${report.readiness.overallPercent}%`,
    report.readiness.completedCount,
    report.readiness.inProgressCount,
    report.readiness.notStartedCount,
  ]]);

  addTitle("Domain Summary");
  addTable(["Domain", "Readiness"], report.domains.map(domain => [domain.name, `${domain.readinessPercent}%`]));

  addTitle("Top Risk Areas");
  addTable(["Domain", "Readiness"], report.topRiskAreas.map(domain => [domain.name, `${domain.readinessPercent}%`]));

  addTitle("POA&M Summary");
  addTable(["Open Items", "High Priority", "Medium Priority", "Low Priority"], [[
    report.poam.openItems, report.poam.highPriority, report.poam.mediumPriority, report.poam.lowPriority,
  ]]);

  addTitle("Evidence Summary");
  addTable(["Evidence Library", "Practice Evidence", "Reused Evidence", "Archived Evidence"], [[
    report.evidence.libraryCount,
    report.evidence.practiceEvidenceCount,
    report.evidence.reusedEvidenceCount,
    report.evidence.archivedEvidenceCount,
  ]]);

  addTitle("Executive Narrative");
  addWrappedText(report.narrative);

  addTitle("Recommended Next Steps");
  report.recommendations.forEach((recommendation, index) => addWrappedText(`${index + 1}. ${recommendation}`));
  doc.save(`Executive_Readiness_Report_${report.generatedAt.toISOString().slice(0, 10)}.pdf`);
};

export const ExecutiveReadinessReport: React.FC<Props> = props => {
  const [report, setReport] = useState<ExecutiveReadinessReportData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");

  const generate = async () => {
    setIsGenerating(true);
    setError("");
    try {
      setReport(await buildExecutiveReadinessReport(props));
    } catch (reportError) {
      console.error("[executive-readiness-report] generation failed", reportError);
      setError("Unable to generate the executive readiness report.");
    } finally {
      setIsGenerating(false);
    }
  };

  if (!report) {
    return (
      <div className="bg-white border rounded-lg p-6 shadow-sm animate-fadeIn">
        <div className="flex items-start gap-4">
          <FileBarChart className="h-9 w-9 text-blue-600" />
          <div>
            <h2 className="text-xl font-bold text-gray-900">Executive Readiness Report</h2>
            <p className="text-sm text-gray-600 mt-1">Generate an on-demand management view from the current assessment, evidence, and remediation records.</p>
            <button type="button" onClick={generate} disabled={isGenerating} className="mt-5 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-60">
              {isGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileBarChart className="h-4 w-4 mr-2" />}
              {isGenerating ? "Generating..." : "Generate Report"}
            </button>
            {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="bg-white border rounded-lg p-5 shadow-sm flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Executive Readiness Report</h2>
          <p className="text-sm text-gray-500 mt-1">Generated {report.generatedAt.toLocaleString()}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={generate} disabled={isGenerating} className="inline-flex items-center px-3 py-2 border rounded-md text-sm text-gray-700 hover:bg-gray-50">
            <RefreshCw className={`h-4 w-4 mr-2 ${isGenerating ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button type="button" onClick={() => exportPdf(report)} disabled={!props.canExport} title={props.canExport ? "Export PDF" : "PDF export requires Org Admin or SuperAdmin access"} className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50">
            <Download className="h-4 w-4 mr-2" /> Export PDF
          </button>
        </div>
      </div>

      <Section title="Organization Summary">
        <dl className="grid grid-cols-1 md:grid-cols-5 gap-3 text-sm">
          <div><dt className="text-gray-500">Legal Company Name</dt><dd className="font-semibold">{report.organization.legalName}</dd></div>
          <div><dt className="text-gray-500">CAGE</dt><dd className="font-semibold">{report.organization.cageCode}</dd></div>
          <div><dt className="text-gray-500">UEI</dt><dd className="font-semibold">{report.organization.uei}</dd></div>
          <div><dt className="text-gray-500">Assessment Level</dt><dd className="font-semibold">{report.organization.assessmentLevel}</dd></div>
          <div><dt className="text-gray-500">Report Date</dt><dd className="font-semibold">{report.generatedAt.toLocaleDateString()}</dd></div>
        </dl>
      </Section>

      <Section title="Readiness Summary">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Metric label="Overall Readiness" value={`${report.readiness.overallPercent}%`} />
          <Metric label="Completed" value={report.readiness.completedCount} />
          <Metric label="In Progress" value={report.readiness.inProgressCount} />
          <Metric label="Not Started" value={report.readiness.notStartedCount} />
        </div>
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Section title="Domain Summary">
          <div className="space-y-3">{report.domains.map(domain => <div key={domain.name} className="flex justify-between gap-3 text-sm"><span>{domain.name}</span><strong>{domain.readinessPercent}%</strong></div>)}</div>
        </Section>
        <Section title="Top Risk Areas">
          <div className="space-y-3">{report.topRiskAreas.map(domain => <div key={domain.name} className="flex justify-between gap-3 text-sm"><span>{domain.name}</span><strong className="text-red-700">{domain.readinessPercent}%</strong></div>)}</div>
        </Section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Section title="POA&M Summary">
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Open Items" value={report.poam.openItems} /><Metric label="High Priority" value={report.poam.highPriority} />
            <Metric label="Medium Priority" value={report.poam.mediumPriority} /><Metric label="Low Priority" value={report.poam.lowPriority} />
          </div>
        </Section>
        <Section title="Evidence Summary">
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Evidence Library" value={report.evidence.libraryCount} /><Metric label="Practice Evidence" value={report.evidence.practiceEvidenceCount} />
            <Metric label="Reused Evidence" value={report.evidence.reusedEvidenceCount} /><Metric label="Archived Evidence" value={report.evidence.archivedEvidenceCount} />
          </div>
        </Section>
      </div>

      <Section title="Executive Narrative"><p className="text-sm leading-6 text-gray-700">{report.narrative}</p></Section>
      <Section title="Recommended Next Steps"><ol className="list-decimal pl-5 space-y-2 text-sm text-gray-700">{report.recommendations.map(item => <li key={item}>{item}</li>)}</ol></Section>
    </div>
  );
};
