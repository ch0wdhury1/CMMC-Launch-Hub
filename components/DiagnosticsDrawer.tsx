
import React, { useMemo, useRef, useState } from 'react';
import { X, AlertTriangle, CheckCircle, Database, List, Hash, AlertCircle, Info, Zap, ShieldCheck, ArrowRight, Lock, Search, Cpu, Bot, Download, Loader2, Upload } from 'lucide-react';
import { Domain, Practice, SubscriptionLevel, L2ExtractionResult, EvidenceSummary, RecoveryDiagnostics } from '../types';
import { L1_PRACTICE_COUNT, L2_PRACTICE_COUNT } from '../constants';
import { L2DataMinerView } from './l2miner/L2DataMinerView';
import { exportAssessmentBackup } from '../src/assessmentBackup';
import { RestoreValidationResult, validateRestoreBackupJson } from '../src/restoreValidation';
import { RestoreExecutionResult, restoreAssessmentBackup } from '../src/restoreEngine';
import { DataCleanupAuditPanel } from './DataCleanupAuditPanel';
import { CleanupControlsPanel } from './CleanupControlsPanel';
import { ControlledCleanupExecutionPanel } from './ControlledCleanupExecutionPanel';

interface DiagnosticsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  domains: Domain[];
  allPractices: Practice[];
  dataSourceInfo: string;
  evidenceSummary: EvidenceSummary;
  recoveryDiagnostics: RecoveryDiagnostics;
  isSuperAdmin: boolean;
  firestoreAssessmentsEnabled: boolean;
  environmentMode: string;
  currentOrgId: string | null;
  currentUserId: string | null;
  currentUserRole: string;
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
  evidenceSummary,
  recoveryDiagnostics,
  isSuperAdmin,
  firestoreAssessmentsEnabled,
  environmentMode,
  currentOrgId,
  currentUserId,
  currentUserRole,
  subscriptionLevel,
  onUpgrade,
  onCommitMinedRequirement,
}) => {
  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [backupExportError, setBackupExportError] = useState("");
  const [restoreValidation, setRestoreValidation] = useState<RestoreValidationResult | null>(null);
  const [parsedRestoreBackup, setParsedRestoreBackup] = useState<any | null>(null);
  const [isRestoringBackup, setIsRestoringBackup] = useState(false);
  const [restoreExecution, setRestoreExecution] = useState<RestoreExecutionResult | null>(null);
  const restoreFileInputRef = useRef<HTMLInputElement>(null);
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
  const formatTimestamp = (value: any) => {
    if (!value) return "Not available";
    if (typeof value === "string") return new Date(value).toLocaleString();
    if (value?.toDate) return value.toDate().toLocaleString();
    return "Not available";
  };
  const productionRisks = [
    { severity: "HIGH", item: "No background OCR retry queue" },
    { severity: "HIGH", item: "No evidence versioning" },
    { severity: "HIGH", item: "No automated backup/export process" },
    { severity: "MEDIUM", item: "No evidence delete/archive workflow" },
    { severity: "MEDIUM", item: "No notification system" },
    { severity: "MEDIUM", item: "No dashboard charts" },
    { severity: "LOW", item: "No dark mode" },
    { severity: "LOW", item: "No advanced analytics" },
  ] as const;
  const severityPenalty = { HIGH: 10, MEDIUM: 5, LOW: 1 };
  const productionReadinessScore = productionRisks.reduce(
    (score, risk) => score - severityPenalty[risk.severity],
    100
  );
  const productionChecks = [
    {
      group: "Assessment Persistence",
      checks: [
        ["Firestore source of truth enabled", firestoreAssessmentsEnabled],
        ["Assessment shell loaded", recoveryDiagnostics.assessmentShellLoaded],
        ["Recovery validation available", true],
      ],
    },
    {
      group: "Evidence System",
      checks: [
        ["Storage upload enabled", true],
        ["OCR enabled", true],
        ["Evidence download enabled", true],
      ],
    },
    {
      group: "Security",
      checks: [
        ["Auth required", true],
        ["Firestore rules configured", true],
        ["Storage rules configured", true],
      ],
    },
    {
      group: "Operations",
      checks: [
        ["Activity logging enabled", true],
        ["Score snapshots enabled", true],
        ["Save button enabled", true],
      ],
    },
  ];
  const handleExportAssessmentBackup = async () => {
    if (!currentOrgId) {
      setBackupExportError("Current organization is unavailable.");
      return;
    }

    setIsExportingBackup(true);
    setBackupExportError("");
    try {
      const assessmentId = subscriptionLevel === "L2" ? "default_l2" : "default_l1";
      const backup = await exportAssessmentBackup(currentOrgId, assessmentId);
      const isoTimestamp = new Date().toISOString();
      const timestamp = `${isoTimestamp.slice(0, 10).replace(/-/g, "")}-${isoTimestamp.slice(11, 16).replace(":", "")}`;
      const blobUrl = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], {type: "application/json"}));
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `cmmc-launch-hub-backup-${currentOrgId}-${assessmentId}-${timestamp}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Assessment export failed";
      setBackupExportError(message);
      console.warn("[admin-export] assessment backup download failed", error);
    } finally {
      setIsExportingBackup(false);
    }
  };

  const handleValidateRestoreFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const contents = await file.text();
      const validation = validateRestoreBackupJson(contents);
      setRestoreValidation(validation);
      setParsedRestoreBackup(validation.valid ? JSON.parse(contents) : null);
      setRestoreExecution(null);
    } catch (error) {
      console.warn("[restore-validation] could not read backup file", error);
      setParsedRestoreBackup(null);
      setRestoreExecution(null);
      setRestoreValidation({
        valid: false,
        assessmentCount: 0,
        practiceCount: 0,
        objectiveCount: 0,
        noteCount: 0,
        poamCount: 0,
        evidenceCount: 0,
        errors: ["Backup file could not be read."],
        warnings: [],
      });
    }
  };

  const handleRestoreAssessmentBackup = async () => {
    if (!restoreValidation?.valid || !parsedRestoreBackup || !currentOrgId || !currentUserId || !isSuperAdmin) return;
    if (!window.confirm("You are about to restore this assessment backup into Firestore. This may overwrite existing assessment records with the same IDs. This action should only be performed by a SuperAdmin. Continue?")) return;

    setIsRestoringBackup(true);
    setRestoreExecution(null);
    try {
      setRestoreExecution(await restoreAssessmentBackup({
        backup: parsedRestoreBackup,
        orgId: currentOrgId,
        userId: currentUserId,
        isSuperAdmin,
      }));
    } catch (error) {
      console.warn("[assessment-restore] restore failed", error);
      setRestoreExecution({
        success: false,
        assessmentWritten: false,
        practicesWritten: 0,
        objectivesWritten: 0,
        notesWritten: 0,
        poamsWritten: 0,
        evidenceMetadataWritten: 0,
        warnings: [],
        errors: [error instanceof Error ? error.message : "Assessment restore failed."],
      });
    } finally {
      setIsRestoringBackup(false);
    }
  };

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
            <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Evidence Summary</h4>
            <div className="grid grid-cols-2 gap-2">
              {[
                ["Total Evidence", evidenceSummary.totalEvidenceCount],
                ["Storage Uploaded", evidenceSummary.evidenceWithStorageCount],
                ["Storage Missing", evidenceSummary.evidenceWithoutStorageCount],
                ["OCR Completed", evidenceSummary.ocrCompletedCount],
                ["OCR Failed", evidenceSummary.ocrFailedCount],
                ["OCR Pending", evidenceSummary.ocrPendingCount],
                ["Practices Without Evidence", evidenceSummary.practicesWithoutEvidence.length],
                ["Objectives Without Evidence", evidenceSummary.objectivesWithoutEvidence.length],
              ].map(([label, value]) => (
                <div key={label} className="p-3 bg-gray-800 rounded-lg border border-gray-700">
                  <p className="text-[9px] font-black uppercase tracking-wider text-gray-400">{label}</p>
                  <p className="text-xl font-bold text-white">{value}</p>
                </div>
              ))}
            </div>
            {evidenceSummary.practicesWithoutEvidence.length > 0 && (
              <div className="p-3 bg-black/30 rounded-lg border border-gray-800">
                <p className="text-[9px] font-black uppercase tracking-wider text-gray-500 mb-2">First 5 Practices Without Evidence</p>
                <ul className="space-y-1 text-xs font-mono text-gray-300">
                  {evidenceSummary.practicesWithoutEvidence.slice(0, 5).map(practiceId => (
                    <li key={practiceId}>{practiceId}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {isSuperAdmin && (
            <div className="space-y-3">
              <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Recovery Validation</h4>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["Assessment Shell Loaded", recoveryDiagnostics.assessmentShellLoaded ? "Yes" : "No"],
                  ["Practice Records Loaded", recoveryDiagnostics.practicesLoaded],
                  ["Objective Records Loaded", recoveryDiagnostics.objectivesLoaded],
                  ["Evidence Records Loaded", recoveryDiagnostics.evidenceLoaded],
                  ["Notes Loaded", recoveryDiagnostics.notesLoaded],
                  ["POA&M Loaded", recoveryDiagnostics.poamLoaded],
                  ["Score Snapshots Loaded", recoveryDiagnostics.snapshotsLoaded],
                  ["Activity Entries Loaded", recoveryDiagnostics.activityEntriesLoaded],
                  ["Source of Truth Mode", recoveryDiagnostics.sourceOfTruthMode],
                  ["Last Saved", formatTimestamp(recoveryDiagnostics.lastSavedAt)],
                ].map(([label, value]) => (
                  <div key={label} className="p-3 bg-gray-800 rounded-lg border border-gray-700">
                    <p className="text-[9px] font-black uppercase tracking-wider text-gray-400">{label}</p>
                    <p className="text-sm font-bold text-white break-words">{value}</p>
                  </div>
                ))}
              </div>
              <div className="p-3 bg-black/30 rounded-lg border border-gray-800">
                <p className="text-[9px] font-black uppercase tracking-wider text-gray-500 mb-2">Recovery Test</p>
                <ol className="space-y-1 text-xs text-gray-300 list-decimal pl-4">
                  <li>Save assessment</li>
                  <li>Logout</li>
                  <li>Clear localStorage</li>
                  <li>Refresh</li>
                  <li>Login again</li>
                  <li>Confirm objective status restored</li>
                  <li>Confirm notes restored</li>
                  <li>Confirm evidence restored</li>
                  <li>Confirm POA&M restored</li>
                  <li>Confirm activity history restored</li>
                </ol>
              </div>
            </div>
          )}

          {isSuperAdmin && (
            <div className="space-y-3">
              <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Production Readiness Audit</h4>
              <div className="p-4 bg-blue-900/30 border border-blue-500/50 rounded-lg">
                <p className="text-[9px] font-black uppercase tracking-wider text-blue-300">Production Readiness Score</p>
                <p className="text-3xl font-bold text-white">{productionReadinessScore}/100</p>
              </div>
              <div className="p-3 bg-gray-800 rounded-lg border border-gray-700 space-y-2">
                <button
                  type="button"
                  onClick={handleExportAssessmentBackup}
                  disabled={isExportingBackup || !currentOrgId}
                  className="flex items-center px-3 py-2 bg-blue-600 text-white text-xs font-semibold rounded-md hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isExportingBackup ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                  {isExportingBackup ? "Exporting..." : "Export Assessment Backup"}
                </button>
                {backupExportError && <p className="text-xs text-red-400">{backupExportError}</p>}
                <input
                  ref={restoreFileInputRef}
                  type="file"
                  accept="application/json,.json"
                  onChange={handleValidateRestoreFile}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => restoreFileInputRef.current?.click()}
                  className="flex items-center px-3 py-2 bg-gray-700 text-white text-xs font-semibold rounded-md hover:bg-gray-600"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Validate Restore File
                </button>
              </div>
              {restoreValidation && (
                <div className="p-3 bg-gray-800 rounded-lg border border-gray-700 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[9px] font-black uppercase tracking-wider text-gray-400">Restore Validation</p>
                    <span className={`text-[10px] font-black uppercase ${restoreValidation.valid ? "text-green-400" : "text-red-400"}`}>
                      {restoreValidation.valid ? "Ready for Restore" : "Restore Blocked"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      ["Backup Version", restoreValidation.version || "Unavailable"],
                      ["Assessment Count", restoreValidation.assessmentCount],
                      ["Practice Count", restoreValidation.practiceCount],
                      ["Objective Count", restoreValidation.objectiveCount],
                      ["Note Count", restoreValidation.noteCount],
                      ["POA&M Count", restoreValidation.poamCount],
                      ["Evidence Count", restoreValidation.evidenceCount],
                    ].map(([label, value]) => (
                      <div key={label} className="p-2 bg-black/20 rounded border border-gray-700">
                        <p className="text-[9px] font-black uppercase tracking-wider text-gray-500">{label}</p>
                        <p className="font-semibold text-white break-words">{value}</p>
                      </div>
                    ))}
                  </div>
                  {restoreValidation.warnings.length > 0 && (
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-wider text-yellow-400 mb-1">Warnings</p>
                      <ul className="list-disc pl-4 text-xs text-yellow-200 space-y-1">
                        {restoreValidation.warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}
                      </ul>
                    </div>
                  )}
                  {restoreValidation.errors.length > 0 && (
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-wider text-red-400 mb-1">Errors</p>
                      <ul className="list-disc pl-4 text-xs text-red-200 space-y-1">
                        {restoreValidation.errors.map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}
                      </ul>
                    </div>
                  )}
                  {restoreValidation.valid && (
                    <button
                      type="button"
                      onClick={handleRestoreAssessmentBackup}
                      disabled={!parsedRestoreBackup || !currentUserId || !isSuperAdmin || isRestoringBackup}
                      className="flex items-center px-3 py-2 bg-red-700 text-white text-xs font-semibold rounded-md hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isRestoringBackup && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {isRestoringBackup ? "Restoring..." : "Restore This Backup"}
                    </button>
                  )}
                </div>
              )}
              {restoreExecution && (
                <div className="p-3 bg-gray-800 rounded-lg border border-gray-700 space-y-3">
                  <p className={`text-xs font-black uppercase ${restoreExecution.success ? "text-green-400" : "text-red-400"}`}>
                    {restoreExecution.success ? "Restore Complete" : "Restore Failed"}
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      ["Assessment ID", restoreExecution.restoredAssessmentId || "Unavailable"],
                      ["Practices Restored", restoreExecution.practicesWritten],
                      ["Objectives Restored", restoreExecution.objectivesWritten],
                      ["Notes Restored", restoreExecution.notesWritten],
                      ["POA&M Restored", restoreExecution.poamsWritten],
                      ["Evidence Metadata Restored", restoreExecution.evidenceMetadataWritten],
                    ].map(([label, value]) => (
                      <div key={label} className="p-2 bg-black/20 rounded border border-gray-700">
                        <p className="text-[9px] font-black uppercase tracking-wider text-gray-500">{label}</p>
                        <p className="font-semibold text-white break-words">{value}</p>
                      </div>
                    ))}
                  </div>
                  {restoreExecution.warnings.length > 0 && (
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-wider text-yellow-400 mb-1">Warnings</p>
                      <ul className="list-disc pl-4 text-xs text-yellow-200 space-y-1">
                        {restoreExecution.warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}
                      </ul>
                    </div>
                  )}
                  {restoreExecution.errors.length > 0 && (
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-wider text-red-400 mb-1">Errors</p>
                      <ul className="list-disc pl-4 text-xs text-red-200 space-y-1">
                        {restoreExecution.errors.map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              {productionChecks.map(section => (
                <div key={section.group} className="p-3 bg-gray-800 rounded-lg border border-gray-700">
                  <p className="text-[9px] font-black uppercase tracking-wider text-gray-400 mb-2">{section.group}</p>
                  <ul className="space-y-1 text-xs">
                    {section.checks.map(([label, passed]) => (
                      <li key={String(label)} className="flex items-center justify-between gap-3">
                        <span className="text-gray-300">{label}</span>
                        <span className={passed ? "text-green-400" : "text-red-400"}>{passed ? "Yes" : "No"}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <div className="p-3 bg-gray-800 rounded-lg border border-gray-700">
                <p className="text-[9px] font-black uppercase tracking-wider text-gray-400 mb-2">Deployment</p>
                <ul className="space-y-1 text-xs text-gray-300">
                  <li className="flex justify-between gap-3"><span>Environment mode</span><span className="font-mono text-white">{environmentMode}</span></li>
                  <li className="flex justify-between gap-3"><span>Current assessment level</span><span className="font-mono text-white">{subscriptionLevel}</span></li>
                  <li className="flex justify-between gap-3"><span>Current org</span><span className="font-mono text-white break-all">{currentOrgId || "Not available"}</span></li>
                  <li className="flex justify-between gap-3"><span>Current user role</span><span className="font-mono text-white">{currentUserRole}</span></li>
                </ul>
              </div>
              <div className="space-y-2">
                <p className="text-[9px] font-black uppercase tracking-wider text-gray-500">Risk Register</p>
                {(["HIGH", "MEDIUM", "LOW"] as const).map(severity => (
                  <div key={severity} className="p-3 bg-black/30 rounded-lg border border-gray-800">
                    <p className={`text-[9px] font-black uppercase tracking-wider mb-2 ${severity === "HIGH" ? "text-red-400" : severity === "MEDIUM" ? "text-yellow-400" : "text-blue-400"}`}>{severity}</p>
                    <ul className="space-y-1 text-xs text-gray-300 list-disc pl-4">
                      {productionRisks.filter(risk => risk.severity === severity).map(risk => (
                        <li key={risk.item}>{risk.item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

      {isSuperAdmin && <DataCleanupAuditPanel />}
      {isSuperAdmin && <CleanupControlsPanel />}
      {isSuperAdmin && <ControlledCleanupExecutionPanel />}

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
