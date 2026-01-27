import React, { useState, useEffect, useMemo } from 'react';
import { Domain, Practice, PracticeRecord, PracticeStatus, ReadinessScores, CompanyProfile } from '../types';
import { ProgressBar } from './ProgressBar';
import { getExecutiveAiSummary } from '../services/geminiService';
import { getCompanyHeaderHtml } from '../services/pdfUtils';
import { jsPDF } from 'jspdf';
import { FileText, ArrowDownCircle, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { HIGH_RISK_PRACTICE_IDS } from '../constants';

interface ExecutiveSummaryProps {
  domains: Domain[];
  practiceRecords: PracticeRecord[];
  scores: ReadinessScores;
  getDomainCompletion: (domainName: string) => number;
  companyProfile: CompanyProfile | null;
}

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

export const ExecutiveSummary: React.FC<ExecutiveSummaryProps> = ({
  domains,
  practiceRecords,
  scores,
  getDomainCompletion,
  companyProfile,
}) => {
  const allPractices = useMemo(() => domains.flatMap(d => d.practices), [domains]);
  const practiceRecordMap = useMemo(() => new Map(practiceRecords.map(r => [r.id, r])), [practiceRecords]);

  const { notMetPractices, highRiskStatuses } = useMemo(() => {
    // FIX: Specify the Set type as <string> to allow .has() to accept a generic string.
    const highRiskPracticeIds = new Set<string>(HIGH_RISK_PRACTICE_IDS);
    const highRiskStatuses: { practice: Practice, status: PracticeStatus }[] = [];
    const notMet: Practice[] = [];
    
    for (const practice of allPractices) {
      const record = practiceRecordMap.get(practice.id);
      const status = record?.status || 'not_assessed';
      
      if (status === 'not_met' || status === 'not_assessed') {
        notMet.push(practice);
      }
      
      if (highRiskPracticeIds.has(practice.id)) {
        const p = allPractices.find(p => p.id === practice.id);
        if (p) {
          highRiskStatuses.push({ practice: p, status });
        }
      }
    }
    return { notMetPractices: notMet, highRiskStatuses };
  }, [allPractices, practiceRecordMap]);

  const topGaps = notMetPractices.slice(0, 5);

  const [aiSummary, setAiSummary] = useState<string>("Generating summary…");
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);

  useEffect(() => {
    async function loadSummary() {
      setIsLoadingSummary(true);
      try {
        const text = await getExecutiveAiSummary({
          overall: scores.overallReadinessScore,
          notMet: notMetPractices,
          domains,
        });
        setAiSummary(text);
      } catch (error) {
        console.error("Failed to get AI summary:", error);
        setAiSummary("Could not generate an AI summary at this time. Please try again later.");
      } finally {
        setIsLoadingSummary(false);
      }
    }
    loadSummary();
  }, [scores.overallReadinessScore, notMetPractices, domains]);

  const handleDownloadPdf = async () => {
    const doc = new jsPDF();
    const headerHtml = getCompanyHeaderHtml(companyProfile);
    
    const summaryHtml = `
        <style>
            body { font-family: Helvetica, Arial, sans-serif; font-size: 10pt; color: #333; }
            h1 { font-size: 18pt; color: #0057A3; margin-bottom: 20px; }
            h2 { font-size: 14pt; color: #333; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-top: 20px;}
            p { line-height: 1.5; }
            .summary-box { background-color: #f0f5fa; border: 1px solid #b3d4fc; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
            .gap-item { border-bottom: 1px solid #eee; padding-bottom: 8px; margin-bottom: 8px; font-size: 9pt; }
        </style>
        <h1>Executive Readiness Summary</h1>
        <div class="summary-box">
            <h2>AI-Generated Narrative</h2>
            <p>${aiSummary.replace(/\n/g, '<br/>')}</p>
        </div>
        <div>
            <h2>Overall Readiness Score: ${scores.overallReadinessScore}%</h2>
        </div>
        <div>
            <h2>Top 5 Unmet Practices</h2>
            ${topGaps.length > 0 ? topGaps.map(p => `<div class="gap-item"><strong>${p.id}</strong><br/>${p.brief_description}</div>`).join('') : '<p>No unmet practices found.</p>'}
        </div>
    `;

    await doc.html(headerHtml + summaryHtml, {
        callback: function (doc) {
            doc.save(`Executive_Summary_${companyProfile?.companyName?.replace(/ /g, '_') || 'Report'}.pdf`);
        },
        x: 15,
        y: 15,
        width: 180,
        windowWidth: 650
    });
  };

  const getStatusInfo = (s: PracticeStatus) => {
    switch (s) {
      case 'met': return { text: 'MET', Icon: CheckCircle, color: 'text-green-600' };
      case 'partial': return { text: 'PARTIAL', Icon: AlertTriangle, color: 'text-yellow-600' };
      case 'not_met': return { text: 'NOT MET', Icon: XCircle, color: 'text-red-600' };
      case 'not_assessed':
      default: return { text: 'NOT ASSESSED', Icon: XCircle, color: 'text-gray-500' };
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      <CompanyHeader profile={companyProfile} />

      {/* Title */}
      <div className="bg-white p-6 rounded-lg shadow flex items-center justify-between">
        <div className="flex items-center">
            <FileText className="h-10 w-10 text-blue-500 mr-4" />
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Executive Readiness Summary</h1>
              <p className="text-gray-600">A high-level overview of your CMMC Level 1 assessment status.</p>
            </div>
        </div>
        <button
          onClick={handleDownloadPdf}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700 transition"
        >
          <ArrowDownCircle className="h-5 w-5 mr-2"/>
          Download PDF
        </button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* AI Narrative */}
          <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
            <h2 className="text-xl font-semibold mb-3 text-blue-800">AI-Generated Narrative</h2>
            <p className="text-blue-900 whitespace-pre-wrap">
              {isLoadingSummary ? "Generating summary..." : aiSummary}
            </p>
          </div>
          
          {/* Top Gaps */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <AlertTriangle className="h-6 w-6 mr-3 text-yellow-500"/>
              Top 5 Unmet Practices
            </h2>
            {topGaps.length > 0 ? (
              <ul className="space-y-3">
                {topGaps.map(p => (
                  <li key={p.id} className="text-sm border-b pb-2">
                    <p className="font-semibold text-gray-800">{p.id}</p>
                    <p className="text-gray-600">{p.brief_description}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 text-center py-4">No remaining gaps. All practices are MET!</p>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
           {/* Overall Readiness */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Overall Readiness Score</h2>
            <ProgressBar percent={scores.overallReadinessScore} />
            <p className="text-center mt-2 text-sm text-gray-600">{scores.overallReadinessScore}% overall readiness.</p>
          </div>
          
          {/* High-Risk Practices */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">High-Risk Practices</h2>
            <div className="space-y-2">
              {highRiskStatuses.map(({ practice, status }) => {
                const { text, Icon, color } = getStatusInfo(status);
                return (
                  <div key={practice.id} className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-700">{practice.id}</span>
                    <span className={`flex items-center font-semibold ${color}`}>
                      <Icon className="h-4 w-4 mr-1.5" />
                      {text}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Domain Completion */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Domain Completion Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {domains.map(d => (
            <div key={d.name}>
              <h3 className="font-semibold mb-2 text-gray-800">{d.name}</h3>
              <ProgressBar percent={getDomainCompletion(d.name)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};