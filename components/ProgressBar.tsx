
import React from 'react';

interface ProgressBarProps {
  percent: number; // updated API
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ percent }) => {
  // Prevent NaN or out-of-range values
  const value = Math.max(0, Math.min(100, Math.round(percent)));

  const getColor = (p: number) => {
    if (p < 33) return 'bg-red-500';
    if (p < 66) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const barColor = getColor(value);

  return (
    <div className="w-full">
      <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-2.5 ${barColor} rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
};