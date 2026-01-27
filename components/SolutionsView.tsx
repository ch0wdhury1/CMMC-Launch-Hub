import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import { CollapsibleSection } from './CollapsibleSection';
import { SolutionCard } from './SolutionCard';
import { SolutionDetailModal } from './SolutionDetailModal';
import { TemplatePreviewModal } from './TemplatePreviewModal';
import { getSolutionDetails, generatePolicyTemplate } from '../services/geminiService';
import { CLOUD_SOLUTIONS, POLICIES_PROCEDURES, ESSENTIAL_TOOLS } from '../data/solutionsData';
import { GeneratedTemplate, SavedTemplate } from '../types';

interface SolutionsViewProps {
  storeTemplate: (template: SavedTemplate) => void;
}

export const SolutionsView: React.FC<SolutionsViewProps> = ({ storeTemplate }) => {
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const [detailModal, setDetailModal] = useState({ isOpen: false, title: '', content: '' });
  const [previewModal, setPreviewModal] = useState<{ isOpen: false } | { isOpen: true, template: GeneratedTemplate }>({ isOpen: false });

  const handleButtonClick = async (label: string, title: string) => {
    const loadingKey = `${label}-${title}`;
    setLoadingStates(prev => ({ ...prev, [loadingKey]: true }));

    try {
      switch (label) {
        case 'View Details':
        case 'Recommended Options': {
          const details = await getSolutionDetails(title);
          setDetailModal({ isOpen: true, title, content: details });
          break;
        }
        case 'View Template': {
          const result = await generatePolicyTemplate(title);
          const template: GeneratedTemplate = {
            ...result,
            id: crypto.randomUUID(),
            domain: 'General',
            practiceId: 'N/A',
            objectiveId: 'N/A',
            templateType: title.includes('Policy') ? 'Policy' : 'Procedure',
            version: '1.0',
            createdAt: new Date().toISOString()
          };
          setPreviewModal({ isOpen: true, template });
          break;
        }
        case 'Download PDF': {
          const result = await generatePolicyTemplate(title);
          const doc = new jsPDF();
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(16);
          doc.text(result.title, 20, 20);
          doc.setFontSize(11);
          const splitText = doc.splitTextToSize(result.content, 170);
          doc.text(splitText, 20, 30);
          const safeFilename = `${result.filename.replace(/\.txt$/, '')}.pdf`;
          doc.save(safeFilename);
          break;
        }
      }
    } catch (error) {
      console.error(`Action "${label}" for "${title}" failed:`, error);
      alert(`An error occurred while generating content. Please try again.`);
    } finally {
      setLoadingStates(prev => ({ ...prev, [loadingKey]: false }));
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
    alert(`Template "${template.title}" saved to your collection.`);
    setPreviewModal({ isOpen: false });
  };

  return (
    <>
      <div className="space-y-8 animate-fadeIn">
        {/* Introduction */}
        <div className="bg-white p-6 rounded-lg shadow-md border">
          <h1 className="text-2xl font-bold text-gray-800">CMMC Starter Kit</h1>
          <p className="mt-2 text-gray-600">
            This section provides a curated list of tools, templates, and solutions to help you meet CMMC Level 1 requirements. These are common examples and not official endorsements.
          </p>
        </div>

        {/* Section 1: High-Impact Cloud Solutions */}
        <CollapsibleSection title="High-Impact Cloud Solutions">
          <div className="p-4 bg-gray-50 border-t rounded-b-lg">
            <p className="mb-6 text-sm text-gray-600">
              These all-in-one cloud suites instantly help businesses satisfy multiple CMMC Level 1 practices such as Access Control, Authentication, Malware Protection, and Monitoring.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {CLOUD_SOLUTIONS.map(item => (
                <SolutionCard key={item.title} {...item} onButtonClick={handleButtonClick} loadingStates={loadingStates} />
              ))}
            </div>
          </div>
        </CollapsibleSection>

        {/* Section 2: Policies & Procedures */}
        <CollapsibleSection title="Policies & Procedures">
          <div className="p-4 bg-gray-50 border-t rounded-b-lg">
            <p className="mb-6 text-sm text-gray-600">
              Many CMMC Level 1 practices can be addressed with strong written policies and simple internal procedures.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {POLICIES_PROCEDURES.map(item => (
                <SolutionCard key={item.title} {...item} onButtonClick={handleButtonClick} loadingStates={loadingStates} />
              ))}
            </div>
          </div>
        </CollapsibleSection>

        {/* Section 3: Essential Security Tools */}
        <CollapsibleSection title="Essential Security Tools">
          <div className="p-4 bg-gray-50 border-t rounded-b-lg">
            <p className="mb-6 text-sm text-gray-600">
              Affordable and simple tools that immediately strengthen your basic cybersecurity posture.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {ESSENTIAL_TOOLS.map(item => (
                <SolutionCard key={item.title} {...item} onButtonClick={handleButtonClick} loadingStates={loadingStates} />
              ))}
            </div>
          </div>
        </CollapsibleSection>
      </div>

      <SolutionDetailModal
        isOpen={detailModal.isOpen}
        onClose={() => setDetailModal({ isOpen: false, title: '', content: '' })}
        title={detailModal.title}
        content={detailModal.content}
        isLoading={loadingStates[`View Details-${detailModal.title}`] || loadingStates[`Recommended Options-${detailModal.title}`]}
      />

      {previewModal.isOpen && (
        <TemplatePreviewModal
          isOpen={previewModal.isOpen}
          onClose={() => setPreviewModal({ isOpen: false })}
          template={previewModal.template}
          onSave={handleSaveTemplate}
        />
      )}
    </>
  );
};