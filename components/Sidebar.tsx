import React, { useMemo, useState } from "react";
import { Domain, SubscriptionLevel } from "../types";

import type { ActiveViewInfo } from '../App';


import { useUserProfile } from "../src/useUserProfile";

import {
  Archive,
  BarChart3,
  ClipboardCheck,
  ChevronRight,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Lock,
  ShieldCheck,
  Wand2,
  Zap,
} from "lucide-react";

interface SidebarProps {
  domains: Domain[];
  onNavClick: (view: string) => void;
  onDashboardClick: () => void;
  activeViewInfo: ActiveViewInfo;

  onExecutiveSummaryClick: () => void;
  onTemplateAssistClick: () => void;
  onSprsClick: () => void;
  onSolutionsClick: () => void;
  onSecurityAnalyzerClick: () => void;
  onReadinessReportsClick: () => void;
  onSystemSecurityPlanClick: () => void;
  onPoamClick: () => void;
  onResponsibilityMatrixClick: () => void;
  onTrainingClick: () => void;
  onNewsUpdatesClick: () => void;

  subscriptionLevel: SubscriptionLevel;
  onLockedClick: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  domains,
  onNavClick,
  onDashboardClick,
  activeViewInfo,
  onExecutiveSummaryClick,
  onTemplateAssistClick,
  onSprsClick,
  onSolutionsClick,
  onSecurityAnalyzerClick,
  onReadinessReportsClick,
  onSystemSecurityPlanClick,
  onPoamClick,
  onResponsibilityMatrixClick,
  onTrainingClick,
  onNewsUpdatesClick,
  subscriptionLevel,
  onLockedClick,
}) => {
  // ✅ Firebase entitlements
  const { loading: profileLoading, profile } = useUserProfile();
  const ent = (profile?.entitlements ?? {}) as Record<string, any>;

  // ✅ Primary gating flag for Level 2
  const canL2 = !!ent.l2_assessment;

  const [isAwarenessOpen, setIsAwarenessOpen] = useState(false);
  const [isL1Open, setIsL1Open] = useState(false);
  const [isL2Open, setIsL2Open] = useState(false);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isReportingOpen, setIsReportingOpen] = useState(false);

  const l1Domains = useMemo(() => {
    return domains.filter((d) => d.practices.some((p) => p.level === 1));
  }, [domains]);

  const l2Domains = useMemo(() => {
    // Only show domains that actually contain Level 2 practices
    return domains.filter((d) => d.practices.some((p) => p.level === 2));
  }, [domains]);

  const isActive = (type: ActiveViewInfo["type"], name?: string) => {
    if (activeViewInfo.type !== type) return false;

    if (type === "domain" || type === "practice") {
      return (
        activeViewInfo.name === name ||
        (activeViewInfo as any).domainName === name
      );
    }

    return true;
  };

  // Note: locked buttons are still clickable (so they can trigger onLockedClick)
  const navButtonClass = (active: boolean, locked: boolean = false) =>
    `flex items-center w-full px-3 py-1.5 rounded-md text-[14px] font-medium transition-all ${
      active
        ? "bg-blue-900 text-white shadow-sm"
        : "text-gray-300 hover:bg-gray-700 hover:text-white"
    } ${locked ? "opacity-60" : ""}`;

  const collapsibleHeaderClass =
    "w-full flex justify-between items-center text-sm font-black text-gray-400 px-3 py-2 rounded-md hover:bg-gray-700 cursor-pointer tracking-widest uppercase";

  const handleL2DomainClick = (domainName: string) => {
    if (!canL2) {
      onLockedClick();
      return;
    }
    onNavClick(domainName);
  };

  return (
    <aside className="w-[352px] bg-gray-800 text-white flex flex-col flex-shrink-0 overflow-y-auto border-r border-gray-700 shadow-xl">
      {/* Dashboard */}
      <div className="p-3 space-y-1 flex-shrink-0 mt-2">
        <button
          onClick={onDashboardClick}
          className={navButtonClass(isActive("dashboard"))}
        >
          <LayoutDashboard className="h-4 w-4 mr-3" />
          Command Dashboard
        </button>
      </div>

      {/* LEVEL 1 SECTION */}
      <div className="p-3 space-y-1">
        <button
          onClick={() => setIsL1Open(!isL1Open)}
          className={collapsibleHeaderClass}
        >
          <span className="flex items-center">
            <Zap className="h-4 w-4 mr-2 text-yellow-400" />
            CMMC Level 1
          </span>
          <ChevronRight
            className={`h-3 w-3 transition-transform ${
              isL1Open ? "rotate-90" : ""
            }`}
          />
        </button>

        {isL1Open && (
          <div className="pt-1 pl-2 space-y-0.5 animate-fadeIn">
            {l1Domains.map((domain) => (
              <button
                key={domain.name}
                onClick={() => onNavClick(domain.name)}
                className={navButtonClass(isActive("domain", domain.name))}
              >
                <div className="h-1 w-1 bg-gray-500 rounded-full mr-3 flex-shrink-0" />
                <span className="text-left w-full whitespace-normal break-words truncate">
                  {domain.name}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* LEVEL 2 SECTION */}
      <div className="p-3 space-y-1">
        <button
          onClick={() => setIsL2Open(!isL2Open)}
          className={collapsibleHeaderClass}
        >
          <span className="flex items-center">
            <ShieldCheck
              className={`h-4 w-4 mr-2 ${
                canL2 ? "text-blue-400" : "text-gray-500"
              }`}
            />
            CMMC Level 2
            {!canL2 && <Lock className="h-3 w-3 ml-2 text-gray-500" />}
          </span>
          <ChevronRight
            className={`h-3 w-3 transition-transform ${
              isL2Open ? "rotate-90" : ""
            }`}
          />
        </button>

        {isL2Open && (
          <div className="pt-1 pl-2 space-y-0.5 animate-fadeIn">
            {profileLoading ? (
              <div className="px-3 py-2 text-[11px] text-gray-400">
                Loading access…
              </div>
            ) : !canL2 ? (
              <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700 mx-2 mb-2">
                <p className="text-[10px] text-gray-400 leading-relaxed mb-3">
                  Level 2 adds support for 110 practices including CUI protection
                  and incident response.
                </p>
                <button
                  onClick={onLockedClick}
                  className="w-full py-1.5 bg-blue-600 text-[10px] font-black uppercase tracking-widest rounded hover:bg-blue-500 transition-colors"
                >
                  Unlock Level 2
                </button>
              </div>
            ) : (
              l2Domains.map((domain) => (
                <button
                  key={domain.name}
                  onClick={() => handleL2DomainClick(domain.name)}
                  className={navButtonClass(isActive("domain", domain.name))}
                >
                  <div className="h-1 w-1 bg-blue-400 rounded-full mr-3 flex-shrink-0" />
                  <span className="text-left w-full whitespace-normal break-words truncate">
                    {domain.name}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div className="h-px bg-gray-700 mx-6 my-2 opacity-50" />

      {/* AWARENESS & TRAINING SECTION */}
      <div className="p-3 space-y-1">
        <button
          onClick={() => setIsAwarenessOpen(!isAwarenessOpen)}
          className={collapsibleHeaderClass}
        >
          <span>AWARENESS & TRAINING</span>
          <ChevronRight
            className={`h-3 w-3 transition-transform ${
              isAwarenessOpen ? "rotate-90" : ""
            }`}
          />
        </button>

        {isAwarenessOpen && (
          <div className="pt-1 pl-2 space-y-0.5 animate-fadeIn">
            <button
              onClick={onTrainingClick}
              className={navButtonClass(isActive("training"))}
            >
              <GraduationCap className="h-4 w-4 mr-3" />
              Interactive Modules
            </button>
            <button
              onClick={onNewsUpdatesClick}
              className={navButtonClass(isActive("newsUpdates"))}
            >
              <FileText className="h-4 w-4 mr-3" />
              Verified Updates
            </button>
          </div>
        )}
      </div>

      {/* TOOLS SECTION */}
      <div className="p-3 space-y-1">
        <button
          onClick={() => setIsToolsOpen(!isToolsOpen)}
          className={collapsibleHeaderClass}
        >
          <span>SYSTEM TOOLS</span>
          <ChevronRight
            className={`h-3 w-3 transition-transform ${
              isToolsOpen ? "rotate-90" : ""
            }`}
          />
        </button>

        {isToolsOpen && (
          <div className="pt-1 pl-2 space-y-0.5 animate-fadeIn">
            <button
              onClick={onSecurityAnalyzerClick}
              className={navButtonClass(isActive("readinessAnalyzer"))}
            >
              <ClipboardCheck className="h-4 w-4 mr-3" />
              Readiness Analyzer
            </button>
            <button
              onClick={onResponsibilityMatrixClick}
              className={navButtonClass(isActive("responsibilityMatrix"))}
            >
              <ShieldCheck className="h-4 w-4 mr-3" />
              Shared Responsibility
            </button>
            <button
              onClick={onSolutionsClick}
              className={navButtonClass(isActive("solutions"))}
            >
              <Zap className="h-4 w-4 mr-3" />
              Starter Kits
            </button>
            <button
              onClick={onTemplateAssistClick}
              className={navButtonClass(isActive("templateAssist"))}
            >
              <Wand2 className="h-4 w-4 mr-3" />
              Template Assist
            </button>
          </div>
        )}
      </div>

      {/* REPORTING SECTION */}
      <div className="p-3 space-y-1">
        <button
          onClick={() => setIsReportingOpen(!isReportingOpen)}
          className={collapsibleHeaderClass}
        >
          <span>COMPLIANCE REPORTING</span>
          <ChevronRight
            className={`h-3 w-3 transition-transform ${
              isReportingOpen ? "rotate-90" : ""
            }`}
          />
        </button>

        {isReportingOpen && (
          <div className="pt-1 pl-2 space-y-0.5 animate-fadeIn">
            <button
              onClick={onExecutiveSummaryClick}
              className={navButtonClass(isActive("executive"))}
            >
              <FileText className="h-4 w-4 mr-3" />
              Executive Narrative
            </button>
            <button
              onClick={onReadinessReportsClick}
              className={navButtonClass(isActive("readinessReports"))}
            >
              <Archive className="h-4 w-4 mr-3" />
              Readiness Vault
            </button>
            <button
              onClick={onSprsClick}
              className={navButtonClass(isActive("sprs"))}
            >
              <BarChart3 className="h-4 w-4 mr-3" />
              SPRS Scorecard
            </button>
            <button
              onClick={onSystemSecurityPlanClick}
              className={navButtonClass(isActive("systemSecurityPlan"))}
            >
              <FileText className="h-4 w-4 mr-3" />
              System Security Plan
            </button>
            <button
              onClick={onPoamClick}
              className={navButtonClass(isActive("poam"))}
            >
              <ClipboardCheck className="h-4 w-4 mr-3" />
              Remediation (POA&M)
            </button>
          </div>
        )}
      </div>

      {/* Footer Subscription Badge */}
      <div className="mt-auto p-4 bg-gray-900/30 border-t border-gray-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldCheck
              className={`h-4 w-4 ${canL2 ? "text-blue-400" : "text-gray-400"}`}
            />
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
              Plan: {canL2 ? "L2" : subscriptionLevel}
            </span>
          </div>

          {!canL2 && (
            <button
              onClick={onLockedClick}
              className="bg-blue-600 text-white px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest hover:bg-blue-500"
            >
              Upgrade
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};
