
import React, { useMemo } from 'react';
import { SavedTemplate, Domain } from '../types';
import { jsPDF } from 'jspdf';
import { FileText, Download, Trash2, ArrowRight, Tag } from 'lucide-react';

interface SavedTemplatesProps {
  templates: SavedTemplate[];
  domains: Domain[];
  onDelete: (id: string) => void;
  onNavigateToPractice: (uid: string) => void;
}

export const SavedTemplates: React.FC<SavedTemplatesProps> = ({
  templates,
  domains,
  onDelete,
  onNavigateToPractice,
}) => {
  const practiceIdToUidMap = useMemo(() => {
    const map = new Map<string, string>();
    domains.forEach(d => d.practices.forEach(p => map.set(p.id, p.uid)));
    return map;
  }, [domains]);

  const handleDownload = (template: SavedTemplate) => {
    if (template.type === 'pdf') {
      const doc = new jsPDF();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(16);
      doc.text(template.title.replace(/\s*\(PDF\)$/i, ''), 20, 20);
      doc.setFontSize(11);
      const splitText = doc.splitTextToSize(template.content, 170);
      doc.text(splitText, 20, 30);
      const safeFilename = `${template.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
      doc.save(safeFilename);
    } else {
      const blob = new Blob([template.content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${template.title.replace(/ /g, '_')}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const getObjectiveText = (practiceId: string, objectiveId: string): string => {
    for (const domain of domains) {
        for (const practice of domain.practices) {
            if (practice.id === practiceId) {
                const objective = practice.assessment_objectives.find(o => o.id === objectiveId);
                return objective?.text || objectiveId;
            }
        }
    }
    return objectiveId;
  };

  return (
    <div className="animate-fadeIn">
      {templates.length === 0 ? (
        <div className="text-center bg-white p-10 rounded-xl shadow-md border border-gray-200 max-w-2xl mx-auto">
          <FileText className="mx-auto h-14 w-14 text-gray-400" />
          <h2 className="mt-4 text-2xl font-bold text-gray-800">No Templates Saved Yet</h2>
          <p className="mt-3 text-gray-600">
            Use the "Generate Guidance" button on any assessment objective, or the "Template Assist" tool, to create and save templates.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {templates.map(template => (
            <div key={template.id} className="bg-white p-4 rounded-lg shadow-md border flex flex-col sm:flex-row justify-between sm:items-center">
              <div className="flex-1 mb-3 sm:mb-0">
                <div className="flex items-center space-x-3 mb-2">
                   <h3 className="font-bold text-lg text-gray-800">{template.title}</h3>
                   {template.templateType && (
                      <span className="flex items-center text-xs font-medium bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">
                         <Tag className="h-3 w-3 mr-1"/>
                         {template.templateType}
                      </span>
                   )}
                </div>
                <div className="text-xs text-gray-500 space-y-1">
                   <p><strong>Domain:</strong> {template.domain || 'N/A'}</p>
                   <p><strong>Practice:</strong> {template.practiceId}</p>
                   <p><strong>Objective:</strong> {getObjectiveText(template.practiceId, template.objectiveId)}</p>
                   <p><strong>Created:</strong> {new Date(template.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2 flex-shrink-0">
                <button
                  onClick={() => onNavigateToPractice(practiceIdToUidMap.get(template.practiceId)!)}
                  className="flex items-center px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200 transition-colors"
                  title="Go to Practice"
                >
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDownload(template)}
                  className="flex items-center px-3 py-1.5 bg-blue-100 text-blue-700 text-sm rounded-md hover:bg-blue-200 transition-colors"
                  title={template.type === 'pdf' ? 'Download PDF' : 'Download TXT'}
                >
                  <Download className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onDelete(template.id)}
                  className="flex items-center px-3 py-1.5 bg-red-100 text-red-700 text-sm rounded-md hover:bg-red-200 transition-colors"
                  title="Delete Template"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
