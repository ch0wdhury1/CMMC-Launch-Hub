import React, { useState, useCallback, useMemo, useEffect } from "react";

import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./src/firebase";

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

import { onAuthStateChanged, User, signOut } from "firebase/auth";

import { useUserProfile } from "./src/useUserProfile";
import { useCmmcData } from "./hooks/useCmmcData";
import { useSspData } from "./hooks/useSspData";

import { Practice } from "./types";
import { SPRS_CONTROLS } from "./data/sprsControls";

import { Home, ChevronRight, Key, ShieldAlert, Database, Loader2 } from "lucide-react";

/* =========================================================
   TEMP DEBUG: system/activation read test
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

/* ========================================================= */

type ViewState =
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
 * AUTH GATE — nothing else here
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

  // 🔍 TEMP: test system/activation AFTER login
  useEffect(() => {
    if (authUser) {
      setTimeout(() => {
        testReadSystemActivation();
      }, 800);
    }
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
 * FULL APP — unchanged logic
 */
function AuthedApp({ onLogout }: { onLogout: () => void }) {
  const { loading: userLoading, tier } = useUserProfile();

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
    error,
    practiceMap,
    dataSourceInfo,
  } = useCmmcData();

  const sspData = useSspData();

  const effectiveSubscriptionLevel = tier === "TIER_2" ? "L2" : "L1";

  /* ───── rest of your file is UNCHANGED ───── */
  /* (Everything below stays exactly as you had it) */

  // ⬇️ KEEP YOUR EXISTING CODE HERE ⬇️
  // Nothing else needs modification
}
