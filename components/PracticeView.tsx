
import React, { useState } from 'react';
import { Practice, AssessmentObjective, Artifact, SavedTemplate, PracticeRecord, PracticeStatus, StatusSource, ObjectiveRecord, ObjectiveStatus } from '../types';
import { AssessmentObjectiveItem } from './AssessmentObjectiveItem';
import { CollapsibleSection } from './CollapsibleSection';
import { generatePracticeExplanationAudio, generateSlideshow } from '../services/geminiService';
import { decode, pcmToWav } from '../services/audioUtils';
import { Sparkles, Volume2, Loader2, Download, Info, Check, RefreshCw, AlertCircle } from 'lucide-react';

interface PracticeViewProps {
  practice: Practice;
  practiceRecord: PracticeRecord;
  onUpdateNote: (practiceId: string, note: string) => void;
  onUpdateObjective: (practiceId: string, objectiveId: string, updates: Partial<ObjectiveRecord>) => void;
  onApplySuggestion: (practiceId: string) => void;
  onAssistClick: (practiceId: string) => void;
  storeTemplate: (template: SavedTemplate) => void;
}

export const PracticeView: React.FC<PracticeViewProps> = ({
  practice,
  practiceRecord,
  onUpdateNote,
  onUpdateObjective,
  onApplySuggestion,
  onAssistClick,
  storeTemplate,
}) => {
  const { status, statusSource, analyzerSuggestion, note } = practiceRecord;

  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [slideshowImages, setSlideshowImages] = useState<{ [key: string]: string[] }>({});
  const [loadingSlideshow, setLoadingSlideshow] = useState<string | null>(null);

  const splitTitle = practice.name.includes("–")
    ? practice.name.split("–")[1]?.trim()
    : practice.name.includes("-")
      ? practice.name.split("-").slice(1).join(" ").trim()
      : practice.name;

  const friendlyName = practice.name.split('–')[1]?.trim() || practice.name;

  const handleGeneratePracticeAudio = async () => {
    setIsLoadingAudio(true);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }

    try {
      const { script, audioB64 } = await generatePracticeExplanationAudio(practice);
      const audioBytes = decode(audioB64);
      const audioBlob = pcmToWav(audioBytes);
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);

    } catch (error) {
      console.error("Failed to generate practice audio explanation:", error);
      alert("Audio explanation unavailable.");
    } finally {
      setIsLoadingAudio(false);
    }
  };

  const handleGenerateSlideshow = async (objectiveId: string, actionPointsText: string) => {
    if (!actionPointsText) {
      alert("Generate Guidance first.");
      return;
    }
    setLoadingSlideshow(objectiveId);
    try {
      const imagesB64 = await generateSlideshow(actionPointsText);
      const imageUrls = imagesB64.map(b64 => `data:image/png;base64,${b64}`);
      setSlideshowImages(prev => ({ ...prev, [objectiveId]: imageUrls }));
    } catch (error) {
      console.error("Slideshow failed:", error);
      alert("Could not generate slideshow.");
    } finally {
      setLoadingSlideshow(null);
    }
  };
  
  const getStatusInfo = (s: PracticeStatus) => {
    switch (s) {
      case 'met': return { text: 'MET', color: 'bg-green-100 text-green-800' };
      case 'partial': return { text: 'PARTIAL', color: 'bg-yellow-100 text-yellow-800' };
      case 'not_met': return { text: 'NOT MET', color: 'bg-red-100 text-red-800' };
      case 'not_assessed':
      default: return { text: 'NOT ASSESSED', color: 'bg-gray-100 text-gray-800' };
    }
  };
  const statusInfo = getStatusInfo(status);

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden animate-fadeIn">
      {/* ==========================
          PRACTICE HEADER
      =========================== */}
      <div className="p-4 md:p-6 border-b border-gray-200 bg-gray-50">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center space-x-3 mb-1">
              <span className={`px-3 py-1 text-xs font-semibold rounded-full ${statusInfo.color}`}>
                {statusInfo.text}
              </span>
              <h3 className="text-lg font-bold text-gray-900">{splitTitle}</h3>
            </div>
            <p className="text-xs text-gray-500">{practice.id}</p>
            <p className="text-gray-600 mt-2">{practice.brief_description}</p>
          </div>
          <button
            onClick={() => onAssistClick(practice.id)}
            className="flex-shrink-0 ml-4 flex items-center px-3 py-1.5
                       bg-purple-100 text-purple-700 rounded-lg shadow-sm
                       hover:bg-purple-200 transition-colors text-sm font-medium"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Expert Assist
          </button>
        </div>
      </div>
      
      {/* ==========================
          MAIN CONTENT AREA
      =========================== */}
      <div className="p-4 md:p-6">
        
        {/* Practice Status Display (L2 Rollup Rule Indicator) */}
        <div className="mb-6 bg-white p-4 rounded-lg shadow-md border">
            <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-gray-800">Compliance Rollup (Level 2 Rules)</h3>
                {status === 'not_met' && (
                    <div className="flex items-center text-red-600 text-xs font-bold bg-red-50 px-2 py-1 rounded">
                        <AlertCircle className="h-3 w-3 mr-1"/> FAILURE DETECTED
                    </div>
                )}
            </div>
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="flex-1 space-y-2">
                    <p className="text-xs text-gray-500 italic mb-2">Note: Requirement is NOT MET if any single objective is NOT MET.</p>
                    <div className="flex items-center space-x-2">
                         <span className={`px-4 py-2 text-sm font-bold rounded-md ${statusInfo.color}`}>
                            Practice: {statusInfo.text}
                        </span>
                    </div>

                    {analyzerSuggestion && statusSource === 'analyzer_suggested' && (
                        <div className="mt-2 p-2 bg-indigo-50 border border-indigo-200 rounded-md text-sm flex items-center justify-between">
                            <div className="flex items-center">
                                <Info className="h-4 w-4 mr-2 text-indigo-600"/>
                                <div>
                                    <span className="font-semibold text-indigo-800">Suggested: {analyzerSuggestion.status.toUpperCase()}</span>
                                    <p className="text-indigo-700 text-xs">{analyzerSuggestion.reason}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <div className="flex-1">
                    <textarea 
                        value={note}
                        onChange={(e) => onUpdateNote(practice.id, e.target.value)}
                        placeholder="Add high-level implementation summary..."
                        className="w-full text-sm p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 transition bg-white text-black h-20"
                    />
                </div>
            </div>
        </div>

        {/* Audio Explanation */}
        <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200 mb-6">
          <button onClick={handleGeneratePracticeAudio} disabled={isLoadingAudio} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md shadow hover:bg-blue-700 transition disabled:bg-blue-400 disabled:cursor-wait">
            {isLoadingAudio ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Volume2 className="h-5 w-5 mr-2" />}
            {isLoadingAudio ? 'Generating...' : `Practice Overview (Audio)`}
          </button>

          {audioUrl && (
            <div className="mt-4 animate-fadeIn bg-gray-50 p-3 rounded-md border border-gray-200">
              <audio controls src={audioUrl} className="w-full"></audio>
            </div>
          )}
        </div>

        {/* Assessment Objectives (Granular level) */}
        <div className="mb-3 flex items-center">
            <h4 className="font-bold text-lg text-gray-800">Assessment Objectives</h4>
            <span className="ml-3 text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Level 2 Granularity</span>
        </div>
        <div className="space-y-4">
          {practice.assessment_objectives.map((staticObjective) => {
            const objectiveRecord = practiceRecord.objectiveRecords[staticObjective.id] || { status: ObjectiveStatus.Pending, note: '', artifacts: [] };
            const mergedObjective: AssessmentObjective = {
              ...staticObjective,
              ...objectiveRecord
            };
            return (
              <AssessmentObjectiveItem
                key={mergedObjective.id}
                objective={mergedObjective}
                practice={practice}
                onUpdateObjective={(objectiveId, updates) => onUpdateObjective(practice.id, objectiveId, updates)}
                storeTemplate={storeTemplate}
                slideshow={slideshowImages[mergedObjective.id]}
                isSlideshowLoading={loadingSlideshow === mergedObjective.id}
                onGenerateSlideshow={handleGenerateSlideshow}
              />
            )
          })}
        </div>

        {/* Collapsible Sections */}
        <div className="mt-6 space-y-4">
          <CollapsibleSection title="Potential Assessment Methods and Objects">
            {Array.isArray(practice.potential_assessment_methods_and_objects) ? (
              <ul className="list-disc pl-5 space-y-1 text-gray-600">{practice.potential_assessment_methods_and_objects.map((item, index) => <li key={index}>{item}</li>)}</ul>
            ) : (<p className="text-gray-600">{practice.potential_assessment_methods_and_objects || "No methods provided."}</p>)}
          </CollapsibleSection>

          <CollapsibleSection title="Discussion & Further Discussion">
            <h5 className="font-semibold mb-1">Discussion</h5>
            {Array.isArray(practice.discussion) ? (
              <ul className="list-disc pl-5 text-gray-600 space-y-1">{practice.discussion.map((d, i) => <li key={i}>{d}</li>)}</ul>
            ) : (<p className="text-gray-600">{practice.discussion || "No discussion provided."}</p>)}
            <h5 className="font-semibold mt-4 mb-1">Further Discussion</h5>
            {Array.isArray(practice.further_discussion) ? (
              <ul className="list-disc pl-5 text-gray-600 space-y-1">{practice.further_discussion.map((d, i) => <li key={i}>{d}</li>)}</ul>
            ) : (<p className="text-gray-600">{practice.further_discussion || "No further discussion provided."}</p>)}
          </CollapsibleSection>

          <CollapsibleSection title="Key References">
            {practice.key_references?.length ? (
              <ul className="list-disc pl-5 text-gray-600 space-y-1">{practice.key_references.map((ref, i) => <li key={i}>{ref}</li>)}</ul>
            ) : (<p className="text-gray-600">No key references provided.</p>)}
          </CollapsibleSection>
        </div>
      </div>
    </div>
  );
};
