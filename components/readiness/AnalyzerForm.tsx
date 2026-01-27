import React from 'react';
import { ReadinessAnswers } from '../../types';
import { READINESS_QUESTIONS } from '../../data/readinessQuestions';
import { CollapsibleSection } from '../CollapsibleSection';
import { Bot } from 'lucide-react';

interface AnalyzerFormProps {
  answers: ReadinessAnswers;
  onUpdate: (id: string, value: any) => void;
  onSubmit: () => void;
}

export const AnalyzerForm: React.FC<AnalyzerFormProps> = ({ answers, onUpdate, onSubmit }) => {

  const renderQuestion = (q: any) => {
    switch (q.type) {
      case 'numeric':
        return (
          <input
            type="number"
            value={answers[q.id] as number || ''}
            onChange={(e) => onUpdate(q.id, e.target.value === '' ? '' : parseInt(e.target.value, 10))}
            className="w-full md:w-1/2 border p-2 rounded bg-white text-black"
          />
        );
      case 'yes_no':
        return (
          <select value={answers[q.id] as string || ''} onChange={(e) => onUpdate(q.id, e.target.value)} className="w-full md:w-1/2 border p-2 rounded bg-white text-black">
            <option value="">-- Select --</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        );
      case 'yes_no_partial':
      case 'yes_no_some':
        const options = q.type === 'yes_no_partial' 
            ? [{v:'yes', l:'Yes'}, {v:'no', l:'No'}, {v:'partial', l:'Partially'}]
            : [{v:'yes', l:'Yes (All)'}, {v:'no', l:'No'}, {v:'some', l:'Some (Not all)'}];
        return (
          <select value={answers[q.id] as string || ''} onChange={(e) => onUpdate(q.id, e.target.value)} className="w-full md:w-1/2 border p-2 rounded bg-white text-black">
            <option value="">-- Select --</option>
            {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        );
      case 'it_support':
        return (
          <select value={answers[q.id] as string || ''} onChange={(e) => onUpdate(q.id, e.target.value)} className="w-full md:w-1/2 border p-2 rounded bg-white text-black">
            <option value="">-- Select --</option>
            <option value="internal">Internal / In-House</option>
            <option value="msp">Managed Service Provider (MSP)</option>
            <option value="none">None / Ad-hoc</option>
          </select>
        );
       case 'cloud_platform':
        return (
          <select value={answers[q.id] as string || ''} onChange={(e) => onUpdate(q.id, e.target.value)} className="w-full md:w-1/2 border p-2 rounded bg-white text-black">
            <option value="">-- Select --</option>
            <option value="m365">Microsoft 365</option>
            <option value="gworkspace">Google Workspace</option>
            <option value="other">Other</option>
            <option value="none">None / On-premise</option>
          </select>
        );
      case 'checkbox':
        const currentSelection = (answers[q.id] as string[] || []);
        const handleCheckboxChange = (option: string) => {
          const newSelection = currentSelection.includes(option)
            ? currentSelection.filter(item => item !== option)
            : [...currentSelection, option];
          onUpdate(q.id, newSelection);
        };
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {q.options?.map((opt: string) => (
              <label key={opt} className="flex items-center space-x-2 p-2 bg-gray-100 rounded-md">
                <input
                  type="checkbox"
                  checked={currentSelection.includes(opt)}
                  onChange={() => handleCheckboxChange(opt)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">{opt}</span>
              </label>
            ))}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-md border">
      <h1 className="text-2xl font-bold text-gray-800">Current Security Posture Questionnaire</h1>
        <p className="mt-2 text-gray-600">
          Answer the following questions about your current cybersecurity posture. The AI will analyze your responses and generate a detailed CMMC Level 1 readiness report with actionable recommendations.
        </p>
      </div>

      {READINESS_QUESTIONS.map(section => (
        <CollapsibleSection key={section.id} title={section.title}>
          <div className="space-y-4 p-4 bg-gray-50 border-t">
            <p className="text-sm text-gray-500 mb-4">{section.description}</p>
            {section.questions.map(q => (
              <div key={q.id} className="py-3 border-b last:border-b-0">
                <label className="block text-sm font-medium text-gray-700 mb-2">{q.label}</label>
                {renderQuestion(q)}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      ))}

      <div className="mt-8 text-center">
        <button 
          onClick={onSubmit}
          className="flex items-center justify-center mx-auto px-6 py-3 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition-colors font-semibold"
        >
          <Bot className="h-5 w-5 mr-2" />
          Generate Report
        </button>
      </div>
    </div>
  );
};