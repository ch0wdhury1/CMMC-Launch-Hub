
import React, { useState, useMemo, useCallback } from 'react';
import { Practice, CompanyProfile, PracticeRecord, ReadinessScores, Domain } from '../types';
import { SprsControl, SPRS_CONTROLS } from '../data/sprsControls';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getCompanyHeaderHtml } from '../services/pdfUtils';
import { CheckCircle, XCircle, HelpCircle, ChevronDown, RefreshCw, Download } from 'lucide-react';

interface SprsScorecardProps {
  practiceRecords: PracticeRecord[];
  scores: ReadinessScores;
  companyProfile: CompanyProfile | null;
  domains: Domain[]; // Added for PDF export
  practiceMap: Map<string, Practice>; // Added for PDF export
}

type ControlStatus = "Met" | "Not Met" | "Not Assessed";

interface UiSprsControl extends SprsControl {
  status: ControlStatus;
  note: string;
}

const initialControlsState = SPRS_CONTROLS.map(control => ({
  ...control,
  status: "Not Met" as ControlStatus, // Default to Not Met
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
  domains, // Destructure domains
  practiceMap, // Destructure practiceMap
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
        // Don't overwrite manually changed statuses
        if (control.note || control.status !== 'Not Met') {
          // A simple heuristic: if user has touched it, don't auto-fill.
          // You might want a more robust "isDirty" flag in a real app.
          return control;
        }

        if (!control.mappedPracticeIds || control.mappedPracticeIds.length === 0) {
          return control;
        }
        
        const allMet = control.mappedPracticeIds.every(id => {
          const record = practiceRecordMap.get(id);
          return record?.status === 'met';
        });

        if (allMet) {
          return { ...control, status: "Met" as ControlStatus };
        } else {
          // It's already "Not Met" by default, so no change needed, but explicit for clarity
          return { ...control, status: "Not Met" as ControlStatus };
        }
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
    const doc = new jsPDF();
    // Fix: Define pageWidth and margin
    const pageWidth = doc.internal.pageSize.width;
    const margin = 15;

    const headerHtml = getCompanyHeaderHtml(companyProfile); // Moved here so it's defined
    await doc.html(headerHtml, {
      x: 15,
      y: 15,
      width: 180,
      windowWidth: 650,
    });

    // Start content after the header (estimated position)
    let yPos = 90;

    doc.setFontSize(24).setTextColor(40, 58, 86); // Dark blue for main title
    doc.text("SPRS Scorecard & CMMC Assessment", 15, yPos);
    yPos += 15;
    
    doc.setFontSize(14).setTextColor(100);
    doc.text(`Assessment: ${assessmentName}`, 15, yPos);
    yPos += 20; // Extra space after subtitle

    // Summary Table
    autoTable(doc, {
        startY: yPos,
        head: [['Summary']],
        body: [
            [`Final SPRS Score: ${score}`],
            [`Controls Met: ${metCount}`],
            [`Controls Not Met: ${notMetCount}`],
            [`Controls Not Assessed: ${notAssessedCount}`],
            [`Overall CMMC L1 Completion: ${scores.practiceCompletionScore}%`],
        ],
        theme: 'grid',
        headStyles: { fillColor: [0, 87, 163] } // Match primary blue
    });
    yPos = (doc as any).lastAutoTable.finalY + 15; // Space after summary table
    
    // SPRS Controls Table
    doc.setFontSize(18).setTextColor(40, 58, 86);
    doc.text("Mapped SPRS Controls Status", 15, yPos);
    yPos += 10;
    
    const sprsTableData = controls.map(c => [c.id, doc.splitTextToSize(c.description, 70), c.weight, c.status, doc.splitTextToSize(c.note, 40)]);
    autoTable(doc, {
        startY: yPos,
        head: [['NIST ID', 'Description', 'Weight', 'Status', 'Note']],
        body: sprsTableData,
        theme: 'striped',
        headStyles: { fillColor: [0, 87, 163] },
        columnStyles: { 0: { cellWidth: 25 }, 1: { cellWidth: 75 }, 2: { cellWidth: 15, halign: 'center' }, 3: { cellWidth: 25 }, 4: { cellWidth: 'auto' } },
        didParseCell: function (data) {
          if (data.section === 'body' && data.column.index === 3) {
            if (data.cell.raw === 'Met') data.cell.styles.textColor = [34, 139, 34]; // Green
            if (data.cell.raw === 'Not Met') data.cell.styles.textColor = [255, 0, 0]; // Red
            if (data.cell.raw === 'Not Assessed') data.cell.styles.textColor = [128, 128, 128]; // Gray
          }
        },
        // Handles page breaks
        didDrawPage: (data) => {
            yPos = data.cursor?.y || 15; // Update yPos for subsequent content
        }
    });

    yPos = (doc as any).lastAutoTable.finalY + 20; // Update yPos after SPRS table

    // CMMC Practices and Objectives Section
    doc.addPage(); // Start this section on a new page
    await doc.html(headerHtml, { x: 15, y: 15, width: 180, windowWidth: 650 });
    yPos = 90; // Reset yPos for new page

    doc.setFontSize(18).setTextColor(40, 58, 86);
    doc.text("CMMC Practices & Assessment Objectives", 15, yPos);
    yPos += 15;

    // Filter and sort domains for display
    const sortedDomains = domains.filter(d => d.practices.length > 0);

    for (const domain of sortedDomains) {
      if (yPos + 10 >= doc.internal.pageSize.height - 30) { // Check for space before new domain title
        doc.addPage();
        await doc.html(headerHtml, { x: 15, y: 15, width: 180, windowWidth: 650 });
        yPos = 90; // Reset yPos for new page
      }
      doc.setFontSize(14).setTextColor(50, 70, 100);
      doc.text(domain.name, 15, yPos);
      yPos += 8;

      for (const practice of domain.practices) {
        if (yPos + 15 >= doc.internal.pageSize.height - 30) { // Check for space before new practice
          doc.addPage();
          await doc.html(headerHtml, { x: 15, y: 15, width: 180, windowWidth: 650 });
          yPos = 90; // Reset yPos for new page
        }
        const practiceRecord = practiceRecordMap.get(practice.id);
        // FIX: Safely access practiceRecord.status and provide a fallback.
        const statusText = (practiceRecord?.status || 'not_assessed').replace(/_/g, ' ').toUpperCase();
        
        doc.setFontSize(11).setTextColor(0);
        doc.text(`${practice.id}: ${practice.name} (Status: ${statusText})`, 20, yPos);
        yPos += 7;

        for (const objective of practice.assessment_objectives) {
          if (yPos + 10 >= doc.internal.pageSize.height - 30) { // Check for space before new objective
            doc.addPage();
            await doc.html(headerHtml, { x: 15, y: 15, width: 180, windowWidth: 650 });
            yPos = 90; // Reset yPos for new page
            doc.setFontSize(14).setTextColor(50, 70, 100);
            doc.text(`(Cont.) ${domain.name}`, 15, yPos);
            yPos += 8;
          }
          doc.setFontSize(9).setTextColor(70);
          const objText = `  - ${objective.id}: ${objective.text}`;
          const splitObjText = doc.splitTextToSize(objText, pageWidth - margin * 2 - 10);
          doc.text(splitObjText, 25, yPos);
          yPos += (splitObjText.length * 5) + 3; // Adjust line height based on split text
        }
        yPos += 5; // Small gap between practices
      }
      yPos += 10; // Larger gap between domains
    }

    const pageCount = (doc as any).internal.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.setTextColor(150);
        doc.text(`CMMC Launch Hub — SPRS Scorecard`, 15, doc.internal.pageSize.height - 10);
        doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width - 35, doc.internal.pageSize.height - 10);
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
        {/* FIX: Add explicit type cast for Object.entries to fix unknown filter/length access */}
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
