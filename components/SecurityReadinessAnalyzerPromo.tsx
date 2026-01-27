import React from 'react';
import { ClipboardCheck, Archive } from 'lucide-react';

interface SecurityReadinessAnalyzerPromoProps {
  onStartAnalyzer: () => void;
  onViewReports: () => void;
}

export const SecurityReadinessAnalyzerPromo: React.FC<SecurityReadinessAnalyzerPromoProps> = ({ onStartAnalyzer, onViewReports }) => {
  return (
    <div className="animate-fadeIn bg-white p-6 rounded-xl shadow-md border border-gray-200">
      <h3 className="flex items-center text-xl font-bold text-gray-800 mb-4">
        <ClipboardCheck className="h-6 w-6 mr-3 text-purple-600" />
        Security Readiness Analyzer
      </h3>
      <p className="text-gray-600 mb-6">
        Answer a questionnaire about your security posture. App will generate a detailed CMMC Level 1 readiness report with a score and actionable recommendations.
      </p>
      <div className="flex items-center space-x-4">
        <button
          onClick={onStartAnalyzer}
          className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg shadow-sm hover:bg-purple-700 transition-colors font-semibold"
        >
          <ClipboardCheck className="h-5 w-5 mr-2" />
          Start Analyzer
        </button>
        <button
          onClick={onViewReports}
          className="flex items-center px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg shadow-sm hover:bg-gray-100 transition-colors font-semibold"
        >
          <Archive className="h-5 w-5 mr-2" />
          View Saved Reports
        </button>
      </div>
    </div>
  );
};
