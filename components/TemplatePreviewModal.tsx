import React from 'react';
import { GeneratedTemplate } from '../types';
import { jsPDF } from 'jspdf';
import { X, Save, Download, ClipboardCopy, FileType } from 'lucide-react';

interface TemplatePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: GeneratedTemplate;
  onSave: (template: GeneratedTemplate) => void;
}

export const TemplatePreviewModal: React.FC<TemplatePreviewModalProps> = ({ isOpen, onClose, template, onSave }) => {
  if (!isOpen) return null;

  const handleDownloadPdf = () => {
    const doc = new jsPDF({
      orientation: 'p',
      unit: 'pt',
      format: 'a4'
    });
    
    const element = document.getElementById('pdf-content');
    if (element) {
        doc.html(element, {
            callback: function (doc) {
              doc.save(`${template.filename.replace(/\.txt$/, '.pdf')}`);
            },
            x: 10,
            y: 10,
            width: 575, // A4 width in points is 595, leaving some margin
            windowWidth: 1000 // simulate a wider window for better layout
        });
    }
  };
  
  const handleCopyText = () => {
    navigator.clipboard.writeText(template.content)
      .then(() => alert('Template content copied to clipboard!'))
      .catch(err => {
          console.error('Failed to copy text: ', err);
          alert('Could not copy text.');
      });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 animate-fadeIn" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <header className="flex justify-between items-center p-4 border-b bg-gray-50 rounded-t-lg">
          <h2 className="text-xl font-bold text-gray-800">{template.title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><X size={24} /></button>
        </header>
        
        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto bg-gray-100">
            <div id="pdf-container" className="bg-white p-8 shadow-lg max-w-3xl mx-auto">
                <div id="pdf-content">
                    {/* This is the content that will be rendered to PDF */}
                    <style>
                        {`
                        #pdf-content h1 { font-size: 18pt; font-weight: bold; color: #1a202c; margin-bottom: 8pt; }
                        #pdf-content .meta { font-size: 9pt; color: #718096; margin-bottom: 12pt; border-bottom: 1px solid #e2e8f0; padding-bottom: 8pt; }
                        #pdf-content .content { font-size: 10pt; line-height: 1.6; color: #2d3748; white-space: pre-wrap; }
                        #pdf-content h2 { font-size: 14pt; font-weight: bold; margin-top: 12pt; margin-bottom: 6pt; border-bottom: 1px solid #e2e8f0; padding-bottom: 4pt;}
                        #pdf-content strong { font-weight: bold; }
                        #pdf-content ul { list-style-type: disc; padding-left: 20pt; }
                        #pdf-content footer { font-size: 8pt; color: #a0aec0; text-align: center; margin-top: 30pt; padding-top: 10pt; border-top: 1px solid #e2e8f0;}
                        `}
                    </style>
                    <h1>{template.title}</h1>
                    <p className="meta">Domain: {template.domain} | Practice: {template.practiceId} | Version: {template.version}</p>
                    <div className="content" dangerouslySetInnerHTML={{ __html: template.content.replace(/\n/g, '<br />') }}></div>
                    <footer>CMMC Launch Hub — Generated on {new Date(template.createdAt).toLocaleDateString()}</footer>
                </div>
            </div>
        </div>
        
        {/* Footer */}
        <footer className="flex justify-end items-center p-4 border-t bg-gray-50 rounded-b-lg space-x-2">
           <button onClick={() => onSave(template)} className="flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">
             <Save className="h-4 w-4 mr-2"/> Save This Template
           </button>
           <button onClick={handleDownloadPdf} className="flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700">
             <Download className="h-4 w-4 mr-2"/> Download PDF
           </button>
           <button disabled className="flex items-center px-4 py-2 bg-gray-300 text-gray-500 text-sm font-medium rounded-md cursor-not-allowed">
             <FileType className="h-4 w-4 mr-2"/> Download DOCX
           </button>
           <button onClick={handleCopyText} className="flex items-center px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700">
             <ClipboardCopy className="h-4 w-4 mr-2"/> Copy Text
           </button>
        </footer>
      </div>
    </div>
  );
};
