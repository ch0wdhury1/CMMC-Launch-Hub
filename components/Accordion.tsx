
import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface AccordionProps {
  label: string;
  content: string;
  isOpen: boolean;
  onToggle: () => void;
}

export const Accordion: React.FC<AccordionProps> = ({ label, content, isOpen, onToggle }) => {
  return (
    <div className="border rounded-lg mb-2 bg-white shadow-sm transition-all duration-300">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-left font-medium text-gray-800 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg"
        aria-expanded={isOpen}
      >
        <span className="flex-1 text-base">{label}</span>
        {isOpen ? <ChevronDown className="h-5 w-5 flex-shrink-0 text-blue-600" /> : <ChevronRight className="h-5 w-5 flex-shrink-0 text-gray-500" />}
      </button>

      {isOpen && (
        <div className="p-4 text-gray-700 border-t bg-gray-50 animate-fadeIn rounded-b-lg">
          <p className="whitespace-pre-wrap leading-relaxed">{content}</p>
        </div>
      )}
    </div>
  );
};
