import React, { useEffect, useState } from "react";
import { collection, doc, getDocs, query, runTransaction, serverTimestamp, Timestamp, updateDoc, where } from "firebase/firestore";
import { db } from "../src/firebase";
import { logActivityEvent } from "../src/activityLog";
import { useUserProfile } from "../src/useUserProfile";
import { SuperAdminPendingRequests } from "./SuperAdminPendingRequests";

type Props = {
  isSuperAdmin: boolean;
};

type RegistrationRow = {
  id: string;
  companyName?: string;
  orgName?: string;
  email?: string;
  fullName?: string;
  orgId?: string;
  requestedByUid?: string;
  uid?: string;
  primaryContactEmail?: string;
  primaryContactName?: string;
  primaryContactPhone?: string;
  requestedTier?: string;
  status?: string;
  createdAt?: any;
  [key: string]: any;
};

const safeStr = (value: any) => (typeof value === "string" ? value : value == null ? "" : String(value));

const slugify = (name: string) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);

const addDays = (date: Date, days: number) => {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
};

const stripUndefined = (obj: Record<string, any>) => {
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
};

const getOrgDefaultsForTier = (tier: string) => {
  const normalized = String(tier || "").toUpperCase();
  if (normalized === "SPONSORED" || normalized === "CT_SPONSORED") return { maxUsers: 1, billingCycle: "annual" };
  if (normalized === "COMM_L2") return { maxUsers: 25, billingCycle: "annual" };
  return { maxUsers: 10, billingCycle: "annual" };
};

const fmtDate = (value: any): string => {
  try {
    if (!value) return "-";
    if (typeof value?.toDate === "function") return value.toDate().toLocaleDateString();
    if (value instanceof Date) return value.toLocaleDateString();
    return String(value);
  } catch {
    return "-";
  }
};

export const PendingActionsPage: React.FC<Props> = ({ isSuperAdmin }) => {
  const { profile } = useUserProfile();
  const [registrations, setRegistrations] = useState<RegistrationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [counts, setCounts] = useState({ addUser: 0, upgrade: 0 });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!isSuperAdmin) return;
      setLoading(true);
      setError("");
      try {
        const snapshot = await getDocs(query(
          collection(db, "accessRequests"),
          where("type", "==", "orgRegistration"),
          where("status", "==", "pending")
        ));
        if (!cancelled) setRegistrations(snapshot.docs.map(item => ({ id: item.id, ...(item.data() as any) })));
      } catch (loadError) {
        console.error("[pending-actions] registrations load failed", loadError);
        if (!cancelled) setError("Pending registrations are unavailable.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [isSuperAdmin]);

  const approveRegistration = async (registration: RegistrationRow) => {
    if (!isSuperAdmin || busyId === registration.id) return;
    if (registration.status && registration.status !== "pending") return;

    setMessage("");
    setError("");
    setBusyId(registration.id);

    let removed: RegistrationRow | null = null;
    setRegistrations(current => {
      removed = current.find(item => item.id === registration.id) || null;
      return current.filter(item => item.id !== registration.id);
    });

    try {
      const actorUid = safeStr((profile as any)?.uid);
      const actorEmail = safeStr((profile as any)?.email);
      const ownerUid = safeStr(registration.requestedByUid || registration.uid);
      if (!ownerUid) throw new Error("Request missing requestedByUid");

      const orgName = safeStr(registration.orgName || registration.companyName).trim() || "New Organization";
      const requestedTier = safeStr(registration.requestedTier || registration.tier).trim() || "COMM_L1";
      const deterministicOrgId = safeStr(registration.orgId).trim() || `org_${slugify(orgName) || "new"}_${registration.id.slice(0, 6)}`;
      const now = new Date();
      const start = Timestamp.fromDate(now);
      const end = Timestamp.fromDate(addDays(now, 365));
      const isSponsored = ["SPONSORED", "CT_SPONSORED"].includes(String(requestedTier).toUpperCase());
      const { maxUsers, billingCycle } = getOrgDefaultsForTier(requestedTier);
      const primaryEmail = safeStr(registration.primaryContactEmail || registration.email).trim().toLowerCase();
      const primaryName = safeStr(registration.primaryContactName || registration.fullName).trim();
      const primaryPhone = safeStr(registration.primaryContactPhone || registration.phone).trim();
      let approvedOrgId = deterministicOrgId;

      await runTransaction(db, async (tx) => {
        const reqRef = doc(db, "accessRequests", registration.id);
        const reqSnap = await tx.get(reqRef);
        if (!reqSnap.exists()) throw new Error("Request no longer exists");

        const reqData: any = reqSnap.data();
        if (reqData?.type !== "orgRegistration") throw new Error("Not an orgRegistration request");
        if (reqData?.status !== "pending") throw new Error(`Request already ${String(reqData?.status || "processed")}`);

        const orgId = safeStr(reqData?.orgId).trim() || deterministicOrgId;
        approvedOrgId = orgId;

        const orgRef = doc(db, "orgs", orgId);
        const userRef = doc(db, "users", ownerUid);
        const memberRef = doc(db, "orgMembers", orgId, "members", ownerUid);
        const legacyMemberRef = doc(db, "orgs", orgId, "members", ownerUid);

        const [orgSnap, userSnap, memberSnap, legacyMemberSnap] = await Promise.all([
          tx.get(orgRef),
          tx.get(userRef),
          tx.get(memberRef),
          tx.get(legacyMemberRef),
        ]);

        if (!orgSnap.exists()) {
          tx.set(orgRef, stripUndefined({
            name: orgName,
            status: "active",
            address: safeStr(reqData?.address).trim(),
            website: safeStr(reqData?.website).trim(),
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
          }), { merge: true });
        } else {
          tx.set(orgRef, stripUndefined({
            updatedAt: serverTimestamp(),
            name: orgSnap.data()?.name || orgName,
            status: orgSnap.data()?.status || "active",
            ownerUid: orgSnap.data()?.ownerUid || ownerUid,
            primaryContactEmail: orgSnap.data()?.primaryContactEmail || primaryEmail,
            primaryContactName: orgSnap.data()?.primaryContactName || primaryName,
            primaryContactPhone: orgSnap.data()?.primaryContactPhone || primaryPhone,
          }), { merge: true });
        }

        tx.set(memberRef, {
          uid: ownerUid,
          displayName: primaryName,
          email: primaryEmail,
          active: true,
          status: "active",
          joinedAt: memberSnap.data()?.joinedAt || serverTimestamp(),
          createdAt: memberSnap.data()?.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
          role: "orgAdmin",
          superAdmin: false,
        }, { merge: true });

        tx.set(legacyMemberRef, {
          uid: ownerUid,
          displayName: primaryName,
          email: primaryEmail,
          active: true,
          status: "active",
          joinedAt: legacyMemberSnap.data()?.joinedAt || serverTimestamp(),
          createdAt: legacyMemberSnap.data()?.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
          role: "orgAdmin",
          superAdmin: false,
        }, { merge: true });

        tx.set(userRef, stripUndefined({
          uid: ownerUid,
          orgId,
          email: primaryEmail,
          displayName: primaryName,
          fullName: primaryName,
          phone: primaryPhone,
          status: "active",
          track: safeStr(reqData?.track || "TRACK_1"),
          singleUserOnly: isSponsored,
          roles: { ...(userSnap.data()?.roles || {}), orgRole: "orgAdmin" },
          createdAt: userSnap.exists() ? userSnap.data()?.createdAt || serverTimestamp() : serverTimestamp(),
          updatedAt: serverTimestamp(),
        }), { merge: true });

        tx.update(reqRef, {
          status: "approved",
          orgId,
          approvedAt: serverTimestamp(),
          approvedByUid: actorUid || null,
          updatedAt: serverTimestamp(),
        });
      });

      void logActivityEvent({
        orgId: approvedOrgId,
        orgName,
        action: "registration.approved",
        actorUid,
        actorEmail,
        targetType: "accessRequest",
        targetId: registration.id,
        targetLabel: primaryEmail || orgName,
        summary: `Registration approved for ${orgName}`,
        metadata: { requestedTier, ownerUid, primaryEmail },
      });

      setMessage(`Approved registration for ${primaryEmail || orgName}.`);
    } catch (approveError: any) {
      console.error("[pending-actions] approve failed", approveError);
      if (removed) setRegistrations(current => [removed as RegistrationRow, ...current]);
      setError(`Approve failed: ${approveError?.message || approveError}`);
    } finally {
      setBusyId(null);
    }
  };

  const cancelRegistration = async (registration: RegistrationRow) => {
    if (!isSuperAdmin || busyId === registration.id) return;
    if (registration.status && registration.status !== "pending") return;
    setMessage("");
    setError("");
    setBusyId(registration.id);
    try {
      const actorUid = safeStr((profile as any)?.uid);
      const actorEmail = safeStr((profile as any)?.email);
      await updateDoc(doc(db, "accessRequests", registration.id), {
        status: "cancelled",
        cancelledAt: serverTimestamp(),
        cancelledByUid: actorUid || null,
        cancelledByEmail: actorEmail,
        cancelledBy: actorEmail || actorUid || "superAdmin",
        updatedAt: serverTimestamp(),
      });
      setRegistrations(current => current.filter(item => item.id !== registration.id));
      setMessage(`Cancelled registration for ${registration.email || registration.orgName || registration.id}.`);
    } catch (cancelError: any) {
      console.error("[pending-actions] cancel failed", cancelError);
      setError(`Cancel failed: ${cancelError?.message || cancelError}`);
    } finally {
      setBusyId(null);
    }
  };

  if (!isSuperAdmin) {
    return (
      <section className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-900">
        <h1 className="text-xl font-bold">Pending Actions</h1>
        <p className="mt-2 text-sm">SuperAdmin access is required.</p>
      </section>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      <section className="rounded-lg border bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase text-blue-700">SuperAdmin consolidation</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Pending Actions</h1>
        <p className="mt-2 text-sm text-gray-600">Review pending registrations, add-user/invitation requests, and tier upgrade requests in one place.</p>
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-lg border bg-white p-4 shadow-sm"><div className="text-xs font-semibold uppercase text-gray-500">Pending Registrations</div><div className="mt-2 text-2xl font-bold text-gray-900">{registrations.length}</div></div>
        <div className="rounded-lg border bg-white p-4 shadow-sm"><div className="text-xs font-semibold uppercase text-gray-500">Pending Add-User / Invitations</div><div className="mt-2 text-2xl font-bold text-gray-900">{counts.addUser}</div></div>
        <div className="rounded-lg border bg-white p-4 shadow-sm"><div className="text-xs font-semibold uppercase text-gray-500">Pending Upgrade Requests</div><div className="mt-2 text-2xl font-bold text-gray-900">{counts.upgrade}</div></div>
      </section>

      <section className="rounded-lg border bg-white shadow-sm">
        <div className="border-b p-4">
          <h2 className="font-semibold text-gray-900">Pending Registrations</h2>
          <p className="mt-1 text-xs text-gray-500">Approve or cancel organization registrations from the consolidated SuperAdmin queue.</p>
        </div>
        {message ? <p className="border-b border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p> : null}
        {loading ? <p className="p-4 text-sm text-gray-600">Loading pending registrations...</p> : error ? <p className="p-4 text-sm text-red-700">{error}</p> : registrations.length === 0 ? <p className="p-4 text-sm text-gray-600">No pending registrations.</p> :
        <div className="overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="p-3">Organization</th><th className="p-3">User</th><th className="p-3">Requested Tier</th><th className="p-3">Created</th><th className="p-3">Status</th><th className="p-3">Actions</th></tr></thead>
            <tbody>{registrations.map(registration => <tr key={registration.id} className="border-t"><td className="p-3">{registration.orgName || registration.companyName || registration.id}</td><td className="p-3"><div>{registration.fullName || registration.primaryContactName || "Not provided"}</div><div className="text-xs text-gray-500">{registration.email || registration.primaryContactEmail || ""}</div></td><td className="p-3">{registration.requestedTier || registration.tier || "Not provided"}</td><td className="p-3">{fmtDate(registration.createdAt)}</td><td className="p-3">{registration.status || "pending"}</td><td className="p-3"><div className="flex gap-2"><button type="button" onClick={() => approveRegistration(registration)} disabled={busyId === registration.id} className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">{busyId === registration.id ? "Working..." : "Approve"}</button><button type="button" onClick={() => cancelRegistration(registration)} disabled={busyId === registration.id} className="rounded bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60">{busyId === registration.id ? "Working..." : "Cancel"}</button></div></td></tr>)}</tbody>
          </table>
        </div>}
      </section>

      <SuperAdminPendingRequests onCountsChange={setCounts} />
    </div>
  );
};
