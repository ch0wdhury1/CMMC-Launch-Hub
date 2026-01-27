import React, { useState, useMemo } from 'react';
import { Domain, Practice, AssessmentObjective, SavedTemplate, GeneratedTemplate } from '../types';
import { generateTemplateRecommendations, generateSingleTemplate } from '../services/geminiService';
import { TemplatePreviewModal } from './TemplatePreviewModal';
import { Wand2, Loader2, FileText, ChevronRight } from 'lucide-react';

interface TemplateAssistProps {
  domains: Domain[];
  storeTemplate: (template: SavedTemplate) => void;
}

interface Recommendation {
  templateType: string;
  explanation: string;
}

export const TemplateAssist: React.FC<TemplateAssistProps> = ({ domains, storeTemplate }) => {
  const [selectedDomain, setSelectedDomain] = useState<string>('');
  const [selectedPractice, setSelectedPractice] = useState<string>('');
  const [selectedObjective, setSelectedObjective] = useState<string>('');
  
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoadingRecs, setIsLoadingRecs] = useState(false);
  const [generatedTemplates, setGeneratedTemplates] = useState<GeneratedTemplate[]>([]);
  const [isLoadingGen, setIsLoadingGen] = useState<string | null>(null); // 'all' or templateType

  const [modalOpen, setModalOpen] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState<GeneratedTemplate | null>(null);

  const practices = useMemo(() => {
    if (!selectedDomain) return [];
    return domains.find(d => d.name === selectedDomain)?.practices || [];
  }, [selectedDomain, domains]);

  const objectives = useMemo(() => {
    if (!selectedPractice) return [];
    return practices.find(p => p.id === selectedPractice)?.assessment_objectives || [];
  }, [selectedPractice, practices]);

  const handleObjectiveChange = async (objectiveId: string) => {
    setSelectedObjective(objectiveId);
    setRecommendations([]);
    setGeneratedTemplates([]);
    if (!objectiveId) return;

    setIsLoadingRecs(true);
    try {
      const objective = objectives.find(o => o.id === objectiveId);
      if (objective) {
        const recs = await generateTemplateRecommendations(objective);
        setRecommendations(recs);
      }
    } catch (error) {
      console.error("Failed to get recommendations:", error);
      alert("Could not fetch AI recommendations. Please try again.");
    } finally {
      setIsLoadingRecs(false);
    }
  };
  
  const handleGenerate = async (templateType: 'all' | string) => {
    setIsLoadingGen(templateType);
    const objective = objectives.find(o => o.id === selectedObjective);
    const practice = practices.find(p => p.id === selectedPractice);
    if (!objective || !practice) return;

    const typesToGenerate = templateType === 'all' 
      ? recommendations.map(r => r.templateType)
      : [templateType];

    try {
      const promises = typesToGenerate.map(type => 
        generateSingleTemplate({
          domain: selectedDomain,
          practice,
          objective,
          templateType: type,
        })
      );
      const results = await Promise.all(promises);
      
      if (templateType !== 'all' && results.length > 0) {
        setCurrentTemplate(results[0]);
        setModalOpen(true);
      } else {
        alert(`${results.length} templates have been generated and are ready for individual review.`);
      }
      
      // Add new templates, avoiding duplicates
      setGeneratedTemplates(prev => {
          const existingIds = new Set(prev.map(t => t.id));
          const newTemplates = results.filter(t => !existingIds.has(t.id));
          return [...prev, ...newTemplates];
      });

    } catch (error) {
      console.error("Failed to generate template(s):", error);
      alert("An error occurred while generating the document(s). Please check the console and try again.");
    } finally {
      setIsLoadingGen(null);
    }
  };

  const handleSaveTemplate = (template: GeneratedTemplate) => {
    storeTemplate({
        id: template.id,
        practiceId: template.practiceId,
        objectiveId: template.objectiveId,
        title: template.title,
        content: template.content,
        createdAt: template.createdAt,
        templateType: template.templateType,
        domain: template.domain,
    });
    alert(`Template "${template.title}" has been saved to your collection.`);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Step 1: Selection Flow */}
      <div className="bg-white p-6 rounded-lg shadow-md border">
        <h2 className="text-xl font-bold mb-4">Guided Selection Flow</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Step 1 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Step 1: Select Domain</label>
            <select onChange={e => { setSelectedDomain(e.target.value); setSelectedPractice(''); setSelectedObjective(''); setRecommendations([]); setGeneratedTemplates([]); }} className="w-full border p-2 rounded bg-white text-black">
              <option value="">-- Choose a Domain --</option>
              {domains.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
            </select>
          </div>
          {/* Step 2 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Step 2: Select Practice</label>
            <select onChange={e => { setSelectedPractice(e.target.value); setSelectedObjective(''); setRecommendations([]); setGeneratedTemplates([]); }} disabled={!selectedDomain} className="w-full border p-2 rounded bg-white text-black disabled:bg-gray-100">
              <option value="">-- Choose a Practice --</option>
              {practices.map(p => <option key={p.id} value={p.id}>{p.id}</option>)}
            </select>
          </div>
          {/* Step 3 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Step 3: Select Objective</label>
            <select onChange={e => handleObjectiveChange(e.target.value)} disabled={!selectedPractice} className="w-full border p-2 rounded bg-white text-black disabled:bg-gray-100">
              <option value="">-- Choose an Objective --</option>
              {objectives.map(o => <option key={o.id} value={o.id}>{o.text}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Step 2: Recommendations */}
      {selectedObjective && (
        <div className="bg-white p-6 rounded-lg shadow-md border">
          <h2 className="text-xl font-bold mb-4">Template Recommendations</h2>
          {isLoadingRecs && (
            <div className="flex items-center justify-center text-gray-500"><Loader2 className="h-5 w-5 mr-2 animate-spin"/>Loading recommendations...</div>
          )}
          {!isLoadingRecs && recommendations.length > 0 && (
             <div className="mb-4">
                 <button onClick={() => handleGenerate('all')} disabled={!!isLoadingGen} className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md shadow hover:bg-indigo-700 disabled:bg-indigo-400">
                     {isLoadingGen === 'all' ? <Loader2 className="h-5 w-5 mr-2 animate-spin"/> : <Wand2 className="h-5 w-5 mr-2"/>}
                     {isLoadingGen === 'all' ? 'Generating...' : 'Generate All Templates'}
                 </button>
             </div>
          )}
          <div className="space-y-4">
            {recommendations.map(rec => {
                const isGenerated = generatedTemplates.some(t => t.templateType === rec.templateType);
                return (
                  <div key={rec.templateType} className="p-4 bg-gray-50 rounded-lg border">
                    <h3 className="font-semibold text-gray-800">{rec.templateType}</h3>
                    <p className="text-sm text-gray-600 my-2"><strong>Why this template is needed:</strong> {rec.explanation}</p>
                    <button 
                        onClick={() => {
                            if (isGenerated) {
                                const template = generatedTemplates.find(t => t.templateType === rec.templateType);
                                setCurrentTemplate(template || null);
                                setModalOpen(true);
                            } else {
                                handleGenerate(rec.templateType);
                            }
                        }}
                        disabled={!!isLoadingGen}
                        className={`flex items-center px-3 py-1.5 text-sm rounded-md shadow-sm ${
                            isGenerated 
                            ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                            : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                        } disabled:opacity-50`}
                    >
                       {isLoadingGen === rec.templateType ? <Loader2 className="h-4 w-4 mr-2 animate-spin"/> : isGenerated ? <FileText className="h-4 w-4 mr-2"/> : <Wand2 className="h-4 w-4 mr-2"/>}
                       {isLoadingGen === rec.templateType ? 'Generating...' : isGenerated ? 'View Generated Template' : 'Generate Template'}
                    </button>
                  </div>
                );
            })}
          </div>
        </div>
      )}
      
      {currentTemplate && (
        <TemplatePreviewModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          template={currentTemplate}
          onSave={handleSaveTemplate}
        />
      )}
    </div>
  );
};