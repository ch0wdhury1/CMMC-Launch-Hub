// TEMP: Firestore connection debug
console.log("🔥 Firestore host/ssl =", (db as any)?._settings?.host, (db as any)?._settings?.ssl);

import React, { useState, useCallback, useMemo, useEffect } from "react";

import { doc, getDoc } from "firebase/firestore";
import {
  onAuthStateChanged,
  User,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { auth, db } from "./src/firebase";

import { can, isSuperAdmin as isSuperAdminRole } from "./src/access";

import { AdminPanel } from "./components/AdminPanel";

import { Sidebar } from "./components/Sidebar";
import { Dashboard } from "./components/Dashboard";
import { DomainView } from "./components/DomainView";
import { PracticeView } from "./components/PracticeView";
import { AssistMePanel } from "./components/AssistMePanel";
import { ExecutiveSummary } from "./components/ExecutiveSummary";
import { AppHeader } from "./components/AppHeader";
import { AppFooter } from "./components/AppFooter";
import { ProfilePage } from "./components/ProfilePage";
import { SavedTemplates } from "./components/SavedTemplates";
import { TemplateAssist } from "./components/TemplateAssist";
import { SprsScorecard } from "./components/SprsScorecard";
import { SolutionsView } from "./components/SolutionsView";
import { ReadinessAnalyzerView } from "./components/readiness/ReadinessAnalyzerView";
import { SavedReportsView } from "./components/readiness/SavedReportsView";
import { SystemSecurityPlan } from "./components/SystemSecurityPlan";
import { Poam } from "./components/Poam";
import { ResponsibilityMatrixPage } from "./components/ResponsibilityMatrixPage";
import { TrainingModule } from "./components/training/TrainingModule";
import { NewsUpdates } from "./components/NewsUpdates";
import { DiagnosticsDrawer } from "./components/DiagnosticsDrawer";
import { UpgradeModal } from "./components/UpgradeModal";

import { useUserProfile } from "./src/useUserProfile";
import { useCmmcData } from "./hooks/useCmmcData";
import { useSspData } from "./hooks/useSspData";

import { Practice } from "./types";
import { SPRS_CONTROLS } from "./data/sprsControls";

import { Home, ChevronRight, Key, ShieldAlert, Database, Loader2 } from "lucide-react";

/* =========================================================
   TEMP: system/activation read test (console-only)
   ========================================================= */
async function testReadSystemActivation() {
  try {
    const u = auth.currentUser;
    if (!u) {
      console.log("⚠️ [system/activation] Not logged in yet");
      return;
    }

    const ref = doc(db, "system", "activation");
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      console.log("⚠️ [system/activation] Document does not exist");
      return;
    }

    console.log("✅ [system/activation] READ OK:", snap.data());
  } catch (err) {
    console.error("❌ [system/activation] READ FAILED:", err);
  }
}

/* =========================================================
   Bootstrap (inline, so no missing import)
   Uses VITE_API_BASE_URL and calls /api/bootstrap with ID token
   ========================================================= */
async function bootstrapUser() {
  const base = (import.meta.env.VITE_API_BASE_URL || "").trim();
  if (!base) {
    throw new Error("Missing VITE_API_BASE_URL");
  }
  const url = base.endsWith("/") ? `${base}api/bootstrap` : `${base}/api/bootstrap`;

  const u = auth.currentUser;
  if (!u) throw new Error("Not logged in");

  const token = await u.getIdToken();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`bootstrap failed ${res.status}: ${text}`);
  }
  return JSON.parse(text);
}

type ViewState =
  | { type: "admin" }
  | { type: "dashboard" }
  | { type: "domain"; domainName: string }
  | { type: "practice"; practiceId: string }
  | { type: "executive" }
  | { type: "profile" }
  | { type: "savedTemplates" }
  | { type: "templateAssist" }
  | { type: "sprs" }
  | { type: "solutions" }
  | { type: "readinessAnalyzer" }
  | { type: "readinessReports" }
  | { type: "systemSecurityPlan" }
  | { type: "poam" }
  | { type: "responsibilityMatrix" }
  | { type: "training" }
  | { type: "newsUpdates" };

export type ActiveViewInfo =
  | { type: "admin"; name: "admin" }
  | { type: "dashboard"; name: "dashboard" }
  | { type: "domain"; name: string }
  | { type: "practice"; name: string; domainName: string }
  | { type: "executive"; name: "executive" }
  | { type: "profile"; name: "profile" }
  | { type: "savedTemplates"; name: "savedTemplates" }
  | { type: "templateAssist"; name: "templateAssist" }
  | { type: "sprs"; name: "sprs" }
  | { type: "solutions"; name: "solutions" }
  | { type: "readinessAnalyzer"; name: "readinessAnalyzer" }
  | { type: "readinessReports"; name: "readinessReports" }
  | { type: "systemSecurityPlan"; name: "systemSecurityPlan" }
  | { type: "poam"; name: "poam" }
  | { type: "responsibilityMatrix"; name: "responsibilityMatrix" }
  | { type: "training"; name: "training" }
  | { type: "newsUpdates"; name: "newsUpdates" };

/**
 * Auth gate ONLY. No CMMC hooks here (prevents hook-order bugs).
 */
export default function App() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setAuthUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // Auto-bootstrap after login
  useEffect(() => {
    const run = async () => {
      try {
        if (authUser && import.meta.env.VITE_USE_BOOTSTRAP === "true") {
          await bootstrapUser();
        }
      } catch (e) {
        console.error("bootstrap error:", e);
      }
    };
    run();
  }, [authUser]);

  // TEMP: test system/activation read after login
  useEffect(() => {
    if (!authUser) return;
    const t = setTimeout(() => {
      testReadSystemActivation();
    }, 800);
    return () => clearTimeout(t);
  }, [authUser]);

  const handleLogout = async () => {
    await signOut(auth);
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white font-bold">
        LOADING AUTH...
      </div>
    );
  }

  if (!authUser) {
    return <Login />;
  }

  return <AuthedApp onLogout={handleLogout} />;
}

/**
 * Your existing full app, only rendered AFTER login.
 */
function AuthedApp({ onLogout }: { onLogout: () => void }) {
  // Firestore-backed user tier/track
const { loading: userLoading, tier, profile } = useUserProfile();
const ent = profile?.entitlements;
const roles = profile?.roles;

// Admin access = super admin role + entitlement flag
const canAdmin = isSuperAdminRole(roles) && can(ent, "admin_panel");

  const isSuperAdmin = !!profile?.roles?.superAdmin;
const isDev = import.meta.env.DEV;

  // Existing data hooks
  const {
    domains,
    allPractices,
    rawDomains,
    rawPractices,
    highRiskPractices,
    companyProfile,
    practiceRecords,
    practiceRecordMap,
    analyzerAnswers,
    savedReports,
    scores,
    poamItems,
    upgradeSubscription,
    updatePoamItem,
    addPoamItem,
    responsibilityMatrix,
    updateResponsibilityMatrixEntry,
    updateCompanyProfile,
    addUserToCompany,
    storeTemplate,
    getSavedTemplates,
    deleteSavedTemplate,
    updatePracticeNote,
    updateObjectiveRecord,
    applyAnalyzerSuggestion,
    setAnalyzerAnswers,
    runAnalyzer,
    saveReport,
    getDomainCompletion,
    commitMinedRequirement,
    loading,
    practiceMap,
    dataSourceInfo,
  } = useCmmcData();

  const sspData = useSspData();

  // Tier mapping: only TIER_2 gets L2 access (for now)
  const effectiveSubscriptionLevel = tier === "TIER_2" ? "L2" : "L1";

  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  // AI Studio key check (safe in local dev)
  useEffect(() => {
    const checkApiKey = async () => {
      if (!(window as any).aistudio) {
        setHasApiKey(true);
        return;
      }
      const selected = await (window as any).aistudio.hasSelectedApiKey();
      setHasApiKey(selected);
    };
    checkApiKey();
  }, []);

  const handleSelectKey = async () => {
    // @ts-ignore
    await window.aistudio.openSelectKey();
    setHasApiKey(true);
  };

  const [view, setView] = useState<ViewState>({ type: "dashboard" });

  const [isAssistPanelOpen, setIsAssistPanelOpen] = useState(false);
  const [selectedPracticeForAssist, setSelectedPracticeForAssist] = useState<Practice | null>(null);

  const handleAssistClick = useCallback(
    (practiceId: string) => {
      const practice = practiceMap.get(practiceId);
      if (practice) {
        setSelectedPracticeForAssist(practice);
        setIsAssistPanelOpen(true);
      }
    },
    [practiceMap]
  );

  const activeViewInfo = useMemo((): ActiveViewInfo => {
    if (view.type === "admin") return { type: "admin", name: "admin" };
    if (view.type === "dashboard") return { type: "dashboard", name: "dashboard" };
    if (view.type === "domain") return { type: "domain", name: view.domainName };
    if (view.type === "practice") {
      const practice = practiceMap.get(view.practiceId);
      return { type: "practice", name: view.practiceId, domainName: practice?.domainName || "" };
    }
    if (view.type === "executive") return { type: "executive", name: "executive" };
    if (view.type === "profile") return { type: "profile", name: "profile" };
    if (view.type === "savedTemplates") return { type: "savedTemplates", name: "savedTemplates" };
    if (view.type === "templateAssist") return { type: "templateAssist", name: "templateAssist" };
    if (view.type === "sprs") return { type: "sprs", name: "sprs" };
    if (view.type === "solutions") return { type: "solutions", name: "solutions" };
    if (view.type === "readinessAnalyzer") return { type: "readinessAnalyzer", name: "readinessAnalyzer" };
    if (view.type === "readinessReports") return { type: "readinessReports", name: "readinessReports" };
    if (view.type === "systemSecurityPlan") return { type: "systemSecurityPlan", name: "systemSecurityPlan" };
    if (view.type === "poam") return { type: "poam", name: "poam" };
    if (view.type === "responsibilityMatrix") return { type: "responsibilityMatrix", name: "responsibilityMatrix" };
    if (view.type === "training") return { type: "training", name: "training" };
    if (view.type === "newsUpdates") return { type: "newsUpdates", name: "newsUpdates" };
    return { type: "dashboard", name: "dashboard" };
  }, [view, practiceMap]);

  const sprsScore = useMemo(() => {
    const maxScore = 110;
    let penalty = 0;

    SPRS_CONTROLS.forEach((control) => {
      let isControlMet = false;

      if (control.mappedPracticeIds && control.mappedPracticeIds.length > 0) {
        const areAllMappedPracticesMet = control.mappedPracticeIds.every((id) => {
          const record = practiceRecordMap.get(id);
          return record?.status === "met";
        });

        if (areAllMappedPracticesMet) isControlMet = true;
      }

      if (!isControlMet) penalty += Math.abs(control.weight);
    });

    return maxScore - penalty;
  }, [practiceRecordMap]);

  const pageTitle = useMemo(() => {
    if (view.type === "admin") return "Admin Panel";
    if (view.type === "dashboard") return "Command Dashboard";
    if (view.type === "domain") return view.domainName;
    if (view.type === "practice") {
      const p = practiceMap.get(view.practiceId);
      return p ? `Practice: ${p.id}` : "Practice";
    }
    if (view.type === "executive") return "Executive Narrative";
    if (view.type === "profile") return "Company Profile";
    if (view.type === "savedTemplates") return "Saved Templates";
    if (view.type === "templateAssist") return "Template Assist";
    if (view.type === "sprs") return "SPRS Scorecard";
    if (view.type === "solutions") return "Starter Kits";
    if (view.type === "readinessAnalyzer") return "Readiness Analyzer";
    if (view.type === "readinessReports") return "Readiness Vault";
    if (view.type === "systemSecurityPlan") return "System Security Plan";
    if (view.type === "poam") return "Remediation (POA&M)";
    if (view.type === "responsibilityMatrix") return "Responsibility Matrix";
    if (view.type === "training") return "Training Modules";
    if (view.type === "newsUpdates") return "News Updates";
    return "CMMC Launch Hub";
  }, [view, practiceMap]);

  const Breadcrumbs = () => {
    const dashboardButton = (
      <button onClick={() => setView({ type: "dashboard" })} className="hover:underline flex items-center">
        <Home className="h-4 w-4 mr-1" /> Dashboard
      </button>
    );

    if (view.type === "dashboard") return null;

    return (
      <div className="flex items-center text-sm text-gray-500 mb-4 px-2">
        {dashboardButton}

        {view.type === "domain" && (
          <>
            <ChevronRight className="h-4 w-4 mx-1" />
            <span>{view.domainName}</span>
          </>
        )}

        {view.type === "practice" && (
          <>
            <ChevronRight className="h-4 w-4 mx-1" />
            <button
              onClick={() => {
                const practice = practiceMap.get(view.practiceId);
                if (practice) setView({ type: "domain", domainName: practice.domainName });
              }}
              className="hover:underline"
            >
              {practiceMap.get(view.practiceId)?.domainName}
            </button>
            <ChevronRight className="h-4 w-4 mx-1" />
            <span className="font-medium text-gray-700">{practiceMap.get(view.practiceId)?.id}</span>
          </>
        )}

        {[
          "executive",
          "profile",
          "savedTemplates",
          "templateAssist",
          "solutions",
          "sprs",
          "readinessAnalyzer",
          "readinessReports",
          "systemSecurityPlan",
          "poam",
          "responsibilityMatrix",
          "training",
          "newsUpdates",
        ].includes(view.type) && (
          <>
            <ChevronRight className="h-4 w-4 mx-1" />
            <span>{pageTitle}</span>
          </>
        )}
      </div>
    );
  };

  const handleNavClick = (domainName: string) => {
    const domain = rawDomains.find((d) => d.name === domainName);
    const isLevel2OnlyDomain = domain && domain.practices.every((p) => !p.id.includes(".L1-"));

    if (effectiveSubscriptionLevel === "L1" && isLevel2OnlyDomain) {
      setIsUpgradeModalOpen(true);
    } else {
      setView({ type: "domain", domainName });
    }
  };

  const renderContent = () => {
    if (hasApiKey === false) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-white rounded-xl shadow-lg border border-red-100">
          <ShieldAlert className="h-16 w-16 text-red-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Paid API Key Required</h2>
          <p className="text-gray-600 max-w-md mb-6">
            To access Level 2 analysis and advanced tools, you must select a valid API key from a paid GCP project.
          </p>
          <button
            onClick={handleSelectKey}
            className="px-8 py-3 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition shadow-md flex items-center"
          >
            <Key className="h-5 w-5 mr-2" />
            Select API Key
          </button>
        </div>
      );
    }

    switch (view.type) {
      case "admin":
        return <AdminPanel />;
      case "dashboard":
        return (
          <Dashboard
            domains={domains}
            highRiskPractices={highRiskPractices}
            practiceRecords={practiceRecords}
            scores={scores}
            onDomainClick={handleNavClick}
            onPracticeClick={(practiceId) => setView({ type: "practice", practiceId })}
            onResumeAssessment={(id) => setView(id ? { type: "practice", practiceId: id } : { type: "dashboard" })}
            onSecurityAnalyzerClick={() => setView({ type: "readinessAnalyzer" })}
            onReadinessReportsClick={() => setView({ type: "readinessReports" })}
          />
        );

      case "domain": {
        const domain = domains.find((d) => d.name === view.domainName);
        return domain ? (
          <DomainView
            domain={domain}
            practiceRecords={practiceRecords}
            getDomainCompletion={getDomainCompletion}
            onPracticeClick={(id) => {
              const practice = practiceMap.get(id);
              if (effectiveSubscriptionLevel === "L1" && practice && !practice.id.includes(".L1-")) {
                setIsUpgradeModalOpen(true);
              } else {
                setView({ type: "practice", practiceId: id });
              }
            }}
          />
        ) : (
          <div>Domain not found.</div>
        );
      }

      case "practice": {
        const practice = practiceMap.get(view.practiceId);
        const practiceRecord = practiceRecordMap.get(view.practiceId);
        return practice && practiceRecord ? (
          <PracticeView
            practice={practice}
            practiceRecord={practiceRecord}
            onUpdateNote={updatePracticeNote}
            onUpdateObjective={updateObjectiveRecord}
            onApplySuggestion={applyAnalyzerSuggestion}
            onAssistClick={handleAssistClick}
            storeTemplate={storeTemplate}
          />
        ) : (
          <div>Practice not found.</div>
        );
      }

      case "profile":
	return <ProfilePage />;

        // return (
        //   <ProfilePage
        //     companyProfile={companyProfile}
        //     updateCompanyProfile={updateCompanyProfile}
        //     addUserToCompany={addUserToCompany}
       //    />
       //  );

      case "executive":
        return (
          <ExecutiveSummary
            domains={domains}
            practiceRecords={practiceRecords}
            scores={scores}
            getDomainCompletion={getDomainCompletion}
            companyProfile={companyProfile}
          />
        );

      case "savedTemplates":
        return (
          <SavedTemplates
            templates={getSavedTemplates()}
            domains={domains}
            onDelete={deleteSavedTemplate}
            onNavigateToPractice={(id) => setView({ type: "practice", practiceId: id })}
          />
        );

      case "templateAssist":
        return <TemplateAssist domains={domains} storeTemplate={storeTemplate} />;

      case "solutions":
        return <SolutionsView storeTemplate={storeTemplate} />;

      case "readinessAnalyzer":
        return <ReadinessAnalyzerView companyProfile={companyProfile} />;

      case "responsibilityMatrix":
        return (
          <ResponsibilityMatrixPage
            responsibilityMatrix={responsibilityMatrix}
            updateResponsibilityMatrixEntry={updateResponsibilityMatrixEntry}
            allPractices={allPractices}
            companyProfile={companyProfile}
          />
        );

      case "readinessReports":
        return <SavedReportsView savedReports={savedReports} />;

      case "sprs":
        return (
          <SprsScorecard
            domains={domains}
            practiceRecords={practiceRecords}
            scores={scores}
            companyProfile={companyProfile}
            practiceMap={practiceMap}
          />
        );

      case "systemSecurityPlan":
        return (
          <SystemSecurityPlan
            allPractices={allPractices}
            practiceRecords={practiceRecords}
            analyzerAnswers={analyzerAnswers}
            scores={scores}
            sspData={sspData}
            companyProfile={companyProfile}
            responsibilityMatrix={responsibilityMatrix}
          />
        );

      case "poam":
        return (
          <Poam
            poamItems={poamItems}
            allPractices={allPractices}
            companyProfile={companyProfile}
            updatePoamItem={updatePoamItem}
            addPoamItem={addPoamItem}
            responsibilityMatrix={responsibilityMatrix}
          />
        );

      case "training":
        return <TrainingModule />;

      case "newsUpdates":
        return <NewsUpdates />;

      default:
        return <div>Select a view</div>;
    }
  };

  if (userLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white font-bold">
        LOADING USER PROFILE...
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white font-bold">
        <Loader2 className="animate-spin h-10 w-10 mr-4 text-blue-500" />
        LOADING UNIFIED ASSESSMENT DATA...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <AppHeader
        onAdminClick={isSuperAdmin ? () => setView({ type: "admin" }) : undefined}
	onSave={() => {}}
        onSavedTemplatesClick={() => setView({ type: "savedTemplates" })}
        onProfileClick={() => setView({ type: "profile" })}
onDiagnosticsClick={isDev ? () => setIsDiagnosticsOpen(true) : undefined}
        overallCompletion={scores.practiceCompletionScore}
        sprsScore={sprsScore}
        onLogout={onLogout}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          domains={domains}
          subscriptionLevel={effectiveSubscriptionLevel}
          onNavClick={handleNavClick}
          onDashboardClick={() => setView({ type: "dashboard" })}
          activeViewInfo={activeViewInfo}
          onExecutiveSummaryClick={() => setView({ type: "executive" })}
          onTemplateAssistClick={() => setView({ type: "templateAssist" })}
          onSprsClick={() => setView({ type: "sprs" })}
          onSolutionsClick={() => setView({ type: "solutions" })}
          onSecurityAnalyzerClick={() => setView({ type: "readinessAnalyzer" })}
          onReadinessReportsClick={() => setView({ type: "readinessReports" })}
          onSystemSecurityPlanClick={() => setView({ type: "systemSecurityPlan" })}
          onPoamClick={() => setView({ type: "poam" })}
          onResponsibilityMatrixClick={() => setView({ type: "responsibilityMatrix" })}
          onTrainingClick={() => setView({ type: "training" })}
          onNewsUpdatesClick={() => setView({ type: "newsUpdates" })}
          onLockedClick={() => setIsUpgradeModalOpen(true)}
        />

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            <header className="flex justify-between items-center mb-2">
              <h1 className="text-3xl font-bold text-gray-900">{pageTitle}</h1>
            </header>

            <Breadcrumbs />
            {renderContent()}
          </div>

          <div className="mt-12 pt-8 border-t border-gray-200 text-[10px] text-gray-400 flex items-center px-4">
            <Database className="h-3 w-3 mr-2" />
            Data Source: {dataSourceInfo}
          </div>
        </main>

        {selectedPracticeForAssist && (
          <AssistMePanel
            isOpen={isAssistPanelOpen}
            onClose={() => setIsAssistPanelOpen(false)}
            practice={selectedPracticeForAssist}
          />
        )}
      </div>

      <DiagnosticsDrawer
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
        domains={rawDomains}
        allPractices={rawPractices}
        dataSourceInfo={dataSourceInfo}
        subscriptionLevel={effectiveSubscriptionLevel}
        onUpgrade={() => setIsUpgradeModalOpen(true)}
        onCommitMinedRequirement={commitMinedRequirement}
      />

      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        onUpgrade={upgradeSubscription}
      />

      <AppFooter />
    </div>
  );
}

/* =========================================================
   Minimal Login component (keeps your app from breaking)
   ========================================================= */
function Login() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");
    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email, password);
        setMsg("✅ Logged in");
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
        setMsg("✅ Registered + logged in");
      }
    } catch (err: any) {
      setMsg(`❌ ${err?.message || "Unknown error"}`);
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: "40px auto", padding: 20, border: "1px solid #ddd", borderRadius: 12 }}>
      <h2 style={{ marginBottom: 10 }}>CMMC Launch Hub</h2>
      <p style={{ marginTop: 0, color: "#555" }}>
        {mode === "login" ? "Login" : "Create account"} (Email/Password)
      </p>

      <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
        />
        <input
          placeholder="Password (6+ chars)"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
        />

        <button type="submit" style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}>
          {mode === "login" ? "Login" : "Register"}
        </button>

        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
          style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}
        >
          Switch to {mode === "login" ? "Register" : "Login"}
        </button>

        {msg && <div style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{msg}</div>}
      </form>
    </div>
  );
}
