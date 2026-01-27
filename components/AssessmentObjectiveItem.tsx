
import React, { useState, useRef, useEffect } from 'react';
import { AssessmentObjective, Artifact, ObjectiveStatus, Practice, SavedTemplate, ObjectiveRecord } from '../types';
import { 
  getOcrSummary, 
  generateObjectiveActionPoints, 
  generateInstructionAudio,
  startObjectiveChat
} from '../services/geminiService';
import { GenerateContentResponse } from '@google/genai';
import { jsPDF } from 'jspdf';
import { decode, decodeAudioData } from '../services/audioUtils';
import { Paperclip, FileText, Trash2, Loader2, Bot, Volume2, Download, MessageSquare, Send, ChevronDown, ChevronUp, Save, Film, Clapperboard, X, ChevronLeft, ChevronRight, Sparkles, ClipboardCopy, CheckCircle2, XCircle, HelpCircle } from 'lucide-react';

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
  onUpdateObjective: (objectiveId: string, updates: Partial<ObjectiveRecord>) => void;
  storeTemplate: (template: SavedTemplate) => void;
  slideshow?: string[];
  isSlideshowLoading: boolean;
  onGenerateSlideshow: (objectiveId: string, actionPointsText: string) => void;
}

type Template = NonNullable<AssessmentObjective['templates']>[0];

export const AssessmentObjectiveItem: React.FC<AssessmentObjectiveItemProps> = ({
  objective,
  practice,
  onUpdateObjective,
  storeTemplate,
  slideshow,
  isSlideshowLoading,
  onGenerateSlideshow,
}) => {
  // UI State
  const [isUploading, setIsUploading] = useState(false);
  const [isActionPointsLoading, setIsActionPointsLoading] = useState(false);
  const [isSummaryAudioLoading, setIsSummaryAudioLoading] = useState(false);
  const [isDeepDiveOpen, setIsDeepDiveOpen] = useState(false);
  const [isSlideshowModalOpen, setIsSlideshowModalOpen] = useState(false);
  
  // Deep Dive Chat State
  const [deepDiveHistory, setDeepDiveHistory] = useState<ChatMessage[]>([]);
  const [deepDiveInput, setDeepDiveInput] = useState('');
  const [isDeepDiveLoading, setIsDeepDiveLoading] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const handleGetActionPoints = async () => {
    setIsActionPointsLoading(true);
    try {
      const result = await generateObjectiveActionPoints(practice, objective);
      
      const newTemplates = result.templates.map((t: any) => ({
        id: crypto.randomUUID(), name: t.name, filename: t.filename, content: t.content, createdAt: new Date().toISOString()
      }));

      onUpdateObjective(objective.id, {
        actionPoints: result.actionPoints,
        actionPointsSummary: result.summary,
        templates: newTemplates,
      });

      newTemplates.forEach((t: any) => {
        storeTemplate({
          id: t.id, practiceId: practice.id, objectiveId: objective.id,
          title: t.name, content: t.content, createdAt: t.createdAt,
        });
      });

    } catch (error: any) {
      console.error("Action Points failed:", error);
      alert("Could not get AI guidance.");
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
      const summaryText = await getOcrSummary(file);
      const newArtifact: Artifact = {
        id: `${Date.now()}-${file.name}`, 
        name: file.name, 
        fileType: file.type,
        ocrSummary: summaryText || "No OCR summary available.", 
        uploadedAt: new Date().toISOString(),
        isFinalForm: true
      };
      onUpdateObjective(objective.id, { artifacts: [...objective.artifacts, newArtifact] });
    } catch (error) { console.error("OCR failed:", error); alert("Could not process file."); } 
    finally { setIsUploading(false); e.target.value = ""; }
  };

  const removeArtifact = (artifactId: string) => {
    const updated = objective.artifacts.filter((a) => a.id !== artifactId);
    onUpdateObjective(objective.id, { artifacts: updated });
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

  const handleSendDeepDiveMessage = async () => {
    if (!deepDiveInput.trim() || isDeepDiveLoading) return;
    const newUserMessage: ChatMessage = { role: 'user', text: deepDiveInput };
    const updatedHistory = [...deepDiveHistory, newUserMessage];
    setDeepDiveHistory(updatedHistory);
    setDeepDiveInput('');
    setIsDeepDiveLoading(true);
    let modelResponse = '';
    setDeepDiveHistory(prev => [...prev, { role: 'model', text: '' }]);

    try {
      const stream = await startObjectiveChat(objective, updatedHistory, deepDiveInput);
      for await (const chunk of stream) {
        modelResponse += (chunk as GenerateContentResponse).text;
        setDeepDiveHistory(prev => prev.map((msg, i) => i === prev.length - 1 ? { ...msg, text: modelResponse } : msg));
      }
    } catch (error) {
      console.error('Chat error:', error);
      setDeepDiveHistory(prev => prev.map((msg, i) => i === prev.length - 1 ? { ...msg, text: 'Sorry, something went wrong.' } : msg));
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
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Verified Artifacts (Evidence)</h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto p-2 bg-gray-100 rounded-md">
                        {objective.artifacts.map((artifact) => (
                        <div key={artifact.id} className="flex items-start p-2 bg-white border border-gray-200 rounded-md">
                            <FileText className="h-8 w-8 text-gray-400 flex-shrink-0 mr-3" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-800 break-all">{artifact.name}</p>
                                <p className="text-xs text-gray-500 mt-1 italic">"{artifact.ocrSummary}"</p>
                            </div>
                            <button onClick={() => removeArtifact(artifact.id)} className="text-gray-400 hover:text-red-600 ml-2"><Trash2 className="h-4 w-4" /></button>
                        </div>
                        ))}
                    </div>
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
    </div>
  );
};
