import React, { useState } from "react";
import { Save, Archive, User, Activity, LogOut, Shield, ChevronDown } from "lucide-react";

export type SuperAdminMenuItem = {
  label: string;
  onClick: () => void;
};

interface AppHeaderProps {
  onSave: () => void;
  onSavedTemplatesClick: () => void;
  onProfileClick: () => void;
  onDiagnosticsClick?: () => void;
  overallCompletion: number;
  sprsScore: number;
  saveStatus?: "idle" | "saving" | "saved" | "error";
  saveMessage?: string;
  showAppActions?: boolean;
  onLogout?: () => void;
  onAdminClick?: () => void;
  onSuperAdminClick?: () => void;
  superAdminMenuItems?: SuperAdminMenuItem[];
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  onSave,
  onSavedTemplatesClick,
  onProfileClick,
  onDiagnosticsClick,
  overallCompletion,
  sprsScore,
  saveStatus = "idle",
  saveMessage,
  showAppActions = true,
  onLogout,
  onAdminClick,
  onSuperAdminClick,
  superAdminMenuItems,
}) => {
  const [superAdminMenuOpen, setSuperAdminMenuOpen] = useState(false);
  const runSuperAdminMenuItem = (item: SuperAdminMenuItem) => {
    item.onClick();
    setSuperAdminMenuOpen(false);
  };

  return (
    <header className="w-full bg-blue-800 border-b border-blue-900 h-20 flex items-center px-6 justify-between shadow-md z-50 flex-shrink-0">
      <div className="flex items-center">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold text-white leading-none">CMMC Launch Hub</h1>
          <span className="text-base text-blue-300">Basic Safeguarding Starts Here...</span>
        </div>
      </div>

      {showAppActions && (
        <div className="flex flex-col items-center mx-auto text-center">
          <div className="w-64 bg-blue-900 rounded-full h-3 overflow-hidden mb-1">
            <div className="bg-green-400 h-3 transition-all" style={{ width: `${overallCompletion}%` }} />
          </div>
          <div className="flex items-center space-x-4 text-white text-lg font-semibold">
            <span>Progress: {overallCompletion}%</span>
            <span>|</span>
            <span>SPRS Score: {sprsScore}</span>
          </div>
        </div>
      )}

      {showAppActions && (
        <div className="flex items-center space-x-2">
          {(onSuperAdminClick || (superAdminMenuItems && superAdminMenuItems.length > 0)) && (
            <div className="relative">
              <button
                type="button"
                onClick={() => superAdminMenuItems?.length ? setSuperAdminMenuOpen(open => !open) : onSuperAdminClick?.()}
                className="flex items-center px-3 py-1.5 bg-gray-900/30 text-white text-sm rounded-md hover:bg-gray-900/40 transition-colors border border-white/20"
                title="SuperAdmin navigation"
              >
                <Shield className="h-4 w-4 mr-1" />
                SuperAdmin
                {superAdminMenuItems?.length ? <ChevronDown className="ml-1 h-4 w-4" /> : null}
              </button>
              {superAdminMenuOpen && superAdminMenuItems?.length ? (
                <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-md border border-blue-900/20 bg-white py-2 text-sm shadow-xl">
                  {superAdminMenuItems.map(item => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => runSuperAdminMenuItem(item)}
                      className="block w-full px-3 py-2 text-left font-semibold text-gray-700 hover:bg-blue-50 hover:text-blue-800"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          {onAdminClick && (
            <button
              type="button"
              onClick={onAdminClick}
              className="flex items-center px-3 py-1.5 bg-gray-900/30 text-white text-sm rounded-md hover:bg-gray-900/40 transition-colors border border-white/20"
              title="Admin Panel"
            >
              <Shield className="h-4 w-4 mr-1" />
              Admin
            </button>
          )}

          {onDiagnosticsClick && (
            <button
              type="button"
              onClick={onDiagnosticsClick}
              className="flex items-center px-3 py-1.5 bg-gray-700 text-blue-300 text-xs rounded-md hover:bg-gray-600 transition-colors border border-blue-400/30 mr-2"
              title="Dataset Diagnostics (DEV ONLY)"
            >
              <Activity className="h-4 w-4 mr-1" />
              Diagnostics
            </button>
          )}

          <button type="button" onClick={onSavedTemplatesClick} className="flex items-center px-3 py-1.5 bg-blue-700 text-white text-sm rounded-md hover:bg-blue-600 transition-colors">
            <Archive className="h-4 w-4 mr-1" />
            Documents
          </button>

          <button type="button" onClick={onProfileClick} className="flex items-center px-3 py-1.5 bg-blue-700 text-white text-sm rounded-md hover:bg-blue-600 transition-colors">
            <User className="h-4 w-4 mr-1" />
            Profile
          </button>

          <div className="h-6 w-px bg-blue-700 mx-2" />

          <button
            type="button"
            onClick={onSave}
            disabled={saveStatus === "saving"}
            className="flex items-center px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-500 transition-colors disabled:opacity-70 disabled:cursor-wait"
          >
            <Save className="h-4 w-4 mr-1" />
            {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved" : "Save"}
          </button>
          {saveStatus === "error" && saveMessage && (
            <span className="max-w-48 text-xs text-red-100" role="alert">{saveMessage}</span>
          )}

          {onLogout && (
            <button type="button" onClick={onLogout} className="flex items-center px-3 py-1.5 bg-red-700 text-white text-sm rounded-md hover:bg-red-600 transition-colors ml-2" title="Logout">
              <LogOut className="h-4 w-4 mr-1" />
              Logout
            </button>
          )}
        </div>
      )}
    </header>
  );
};
