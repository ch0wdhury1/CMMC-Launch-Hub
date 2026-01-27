import React from 'react';
import { X, Loader2 } from 'lucide-react';

interface SolutionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string;
  isLoading: boolean;
}

export const SolutionDetailModal: React.FC<SolutionDetailModalProps> = ({ isOpen, onClose, title, content, isLoading }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 animate-fadeIn" onClick={onClose}>
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl h-[80vh] flex flex-col" 
        onClick={e => e.stopPropagation()}
      >
        <header className="flex justify-between items-center p-4 border-b bg-gray-50 rounded-t-lg">
          <h2 className="text-xl font-bold text-gray-800">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
            <X size={24} />
          </button>
        </header>
        
        <div className="flex-1 p-6 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <Loader2 className="h-8 w-8 animate-spin mr-3" />
              <span className="text-lg">Generating details...</span>
            </div>
          ) : (
            <div className="rich-text-content" dangerouslySetInnerHTML={{ __html: content }}></div>
          )}
        </div>
        
        <footer className="flex justify-end p-4 border-t bg-gray-50 rounded-b-lg">
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