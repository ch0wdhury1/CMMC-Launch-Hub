
import React from 'react';
import { Practice, PracticeStatus } from '../types';
import { ProgressBar } from './ProgressBar';

interface PracticeCardProps {
  practice: Practice;
  status: PracticeStatus;
  onClick: () => void;
}

export const PracticeCard: React.FC<PracticeCardProps> = ({
  practice,
  status,
  onClick,
}) => {
  const getStatusInfo = (s: PracticeStatus) => {
    switch (s) {
      case 'met':
        return { text: 'MET', color: 'bg-green-100 text-green-800', progress: 100 };
      case 'partial':
        return { text: 'PARTIAL', color: 'bg-yellow-100 text-yellow-800', progress: 50 };
      case 'not_met':
        return { text: 'NOT MET', color: 'bg-red-100 text-red-800', progress: 0 };
      case 'not_assessed':
      default:
        return { text: 'NOT ASSESSED', color: 'bg-gray-100 text-gray-800', progress: 0 };
    }
  };

  const statusInfo = getStatusInfo(status);

  // Extract practice title safely
  const splitTitle = practice.name.includes('–')
    ? practice.name.split('–')[1]?.trim()
    : practice.name.includes('-')
      ? practice.name.split('-').slice(1).join('-').trim()
      : practice.name;

  return (
    <button
      onClick={onClick}
      className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow text-left p-4 flex flex-col justify-between h-full border border-gray-200"
    >
      {/* HEADER */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <p className="font-bold text-gray-800">{practice.id}</p>
          <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${statusInfo.color}`}>
            {statusInfo.text}
          </span>
        </div>
        <p className="text-sm text-gray-700 line-clamp-2">
          {splitTitle}
        </p>
      </div>

      {/* PROGRESS AREA */}
      <div className="mt-4">
        <ProgressBar percent={statusInfo.progress} />
        <p className="text-xs text-center text-gray-500 mt-1">
          Status: {statusInfo.text}
        </p>
      </div>
    </button>
  );
};