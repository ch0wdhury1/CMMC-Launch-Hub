import React from 'react';
import { X } from 'lucide-react';

interface TranscriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  scriptText: string;
}

export const TranscriptModal: React.FC<TranscriptModalProps> = ({ isOpen, onClose, scriptText }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 animate-fadeIn" onClick={onClose}>
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl h-[80vh] flex flex-col" 
        onClick={e => e.stopPropagation()}
      >
        <header className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-bold text-gray-800">How the Launch Hub Works – Transcript</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
            <X size={24} />
          </button>
        </header>
        
        <div className="flex-1 p-6 overflow-y-auto">
          <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
            {scriptText}
          </p>
        </div>
        
        <footer className="flex justify-end p-4 border-t bg-gray-50">
          <button 
            onClick={onClose} 
            className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700"
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  );
};
