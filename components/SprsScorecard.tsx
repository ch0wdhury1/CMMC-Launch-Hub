import React, { useState, useMemo, useCallback } from 'react';
import { Practice, CompanyProfile, PracticeRecord, ReadinessScores, Domain } from '../types';
import { SprsControl, SPRS_CONTROLS } from '../data/sprsControls';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CheckCircle, XCircle, HelpCircle, ChevronDown, RefreshCw, Download } from 'lucide-react';

interface SprsScorecardProps {
  practiceRecords: PracticeRecord[];
  scores: ReadinessScores;
  companyProfile: CompanyProfile | null;
  domains: Domain[];
  practiceMap: Map<string, Practice>;
}

type ControlStatus = "Met" | "Not Met" | "Not Assessed";

interface UiSprsControl extends SprsControl {
  status: ControlStatus;
  note: string;
}

const initialControlsState = SPRS_CONTROLS.map(control => ({
  ...control,
  status: "Not Met" as ControlStatus,
  note: "",
}));

const CompanyHeader = ({ profile }: { profile: CompanyProfile | null }) => (
  <div className="flex items-start p-4 mb-6 bg-gray-50 border rounded-lg">
    {profile?.companyLogo ? (
      <img src={`data:image/png;base64,${profile.companyLogo}`} alt="Logo" className="h-16 w-auto rounded-md mr-4" />
    ) : (
      <div className="h-16 w-16 bg-gray-200 rounded-md mr-4 flex items-center justify-center text-xs text-gray-500">No Logo</div>
    )}
    <div>
      <h2 className="font-bold text-xl text-gray-800">{profile?.companyName || 'Company Name'}</h2>
      <p className="text-sm text-gray-600">{profile?.address}</p>
      <a href={profile?.website} className="text-sm text-blue-600 hover:underline">{profile?.website}</a>
    </div>
  </div>
);

export const SprsScorecard: React.FC<SprsScorecardProps> = ({
  practiceRecords,
  scores,
  companyProfile,
}) => {
  const [controls, setControls] = useState<UiSprsControl[]>(initialControlsState);
  const [assessmentName, setAssessmentName] = useState<string>("Current Assessment");
  const [openFamilies, setOpenFamilies] = useState<Record<string, boolean>>({});

  const { score, metCount, notMetCount, notAssessedCount } = useMemo(() => {
    const maxScore = 110;
    const penalties = controls
      .filter(c => c.status === "Not Met")
      .reduce((sum, c) => sum + Math.abs(c.weight), 0);
    const finalScore = maxScore - penalties;

    return {
      score: finalScore,
      metCount: controls.filter(c => c.status === "Met").length,
      notMetCount: controls.filter(c => c.status === "Not Met").length,
      notAssessedCount: controls.filter(c => c.status === "Not Assessed").length,
    };
  }, [controls]);

  const practiceRecordMap = useMemo(() => new Map(practiceRecords.map(r => [r.id, r])), [practiceRecords]);

  const handleAutoFill = useCallback(() => {
    setControls(currentControls => {
      const updatedControls = currentControls.map(control => {
        if (control.note || control.status !== 'Not Met') return control;
        if (!control.mappedPracticeIds || control.mappedPracticeIds.length === 0) return control;

        const allMet = control.mappedPracticeIds.every(id => {
          const record = practiceRecordMap.get(id);
          return record?.status === 'met';
        });

        return allMet ? { ...control, status: "Met" as ControlStatus } : { ...control, status: "Not Met" as ControlStatus };
      });
      return updatedControls;
    });

    alert('SPRS controls have been updated based on your CMMC Level 1 assessment.');
  }, [practiceRecordMap]);

  const handleStatusChange = (id: string, newStatus: ControlStatus) => {
    setControls(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
  };

  const handleNoteChange = (id: string, newNote: string) => {
    setControls(prev => prev.map(c => c.id === id ? { ...c, note: newNote } : c));
  };

  const groupedControls = useMemo(() => {
    return controls.reduce((acc, control) => {
      (acc[control.family] = acc[control.family] || []).push(control);
      return acc;
    }, {} as Record<string, UiSprsControl[]>);
  }, [controls]);

  const handleExportPdf = async () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 15;
    const organizationName = companyProfile?.companyName || "Organization name not provided";
    const generatedAt = new Date();
    const completion = `${scores.practiceCompletionScore}%`;

    const drawHeader = () => {
      const logoSize = 18;
      if (companyProfile?.companyLogo) {
        try {
          doc.addImage(`data:image/png;base64,${companyProfile.companyLogo}`, "PNG", margin, 12, logoSize, logoSize);
        } catch (error) {
          doc.setFillColor(226, 232, 240);
          doc.roundedRect(margin, 12, logoSize, logoSize, 1.5, 1.5, "F");
        }
      } else {
        doc.setFillColor(226, 232, 240);
        doc.roundedRect(margin, 12, logoSize, logoSize, 1.5, 1.5, "F");
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(17, 24, 39);
      doc.text(organizationName, margin + logoSize + 6, 18);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(75, 85, 99);
      const headerDetails = [companyProfile?.address, companyProfile?.website].filter(Boolean).join(" | ");
      if (headerDetails) doc.text(headerDetails, margin + logoSize + 6, 24, { maxWidth: pageWidth - margin * 2 - logoSize - 6 });
      doc.setDrawColor(209, 213, 219);
      doc.line(margin, 36, pageWidth - margin, 36);
    };

    drawHeader();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(40, 58, 86);
    doc.text("SPRS Scorecard", margin, 54);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(75, 85, 99);
    doc.text(`Assessment: ${assessmentName}`, margin, 63);
    doc.text(`Organization: ${organizationName}`, margin, 70);
    doc.text(`Generated: ${generatedAt.toLocaleString()}`, margin, 77);

    autoTable(doc, {
      startY: 90,
      head: [['Final SPRS Score', 'Controls Met', 'Not Met', 'Not Assessed', 'Completion']],
      body: [[String(score), String(metCount), String(notMetCount), String(notAssessedCount), completion]],
      theme: 'grid',
      styles: { fontSize: 11, cellPadding: 4, halign: 'center' },
      headStyles: { fillColor: [0, 87, 163], halign: 'center' },
      bodyStyles: { fontStyle: 'bold' },
      columnStyles: { 0: { fontSize: 16, textColor: [0, 87, 163] } },
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(75, 85, 99);
    const summaryNote = "This export summarizes the SPRS scorecard only. It does not include the full CMMC practice or assessment-objective detail.";
    doc.text(doc.splitTextToSize(summaryNote, pageWidth - margin * 2), margin, ((doc as any).lastAutoTable.finalY || 116) + 12);

    doc.addPage();
    drawHeader();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(40, 58, 86);
    doc.text("Mapped SPRS Controls Status", margin, 50);

    const sprsTableData = controls.map(c => [c.id, c.family, c.description, String(c.weight), c.status, c.note || ""]);
    autoTable(doc, {
      startY: 58,
      head: [['NIST ID', 'Family', 'Description', 'Weight', 'Status', 'Note']],
      body: sprsTableData,
      theme: 'striped',
      margin: { top: 42, right: margin, bottom: 18, left: margin },
      styles: { fontSize: 7.5, cellPadding: 2, overflow: 'linebreak', valign: 'top' },
      headStyles: { fillColor: [0, 87, 163] },
      columnStyles: {
        0: { cellWidth: 17 },
        1: { cellWidth: 28 },
        2: { cellWidth: 76 },
        3: { cellWidth: 14, halign: 'center' },
        4: { cellWidth: 23 },
        5: { cellWidth: 28 },
      },
      didParseCell: data => {
        if (data.section === 'body' && data.column.index === 4) {
          if (data.cell.raw === 'Met') data.cell.styles.textColor = [34, 139, 34];
          if (data.cell.raw === 'Not Met') data.cell.styles.textColor = [255, 0, 0];
          if (data.cell.raw === 'Not Assessed') data.cell.styles.textColor = [128, 128, 128];
        }
      },
      didDrawPage: () => {
        if (doc.getCurrentPageInfo().pageNumber > 1) drawHeader();
      },
    });

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(150);
      doc.text("CMMC Launch Hub — SPRS Scorecard", margin, pageHeight - 10);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 10, { align: "right" });
    }

    doc.save(`SPRS_Scorecard_${assessmentName.replace(/ /g, '_')}.pdf`);
  };

  const getScoreColor = (s: number) => {
    if (s <= 0) return 'bg-red-500';
    if (s < 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <CompanyHeader profile={companyProfile} />
      {/* Summary Panel */}
      <div className="bg-white p-6 rounded-lg shadow-md border">
        <div className="flex justify-between items-start">
            <div>
                <h2 className="text-2xl font-bold text-gray-800">SPRS Score: <span className="text-blue-600">{score}</span></h2>
                <p className="text-sm text-gray-500">Official NIST SP 800-171 DoD Assessment Score</p>
            </div>
            <div className="flex space-x-2">
                <button onClick={handleAutoFill} className="flex items-center text-sm px-3 py-1.5 border border-blue-600 text-blue-600 rounded-md hover:bg-blue-50">
                    <RefreshCw className="h-4 w-4 mr-2"/> Auto-fill from CMMC L1
                </button>
                <button onClick={handleExportPdf} className="flex items-center text-sm px-3 py-1.5 border border-gray-600 text-gray-700 rounded-md hover:bg-gray-100">
                    <Download className="h-4 w-4 mr-2"/> Export SPRS PDF
                </button>
            </div>
        </div>
        <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className={`${getScoreColor(score)} h-2.5 rounded-full`} style={{ width: `${Math.max(0, (score + 203) / (110 + 203) * 100)}%` }}></div>
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>-203</span>
                <span>110</span>
            </div>
        </div>
        <div className="mt-4 flex items-center space-x-4 text-sm">
            <span className="flex items-center"><CheckCircle className="h-4 w-4 mr-1 text-green-500"/>Met: {metCount}</span>
            <span className="flex items-center"><XCircle className="h-4 w-4 mr-1 text-red-500"/>Not Met: {notMetCount}</span>
            <span className="flex items-center"><HelpCircle className="h-4 w-4 mr-1 text-gray-400"/>Not Assessed: {notAssessedCount}</span>
            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">CMMC L1: {scores.practiceCompletionScore}%</span>
        </div>
      </div>

      {/* Controls Table */}
      <div className="space-y-2">
        {(Object.entries(groupedControls) as [string, UiSprsControl[]][]).map(([family, familyControls]) => {
            const familyMetCount = familyControls.filter(c => c.status === "Met").length;
            const isOpen = openFamilies[family] ?? false;
            return (
              <div key={family} className="bg-white rounded-lg border shadow-sm overflow-hidden">
                <button onClick={() => setOpenFamilies(prev => ({...prev, [family]: !isOpen }))} className="w-full flex justify-between items-center p-4 text-left">
                    <h3 className="font-semibold text-lg">{family}</h3>
                    <div className="flex items-center space-x-3">
                        <span className="text-sm font-medium text-gray-600">{familyMetCount} / {familyControls.length} Met</span>
                        <ChevronDown className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </div>
                </button>
                {isOpen && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wider">
                            <tr>
                                <th className="p-3">NIST ID</th>
                                <th className="p-3">Description</th>
                                <th className="p-3">Level</th>
                                <th className="p-3 text-center">Weight</th>
                                <th className="p-3">Status</th>
                                <th className="p-3">Note</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                        {familyControls.map(control => {
                            const isLevel1 = (control.mappedPracticeIds || []).some(id => id.includes("L1"));
                            return (
                                <tr key={control.id} className={`${isLevel1 ? "font-bold bg-blue-50" : ""}`}>
                                    <td className="p-3 font-mono">{control.id}</td>
                                    <td className="p-3 text-gray-600">{control.description}</td>
                                    <td className="p-3">
                                        {isLevel1 ? (
                                            <span className="px-2 py-0.5 bg-blue-200 text-blue-800 text-xs rounded-full">L1</span>
                                        ) : (
                                            <span className="px-2 py-0.5 bg-gray-200 text-gray-700 text-xs rounded-full">L2</span>
                                        )}
                                    </td>
                                    <td className="p-3 text-center font-medium">{control.weight}</td>
                                    <td className="p-3">
                                        <select value={control.status} onChange={e => handleStatusChange(control.id, e.target.value as ControlStatus)} className="p-1 border rounded text-xs bg-white text-black">
                                            <option>Not Met</option>
                                            <option>Met</option>
                                            <option>Not Assessed</option>
                                        </select>
                                    </td>
                                    <td className="p-3">
                                        <input type="text" value={control.note} onChange={e => handleNoteChange(control.id, e.target.value)} className="w-full border p-1 rounded text-xs bg-white text-black" placeholder="Add note..."/>
                                    </td>
                                </tr>
                            );
                        })}
                        </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
        })}
      </div>
    </div>
  );
};
