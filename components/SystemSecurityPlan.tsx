
import React, { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Practice, PracticeRecord, ReadinessAnswers, ReadinessScores, CompanyProfile, ResponsibilityMatrixEntry, PracticeStatus } from '../types';
import { SystemProfile, useSspData } from '../hooks/useSspData';
import { generateSspPdf } from '../services/sspGenerator';
import { POLICIES_PROCEDURES } from '../data/solutionsData';
import { FileText, Edit3, RefreshCw, Download, Loader2 } from 'lucide-react';

interface SystemSecurityPlanProps {
  allPractices: Practice[];
  practiceRecords: PracticeRecord[];
  analyzerAnswers: ReadinessAnswers;
  scores: ReadinessScores;
  sspData: ReturnType<typeof useSspData>;
  companyProfile: CompanyProfile | null;
  responsibilityMatrix: ResponsibilityMatrixEntry[];
}

const policyOptions = POLICIES_PROCEDURES.map(p => p.title);

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

export const SystemSecurityPlan: React.FC<SystemSecurityPlanProps> = ({
  allPractices,
  practiceRecords,
  analyzerAnswers,
  scores,
  sspData,
  companyProfile,
  responsibilityMatrix,
}) => {
  const { systemProfile, updateSystemProfile, activePolicies, togglePolicy } = sspData;
  const [activeTab, setActiveTab] = useState('overview');
  const [sspContent, setSspContent] = useState<Record<string, any>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const practiceRecordMap = new Map(practiceRecords.map(r => [r.id, r]));

  const generatePreview = () => {
    setIsGenerating(true);
    // Simulate generation time to give user feedback
    setTimeout(() => {
      const metCount = practiceRecords.filter(p => p.status === 'met').length;
      const partialCount = practiceRecords.filter(p => p.status === 'partial').length;
      const notMetCount = practiceRecords.filter(p => p.status === 'not_met' || p.status === 'not_assessed').length;

      const gaps = practiceRecords
        .filter(p => p.status === 'partial' || p.status === 'not_met')
        .map(p => ({
          id: p.id,
          description: allPractices.find(ap => ap.id === p.id)?.brief_description || 'N/A'
        }));

      setSspContent({
        overview: { ...systemProfile, ...scores },
        environment: { ...analyzerAnswers },
        roles: { orgName: systemProfile.organizationName },
        // FIX: Cast map result to PracticeRecord to ensure status property is accessible
        controls: allPractices.map(p => ({
            ...p,
            status: (practiceRecordMap.get(p.id) as PracticeRecord | undefined)?.status || 'not_assessed',
            srmEntry: responsibilityMatrix.find(e => e.practiceId === p.id),
        })),
        policies: { activePolicies },
        risks: { metCount, partialCount, notMetCount, gaps },
      });
      setIsGenerating(false);
    }, 500);
  };
  
  // Auto-generate on first load
  useEffect(() => {
    generatePreview();
  }, [allPractices, practiceRecords, analyzerAnswers, scores, systemProfile, responsibilityMatrix]);


  const handleDownload = async () => {
    setIsDownloading(true);
    try {
        await generateSspPdf({
            profile: systemProfile,
            scores,
            answers: analyzerAnswers,
            practices: allPractices,
            records: practiceRecords,
            policies: activePolicies,
            companyProfile: companyProfile,
            responsibilityMatrix,
        });
    } catch(e) {
        console.error("PDF generation failed", e);
        alert("Failed to generate PDF. See console for details.");
    } finally {
        setIsDownloading(false);
    }
  };
  
  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview': return <SectionOverview data={sspContent.overview} />;
      case 'environment': return <SectionEnvironment data={sspContent.environment} />;
      case 'roles': return <SectionRoles data={sspContent.roles} />;
      case 'controls': return <SectionControls data={sspContent.controls} companyProfile={companyProfile} />;
      case 'policies': return <SectionPolicies activePolicies={activePolicies} onToggle={togglePolicy} />;
      case 'risks': return <SectionRisks data={sspContent.risks} />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <CompanyHeader profile={companyProfile} />
      {/* System Profile Card */}
      <div className="bg-white p-6 rounded-lg shadow-md border">
        <h2 className="text-xl font-bold mb-4 flex items-center"><Edit3 className="h-5 w-5 mr-3 text-blue-600"/>System Profile</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <input type="text" placeholder="Organization Name" value={systemProfile.organizationName} onChange={e => updateSystemProfile({ organizationName: e.target.value })} className="border p-2 rounded bg-white text-black" />
          <input type="text" placeholder="System Name" value={systemProfile.systemName} onChange={e => updateSystemProfile({ systemName: e.target.value })} className="border p-2 rounded bg-white text-black" />
          <input type="text" placeholder="Primary Contact Name" value={systemProfile.contactName} onChange={e => updateSystemProfile({ contactName: e.target.value })} className="border p-2 rounded bg-white text-black" />
          <input type="email" placeholder="Primary Contact Email" value={systemProfile.contactEmail} onChange={e => updateSystemProfile({ contactEmail: e.target.value })} className="border p-2 rounded bg-white text-black" />
          <textarea placeholder="System Description..." value={systemProfile.systemDescription} onChange={e => updateSystemProfile({ systemDescription: e.target.value })} className="md:col-span-2 border p-2 rounded bg-white text-black h-20" />
          <textarea placeholder="Scope Notes..." value={systemProfile.scopeNotes} onChange={e => updateSystemProfile({ scopeNotes: e.target.value })} className="md:col-span-2 border p-2 rounded bg-white text-black h-20" />
        </div>
      </div>

      {/* SSP Preview Section */}
      <div className="bg-white rounded-lg shadow-md border">
        <div className="p-4 border-b">
          <h2 className="text-xl font-bold flex items-center"><FileText className="h-5 w-5 mr-3 text-blue-600"/>SSP Content Preview</h2>
        </div>
        
        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px px-4 space-x-6">
            {['overview', 'environment', 'roles', 'controls', 'policies', 'risks'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`py-3 text-sm font-medium capitalize border-b-2 ${activeTab === tab ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                {tab.replace(/_/g, ' ')}
              </button>
            ))}
          </nav>
        </div>
        
        <div className="p-6 min-h-[300px]">
          {isGenerating ? <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin h-8 w-8 text-blue-500"/></div> : renderTabContent()}
        </div>
      </div>
      
      {/* Actions */}
      <div className="bg-white p-4 rounded-lg shadow-md border flex justify-end items-center space-x-3">
         <button onClick={generatePreview} disabled={isGenerating} className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-md shadow-sm hover:bg-gray-700 disabled:bg-gray-400">
            {isGenerating ? <Loader2 className="h-5 w-5 mr-2 animate-spin"/> : <RefreshCw className="h-5 w-5 mr-2"/>}
            {isGenerating ? 'Generating...' : 'Regenerate Preview'}
         </button>
         <button onClick={handleDownload} disabled={isDownloading} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700 disabled:bg-blue-400">
            {isDownloading ? <Loader2 className="h-5 w-5 mr-2 animate-spin"/> : <Download className="h-5 w-5 mr-2"/>}
            {isDownloading ? 'Downloading...' : 'Download SSP PDF'}
         </button>
      </div>
    </div>
  );
};

// --- SECTION SUB-COMPONENTS ---

const SectionOverview: React.FC<{ data?: any }> = ({ data }) => {
  if (!data) return null;
  return (
    <div className="space-y-4 text-sm">
      <p><strong>Organization Name:</strong> {data.organizationName || 'N/A'}</p>
      <p><strong>System Name:</strong> {data.systemName || 'N/A'}</p>
      <p><strong>Scope:</strong> {data.scopeNotes || 'N/A'}</p>
      <div className="pt-4 border-t">
          <h4 className="font-bold mb-2">Current Readiness Scores:</h4>
          <ul className="list-disc pl-5">
              <li>Overall Readiness Score: {data.overallReadinessScore}%</li>
              <li>Practice Completion Score: {data.practiceCompletionScore}%</li>
              <li>Controls Posture Score: {data.controlsPostureScore}%</li>
          </ul>
      </div>
    </div>
  );
};

const SectionEnvironment: React.FC<{ data?: any }> = ({ data }) => {
  if (!data) return null;
  return (
    <div className="space-y-4 text-sm">
        <p>The system is hosted primarily on <strong>{data.cloudPlatform || 'an unspecified platform'}</strong>. User access is managed via unique logins, with Multi-Factor Authentication (MFA) status noted as <strong>{data.mfaEnabled || 'not specified'}</strong>. The network is protected by a <strong>{data.businessFirewall === 'yes' ? 'business-grade firewall' : 'firewall of unspecified type'}</strong>. Remote access for {data.remoteWorkerCount || 'some'} workers is supported, with VPN usage noted as <strong>{data.vpnForRemote || 'not specified'}</strong>.</p>
    </div>
  );
};

const SectionRoles: React.FC<{ data?: any }> = ({ data }) => {
  if (!data) return null;
  return (
    <div className="space-y-2 text-sm">
      <p><strong>Management:</strong> Responsible for providing resources and support for the security program.</p>
      <p><strong>IT/MSP:</strong> Responsible for implementing and managing technical security controls.</p>
      <p><strong>Employees:</strong> Responsible for following security policies and procedures in their daily work at {data.orgName || 'the organization'}.</p>
    </div>
  );
};

const SectionControls: React.FC<{ data?: (Practice & { status: PracticeStatus; srmEntry?: ResponsibilityMatrixEntry })[], companyProfile: CompanyProfile | null }> = ({ data, companyProfile }) => {
  if (!data) return null;
  return (
    <div className="max-h-[500px] overflow-y-auto space-y-3 pr-2">
      {data.map(p => {
        const { srmEntry } = p;
        let respText = 'Responsibility not assigned in SRM.';
        if (srmEntry) {
            const companyName = companyProfile?.companyName || 'the organization';
            const { responsibility, providerName, internalOwner } = srmEntry;
            if (responsibility === 'customer') {
                respText = `Responsibility: This control is primarily the responsibility of ${companyName} (Customer).`;
                if (internalOwner) respText += ` Internal Owner: ${internalOwner}.`;
            } else if (responsibility === 'provider') {
                respText = `Responsibility: This control is primarily handled by ${providerName || 'the provider'}. ${companyName} remains responsible for vendor oversight.`;
            } else if (responsibility === 'shared') {
                respText = `Responsibility: This control is shared between ${companyName} and ${providerName || 'the provider'}.`;
                if (internalOwner) respText += ` Internal Owner: ${internalOwner}.`;
            }
        }
        
        let implText = 'Controls are not yet implemented. See POA&M for details.';
        if (p.status === 'met') implText = 'Controls are implemented and objectives are met.';
        if (p.status === 'partial') implText = 'Some controls are in place, but gaps remain.';

        return (
          <div key={p.id} className="p-3 border rounded-md bg-gray-50 text-sm">
            <p><strong>{p.id} ({p.domainName}):</strong> {p.name}</p>
            <p><strong>Status:</strong> <span className="font-semibold">{p.status.replace('_', ' ').toUpperCase()}</span></p>
            <p className="text-xs mt-1"><em>Implementation: </em>{implText}</p>
            <p className="text-xs mt-1 italic text-blue-700">{respText}</p>
          </div>
        )
      })}
    </div>
  );
};

const SectionPolicies: React.FC<{ activePolicies: string[], onToggle: (name: string) => void }> = ({ activePolicies, onToggle }) => (
  <div>
    <p className="text-sm text-gray-600 mb-4">Indicate which policies and procedures are formally documented and in place.</p>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {policyOptions.map(policy => (
        <label key={policy} className="flex items-center space-x-2 p-2 bg-gray-50 rounded-md border cursor-pointer hover:bg-gray-100">
          <input type="checkbox" checked={activePolicies.includes(policy)} onChange={() => onToggle(policy)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"/>
          <span className="text-sm">{policy}</span>
        </label>
      ))}
    </div>
  </div>
);

const SectionRisks: React.FC<{ data?: any }> = ({ data }) => {
  if (!data) return null;
  return (
    <div className="space-y-4 text-sm">
      <div className="flex space-x-4">
        <span><strong>Met:</strong> {data.metCount}</span>
        <span><strong>Partial:</strong> {data.partialCount}</span>
        <span><strong>Not Met:</strong> {data.notMetCount}</span>
      </div>
      <div className="pt-4 border-t">
        <h4 className="font-bold mb-2">Identified Gaps:</h4>
        {data.gaps?.length > 0 ? (
          <ul className="list-disc pl-5 max-h-60 overflow-y-auto pr-2">
            {data.gaps.map((g: any) => <li key={g.id}><strong>{g.id}:</strong> {g.description}</li>)}
          </ul>
        ) : <p>No gaps identified. All practices are met.</p>}
        <p className="mt-4 text-xs italic">Detailed remediation steps for these gaps will be managed in the POA&M module.</p>
      </div>
    </div>
  );
};
