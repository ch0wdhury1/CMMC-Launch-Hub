
import React, { useMemo } from 'react';
import { Domain, Practice, PracticeRecord, ReadinessScores, PracticeStatus } from '../types';
import { ProgressBar } from './ProgressBar';
import { CheckCircle, XCircle, AlertTriangle, Cpu, ShieldCheck, Database, Bot } from 'lucide-react';
import { Welcome } from './Welcome';
import { HowItWorksPanel } from './HowItWorksPanel';
import { SecurityReadinessAnalyzerPromo } from './SecurityReadinessAnalyzerPromo';

interface DashboardProps {
  domains: Domain[];
  highRiskPractices: string[];
  practiceRecords: PracticeRecord[];
  scores: ReadinessScores;
  onDomainClick: (domainName: string) => void;
  onPracticeClick: (practiceId: string) => void;
  onResumeAssessment: (id: string | null) => void;
  onSecurityAnalyzerClick: () => void;
  onReadinessReportsClick: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  domains, 
  highRiskPractices, 
  practiceRecords,
  scores,
  onDomainClick,
  onPracticeClick,
  onResumeAssessment,
  onSecurityAnalyzerClick,
  onReadinessReportsClick,
}) => {

  const {
    metHighRisk,
    partialHighRisk,
    notMetHighRisk,
    firstIncompletePracticeId
  } = useMemo(() => {
    // FIX: Explicitly type the Map to avoid 'unknown' type inference issues
    const practiceRecordMap = new Map<string, PracticeRecord>(practiceRecords.map(r => [r.id, r]));

    // Explicitly typing highRiskStatus to avoid 'unknown' type error in filter (fixes line 44)
    const highRiskStatus: { id: string; status: PracticeStatus }[] = highRiskPractices.map(id => {
      // FIX: Ensure record is typed correctly to access the status property on line 45/46
      const record = practiceRecordMap.get(id) as PracticeRecord | undefined;
      return { id, status: (record?.status || 'not_assessed') as PracticeStatus };
    });

    const firstIncomplete = practiceRecords.find((p: PracticeRecord) => p.status !== 'met');

    return {
      metHighRisk: highRiskStatus.filter(h => h.status === 'met'),
      partialHighRisk: highRiskStatus.filter(h => h.status === 'partial'),
      notMetHighRisk: highRiskStatus.filter(h => h.status === 'not_met' || h.status === 'not_assessed'),
      firstIncompletePracticeId: firstIncomplete?.id || null
    };
  }, [practiceRecords, highRiskPractices]);

  const getDomainCompletion = (domain: Domain) => {
      const practicesInDomain = domain.practices;
      if (practicesInDomain.length === 0) return 0;
      
      const domainRecords = practicesInDomain.map(p => practiceRecords.find(r => r.id === p.id)).filter((r): r is PracticeRecord => !!r);
      const met = domainRecords.filter(r => r.status === 'met').length;
      const partial = domainRecords.filter(r => r.status === 'partial').length;
      
      return Math.round(((met + 0.5 * partial) / practicesInDomain.length) * 100);
  };

  const showWelcome = scores.practiceCompletionScore < 100;
 
  return (
    <div className="animate-fadeIn space-y-8 pb-12">
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {showWelcome && (
          <div className="w-full lg:flex-1">
            <Welcome
              overallCompletion={scores.practiceCompletionScore}
              onPrimaryAction={() => onResumeAssessment(firstIncompletePracticeId)}
            />
          </div>
        )}
        <div className="w-full lg:flex-1">
          <HowItWorksPanel />
        </div>
      </div>

      <div className="w-full">
        <SecurityReadinessAnalyzerPromo
          onStartAnalyzer={onSecurityAnalyzerClick}
          onViewReports={onReadinessReportsClick}
        />
      </div>

      {scores.practiceCompletionScore > 0 && (
        <>
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-2">Overall Practice Completion</h2>
            <ProgressBar percent={scores.practiceCompletionScore} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">Domain Progress</h2>
              <div className="space-y-4">
                {domains.map(domain => (
                  <button 
                    key={domain.name} 
                    onClick={() => onDomainClick(domain.name)}
                    className="w-full text-left p-2 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    <h3 className="font-medium mb-1 text-gray-800">{domain.name}</h3>
                    <ProgressBar percent={getDomainCompletion(domain)} />
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">High-Risk Practices Status</h2>
              <div className="space-y-3">
                  <div>
                    <h3 className="font-semibold text-green-600 flex items-center mb-2">
                      <CheckCircle className="h-5 w-5 mr-2" /> MET ({metHighRisk.length})
                    </h3>
                    <ul className="text-xs text-gray-700 space-y-1 pl-7">
                      {metHighRisk.map(({ id }) => <li key={id}><button onClick={() => onPracticeClick(id)} className="hover:underline">{id}</button></li>)}
                    </ul>
                  </div>
                   <div>
                    <h3 className="font-semibold text-yellow-600 flex items-center mb-2">
                      <AlertTriangle className="h-5 w-5 mr-2" /> PARTIAL ({partialHighRisk.length})
                    </h3>
                    <ul className="text-xs text-gray-700 space-y-1 pl-7">
                      {partialHighRisk.map(({ id }) => <li key={id}><button onClick={() => onPracticeClick(id)} className="hover:underline font-medium">{id}</button></li>)}
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-semibold text-red-600 flex items-center mb-2">
                      <XCircle className="h-5 w-5 mr-2" /> NOT MET ({notMetHighRisk.length})
                    </h3>
                    <ul className="text-xs text-gray-700 space-y-1 pl-7">
                      {notMetHighRisk.map(({ id }) => <li key={id}><button onClick={() => onPracticeClick(id)} className="hover:underline font-medium">{id}</button></li>)}
                    </ul>
                  </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
