import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestampp,
  runTransaction,
  setDoc,
  updateDoc,
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
  // Idempotent approval: if the request is already not-pending, do nothing.
  if (!isSuperAdmin) return;
  if ((req.status || "pending") !== "pending") return;

  setSaveMsg("");
  setActionBusyId(req.id);

  try {
    // Use a deterministic orgId when possible (so double-click can't create duplicates).
    const derivedOrgId = req.orgId || deriveOrgId(req.orgName || "");
    const orgId = (derivedOrgId || `org_${req.requestedByUid || req.id}`).toLowerCase();

    const reqRef = doc(db, "accessRequests", req.id);
    const orgRef = doc(db, "orgs", orgId);
    const userRef = req.requestedByUid ? doc(db, "users", req.requestedByUid) : null;

    await runTransaction(db, async (tx) => {
      const reqSnap = await tx.get(reqRef);
      if (!reqSnap.exists()) throw new Error("Request no longer exists.");
      const reqData = reqSnap.data() as any;

      // If someone already approved/denied this request, stop (prevents duplicates).
      if ((reqData?.status || "pending") !== "pending") return;

      // Create (or upsert) org doc
      const now = serverTimestamp();
      tx.set(
        orgRef,
        {
          name: (reqData.orgName || req.orgName || "").trim() || "New Org",
          tier: reqData.requestedTier || req.requestedTier || "COMM_L1",
          subscriptionStatus: "active",
          billingCycle: "annual",
          maxUsers:
            (reqData.requestedTier || req.requestedTier) === "COMM_L2"
              ? 10
              : (reqData.requestedTier || req.requestedTier) === "COMM_L1"
              ? 5
              : 1,
          activeMemberCount: 1,

          ownerUid: reqData.requestedByUid || req.requestedByUid || null,

          // Company + contacts
          address: (reqData.address || "").trim(),
          website: (reqData.website || "").trim(),
          primaryContactName: (reqData.primaryContactName || reqData.fullName || "").trim(),
          primaryContactEmail:
            (reqData.primaryContactEmail || reqData.email || reqData.ownerEmail || "").trim(),
          primaryContactPhone: (reqData.primaryContactPhone || reqData.phone || "").trim(),

          subscriptionStartDate: now,
          subscriptionEndDate: reqData.subscriptionEndDate || null,

          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

      // Create member record
      tx.set(
        doc(db, "orgMembers", orgId, "members", reqData.requestedByUid || req.requestedByUid),
        {
          createdAt: serverTimestamp(),
          role: "orgAdmin",
          superAdmin: false,
        },
        { merge: true }
      );

      // Update user profile (so app knows which org they belong to)
        tx.set(
          userRef,
          {
            orgId,
            status: "active",
            tier: reqData.requestedTier || req.requestedTier || "COMM_L1",
            track: reqData.track || "TRACK_1",
            singleUserOnly: (reqData.requestedTier || req.requestedTier) === "SPONSORED",
            fullName: (reqData.primaryContactName || reqData.fullName || "").trim(),
            email:
              (reqData.primaryContactEmail || reqData.email || reqData.ownerEmail || "").trim(),
            phone: (reqData.primaryContactPhone || reqData.phone || "").trim(),
            roles: { orgRole: "orgAdmin" },
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

      // Mark request approved (this is what removes it from Pending list)
      tx.update(reqRef, {
        status: "approved",
        orgId,
        approvedAt: serverTimestamp(),
        approvedByUid: (profile as any)?.uid || null,
        updatedAt: serverTimestamp(),
      });
    });

    // Remove from local pending list immediately (prevents double click)
    setPendingRegistrations((prev) => prev.filter((r) => r.id !== req.id));
    setSaveMsg(`✅ Approved: ${req.primaryContactEmail || req.email || req.id}`);
  } catch (e: any) {
    console.error(e);
    setSaveMsg(`❌ Approve failed: ${e?.message || e}`);
  } finally {
    setActionBusyId(null);
  }
};


  const denyRegistration = async (req: AccessRequestRow) => {
    if (req.status && req.status !== "pending") return;
    if (!isSuperAdmin) return;
    setSaveMsg("");
    setActionBusyId(req.id);
    try {
      await updateDoc(doc(db, "accessRequests", req.id), {
        status: "denied",
        deniedAt: serverTimestampp(),
        deniedByUid: (profile as any)?.uid || null,
        updatedAt: serverTimestampp(),
      });

// ✅ remove from local pending list immediately
setPendingRegistrations((prev) => prev.filter((r) => r.id !== req.id));
setSaveMsg(`✅ Denied: ${req.primaryContactEmail || req.email || req.id}`);
    } catch (e: any) {
      console.error(e);
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

  // --- Load pending registrations (unassigned, orgRegistration) ---
  useEffect(() => {
    if (!isSuperAdmin) return;

    let cancelled = false;
    (async () => {
      setPendingRegsLoading(true);
      setPendingRegsError(null);
      try {
        const q = query(
          collection(db, "accessRequests"),
          where("status", "==", "pending"),
          where("type", "==", "orgRegistration")
        );
        const snap = await getDocs(q);
        const rows: AccessRequestRow[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));
        if (!cancelled) setPendingRegistrations(rows);
      } catch (e: any) {
        console.error("pending registrations load failed:", e);
        if (!cancelled) setPendingRegsError(e?.message || String(e));
      } finally {
        if (!cancelled) setPendingRegsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
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
            // keep going; permissions/empty shouldn't break whole panel
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

        // sort by name
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
          <p className="text-xs text-gray-500">
            System + Org oversight. Super admin only.
          </p>
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
                From <code>accessRequests</code> where type=<code>orgRegistration</code> and status=<code>pending</code>.
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
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={actionBusyId === r.id}
                              onClick={() => denyRegistration(r)}
                              className="px-3 py-1.5 rounded-md bg-rose-600 text-white text-xs hover:bg-rose-700 disabled:opacity-60"
                            >
                              Deny
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
              <p className="text-xs text-gray-500">From <code>orgs</code>. Counts computed live for MVP.</p>
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
                    checked={appEnabled}
                    onChange={(e) => updateActivationField("appEnabled", e.target.checked)}
                  />
                </label>

                <label className="flex items-center justify-between border rounded p-3 bg-gray-50">
                  <span className="text-sm font-medium text-gray-800">Allow Signup</span>
                  <input
                    type="checkbox"
                    checked={allowSignup}
                    onChange={(e) => updateActivationField("allowSignup", e.target.checked)}
                  />
                </label>

                <label className="flex items-center justify-between border rounded p-3 bg-gray-50">
                  <span className="text-sm font-medium text-gray-800">Allow Track 1 (CT Sponsored)</span>
                  <input
                    type="checkbox"
                    checked={allowTrack1}
                    onChange={(e) => updateActivationField("allowTrack1", e.target.checked)}
                  />
                </label>

                <label className="flex items-center justify-between border rounded p-3 bg-gray-50">
                  <span className="text-sm font-medium text-gray-800">Allow Track 2</span>
                  <input
                    type="checkbox"
                    checked={allowTrack2}
                    onChange={(e) => updateActivationField("allowTrack2", e.target.checked)}
                  />
                </label>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-800 mb-1">Announcement Message</label>
                <textarea
                  className="w-full border rounded p-2 text-sm"
                  rows={3}
                  value={message}
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