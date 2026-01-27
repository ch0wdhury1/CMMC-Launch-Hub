import React from "react";
import { Save, Archive, User, Activity, LogOut, Shield } from "lucide-react";

interface AppHeaderProps {
  onSave: () => void;
  onSavedTemplatesClick: () => void;
  onProfileClick: () => void;
  onDiagnosticsClick?: () => void;
  overallCompletion: number;
  sprsScore: number;

  // optional handlers
  onLogout?: () => void;
  onAdminClick?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  onSave,
  onSavedTemplatesClick,
  onProfileClick,
  onDiagnosticsClick,
  overallCompletion,
  sprsScore,
  onLogout,
  onAdminClick,
}) => {
  // ✅ DEV flag: DO NOT force true in production
  const isDev = process.env.NODE_ENV === "development";

  return (
    <header className="w-full bg-blue-800 border-b border-blue-900 h-20 flex items-center px-6 justify-between shadow-md z-50 flex-shrink-0">
      {/* LEFT */}
      <div className="flex items-center">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold text-white leading-none">CMMC Launch Hub</h1>
          <span className="text-base text-blue-300">Basic Safeguarding Starts Here...</span>
        </div>
      </div>

      {/* CENTER */}
      <div className="flex flex-col items-center mx-auto text-center">
        <div className="w-64 bg-blue-900 rounded-full h-3 overflow-hidden mb-1">
          <div
            className="bg-green-400 h-3 transition-all"
            style={{ width: `${overallCompletion}%` }}
          ></div>
        </div>
        <div className="flex items-center space-x-4 text-white text-lg font-semibold">
          <span>Progress: {overallCompletion}%</span>
          <span>|</span>
          <span>SPRS Score: {sprsScore}</span>
        </div>
      </div>

      {/* RIGHT */}
      <div className="flex items-center space-x-2">
        {/* ✅ Admin button (shows only if onAdminClick is provided) */}
        {onAdminClick && (
          <button
            onClick={onAdminClick}
            className="flex items-center px-3 py-1.5 bg-gray-900/30 text-white text-sm rounded-md hover:bg-gray-900/40 transition-colors border border-white/20"
            title="Admin Panel"
          >
            <Shield className="h-4 w-4 mr-1" />
            Admin
          </button>
        )}

        {isDev && onDiagnosticsClick && (
          <button
            onClick={onDiagnosticsClick}
            className="flex items-center px-3 py-1.5 bg-gray-700 text-blue-300 text-xs rounded-md hover:bg-gray-600 transition-colors border border-blue-400/30 mr-2"
            title="Dataset Diagnostics (DEV ONLY)"
          >
            <Activity className="h-4 w-4 mr-1" />
            Diagnostics
          </button>
        )}

        <button
          onClick={onSavedTemplatesClick}
          className="flex items-center px-3 py-1.5 bg-blue-700 text-white text-sm rounded-md hover:bg-blue-600 transition-colors"
        >
          <Archive className="h-4 w-4 mr-1" />
          Saved Templates
        </button>

        <button
          onClick={onProfileClick}
          className="flex items-center px-3 py-1.5 bg-blue-700 text-white text-sm rounded-md hover:bg-blue-600 transition-colors"
        >
          <User className="h-4 w-4 mr-1" />
          Profile
        </button>

        <div className="h-6 w-px bg-blue-700 mx-2"></div>

        <button
          onClick={onSave}
          className="flex items-center px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-500 transition-colors"
        >
          <Save className="h-4 w-4 mr-1" />
          Save
        </button>

        {onLogout && (
          <button
            onClick={onLogout}
            className="flex items-center px-3 py-1.5 bg-red-700 text-white text-sm rounded-md hover:bg-red-600 transition-colors ml-2"
            title="Logout"
          >
            <LogOut className="h-4 w-4 mr-1" />
            Logout
          </button>
        )}
      </div>
    </header>
  );
};
