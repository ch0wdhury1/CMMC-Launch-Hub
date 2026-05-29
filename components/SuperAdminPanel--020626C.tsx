import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
  where,
  serverTimestamp,
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

type AccessRequest = {
  id: string;
  type?: string;
  status?: string;
  orgId?: string;
  orgName?: string;
  requestedTier?: string;
  website?: string;
  address?: string;

  primaryContactName?: string;
  primaryContactPhone?: string;
  primaryContactEmail?: string;

  ownerEmail?: string; // legacy alias (same as primaryContactEmail)
  email?: string;      // convenience alias
  fullName?: string;   // convenience alias

  requestedByUid?: string;
  createdAt?: any;
  [key: string]: any;
};

const safeString = (v: any) => (typeof v === "string" ? v : "");
const toOrgId = (orgName: string) =>
  ("org_" +
    orgName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40)) || "org_new";

const fmtDate = (ts: any) => {
  try {
    const d = ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null;
    return d ? d.toLocaleString() : "—";
  } catch {
    return "—";
  }
};

export const SuperAdminPanel: React.FC = () => {
  const { loading: profileLoading, profile } = useUserProfile();
  const rolesAny: any = (profile as any)?.roles || {};
  const isSuperAdmin = rolesAny?.superAdmin === true;

  const [tab, setTab] = useState<"registrations" | "system">("registrations");

  // ---------- SYSTEM / ACTIVATION ----------
  const [loadingSystem, setLoadingSystem] = useState(true);
  const [activation, setActivation] = useState<ActivationDoc | null>(null);
  const [saveMsg, setSaveMsg] = useState<string>("");

  const activationRef = useMemo(() => doc(db, "system", "activation"), []);

  useEffect(() => {
    if (!isSuperAdmin) {
      setLoadingSystem(false);
      return;
    }

    const unsub = onSnapshot(
      activationRef,
      (snap) => {
        setActivation((snap.data() || {}) as ActivationDoc);
        setLoadingSystem(false);
      },
      (err) => {
        console.error("activation snapshot error:", err);
        setLoadingSystem(false);
      }
    );
    return () => unsub();
  }, [activationRef, isSuperAdmin]);

  const updateField = (key: string, value: any) => {
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

  // ---------- REGISTRATIONS ----------
  const [pendingRegs, setPendingRegs] = useState<AccessRequest[]>([]);
  const [loadingRegs, setLoadingRegs] = useState(true);
  const [regsError, setRegsError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string>("");

  useEffect(() => {
    if (!isSuperAdmin) {
      setLoadingRegs(false);
      return;
    }

    setLoadingRegs(true);
    setRegsError(null);

    const q = query(
      collection(db, "accessRequests"),
      where("type", "==", "orgRegistration"),
      where("status", "==", "pending")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: AccessRequest[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));
        // newest first (best-effort)
        rows.sort((a, b) => {
          const at = a?.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const bt = b?.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return bt - at;
        });
        setPendingRegs(rows);
        setLoadingRegs(false);
      },
      (err) => {
        console.error("pending registrations snapshot error:", err);
        setRegsError(err?.message || String(err));
        setLoadingRegs(false);
      }
    );

    return () => unsub();
  }, [isSuperAdmin]);

  const approveRegistration = async (r: AccessRequest) => {
    if (!isSuperAdmin) return;

    const orgName = safeString(r.orgName);
    const orgId = safeString(r.orgId) || toOrgId(orgName);
    const uid = safeString(r.requestedByUid);
    if (!orgId || !uid) {
      alert("Missing orgId or requestedByUid on this request.");
      return;
    }

    const tier = safeString(r.requestedTier) || "COMM_L1";
    const maxUsers = tier === "SPONSORED" ? 1 : tier === "COMM_L1" ? 10 : 50;

    const primaryContactEmail =
      safeString(r.primaryContactEmail) ||
      safeString(r.ownerEmail) ||
      safeString(r.email);
    const primaryContactName =
      safeString(r.primaryContactName) || safeString(r.fullName);
    const primaryContactPhone = safeString(r.primaryContactPhone);

    const ok = window.confirm(
      `Approve registration?\n\nOrg: ${orgName || orgId}\nTier: ${tier}\nPrimary: ${primaryContactEmail || "—"}`
    );
    if (!ok) return;

    setActionMsg("");

    try {
      // 1) Create/merge org
      await setDoc(
        doc(db, "orgs", orgId),
        {
          name: orgName || orgId,
          address: safeString(r.address),
          website: safeString(r.website),

          tier,
          subscriptionStatus: "active",

          maxUsers,
          activeMemberCount: 1,

          ownerUid: uid,
          primaryContactEmail,
          primaryContactName,
          primaryContactPhone,

          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // 2) Create/merge org member (owner as orgAdmin)
      await setDoc(
        doc(db, "orgMembers", orgId, "members", uid),
        {
          createdAt: serverTimestamp(),
          role: "orgAdmin",
          superAdmin: false,
        },
        { merge: true }
      );

      // 3) Activate user doc (connect to org + active)
      await setDoc(
        doc(db, "users", uid),
        {
          orgId,
          status: "active",
          email: primaryContactEmail || undefined,
          fullName: primaryContactName || undefined,
          phone: primaryContactPhone || undefined,
          roles: { orgRole: "orgAdmin" },
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // 4) Mark request approved
      await setDoc(
        doc(db, "accessRequests", r.id),
        {
          status: "approved",
          orgId,
          approvedAt: serverTimestamp(),
          approvedByUid: (profile as any)?.uid || undefined,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setActionMsg(`✅ Approved ${orgName || orgId}`);
      console.log("✅ Approved orgRegistration:", { orgId, uid, reqId: r.id });
    } catch (e: any) {
      console.error("❌ approveRegistration failed:", e);
      setActionMsg(`❌ Approve failed: ${e?.message || String(e)}`);
      alert(`Approve failed: ${e?.message || e}`);
    }
  };

  const denyRegistration = async (r: AccessRequest) => {
    if (!isSuperAdmin) return;
    const orgName = safeString(r.orgName) || safeString(r.orgId) || r.id;

    const ok = window.confirm(`Deny registration request for: ${orgName}?`);
    if (!ok) return;

    setActionMsg("");
    try {
      await setDoc(
        doc(db, "accessRequests", r.id),
        {
          status: "denied",
          deniedAt: serverTimestamp(),
          deniedByUid: (profile as any)?.uid || undefined,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setActionMsg(`✅ Denied ${orgName}`);
    } catch (e: any) {
      console.error("❌ denyRegistration failed:", e);
      setActionMsg(`❌ Deny failed: ${e?.message || String(e)}`);
      alert(`Deny failed: ${e?.message || e}`);
    }
  };

  // ---------- RENDER ----------
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

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center gap-2">
        <button
          className={`px-3 py-1.5 rounded border text-sm ${
            tab === "registrations" ? "bg-blue-600 text-white border-blue-600" : "bg-white"
          }`}
          onClick={() => setTab("registrations")}
        >
          Registrations
        </button>
        <button
          className={`px-3 py-1.5 rounded border text-sm ${
            tab === "system" ? "bg-blue-600 text-white border-blue-600" : "bg-white"
          }`}
          onClick={() => setTab("system")}
        >
          System
        </button>
      </div>

      {tab === "registrations" && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Pending Registrations</h2>
            <div className="text-sm text-gray-600">
              {loadingRegs ? "Loading…" : `${pendingRegs.length} pending`}
            </div>
          </div>

          <p className="text-xs text-gray-500 mt-1">
            Source: <code>accessRequests</code> where <code>type=orgRegistration</code> and{" "}
            <code>status=pending</code>.
          </p>

          {regsError && <div className="mt-3 text-sm text-red-600">Error: {regsError}</div>}
          {actionMsg && <div className="mt-3 text-sm">{actionMsg}</div>}

          <div className="mt-4 overflow-auto border rounded">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left">
                  <th className="py-2 px-3">Company</th>
                  <th className="py-2 px-3">Tier</th>
                  <th className="py-2 px-3">Primary Contact</th>
                  <th className="py-2 px-3">Email</th>
                  <th className="py-2 px-3">Phone</th>
                  <th className="py-2 px-3">Created</th>
                  <th className="py-2 px-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingRegs ? (
                  <tr>
                    <td className="py-3 px-3 text-gray-500" colSpan={7}>
                      Loading…
                    </td>
                  </tr>
                ) : pendingRegs.length === 0 ? (
                  <tr>
                    <td className="py-3 px-3 text-gray-500" colSpan={7}>
                      No pending registrations.
                    </td>
                  </tr>
                ) : (
                  pendingRegs.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="py-2 px-3 font-medium">{r.orgName || r.orgId || "—"}</td>
                      <td className="py-2 px-3">{r.requestedTier || "—"}</td>
                      <td className="py-2 px-3">{r.primaryContactName || r.fullName || "—"}</td>
                      <td className="py-2 px-3">
                        {r.primaryContactEmail || r.ownerEmail || r.email || "—"}
                      </td>
                      <td className="py-2 px-3">{r.primaryContactPhone || "—"}</td>
                      <td className="py-2 px-3">{fmtDate(r.createdAt)}</td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <button
                            className="px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700"
                            onClick={() => approveRegistration(r)}
                          >
                            Approve
                          </button>
                          <button
                            className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700"
                            onClick={() => denyRegistration(r)}
                          >
                            Deny
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "system" && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">System Activation</h2>
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

          {loadingSystem ? (
            <div className="mt-3 text-sm text-gray-600">Loading system settings…</div>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex items-center justify-between border rounded p-3 bg-gray-50">
                  <span className="text-sm font-medium text-gray-800">App Enabled</span>
                  <input
                    type="checkbox"
                    checked={appEnabled}
                    onChange={(e) => updateField("appEnabled", e.target.checked)}
                  />
                </label>

                <label className="flex items-center justify-between border rounded p-3 bg-gray-50">
                  <span className="text-sm font-medium text-gray-800">Allow Signup</span>
                  <input
                    type="checkbox"
                    checked={allowSignup}
                    onChange={(e) => updateField("allowSignup", e.target.checked)}
                  />
                </label>

                <label className="flex items-center justify-between border rounded p-3 bg-gray-50">
                  <span className="text-sm font-medium text-gray-800">
                    Allow Track 1 (CT Sponsored)
                  </span>
                  <input
                    type="checkbox"
                    checked={allowTrack1}
                    onChange={(e) => updateField("allowTrack1", e.target.checked)}
                  />
                </label>

                <label className="flex items-center justify-between border rounded p-3 bg-gray-50">
                  <span className="text-sm font-medium text-gray-800">Allow Track 2</span>
                  <input
                    type="checkbox"
                    checked={allowTrack2}
                    onChange={(e) => updateField("allowTrack2", e.target.checked)}
                  />
                </label>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-800 mb-1">
                  Announcement Message
                </label>
                <textarea
                  className="w-full border rounded p-2 text-sm"
                  rows={3}
                  value={message}
                  onChange={(e) => updateField("message", e.target.value)}
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
