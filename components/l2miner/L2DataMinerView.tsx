
import React, { useState } from 'react';
import { extractL2Requirement, validateAndRepairL2Json } from '../../services/geminiService';
import { L2ExtractionResult, L2ValidationResult } from '../../types';
import { Cpu, Loader2, Search, CheckCircle2, AlertTriangle, Hammer, Code, Eye, Database, CheckCircle, Save, Clock, BookOpen, AlertCircle } from 'lucide-react';
import { CollapsibleSection } from '../CollapsibleSection';

interface L2DataMinerViewProps {
  onCommit?: (mined: L2ExtractionResult) => void;
}

export const L2DataMinerView: React.FC<L2DataMinerViewProps> = ({ onCommit }) => {
  const [inputText, setInputText] = useState('');
  const [validationResult, setValidationResult] = useState<L2ValidationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [stage, setStage] = useState<'input' | 'extraction' | 'validation'>('input');
  const [activeResultTab, setActiveResultTab] = useState<'preview' | 'json'>('preview');
  const [isCommitted, setIsCommitted] = useState(false);

  const handleMineData = async () => {
    if (!inputText.trim()) return;
    setIsLoading(true);
    setStage('extraction');
    setIsCommitted(false);
    try {
      const extracted = await extractL2Requirement(inputText);
      setStage('validation');
      const validated = await validateAndRepairL2Json(JSON.stringify(extracted), inputText);
      setValidationResult(validated);
    } catch (error) {
      console.error("Mining failed:", error);
      alert("Multistage mining pipeline failed. Please check the content and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCommit = () => {
    if (validationResult && onCommit) {
      onCommit(validationResult.normalizedRequirement);
      setIsCommitted(true);
      alert('Requirement successfully committed to assessment! You can now find it in the sidebar and dashboard.');
    }
  };

  const renderStatusBanner = () => {
    if (!validationResult) return null;
    const isPass = validationResult.validationStatus === 'PASS';
    return (
      <div className={`p-4 rounded-lg flex items-center mb-6 shadow-sm border ${isPass ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
        {isPass ? <CheckCircle2 className="h-6 w-6 text-green-600 mr-3"/> : <AlertTriangle className="h-6 w-6 text-yellow-600 mr-3"/>}
        <div className="flex-1">
          <h3 className={`font-bold ${isPass ? 'text-green-800' : 'text-yellow-800'}`}>
            Validation: {validationResult.validationStatus}
          </h3>
          {validationResult.issues.length > 0 ? (
            <ul className="text-sm list-disc pl-5 mt-1 text-yellow-700">
              {validationResult.issues.map((issue, i) => <li key={i}>{issue}</li>)}
            </ul>
          ) : (
            <p className="text-sm text-green-700 font-medium">No structural issues found. Ready for integration.</p>
          )}
        </div>
        {isPass && !isCommitted && (
          <button onClick={handleCommit} className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition shadow-sm ml-4 font-bold">
            <Save className="h-4 w-4 mr-2"/> Commit to Assessment
          </button>
        )}
        {isCommitted && (
          <div className="flex items-center text-green-600 font-bold ml-4">
            <CheckCircle className="h-5 w-5 mr-1"/> Saved Successfully
          </div>
        )}
      </div>
    );
  };

  const renderVisualPreview = () => {
    if (!validationResult) return null;
    const mined = validationResult.normalizedRequirement;

    return (
      <div className="space-y-6 animate-fadeIn">
        {/* Practice Header Simulation */}
        <div className="bg-white rounded-lg shadow-md border overflow-hidden border-gray-200">
          <div className="p-5 bg-gray-50 border-b flex justify-between items-start">
            <div>
              <div className="flex items-center space-x-3 mb-1">
                <span className="px-3 py-1 text-[10px] font-bold rounded-full bg-gray-200 text-gray-800 uppercase tracking-tight">NOT ASSESSED</span>
                <h3 className="text-lg font-bold text-gray-900">{mined.requirementName}</h3>
              </div>
              <p className="text-xs font-mono text-gray-500">{mined.requirementId}</p>
              <p className="text-gray-600 mt-3 text-sm leading-relaxed">{mined.requirementStatement}</p>
            </div>
            <div className="bg-blue-600 text-white px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest shadow-sm">AI Mined</div>
          </div>
          
          <div className="p-5 space-y-6">
            {/* Simulation of Practice Rollup */}
            <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100 flex justify-between items-center">
               <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Compliance Rollup</h4>
                  <div className="px-4 py-2 text-sm font-bold rounded-md bg-gray-100 text-gray-800 inline-block">Practice: NOT ASSESSED</div>
               </div>
               <div className="text-right">
                  <div className="text-[10px] text-gray-400 italic mb-1">Last AI Sync</div>
                  <div className="flex items-center text-gray-500 text-xs"><Clock className="h-3 w-3 mr-1"/> Just now</div>
               </div>
            </div>

            <div className="flex items-center">
                <h4 className="font-bold text-sm text-gray-800">Assessment Objectives ({mined.assessmentObjectives.length})</h4>
                <div className="h-px flex-1 bg-gray-200 ml-4"></div>
            </div>

            <div className="space-y-4">
              {mined.assessmentObjectives.map(obj => (
                <div key={obj.objectiveId} className="border border-gray-200 rounded-lg bg-gray-50 shadow-sm overflow-hidden">
                   <div className="flex justify-between items-center p-3 bg-blue-700 text-white">
                      <p className="font-semibold text-xs leading-tight pr-4">{obj.determinationStatement}</p>
                      <div className="flex bg-blue-800 rounded-lg p-0.5 border border-blue-600">
                        <div className="px-2 py-1 text-[9px] font-bold text-blue-200 opacity-50">MET</div>
                        <div className="px-2 py-1 text-[9px] font-bold text-blue-200 opacity-50">NOT MET</div>
                        <div className="px-2 py-1 text-[9px] font-bold text-blue-200 opacity-50">N/A</div>
                      </div>
                   </div>
                   <div className="p-3 grid grid-cols-2 gap-4 bg-white">
                      <div>
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Required Methods</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {obj.assessmentMethods.map(m => <span key={m} className="bg-gray-100 border border-gray-200 text-gray-600 px-1.5 py-0.5 rounded text-[9px] capitalize font-medium">{m}</span>)}
                        </div>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Assessment Objects</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                           {(obj.assessmentObjects || []).slice(0, 3).map(o => <span key={o} className="bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded text-[9px] font-medium">{o}</span>)}
                           {(obj.assessmentObjects || []).length > 3 && <span className="text-[9px] text-gray-400">+{obj.assessmentObjects.length - 3} more</span>}
                        </div>
                      </div>
                   </div>
                </div>
              ))}
            </div>

            <div className="pt-4 space-y-4">
               <CollapsibleSection title="Discussion">
                 <div className="text-sm text-gray-600 italic leading-relaxed border-l-4 border-gray-200 pl-4">{mined.discussion}</div>
                 {mined.furtherDiscussion && (
                   <div className="mt-4">
                     <h5 className="font-bold text-xs text-gray-800 mb-2 flex items-center"><BookOpen className="h-3 w-3 mr-2"/> Further Discussion</h5>
                     <p className="text-sm text-gray-600 leading-relaxed">{mined.furtherDiscussion}</p>
                   </div>
                 )}
               </CollapsibleSection>
               
               <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="flex items-center text-[10px] text-gray-500 font-medium">
                    <AlertCircle className="h-3 w-3 mr-2 text-blue-500"/>
                    Source Trace: NIST SP 800-171 Rev 2
                  </div>
                  <div className="text-[10px] text-gray-400 font-mono">
                    pp. {mined.sourceTrace.pageStart}-{mined.sourceTrace.pageEnd} (Guide v{mined.sourceTrace.pdfVersion})
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-l-blue-600">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center mb-2">
          <Cpu className="h-7 w-7 mr-3 text-blue-600"/>
          Level 2 Data Miner
        </h2>
        <p className="text-gray-600">
          Paste text from the CMMC Level 2 Assessment Guide (v2.13) or NIST SP 800-171 Rev 2. The pipeline will normalize the data for your assessment.
        </p>
      </div>

      {stage === 'input' ? (
        <div className="bg-white p-6 rounded-lg shadow-md border">
          <div className="flex justify-between items-center mb-3">
            <label className="text-sm font-bold text-gray-700 uppercase tracking-wide">Requirement Source Text</label>
            <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold">READY FOR EXTRACTION</span>
          </div>
          <textarea
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder="Example: 3.14.3 Monitor system security alerts and advisories and take action in response..."
            className="w-full h-64 p-4 border border-gray-300 rounded-lg font-mono text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-black shadow-inner"
          />
          <div className="mt-4 flex justify-between items-center">
            <p className="text-[10px] text-gray-400 uppercase font-bold flex items-center">
               <Database className="h-3 w-3 mr-2"/> Assessor-Defensible Integrity Checks Active
            </p>
            <button
              onClick={handleMineData}
              disabled={!inputText.trim() || isLoading}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg shadow-lg hover:bg-blue-700 transition-all flex items-center disabled:bg-gray-400 font-bold active:scale-95"
            >
              {isLoading ? <Loader2 className="h-5 w-5 mr-2 animate-spin"/> : <Search className="h-5 w-5 mr-2"/>}
              Initialize Mining Pipeline
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-white p-3 rounded-lg border shadow-sm">
            <div className="flex items-center space-x-4">
               <div className={`flex items-center px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider ${stage === 'extraction' ? 'bg-blue-600 text-white shadow-md' : 'bg-green-100 text-green-700'}`}>
                 {stage === 'extraction' ? <Loader2 className="h-3 w-3 mr-2 animate-spin"/> : <CheckCircle2 className="h-3 w-3 mr-2"/>}
                 Extraction
               </div>
               <div className="h-px w-6 bg-gray-300"></div>
               <div className={`flex items-center px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider ${isLoading && stage === 'validation' ? 'bg-blue-600 text-white shadow-md animate-pulse' : stage === 'validation' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                 {isLoading && stage === 'validation' ? <Loader2 className="h-3 w-3 mr-2 animate-spin"/> : <Hammer className="h-3 w-3 mr-2"/>}
                 Validation & Repair
               </div>
            </div>
            <button onClick={() => setStage('input')} className="text-[10px] font-black text-red-600 hover:bg-red-50 px-4 py-1.5 rounded-lg border border-red-100 transition-colors uppercase tracking-widest">
              Restart Pipeline
            </button>
          </div>

          {isLoading ? (
            <div className="bg-white p-16 rounded-lg shadow-md border flex flex-col items-center justify-center text-center">
               <div className="relative mb-6">
                 <Loader2 className="h-16 w-16 text-blue-600 animate-spin"/>
                 <Cpu className="h-6 w-6 text-blue-400 absolute inset-0 m-auto"/>
               </div>
               <h3 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Pipeline Step: {stage === 'extraction' ? 'Deep Feature Parsing' : 'Compliance Cross-Check'}</h3>
               <p className="text-gray-500 mt-2 max-w-sm">Verifying requirement sequence integrity and mapping assessment objects to standard CMMC v2.13 libraries.</p>
            </div>
          ) : (
            <>
              {renderStatusBanner()}
              
              <div className="bg-white rounded-lg shadow-md border overflow-hidden">
                <div className="flex bg-gray-50 border-b">
                  <button onClick={() => setActiveResultTab('preview')} className={`flex-1 flex items-center justify-center py-4 text-xs font-black uppercase tracking-widest transition-all ${activeResultTab === 'preview' ? 'bg-white text-blue-700 border-b-2 border-blue-700' : 'text-gray-400 hover:text-gray-600'}`}>
                    <Eye className="h-4 w-4 mr-2"/> App View Simulation
                  </button>
                  <button onClick={() => setActiveResultTab('json')} className={`flex-1 flex items-center justify-center py-4 text-xs font-black uppercase tracking-widest transition-all ${activeResultTab === 'json' ? 'bg-white text-blue-700 border-b-2 border-blue-700' : 'text-gray-400 hover:text-gray-600'}`}>
                    <Code className="h-4 w-4 mr-2"/> Clean JSON Artifact
                  </button>
                </div>

                <div className="p-6 bg-gray-100 min-h-[500px]">
                  {activeResultTab === 'preview' ? (
                    <div className="max-w-3xl mx-auto">
                       {renderVisualPreview()}
                    </div>
                  ) : (
                    <div className="relative rounded-xl overflow-hidden border border-gray-800 h-[600px] flex flex-col shadow-2xl">
                      <div className="bg-gray-800 px-4 py-2.5 flex justify-between items-center">
                        <div className="flex items-center space-x-2">
                           <div className="h-3 w-3 rounded-full bg-red-500"></div>
                           <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
                           <div className="h-3 w-3 rounded-full bg-green-500"></div>
                           <span className="text-[10px] text-gray-400 font-mono ml-4 uppercase font-bold tracking-widest">requirement.json</span>
                        </div>
                        <button onClick={() => { navigator.clipboard.writeText(JSON.stringify(validationResult?.normalizedRequirement, null, 2)); alert('JSON copied to clipboard!'); }} className="text-[10px] font-bold bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-500 transition-colors uppercase">Copy JSON</button>
                      </div>
                      <pre className="flex-1 p-6 bg-gray-900 text-green-400 font-mono text-[11px] overflow-auto leading-relaxed scrollbar-thin scrollbar-thumb-gray-700">
                        {JSON.stringify(validationResult?.normalizedRequirement, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
