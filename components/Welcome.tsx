
import React from 'react';
import { ArrowRight, RefreshCcw } from 'lucide-react';

interface WelcomeProps {
  overallCompletion: number;
  onPrimaryAction: () => void;
}

export const Welcome: React.FC<WelcomeProps> = ({ overallCompletion, onPrimaryAction }) => {
  const isNewUser = overallCompletion === 0;

  const buttonText = isNewUser ? "Start Assessment" : "Resume Where You Left Off";
  const ButtonIcon = isNewUser ? ArrowRight : RefreshCcw;

  return (
    <div className="animate-fadeIn text-center bg-white p-10 rounded-xl shadow-md border border-gray-200">
      
      <h2 className="text-3xl font-bold text-gray-800">
        {isNewUser ? "Welcome to the CMMC Launch Hub" : "Welcome Back!"}
      </h2>

      <p className="mt-3 text-lg text-gray-600 max-w-2xl mx-auto">
        {isNewUser
          ? "Track your progress, upload evidence, and use the AI assistant."
          : `You've completed ${overallCompletion}% of your assessment.`}
      </p>

      {/* Primary Call to Action Button */}
      <div className="mt-8">
        <button
          onClick={onPrimaryAction}
          className="flex items-center mx-auto px-6 py-3 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition-all font-semibold"
        >
          <ButtonIcon className="h-5 w-5 mr-2" />
          {buttonText}
        </button>
      </div>

    </div>
  );
};