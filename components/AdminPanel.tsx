import React from "react";
import { useUserProfile } from "../src/useUserProfile";

/**
 * Org Admin Panel (MVP)
 *
 * - Visible to: roles.orgRole === "orgAdmin" (and also superAdmin).
 * - Keep this minimal for now; we will extend it in the Admin milestone.
 */
export const AdminPanel: React.FC = () => {
  const { loading: profileLoading, profile } = useUserProfile();

  const orgRole = (profile as any)?.roles?.orgRole;
  const isOrgAdmin = orgRole === "orgAdmin";
  const isSuperAdmin = !!(profile as any)?.roles?.superAdmin;
  const orgId = (profile as any)?.orgId || (profile as any)?.company?.orgId || "—";

  if (profileLoading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="text-sm text-gray-600">Loading Admin Panel…</div>
      </div>
    );
  }

  if (!isOrgAdmin && !isSuperAdmin) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md border border-red-100">
        <h2 className="text-xl font-bold text-gray-800 mb-2">Admin Panel</h2>
        <p className="text-sm text-red-600">You don’t have access to this area.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-bold text-gray-900">Admin Panel</h2>
        <p className="text-sm text-gray-600 mt-1">
          Org: <span className="font-mono">{String(orgId)}</span>
        </p>

        {isSuperAdmin && (
          <div className="mt-3 rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
            You’re signed in as <strong>Super Admin</strong>. Use the <strong>Super Admin</strong> button in the header
            for platform-wide settings.
          </div>
        )}

        <div className="mt-6">
          <h3 className="text-lg font-semibold text-gray-900">MVP Scope (coming next)</h3>
          <ul className="mt-2 list-disc pl-5 text-sm text-gray-700 space-y-1">
            <li>View registration / add-user requests (pending / approved / rejected)</li>
            <li>Approve / reject requests (writes to Firestore + email invite)</li>
            <li>Manage org users (add/remove, change orgRole)</li>
            <li>Request tier upgrades (COMM_L1 → COMM_L2)</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
