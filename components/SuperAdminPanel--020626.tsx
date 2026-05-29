import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, getDocs, onSnapshot, query, setDoc, where } from "firebase/firestore";
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

export const SuperAdminPanel: React.FC = () => {
  const { loading: profileLoading, profile } = useUserProfile();
  const isSuperAdmin = !!(profile as any)?.roles?.superAdmin;

  const [loading, setLoading] = useState(true);
  const [activation, setActivation] = useState<ActivationDoc | null>(null);
  const [saveMsg, setSaveMsg] = useState<string>("");

  const activationRef = useMemo(() => doc(db, "system", "activation"), []);

  useEffect(() => {
    if (!isSuperAdmin) {
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(
      activationRef,
      (snap) => {
        setActivation((snap.data() || {}) as ActivationDoc);
        setLoading(false);
      },
      (err) => {
        console.error("activation snapshot error:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [activationRef, isSuperAdmin]);

  const updateField = (key: string, value: any) => {
    setActivation((prev) => ({ ...(prev || {}), [key]: value }));
  };

  const handleSave = async () => {
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

  if (profileLoading || loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="text-sm text-gray-600">Loading Super Admin Panel…</div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md border border-red-100">
        <h2 className="text-xl font-bold text-gray-800 mb-2">Super Admin Panel</h2>
        <p className="text-sm text-red-600">You don’t have access to this area.</p>
      </div>
    );
  }

  const appEnabled = !!activation?.appEnabled;
  const allowSignup = activation?.allowSignup !== false;
  const allowTrack1 = activation?.allowTrack1 !== false;
  const allowTrack2 = !!activation?.allowTrack2;
  const message = activation?.message || "";

  // =========================
  // Super Admin Dashboard v1
  // =========================
  type OrgRow = {
    id: string;
    name?: string;
    subscriptionStatus?: string;
    tier?: string;
    activeMemberCount?: number;
    maxUsers?: number;
    primaryContactName?: string;
    primaryContactEmail?: string;
    subscriptionStartDate?: any;
    subscriptionEndDate?: any;
    createdAt?: any;
    updatedAt?: any;
  };

  type AccessRequest = {
    id: string;
    type?: string;
    status?: string;
    orgId?: string;
    orgName?: string;
    requestedTier?: string;
    ownerEmail?: string;
    primaryContactName?: string;
    primaryContactPhone?: string;
    createdAt?: any;
    requestedByUid?: string;
    [key: string]: any;
  };

  const [tab, setTab] = useState<"orgs" | "system">("orgs");
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(true);
  const [orgsError, setOrgsError] = useState<string | null>(null);

  const [pendingRegs, setPendingRegs] = useState<AccessRequest[]>([]);
  const [pendingRegsLoading, setPendingRegsLoading] = useState(false);

  const [countsByOrg, setCountsByOrg] = useState<Record<string, { members: number; pendingAddUser: number; pendingUpgrade: number }>>({});

  const fmtDate = (v: any) => {
    try {
      if (!v) return "—";
      const d = typeof v?.toDate === "function" ? v.toDate() : new Date(v);
      if (!(d instanceof Date) || isNaN(d.getTime())) return "—";
      return d.toLocaleDateString();
    } catch {
      return "—";
    }
  };

  // Subscribe to orgs list (super admin only)
  useEffect(() => {
    if (!isSuperAdmin) return;

    setOrgsLoading(true);
    setOrgsError(null);

    const unsub = onSnapshot(
      collection(db, "orgs"),
      (snap) => {
        const rows: OrgRow[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        // Sort by name for stable UI
        rows.sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id)));
        setOrgs(rows);
        setOrgsLoading(false);
      },
      (err) => {
        console.error("orgs snapshot error:", err);
        setOrgsError(err?.message || String(err));
        setOrgsLoading(false);
      }
    );

    return () => unsub();
  }, [isSuperAdmin]);

  // Load pending org registrations (these may not have orgId yet)
  useEffect(() => {
    if (!isSuperAdmin) return;

    let cancelled = false;
    (async () => {
      setPendingRegsLoading(true);
      try {
        const qy = query(
          collection(db, "accessRequests"),
          where("status", "==", "pending"),
          where("type", "==", "orgRegistration")
        );
        const snap = await getDocs(qy);
        const rows: AccessRequest[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        // newest first
        rows.sort((a, b) => {
          const ad = (a.createdAt?.toMillis?.() ?? 0);
          const bd = (b.createdAt?.toMillis?.() ?? 0);
          return bd - ad;
        });
        if (!cancelled) setPendingRegs(rows);
      } catch (e: any) {
        console.error("pending registrations load error:", e);
        if (!cancelled) setPendingRegs([]);
      } finally {
        if (!cancelled) setPendingRegsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isSuperAdmin]);

  // Compute per-org counts (members + pending requests)
  useEffect(() => {
    if (!isSuperAdmin) return;
    if (!orgs || orgs.length === 0) {
      setCountsByOrg({});
      return;
    }

    let cancelled = false;

    (async () => {
      const next: Record<string, { members: number; pendingAddUser: number; pendingUpgrade: number }> = {};

      for (const o of orgs) {
        const orgId = o.id;

        // Members count
        let members = 0;
        try {
          const ms = await getDocs(collection(db, "orgMembers", orgId, "members"));
          members = ms.size;
        } catch (e) {
          // If rules block (shouldn't for super admin), fall back to stored field
          members = Number(o.activeMemberCount ?? 0);
        }

        // Pending requests for this org
        let pendingAddUser = 0;
        let pendingUpgrade = 0;
        try {
          const rs = await getDocs(
            query(
              collection(db, "accessRequests"),
              where("orgId", "==", orgId),
              where("status", "==", "pending")
            )
          );
          rs.forEach((d) => {
            const t = (d.data() as any)?.type;
            if (t === "addUser") pendingAddUser += 1;
            if (t === "upgradeRequest") pendingUpgrade += 1;
          });
        } catch (e) {
          // ignore; keep zeros
        }

        next[orgId] = { members, pendingAddUser, pendingUpgrade };
      }

      if (!cancelled) setCountsByOrg(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [isSuperAdmin, orgs]);


  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Super Admin</h2>
          <p className="text-sm text-gray-600">
            Orgs, pending requests, and system controls.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab("orgs")}
            className={
              "px-3 py-1.5 rounded text-sm border " +
              (tab === "orgs" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-800 border-gray-200")
            }
          >
            Orgs
          </button>
          <button
            type="button"
            onClick={() => setTab("system")}
            className={
              "px-3 py-1.5 rounded text-sm border " +
              (tab === "system" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-800 border-gray-200")
            }
          >
            System
          </button>
        </div>
      </div>

      {tab === "orgs" && (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="text-xs text-gray-500">Total Orgs</div>
              <div className="text-2xl font-bold">{orgs.length}</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="text-xs text-gray-500">Pending Registrations</div>
              <div className="text-2xl font-bold">{pendingRegs.length}</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="text-xs text-gray-500">Pending Add-User</div>
              <div className="text-2xl font-bold">
                {Object.values(countsByOrg).reduce((s, x) => s + (x?.pendingAddUser ?? 0), 0)}
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="text-xs text-gray-500">Pending Upgrades</div>
              <div className="text-2xl font-bold">
                {Object.values(countsByOrg).reduce((s, x) => s + (x?.pendingUpgrade ?? 0), 0)}
              </div>
            </div>
          </div>

          {/* Pending Registrations */}
          <div className="bg-white p-6 rounded-lg shadow-md border">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Pending Registrations</h3>
                <p className="text-xs text-gray-500">
                  New org registration requests (not yet tied to an orgId).
                </p>
              </div>
            </div>

            {pendingRegsLoading ? (
              <div className="text-sm text-gray-600">Loading…</div>
            ) : pendingRegs.length === 0 ? (
              <div className="text-sm text-gray-600">No pending registrations.</div>
            ) : (
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-xs text-gray-500">
                    <tr className="border-b">
                      <th className="text-left py-2 pr-3">Company</th>
                      <th className="text-left py-2 pr-3">Requested Tier</th>
                      <th className="text-left py-2 pr-3">Primary Contact</th>
                      <th className="text-left py-2 pr-3">Owner Email</th>
                      <th className="text-left py-2 pr-3">Created</th>
                      <th className="text-left py-2 pr-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingRegs.map((r) => (
                      <tr key={r.id} className="border-b last:border-b-0">
                        <td className="py-2 pr-3 font-medium">{r.orgName || "—"}</td>
                        <td className="py-2 pr-3">{r.requestedTier || "—"}</td>
                        <td className="py-2 pr-3">{r.primaryContactName || "—"}</td>
                        <td className="py-2 pr-3">{r.ownerEmail || "—"}</td>
                        <td className="py-2 pr-3">{fmtDate(r.createdAt)}</td>
                        <td className="py-2 pr-3">{r.status || "pending"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Orgs Table */}
          <div className="bg-white p-6 rounded-lg shadow-md border">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">All Orgs</h3>
                <p className="text-xs text-gray-500">
                  Org doc is the source of truth for tier and subscription status.
                </p>
              </div>
            </div>

            {orgsLoading ? (
              <div className="text-sm text-gray-600">Loading orgs…</div>
            ) : orgsError ? (
              <div className="text-sm text-red-600">Error: {orgsError}</div>
            ) : (
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-xs text-gray-500">
                    <tr className="border-b">
                      <th className="text-left py-2 pr-3">Org Name</th>
                      <th className="text-left py-2 pr-3">Status</th>
                      <th className="text-left py-2 pr-3">Tier</th>
                      <th className="text-left py-2 pr-3"># Users</th>
                      <th className="text-left py-2 pr-3">Primary Contact</th>
                      <th className="text-left py-2 pr-3">Start</th>
                      <th className="text-left py-2 pr-3">End</th>
                      <th className="text-left py-2 pr-3">Pending Add-User</th>
                      <th className="text-left py-2 pr-3">Pending Upgrade</th>
                      <th className="text-left py-2 pr-3">OrgId</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orgs.map((o) => {
                      const c = countsByOrg[o.id] || { members: Number(o.activeMemberCount ?? 0), pendingAddUser: 0, pendingUpgrade: 0 };
                      return (
                        <tr key={o.id} className="border-b last:border-b-0">
                          <td className="py-2 pr-3 font-medium">{o.name || o.id}</td>
                          <td className="py-2 pr-3">{o.subscriptionStatus || "—"}</td>
                          <td className="py-2 pr-3">{o.tier || "—"}</td>
                          <td className="py-2 pr-3">{c.members}</td>
                          <td className="py-2 pr-3">{o.primaryContactName || "—"}</td>
                          <td className="py-2 pr-3">{fmtDate(o.subscriptionStartDate)}</td>
                          <td className="py-2 pr-3">{fmtDate(o.subscriptionEndDate)}</td>
                          <td className="py-2 pr-3">{c.pendingAddUser}</td>
                          <td className="py-2 pr-3">{c.pendingUpgrade}</td>
                          <td className="py-2 pr-3 text-xs text-gray-500">{o.id}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "system" && (
        <div className="bg-white p-6 rounded-lg shadow-md border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">System Activation</h3>
              <p className="text-xs text-gray-500">Controls for app enablement and signup flags.</p>
            </div>

            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
            >
              Save
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={appEnabled}
                onChange={(e) => updateField("appEnabled", e.target.checked)}
              />
              <span className="text-sm">App Enabled</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={allowSignup}
                onChange={(e) => updateField("allowSignup", e.target.checked)}
              />
              <span className="text-sm">Allow Signup</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={allowTrack1}
                onChange={(e) => updateField("allowTrack1", e.target.checked)}
              />
              <span className="text-sm">Allow Track 1</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={allowTrack2}
                onChange={(e) => updateField("allowTrack2", e.target.checked)}
              />
              <span className="text-sm">Allow Track 2</span>
            </label>
          </div>

          <div className="mt-4">
            <label className="text-sm font-semibold text-gray-700">Message</label>
            <textarea
              value={message}
              onChange={(e) => updateField("message", e.target.value)}
              className="w-full mt-1 border rounded p-2 text-sm"
              rows={3}
            />
          </div>

          {saveMsg && <div className="mt-3 text-sm">{saveMsg}</div>}
        </div>
      )}
    </div>
  );
};
