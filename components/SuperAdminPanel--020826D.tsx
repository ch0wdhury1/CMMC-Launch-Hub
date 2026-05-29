import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "../src/firebase";
import { useUserProfile } from "../src/useUserProfile";

type ActivationDoc = {
  appEnabled?: boolean;
  allowSignup?: boolean;
  allowTrack1?: boolean;
  allowTrack2?: boolean;
  message?: string;
  [key: string]: any;
};

type OrgRow = {
  id: string; // orgId (doc id)
  name?: string;
  tier?: string;
  subscriptionStatus?: string;
  subscriptionStartDate?: any;
  subscriptionEndDate?: any;
  primaryContactName?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
  ownerUid?: string;
  activeMemberCount?: number;
  maxUsers?: number;
};

type PendingCounts = {
  addUser: number;
  upgrade: number;
};

type OrgComputed = OrgRow & {
  memberCount: number;
  pending: PendingCounts;
};

type AccessRequestRow = {
  id: string;
  type?: string;
  status?: string;
  orgId?: string;
  createdAt?: any;
  email?: string;
  fullName?: string;
  requestedRole?: string;
  requestedTier?: string;
  requestedByUid?: string;
};

function fmtDate(v: any): string {
  try {
    if (!v) return "—";
    // Firestore Timestamp
    if (typeof v?.toDate === "function") return v.toDate().toLocaleDateString();
    // Date
    if (v instanceof Date) return v.toLocaleDateString();
    return String(v);
  } catch {
    return "—";
  }
}

export const SuperAdminPanel: React.FC = () => {
  // --- auth/profile ---
  const { loading: profileLoading, profile } = useUserProfile();
  const rolesAny: any = (profile as any)?.roles || {};
  const isSuperAdmin = rolesAny?.superAdmin === true;

  // --- tabs ---
  const [tab, setTab] = useState<"orgs" | "system">("orgs");

  // --- system/activation ---
  const [activationLoading, setActivationLoading] = useState(true);
  const [activation, setActivation] = useState<ActivationDoc | null>(null);
  const [saveMsg, setSaveMsg] = useState<string>("");

  const activationRef = useMemo(() => doc(db, "system", "activation"), []);

  // --- orgs + requests ---
  const [orgsLoading, setOrgsLoading] = useState(false);
  const [orgsError, setOrgsError] = useState<string | null>(null);
  const [orgs, setOrgs] = useState<OrgComputed[]>([]);

  const [pendingRegsLoading, setPendingRegsLoading] = useState(false);
  const [pendingRegsError, setPendingRegsError] = useState<string | null>(null);
  const [pendingRegistrations, setPendingRegistrations] = useState<AccessRequestRow[]>([]);

  // --- approve/deny state ---
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  // --- helpers ---
  const safeStr = (v: any) => (typeof v === "string" ? v : v == null ? "" : String(v));
  const slugify = (name: string) =>
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40);

  const addDays = (d: Date, days: number) => {
    const x = new Date(d.getTime());
    x.setDate(x.getDate() + days);
    return x;
  };

  const stripUndefined = (obj: Record<string, any>) => {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) out[k] = v;
    }
    return out;
  };

  const getOrgDefaultsForTier = (tier: string) => {
    const t = String(tier || "").toUpperCase();
    if (t === "SPONSORED" || t === "CT_SPONSORED") {
      return { maxUsers: 1, billingCycle: "annual" };
    }
    if (t === "COMM_L2") {
      return { maxUsers: 25, billingCycle: "annual" };
    }
    // COMM_L1 default
    return { maxUsers: 10, billingCycle: "annual" };
  };

  const approveRegistration = async (req: AccessRequestRow) => {
    if (!isSuperAdmin) return;
    if (actionBusyId === req.id) return;

    // Optimistic UI removal (must disappear immediately)
    let removed: AccessRequestRow | null = null;
    setPendingRegistrations((prev) => {
      removed = prev.find((r) => r.id === req.id) || null;
      return prev.filter((r) => r.id !== req.id);
    });

    setSaveMsg("");
    setActionBusyId(req.id);

    try {
      const ownerUid = safeStr((req as any).requestedByUid || (req as any).uid);
      if (!ownerUid) throw new Error("Request missing requestedByUid");

      const orgName = safeStr((req as any).orgName).trim() || "New Organization";
      const requestedTier = safeStr((req as any).requestedTier).trim() || "COMM_L1";

      // Deterministic orgId (prevents duplicates across retries)
      const deterministicOrgId =
        safeStr((req as any).orgId).trim() || `org_${slugify(orgName) || "new"}_${req.id.slice(0, 6)}`;

      const now = new Date();
      const start = Timestamp.fromDate(now);
      const end = Timestamp.fromDate(addDays(now, 365));

      const { maxUsers, billingCycle } = getOrgDefaultsForTier(requestedTier);
      const isSponsored =
        String(requestedTier || "").toUpperCase() === "SPONSORED" ||
        String(requestedTier || "").toUpperCase() === "CT_SPONSORED";

      const primaryEmail =
        safeStr((req as any).primaryContactEmail || (req as any).email || (req as any).ownerEmail)
          .trim()
          .toLowerCase();

      const primaryName = safeStr((req as any).primaryContactName || (req as any).fullName).trim();
      const primaryPhone = safeStr((req as any).primaryContactPhone).trim();

      await runTransaction(db, async (tx) => {
        const reqRef = doc(db, "accessRequests", req.id);
        const reqSnap = await tx.get(reqRef);
        if (!reqSnap.exists()) throw new Error("Request no longer exists");
        const reqData: any = reqSnap.data();
        if (reqData?.type !== "orgRegistration") throw new Error("Not an orgRegistration request");

        // Idempotency guard
        if (reqData?.status !== "pending") {
          throw new Error(`Request already ${String(reqData?.status || "processed")}`);
        }

        const orgId = safeStr(reqData?.orgId).trim() || deterministicOrgId;

        const orgRef = doc(db, "orgs", orgId);
        const orgSnap = await tx.get(orgRef);

        if (!orgSnap.exists()) {
          tx.set(
            orgRef,
            stripUndefined({
              name: orgName,
              address: safeStr((reqData as any).address).trim(),
              website: safeStr((reqData as any).website).trim(),
              tier: requestedTier,
              subscriptionStatus: "active",
              subscriptionStartDate: start,
              subscriptionEndDate: end,
              billingCycle,
              ownerUid,
              maxUsers,
              activeMemberCount: 1,
              primaryContactName: primaryName,
              primaryContactEmail: primaryEmail,
              primaryContactPhone: primaryPhone,
              secondaryContactName: "",
              secondaryContactEmail: "",
              secondaryContactPhone: "",
              logoUrl: "",
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            }),
            { merge: true }
          );
        } else {
          // Ensure key fields exist; do not recreate/duplicate.
          tx.set(
            orgRef,
            stripUndefined({
              updatedAt: serverTimestamp(),
              name: orgSnap.data()?.name || orgName,
              ownerUid: orgSnap.data()?.ownerUid || ownerUid,
              primaryContactEmail: orgSnap.data()?.primaryContactEmail || primaryEmail,
              primaryContactName: orgSnap.data()?.primaryContactName || primaryName,
              primaryContactPhone: orgSnap.data()?.primaryContactPhone || primaryPhone,
            }),
            { merge: true }
          );
        }

        // Membership (required schema)
        const memberRef = doc(db, "orgMembers", orgId, "members", ownerUid);
        const memberSnap = await tx.get(memberRef);
        if (!memberSnap.exists()) {
          tx.set(
            memberRef,
            { createdAt: serverTimestamp(), role: "orgAdmin", superAdmin: false },
            { merge: true }
          );
        }

        // Back-compat membership (some rules/helpers still check /orgs/{orgId}/members)
        const legacyMemberRef = doc(db, "orgs", orgId, "members", ownerUid);
        const legacyMemberSnap = await tx.get(legacyMemberRef);
        if (!legacyMemberSnap.exists()) {
          tx.set(
            legacyMemberRef,
            { createdAt: serverTimestamp(), role: "orgAdmin", superAdmin: false },
            { merge: true }
          );
        }

        // User doc
        const userRef = doc(db, "users", ownerUid);
        const userSnap = await tx.get(userRef);
        tx.set(
          userRef,
          stripUndefined({
            uid: ownerUid,
            orgId,
            email: primaryEmail,
            fullName: primaryName,
            phone: primaryPhone,
            status: "active",
            track: safeStr((reqData as any).track || "TRACK_1"),
            singleUserOnly: !!isSponsored,
            roles: { orgRole: "orgAdmin", superAdmin: false },
            createdAt: userSnap.exists() ? userSnap.data()?.createdAt || serverTimestamp() : serverTimestamp(),
            updatedAt: serverTimestamp(),
          }),
          { merge: true }
        );

        // Approve request (store deterministic orgId)
        tx.update(reqRef, {
          status: "approved",
          orgId,
          approvedAt: serverTimestamp(),
          approvedByUid: (profile as any)?.uid || null,
          updatedAt: serverTimestamp(),
        });
      });

      setSaveMsg(`✅ Approved: ${req.email || req.id}`);
    } catch (e: any) {
      console.error(e);
      // Re-add if optimistic removal happened but transaction failed
      if (removed) setPendingRegistrations((prev) => [removed as any, ...prev]);
      setSaveMsg(`❌ Approve failed: ${e?.message || e}`);
    } finally {
      setActionBusyId(null);
    }
  };

  const denyRegistration = async (req: AccessRequestRow) => {
    if (!isSuperAdmin) return;
    if (actionBusyId === req.id) return;

    setSaveMsg("");
    setActionBusyId(req.id);

    // Optimistic UI removal
    let removed: AccessRequestRow | null = null;
    setPendingRegistrations((prev) => {
      removed = prev.find((r) => r.id === req.id) || null;
      return prev.filter((r) => r.id !== req.id);
    });

    try {
      await runTransaction(db, async (tx) => {
        const reqRef = doc(db, "accessRequests", req.id);
        const snap = await tx.get(reqRef);
        if (!snap.exists()) throw new Error("Request no longer exists");
        const data: any = snap.data();
        if (data?.type !== "orgRegistration") throw new Error("Not an orgRegistration request");
        if (data?.status !== "pending") throw new Error(`Request already ${String(data?.status || "processed")}`);

        tx.update(reqRef, {
          status: "denied",
          deniedAt: serverTimestamp(),
          deniedByUid: (profile as any)?.uid || null,
          updatedAt: serverTimestamp(),
        });
      });

      setSaveMsg(`✅ Denied: ${req.email || req.id}`);
    } catch (e: any) {
      console.error(e);
      if (removed) setPendingRegistrations((prev) => [removed as any, ...prev]);
      setSaveMsg(`❌ Deny failed: ${e?.message || e}`);
    } finally {
      setActionBusyId(null);
    }
  };

  // --- Activation snapshot ---
  useEffect(() => {
    if (!isSuperAdmin) {
      setActivationLoading(false);
      return;
    }

    const unsub = onSnapshot(
      activationRef,
      (snap) => {
        setActivation((snap.data() || {}) as ActivationDoc);
        setActivationLoading(false);
      },
      (err) => {
        console.error("activation snapshot error:", err);
        setActivationLoading(false);
      }
    );

    return () => unsub();
  }, [activationRef, isSuperAdmin]);

  // --- Pending registrations (REALTIME) ---
  useEffect(() => {
    if (!isSuperAdmin) {
      setPendingRegsLoading(false);
      return;
    }

    setPendingRegsLoading(true);
    setPendingRegsError(null);

    const qPending = query(
      collection(db, "accessRequests"),
      where("type", "==", "orgRegistration"),
      where("status", "==", "pending")
    );

    const unsub = onSnapshot(
      qPending,
      (snap) => {
        const rows: AccessRequestRow[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));
        setPendingRegistrations(rows);
        setPendingRegsLoading(false);
      },
      (err) => {
        console.error("pending registrations snapshot error:", err);
        setPendingRegsError(err?.message || String(err));
        setPendingRegsLoading(false);
      }
    );

    return () => unsub();
  }, [isSuperAdmin]);

  // --- Load orgs + per-org computed counts (members + pending request counts) ---
  useEffect(() => {
    if (!isSuperAdmin) return;

    let cancelled = false;
    (async () => {
      setOrgsLoading(true);
      setOrgsError(null);

      try {
        const orgSnap = await getDocs(collection(db, "orgs"));
        const base: OrgRow[] = orgSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

        const computed: OrgComputed[] = [];

        for (const o of base) {
          // member count from orgMembers/{orgId}/members
          let memberCount = 0;
          try {
            const membersSnap = await getDocs(collection(db, "orgMembers", o.id, "members"));
            memberCount = membersSnap.size;
          } catch (e) {
            console.warn("member count failed for", o.id, e);
          }

          // pending addUser + upgrade counts from accessRequests (by orgId)
          let pendingAddUser = 0;
          let pendingUpgrade = 0;
          try {
            const pendingOrgReq = query(
              collection(db, "accessRequests"),
              where("status", "==", "pending"),
              where("orgId", "==", o.id)
            );
            const reqSnap = await getDocs(pendingOrgReq);
            for (const d of reqSnap.docs) {
              const r = d.data() as any;
              if (r?.type === "addUser") pendingAddUser += 1;
              if (r?.type === "upgradeRequest") pendingUpgrade += 1;
            }
          } catch (e) {
            console.warn("pending counts failed for", o.id, e);
          }

          computed.push({
            ...o,
            memberCount,
            pending: { addUser: pendingAddUser, upgrade: pendingUpgrade },
          });
        }

        computed.sort((a, b) => String(a?.name || a.id).localeCompare(String(b?.name || b.id)));

        if (!cancelled) setOrgs(computed);
      } catch (e: any) {
        console.error("orgs load failed:", e);
        if (!cancelled) setOrgsError(e?.message || String(e));
      } finally {
        if (!cancelled) setOrgsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isSuperAdmin]);

  const updateActivationField = (key: string, value: any) => {
    setActivation((prev) => ({ ...(prev || {}), [key]: value }));
  };

  const handleSaveActivation = async () => {
    setSaveMsg("");
    try {
      if (!isSuperAdmin) {
        setSaveMsg("❌ Not authorized (super admin only).");
        return;
      }
      await setDoc(activationRef, activation || {}, { merge: true });
      setSaveMsg("✅ Saved.");
    } catch (e: any) {
      console.error("save activation error:", e);
      setSaveMsg(`❌ Save failed: ${e?.message || "Unknown error"}`);
    }
  };

  // --- gating renders (AFTER all hooks are declared) ---
  if (profileLoading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="text-sm text-gray-600">Loading Super Admin Panel…</div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md border border-red-100">
        <h2 className="text-xl font-bold text-gray-800 mb-2">Super Admin</h2>
        <p className="text-sm text-red-600">You don’t have access to this area.</p>
      </div>
    );
  }

  // --- derived ---
  const totalOrgs = orgs.length;
  const totalPendingRegs = pendingRegistrations.length;
  const totalPendingAddUser = orgs.reduce((sum, o) => sum + (o.pending?.addUser || 0), 0);
  const totalPendingUpgrade = orgs.reduce((sum, o) => sum + (o.pending?.upgrade || 0), 0);

  const appEnabled = !!activation?.appEnabled;
  const allowSignup = activation?.allowSignup !== false;
  const allowTrack1 = activation?.allowTrack1 !== false;
  const allowTrack2 = !!activation?.allowTrack2;
  const message = activation?.message || "";

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Super Admin</h2>
          <p className="text-xs text-gray-500">System + Org oversight. Super admin only.</p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab("orgs")}
            className={
              "px-3 py-1.5 rounded-md text-sm border " +
              (tab === "orgs"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50")
            }
          >
            Orgs
          </button>
          <button
            type="button"
            onClick={() => setTab("system")}
            className={
              "px-3 py-1.5 rounded-md text-sm border " +
              (tab === "system"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50")
            }
          >
            System
          </button>
        </div>
      </div>

      {tab === "orgs" && (
        <div className="space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="text-xs text-gray-500">Total Orgs</div>
              <div className="text-2xl font-bold text-gray-900">{totalOrgs}</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="text-xs text-gray-500">Pending Registrations</div>
              <div className="text-2xl font-bold text-gray-900">{totalPendingRegs}</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="text-xs text-gray-500">Pending Add-User</div>
              <div className="text-2xl font-bold text-gray-900">{totalPendingAddUser}</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="text-xs text-gray-500">Pending Upgrades</div>
              <div className="text-2xl font-bold text-gray-900">{totalPendingUpgrade}</div>
            </div>
          </div>

          {/* Pending Registrations */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-gray-900">Pending Registrations</h3>
              <p className="text-xs text-gray-500">
                From <code>accessRequests</code> where type=<code>orgRegistration</code> and status=
                <code>pending</code>.
              </p>
            </div>

            {pendingRegsLoading ? (
              <div className="p-4 text-sm text-gray-600">Loading pending registrations…</div>
            ) : pendingRegsError ? (
              <div className="p-4 text-sm text-red-600">Error: {pendingRegsError}</div>
            ) : pendingRegistrations.length === 0 ? (
              <div className="p-4 text-sm text-gray-600">No pending registrations.</div>
            ) : (
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left p-3">Name</th>
                      <th className="text-left p-3">Email</th>
                      <th className="text-left p-3">Requested Tier</th>
                      <th className="text-left p-3">Created</th>
                      <th className="text-left p-3">Request ID</th>
                      <th className="text-left p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingRegistrations.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="p-3">{r.fullName || "—"}</td>
                        <td className="p-3">{r.email || "—"}</td>
                        <td className="p-3">{(r as any)?.tier || (r as any)?.requestedTier || "—"}</td>
                        <td className="p-3">{fmtDate(r.createdAt)}</td>
                        <td className="p-3 font-mono text-xs text-gray-500">{r.id}</td>
                        <td className="p-3">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={actionBusyId === r.id}
                              onClick={() => approveRegistration(r)}
                              className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-xs hover:bg-emerald-700 disabled:opacity-60"
                            >
                              {actionBusyId === r.id ? "Approving…" : "Approve"}
                            </button>
                            <button
                              type="button"
                              disabled={actionBusyId === r.id}
                              onClick={() => denyRegistration(r)}
                              className="px-3 py-1.5 rounded-md bg-rose-600 text-white text-xs hover:bg-rose-700 disabled:opacity-60"
                            >
                              {actionBusyId === r.id ? "Working…" : "Deny"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Orgs Table */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-gray-900">Orgs</h3>
              <p className="text-xs text-gray-500">
                From <code>orgs</code>. Counts computed live for MVP.
              </p>
            </div>

            {orgsLoading ? (
              <div className="p-4 text-sm text-gray-600">Loading orgs…</div>
            ) : orgsError ? (
              <div className="p-4 text-sm text-red-600">Error: {orgsError}</div>
            ) : orgs.length === 0 ? (
              <div className="p-4 text-sm text-gray-600">No orgs found.</div>
            ) : (
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left p-3">Org Name</th>
                      <th className="text-left p-3">Status</th>
                      <th className="text-left p-3">Tier</th>
                      <th className="text-left p-3"># Users</th>
                      <th className="text-left p-3">Primary Contact</th>
                      <th className="text-left p-3">Start</th>
                      <th className="text-left p-3">End</th>
                      <th className="text-left p-3">Pending Add-User</th>
                      <th className="text-left p-3">Pending Upgrade</th>
                      <th className="text-left p-3">Org ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orgs.map((o) => (
                      <tr key={o.id} className="border-t">
                        <td className="p-3">
                          <div className="font-medium text-gray-900">{o.name || o.id}</div>
                          <div className="text-xs text-gray-500">
                            owner: <span className="font-mono">{o.ownerUid || "—"}</span>
                          </div>
                        </td>
                        <td className="p-3">{o.subscriptionStatus || "—"}</td>
                        <td className="p-3">{o.tier || "—"}</td>
                        <td className="p-3">
                          <span className="font-medium">{o.memberCount}</span>
                          {typeof o.activeMemberCount === "number" && (
                            <span className="text-xs text-gray-500"> (cached: {o.activeMemberCount})</span>
                          )}
                        </td>
                        <td className="p-3">
                          <div>{o.primaryContactName || "—"}</div>
                          <div className="text-xs text-gray-500">{o.primaryContactEmail || ""}</div>
                        </td>
                        <td className="p-3">{fmtDate(o.subscriptionStartDate)}</td>
                        <td className="p-3">{fmtDate(o.subscriptionEndDate)}</td>
                        <td className="p-3">{o.pending?.addUser ?? 0}</td>
                        <td className="p-3">{o.pending?.upgrade ?? 0}</td>
                        <td className="p-3 font-mono text-xs text-gray-500">{o.id}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "system" && (
        <div className="bg-white p-6 rounded-lg shadow-md border">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-900">System Activation</h3>
            <button
              onClick={handleSaveActivation}
              className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              Save
            </button>
          </div>

          <p className="text-xs text-gray-500 mt-1">
            Controls stored in <code>system/activation</code>. Super Admin only.
          </p>

          {activationLoading ? (
            <div className="mt-4 text-sm text-gray-600">Loading activation…</div>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex items-center justify-between border rounded p-3 bg-gray-50">
                  <span className="text-sm font-medium text-gray-800">App Enabled</span>
                  <input
                    type="checkbox"
                    checked={!!activation?.appEnabled}
                    onChange={(e) => updateActivationField("appEnabled", e.target.checked)}
                  />
                </label>

                <label className="flex items-center justify-between border rounded p-3 bg-gray-50">
                  <span className="text-sm font-medium text-gray-800">Allow Signup</span>
                  <input
                    type="checkbox"
                    checked={activation?.allowSignup !== false}
                    onChange={(e) => updateActivationField("allowSignup", e.target.checked)}
                  />
                </label>

                <label className="flex items-center justify-between border rounded p-3 bg-gray-50">
                  <span className="text-sm font-medium text-gray-800">Allow Track 1 (CT Sponsored)</span>
                  <input
                    type="checkbox"
                    checked={activation?.allowTrack1 !== false}
                    onChange={(e) => updateActivationField("allowTrack1", e.target.checked)}
                  />
                </label>

                <label className="flex items-center justify-between border rounded p-3 bg-gray-50">
                  <span className="text-sm font-medium text-gray-800">Allow Track 2</span>
                  <input
                    type="checkbox"
                    checked={!!activation?.allowTrack2}
                    onChange={(e) => updateActivationField("allowTrack2", e.target.checked)}
                  />
                </label>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-800 mb-1">Announcement Message</label>
                <textarea
                  className="w-full border rounded p-2 text-sm"
                  rows={3}
                  value={activation?.message || ""}
                  onChange={(e) => updateActivationField("message", e.target.value)}
                />
              </div>

              {saveMsg && <div className="mt-3 text-sm">{saveMsg}</div>}
            </>
          )}
        </div>
      )}
    </div>
  );
};
