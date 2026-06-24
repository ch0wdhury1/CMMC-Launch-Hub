import React, { useState, useCallback, useMemo, useEffect } from "react";

import {doc, getDoc, addDoc, collection, serverTimestamp, setDoc} from "firebase/firestore";
import {
  onAuthStateChanged,
  User,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth, db } from "./src/firebase";

import { can, isSuperAdmin as isSuperAdminRole } from "./src/access";

import { SuperAdminPanel } from "./components/SuperAdminPanel";

import { AdminPanel } from "./components/AdminPanel";
import { Sidebar } from "./components/Sidebar";
import { OrganizationDashboard } from "./components/OrganizationDashboard";
import { DomainView } from "./components/DomainView";
import { PracticeView } from "./components/PracticeView";
import { AssistMePanel } from "./components/AssistMePanel";
import { ExecutiveReadinessReport } from "./components/ExecutiveReadinessReport";
import { AppHeader } from "./components/AppHeader";
import { AppFooter } from "./components/AppFooter";
import { ProfilePage } from "./components/ProfilePage";
import { SavedTemplates } from "./components/SavedTemplates";
import { EvidenceLibrary } from "./components/EvidenceLibrary";
import { OrgInvitations } from "./components/OrgInvitations";
import { TemplateAssist } from "./components/TemplateAssist";
import { SprsScorecard } from "./components/SprsScorecard";
import { SolutionsView } from "./components/SolutionsView";
import { ReadinessAnalyzerView } from "./components/readiness/ReadinessAnalyzerView";
import { SavedReportsView } from "./components/readiness/SavedReportsView";
import { SystemSecurityPlan } from "./components/SystemSecurityPlan";
import { Poam } from "./components/Poam";
import { PoamReport } from "./components/PoamReport";
import { ActivityCenter } from "./components/ActivityCenter";
import { SystemHealthDashboard } from "./components/SystemHealthDashboard";
import { FeedbackButton } from "./components/FeedbackButton";
import { PilotParticipantBanner } from "./components/PilotParticipantBanner";
import { SupportPage } from "./components/SupportPage";
import { SuperAdminFeedbackReview } from "./components/SuperAdminFeedbackReview";
import { PilotDashboard } from "./components/PilotDashboard";
import { PendingActionsPage } from "./components/PendingActionsPage";
import { SponsorObserversManager } from "./components/SponsorObserversManager";
import { SponsorLayout } from "./components/SponsorLayout";
import { SponsorParticipantsPage } from "./components/SponsorParticipantsPage";
import { SponsorParticipantDetailPage } from "./components/SponsorParticipantDetailPage";
import { SponsorRecentActivityPage } from "./components/SponsorRecentActivityPage";
import { SponsorProfilePage } from "./components/SponsorProfilePage";
import { ProgramManagementPage } from "./components/ProgramManagementPage";
import { ResponsibilityMatrixPage } from "./components/ResponsibilityMatrixPage";
import { TrainingModule } from "./components/training/TrainingModule";
import { NewsUpdates } from "./components/NewsUpdates";
import { DiagnosticsDrawer } from "./components/DiagnosticsDrawer";
import { UpgradeModal } from "./components/UpgradeModal";
import { LOCAL_STORAGE_KEY, READINESS_ANALYZER_KEY, SAVED_REPORTS_KEY, SAVED_TEMPLATES_KEY, SSP_PROFILE_KEY } from "./constants";

import { useUserProfile } from "./src/useUserProfile";
import { useCmmcData } from "./hooks/useCmmcData";
import { useSspData } from "./hooks/useSspData";

import { Practice } from "./types";
import { SPRS_CONTROLS } from "./data/sprsControls";
import { subscribeActiveOrgMembers, type ActiveOrgMember } from "./src/responsibilityAssignments";
import { logActivityEvent } from "./src/activityLog";
import { createTierUpgradeRequest } from "./src/orgUpgradeRequests";

import { Home, ChevronRight, Key, ShieldAlert, Database, Loader2 } from "lucide-react";

const PASSWORD_RESET_SUCCESS_MESSAGE = "If an account exists for this email, a password reset link has been sent.";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const QUICK_START_GUIDE_URL = "/user-guides/CMMC_Launch_Hub_Quick_Start_Guide_v1.0.pdf";

const friendlyLoginError = (error: any): string => {
  const code = String(error?.code || error?.message || "").toLowerCase();
  if (code.includes("too-many-requests")) return "Too many login attempts. Please wait and try again or reset your password.";
  if (code.includes("network") || code.includes("unavailable") || code.includes("timeout")) return "Unable to sign in right now. Please check your connection and try again.";
  if (code.includes("invalid-email")) return "Please enter a valid email address.";
  if (
    code.includes("wrong-password")
    || code.includes("invalid-credential")
    || code.includes("invalid-login-credentials")
    || code.includes("user-not-found")
  ) return "Invalid email or password.";
  return "Unable to sign in right now. Please check your connection and try again.";
};

const friendlyPasswordResetError = (error: any): string | null => {
  const code = String(error?.code || error?.message || "").toLowerCase();
  if (code.includes("invalid-email")) return "Please enter a valid email address.";
  if (code.includes("user-not-found")) return null;
  if (code.includes("network") || code.includes("unavailable") || code.includes("timeout")) return "Unable to send a reset link right now. Please check your connection and try again.";
  return "Unable to send a reset link right now. Please try again.";
};


/* =========================================================
   TEMP: system/activation read test (console-only)
   SuperAdmin ONLY
   ========================================================= */
async function testReadSystemActivation() {
  try {
    const u = auth.currentUser;
    if (!u) {
      console.log("⚠️ [system/activation] Not logged in yet");
      return;
    }

    // ✅ Gate by Firestore user doc roles.superAdmin
    const userSnap = await getDoc(doc(db, "users", u.uid));
    const roles = userSnap.exists() ? (userSnap.data() as any)?.roles : null;
    const isSuperAdmin = roles?.superAdmin === true;

    if (!isSuperAdmin) {
      console.log("ℹ️ [system/activation] Skipped (not superAdmin)");
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
  | { type: "superAdmin" }
  | { type: "pilotDashboard" }
  | { type: "sponsorObservers" }
  | { type: "sponsorParticipants" }
  | { type: "sponsorParticipantDetail"; orgId: string }
  | { type: "sponsorActivity" }
  | { type: "sponsorProfile" }
  | { type: "pendingActions" }
  | { type: "programs" }
  | { type: "dashboard" }
  | { type: "domain"; domainName: string }
  | { type: "practice"; practiceId: string }
  | { type: "executive" }
  | { type: "profile" }
  | { type: "savedTemplates" }
  | { type: "evidenceLibrary" }
  | { type: "orgInvitations" }
  | { type: "templateAssist" }
  | { type: "sprs" }
  | { type: "solutions" }
  | { type: "readinessAnalyzer" }
  | { type: "readinessReports" }
  | { type: "systemSecurityPlan" }
  | { type: "poam" }
  | { type: "poamReport" }
  | { type: "activityCenter" }
  | { type: "systemHealth" }
  | { type: "feedbackReview" }
  | { type: "support" }
  | { type: "responsibilityMatrix" }
  | { type: "training" }
  | { type: "newsUpdates" };

export type ActiveViewInfo =
  | { type: "admin"; name: "admin" }
  | { type: "superAdmin"; name: "superAdmin" }
  | { type: "pilotDashboard"; name: "pilotDashboard" }
  | { type: "sponsorObservers"; name: "sponsorObservers" }
  | { type: "sponsorParticipants"; name: "sponsorParticipants" }
  | { type: "sponsorParticipantDetail"; name: "sponsorParticipantDetail" }
  | { type: "sponsorActivity"; name: "sponsorActivity" }
  | { type: "sponsorProfile"; name: "sponsorProfile" }
  | { type: "pendingActions"; name: "pendingActions" }
  | { type: "programs"; name: "programs" }
  | { type: "dashboard"; name: "dashboard" }
  | { type: "domain"; domainName: string; label: string }
  | { type: "practice"; name: string; domainName: string }
  | { type: "executive"; name: "executive" }
  | { type: "profile"; name: "profile" }
  | { type: "savedTemplates"; name: "savedTemplates" }
  | { type: "evidenceLibrary"; name: "evidenceLibrary" }
  | { type: "orgInvitations"; name: "orgInvitations" }
  | { type: "templateAssist"; name: "templateAssist" }
  | { type: "sprs"; name: "sprs" }
  | { type: "solutions"; name: "solutions" }
  | { type: "readinessAnalyzer"; name: "readinessAnalyzer" }
  | { type: "readinessReports"; name: "readinessReports" }
  | { type: "systemSecurityPlan"; name: "systemSecurityPlan" }
  | { type: "poam"; name: "poam" }
  | { type: "poamReport"; name: "poamReport" }
  | { type: "activityCenter"; name: "activityCenter" }
  | { type: "systemHealth"; name: "systemHealth" }
  | { type: "feedbackReview"; name: "feedbackReview" }
  | { type: "support"; name: "support" }
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
    // TEMP: Firestore connection debug
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      console.log("🔥 Firestore host/ssl =", (db as any)?._settings?.host, (db as any)?._settings?.ssl);
    } catch {}
    const unsub = onAuthStateChanged(auth, (u) => {
      setAuthUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  const handleLogout = async () => {
    [LOCAL_STORAGE_KEY, SAVED_TEMPLATES_KEY, READINESS_ANALYZER_KEY, SAVED_REPORTS_KEY, SSP_PROFILE_KEY]
      .forEach(key => localStorage.removeItem(key));
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
    return <PublicAuthRouter />;
  }

  return <AuthorizedAppGate authUser={authUser} onLogout={handleLogout} />;
}

type AccessGateState =
  | { status: "loading" }
  | { status: "authorized" }
  | { status: "pending"; message: string }
  | { status: "disabled"; message: string };

function AuthorizedAppGate({ authUser, onLogout }: { authUser: User; onLogout: () => void }) {
  const [access, setAccess] = useState<AccessGateState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const userSnap = await getDoc(doc(db, "users", authUser.uid));
        const user = userSnap.exists() ? userSnap.data() as any : null;
        if (!user || user.status !== "active") {
          const missingMetadataMessage = "Your account setup is incomplete. Contact platform support to finish account activation.";
          if (!cancelled) setAccess({
            status: user?.status === "pending" || !user ? "pending" : "disabled",
            message: !user
              ? missingMetadataMessage
              : user?.status === "pending"
              ? "Your registration is pending approval."
              : "Your account is inactive or disabled. Contact your organization administrator.",
          });
          return;
        }
        if (user.roles?.superAdmin === true || user.roles?.pilotObserver === true || user.roles?.programObserver === true) {
          if (!cancelled) setAccess({ status: "authorized" });
          const observerAccess = user.roles?.pilotObserver === true || user.roles?.programObserver === true;
          void logActivityEvent({
            orgId: typeof user.orgId === "string" && user.orgId.trim() ? user.orgId.trim() : "superadmin",
            orgName: observerAccess ? "Pilot Oversight" : "SuperAdmin",
            action: "login.succeeded",
            actorUid: authUser.uid,
            actorEmail: authUser.email || user.email || "",
            actorName: user.displayName || user.fullName || authUser.displayName || "",
            targetType: "auth",
            targetId: authUser.uid,
            summary: observerAccess ? "Sponsor observer login succeeded" : "SuperAdmin login succeeded",
          });
          return;
        }
        const orgId = typeof user.orgId === "string" ? user.orgId.trim() : "";
        if (!orgId) {
          if (!cancelled) setAccess({ status: "disabled", message: "Your account is inactive or disabled. Contact your organization administrator." });
          return;
        }
        const [orgSnap, memberSnap] = await Promise.all([
          getDoc(doc(db, "orgs", orgId)),
          getDoc(doc(db, "orgs", orgId, "members", authUser.uid)),
        ]);
        const org = orgSnap.data() as any;
        const member = memberSnap.data() as any;
        const allowed = orgSnap.exists()
          && org?.status === "active"
          && memberSnap.exists()
          && member?.status === "active"
          && member?.active === true
          && typeof member?.role === "string"
          && member.role.length > 0;
        if (allowed) {
          void logActivityEvent({
            orgId,
            orgName: org?.companyProfile?.legalName || org?.name || orgId,
            action: "login.succeeded",
            actorUid: authUser.uid,
            actorEmail: authUser.email || user.email || "",
            actorName: user.displayName || user.fullName || member?.displayName || member?.fullName || authUser.displayName || "",
            targetType: "auth",
            targetId: authUser.uid,
            summary: "Login succeeded",
            metadata: { role: member.role },
          });
        }
        if (!cancelled) setAccess(allowed
          ? { status: "authorized" }
          : { status: "disabled", message: "Your account is inactive or disabled. Contact your organization administrator." });
      } catch (error) {
        console.warn("[access-gate] access validation failed", error);
        if (!cancelled) setAccess({ status: "disabled", message: "Unable to verify organization access. Contact your organization administrator." });
      }
    })();
    return () => { cancelled = true; };
  }, [authUser.uid]);

  if (access.status === "loading") {
    return <div className="flex items-center justify-center h-screen bg-gray-900 text-white font-bold">VERIFYING ACCESS...</div>;
  }
  if (access.status !== "authorized") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 p-6">
        <div className="max-w-lg rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
          <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-amber-500" />
          <h1 className="text-xl font-bold text-gray-900">{access.status === "pending" ? "Account Pending Approval" : "Access Disabled"}</h1>
          <p className="mt-3 text-sm text-gray-600">{access.message}</p>
          <button type="button" onClick={onLogout} className="mt-6 rounded bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800">Back to Login</button>
        </div>
      </div>
    );
  }
  return <AuthedApp onLogout={onLogout} />;
}

/**
 * Your existing full app, only rendered AFTER login.
 */
function AuthedApp({ onLogout }: { onLogout: () => void }) {
  // Firestore-backed user profile (users/{uid})
  const { loading: userLoading, tier, profile } = useUserProfile();

  // Org lookup (orgs/{orgId}) is the source of truth for tiering
  const [orgTier, setOrgTier] = useState<string | null>(null);
  const [orgStatus, setOrgStatus] = useState<string | null>(null);
  const [orgLoading, setOrgLoading] = useState(false);
  const profileOrgId = String((profile as any)?.orgId || "");
  const profileUserStatus = String((profile as any)?.status || "");
  const profileRoles = (profile as any)?.roles || {};
  const profileOrgRole = String(profileRoles?.orgRole || "");
  const profileIsSuperAdmin = profileRoles?.superAdmin === true;
  const profileIsPilotObserver = profileRoles?.pilotObserver === true;
  const profileIsProgramObserver = profileRoles?.programObserver === true;

  useEffect(() => {
    const orgId = profileOrgId; // user doc has top-level orgId

    // IMPORTANT:
    // Pending/unapproved users may have an orgId but do NOT have permission to read /orgs/{orgId} yet.
    // Avoid noisy "Missing or insufficient permissions" errors by only loading org when user is active
    // and has an org role (or is super admin).
    const userStatus = profileUserStatus; // "active" | "pending" | etc
    const isSA = profileIsSuperAdmin;
    const isObserver = profileIsPilotObserver || profileIsProgramObserver;
    const hasOrgRole = !!profileOrgRole;

    if (isObserver || !orgId || (!isSA && !hasOrgRole) || (userStatus && userStatus !== "active")) {
      setOrgTier(null);
      setOrgStatus(userStatus ?? null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setOrgLoading(true);
        const snap = await getDoc(doc(db, "orgs", orgId));
        if (!snap.exists()) {
          if (!cancelled) {
            setOrgTier(null);
            setOrgStatus(null);
          }
          return;
        }
        const o = snap.data() as any;
        if (!cancelled) {
          setOrgTier(o?.tier ?? null); // e.g. "COMM_L2"
          setOrgStatus(o?.subscriptionStatus ?? "active");
        }
      } catch (e) {
        console.error("org load failed", e);
        if (!cancelled) {
          setOrgTier(null);
          setOrgStatus(null);
        }
      } finally {
        if (!cancelled) setOrgLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profileIsPilotObserver, profileIsProgramObserver, profileIsSuperAdmin, profileOrgId, profileOrgRole, profileUserStatus]);

  const ent = profile?.entitlements;

  // ✅ Role flags (users/{uid}.roles)
  const rolesAny: any = (profile as any)?.roles || {};
  const isSuperAdmin = rolesAny?.superAdmin === true;
  const isPilotObserver = rolesAny?.pilotObserver === true;
  const isProgramObserver = rolesAny?.programObserver === true;
  const isSponsorObserver = isPilotObserver || isProgramObserver;
  const orgRole = rolesAny?.orgRole;
  const isOrgAdmin = orgRole === "orgAdmin";



// ✅ TEMP: system/activation read test — superAdmin only

useEffect(() => {
  console.log("[system/activation] gate check", { isSuperAdmin });

  if (!isSuperAdmin) return;

  const t = setTimeout(() => {
    testReadSystemActivation();
  }, 800);

  return () => clearTimeout(t);
}, [isSuperAdmin]);




  // NOTE: legacy helper-based admin gating retained for compatibility (currently unused)
  const canAdmin = isSuperAdminRole(rolesAny) && can(ent, "admin_panel");

  // ✅ Effective subscription level for Sidebar gating
  // Priority: org tier -> (optional) user tier -> default COMM_L1
  const effectiveSubscriptionLevel =
    orgStatus === "active" ? (orgTier ?? (tier as any) ?? "COMM_L1") : "COMM_L1";

  const hasL2 = effectiveSubscriptionLevel === "COMM_L2";
  const currentOrgId = (profile as any)?.orgId || null;
  const currentUid = auth.currentUser?.uid || (profile as any)?.uid || null;
  const firestoreAssessmentsEnabled =
    String(import.meta.env.VITE_FIRESTORE_ASSESSMENTS || "false").toLowerCase() === "true";
  const currentAssessmentId = hasL2 ? "default_l2" : "default_l1";
  const canManageEvidence = isSuperAdmin || ["orgOwner", "orgAdmin", "assessor", "contributor"].includes(orgRole || "");
  const canAssignResponsibilities = isSuperAdmin || ["orgOwner", "orgAdmin", "assessor", "contributor"].includes(orgRole || "");
  const [activeOrgMembers, setActiveOrgMembers] = useState<ActiveOrgMember[]>([]);

  useEffect(() => {
    if (!firestoreAssessmentsEnabled || !currentOrgId) {
      setActiveOrgMembers([]);
      return;
    }

    return subscribeActiveOrgMembers(
      currentOrgId,
      setActiveOrgMembers,
      error => console.warn("[responsibilityAssignments] active org members load failed", error),
    );
  }, [currentOrgId, firestoreAssessmentsEnabled]);

  const assignmentContext = firestoreAssessmentsEnabled && currentUid ? {
    members: activeOrgMembers,
    uid: currentUid,
    canAssign: canAssignResponsibilities,
  } : undefined;












const getDomainDisplayLabel = (domainKey: string) => {
  // L2 token: "__L2__:AC"
  if (domainKey.startsWith("__L2__:")) {
    const id = domainKey.replace("__L2__:", "").trim();
    const match = l2DomainsMap.get(id);
    return match?.name ?? `Level 2 (${id})`;
  }

  // L1 (your current path uses domain.name as the key)
  const d = domains.find((x: any) => x?.name === domainKey);
  return d?.name ?? domainKey;
};






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
    evidenceSummary,
    recoveryDiagnostics,
    poamItems,
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
    updatePracticeAssignment,
    updateObjectiveRecord,
    archiveEvidence,
    applyAnalyzerSuggestion,
    setAnalyzerAnswers,
    runAnalyzer,
    saveReport,
    saveAssessment,
    getDomainCompletion,
    commitMinedRequirement,
    loading,
    practiceMap,
    dataSourceInfo,
  } = useCmmcData({
    orgId: currentOrgId,
    uid: currentUid,
    actorEmail: auth.currentUser?.email || (profile as any)?.email || "",
    firestoreEnabled: firestoreAssessmentsEnabled,
    assessmentLevel: effectiveSubscriptionLevel,
  });
  const [assessmentSaveStatus, setAssessmentSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [assessmentSaveMessage, setAssessmentSaveMessage] = useState("");

  const handleSaveAssessment = useCallback(async () => {
    setAssessmentSaveStatus("saving");
    setAssessmentSaveMessage("");
    try {
      await saveAssessment();
      setAssessmentSaveStatus("saved");
      window.setTimeout(() => setAssessmentSaveStatus("idle"), 1800);
    } catch (saveError) {
      console.error("Assessment save failed:", saveError);
      setAssessmentSaveStatus("error");
      setAssessmentSaveMessage(saveError instanceof Error ? saveError.message : "Assessment save failed.");
    }
  }, [saveAssessment]);

  const sspData = useSspData();

  // Build L2 domain/practice maps (for L2 navigation + PracticeView)

  // ---- Static Level 2 dataset (from public/cmmc_l2_prepop.json) ----
  const [l2Static, setL2Static] = useState<any | null>(null);

  const l2DomainById = useMemo(() => {
    const map: Record<string, any> = {};
    const domains = l2Static?.domains ?? [];
    for (const d of domains) map[d.domain_id] = d;
    return map;
  }, [l2Static]);

  const l2PracticeMap = useMemo(() => {
    const m = new Map<string, any>();
    const rawDomains = (l2Static as any)?.domains;

    if (!Array.isArray(rawDomains)) return m;

    for (const d of rawDomains) {
      const domainId = String(d?.domain_id ?? "").trim();
      const domainName = String(d?.domain_name ?? domainId).trim();

      const practices = Array.isArray(d?.practices) ? d.practices : [];
      for (const p of practices) {
        const pid = String(p?.requirementId ?? "").trim();
        if (!pid) continue;

        const title = String(p?.requirementName ?? "").trim();
        const statement = String(p?.requirementStatement ?? "").trim();

        // --- Assessment objectives (L2) ---
        const assessmentObjectivesRaw = Array.isArray(p?.assessmentObjectives) ? p.assessmentObjectives : [];
        const assessmentObjectives = assessmentObjectivesRaw
          .map((o: any) => ({
            id: String(o?.objectiveId ?? "").trim(),
            statement: String(o?.determinationStatement ?? o?.statement ?? "").trim(),
          }))
          .filter((o: any) => o.id || o.statement);

        // --- Discussion fields (L2) ---
        const discussion = String(p?.discussion ?? "").trim();
        const furtherDiscussion = String(p?.furtherDiscussion ?? "").trim();

        // --- References (L2) ---
        const referencesRaw = Array.isArray(p?.references) ? p.references : [];
        const references = referencesRaw.map((r: any) => String(r)).filter(Boolean);

        // Some parts of the UI expect a single "name" field.
        const name = title ? `${pid} – ${title}` : pid;

        // Provide both camelCase and snake_case to stay compatible with older UI code.
        m.set(pid, {
          id: pid,
          name,
          title,
          description: statement,
          statement,
          domainId,
          domainName,

          assessmentObjectives,          // camelCase
          assessment_objectives: assessmentObjectives, // snake_case alias

          discussion,
          furtherDiscussion,

          references,
          keyReferences: references,     // alias used in some builds

          // L2 JSON doesn’t include explicit methods/objects; keep a stable default so UI doesn't look empty.
          potentialAssessmentMethods:
            "Examine: policies, procedures, system configs, and evidence artifacts. Interview: system owners/admins. Test: enforcement mechanisms for the requirement.",
          potentialAssessmentObjects:
            "Policies, procedures, audit logs, screenshots/config exports, tickets/change records, access reviews, training records, and other supporting artifacts.",
        });
      }
    }

    return m;
  }, [l2Static]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/cmmc_l2_prepop.json", { cache: "no-cache" });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setL2Static(json);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);


  const l2Domains = useMemo(() => {
    const raw = l2Static?.domains;
    if (!Array.isArray(raw)) return [];
    return raw.map((d: any) => ({
      id: d.domain_id,
      name: /\([^)]+\)\s*$/.test(String(d.domain_name ?? ""))
        ? String(d.domain_name)
        : `${d.domain_name} (${d.domain_id})`,
      description: d.domain_description,
      practices: Array.isArray(d.objectives)
        ? d.objectives.map((o: any) => ({
            id: o.objective_id,
            title: o.objective_name,
            description: o.objective_statement,
            statement: o.objective_statement,
            domainId: d.domain_id,
          }))
        : [],
    }));
  }, [l2Static]);


const l2DomainsMap = useMemo(() => {
  const m = new Map<string, { id: string; name: string }>();
  l2Domains.forEach((d: any) => {
    if (d?.id) m.set(String(d.id), { id: String(d.id), name: String(d.name ?? d.id) });
  });
  return m;
}, [l2Domains]);




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
  const [feedbackTrigger, setFeedbackTrigger] = useState(0);

  const sponsorViewFromPath = useCallback((): ViewState => {
    const path = window.location.pathname;
    const detailMatch = path.match(/^\/sponsor\/participants\/([^/?#]+)/);
    if (detailMatch?.[1]) return { type: "sponsorParticipantDetail", orgId: decodeURIComponent(detailMatch[1]) };
    if (path === "/sponsor/participants") return { type: "sponsorParticipants" };
    if (path === "/sponsor/activity") return { type: "sponsorActivity" };
    if (path === "/sponsor/profile") return { type: "sponsorProfile" };
    return { type: "pilotDashboard" };
  }, []);

  const sponsorPathForView = useCallback((nextView: ViewState) => {
    if (nextView.type === "sponsorParticipants") return "/sponsor/participants";
    if (nextView.type === "sponsorParticipantDetail") return `/sponsor/participants/${encodeURIComponent(nextView.orgId)}`;
    if (nextView.type === "sponsorActivity") return "/sponsor/activity";
    if (nextView.type === "sponsorProfile") return "/sponsor/profile";
    return "/sponsor";
  }, []);

  const setSponsorView = useCallback((nextView: ViewState, replace = false) => {
    setView(nextView);
    const nextPath = sponsorPathForView(nextView);
    if (window.location.pathname !== nextPath) {
      const method = replace ? "replaceState" : "pushState";
      window.history[method](null, "", nextPath);
    }
  }, [sponsorPathForView]);

  useEffect(() => {
    if (!isSponsorObserver || isSuperAdmin) return;
    const allowed = ["pilotDashboard", "sponsorParticipants", "sponsorParticipantDetail", "sponsorActivity", "sponsorProfile"].includes(view.type);
    if (!allowed) {
      setSponsorView(sponsorViewFromPath(), true);
    }
  }, [isSponsorObserver, isSuperAdmin, setSponsorView, sponsorViewFromPath, view.type]);

  useEffect(() => {
    if (!isSponsorObserver || isSuperAdmin) return;
    setSponsorView(sponsorViewFromPath(), true);
    const onPopState = () => setView(sponsorViewFromPath());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [isSponsorObserver, isSuperAdmin, setSponsorView, sponsorViewFromPath]);

  // Load Level 2 static dataset (from /public)


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
    if (view.type === "superAdmin") return { type: "superAdmin", name: "superAdmin" };
    if (view.type === "pilotDashboard") return { type: "pilotDashboard", name: "pilotDashboard" };
    if (view.type === "sponsorObservers") return { type: "sponsorObservers", name: "sponsorObservers" };
    if (view.type === "sponsorParticipants") return { type: "sponsorParticipants", name: "sponsorParticipants" };
    if (view.type === "sponsorParticipantDetail") return { type: "sponsorParticipantDetail", name: "sponsorParticipantDetail" };
    if (view.type === "sponsorActivity") return { type: "sponsorActivity", name: "sponsorActivity" };
    if (view.type === "sponsorProfile") return { type: "sponsorProfile", name: "sponsorProfile" };
    if (view.type === "pendingActions") return { type: "pendingActions", name: "pendingActions" };
    if (view.type === "programs") return { type: "programs", name: "programs" };
    if (view.type === "dashboard") return { type: "dashboard", name: "dashboard" };

    // if (view.type === "domain") return { type: "domain", name: view.domainName };

    if (view.type === "domain") {
      return {
        type: "domain",
        domainName: view.domainName,
        label: getDomainDisplayLabel(view.domainName),
      };
    }

    if (view.type === "practice") {
      const practice = (typeof view.practiceId === "string" && view.practiceId.includes(".L2-")
          ? l2PracticeMap.get(view.practiceId)
          : practiceMap.get(view.practiceId));
      return { type: "practice", name: view.practiceId, domainName: practice?.domainName || "" };
    }
    if (view.type === "executive") return { type: "executive", name: "executive" };
    if (view.type === "profile") return { type: "profile", name: "profile" };
    if (view.type === "savedTemplates") return { type: "savedTemplates", name: "savedTemplates" };
    if (view.type === "evidenceLibrary") return { type: "evidenceLibrary", name: "evidenceLibrary" };
    if (view.type === "orgInvitations") return { type: "orgInvitations", name: "orgInvitations" };
    if (view.type === "templateAssist") return { type: "templateAssist", name: "templateAssist" };
    if (view.type === "sprs") return { type: "sprs", name: "sprs" };
    if (view.type === "solutions") return { type: "solutions", name: "solutions" };
    if (view.type === "readinessAnalyzer") return { type: "readinessAnalyzer", name: "readinessAnalyzer" };
    if (view.type === "readinessReports") return { type: "readinessReports", name: "readinessReports" };
    if (view.type === "systemSecurityPlan") return { type: "systemSecurityPlan", name: "systemSecurityPlan" };
    if (view.type === "poam") return { type: "poam", name: "poam" };
    if (view.type === "poamReport") return { type: "poamReport", name: "poamReport" };
    if (view.type === "responsibilityMatrix") return { type: "responsibilityMatrix", name: "responsibilityMatrix" };
    if (view.type === "activityCenter") return { type: "activityCenter", name: "activityCenter" };
    if (view.type === "systemHealth") return { type: "systemHealth", name: "systemHealth" };
    if (view.type === "feedbackReview") return { type: "feedbackReview", name: "feedbackReview" };
    if (view.type === "support") return { type: "support", name: "support" };
    if (view.type === "training") return { type: "training", name: "training" };
    if (view.type === "newsUpdates") return { type: "newsUpdates", name: "newsUpdates" };
    return { type: "dashboard", name: "dashboard" };
  }, [view, practiceMap, l2PracticeMap, l2DomainsMap, domains]);

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

  const organizationDisplayName = String(
    (companyProfile as any)?.legalName
    || companyProfile?.companyName
    || (profile as any)?.orgName
    || currentOrgId
    || "Your Organization"
  );

  const handleUpgradeRequest = useCallback(async (): Promise<"submitted" | "already-pending" | "already-l2"> => {
    if (effectiveSubscriptionLevel === "COMM_L2") return "already-l2";
    if (!currentOrgId || !currentUid) throw new Error("Current organization is unavailable.");
    try {
      const requestId = await createTierUpgradeRequest({
        orgId: currentOrgId,
        orgName: organizationDisplayName,
        currentTier: effectiveSubscriptionLevel || "COMM_L1",
        requestedByUid: currentUid,
        requestedByEmail: auth.currentUser?.email || (profile as any)?.email || "",
        requestedByName: auth.currentUser?.displayName || (profile as any)?.displayName || (profile as any)?.fullName || "",
      });
      void logActivityEvent({
        orgId: currentOrgId,
        orgName: organizationDisplayName,
        action: "tier.requested",
        actorUid: currentUid,
        actorEmail: auth.currentUser?.email || (profile as any)?.email || "",
        actorName: auth.currentUser?.displayName || (profile as any)?.displayName || (profile as any)?.fullName || "",
        targetType: "accessRequest",
        targetId: requestId,
        targetLabel: "COMM_L2",
        summary: `Tier upgrade requested from ${effectiveSubscriptionLevel || "COMM_L1"} to COMM_L2`,
        metadata: {currentTier: effectiveSubscriptionLevel || "COMM_L1", requestedTier: "COMM_L2"},
      });
      return "submitted";
    } catch (error) {
      if (error instanceof Error && error.message.toLowerCase().includes("pending")) {
        return "already-pending";
      }
      throw error;
    }
  }, [currentOrgId, currentUid, effectiveSubscriptionLevel, organizationDisplayName, profile]);

  const pageTitle = useMemo(() => {
    if (view.type === "admin") return "Admin Panel";
    if (view.type === "superAdmin") return "Super Admin";
    if (view.type === "pilotDashboard") return "CMMC Pilot Dashboard";
    if (view.type === "sponsorObservers") return "Sponsor Observers";
    if (view.type === "sponsorParticipants") return "Sponsor Participants";
    if (view.type === "sponsorParticipantDetail") return "Sponsor Participant Detail";
    if (view.type === "sponsorActivity") return "Sponsor Recent Activity";
    if (view.type === "sponsorProfile") return "Sponsor Profile";
    if (view.type === "programs") return "Programs";
    if (view.type === "pendingActions") return "Pending Actions";
    if (view.type === "dashboard") return "Command Dashboard";
    if (view.type === "domain") return getDomainDisplayLabel(view.domainName);
    if (view.type === "practice") {
      const p = (typeof view.practiceId === "string" && view.practiceId.includes(".L2-")
        ? l2PracticeMap.get(view.practiceId)
        : practiceMap.get(view.practiceId));
      return p ? `Practice: ${p.id}` : "Practice";
    }
    if (view.type === "executive") return "Executive Readiness Report";
    if (view.type === "profile") return "Company Profile";
    if (view.type === "savedTemplates") return "Saved Templates";
    if (view.type === "evidenceLibrary") return "Evidence Library";
    if (view.type === "orgInvitations") return "Organization Invitations";
    if (view.type === "templateAssist") return "Template Assist";
    if (view.type === "sprs") return "SPRS Scorecard";
    if (view.type === "solutions") return "Starter Kits";
    if (view.type === "readinessAnalyzer") return "Readiness Analyzer";
    if (view.type === "readinessReports") return "Readiness Vault";
    if (view.type === "systemSecurityPlan") return "System Security Plan";
    if (view.type === "poam") return "Remediation (POA&M)";
    if (view.type === "poamReport") return "POA&M Report";
    if (view.type === "responsibilityMatrix") return "Responsibility Matrix";
    if (view.type === "activityCenter") return "Activity Center";
    if (view.type === "systemHealth") return "System Health";
    if (view.type === "feedbackReview") return "Feedback Review";
    if (view.type === "support") return "Pilot Support";
    if (view.type === "training") return "Training Modules";
    if (view.type === "newsUpdates") return "News Updates";
    return "CMMC Launch Hub";
  }, [view, practiceMap, l2PracticeMap, l2DomainsMap, domains]);

  const Breadcrumbs = () => {
    const currentPractice = view.type === "practice"
      ? (typeof view.practiceId === "string" && view.practiceId.includes(".L2-")
        ? l2PracticeMap.get(view.practiceId)
        : practiceMap.get(view.practiceId))
      : null;
    const currentPracticeDomainKey = currentPractice
      ? (String(currentPractice.id || "").includes(".L2-") && currentPractice.domainId
        ? `__L2__:${currentPractice.domainId}`
        : currentPractice.domainName)
      : "";
    const currentPracticeDomainLabel = currentPracticeDomainKey ? getDomainDisplayLabel(currentPracticeDomainKey) : "";
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
            <span>{getDomainDisplayLabel(view.domainName)}</span>
          </>
        )}

        {view.type === "practice" && (
          <>
            <ChevronRight className="h-4 w-4 mx-1" />
            <button
              onClick={() => {
                if (currentPracticeDomainKey) setView({ type: "domain", domainName: currentPracticeDomainKey });
              }}
              className="hover:underline"
            >
              {currentPracticeDomainLabel}
            </button>
            <ChevronRight className="h-4 w-4 mx-1" />
            <span className="font-medium text-gray-700">{currentPractice?.id}</span>
          </>
        )}

        {[
          "executive",
          "profile",
          "savedTemplates",
          "evidenceLibrary",
          "templateAssist",
          "solutions",
          "sprs",
          "readinessAnalyzer",
          "readinessReports",
          "systemSecurityPlan",
          "poam",
          "poamReport",
          "responsibilityMatrix",
          "activityCenter",
          "systemHealth",
          "feedbackReview",
          "support",
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

    console.log("APP_NAV", { domainName, hasL2 });

    const isL2Key = domainName.startsWith("__L2__:");
    if (isL2Key) {
      if (!hasL2) setIsUpgradeModalOpen(true);
      else setView({ type: "domain", domainName });
      return;
    }

    const domain = rawDomains.find((d) => d.name === domainName);
    const isLevel2OnlyDomain = domain && domain.practices.every((p) => !String(p.id ?? "").includes(".L1-"));

    if (!hasL2 && isLevel2OnlyDomain) {
      setIsUpgradeModalOpen(true);
    } else {
      setView({ type: "domain", domainName });
    }
  };

  const openQuickStartGuide = useCallback(() => {
    const guideWindow = window.open(QUICK_START_GUIDE_URL, "_blank");
    if (guideWindow) {
      guideWindow.opener = null;
    }
  }, []);

  const openFeedbackModal = useCallback(() => {
    setFeedbackTrigger(value => value + 1);
  }, []);

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
      case "pilotDashboard":
        return (
          <PilotDashboard
            canView={isSuperAdmin || isSponsorObserver}
            viewerLabel={isSuperAdmin ? "SuperAdmin" : "Pilot Observer"}
            sponsorProgram={String((profile as any)?.sponsorProgram === "Other" ? (profile as any)?.sponsorProgramOther || "Other" : (profile as any)?.sponsorProgram || "")}
            onParticipantClick={isSponsorObserver && !isSuperAdmin ? (orgId) => setSponsorView({ type: "sponsorParticipantDetail", orgId }) : undefined}
          />
        );
      case "sponsorParticipants":
        return <SponsorParticipantsPage onParticipantClick={(orgId) => setSponsorView({ type: "sponsorParticipantDetail", orgId })} />;
      case "sponsorParticipantDetail":
        return <SponsorParticipantDetailPage orgId={view.orgId} onBack={() => setSponsorView({ type: "sponsorParticipants" })} />;
      case "sponsorActivity":
        return <SponsorRecentActivityPage />;
      case "sponsorProfile":
        return <SponsorProfilePage profile={profile} />;
      case "sponsorObservers":
        return (
          <div className="space-y-4">
            <section className="rounded-lg border bg-white p-6 shadow-sm">
              <h1 className="text-2xl font-bold text-gray-900">Sponsor Observers</h1>
              <p className="mt-2 text-sm text-gray-600">
                Manage sponsor/program observer accounts with read-only pilot oversight access.
              </p>
            </section>
            <SponsorObserversManager isSuperAdmin={isSuperAdmin} />
          </div>
        );
      case "pendingActions":
        return <PendingActionsPage isSuperAdmin={isSuperAdmin} />;
      case "programs":
        return <ProgramManagementPage isSuperAdmin={isSuperAdmin} />;
      case "dashboard":
        return (
          <OrganizationDashboard
            orgId={currentOrgId}
            role={orgRole}
            companyProfile={companyProfile}
            subscriptionLevel={effectiveSubscriptionLevel}
            domains={domains}
            practiceRecords={practiceRecords}
            scores={scores}
            evidenceSummary={evidenceSummary}
            poamItems={poamItems}
            sprsScore={sprsScore}
            onProfileClick={() => setView({ type: "profile" })}
            onPracticeClick={(practiceId) => setView({ type: "practice", practiceId })}
            onEvidenceLibraryClick={() => setView({ type: "evidenceLibrary" })}
            onExecutiveReportClick={() => setView({ type: "executive" })}
            onSprsClick={() => setView({ type: "sprs" })}
            onPoamClick={() => setView({ type: "poam" })}
            onSspClick={() => setView({ type: "systemSecurityPlan" })}
            onResponsibilityMatrixClick={() => setView({ type: "responsibilityMatrix" })}
            onInvitationsClick={() => setView({ type: "orgInvitations" })}
            onQuickStartGuideClick={openQuickStartGuide}
            onSupportClick={() => setView({ type: "support" })}
            onSendFeedbackClick={openFeedbackModal}
          />
        );



      case "superAdmin":
  return <SuperAdminPanel />;


case "domain": {
  console.log("APP_VIEW_DOMAIN", view.domainName);

  // ✅ L2 token path: "__L2__:AC"
  const isL2Key = view.domainName.startsWith("__L2__:");
  if (isL2Key) {
    const domainId = view.domainName.replace("__L2__:", "").trim();

    // If you haven't loaded /cmmc_l2_prepop.json yet, show a loader
    if (!l2Static) return <div className="p-6">Loading Level 2 dataset...</div>;

    // Find the L2 domain in the static JSON
    const rawL2 =
      (l2Static?.domains ?? []).find((d: any) => String(d?.domain_id ?? "") === domainId);

    if (!rawL2) return <div>Domain not found.</div>;

    // Normalize to the same domain shape DomainView expects
    const l2Domain = {
      id: String(rawL2.domain_id ?? domainId),
      name: String(rawL2.domain_name ?? domainId),
      description: "",
      practices: (rawL2.practices ?? []).map((p: any) => ({
        id: String(p?.requirementId ?? ""),
        title: String(p?.requirementName ?? ""),
        description: String(p?.requirementStatement ?? ""),
        statement: String(p?.requirementStatement ?? ""),
        domainId: String(rawL2.domain_id ?? domainId),
        domainName: String(rawL2.domain_name ?? domainId),
      })),
    };

    return (
      <DomainView
        domain={l2Domain as any}
        practiceRecords={practiceRecords}
        getDomainCompletion={getDomainCompletion}
        onPracticeClick={(id) => setView({ type: "practice", practiceId: id })}
      />
    );
  }

  // ✅ Default L1 path (unchanged)
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
        const practice = (typeof view.practiceId === "string" && view.practiceId.includes(".L2-")
          ? l2PracticeMap.get(view.practiceId)
          : practiceMap.get(view.practiceId));
        const practiceRecord = practiceRecordMap.get(view.practiceId);
        return practice && practiceRecord ? (
          <PracticeView
            practice={practice}
            practiceRecord={practiceRecord}
            onUpdateNote={updatePracticeNote}
            onUpdateAssignment={updatePracticeAssignment}
            onUpdateObjective={updateObjectiveRecord}
            onArchiveEvidence={archiveEvidence}
            libraryEvidenceContext={firestoreAssessmentsEnabled && currentOrgId && currentUid ? {
              orgId: currentOrgId,
              assessmentId: currentAssessmentId,
              uid: currentUid,
              canManage: canManageEvidence,
            } : undefined}
            assignmentContext={assignmentContext}
            onApplySuggestion={applyAnalyzerSuggestion}
            onAssistClick={handleAssistClick}
            storeTemplate={storeTemplate}
          />
        ) : (
          <div>Practice not found.</div>
        );
      }

      case "profile":
	return (
          <ProfilePage
            readinessMetrics={{
              completionPercent: Math.round(scores.practiceCompletionScore || scores.overallReadinessScore || 0),
              practicesAssessed: practiceRecords.filter(record => record.status !== "not_assessed").length,
              evidenceCount: evidenceSummary.totalEvidenceCount,
              openPoamCount: poamItems.filter(item => item.status !== "completed").length,
              sprsScore,
            }}
          />
        );

        // return (
        //   <ProfilePage
        //     companyProfile={companyProfile}
        //     updateCompanyProfile={updateCompanyProfile}
        //     addUserToCompany={addUserToCompany}
       //    />
       //  );

      case "executive":
        return (
          <ExecutiveReadinessReport
            orgId={currentOrgId}
            assessmentId={currentAssessmentId}
            assessmentLevel={hasL2 ? "L2" : "L1"}
            domains={domains}
            practiceRecords={practiceRecords}
            poamItems={poamItems}
            evidenceSummary={evidenceSummary}
            getDomainCompletion={getDomainCompletion}
            canExport={isSuperAdmin || isOrgAdmin}
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

      case "evidenceLibrary":
        return <EvidenceLibrary orgId={currentOrgId} uid={currentUid} role={orgRole} isSuperAdmin={isSuperAdmin} />;

      case "orgInvitations":
        return <OrgInvitations orgId={currentOrgId} uid={currentUid} role={orgRole} isSuperAdmin={isSuperAdmin} />;

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
            canExport={hasL2}
            exportDisabledReason="SSP PDF export requires COMM_L2 access."
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
            assignmentContext={assignmentContext}
            onOpenReport={() => setView({ type: "poamReport" })}
          />
        );

      case "poamReport":
        return (
          <PoamReport
            orgId={currentOrgId}
            assessmentId={currentAssessmentId}
            assessmentLevel={hasL2 ? "L2" : "L1"}
            poamItems={poamItems}
            canExport={isSuperAdmin || isOrgAdmin}
          />
        );

      case "activityCenter":
        return (
          <ActivityCenter
            orgId={currentOrgId}
            isSuperAdmin={isSuperAdmin}
            canView={isSuperAdmin || orgRole === "orgOwner" || isOrgAdmin}
          />
        );

      case "systemHealth":
        return (
          <SystemHealthDashboard
            isSuperAdmin={isSuperAdmin}
            onActivityCenterClick={() => setView({ type: "activityCenter" })}
          />
        );

      case "feedbackReview":
        return <SuperAdminFeedbackReview isSuperAdmin={isSuperAdmin} />;

      case "support":
        return <SupportPage />;

      case "training":
        return <TrainingModule />;

      case "newsUpdates":
        return <NewsUpdates />;

      default:
        return <div>Select a view</div>;
    }
  };

  if (orgLoading) {
    return <div className="p-6">Loading access...</div>;
  }

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

  const superAdminMenuItems = isSuperAdmin ? [
    { label: "Main Dashboard", onClick: () => setView({ type: "superAdmin" as const }) },
    { label: "Pilot Dashboard", onClick: () => setView({ type: "pilotDashboard" as const }) },
    { label: "Active Orgs", onClick: () => setView({ type: "superAdmin" as const }) },
    { label: "PROGRAMS", onClick: () => setView({ type: "programs" as const }) },
    { label: "Sponsor Observers", onClick: () => setView({ type: "sponsorObservers" as const }) },
    { label: "Pending Actions", onClick: () => setView({ type: "pendingActions" as const }) },
    { label: "Activity Center", onClick: () => setView({ type: "activityCenter" as const }) },
    { label: "System Health", onClick: () => setView({ type: "systemHealth" as const }) },
    { label: "Feedback Review", onClick: () => setView({ type: "feedbackReview" as const }) },
  ] : undefined;

  if (isSponsorObserver && !isSuperAdmin) {
    const sponsorActiveView =
      view.type === "sponsorParticipants" || view.type === "sponsorParticipantDetail" ? "participants" :
      view.type === "sponsorActivity" ? "activity" :
      view.type === "sponsorProfile" ? "profile" :
      "dashboard";
    return (
      <SponsorLayout
        activeView={sponsorActiveView}
        onLogout={onLogout}
        onNavigate={(nextView) => {
          if (nextView === "participants") setSponsorView({ type: "sponsorParticipants" });
          else if (nextView === "activity") setSponsorView({ type: "sponsorActivity" });
          else if (nextView === "profile") setSponsorView({ type: "sponsorProfile" });
          else setSponsorView({ type: "pilotDashboard" });
        }}
      >
        {renderContent()}
      </SponsorLayout>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <AppHeader
        onAdminClick={orgRole === "orgOwner" || isOrgAdmin || isSuperAdmin ? () => setView({ type: "admin" }) : undefined}
        onSuperAdminClick={isSuperAdmin ? () => setView({ type: "superAdmin" }) : undefined}
        superAdminMenuItems={superAdminMenuItems}
	onSave={handleSaveAssessment}
        saveStatus={assessmentSaveStatus}
        saveMessage={assessmentSaveMessage}
        onSavedTemplatesClick={() => setView({ type: "savedTemplates" })}
        onProfileClick={() => setView({ type: "profile" })}
onDiagnosticsClick={isSuperAdmin ? () => setIsDiagnosticsOpen(true) : undefined}
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
          onEvidenceLibraryClick={() => setView({ type: "evidenceLibrary" })}
          onOrgInvitationsClick={() => setView({ type: "orgInvitations" })}
          canManageInvitations={isSuperAdmin || orgRole === "orgOwner" || isOrgAdmin}
          onActivityCenterClick={() => setView({ type: "activityCenter" })}
          canViewActivityCenter={isSuperAdmin || orgRole === "orgOwner" || isOrgAdmin}
          onSystemHealthClick={() => setView({ type: "systemHealth" })}
          canViewSystemHealth={isSuperAdmin}
          onFeedbackReviewClick={() => setView({ type: "feedbackReview" })}
          canViewFeedbackReview={isSuperAdmin}
          onSupportClick={() => setView({ type: "support" })}
          onQuickStartGuideClick={openQuickStartGuide}
          onSendFeedbackClick={openFeedbackModal}
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

            {!isSuperAdmin && currentOrgId && (
              <PilotParticipantBanner
                orgName={organizationDisplayName}
                onSupportClick={() => setView({ type: "support" })}
              />
            )}

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
        evidenceSummary={evidenceSummary}
        recoveryDiagnostics={recoveryDiagnostics}
        isSuperAdmin={isSuperAdmin}
        firestoreAssessmentsEnabled={firestoreAssessmentsEnabled}
        environmentMode={import.meta.env.MODE}
        currentOrgId={currentOrgId}
        currentUserId={currentUid}
        currentUserRole={isSuperAdmin ? "superAdmin" : orgRole || "member"}
        subscriptionLevel={effectiveSubscriptionLevel}
        onUpgrade={() => setIsUpgradeModalOpen(true)}
        onCommitMinedRequirement={commitMinedRequirement}
      />

      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        onUpgrade={handleUpgradeRequest}
      />

      <FeedbackButton
        orgId={currentOrgId}
        orgName={organizationDisplayName}
        uid={currentUid}
        userEmail={auth.currentUser?.email || (profile as any)?.email || ""}
        userName={auth.currentUser?.displayName || (profile as any)?.displayName || (profile as any)?.fullName || ""}
        role={isSuperAdmin ? "superAdmin" : orgRole || "member"}
        pageLabel={pageTitle}
        triggerToken={feedbackTrigger}
      />

      <AppFooter />
    </div>
  );
}

type PublicRoute = "/login" | "/register" | "/registration-submitted" | "/forgot-password";

const publicNavigate = (path: PublicRoute) => {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
};

const PublicShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex min-h-screen flex-col bg-gray-50">
    <AppHeader showAppActions={false} onSave={() => {}} onSavedTemplatesClick={() => {}} onProfileClick={() => {}} overallCompletion={0} sprsScore={-250} />
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-xl">{children}</div>
    </main>
    <AppFooter />
  </div>
);

function PublicAuthRouter() {
  const getRoute = (): PublicRoute => {
    if (window.location.pathname === "/register") return "/register";
    if (window.location.pathname === "/registration-submitted") return "/registration-submitted";
    if (window.location.pathname === "/forgot-password") return "/forgot-password";
    return "/login";
  };
  const [route, setRoute] = useState<PublicRoute>(getRoute);

  useEffect(() => {
    if (window.location.pathname === "/") window.history.replaceState({}, "", "/login");
    const syncRoute = () => setRoute(getRoute());
    window.addEventListener("popstate", syncRoute);
    syncRoute();
    return () => window.removeEventListener("popstate", syncRoute);
  }, []);

  if (route === "/register") return <RegistrationScreen />;
  if (route === "/registration-submitted") return <RegistrationSubmittedScreen />;
  if (route === "/forgot-password") return <ForgotPasswordScreen />;
  return <LoginScreen />;
}

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMsg("");
    try {
      await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
    } catch (error: any) {
      setMsg(friendlyLoginError(error));
    }
  };

  return (
    <PublicShell>
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">Login</h1>
        <form onSubmit={submit} noValidate className="mt-5 space-y-4">
          <label className="block text-sm font-medium text-gray-700">Email<input required type="email" value={email} onChange={event => setEmail(event.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2" /></label>
          <label className="block text-sm font-medium text-gray-700">Password<input required type="password" value={password} onChange={event => setPassword(event.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2" /></label>
          <button type="button" onClick={() => publicNavigate("/forgot-password")} className="text-sm font-semibold text-blue-700 hover:underline">Forgot Password?</button>
          <button type="submit" className="w-full rounded bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800">Login</button>
          {msg && <p className="text-sm text-red-700">{msg}</p>}
        </form>
        <button type="button" onClick={() => publicNavigate("/register")} className="mt-5 text-sm font-semibold text-blue-700 hover:underline">Register New Organization</button>
      </section>
    </PublicShell>
  );
}

function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    setMsg("");
    setIsSuccess(false);
    if (!cleanEmail) return setMsg("Email is required.");
    if (!emailPattern.test(cleanEmail)) return setMsg("Please enter a valid email address.");
    setSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      setIsSuccess(true);
      setMsg(PASSWORD_RESET_SUCCESS_MESSAGE);
    } catch (error: any) {
      const safeMessage = friendlyPasswordResetError(error);
      if (!safeMessage) {
        setIsSuccess(true);
        setMsg(PASSWORD_RESET_SUCCESS_MESSAGE);
      } else {
        setMsg(safeMessage);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PublicShell>
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">Forgot Password</h1>
        <p className="mt-2 text-sm text-gray-600">Enter the email address you use to sign in.</p>
        <form onSubmit={submit} noValidate className="mt-5 space-y-4">
          <label className="block text-sm font-medium text-gray-700">Email<input required type="email" value={email} onChange={event => setEmail(event.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2" /></label>
          <button type="submit" disabled={submitting} className="w-full rounded bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800 disabled:opacity-60">{submitting ? "Sending..." : "Send Password Reset Link"}</button>
          {msg && <p className={`text-sm ${isSuccess ? "text-emerald-700" : "text-red-700"}`}>{msg}</p>}
        </form>
        <div className="mt-5 space-y-3 text-sm text-gray-600">
          <p>Still need help? Contact your organization administrator or CMMC Launch Hub support.</p>
          <p>Include your organization name and the email address you use to sign in.</p>
        </div>
        <button type="button" onClick={() => publicNavigate("/login")} className="mt-5 text-sm font-semibold text-blue-700 hover:underline">Back to Login</button>
      </section>
    </PublicShell>
  );
}

function RegistrationScreen() {
  // TODO Phase 25A.2: add "How are you joining?" with Commercial Subscription
  // and State / Sponsored Program options, then wire program selection.
  const [companyName, setCompanyName] = useState("");
  const [requestedLevel, setRequestedLevel] = useState<"SPONSORED" | "COMM_L1" | "COMM_L2">("COMM_L1");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [userFullName, setUserFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMsg("");
    const cleanEmail = email.trim().toLowerCase();
    const required = [companyName, address, phone, website, userFullName, cleanEmail, password];
    if (required.some(value => !value.trim())) return setMsg("Please complete all required fields.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return setMsg("Please enter a valid email address.");
    if (password.length < 6) return setMsg("Password must be at least 6 characters.");
    try {
      const parsedWebsite = new URL(website.trim());
      if (!["http:", "https:"].includes(parsedWebsite.protocol)) throw new Error();
    } catch {
      return setMsg("Please enter a valid website URL, including https://.");
    }
    setSubmitting(true);
    try {
      const credential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      await setDoc(doc(db, "users", credential.user.uid), {
        uid: credential.user.uid,
        email: cleanEmail,
        displayName: userFullName.trim(),
        status: "pending",
        requestedLevel,
        registrationSource: "self_registration",
        createdAt: serverTimestamp(),
      });
      await addDoc(collection(db, "accessRequests"), {
        type: "orgRegistration",
        uid: credential.user.uid,
        companyName: companyName.trim(),
        orgName: companyName.trim(),
        requestedLevel,
        requestedTier: requestedLevel,
        address: address.trim(),
        phone: phone.trim(),
        website: website.trim(),
        userFullName: userFullName.trim(),
        primaryContactName: userFullName.trim(),
        primaryContactPhone: phone.trim(),
        primaryContactEmail: cleanEmail,
        ownerEmail: cleanEmail,
        fullName: userFullName.trim(),
        email: cleanEmail,
        requestedByUid: credential.user.uid,
        status: "pending",
        requestedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
      await signOut(auth);
      publicNavigate("/registration-submitted");
    } catch (error: any) {
      console.error("Registration failed", error);
      setMsg(error?.message || "Unable to submit registration.");
      if (auth.currentUser) await signOut(auth);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PublicShell>
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">REGISTRATION FORM</h1>
        <form onSubmit={submit} className="mt-5 space-y-5">
          <div className="space-y-3">
            <h2 className="border-b pb-2 text-sm font-bold uppercase text-gray-700">Company Information</h2>
            <input required placeholder="Company Name" value={companyName} onChange={event => setCompanyName(event.target.value)} className="w-full rounded border border-gray-300 px-3 py-2" />
            <select required value={requestedLevel} onChange={event => setRequestedLevel(event.target.value as typeof requestedLevel)} className="w-full rounded border border-gray-300 px-3 py-2"><option value="COMM_L1">CMMC Level 1</option><option value="COMM_L2">CMMC Level 2</option><option value="SPONSORED">SPONSORED</option></select>
            <input required placeholder="Address" value={address} onChange={event => setAddress(event.target.value)} className="w-full rounded border border-gray-300 px-3 py-2" />
            <input required placeholder="Phone" value={phone} onChange={event => setPhone(event.target.value)} className="w-full rounded border border-gray-300 px-3 py-2" />
            <input required placeholder="Website (https://example.com)" value={website} onChange={event => setWebsite(event.target.value)} className="w-full rounded border border-gray-300 px-3 py-2" />
          </div>
          <div className="space-y-3">
            <h2 className="border-b pb-2 text-sm font-bold uppercase text-gray-700">User Information</h2>
            <input required placeholder="User Full Name" value={userFullName} onChange={event => setUserFullName(event.target.value)} className="w-full rounded border border-gray-300 px-3 py-2" />
            <input required type="email" placeholder="Email" value={email} onChange={event => setEmail(event.target.value)} className="w-full rounded border border-gray-300 px-3 py-2" />
            <input required type="password" placeholder="Password (6+ characters)" value={password} onChange={event => setPassword(event.target.value)} className="w-full rounded border border-gray-300 px-3 py-2" />
          </div>
          <button type="submit" disabled={submitting} className="w-full rounded bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800 disabled:opacity-60">{submitting ? "REGISTERING..." : "REGISTER"}</button>
          {msg && <p className="text-sm text-red-700">{msg}</p>}
        </form>
        <button type="button" onClick={() => publicNavigate("/login")} className="mt-5 text-sm font-semibold text-blue-700 hover:underline">Already have an account? Login</button>
      </section>
    </PublicShell>
  );
}

function RegistrationSubmittedScreen() {
  return (
    <PublicShell>
      <section className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">Registration Submitted</h1>
        <p className="mt-5 text-gray-700">Thank you for registering.</p>
        <p className="mt-3 text-sm text-gray-600">Your organization registration is currently pending approval.</p>
        <p className="mt-2 text-sm text-gray-600">You will be able to access the platform after your organization has been reviewed and approved by an administrator.</p>
        <button type="button" onClick={() => publicNavigate("/login")} className="mt-6 rounded bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800">Back to Login</button>
      </section>
    </PublicShell>
  );
}

/* Legacy combined public form retained temporarily for rollback reference. */
function LegacyLogin() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  // Register form extras (MVP)
  const [orgName, setOrgName] = useState("");
  const [requestedTier, setRequestedTier] = useState<"SPONSORED" | "COMM_L1" | "COMM_L2">("COMM_L1");
  const [website, setWebsite] = useState("");
  const [address, setAddress] = useState("");
  const [primaryContactName, setPrimaryContactName] = useState("");
  const [primaryContactPhone, setPrimaryContactPhone] = useState("");
const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");

    const cleanEmail = email.trim().toLowerCase();

    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, cleanEmail, password);
        setMsg("✅ Logged in");
        return;
      }

      // ===== Register =====
      if (!orgName.trim() || !primaryContactName.trim()) {
        setMsg("❌ Please enter Company Name and Primary Contact Name.");
        return;
      }
      if (!cleanEmail) {
        setMsg("❌ Please enter a valid email address.");
        return;
      }
      if (password.length < 6) {
        setMsg("❌ Password must be at least 6 characters.");
        return;
      }

      const orgId =
        "org_" +
        orgName
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "")
          .slice(0, 40);

      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);

      // Ensure users/{uid} has orgId + pending status (merge-safe)
      await setDoc(
        doc(db, "users", cred.user.uid),
        {
          uid: cred.user.uid,
          email: cleanEmail,
          fullName: primaryContactName.trim(),
          phone: primaryContactPhone.trim(),
          orgId,
          status: "pending",
          roles: { orgRole: "orgAdmin" },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // Create SuperAdmin inbox item (accessRequests)
      try {
        await addDoc(collection(db, "accessRequests"), {
          type: "orgRegistration",
          status: "pending",

          orgId,
          requestedTier,

          orgName: orgName.trim(),
          website: website.trim(),
          address: address.trim(),

          primaryContactName: primaryContactName.trim(),
          primaryContactPhone: primaryContactPhone.trim(),
          primaryContactEmail: cleanEmail,

          // compatibility / convenience fields for tables
          ownerEmail: cleanEmail,
          fullName: primaryContactName.trim(),
          email: cleanEmail,

          requestedByUid: cred.user.uid,
          createdAt: serverTimestamp(),
        });

        console.log("✅ orgRegistration accessRequest created for", cleanEmail, "orgId:", orgId);
      } catch (e: any) {
        console.error("❌ orgRegistration accessRequest FAILED:", e);
        setMsg(`❌ Registration request failed: ${e?.message || String(e)}`);
        return;
      }

      // MVP: do not allow access until Super Admin approves
      await signOut(auth);

      setMsg("✅ Registration submitted. Super Admin will activate your account.");
      setMode("login");
      setEmail("");
      setPassword("");
      setOrgName("");
      setRequestedTier("COMM_L1");
      setWebsite("");
      setAddress("");
      setPrimaryContactName("");
      setPrimaryContactPhone("");
    } catch (err: any) {
      console.error(err);
      setMsg(`❌ ${err?.message || "Unknown error"}`);
    }
  };;

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <AppHeader
        showAppActions={false}
        onSave={() => {}}
        onSavedTemplatesClick={() => {}}
        onProfileClick={() => {}}
        overallCompletion={0}
        sprsScore={-250}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar shell (no items until login) */}
        <aside className="w-64 bg-gradient-to-b from-slate-900 to-slate-800 border-r border-slate-800" />

        <main className="flex-1 overflow-y-auto p-4 md:p-10">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-4xl font-extrabold text-center text-gray-900 mb-10">
              AI Powered CMMC Readiness Platform
            </h1>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start justify-center">
              {/* Login / Register Card */}
              <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 max-w-xl mx-auto w-full">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  {mode === "login" ? "Login" : "Register"} (Email/Password)
                </h2>

                <form onSubmit={submit} className="space-y-3">
                  <input
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    placeholder="Password (6+ chars)"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {mode === "register" && (
                    <div className="space-y-3 pt-2">
                      <div className="h-px bg-gray-200" />
                      <div className="text-sm font-semibold text-gray-900">Company Registration</div>

                      <input
                        placeholder="Company Name *"
                        value={orgName}
                        onChange={(e) => setOrgName(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />

                      <select
                        value={requestedTier}
                        onChange={(e) => setRequestedTier(e.target.value as any)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="SPONSORED">SPONSORED (1 user)</option>
                        <option value="COMM_L1">COMM_L1 (Level 1)</option>
                        <option value="COMM_L2">COMM_L2 (Level 2)</option>
                      </select>

                      <input
                        placeholder="Website (optional)"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />

                      <input
                        placeholder="Address (optional)"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />

                      <div className="text-sm font-semibold text-gray-900 pt-1">Primary Contact</div>

                      <input
                        placeholder="Full Name *"
                        value={primaryContactName}
                        onChange={(e) => setPrimaryContactName(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />

                      <input
                        placeholder="Phone (optional)"
                        value={primaryContactPhone}
                        onChange={(e) => setPrimaryContactPhone(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />

                      <p className="text-xs text-gray-500">
                        After you submit, an Admin will approve your registration and activate your org.
                      </p>
                    </div>
                  )}


                  <button
                    type="submit"
                    className="w-full bg-white border border-gray-300 rounded-lg py-2 font-semibold text-gray-900 hover:bg-gray-50"
                  >
                    {mode === "login" ? "Login" : "Register"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode(mode === "login" ? "register" : "login")}
                    className="w-full text-sm text-blue-700 hover:text-blue-900 py-2"
                  >
                    Switch to {mode === "login" ? "Register" : "Login"}
                  </button>

                  {msg && <div className="text-sm text-gray-700 whitespace-pre-wrap">{msg}</div>}
                </form>
              </div>

              {/* How it works placeholder (keeps layout stable; we will wire HowItWorksPanel next) */}
              <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 max-w-xl mx-auto w-full">
                <h2 className="text-xl font-bold text-gray-900 mb-2">How the Launch Hub Works</h2>
                <p className="text-sm text-gray-600 mb-4">
                  Use the walkthrough panel on the Dashboard after login. We’ll re-enable this panel on the login screen next.
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
                    onClick={() => setMsg("ℹ️ Please login to access the full walkthrough.")}
                  >
                    Listen to Walkthrough
                  </button>
                  <button
                    type="button"
                    className="px-4 py-2 rounded-md border border-gray-300 bg-white text-sm font-semibold hover:bg-gray-50"
                    onClick={() => setMsg("ℹ️ Please login to read the walkthrough transcript.")}
                  >
                    Read Transcript
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <AppFooter />
    </div>
  );
}
