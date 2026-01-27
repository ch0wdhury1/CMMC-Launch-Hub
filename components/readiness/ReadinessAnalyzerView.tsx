import React from 'react';
import { useReadinessData } from '../../hooks/useReadinessData';
import { generateReadinessReport } from '../../services/geminiService';
import { AnalyzerForm } from './AnalyzerForm';
import { AnalyzerReport } from './AnalyzerReport';
import { Loader2 } from 'lucide-react';
import { CompanyProfile } from '../../types';

interface ReadinessAnalyzerViewProps {
  companyProfile: CompanyProfile | null;
}

export const ReadinessAnalyzerView: React.FC<ReadinessAnalyzerViewProps> = ({ companyProfile }) => {
  const {
    answers,
    updateAnswer,
    report,
    setReport,
    isLoading,
    setIsLoading,
    clearAnswers,
  } = useReadinessData();

  const handleGenerateReport = async () => {
    setIsLoading(true);
    try {
      const generatedReport = await generateReadinessReport(answers);
      setReport(generatedReport);
    } catch (error) {
      console.error("Failed to generate readiness report:", error);
      alert("An error occurred while generating the report. Please check the console and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center text-center h-96 bg-white rounded-lg shadow-md">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600 mb-4" />
        <h2 className="text-2xl font-bold text-gray-800">Analyzing Your Readiness...</h2>
        <p className="text-gray-600 mt-2">The AI is evaluating your responses to generate a comprehensive report. This may take a moment.</p>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn space-y-8">
      {report ? (
        <AnalyzerReport
          report={report}
          companyProfile={companyProfile}
          onStartOver={() => {
            setReport(null);
            clearAnswers();
          }}
        />
      ) : (
        <AnalyzerForm
          answers={answers}
          onUpdate={updateAnswer}
          onSubmit={handleGenerateReport}
        />
      )}
    </div>
  );
};