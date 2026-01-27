import React, { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { Upload } from "lucide-react";

import { auth } from "../src/firebase";
import { fileToBase64 } from "../services/fileUtils";

import { useOrgMember } from "../src/useOrgMember";


import { useUserProfile } from "../src/useUserProfile";
import { upsertUserCompany } from "../src/userCompany";

import { CompanyProfile, UserProfile } from "../types";

export const ProfilePage: React.FC = () => {

// ✅ Firestore-backed user profile + entitlements
const { loading, tier, track, profile } = useUserProfile();
const ent = (profile?.entitlements ?? {}) as Record<string, any>;

// ✅ single-user mode flag (Option 1)
const singleUserOnly = !!profile?.singleUserOnly;

// ✅ orgId (only relevant when singleUserOnly is false)
const orgId =
  (profile as any)?.orgId ??
  (profile as any)?.company?.orgId ??
  null;

// ✅ Only query org membership if needed
const shouldCheckOrg = !singleUserOnly && !!orgId;

const {
  loading: orgLoading,
  member,
  error: orgError,
} = useOrgMember(shouldCheckOrg ? (orgId as string) : undefined);




  // ✅ uid (reliable)
  const [uid, setUid] = useState<string | null>(null);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null));
    return () => unsub();
  }, []);

  // ✅ Company profile from Firestore (fallback empty)
  const companyProfile = useMemo(() => {
    return (profile?.company ?? {}) as CompanyProfile;
  }, [profile]);

  const [newUser, setNewUser] = useState<UserProfile>({
    id: crypto.randomUUID(),
    fullName: "",
    email: "",
    role: "",
  });




  const updateCompanyProfile = async (updates: Partial<CompanyProfile>) => {
    if (!uid) return;
    await upsertUserCompany(uid, {
      ...(companyProfile as any),
      ...(updates as any),
    });
  };

  const addUserToCompany = async (u: UserProfile) => {
    if (!uid) return;
    const existing = Array.isArray(companyProfile?.users) ? companyProfile.users : [];
    const updatedUsers = [...existing, u];
    await upsertUserCompany(uid, {
      ...(companyProfile as any),
      users: updatedUsers,
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { base64 } = await fileToBase64(file);
    await updateCompanyProfile({ companyLogo: base64 } as any);
  };

  if (!uid) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <p className="text-gray-600">Not logged in.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* ✅ TEMP: ENTITLEMENTS DEBUG (READ-ONLY) */}
      <div className="rounded-lg border bg-slate-50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-900">Entitlements Debug (TEMP)</h3>
            <p className="text-xs text-slate-600">
              This confirms Firebase user profile + entitlements are loading.
            </p>
          </div>
          <div className="text-xs text-slate-600">
            <span className="mr-3">
              <strong>Tier:</strong> {tier ?? "—"}
            </span>
            <span>
              <strong>Track:</strong> {track ?? "—"}
            </span>
          </div>
        </div>

        <div className="mt-3 text-xs">
          {loading && <div className="text-slate-600">Loading profile…</div>}

          {!loading && (
            <pre className="overflow-auto rounded-md bg-white p-3 text-[11px] text-slate-800 border">
              {JSON.stringify(
                {
                  l1_assessment: !!ent.l1_assessment,
                  l2_assessment: !!ent.l2_assessment,
                  evidence_basic: !!ent.evidence_basic,
                  evidence_advanced: !!ent.evidence_advanced,
                  exports_readiness_pdf: !!ent.exports_readiness_pdf,
                  exports_ssp_pdf: !!ent.exports_ssp_pdf,
                  ai_assist_basic: !!ent.ai_assist_basic,
                  ai_assist_advanced: !!ent.ai_assist_advanced,
                  admin_panel: !!ent.admin_panel,
                },
                null,
                2
              )}
            </pre>
          )}

          {!loading && !profile && (
            <div className="mt-2 text-amber-700">
              No profile doc loaded yet (users/{`{uid}`} missing or rules blocked).
            </div>
          )}
        </div>
      </div>



{/* ✅ TEMP: ORG MEMBERSHIP DEBUG */}
<div className="rounded-lg border bg-slate-50 p-4">
  <h3 className="font-semibold text-slate-900 mb-1">Org Membership Debug (TEMP)</h3>
  <p className="text-xs text-slate-600 mb-2">
    Confirms /orgs/{`{orgId}`}/members/{`{uid}`} access + role loading.
  </p>

  {orgLoading ? (
    <div className="text-xs text-slate-600">Loading org membership…</div>
  ) : (

<pre className="overflow-auto rounded-md bg-white p-3 text-[11px] text-slate-800 border">
  {JSON.stringify(
    {
      orgId: orgId ?? "—",
      uid: uid ?? "—",
      hasMemberDoc: !!member,
      role: member?.role ?? "—",
      superAdmin: member?.superAdmin ?? false,
      error: orgError ? String((orgError as any)?.message ?? orgError) : null,
    },
    null,
    2
  )}
</pre>

  )}

  {!orgLoading && !singleUserOnly && orgId && !member && !orgError && (
    <div className="mt-2 text-amber-700 text-xs">
      Member doc not found. Expected: orgs/{orgId}/members/{auth.currentUser?.uid ?? "unknown"}
    </div>
  )}

{!orgLoading && singleUserOnly && (
  <div className="mt-2 text-slate-600 text-xs">
    Single-user mode is ON. Org membership is not required.
  </div>
)}

</div>





      {/* COMPANY SECTION */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-bold mb-4">Company Information</h2>

        {/* Logo Upload */}
        <div className="flex items-center space-x-4 mb-4">
          {companyProfile?.companyLogo ? (
            <img
              src={`data:image/png;base64,${companyProfile.companyLogo}`}
              alt="Company Logo"
              className="h-16 w-16 object-cover rounded-md border"
            />
          ) : (
            <div className="h-16 w-16 flex items-center justify-center bg-gray-200 text-gray-500 rounded-md border">
              No Logo
            </div>
          )}

          <label className="cursor-pointer px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md border flex items-center text-sm">
            <Upload className="h-4 w-4 mr-2" />
            Upload Logo
            <input
              type="file"
              className="hidden"
              onChange={handleLogoUpload}
              accept="image/png, image/jpeg"
            />
          </label>
        </div>

        {/* Company Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Company Name"
            value={companyProfile?.companyName || ""}
            onChange={(e) => updateCompanyProfile({ companyName: e.target.value } as any)}
            className="w-full border p-2 rounded bg-white text-black"
          />

          <input
            type="text"
            placeholder="Address"
            value={companyProfile?.address || ""}
            onChange={(e) => updateCompanyProfile({ address: e.target.value } as any)}
            className="w-full border p-2 rounded bg-white text-black"
          />

          <input
            type="text"
            placeholder="Website"
            value={companyProfile?.website || ""}
            onChange={(e) => updateCompanyProfile({ website: e.target.value } as any)}
            className="w-full border p-2 rounded bg-white text-black"
          />
        </div>

        {/* Primary Contact */}
        <div className="mt-6 pt-4 border-t">
          <h3 className="font-semibold text-gray-800 mb-2">Primary Contact</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              placeholder="Name"
              value={companyProfile?.primaryContactName || ""}
              onChange={(e) =>
                updateCompanyProfile({ primaryContactName: e.target.value } as any)
              }
              className="w-full border p-2 rounded bg-white text-black"
            />
            <input
              type="email"
              placeholder="Email"
              value={companyProfile?.primaryContactEmail || ""}
              onChange={(e) =>
                updateCompanyProfile({ primaryContactEmail: e.target.value } as any)
              }
              className="w-full border p-2 rounded bg-white text-black"
            />
            <input
              type="tel"
              placeholder="Phone"
              value={companyProfile?.primaryContactPhone || ""}
              onChange={(e) =>
                updateCompanyProfile({ primaryContactPhone: e.target.value } as any)
              }
              className="w-full border p-2 rounded bg-white text-black"
            />
          </div>
        </div>

        {/* Secondary Contact */}
        <div className="mt-4">
          <h3 className="font-semibold text-gray-800 mb-2">Secondary Contact</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              placeholder="Name"
              value={companyProfile?.secondaryContactName || ""}
              onChange={(e) =>
                updateCompanyProfile({ secondaryContactName: e.target.value } as any)
              }
              className="w-full border p-2 rounded bg-white text-black"
            />
            <input
              type="email"
              placeholder="Email"
              value={companyProfile?.secondaryContactEmail || ""}
              onChange={(e) =>
                updateCompanyProfile({ secondaryContactEmail: e.target.value } as any)
              }
              className="w-full border p-2 rounded bg-white text-black"
            />
            <input
              type="tel"
              placeholder="Phone"
              value={companyProfile?.secondaryContactPhone || ""}
              onChange={(e) =>
                updateCompanyProfile({ secondaryContactPhone: e.target.value } as any)
              }
              className="w-full border p-2 rounded bg-white text-black"
            />
          </div>
        </div>
      </div>

      {/* USERS SECTION */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-bold mb-4">Users</h2>

        <div className="space-y-3 mb-4">
          {(companyProfile?.users || []).map((u) => (
            <div key={u.id} className="border p-3 rounded bg-gray-50">
              <p className="font-semibold">{u.fullName}</p>
              <p className="text-sm text-gray-500">{u.email}</p>
              <p className="text-sm text-gray-400">{u.role}</p>
            </div>
          ))}

          {(!companyProfile?.users || companyProfile.users.length === 0) && (
            <p className="text-sm text-gray-500 text-center py-2">No users added yet.</p>
          )}
        </div>

        <div className="space-y-3 border p-4 rounded bg-gray-50">
          <h3 className="font-semibold text-gray-800">Add New User</h3>

          <input
            type="text"
            placeholder="Full Name"
            value={newUser.fullName}
            onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
            className="w-full border p-2 rounded bg-white text-black"
          />

          <input
            type="email"
            placeholder="Email"
            value={newUser.email}
            onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
            className="w-full border p-2 rounded bg-white text-black"
          />

          <input
            type="text"
            placeholder="Role (e.g., IT Manager, CEO)"
            value={newUser.role || ""}
            onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
            className="w-full border p-2 rounded bg-white text-black"
          />

          <button
            onClick={async () => {
              if (newUser.fullName && newUser.email) {
                await addUserToCompany(newUser);
                setNewUser({
                  id: crypto.randomUUID(),
                  fullName: "",
                  email: "",
                  role: "",
                });
              } else {
                alert("Please enter a full name and email address.");
              }
            }}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
          >
            Add User
          </button>
        </div>
      </div>
    </div>
  );
};
