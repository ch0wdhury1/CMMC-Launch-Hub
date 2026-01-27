
import React, { useState } from 'react';
import { TranscriptModal } from './TranscriptModal';
import { generateInstructionAudio } from '../services/geminiService';
import { decode, pcmToWav } from '../services/audioUtils';
import { Volume2, FileText, Loader2, BookOpen } from 'lucide-react';

const WALKTHROUGH_SCRIPT = `Welcome to the CMMC Launch Hub — your centralized workspace for managing CMMC Level 1 readiness and documentation.

Let’s take a quick walkthrough of the tools available to you.

Start on the Dashboard, where you’ll find your progress bar, SPRS score indicator, and guided options to begin your assessment. You can also access this walkthrough anytime as audio or a transcript.

Under Assessment Domains, you’ll review all 15 required CMMC Level 1 practices. Each practice includes a description, evidence requirements, and an automated status tracker to help you mark what’s complete or missing.

The Security Readiness Analyzer gives you a fast, high-level evaluation of your organization’s cybersecurity posture. When you answer a few questions, the system generates a readiness summary with plain-language recommendations.

The System Security Plan (SSP) generator creates a fully-structured SSP tailored to your environment. Each section is automatically populated using your assessment inputs.

The Plan of Action and Milestones (POAM) module helps you track deficiencies, assign owners, and monitor remediation progress.

The Responsibility Matrix clarifies who is responsible, accountable, and supporting each CMMC practice — helping leadership and teams stay aligned.

Under Awareness & Training, you’ll find guided training modules for Leadership, Technical Staff, and All Employees. Each module includes interactive slides, topics with expandable explanations, and progress tracking.

Finally, the News Updates section brings verified .gov cybersecurity and CMMC announcements directly into your portal to keep you informed.

With these tools combined, the CMMC Launch Hub helps your organization stay organized, document compliance, and build a repeatable security program.

Let’s get started.`;

export const HowItWorksPanel: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const handleListen = async () => {
    setIsLoadingAudio(true);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    try {
      const audioB64 = await generateInstructionAudio(WALKTHROUGH_SCRIPT);
      const audioBytes = decode(audioB64);
      const audioBlob = pcmToWav(audioBytes);
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
    } catch (error) {
      console.error("Failed to generate walkthrough audio:", error);
      alert("Sorry, the walkthrough audio could not be generated at this time.");
    } finally {
      setIsLoadingAudio(false);
    }
  };

  const handleRead = () => {
    setIsModalOpen(true);
  };

  return (
    <>
      <div className="animate-fadeIn bg-white p-6 rounded-xl shadow-md border border-gray-200">
        <h3 className="flex items-center text-xl font-bold text-gray-800 mb-4">
          <BookOpen className="h-6 w-6 mr-3 text-blue-600" />
          How the Launch Hub Works
        </h3>
        
        <p className="text-gray-600 mb-6">
          Please click on "Listen to Walkthrough" button to get an overall understanding of how this application works. You may also click on "Read Transcript" button to read the walkthrough
        </p>
        
        <div className="flex items-center space-x-4 mb-4">
          <button
            onClick={handleListen}
            disabled={isLoadingAudio}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg shadow-sm hover:bg-blue-700 transition-colors font-semibold disabled:bg-blue-400"
          >
            {isLoadingAudio ? (
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <Volume2 className="h-5 w-5 mr-2" />
            )}
            {isLoadingAudio ? 'Generating...' : 'Listen to Walkthrough'}
          </button>
          <button
            onClick={handleRead}
            className="flex items-center px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg shadow-sm hover:bg-gray-100 transition-colors font-semibold"
          >
            <FileText className="h-5 w-5 mr-2" />
            Read Transcript
          </button>
        </div>

        {audioUrl && (
          <div className="mt-4 animate-fadeIn">
            <audio controls autoPlay src={audioUrl} className="w-full">
              Your browser does not support the audio element.
            </audio>
          </div>
        )}
      </div>

      <TranscriptModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        scriptText={WALKTHROUGH_SCRIPT}
      />
    </>
  );
};
