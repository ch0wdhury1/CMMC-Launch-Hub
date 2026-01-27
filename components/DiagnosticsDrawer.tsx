
import React, { useMemo } from 'react';
import { X, AlertTriangle, CheckCircle, Database, List, Hash, AlertCircle, Info, Zap, ShieldCheck, ArrowRight, Lock, Search, Cpu, Bot } from 'lucide-react';
import { Domain, Practice, SubscriptionLevel, L2ExtractionResult } from '../types';
import { L1_PRACTICE_COUNT, L2_PRACTICE_COUNT } from '../constants';
import { L2DataMinerView } from './l2miner/L2DataMinerView';

interface DiagnosticsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  domains: Domain[];
  allPractices: Practice[];
  dataSourceInfo: string;
  subscriptionLevel: SubscriptionLevel;
  onUpgrade: () => void;
  onCommitMinedRequirement: (mined: L2ExtractionResult) => void;
}

const EXPECTED_DOMAIN_IDS = ["AC", "AU", "AT", "CM", "IA", "IR", "MA", "MP", "PS", "PE", "RA", "CA", "SC", "SI"];

export const DiagnosticsDrawer: React.FC<DiagnosticsDrawerProps> = ({
  isOpen,
  onClose,
  domains,
  allPractices,
  dataSourceInfo,
  subscriptionLevel,
  onUpgrade,
  onCommitMinedRequirement,
}) => {
  const diagnostics = useMemo(() => {
    const domainIdsLoaded = domains.map(d => {
      const match = d.name.match(/\(([A-Z]+)\)/);
      return match ? match[1] : d.name;
    });

    const missingDomainIds = EXPECTED_DOMAIN_IDS.filter(id => !domainIdsLoaded.includes(id));
    
    const ids = allPractices.map(p => p.id);
    const duplicateRequirementIds = Array.from(new Set(ids.filter((item, index) => ids.indexOf(item) !== index)));

    const perDomainPracticeCounts = domains.map(d => {
      const match = d.name.match(/\(([A-Z]+)\)/);
      const id = match ? match[1] : d.name;
      return { 
        id, 
        count: d.practices.length, 
        l1Count: d.practices.filter(p => p.id.includes(".L1-")).length 
      };
    });

    const integrityErrors: string[] = [];
    if (domains.length !== 14) integrityErrors.push(`Dataset incomplete: domainsLoaded (${domains.length}) != 14`);
    if (allPractices.length < L2_PRACTICE_COUNT) integrityErrors.push(`Dataset potentially incomplete: practicesTotal (${allPractices.length}) < ${L2_PRACTICE_COUNT}`);
    if (missingDomainIds.length > 0) integrityErrors.push(`Missing critical domains: ${missingDomainIds.join(', ')}`);
    if (duplicateRequirementIds.length > 0) integrityErrors.push(`Duplicate practice IDs detected: ${duplicateRequirementIds.join(', ')}`);

    const l1Count = allPractices.filter(p => p.id.includes(".L1-")).length;
    const l2Count = allPractices.filter(p => !p.id.includes(".L1-")).length;

    return {
      domainIdsLoaded,
      missingDomainIds,
      duplicateRequirementIds,
      perDomainPracticeCounts,
      integrityErrors,
      l1Count,
      l2Count,
      isOk: integrityErrors.length === 0
    };
  }, [domains, allPractices]);

  if (!isOpen) return null;

  const activePracticeTarget = subscriptionLevel === "L1" ? L1_PRACTICE_COUNT : L2_PRACTICE_COUNT;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      <div className="relative w-full max-w-xl bg-gray-900 text-white h-full shadow-2xl overflow-y-auto animate-fadeIn flex flex-col border-l border-gray-700">
        <header className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-800 sticky top-0 z-10">
          <div className="flex items-center space-x-2">
            <Database className="h-5 w-5 text-blue-400" />
            <h2 className="text-lg font-bold uppercase tracking-tight">System Integrity Panel</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded-md">
            <X size={20} />
          </button>
        </header>

        <div className="p-4 flex-1 space-y-6">
          {/* Subscription Banner */}
          <div className={`p-4 rounded-lg border flex items-center justify-between ${subscriptionLevel === 'L2' ? 'bg-blue-900/30 border-blue-500/50' : 'bg-gray-800 border-gray-700'}`}>
              <div className="flex items-center space-x-3">
                  <ShieldCheck className={`h-6 w-6 ${subscriptionLevel === 'L2' ? 'text-blue-400' : 'text-gray-500'}`} />
                  <div>
                      <h3 className="text-xs font-black uppercase tracking-widest">Active Plan: {subscriptionLevel}</h3>
                      <p className="text-[10px] text-gray-400">{activePracticeTarget} Practices in Scoped Views</p>
                  </div>
              </div>
              {subscriptionLevel === "L1" && (
                  <button onClick={onUpgrade} className="bg-blue-600 p-1.5 rounded hover:bg-blue-500 transition-colors">
                      <ArrowRight size={16} />
                  </button>
              )}
          </div>

          {diagnostics.integrityErrors.length > 0 ? (
            <div className="p-4 bg-red-900/30 border border-red-500/50 rounded-lg flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-bold text-red-400 text-sm uppercase">Critical Integrity Failure</h3>
                <ul className="text-[10px] text-red-200/80 mt-1 list-disc pl-4 space-y-1">
                  {diagnostics.integrityErrors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-green-900/30 border border-green-500/50 rounded-lg flex items-center space-x-3">
              <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
              <div>
                <h3 className="font-bold text-green-400 text-sm uppercase">Integrity Check: PASS</h3>
                <p className="text-[10px] text-green-200/80">Canonical L1/L2 scope verified in data engine.</p>
              </div>
            </div>
          )}

          {/* Level 2 Data Miner Section (Internal Tooling) */}
          <div className="p-4 bg-gradient-to-br from-blue-900/60 to-indigo-900/60 rounded-xl border border-blue-400/30 space-y-4">
             <div className="flex items-center space-x-3">
               <Cpu className="h-6 w-6 text-blue-400" />
               <h3 className="text-sm font-black uppercase tracking-widest">Level 2 Data Miner (Internal)</h3>
             </div>
             
             <p className="text-xs text-blue-100/70 leading-relaxed">
               Relocated Internal Capability: Use this pipeline to extract L2 requirements directly from NIST source text with automated validation.
             </p>

             <div className="grid grid-cols-1 gap-2">
                <div className="bg-black/30 p-3 rounded-lg border border-white/5 backdrop-blur-sm flex items-center space-x-3">
                  <Database className="h-4 w-4 text-blue-400 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-[10px] uppercase">High-Fidelity Extraction</h4>
                    <p className="text-[9px] text-blue-100/50">NIST 800-171 Rev 2 / CMMC v2.13 parsing.</p>
                  </div>
                </div>
                <div className="bg-black/30 p-3 rounded-lg border border-white/5 backdrop-blur-sm flex items-center space-x-3">
                  <ShieldCheck className="h-4 w-4 text-green-400 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-[10px] uppercase">Automated Validation</h4>
                    <p className="text-[9px] text-blue-100/50">Letter-sequence and structure integrity checks.</p>
                  </div>
                </div>
                <div className="bg-black/30 p-3 rounded-lg border border-white/5 backdrop-blur-sm flex items-center space-x-3">
                  <Bot className="h-4 w-4 text-purple-400 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-[10px] uppercase">Assessor Logic</h4>
                    <p className="text-[9px] text-blue-100/50">Objective-level satisfaction mapping.</p>
                  </div>
                </div>
             </div>

             <div className="mt-4 overflow-hidden rounded-lg border border-blue-500/20">
                <L2DataMinerView onCommit={onCommitMinedRequirement} />
             </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-gray-800 rounded-lg border border-gray-700">
              <div className="flex items-center space-x-2 text-yellow-400 mb-1">
                <Zap className="h-3 w-3" />
                <span className="text-[9px] font-black uppercase tracking-wider">Level 1 Practices</span>
              </div>
              <p className="text-xl font-bold">{diagnostics.l1Count}</p>
              <p className="text-[9px] text-gray-500 uppercase">Core Subset (Scanned by Engine)</p>
            </div>
            <div className="p-3 bg-gray-800 rounded-lg border border-gray-700 relative">
              <div className="flex items-center space-x-2 text-blue-400 mb-1">
                <ShieldCheck className="h-3 w-3" />
                <span className="text-[9px] font-black uppercase tracking-wider">Level 2 Delta</span>
              </div>
              <p className="text-xl font-bold">{diagnostics.l2Count}</p>
              <p className="text-[9px] text-gray-500 uppercase">Advanced Controls (In Engine)</p>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Scoped Domain Registry</h4>
            <div className="bg-black/30 rounded-lg border border-gray-800 overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-800/50 text-gray-500 text-[9px] uppercase font-bold">
                  <tr>
                    <th className="p-2">ID</th>
                    <th className="p-2">L1</th>
                    <th className="p-2">Total</th>
                    <th className="p-2 text-right">Scope</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {EXPECTED_DOMAIN_IDS.map(id => {
                    const stats = diagnostics.perDomainPracticeCounts.find(p => p.id === id);
                    const isMissing = !stats;
                    const hasL1 = stats && stats.l1Count > 0;

                    return (
                      <tr key={id}>
                        <td className="p-2 font-mono font-bold text-gray-300">{id}</td>
                        <td className="p-2 font-mono text-yellow-500/70">{stats?.l1Count ?? 0}</td>
                        <td className="p-2 font-mono text-blue-400">{stats?.count ?? 0}</td>
                        <td className="p-2 text-right">
                          {subscriptionLevel === "L2" || hasL1 ? (
                            <span className="text-[8px] font-bold text-green-500 uppercase">Active</span>
                          ) : (
                            <span className="text-[8px] font-bold text-gray-600 uppercase">Locked</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <footer className="p-4 border-t border-gray-800 bg-gray-800 text-[9px] text-gray-500 text-center uppercase tracking-widest font-bold">
          Data Engine Ver 2.3 — {subscriptionLevel} View Port
        </footer>
      </div>
    </div>
  );
};
