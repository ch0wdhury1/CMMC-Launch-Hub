import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "../src/firebase";
import { loadCleanupControlsInventory, runCleanupControlAction, type CleanupOrgSummary } from "../src/cleanupControls";
import { useUserProfile } from "../src/useUserProfile";
import { OrganizationUsers } from "./OrganizationUsers";

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

type OrgAdminDraft = {
  status: string;
  tier: string;
  subscriptionStatus: string;
  subscriptionStartDate: string;
  subscriptionEndDate: string;
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

function dateInput(v: any): string {
  try {
    if (!v) return "";
    const parsed = typeof v?.toDate === "function" ? v.toDate() : v?._seconds ? new Date(v._seconds * 1000) : new Date(v);
    return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

export const SuperAdminPanel: React.FC = () => {
  // --- auth/profile ---
  const { loading: profileLoading, profile } = useUserProfile();
  const rolesAny: any = (profile as any)?.roles || {};
  const isSuperAdmin = rolesAny?.superAdmin === true;

  // --- tabs ---
  const [tab, setTab] = useState<"orgs" | "inactiveOrgs" | "archivedOrgs" | "system">("orgs");

  // --- system/activation ---
  const [activationLoading, setActivationLoading] = useState(true);
  const [activation, setActivation] = useState<ActivationDoc | null>(null);
  const [saveMsg, setSaveMsg] = useState<string>("");

  const activationRef = useMemo(() => doc(db, "system", "activation"), []);

  // --- orgs + requests ---
  const [orgsLoading, setOrgsLoading] = useState(false);
  const [orgsError, setOrgsError] = useState<string | null>(null);
  const [orgs, setOrgs] = useState<OrgComputed[]>([]);
  const [orgAdminMetadata, setOrgAdminMetadata] = useState<Record<string, CleanupOrgSummary>>({});
  const [orgAdminDrafts, setOrgAdminDrafts] = useState<Record<string, OrgAdminDraft>>({});
  const [selectedUsersOrg, setSelectedUsersOrg] = useState<OrgComputed | null>(null);

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
    if (req.status && req.status !== "pending") return;
    if (actionBusyId === req.id) return;

    setSaveMsg("");
    setActionBusyId(req.id);

    // Optimistic UI removal (must disappear immediately)
    let removed: AccessRequestRow | null = null;
    setPendingRegistrations((prev) => {
      removed = prev.find((r) => r.id === req.id) || null;
      return prev.filter((r) => r.id !== req.id);
    });





  try {
    const ownerUid = safeStr((req as any).requestedByUid || (req as any).uid);
    if (!ownerUid) throw new Error("Request missing requestedByUid");

    const orgName = safeStr((req as any).orgName).trim() || "New Organization";
    const requestedTier = safeStr((req as any).requestedTier).trim() || "COMM_L1";

    // Deterministic orgId to ensure idempotency across retries
    const deterministicOrgId =
      safeStr((req as any).orgId).trim() || `org_${slugify(orgName) || "new"}_${req.id.slice(0, 6)}`;

    const now = new Date();
    const start = Timestamp.fromDate(now);
    const end = Timestamp.fromDate(addDays(now, 365));

    const isSponsored =
      String(requestedTier || "").toUpperCase() === "SPONSORED" ||
      String(requestedTier || "").toUpperCase() === "CT_SPONSORED";

    const { maxUsers, billingCycle } = getOrgDefaultsForTier(requestedTier);

    const primaryEmail = safeStr((req as any).primaryContactEmail || (req as any).email)
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

      // Idempotency: do nothing if not pending
      if (reqData?.status !== "pending") throw new Error(`Request already ${String(reqData?.status || "processed")}`);

      const orgId = safeStr(reqData?.orgId).trim() || deterministicOrgId;

      const orgRef = doc(db, "orgs", orgId);
      const userRef = doc(db, "users", ownerUid);

      // Required membership schema
      const memberRef = doc(db, "orgMembers", orgId, "members", ownerUid);

      // Back-compat membership (your rules/helpers still check this path)
      const legacyMemberRef = doc(db, "orgs", orgId, "members", ownerUid);

      // ✅ ALL READS FIRST (Firestore transaction requirement)
      const [orgSnap, userSnap, memberSnap, legacyMemberSnap] = await Promise.all([
        tx.get(orgRef),
        tx.get(userRef),
        tx.get(memberRef),
        tx.get(legacyMemberRef),
      ]);

      // ✅ WRITES ONLY (no more tx.get after this point)
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
        // Don't recreate; only ensure key fields exist
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

      if (!memberSnap.exists()) {
        tx.set(memberRef, { createdAt: serverTimestamp(), role: "orgAdmin", superAdmin: false }, { merge: true });
      }

      if (!legacyMemberSnap.exists()) {
        tx.set(legacyMemberRef, { createdAt: serverTimestamp(), role: "orgAdmin", superAdmin: false }, { merge: true });
      }

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

      tx.update(reqRef, {
        status: "approved",
        orgId,
        approvedAt: serverTimestamp(),
        approvedByUid: (profile as any)?.uid || null,
        updatedAt: serverTimestamp(),
      });
    });





    setSaveMsg(`✅ Approved: ${primaryEmail || req.id}`);
  } catch (e: any) {
    console.error(e);
    // Rollback optimistic removal if approve failed
    if (removed) {
      setPendingRegistrations((prev) => [removed as any, ...prev]);
    }
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
        deniedAt: serverTimestamp(),
        deniedByUid: (profile as any)?.uid || null,
        updatedAt: serverTimestamp(),
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

  const refreshOrgAdminMetadata = async () => {
    if (!isSuperAdmin) return;
    try {
      const inventory = await loadCleanupControlsInventory();
      setOrgAdminMetadata(Object.fromEntries(inventory.orgs.map(org => [org.id, org])));
    } catch (error) {
      console.warn("org cleanup metadata load failed:", error);
    }
  };

  const updateOrgDraft = (orgId: string, key: keyof OrgAdminDraft, value: string) => {
    setOrgAdminDrafts(current => ({
      ...current,
      [orgId]: {...current[orgId], [key]: value},
    }));
  };

  const saveOrgAdminFields = async (org: OrgComputed) => {
    const draft = orgAdminDrafts[org.id];
    if (!draft) return;
    const originalStatus = safeStr((org as any).status || "active");
    const confirmation = draft.status === "archived" && originalStatus !== "archived"
      ? "Archive this organization? This will not delete data."
      : originalStatus === "archived" && draft.status !== "archived"
        ? "Reactivate this organization?"
        : "Save these organization status and tier changes?";
    if (!window.confirm(confirmation)) return;
    setActionBusyId(`org-save:${org.id}`);
    setSaveMsg("");
    try {
      await runCleanupControlAction({action: "update_org_admin_fields", orgId: org.id, cleanupPhase: "23C-UI", updates: draft});
      setOrgs(current => current.map(item => item.id === org.id ? {...item, ...draft} : item));
      await refreshOrgAdminMetadata();
      setSaveMsg(`Saved organization: ${org.id}`);
    } catch (error: any) {
      setSaveMsg(`Save failed: ${error?.message || error}`);
    } finally {
      setActionBusyId(null);
    }
  };

  const safeDeleteOrgFromTable = async (org: OrgComputed) => {
    const metadata = orgAdminMetadata[org.id];
    if (!metadata?.safeDeleteEligible) return;
    const required = `DELETE ${org.id}`;
    const confirmation = window.prompt(`Type ${required} to permanently delete only this empty organization document.`);
    if (confirmation !== required) return;
    setActionBusyId(`org-delete:${org.id}`);
    setSaveMsg("");
    try {
      await runCleanupControlAction({action: "safe_delete_empty_org", orgId: org.id, cleanupPhase: "23C-UI", updates: {confirmation}});
      setOrgs(current => current.filter(item => item.id !== org.id));
      setOrgAdminMetadata(current => {
        const next = {...current};
        delete next[org.id];
        return next;
      });
      setSaveMsg(`Deleted empty organization document: ${org.id}`);
    } catch (error: any) {
      setSaveMsg(`Delete failed: ${error?.message || error}`);
      await refreshOrgAdminMetadata();
    } finally {
      setActionBusyId(null);
    }
  };

  const deleteBlockerText = (orgId: string) => {
    const metadata = orgAdminMetadata[orgId];
    if (!metadata) return "Delete unavailable: safety check is loading. Archive instead.";
    if (metadata.safeDeleteEligible) return "Delete empty organization document";
    return `Delete unavailable: ${metadata.safeDeleteBlockers.join(", ")}. Archive instead.`;
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

  useEffect(() => {
    refreshOrgAdminMetadata();
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

        if (!cancelled) {
          setOrgs(computed);
          setOrgAdminDrafts(Object.fromEntries(computed.map(org => [org.id, {
            status: safeStr((org as any).status || "active"),
            tier: safeStr(org.tier || "COMM_L1"),
            subscriptionStatus: safeStr(org.subscriptionStatus || "active"),
            subscriptionStartDate: dateInput(org.subscriptionStartDate),
            subscriptionEndDate: dateInput(org.subscriptionEndDate),
          }])));
        }
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
  const activeOrgs = orgs.filter(org => safeStr((org as any).status || "active") === "active");
  const inactiveOrgs = orgs.filter(org => safeStr((org as any).status) === "inactive");
  const archivedOrgs = orgs.filter(org => safeStr((org as any).status) === "archived");

  const renderOrgTable = (rows: OrgComputed[], emptyMessage: string, showDelete = true) => rows.length === 0 ? (
    <div className="p-4 text-sm text-gray-600">{emptyMessage}</div>
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
            <th className="text-left p-3">Save</th>
            {showDelete && <th className="text-left p-3">Delete</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((org) => (
            <tr key={org.id} className="border-t">
              <td className="p-3"><div className="font-medium text-gray-900">{org.name || org.id}</div></td>
              <td className="p-3">
                <select value={orgAdminDrafts[org.id]?.status || "active"} onChange={event => updateOrgDraft(org.id, "status", event.target.value)} className="border rounded px-2 py-1 text-xs" disabled={org.id === "cyber_blue_star"}>
                  <option value="active">active</option><option value="inactive">inactive</option><option value="archived">archived</option>
                </select>
              </td>
              <td className="p-3">
                <select value={orgAdminDrafts[org.id]?.tier || "COMM_L1"} onChange={event => updateOrgDraft(org.id, "tier", event.target.value)} className="border rounded px-2 py-1 text-xs">
                  <option value="SPONSORED">SPONSORED</option><option value="COMM_L1">COMM_L1</option><option value="COMM_L2">COMM_L2</option>
                </select>
              </td>
              <td className="p-3"><button type="button" onClick={() => setSelectedUsersOrg(org)} className="font-medium text-blue-700 hover:underline">{org.memberCount}</button></td>
              <td className="p-3"><div>{org.primaryContactName || "—"}</div><div className="text-xs text-gray-500">{org.primaryContactEmail || ""}</div></td>
              <td className="p-3"><input type="date" value={orgAdminDrafts[org.id]?.subscriptionStartDate || ""} onChange={event => updateOrgDraft(org.id, "subscriptionStartDate", event.target.value)} className="border rounded px-2 py-1 text-xs" /></td>
              <td className="p-3"><input type="date" value={orgAdminDrafts[org.id]?.subscriptionEndDate || ""} onChange={event => updateOrgDraft(org.id, "subscriptionEndDate", event.target.value)} className="border rounded px-2 py-1 text-xs" /></td>
              <td className="p-3">{org.pending?.addUser ?? 0}</td>
              <td className="p-3">{org.pending?.upgrade ?? 0}</td>
              <td className="p-3"><button type="button" onClick={() => saveOrgAdminFields(org)} disabled={actionBusyId === `org-save:${org.id}`} className="px-2 py-1 rounded bg-blue-600 text-white text-xs hover:bg-blue-700 disabled:opacity-50">Save</button></td>
              {showDelete && <td className="p-3">
                <button type="button" onClick={() => safeDeleteOrgFromTable(org)} disabled={!orgAdminMetadata[org.id]?.safeDeleteEligible || actionBusyId === `org-delete:${org.id}`} title={deleteBlockerText(org.id)} className="px-2 py-1 rounded bg-rose-700 text-white text-xs hover:bg-rose-800 disabled:opacity-40">Delete</button>
                {!orgAdminMetadata[org.id]?.safeDeleteEligible && <p className="mt-1 max-w-56 text-[10px] leading-tight text-gray-500">{deleteBlockerText(org.id)}</p>}
              </td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

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
            Active Orgs
          </button>
          <button
            type="button"
            onClick={() => setTab("inactiveOrgs")}
            className={
              "px-3 py-1.5 rounded-md text-sm border " +
              (tab === "inactiveOrgs"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50")
            }
          >
            Inactive Orgs
          </button>
          <button
            type="button"
            onClick={() => setTab("archivedOrgs")}
            className={
              "px-3 py-1.5 rounded-md text-sm border " +
              (tab === "archivedOrgs"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50")
            }
          >
            Archived Orgs
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

          {/* Active Orgs Table */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-gray-900">Active Orgs</h3>
              <p className="text-xs text-gray-500">Active and legacy organizations with no status. Inactive and archived organizations have separate views.</p>
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
                      <th className="text-left p-3">Save</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeOrgs.map((o) => (
                      <tr key={o.id} className="border-t">
                        <td className="p-3">
                          <div className="font-medium text-gray-900">{o.name || o.id}</div>
                        </td>
                        <td className="p-3">
                          <select value={orgAdminDrafts[o.id]?.status || "active"} onChange={event => updateOrgDraft(o.id, "status", event.target.value)} className="border rounded px-2 py-1 text-xs" disabled={o.id === "cyber_blue_star"}>
                            <option value="active">active</option><option value="inactive">inactive</option><option value="archived">archived</option>
                          </select>
                        </td>
                        <td className="p-3">
                          <select value={orgAdminDrafts[o.id]?.tier || "COMM_L1"} onChange={event => updateOrgDraft(o.id, "tier", event.target.value)} className="border rounded px-2 py-1 text-xs">
                            <option value="SPONSORED">SPONSORED</option><option value="COMM_L1">COMM_L1</option><option value="COMM_L2">COMM_L2</option>
                          </select>
                        </td>
                        <td className="p-3">
                          <button type="button" onClick={() => setSelectedUsersOrg(o)} className="font-medium text-blue-700 hover:underline">{o.memberCount}</button>
                        </td>
                        <td className="p-3">
                          <div>{o.primaryContactName || "—"}</div>
                          <div className="text-xs text-gray-500">{o.primaryContactEmail || ""}</div>
                        </td>
                        <td className="p-3"><input type="date" value={orgAdminDrafts[o.id]?.subscriptionStartDate || ""} onChange={event => updateOrgDraft(o.id, "subscriptionStartDate", event.target.value)} className="border rounded px-2 py-1 text-xs" /></td>
                        <td className="p-3"><input type="date" value={orgAdminDrafts[o.id]?.subscriptionEndDate || ""} onChange={event => updateOrgDraft(o.id, "subscriptionEndDate", event.target.value)} className="border rounded px-2 py-1 text-xs" /></td>
                        <td className="p-3">{o.pending?.addUser ?? 0}</td>
                        <td className="p-3">{o.pending?.upgrade ?? 0}</td>
                        <td className="p-3"><button type="button" onClick={() => saveOrgAdminFields(o)} disabled={actionBusyId === `org-save:${o.id}`} className="px-2 py-1 rounded bg-blue-600 text-white text-xs hover:bg-blue-700 disabled:opacity-50">Save</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "inactiveOrgs" && (
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-gray-900">Inactive Orgs</h3>
            <p className="text-xs text-gray-500">Inactive organizations remain available for review and can be reactivated by changing status and saving.</p>
          </div>
          {orgsLoading ? <div className="p-4 text-sm text-gray-600">Loading inactive orgs...</div> : orgsError ? <div className="p-4 text-sm text-red-600">Error: {orgsError}</div> : renderOrgTable(inactiveOrgs, "No inactive orgs found.", false)}
        </div>
      )}

      {tab === "archivedOrgs" && (
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-gray-900">Archived Orgs</h3>
            <p className="text-xs text-gray-500">Archived organizations remain available for review and can be reactivated by changing status and saving.</p>
          </div>
          {orgsLoading ? <div className="p-4 text-sm text-gray-600">Loading archived orgsâ€¦</div> : orgsError ? <div className="p-4 text-sm text-red-600">Error: {orgsError}</div> : renderOrgTable(archivedOrgs, "No archived orgs found.")}
        </div>
      )}

      {selectedUsersOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[85vh] w-full max-w-6xl overflow-y-auto">
            <OrganizationUsers orgId={selectedUsersOrg.id} orgName={selectedUsersOrg.name || selectedUsersOrg.id} isSuperAdmin onClose={() => setSelectedUsersOrg(null)} />
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
