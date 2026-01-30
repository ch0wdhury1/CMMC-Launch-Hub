import React, { useEffect, useMemo, useState } from "react";
import { Domain, SubscriptionLevel } from "../types";
import type { ActiveViewInfo } from "../App";

// Core App Shell entitlements (org-based)
// NOTE: your Sidebar lives in /components, so the relative path points into /src
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
  /** Legacy dataset (often Level-1 only). We'll gracefully fall back to static prepop JSON for Level 2. */
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

// --- Static prepop parsing (public/cmmc_l1_prepop.json, public/cmmc_l2_prepop.json) ---
type PrepopDomain = { domain_id: string; domain_name: string; practices: any[] };

function mapPrepopToDomains(prepop: any, level: 1 | 2): Domain[] {
  const rawDomains: PrepopDomain[] = Array.isArray(prepop?.domains) ? prepop.domains : [];
  return rawDomains.map((d) => {
    const practices = (Array.isArray(d.practices) ? d.practices : []).map((p: any) => {
      // Make a "Practice-like" object with a `level` property so existing filters work.
      const id = p.id ?? p.requirementId ?? p.requirement_id ?? p.practiceId ?? "";
      const name =
        p.name ??
        p.requirementName ??
        p.requirement_name ??
        p.title ??
        p.requirementId ??
        "Practice";

      return {
        id,
        name,
        title: name,
        level,
        // keep raw for later pages if needed
        _raw: p,
      } as any;
    });

    return {
      id: d.domain_id,
      name: d.domain_name,
      practices,
    } as any as Domain;
  });
}

async function fetchPrepop(path: string): Promise<any | null> {
  try {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
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
  const [isAwarenessOpen, setIsAwarenessOpen] = useState(false);
  const [isL1Open, setIsL1Open] = useState(false);
  const [isL2Open, setIsL2Open] = useState(false);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isReportingOpen, setIsReportingOpen] = useState(false);

  // Source of truth for MVP: ORG tier (passed in as subscriptionLevel)
  const canL2 = subscriptionLevel === "COMM_L2";
  const l2Locked = !canL2;


  // --- Static dataset fallback state ---
  const [l2StaticDomains, setL2StaticDomains] = useState<Domain[] | null>(null);
  const [l2StaticLoading, setL2StaticLoading] = useState(false);

  const l1Domains = useMemo(() => {
    // Prefer the live dataset for Level 1 (it already works for you)
    return domains.filter((d: any) => d?.practices?.some((p: any) => p?.level === 1));
  }, [domains]);

  const l2DomainsFromProp = useMemo(() => {
    return domains.filter((d: any) => d?.practices?.some((p: any) => p?.level === 2));
  }, [domains]);

  const effectiveL2Domains = useMemo(() => {
    if (l2DomainsFromProp.length > 0) return l2DomainsFromProp;
    if (Array.isArray(l2StaticDomains) && l2StaticDomains.length > 0) return l2StaticDomains;
    return [];
  }, [l2DomainsFromProp, l2StaticDomains]);

  // If L2 is unlocked but the current dataset contains no L2 practices, load the static prepop JSON.
  useEffect(() => {
    let cancelled = false;

    async function ensureL2Domains() {
      if (!canL2) return;
      if (l2DomainsFromProp.length > 0) return;
      if (l2StaticDomains && l2StaticDomains.length > 0) return;

      setL2StaticLoading(true);
      const prepop = await fetchPrepop("/cmmc_l2_prepop.json");
      const mapped = prepop ? mapPrepopToDomains(prepop, 2) : [];
      if (!cancelled) {
        setL2StaticDomains(mapped);
        setL2StaticLoading(false);
      }
    }

    ensureL2Domains();

    return () => {
      cancelled = true;
    };
  }, [canL2, l2DomainsFromProp.length, l2StaticDomains]);

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

  const handleL2HeaderClick = () => {
    if (l2Locked) {
      onLockedClick();
      return;
    }
    setIsL2Open((v) => !v);
  };

const handleL2DomainClick = (domainId: string) => {
  if (!canL2) {
    onLockedClick();
    return;
  }

  // Use a token so App can render L2 practices even if the base dataset is L1-filtered
  const token = "__L2__:" + domainId;

  // 👇 ADD THIS LINE (TEMPORARY)
  // console.log("NAV_DEBUG", token); // TEMP: enable when debugging navigation  onNavClick(token);
};

  const getL2DomainId = (domain: any) => {
    // Parse "Access Control (AC)" -> "AC"
    const name = String(domain?.name ?? "");
    const match = name.match(/\(([^)]+)\)\s*$/);
    if (match?.[1]) return match[1];

    // Fallback: derive from first practice id: "AC.L2-..." -> "AC"
    const firstPracticeId = String(domain?.practices?.[0]?.id ?? "");
    if (firstPracticeId.includes(".")) return firstPracticeId.split(".")[0];

    return "";
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
            className={`h-3 w-3 transition-transform ${isL1Open ? "rotate-90" : ""}`}
          />
        </button>

        {isL1Open && (
          <div className="pt-1 pl-2 space-y-0.5 animate-fadeIn">
            {l1Domains.map((domain: any) => (
              <button
                key={domain.id ?? domain.name}
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
        <button onClick={handleL2HeaderClick} className={collapsibleHeaderClass}>
          <span className="flex items-center">
            <ShieldCheck className={`h-4 w-4 mr-2 ${canL2 ? "text-blue-400" : "text-gray-500"}`} />
            CMMC Level 2
            {!canL2 && <Lock className="h-3 w-3 ml-2 text-gray-500" />}
          </span>
          <ChevronRight className={`h-3 w-3 transition-transform ${isL2Open ? "rotate-90" : ""}`} />
        </button>



        {isL2Open && (
          <div className="pt-1 pl-2 space-y-0.5 animate-fadeIn">
            {!canL2 ? (
              <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700 mx-2 mb-2">
                <p className="text-[10px] text-gray-400 leading-relaxed mb-3">
                  Level 2 adds support for 110 practices including CUI protection and incident response.
                </p>
                <button
                  onClick={onLockedClick}
                  className="w-full py-1.5 bg-blue-600 text-[10px] font-black uppercase tracking-widest rounded hover:bg-blue-500 transition-colors"
                >
                  Unlock Level 2
                </button>
              </div>
            ) : l2StaticLoading && effectiveL2Domains.length === 0 ? (
              <div className="px-3 py-2 text-[11px] text-gray-400">Loading Level 2 domains…</div>
            ) : effectiveL2Domains.length === 0 ? (
              <div className="px-3 py-2 text-[11px] text-gray-400">
                Level 2 is enabled, but no Level 2 dataset is available.
                <div className="mt-1 text-[10px] text-gray-500">
                  Expected: <span className="font-mono">/public/cmmc_l2_prepop.json</span>
                </div>
              </div>
            ) : (
effectiveL2Domains.map((domain: any) => {
  const domainId = getL2DomainId(domain);
  const token = "__L2__:" + domainId;

  return (
    <button
      key={token}
      onClick={() => handleL2DomainClick(domainId)}
      className={navButtonClass(isActive("domain", token))}
      disabled={!domainId}
      title={!domainId ? "Missing domain id" : undefined}
    >
      <div className="h-1 w-1 bg-blue-400 rounded-full mr-3 flex-shrink-0" />
      <span className="text-left w-full whitespace-normal break-words truncate">
        {domain.name}
      </span>
    </button>
  );
})
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
          <ChevronRight className={`h-3 w-3 transition-transform ${isAwarenessOpen ? "rotate-90" : ""}`} />
        </button>

        {isAwarenessOpen && (
          <div className="pt-1 pl-2 space-y-0.5 animate-fadeIn">
            <button onClick={onTrainingClick} className={navButtonClass(isActive("training"))}>
              <GraduationCap className="h-4 w-4 mr-3" />
              Interactive Modules
            </button>
            <button onClick={onNewsUpdatesClick} className={navButtonClass(isActive("newsUpdates"))}>
              <FileText className="h-4 w-4 mr-3" />
              Verified Updates
            </button>
          </div>
        )}
      </div>

      {/* TOOLS SECTION */}
      <div className="p-3 space-y-1">
        <button onClick={() => setIsToolsOpen(!isToolsOpen)} className={collapsibleHeaderClass}>
          <span>SYSTEM TOOLS</span>
          <ChevronRight className={`h-3 w-3 transition-transform ${isToolsOpen ? "rotate-90" : ""}`} />
        </button>

        {isToolsOpen && (
          <div className="pt-1 pl-2 space-y-0.5 animate-fadeIn">
            <button onClick={onSecurityAnalyzerClick} className={navButtonClass(isActive("readinessAnalyzer"))}>
              <ClipboardCheck className="h-4 w-4 mr-3" />
              Readiness Analyzer
            </button>
            <button onClick={onResponsibilityMatrixClick} className={navButtonClass(isActive("responsibilityMatrix"))}>
              <ShieldCheck className="h-4 w-4 mr-3" />
              Shared Responsibility
            </button>
            <button onClick={onSolutionsClick} className={navButtonClass(isActive("solutions"))}>
              <Zap className="h-4 w-4 mr-3" />
              Starter Kits
            </button>
            <button onClick={onTemplateAssistClick} className={navButtonClass(isActive("templateAssist"))}>
              <Wand2 className="h-4 w-4 mr-3" />
              Template Assist
            </button>
          </div>
        )}
      </div>

      {/* REPORTING SECTION */}
      <div className="p-3 space-y-1">
        <button onClick={() => setIsReportingOpen(!isReportingOpen)} className={collapsibleHeaderClass}>
          <span>COMPLIANCE REPORTING</span>
          <ChevronRight className={`h-3 w-3 transition-transform ${isReportingOpen ? "rotate-90" : ""}`} />
        </button>

        {isReportingOpen && (
          <div className="pt-1 pl-2 space-y-0.5 animate-fadeIn">
            <button onClick={onExecutiveSummaryClick} className={navButtonClass(isActive("executive"))}>
              <FileText className="h-4 w-4 mr-3" />
              Executive Narrative
            </button>
            <button onClick={onReadinessReportsClick} className={navButtonClass(isActive("readinessReports"))}>
              <Archive className="h-4 w-4 mr-3" />
              Readiness Vault
            </button>
            <button onClick={onSprsClick} className={navButtonClass(isActive("sprs"))}>
              <BarChart3 className="h-4 w-4 mr-3" />
              SPRS Scorecard
            </button>
            <button onClick={onSystemSecurityPlanClick} className={navButtonClass(isActive("systemSecurityPlan"))}>
              <FileText className="h-4 w-4 mr-3" />
              System Security Plan
            </button>
            <button onClick={onPoamClick} className={navButtonClass(isActive("poam"))}>
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
            <ShieldCheck className={`h-4 w-4 ${canL2 ? "text-blue-400" : "text-gray-400"}`} />
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
