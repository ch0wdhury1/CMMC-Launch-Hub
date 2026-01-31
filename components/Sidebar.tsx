import React, { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  Shield,
  ShieldCheck,
  GraduationCap,
  Wrench,
  FileText,
  Lock,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

type Domain = {
  id?: string;
  name: string;
  practices?: any[];
};

type ActiveViewInfo =
  | { type: "dashboard" }
  | { type: "domain"; domainName: string }
  | { type: "practice"; practiceId: string }
  | { type: string; [k: string]: any }
  | null
  | undefined;

type Props = {
  domains: Domain[];
  subscriptionLevel: string; // "SPONSORED" | "COMM_L1" | "COMM_L2" (and legacy values)
  onNavClick: (domainName: string) => void;

  onDashboardClick: () => void;
  activeViewInfo?: ActiveViewInfo;

  // System / reporting views
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

  onLockedClick: () => void;
};

const normalizeTier = (tierRaw: string) => {
  const t = String(tierRaw || "").trim().toUpperCase();

  // normalize older/alternate names
  if (t === "CT_SPONSORED") return "SPONSORED";
  if (t === "TIER_1" || t === "L1") return "COMM_L1";
  if (t === "TIER_2" || t === "L2") return "COMM_L2";

  if (t === "SPONSORED" || t === "COMM_L1" || t === "COMM_L2") return t;
  return t || "SPONSORED";
};

// UI helpers
const sectionHeader =
  "w-full flex items-center justify-between px-4 py-3 text-xs font-semibold tracking-wider text-gray-400 uppercase hover:text-gray-200";
const navButtonBase =
  "w-full flex items-center px-4 py-2.5 text-sm rounded-md transition-colors";
const navButtonIdle = "text-gray-200 hover:bg-gray-700/60";
const navButtonActive = "bg-blue-600/20 text-white ring-1 ring-blue-500/40";





export function Sidebar(props: Props) {











  const {
    domains,
    subscriptionLevel,
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

    onLockedClick,
  } = props;











const tier = useMemo(() => normalizeTier(subscriptionLevel), [subscriptionLevel]);

// Treat SPONSORED like COMM_L1 for "baseline" gating decisions (nav.l1 etc.)
// Keep SPONSOR feature restrictions via your matrix overrides below.
const tierBase = useMemo(() => {
  return tier === "SPONSORED" ? "COMM_L1" : tier;
}, [tier]);






// --- L1 domain allow-list (CMMC Level 1) ---
const L1_DOMAIN_IDS = useMemo(
  () => new Set(["AC", "IA", "MP", "PE", "SC", "SI"]),
  []
);

const getIdFromName = (name: string) => {
  // Parses "Access Control (AC)" -> "AC"
  const m = String(name ?? "").match(/\(([^)]+)\)\s*$/);
  return (m?.[1] ?? "").trim();
};

// L1 domains shown in sidebar must be ONLY the 6 L1 domains
const l1Domains = useMemo(() => {
  return (domains || []).filter((d: any) => {
    const id = d?.id ? String(d.id).trim() : getIdFromName(String(d?.name ?? ""));
    return L1_DOMAIN_IDS.has(id);
  });
}, [domains, L1_DOMAIN_IDS]);



console.log("L1_FILTER_DEBUG", { tier, tierBase, l1Count: l1Domains.length, l1Names: l1Domains.map(d => d.name) });









  // --- Access matrix (as you specified) ---
  const access = useMemo(() => {
    const isSponsored = tier === "SPONSORED"; // keep for sponsor-only restrictions
    const isL1 = tierBase === "COMM_L1";
    const isL2 = tierBase === "COMM_L2";

    const can = {
      nav: {
        l1: true,
        l2: isL2,
      },
      training: {
        interactiveModules: true,
        verifiedUpdates: isL2,
      },
      tools: {
        readinessAnalyzer: true,
        responsibilityMatrix: isL2,
        starterKits: true,
        templateAssist: isL1 || isL2,
      },
      reporting: {
        executiveNarrative: isL2,
        readinessVault: isL2,
        sprsScorecard: true,
        ssp: isL1 || isL2,
        poam: isL2,
      },
    };

    // sponsored vs comm_l1 share same except templateAssist + ssp
    if (isSponsored) {
      can.tools.templateAssist = false;
      can.reporting.executiveNarrative = false;
      can.reporting.readinessVault = false;
      can.reporting.ssp = false;
      can.reporting.poam = false;
      can.training.verifiedUpdates = false;
      can.tools.responsibilityMatrix = false;
    }

    return can;
  }, [tier]);

  // --- Section expansion ---
  const [openL1, setOpenL1] = useState(false);
  const [openL2, setOpenL2] = useState(false);
  const [openTraining, setOpenTraining] = useState(false);
  const [openTools, setOpenTools] = useState(false);
  const [openReporting, setOpenReporting] = useState(false);

  // --- L2 static menu from public/cmmc_l2_prepop.json ---
  const [l2Menu, setL2Menu] = useState<Array<{ id: string; name: string }>>([]);
  const [l2MenuError, setL2MenuError] = useState<string | null>(null);










useEffect(() => {
  let cancelled = false;

  (async () => {
    try {
      const res = await fetch("/cmmc_l2_prepop.json", { cache: "no-store" });
      const json = await res.json();

      if (!cancelled) {
        console.log("L2_DATA_DEBUG", {
          type: Array.isArray(json) ? "array" : "object",
          keys: json && !Array.isArray(json) ? Object.keys(json) : null,
          domainsLen: Array.isArray(json)
            ? json.length
            : Array.isArray(json?.domains)
            ? json.domains.length
            : 0,
          sample: Array.isArray(json)
            ? json?.[0]
            : Array.isArray(json?.domains)
            ? json.domains?.[0]
            : null,
        });

        // Normalize domains list whether JSON root is array or object.domains
        const rawDomains = Array.isArray(json)
          ? json
          : Array.isArray(json?.domains)
          ? json.domains
          : [];
        const menu = rawDomains
          .map((d: any) => {
            const id = String(d?.domain_id ?? "").trim().toUpperCase();
            if (!id) return null;
            const baseName = String(d?.domain_name ?? id).trim();
            const name = /\([^)]+\)\s*$/.test(baseName) ? baseName : `${baseName} (${id})`;
            return { id, name };
          })
          .filter(Boolean) as Array<{ id: string; name: string }>;

        setL2Menu(menu);
        setL2MenuError(null);

      }
    } catch (e) {
      console.error("L2_DATA_LOAD_FAILED", e);
      if (!cancelled) setL2MenuError(String((e as any)?.message ?? e));
    }
  })();

  return () => {
    cancelled = true;
  };
}, []);










  // --- Active state helpers ---
  const isActive = (type: string, idOrName?: string) => {
    if (!activeViewInfo) return false;

    if (type === "dashboard") return activeViewInfo.type === "dashboard";

    if (type === "domain") {
      return activeViewInfo.type === "domain" && String((activeViewInfo as any).domainName) === String(idOrName);
    }
    return false;
  };

  const navClass = (active: boolean) =>
    `${navButtonBase} ${active ? navButtonActive : navButtonIdle}`;

  const clickOrLock = (allowed: boolean, fn: () => void) => {
    if (!allowed) return onLockedClick();
    fn();
  };

//  const l1Domains = useMemo(() => Array.isArray(domains) ? domains : [], [domains]);

  const handleL2DomainClick = (domainId: string) => {
    if (!access.nav.l2) {
      onLockedClick();
      return;
    }
    const token = `__L2__:${domainId}`;
    onNavClick(token);
  };

  return (
    <aside className="w-72 bg-gray-800 text-white flex flex-col border-r border-gray-700">
      {/* Top: Dashboard */}
      <div className="px-2 pt-4">
        <button
          className={navClass(isActive("dashboard"))}
          onClick={onDashboardClick}
        >
          <LayoutDashboard className="h-4 w-4 mr-3" />
          <span>Command Dashboard</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto mt-2 pb-6">
        {/* CMMC LEVEL 1 */}
        <button className={sectionHeader} onClick={() => setOpenL1((v) => !v)}>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-yellow-400" />
            <span>CMMC LEVEL 1</span>
          </div>
          {openL1 ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        {openL1 && (
          <div className="px-2 pb-2">
            {l1Domains.map((d) => (
              <button
                key={d.name}
                className={navClass(isActive("domain", d.name))}
                onClick={() => onNavClick(d.name)}
              >
                <div className="h-1 w-1 bg-blue-400 rounded-full mr-3 flex-shrink-0" />
                <span className="text-left w-full whitespace-normal break-words truncate">{d.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* CMMC LEVEL 2 */}
        <button className={sectionHeader} onClick={() => setOpenL2((v) => !v)}>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-blue-300" />
            <span>CMMC LEVEL 2</span>
          </div>
          {openL2 ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        {openL2 && (
          <div className="px-2 pb-2">
            {!access.nav.l2 && (
              <button
                className={`${navButtonBase} ${navButtonIdle} opacity-80`}
                onClick={onLockedClick}
              >
                <Lock className="h-4 w-4 mr-3 text-gray-300" />
                <span>Upgrade to unlock Level 2</span>
              </button>
            )}

            {access.nav.l2 && l2Menu.map((d) => {
              const token = `__L2__:${d.id}`;
              return (
                <button
                  key={token}
                  className={navClass(isActive("domain", token))}
                  onClick={() => handleL2DomainClick(d.id)}
                >
                  <div className="h-1 w-1 bg-blue-400 rounded-full mr-3 flex-shrink-0" />
                  <span className="text-left w-full whitespace-normal break-words truncate">
                    {/\(([^)]+)\)\s*$/.test(d.name) ? d.name : `${d.name} (${d.id})`}
                  </span>
                </button>
              );
            })}

            {access.nav.l2 && l2Menu.length === 0 && (
              <div className="px-4 py-2 text-xs text-gray-300">
                {l2MenuError ? `L2 menu load error: ${l2MenuError}` : "Loading Level 2 domains..."}
              </div>
            )}
          </div>
        )}

        {/* Awareness & Training */}
        <button className={sectionHeader} onClick={() => setOpenTraining((v) => !v)}>
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-green-300" />
            <span>AWARENESS & TRAINING</span>
          </div>
          {openTraining ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        {openTraining && (
          <div className="px-2 pb-2">
            <button
              className={navClass(activeViewInfo?.type === "training")}
              onClick={() => clickOrLock(access.training.interactiveModules, onTrainingClick)}
            >
              <span className="ml-7">Interactive Modules</span>
              {!access.training.interactiveModules && <Lock className="h-3 w-3 ml-auto text-gray-400" />}
            </button>

            <button
              className={navClass(activeViewInfo?.type === "newsUpdates")}
              onClick={() => clickOrLock(access.training.verifiedUpdates, onNewsUpdatesClick)}
            >
              <span className="ml-7">Verified Updates</span>
              {!access.training.verifiedUpdates && <Lock className="h-3 w-3 ml-auto text-gray-400" />}
            </button>
          </div>
        )}

        {/* System Tools */}
        <button className={sectionHeader} onClick={() => setOpenTools((v) => !v)}>
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-purple-300" />
            <span>SYSTEM TOOLS</span>
          </div>
          {openTools ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        {openTools && (
          <div className="px-2 pb-2">
            <button
              className={navClass(activeViewInfo?.type === "readinessAnalyzer")}
              onClick={() => clickOrLock(access.tools.readinessAnalyzer, onSecurityAnalyzerClick)}
            >
              <span className="ml-7">Readiness Analyzer</span>
              {!access.tools.readinessAnalyzer && <Lock className="h-3 w-3 ml-auto text-gray-400" />}
            </button>

            <button
              className={navClass(activeViewInfo?.type === "responsibilityMatrix")}
              onClick={() => clickOrLock(access.tools.responsibilityMatrix, onResponsibilityMatrixClick)}
            >
              <span className="ml-7">Shared Responsibility Matrix</span>
              {!access.tools.responsibilityMatrix && <Lock className="h-3 w-3 ml-auto text-gray-400" />}
            </button>

            <button
              className={navClass(activeViewInfo?.type === "solutions")}
              onClick={() => clickOrLock(access.tools.starterKits, onSolutionsClick)}
            >
              <span className="ml-7">Starter Kits</span>
              {!access.tools.starterKits && <Lock className="h-3 w-3 ml-auto text-gray-400" />}
            </button>

            <button
              className={navClass(activeViewInfo?.type === "templateAssist")}
              onClick={() => clickOrLock(access.tools.templateAssist, onTemplateAssistClick)}
            >
              <span className="ml-7">Template Assist (Smart Fill)</span>
              {!access.tools.templateAssist && <Lock className="h-3 w-3 ml-auto text-gray-400" />}
            </button>
          </div>
        )}

        {/* Compliance Reporting */}
        <button className={sectionHeader} onClick={() => setOpenReporting((v) => !v)}>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-sky-300" />
            <span>COMPLIANCE REPORTING</span>
          </div>
          {openReporting ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        {openReporting && (
          <div className="px-2 pb-2">
            <button
              className={navClass(activeViewInfo?.type === "executive")}
              onClick={() => clickOrLock(access.reporting.executiveNarrative, onExecutiveSummaryClick)}
            >
              <span className="ml-7">Executive Narrative</span>
              {!access.reporting.executiveNarrative && <Lock className="h-3 w-3 ml-auto text-gray-400" />}
            </button>

            <button
              className={navClass(activeViewInfo?.type === "readinessReports")}
              onClick={() => clickOrLock(access.reporting.readinessVault, onReadinessReportsClick)}
            >
              <span className="ml-7">Readiness Vault</span>
              {!access.reporting.readinessVault && <Lock className="h-3 w-3 ml-auto text-gray-400" />}
            </button>

            <button
              className={navClass(activeViewInfo?.type === "sprs")}
              onClick={() => clickOrLock(access.reporting.sprsScorecard, onSprsClick)}
            >
              <span className="ml-7">SPRS Scorecard</span>
              {!access.reporting.sprsScorecard && <Lock className="h-3 w-3 ml-auto text-gray-400" />}
            </button>

            <button
              className={navClass(activeViewInfo?.type === "systemSecurityPlan")}
              onClick={() => clickOrLock(access.reporting.ssp, onSystemSecurityPlanClick)}
            >
              <span className="ml-7">System Security Plan (SSP)</span>
              {!access.reporting.ssp && <Lock className="h-3 w-3 ml-auto text-gray-400" />}
            </button>

            <button
              className={navClass(activeViewInfo?.type === "poam")}
              onClick={() => clickOrLock(access.reporting.poam, onPoamClick)}
            >
              <span className="ml-7">POA&amp;M</span>
              {!access.reporting.poam && <Lock className="h-3 w-3 ml-auto text-gray-400" />}
            </button>
          </div>
        )}
      </div>

      {/* Current Tier footer */}
      <div className="px-4 py-3 border-t border-gray-700 text-xs text-gray-300 flex items-center justify-between">
        <span>Current Tier</span>
        <span className="font-semibold text-white">{tier}</span>
      </div>
    </aside>
  );
}
