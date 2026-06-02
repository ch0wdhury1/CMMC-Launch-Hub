
import React, { useState, useRef, useEffect } from 'react';
import { AssessmentObjective, Artifact, AttachedLibraryEvidence, EvidenceFileUpload, EvidenceLibraryItem, ObjectiveStatus, Practice, SavedTemplate, ObjectiveRecord } from '../types';


import { callGemini } from '../src/lib/geminiClient';
import { 
  generateInstructionAudio,
} from '../services/geminiService';



import { jsPDF } from 'jspdf';
import { Paperclip, FileText, Archive, Loader2, Bot, Volume2, Download, ExternalLink, MessageSquare, Send, ChevronDown, ChevronUp, Save, Film, Clapperboard, X, ChevronLeft, ChevronRight, Sparkles, ClipboardCopy, CheckCircle2, XCircle, HelpCircle, Link2, Unlink } from 'lucide-react';
import { EvidenceLibraryPickerModal } from './EvidenceLibraryPickerModal';
import { attachEvidenceLibraryItem, detachEvidenceLibraryItem, subscribeAttachedLibraryEvidence } from '../src/evidenceReferences';
import { ResponsibilityAssignmentSelect, type ResponsibilityAssignmentContext } from './ResponsibilityAssignmentSelect';
import { EvidenceValidationPanel } from './EvidenceValidationPanel';

type ChatMessage = {
  role: 'user' | 'model';
  text: string;
};

// =======================================================
//   SLIDESHOW MODAL COMPONENT
// =======================================================
interface SlideshowModalProps {
  images: string[];
  isOpen: boolean;
  onClose: () => void;
  startIndex?: number;
}

const SlideshowModal: React.FC<SlideshowModalProps> = ({ images, isOpen, onClose, startIndex = 0 }) => {
  const [currentIndex, setCurrentIndex] = useState(startIndex);

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(startIndex);
    }
  }, [isOpen, startIndex]);
  
  const goToPrevious = (e: React.MouseEvent) => {
    e.stopPropagation();
    const isFirstSlide = currentIndex === 0;
    const newIndex = isFirstSlide ? images.length - 1 : currentIndex - 1;
    setCurrentIndex(newIndex);
  };

  const goToNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    const isLastSlide = currentIndex === images.length - 1;
    const newIndex = isLastSlide ? 0 : currentIndex + 1;
    setCurrentIndex(newIndex);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goToPrevious(e as any);
      if (e.key === 'ArrowRight') goToNext(e as any);
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, currentIndex, onClose]);


  if (!isOpen || !images || images.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 animate-fadeIn" onClick={onClose}>
      <div className="relative bg-white rounded-lg shadow-xl p-4 max-w-4xl max-h-[90vh] w-full flex flex-col items-center" onClick={e => e.stopPropagation()}>
        {/* Close Button */}
        <button onClick={onClose} className="absolute top-2 right-2 text-gray-500 hover:text-black z-20">
          <X size={28} />
        </button>
        
        {/* Image Container */}
        <div className="relative w-full h-full flex items-center justify-center">
           <img src={images[currentIndex]} alt={`Slide ${currentIndex + 1}`} className="max-w-full max-h-[75vh] object-contain rounded-md" />
        </div>

        {/* Navigation */}
        <div className="absolute inset-y-0 left-0 flex items-center">
           <button onClick={goToPrevious} className="p-2 m-2 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-75 transition-opacity">
              <ChevronLeft size={32} />
           </button>
        </div>
         <div className="absolute inset-y-0 right-0 flex items-center">
           <button onClick={goToNext} className="p-2 m-2 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-75 transition-opacity">
              <ChevronRight size={32} />
           </button>
        </div>

        {/* Counter */}
        <div className="absolute bottom-4 text-white bg-black bg-opacity-50 px-3 py-1 rounded-full text-sm">
            {currentIndex + 1} / {images.length}
        </div>
      </div>
    </div>
  );
};

// =======================================================
//   ASSESSMENT OBJECTIVE ITEM COMPONENT
// =======================================================
interface AssessmentObjectiveItemProps {
  objective: AssessmentObjective; 
  practice: Practice;
  onUpdateObjective: (objectiveId: string, updates: Partial<ObjectiveRecord>, evidenceFiles?: EvidenceFileUpload[]) => void;
  onArchiveEvidence: (objectiveId: string, artifact: Artifact, archiveReason: string) => Promise<void>;
  storeTemplate: (template: SavedTemplate) => void;
  slideshow?: string[];
  isSlideshowLoading: boolean;
  onGenerateSlideshow: (objectiveId: string, actionPointsText: string) => void;
  libraryEvidenceContext?: {
    orgId: string;
    assessmentId: string;
    uid: string;
    canManage: boolean;
  };
  assignmentContext?: ResponsibilityAssignmentContext;
}

type Template = NonNullable<AssessmentObjective['templates']>[0];

export const AssessmentObjectiveItem: React.FC<AssessmentObjectiveItemProps> = ({
  objective,
  practice,
  onUpdateObjective,
  onArchiveEvidence,
  storeTemplate,
  slideshow,
  isSlideshowLoading,
  onGenerateSlideshow,
  libraryEvidenceContext,
  assignmentContext,
}) => {
  // UI State
  const [isUploading, setIsUploading] = useState(false);
  const [isActionPointsLoading, setIsActionPointsLoading] = useState(false);
  const [isSummaryAudioLoading, setIsSummaryAudioLoading] = useState(false);
  const [isDeepDiveOpen, setIsDeepDiveOpen] = useState(false);
  const [isSlideshowModalOpen, setIsSlideshowModalOpen] = useState(false);
  const [showArchivedEvidence, setShowArchivedEvidence] = useState(false);
  const [archivingEvidenceId, setArchivingEvidenceId] = useState<string | null>(null);
  const [isLibraryPickerOpen, setIsLibraryPickerOpen] = useState(false);
  const [attachedLibraryEvidence, setAttachedLibraryEvidence] = useState<AttachedLibraryEvidence[]>([]);
  const [detachingLibraryEvidenceId, setDetachingLibraryEvidenceId] = useState<string | null>(null);
  
  // Deep Dive Chat State
  const [deepDiveHistory, setDeepDiveHistory] = useState<ChatMessage[]>([]);
  const [deepDiveInput, setDeepDiveInput] = useState('');
  const [isDeepDiveLoading, setIsDeepDiveLoading] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);




  const handleGetActionPoints = async () => {
    setIsActionPointsLoading(true);
    try {
      const ctx = {
        practiceId: practice?.id,
        practiceTitle: (practice as any)?.name ?? (practice as any)?.title,
        objectiveId: objective?.id,
        objectiveText: objective?.text,
        objectiveStatus: objective?.status,
        note: objective?.note || "",
        artifacts: (objective?.artifacts || []).slice(0, 6).map(a => ({
          name: a.name,
          fileType: a.fileType,
          ocrSummary: a.ocrSummary,
        })),
      };

      const prompt = `
Return STRICT JSON only. No markdown. No commentary.

You are a CMMC Level 2 readiness assistant. Generate implementation guidance for THIS objective.

JSON schema:
{
  "actionPointsHtml": "string (HTML with <ul><li> etc. Keep concise, scannable.)",
  "summary": "string (2-5 sentences, plain text)",
  "templates": [
    { "name": "string", "filename": "string ending with .txt", "content": "string" }
  ]
}

Rules:
- Templates should be practical evidence artifacts (policy/procedure snippets, checklists, logs, SOPs).
- Keep templates short but usable.
- Ensure HTML is safe/simple (p, ul, li, b).

Context:
${JSON.stringify(ctx, null, 2)}
      `.trim();

      const raw = await callGemini(prompt, { model: 'gemini-2.5-flash', temperature: 0.2 });

      let parsed: any = null;
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        console.error("AI returned non-JSON:", raw);
        throw new Error("AI response was not valid JSON. Try again.");
      }

      const actionPointsHtml = String(parsed?.actionPointsHtml || "").trim();
      const summary = String(parsed?.summary || "").trim();
      const templates = Array.isArray(parsed?.templates) ? parsed.templates : [];

      const newTemplates = templates.map((t: any) => ({
        id: crypto.randomUUID(),
        name: String(t?.name || "Template"),
        filename: String(t?.filename || "template.txt"),
        content: String(t?.content || ""),
        createdAt: new Date().toISOString(),
      }));

      onUpdateObjective(objective.id, {
        actionPoints: actionPointsHtml,
        actionPointsSummary: summary,
        templates: newTemplates,
      });

      newTemplates.forEach((t: any) => {
        storeTemplate({
          id: t.id,
          practiceId: practice.id,
          objectiveId: objective.id,
          title: t.name,
          content: t.content,
          createdAt: t.createdAt,
        });
      });

    } catch (error: any) {
      console.error("Action Points failed:", error);
      alert(error?.message || "Could not get AI guidance.");
    } finally {
      setIsActionPointsLoading(false);
    }
  };






  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [deepDiveHistory]);


  const handleStatusChange = (status: ObjectiveStatus) => {
    onUpdateObjective(objective.id, { status });
  };

  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdateObjective(objective.id, { note: e.target.value });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const newArtifact: Artifact = {
        id: crypto.randomUUID(),
        name: file.name, 
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        ocrSummary: "",
        processingStatus: "ocr_pending",
        uploadedAt: new Date().toISOString(),
        isFinalForm: true
      };
      onUpdateObjective(objective.id, { artifacts: [...objective.artifacts, newArtifact] }, [{
        evidenceId: newArtifact.id,
        file,
      }]);
    } catch (error) { console.error("Could not save artifact metadata:", error); }
    finally { setIsUploading(false); e.target.value = ""; }
  };

  const archiveArtifact = async (artifact: Artifact) => {
    if (artifact.archived) return;
    if (!window.confirm("Archive this evidence? It will be hidden from the active evidence list but not deleted.")) return;
    const archiveReason = window.prompt("Reason for archive")?.trim() || "";
    setArchivingEvidenceId(artifact.id);
    try {
      await onArchiveEvidence(objective.id, artifact, archiveReason);
    } catch (error) {
      console.warn("Evidence archive failed; artifact retained.", error);
    } finally {
      setArchivingEvidenceId(null);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (typeof bytes !== "number") return "";
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  };

  const downloadArtifact = async (artifact: Artifact) => {
    const downloadUrl = artifact.downloadUrl?.trim();
    if (!downloadUrl) return;
    const fileName = artifact.fileName || artifact.name || "evidence-file";

    try {
      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error(`Download failed with status ${response.status}`);
      const blobUrl = URL.createObjectURL(await response.blob());
      const blobLink = document.createElement("a");
      blobLink.href = blobUrl;
      blobLink.download = fileName;
      blobLink.rel = "noopener noreferrer";
      document.body.appendChild(blobLink);
      blobLink.click();
      document.body.removeChild(blobLink);
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
    } catch (error) {
      console.warn("Evidence blob download failed; opening file in a new tab.", error);
      window.open(downloadUrl, "_blank", "noopener,noreferrer");
    }
  };

  const viewArtifact = (artifact: Artifact) => {
    const downloadUrl = artifact.downloadUrl?.trim();
    if (!downloadUrl) return;
    window.open(downloadUrl, "_blank", "noopener,noreferrer");
  };

  const archivedArtifactCount = objective.artifacts.filter(artifact => artifact.archived || artifact.status === "archived").length;
  const visibleArtifacts = objective.artifacts.filter(artifact => showArchivedEvidence || (!artifact.archived && artifact.status !== "archived"));

  useEffect(() => {
    if (!libraryEvidenceContext) {
      setAttachedLibraryEvidence([]);
      return;
    }
    return subscribeAttachedLibraryEvidence({
      orgId: libraryEvidenceContext.orgId,
      assessmentId: libraryEvidenceContext.assessmentId,
      practiceId: practice.id,
      objectiveId: objective.id,
    }, setAttachedLibraryEvidence, error => console.warn("[evidence-library] attached evidence load failed", error));
  }, [libraryEvidenceContext?.assessmentId, libraryEvidenceContext?.orgId, objective.id, practice.id]);

  const attachLibraryEvidence = async (item: EvidenceLibraryItem) => {
    if (!libraryEvidenceContext?.canManage) return;
    await attachEvidenceLibraryItem({
      orgId: libraryEvidenceContext.orgId,
      assessmentId: libraryEvidenceContext.assessmentId,
      practiceId: practice.id,
      objectiveId: objective.id,
    }, item.id, libraryEvidenceContext.uid);
  };

  const detachLibraryEvidence = async (reference: AttachedLibraryEvidence) => {
    if (!libraryEvidenceContext?.canManage) return;
    if (!window.confirm("Detach this evidence from this practice/objective? The original library file will remain available.")) return;
    setDetachingLibraryEvidenceId(reference.evidenceId);
    try {
      await detachEvidenceLibraryItem({
        orgId: libraryEvidenceContext.orgId,
        assessmentId: libraryEvidenceContext.assessmentId,
        practiceId: practice.id,
        objectiveId: objective.id,
      }, reference.evidenceId, libraryEvidenceContext.uid);
    } catch (error) {
      console.warn("[evidence-library] detach failed", error);
    } finally {
      setDetachingLibraryEvidenceId(null);
    }
  };

  const downloadLibraryEvidence = async (item: EvidenceLibraryItem) => {
    if (!item.downloadURL) return;
    try {
      const response = await fetch(item.downloadURL);
      if (!response.ok) throw new Error(`Download failed with status ${response.status}`);
      const blobUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = item.fileName || "evidence-file";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
    } catch (error) {
      console.warn("[evidence-library] blob download failed; opening file", error);
      window.open(item.downloadURL, "_blank", "noopener,noreferrer");
    }
  };

  const handlePlaySummaryAudio = async () => {
    if (!objective.actionPointsSummary) {
      alert("Action Points summary is not available yet.");
      return;
    }
    setIsSummaryAudioLoading(true);
    try {
      const audioB64 = await generateInstructionAudio(objective.actionPointsSummary);
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const decoded = await decodeAudioData(decode(audioB64), audioContext, 24000, 1);
      const source = audioContext.createBufferSource();
      source.buffer = decoded;
      source.connect(audioContext.destination);
      source.start();
    } catch (error) { console.error("Audio generation failed:", error); alert("Could not generate audio."); } 
    finally { setIsSummaryAudioLoading(false); }
  };
  
  const handleDownloadTxt = (template: Template) => {
    const blob = new Blob([template.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = template.filename;
    link.click();
    URL.revokeObjectURL(url);
  };
  
  const handleCopyText = (template: Template) => {
    navigator.clipboard.writeText(template.content)
      .then(() => alert('Template text copied!'))
      .catch(err => console.error('Failed to copy text: ', err));
  };
  
  const handleDownloadPdf = (template: Template) => {
    const doc = new jsPDF();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(16);
    doc.text(template.name, 20, 20);
    doc.setFontSize(11);
    const splitText = doc.splitTextToSize(template.content, 170); 
    doc.text(splitText, 20, 30);
    const safeFilename = template.filename.replace(/\.txt$/, '.pdf');
    doc.save(safeFilename);
  };
  
  const handleSavePdf = (template: Template) => {
    const savedTemplate: SavedTemplate = {
        id: crypto.randomUUID(),
        practiceId: practice.id,
        objectiveId: objective.id,
        title: `${template.name} (PDF)`,
        content: template.content,
        createdAt: new Date().toISOString(),
        type: 'pdf',
    };
    storeTemplate(savedTemplate);
    alert(`"${template.name} (PDF)" has been saved.`);
  };





  const buildChatPrompt = (history: ChatMessage[], latestUserMsg: string) => {
    const ctx = {
      practiceId: practice?.id,
      practiceTitle: (practice as any)?.name ?? (practice as any)?.title,
      objectiveId: objective?.id,
      objectiveText: objective?.text,
      objectiveStatus: objective?.status,
      actionPointsSummary: objective?.actionPointsSummary || "",
      note: objective?.note || "",
      artifacts: (objective?.artifacts || []).slice(0, 6).map(a => ({
        name: a.name,
        ocrSummary: a.ocrSummary,
      })),
    };

    const lastTurns = history.slice(-8).map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n');

    return `
You are a CMMC Level 2 compliance assistant helping a small defense contractor.

Objective context (JSON):
${JSON.stringify(ctx, null, 2)}

Conversation (most recent last):
${lastTurns}

USER: ${latestUserMsg}

Respond in a helpful, practical way:
- direct answer first
- steps/checklist if relevant
- include evidence examples when possible
- keep it concise
    `.trim();
  };

  const handleSendDeepDiveMessage = async () => {
    if (!deepDiveInput.trim() || isDeepDiveLoading) return;

    const newUserMessage: ChatMessage = { role: 'user', text: deepDiveInput };
    const updatedHistory = [...deepDiveHistory, newUserMessage];

    setDeepDiveHistory(updatedHistory);
    setDeepDiveInput('');
    setIsDeepDiveLoading(true);

    // add placeholder model message so UI stays the same
    setDeepDiveHistory(prev => [...prev, { role: 'model', text: '' }]);

    try {
      const prompt = buildChatPrompt(deepDiveHistory, newUserMessage.text);
      const text = await callGemini(prompt, { model: 'gemini-2.5-flash', temperature: 0.2 });

      setDeepDiveHistory(prev =>
        prev.map((msg, i) =>
          i === prev.length - 1 ? { ...msg, text: (text || '').trim() || 'Sorry, no response.' } : msg
        )
      );
    } catch (error) {
      console.error('Chat error:', error);
      setDeepDiveHistory(prev =>
        prev.map((msg, i) =>
          i === prev.length - 1 ? { ...msg, text: 'Sorry, something went wrong.' } : msg
        )
      );
    } finally {
      setIsDeepDiveLoading(false);
    }
  };







  const stripHtml = (html?: string) => {
    if (!html) return "";
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || "";
  };
  
  const SlideshowButton = () => {
    if (isSlideshowLoading) {
      return (
        <button disabled className="flex items-center text-xs px-2 py-1 bg-purple-400 text-white rounded-md cursor-wait" title="Generating Slideshow...">
          <Loader2 className="h-4 w-4 animate-spin" />
        </button>
      );
    }
    if (slideshow && slideshow.length > 0) {
      return (
        <button 
          onClick={() => setIsSlideshowModalOpen(true)}
          className="flex items-center text-xs px-2 py-1 bg-purple-200 text-purple-800 rounded-md hover:bg-purple-300"
          title="View Slideshow"
        >
          <Clapperboard className="h-4 w-4" />
        </button>
      );
    }
    return (
      <button 
        onClick={() => onGenerateSlideshow(objective.id, stripHtml(objective.actionPoints))}
        disabled={isActionPointsLoading || !objective.actionPoints}
        className="flex items-center text-xs px-2 py-1 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
        title="Generate Slideshow"
      >
        <Film className="h-4 w-4" />
      </button>
    );
  };

  const statusColors = {
      [ObjectiveStatus.Met]: "bg-green-600 text-white",
      [ObjectiveStatus.NotMet]: "bg-red-600 text-white",
      [ObjectiveStatus.NotApplicable]: "bg-gray-600 text-white",
      [ObjectiveStatus.Pending]: "bg-gray-200 text-gray-700 hover:bg-gray-300"
  };

  return (
    <div className="mb-6">
        <div className="border border-gray-300 rounded-lg bg-gray-50 shadow-sm">
            {/* ROW 1: Header Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-3 bg-blue-700 text-white rounded-t-lg">
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm leading-tight">{objective.text}</p>
                </div>
                <div className="flex items-center space-x-2 flex-shrink-0">
                    {/* Status Toggle (Level 2 Paradigm) */}
                    <div className="flex bg-blue-800 rounded-lg p-0.5 border border-blue-600">
                        <button 
                            onClick={() => handleStatusChange(ObjectiveStatus.Met)}
                            className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all flex items-center ${objective.status === ObjectiveStatus.Met ? 'bg-green-500 text-white shadow' : 'text-blue-200 hover:text-white'}`}
                        >
                            <CheckCircle2 className="h-3 w-3 mr-1"/> MET
                        </button>
                        <button 
                            onClick={() => handleStatusChange(ObjectiveStatus.NotMet)}
                            className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all flex items-center ${objective.status === ObjectiveStatus.NotMet ? 'bg-red-500 text-white shadow' : 'text-blue-200 hover:text-white'}`}
                        >
                            <XCircle className="h-3 w-3 mr-1"/> NOT MET
                        </button>
                        <button 
                            onClick={() => handleStatusChange(ObjectiveStatus.NotApplicable)}
                            className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all flex items-center ${objective.status === ObjectiveStatus.NotApplicable ? 'bg-gray-500 text-white shadow' : 'text-blue-200 hover:text-white'}`}
                        >
                            <HelpCircle className="h-3 w-3 mr-1"/> N/A
                        </button>
                    </div>

                    <button onClick={handlePlaySummaryAudio} disabled={isSummaryAudioLoading || !objective.actionPointsSummary} className="flex items-center text-xs px-2 py-1 bg-yellow-400 text-gray-900 rounded-md hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed" title="Play Summary">
                        {isSummaryAudioLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
                    </button>
                    <SlideshowButton />
                    <label className="flex items-center cursor-pointer text-xs px-3 py-1 bg-white text-blue-700 font-medium rounded hover:bg-gray-100">
                        <Paperclip className="h-4 w-4 mr-1" />
                        {isUploading ? "..." : "Attach"}
                        <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                    </label>
                </div>
            </div>

            <div className="p-4 space-y-4">
                <ResponsibilityAssignmentSelect
                  value={objective.assignedTo}
                  assignedToName={objective.assignedToName}
                  assignedToEmail={objective.assignedToEmail}
                  context={assignmentContext}
                  onChange={assignment => onUpdateObjective(objective.id, assignment)}
                  className="max-w-xs"
                />
                {/* ROW 2: Action Points & Notes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Left Column: Action Points */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700">Level 2 Implementation Guidance</label>
                        <div className="p-3 bg-white border rounded-md shadow-sm min-h-[150px] max-h-96 overflow-y-auto space-y-3 scrollbar-thin scrollbar-track-gray-100 scrollbar-thumb-gray-300 hover:scrollbar-thumb-gray-400">
                            {isActionPointsLoading ? (
                                <div className="flex items-center justify-center h-full text-gray-500">
                                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Generating L2 Guidance...
                                </div>
                            ) : objective.actionPoints ? (
                                <div className="text-sm text-gray-800 rich-text-content" dangerouslySetInnerHTML={{ __html: objective.actionPoints }}></div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-gray-500 text-center p-4">
                                    <p className="mb-4 text-sm">
                                        Click to generate AI-powered CMMC Level 2 action points and evidence templates.
                                    </p>
                                    <button
                                        onClick={handleGetActionPoints}
                                        className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg shadow-sm hover:bg-blue-700 transition-colors text-sm font-medium"
                                    >
                                        <Sparkles className="h-4 w-4 mr-2" />
                                        Get Expert Guidance
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    {/* Right Column: Notes */}
                    <div className="flex flex-col">
                        <label className="text-sm font-semibold text-gray-700 mb-2">Assessor Review Notes</label>
                        <textarea value={objective.note || ""} onChange={handleNoteChange} placeholder="Document implementation details or N/A justification here..." className="w-full h-full text-sm p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 transition bg-white text-black flex-1 min-h-[150px]" />
                    </div>
                </div>

                {/* ROW 3: Downloadable Templates */}
                {objective.templates && objective.templates.length > 0 && (
                  <div className="p-3 bg-gray-100 border rounded-lg">
                    <h4 className="font-semibold text-sm text-gray-700 mb-2">Requirement Templates (Final Form)</h4>
                    <div className="space-y-3">
                      {objective.templates.map((tpl) => (
                        <div key={tpl.id} className="pt-2 border-t first:border-t-0">
                          <p className="font-medium text-gray-800 text-sm">{tpl.name}</p>
                          <div className="flex items-center space-x-2 mt-2">
                            <button onClick={() => handleDownloadTxt(tpl)} className="flex items-center text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">
                              <Download className="h-3 w-3 mr-1.5" /> TXT
                            </button>
                            <button onClick={() => handleCopyText(tpl)} className="flex items-center text-xs px-2 py-1 bg-gray-600 text-white rounded hover:bg-gray-700">
                              <ClipboardCopy className="h-3 w-3 mr-1.5" /> Copy
                            </button>
                            <button onClick={() => handleDownloadPdf(tpl)} className="flex items-center text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700">
                              <FileText className="h-3 w-3 mr-1.5" /> Download PDF
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Artifacts Display */}
                {objective.artifacts?.length > 0 && (
                <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-gray-700">Verified Artifacts (Evidence)</h4>
                      {archivedArtifactCount > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowArchivedEvidence(current => !current)}
                          className="text-xs text-blue-700 hover:text-blue-900"
                        >
                          {showArchivedEvidence ? "Hide archived evidence" : "Show archived evidence"}
                        </button>
                      )}
                    </div>
                    <div className="space-y-2 p-2 bg-gray-100 rounded-md">
                        {visibleArtifacts.map((artifact) => (
                        <div key={artifact.id} className={`flex items-start p-2 border border-gray-200 rounded-md ${artifact.archived || artifact.status === "archived" ? "bg-gray-50 opacity-70" : "bg-white"}`}>
                            <FileText className="h-8 w-8 text-gray-400 flex-shrink-0 mr-3" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-800 break-all">
                                  {artifact.name}
                                  {(artifact.archived || artifact.status === "archived") && <span className="ml-2 text-xs font-semibold text-gray-500">Archived</span>}
                                  {artifact.status === "upload_failed" && <span className="ml-2 text-xs font-semibold text-red-700">Upload Failed</span>}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                  {[formatFileSize(artifact.fileSize), `OCR: ${artifact.processingStatus?.replace("ocr_", "") || "pending"}`, `Storage: ${artifact.storageStatus === "upload_failed" ? "failed" : artifact.storageStatus || "unavailable"}`].filter(Boolean).join(" | ")}
                                </p>
                                {artifact.storageStatus === "upload_failed" && artifact.storageError && <p className="mt-1 text-xs text-red-700">{artifact.storageError}</p>}
                                {artifact.storageStatus === "uploaded" && artifact.processingStatus === "ocr_failed" && <p className="mt-1 text-xs text-amber-700">{artifact.processingError || "File uploaded, but OCR processing failed."}</p>}
                                <p className="text-xs text-gray-500 mt-1 italic">"{artifact.ocrSummary}"</p>
                                {libraryEvidenceContext && (
                                  <EvidenceValidationPanel
                                    canValidate={libraryEvidenceContext.canManage}
                                    request={{
                                      orgId: libraryEvidenceContext.orgId,
                                      assessmentId: libraryEvidenceContext.assessmentId,
                                      practiceId: practice.id,
                                      objectiveId: objective.id,
                                      evidenceId: artifact.id,
                                      evidenceSource: "uploaded",
                                      practiceTitle: practice.name,
                                      objectiveTitle: objective.text,
                                      fileName: artifact.fileName || artifact.name,
                                      description: artifact.description,
                                      ocrSummary: artifact.ocrSummary,
                                    }}
                                  />
                                )}
                            </div>
                            <div className="flex items-center gap-1 ml-2">
                              <button
                                type="button"
                                onClick={() => viewArtifact(artifact)}
                                disabled={!artifact.downloadUrl}
                                title={artifact.downloadUrl ? "View evidence" : "File unavailable"}
                                className="flex items-center text-xs px-2 py-1 text-blue-700 hover:bg-blue-50 rounded disabled:text-gray-400 disabled:hover:bg-transparent"
                              >
                                <ExternalLink className="h-3 w-3 mr-1" /> View
                              </button>
                              <button
                                type="button"
                                onClick={() => downloadArtifact(artifact)}
                                disabled={!artifact.downloadUrl}
                                title={artifact.downloadUrl ? "Download evidence" : "File unavailable"}
                                className="flex items-center text-xs px-2 py-1 text-blue-700 hover:bg-blue-50 rounded disabled:text-gray-400 disabled:hover:bg-transparent"
                              >
                                <Download className="h-3 w-3 mr-1" /> Download
                              </button>
                              {!artifact.downloadUrl && <span className="text-xs text-gray-400">File unavailable</span>}
                              <button
                                type="button"
                                onClick={() => archiveArtifact(artifact)}
                                disabled={artifact.archived || artifact.status === "archived" || archivingEvidenceId === artifact.id}
                                title={artifact.archived || artifact.status === "archived" ? "Evidence archived" : "Archive evidence"}
                                className="flex items-center text-xs px-2 py-1 text-gray-600 hover:bg-gray-100 rounded disabled:text-gray-400 disabled:hover:bg-transparent"
                              >
                                {archivingEvidenceId === artifact.id
                                  ? <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                  : <Archive className="h-3 w-3 mr-1" />}
                                Archive
                              </button>
                            </div>
                        </div>
                        ))}
                    </div>
                </div>
                )}

                {libraryEvidenceContext && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-sm font-semibold text-gray-700">Attached Library Evidence</h4>
                      {libraryEvidenceContext.canManage && (
                        <button type="button" onClick={() => setIsLibraryPickerOpen(true)} className="flex items-center text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">
                          <Link2 className="h-3 w-3 mr-1" /> Attach Existing Evidence
                        </button>
                      )}
                    </div>
                    {attachedLibraryEvidence.length === 0 ? (
                      <p className="text-xs text-gray-500">No library evidence attached.</p>
                    ) : (
                      <div className="space-y-2 max-h-40 overflow-y-auto p-2 bg-blue-50 rounded-md">
                        {attachedLibraryEvidence.map(reference => {
                          const item = reference.libraryItem;
                          return (
                            <div key={reference.evidenceId} className="flex items-start gap-3 p-2 bg-white border border-blue-100 rounded-md">
                              <FileText className="h-6 w-6 text-blue-400 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-800 break-all">{item?.fileName || reference.evidenceId}</p>
                                <p className="text-xs text-blue-700 font-semibold">Library Evidence</p>
                                <p className="text-xs text-gray-500">{item?.category || "Other"}{item?.tags?.length ? ` | ${item.tags.join(", ")}` : ""}</p>
                                <p className="text-xs text-gray-500">Attached: {typeof reference.attachedAt === "string" ? new Date(reference.attachedAt).toLocaleDateString() : reference.attachedAt?.toDate ? reference.attachedAt.toDate().toLocaleDateString() : "Pending"}</p>
                                {item?.description && <p className="text-xs text-gray-600 mt-1">{item.description}</p>}
                                {item?.status === "archived" && <p className="text-xs font-semibold text-amber-700 mt-1">Archived in Library</p>}
                                <EvidenceValidationPanel
                                  canValidate={libraryEvidenceContext.canManage}
                                  request={{
                                    orgId: libraryEvidenceContext.orgId,
                                    assessmentId: libraryEvidenceContext.assessmentId,
                                    practiceId: practice.id,
                                    objectiveId: objective.id,
                                    evidenceId: reference.evidenceId,
                                    evidenceSource: "evidenceLibrary",
                                    practiceTitle: practice.name,
                                    objectiveTitle: objective.text,
                                    fileName: item?.fileName || reference.evidenceId,
                                    category: item?.category,
                                    description: item?.description,
                                    tags: item?.tags,
                                    ocrSummary: item?.ocrSummary,
                                  }}
                                />
                              </div>
                              <div className="flex items-center gap-1">
                                <button type="button" disabled={!item?.downloadURL} onClick={() => item?.downloadURL && window.open(item.downloadURL, "_blank", "noopener,noreferrer")} title="View library evidence" className="p-1 text-blue-700 disabled:text-gray-300"><ExternalLink className="h-4 w-4" /></button>
                                <button type="button" disabled={!item?.downloadURL} onClick={() => item && downloadLibraryEvidence(item)} title="Download library evidence" className="p-1 text-blue-700 disabled:text-gray-300"><Download className="h-4 w-4" /></button>
                                {libraryEvidenceContext.canManage && (
                                  <button type="button" disabled={detachingLibraryEvidenceId === reference.evidenceId} onClick={() => detachLibraryEvidence(reference)} title="Detach library evidence" className="p-1 text-gray-600 disabled:text-gray-300">
                                    {detachingLibraryEvidenceId === reference.evidenceId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Chat Assist Button */}
                <div className="flex justify-end">
                    <button onClick={() => setIsDeepDiveOpen(!isDeepDiveOpen)} className="flex items-center text-sm px-3 py-1 bg-purple-600 text-white rounded-md hover:bg-purple-700">
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Compliance Chat {isDeepDiveOpen ? <ChevronUp className="h-4 w-4 ml-2"/> : <ChevronDown className="h-4 w-4 ml-2" />}
                    </button>
                </div>
                
                {isDeepDiveOpen && (
                <div className="p-3 bg-white border rounded-lg shadow-sm flex flex-col h-96">
                    <div ref={chatContainerRef} className="flex-1 overflow-y-auto space-y-3 pr-2 text-sm">
                    {deepDiveHistory.length === 0 && <p className="text-center text-gray-500 p-4">Ask a technical question about meeting this L2 objective.</p>}
                    {deepDiveHistory.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`w-4/5 rounded-lg px-3 py-2 ${msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'}`}>
                            <p className="whitespace-pre-wrap">{msg.text}</p>
                        </div>
                        </div>
                    ))}
                    </div>
                    <div className="mt-2 flex items-center border-t pt-2">
                    <input type="text" value={deepDiveInput} onChange={e => setDeepDiveInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendDeepDiveMessage()} placeholder="How do I configure this?" className="flex-1 p-2 text-sm border-gray-300 rounded-l-md focus:ring-1 focus:ring-blue-500 bg-white text-black" disabled={isDeepDiveLoading} />
                    <button onClick={handleSendDeepDiveMessage} disabled={isDeepDiveLoading} className="bg-gray-600 text-white p-2.5 rounded-r-md hover:bg-gray-700 disabled:bg-gray-400">
                        {isDeepDiveLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </button>
                    </div>
                </div>
                )}
            </div>
        </div>
        <SlideshowModal 
            isOpen={isSlideshowModalOpen}
            onClose={() => setIsSlideshowModalOpen(false)}
            images={slideshow || []}
        />
        {libraryEvidenceContext && (
          <EvidenceLibraryPickerModal
            isOpen={isLibraryPickerOpen}
            orgId={libraryEvidenceContext.orgId}
            attachedEvidenceIds={new Set(attachedLibraryEvidence.map(reference => reference.evidenceId))}
            onClose={() => setIsLibraryPickerOpen(false)}
            onAttach={attachLibraryEvidence}
          />
        )}
    </div>
  );
};
