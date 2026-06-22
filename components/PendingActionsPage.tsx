import React, { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../src/firebase";
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
  requestedTier?: string;
  status?: string;
};

export const PendingActionsPage: React.FC<Props> = ({ isSuperAdmin }) => {
  const [registrations, setRegistrations] = useState<RegistrationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
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
          <p className="mt-1 text-xs text-gray-500">Organization registrations still require final action from the SuperAdmin panel.</p>
        </div>
        {loading ? <p className="p-4 text-sm text-gray-600">Loading pending registrations...</p> : error ? <p className="p-4 text-sm text-red-700">{error}</p> : registrations.length === 0 ? <p className="p-4 text-sm text-gray-600">No pending registrations.</p> :
        <div className="overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="p-3">Organization</th><th className="p-3">User</th><th className="p-3">Requested Tier</th><th className="p-3">Status</th></tr></thead>
            <tbody>{registrations.map(registration => <tr key={registration.id} className="border-t"><td className="p-3">{registration.orgName || registration.companyName || registration.id}</td><td className="p-3">{registration.email || registration.fullName || "Not provided"}</td><td className="p-3">{registration.requestedTier || "Not provided"}</td><td className="p-3">{registration.status || "pending"}</td></tr>)}</tbody>
          </table>
        </div>}
      </section>

      <SuperAdminPendingRequests onCountsChange={setCounts} />
    </div>
  );
};
