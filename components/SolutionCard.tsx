import React from 'react';
import { Loader2, Tag } from 'lucide-react';

interface Button {
  label: string;
  action?: () => void;
  variant: 'primary' | 'secondary';
}

interface SolutionCardProps {
  title: string;
  description?: string;
  practices: string[];
  buttons: Button[];
  onButtonClick: (label: string, title: string) => void;
  loadingStates: Record<string, boolean>;
}

export const SolutionCard: React.FC<SolutionCardProps> = ({ title, description, practices, buttons, onButtonClick, loadingStates }) => {
  const buttonStyle = (variant: 'primary' | 'secondary') => {
    if (variant === 'primary') {
      return 'bg-blue-600 text-white hover:bg-blue-700';
    }
    return 'bg-gray-200 text-gray-800 hover:bg-gray-300';
  };

  return (
    <div className="bg-white rounded-lg shadow-md border flex flex-col h-full">
      <div className="p-4 flex-grow">
        <h3 className="font-bold text-gray-800 text-lg">{title}</h3>
        {description && <p className="text-sm text-gray-600 mt-2">{description}</p>}
        
        <div className="mt-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase flex items-center mb-2">
            <Tag className="h-4 w-4 mr-2" />
            Practices Supported
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {practices.map(p => (
              <span key={p} className="text-xs font-medium bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>
      
      <div className="p-4 bg-gray-50 border-t rounded-b-lg flex items-center justify-end space-x-2">
        {buttons.map(btn => {
          const isLoading = loadingStates[`${btn.label}-${title}`] || false;
          return (
            <button
              key={btn.label}
              onClick={() => onButtonClick(btn.label, title)}
              disabled={isLoading}
              className={`flex items-center justify-center min-w-[120px] px-3 py-1.5 text-sm font-semibold rounded-md shadow-sm transition-colors ${buttonStyle(btn.variant)} disabled:opacity-70 disabled:cursor-wait`}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : btn.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};