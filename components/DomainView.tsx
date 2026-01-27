
import React, { useState, useMemo } from 'react';
import { Domain, Practice, PracticeRecord, PracticeStatus } from '../types';
import { PracticeCard } from './PracticeCard';
import { ProgressBar } from './ProgressBar';
import { CollapsibleSection } from './CollapsibleSection';
import { generateDomainExplanation } from '../services/geminiService';
import { decode, pcmToWav } from '../services/audioUtils';
import { Volume2, Loader2, Download } from 'lucide-react';

interface DomainViewProps {
  domain: Domain;
  practiceRecords: PracticeRecord[];
  getDomainCompletion: (domainName: string) => number;
  onPracticeClick: (practiceId: string) => void;
}

export const DomainView: React.FC<DomainViewProps> = ({
  domain,
  practiceRecords,
  getDomainCompletion,
  onPracticeClick,
}) => {
  const percent = getDomainCompletion(domain.name);
  const practiceRecordMap = useMemo(() => new Map(practiceRecords.map(r => [r.id, r])), [practiceRecords]);

  // State for the audio explanation feature
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [audioScript, setAudioScript] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  /**
   * Generates an audio explanation for the current domain.
   * It fetches a script and audio from the AI service, creates a playable
   * audio blob, and updates the component's state to display the results.
   */
  const handleGenerateDomainAudio = async () => {
    setIsLoadingAudio(true);
    setAudioScript(null);
    
    // Revoke the previous object URL to prevent memory leaks
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }

    try {
      const { script, audioB64 } = await generateDomainExplanation(domain.name);
      
      const audioBytes = decode(audioB64);
      const audioBlob = pcmToWav(audioBytes);
      const url = URL.createObjectURL(audioBlob);

      setAudioScript(script);
      setAudioUrl(url);

    } catch (error) {
      console.error("Failed to generate domain audio explanation:", error);
      alert("Sorry, the audio explanation could not be generated at this time.");
    } finally {
      setIsLoadingAudio(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* ==========================
          DOMAIN HEADER
      =========================== */}
      <div className="pb-4 border-b border-gray-300">
        <h1 className="text-2xl font-bold">{domain.name}</h1>
        <div className="mt-3">
          <ProgressBar percent={percent} />
        </div>
        <div className="text-sm text-gray-600 mt-1">
          {percent}% Completed
        </div>
      </div>
      
      {/* ==========================
          AUDIO EXPLANATION SECTION
      =========================== */}
      <div className="bg-white p-4 rounded-lg shadow-md animate-fadeIn">
        <button
          onClick={handleGenerateDomainAudio}
          disabled={isLoadingAudio}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md shadow hover:bg-blue-700 transition disabled:bg-blue-400 disabled:cursor-wait"
        >
          {isLoadingAudio ? (
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
          ) : (
            <Volume2 className="h-5 w-5 mr-2" />
          )}
          {isLoadingAudio ? 'Generating Audio...' : `What is ${domain.name}?`}
        </button>

        {audioUrl && (
          <div className="mt-4 animate-fadeIn">
            <audio controls src={audioUrl} className="w-full"></audio>
            
            <a
              href={audioUrl}
              download={`${domain.name.replace(/[^a-zA-Z0-9]/g, '_')}_overview.mp3`}
              className="inline-block mt-3 px-3 py-1 bg-gray-700 text-white text-sm rounded-md hover:bg-gray-800"
            >
              <Download className="h-4 w-4 inline-block mr-1" />
              Download Audio
            </a>
          </div>
        )}

        {audioScript && (
          <div className="mt-4">
            <CollapsibleSection title="View Generated Script">
              <p className="text-sm text-gray-700 whitespace-pre-wrap p-2 bg-gray-50 rounded">
                {audioScript}
              </p>
            </CollapsibleSection>
          </div>
        )}
      </div>

      {/* ==========================
          PRACTICE CARDS GRID
      =========================== */}
      <h2 className="text-xl font-semibold text-gray-800 pt-4">Practices</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {domain.practices.map((practice) => {
          const record = practiceRecordMap.get(practice.id);
          const status = record?.status || 'not_assessed';
          return (
            <PracticeCard
              key={practice.id}
              practice={practice}
              status={status}
              onClick={() => onPracticeClick(practice.id)}
            />
          );
        })}
      </div>
    </div>
  );
};