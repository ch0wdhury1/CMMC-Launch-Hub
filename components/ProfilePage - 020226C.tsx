import React, { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { Upload } from "lucide-react";

import { auth, db } from "../src/firebase";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

import { useOrgMember } from "../src/useOrgMember";
import { useUserProfile } from "../src/useUserProfile";

import { UserProfile } from "../types";

export const ProfilePage: React.FC = () => {
  // ✅ Firestore-backed user profile + entitlements
  const { tier, track, profile } = useUserProfile();

  // ✅ uid (reliable)
  const [uid, setUid] = useState<string | null>(null);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null));
    return () => unsub();
  }, []);

  // ✅ single-user mode flag (legacy path)
  const singleUserOnly = !!profile?.singleUserOnly;

  // ✅ orgId
  const orgId =
    (profile as any)?.orgId ??
    (profile as any)?.company?.orgId ??
    null;

  // ✅ Only query org membership if needed
  const shouldCheckOrg = !singleUserOnly && !!orgId;

  const { loading: orgLoading, member, error: orgError } = useOrgMember(
    shouldCheckOrg ? (orgId as string) : undefined
  );

  // ✅ Org doc (source of truth)
  const [orgDoc, setOrgDoc] = useState<any>(null);
  const [orgDocLoading, setOrgDocLoading] = useState(false);
  const [orgDocError, setOrgDocError] = useState<string | null>(null);

  // ✅ Org editable form (Company Information)
  const [orgForm, setOrgForm] = useState<any>(null);
  const [isSavingOrg, setIsSavingOrg] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string>("");

  // ✅ Members list (login access list)
  const [orgMembers, setOrgMembers] = useState<any[]>([]);
  const [orgMembersLoading, setOrgMembersLoading] = useState(false);
  const [orgMembersError, setOrgMembersError] = useState<string | null>(null);

  // ✅ New user request form state (for Add User Request)
  const [newUser, setNewUser] = useState<UserProfile>({
    id: crypto.randomUUID(),
    fullName: "",
    email: "",
    role: "orgAdmin",
  });

  // Load org doc
  useEffect(() => {
    const run = async () => {
      if (!orgId) {
        setOrgDoc(null);
        setOrgDocError(null);
        return;
      }

      setOrgDocLoading(true);
      setOrgDocError(null);

      try {
        const snap = await getDoc(doc(db, "orgs", String(orgId)));
        if (!snap.exists()) {
          setOrgDoc(null);
          setOrgDocError(`orgs/${orgId} not found`);
          return;
        }
        setOrgDoc({ id: snap.id, ...(snap.data() as any) });
      } catch (e: any) {
        console.error(e);
        setOrgDoc(null);
        setOrgDocError(e?.message || String(e));
      } finally {
        setOrgDocLoading(false);
      }
    };

    run();
  }, [orgId]);

  // Keep a separate editable copy for inputs
  useEffect(() => {
    if (orgDoc) setOrgForm(orgDoc);
  }, [orgDoc]);

  // Load members list
  useEffect(() => {
    if (!orgId) {
      setOrgMembers([]);
      setOrgMembersError(null);
      setOrgMembersLoading(false);
      return;
    }

    setOrgMembersLoading(true);
    setOrgMembersError(null);

    const colRef = collection(db, "orgs", String(orgId), "members");
    const unsub = onSnapshot(
      colRef,
      (snap) => {
        const rows = snap.docs.map((d) => ({ uid: d.id, ...(d.data() as any) }));
        setOrgMembers(rows);
        setOrgMembersLoading(false);
      },
      (e) => {
        console.error(e);
        setOrgMembersError(e?.message || String(e));
        setOrgMembers([]);
        setOrgMembersLoading(false);
      }
    );

    return () => unsub();
  }, [orgId]);

  // Permissions for editing org info (owner OR orgAdmin OR superAdmin)
  const canEditCompany =
    !!uid &&
    !!orgDoc &&
    (String(orgDoc.ownerUid) === String(uid) ||
      member?.role === "orgAdmin" ||
      member?.superAdmin === true);

  const orgTier = String(orgDoc?.tier ?? "COMM_L1").toUpperCase();
  const isSponsored = orgTier === "SPONSORED";

  // Save company info
  const saveOrgProfile = async () => {
    if (!orgId || !orgForm) return;
    if (!canEditCompany) {
      alert("You do not have permission to edit company info.");
      return;
    }

    setIsSavingOrg(true);
    setSaveMsg("");

    try {
      const updates: any = {
        name: orgForm.name ?? "",
        address: orgForm.address ?? "",
        website: orgForm.website ?? "",

        primaryContactName: orgForm.primaryContactName ?? "",
        primaryContactEmail: orgForm.primaryContactEmail ?? "",
        primaryContactPhone: orgForm.primaryContactPhone ?? "",

        secondaryContactName: orgForm.secondaryContactName ?? "",
        secondaryContactEmail: orgForm.secondaryContactEmail ?? "",
        secondaryContactPhone: orgForm.secondaryContactPhone ?? "",
      };

      await updateDoc(doc(db, "orgs", String(orgId)), updates);
      setSaveMsg("✅ Saved");
    } catch (e: any) {
      console.error(e);
      setSaveMsg(`❌ Save failed: ${e?.message || e}`);
    } finally {
      setIsSavingOrg(false);
    }
  };

  // Upload logo to Firebase Storage + save URL in org doc
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !orgId) return;

    if (!canEditCompany) {
      alert("You do not have permission to upload a logo.");
      return;
    }

    setSaveMsg("");

    try {
      const storage = getStorage();
      const ext = file.name.split(".").pop() || "png";
      const path = `org_logos/${orgId}/logo.${ext}`;
      const r = ref(storage, path);

      await uploadBytes(r, file, { contentType: file.type });
      const url = await getDownloadURL(r);

      await updateDoc(doc(db, "orgs", String(orgId)), { logoUrl: url });
      setSaveMsg("✅ Logo uploaded");
    } catch (e: any) {
      console.error(e);
      setSaveMsg(`❌ Logo upload failed: ${e?.message || e}`);
    }
  };

  // COMM_L1/COMM_L2: add user request → pending admin approval
  const sendAddUserRequest = async () => {
    if (!orgId) return;

    if (!newUser.fullName || !newUser.email) {
      alert("Please enter a full name and email address.");
      return;
    }

    // MVP: only these roles
    const requestedRole =
      (newUser.role || "orgAdmin").trim() === "orgUser" ? "orgUser" : "orgAdmin";

    try {
      await addDoc(collection(db, "accessRequests"), {
        type: "addUser",
        orgId: String(orgId),
        fullName: newUser.fullName.trim(),
        email: newUser.email.trim().toLowerCase(),
        requestedRole,
        status: "pending",
        requestedByUid: uid,
        createdAt: serverTimestamp(),
      });

      alert("✅ Request sent to Admin for approval.");
      setNewUser({
        id: crypto.randomUUID(),
        fullName: "",
        email: "",
        role: "orgAdmin",
      });
    } catch (e: any) {
      console.error(e);
      alert(`❌ Failed to send request: ${e?.message || e}`);
    }
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
      {/* ✅ Company Info (Org Source of Truth) */}
      <div className="rounded-lg border bg-slate-50 p-4">
        <h3 className="mb-2 font-semibold text-sm text-slate-700">
          Company Info (Org Source of Truth)
        </h3>

        {orgDocLoading ? (
          <div className="text-xs text-slate-600">Loading org info…</div>
        ) : (
          <pre className="overflow-auto rounded-md bg-white p-3 text-[11px] text-slate-800 border">
            {JSON.stringify(
              {
                companyInfo: {
                  name: orgDoc?.name ?? "—",
                  orgId: orgDoc?.id ?? orgId ?? "—",
                  ownerUid: orgDoc?.ownerUid ?? "—",
                  tier: orgDoc?.tier ?? "—",
                  subscriptionStatus: orgDoc?.subscriptionStatus ?? "—",
                },
                membership: {
                  hasMemberDoc: !!member,
                  role: member?.role ?? "—",
                  superAdmin: member?.superAdmin ?? false,
                },
                errors: {
                  orgDocError,
                  orgMemberError: orgError
                    ? String((orgError as any)?.message ?? orgError)
                    : null,
                },
              },
              null,
              2
            )}
          </pre>
        )}
      </div>

      {/* COMPANY SECTION */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-bold mb-4">Company Information</h2>

        {/* Logo Upload */}
        <div className="flex items-center space-x-4 mb-4">
          <div className="h-16 w-16 flex items-center justify-center bg-gray-200 text-gray-500 rounded-md border overflow-hidden">
            {orgDoc?.logoUrl ? (
              <img
                src={orgDoc.logoUrl}
                alt="Company Logo"
                className="h-full w-full object-contain bg-white"
              />
            ) : (
              "No Logo"
            )}
          </div>

          <label className={`cursor-pointer px-3 py-2 rounded-md border flex items-center text-sm ${
            canEditCompany ? "bg-gray-100 hover:bg-gray-200" : "bg-gray-50 opacity-60"
          }`}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Logo
            <input
              type="file"
              className="hidden"
              onChange={handleLogoUpload}
              accept="image/png, image/jpeg"
              disabled={!canEditCompany}
            />
          </label>
        </div>

        {/* Company Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Company Name"
            value={orgForm?.name || ""}
            onChange={(e) => setOrgForm((p: any) => ({ ...p, name: e.target.value }))}
            className="w-full border p-2 rounded bg-white text-black"
            disabled={!canEditCompany}
          />

          <input
            type="text"
            placeholder="Address"
            value={orgForm?.address || ""}
            onChange={(e) => setOrgForm((p: any) => ({ ...p, address: e.target.value }))}
            className="w-full border p-2 rounded bg-white text-black"
            disabled={!canEditCompany}
          />

          <input
            type="text"
            placeholder="Website"
            value={orgForm?.website || ""}
            onChange={(e) => setOrgForm((p: any) => ({ ...p, website: e.target.value }))}
            className="w-full border p-2 rounded bg-white text-black"
            disabled={!canEditCompany}
          />
        </div>

        {/* Primary Contact */}
        <div className="mt-6 pt-4 border-t">
          <h3 className="font-semibold text-gray-800 mb-2">Primary Contact</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              placeholder="Name"
              value={orgForm?.primaryContactName || ""}
              onChange={(e) =>
                setOrgForm((p: any) => ({ ...p, primaryContactName: e.target.value }))
              }
              className="w-full border p-2 rounded bg-white text-black"
              disabled={!canEditCompany}
            />
            <input
              type="email"
              placeholder="Email"
              value={orgForm?.primaryContactEmail || ""}
              onChange={(e) =>
                setOrgForm((p: any) => ({ ...p, primaryContactEmail: e.target.value }))
              }
              className="w-full border p-2 rounded bg-white text-black"
              disabled={!canEditCompany}
            />
            <input
              type="tel"
              placeholder="Phone"
              value={orgForm?.primaryContactPhone || ""}
              onChange={(e) =>
                setOrgForm((p: any) => ({ ...p, primaryContactPhone: e.target.value }))
              }
              className="w-full border p-2 rounded bg-white text-black"
              disabled={!canEditCompany}
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
              value={orgForm?.secondaryContactName || ""}
              onChange={(e) =>
                setOrgForm((p: any) => ({ ...p, secondaryContactName: e.target.value }))
              }
              className="w-full border p-2 rounded bg-white text-black"
              disabled={!canEditCompany}
            />
            <input
              type="email"
              placeholder="Email"
              value={orgForm?.secondaryContactEmail || ""}
              onChange={(e) =>
                setOrgForm((p: any) => ({ ...p, secondaryContactEmail: e.target.value }))
              }
              className="w-full border p-2 rounded bg-white text-black"
              disabled={!canEditCompany}
            />
            <input
              type="tel"
              placeholder="Phone"
              value={orgForm?.secondaryContactPhone || ""}
              onChange={(e) =>
                setOrgForm((p: any) => ({ ...p, secondaryContactPhone: e.target.value }))
              }
              className="w-full border p-2 rounded bg-white text-black"
              disabled={!canEditCompany}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={saveOrgProfile}
            disabled={!canEditCompany || isSavingOrg}
            className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
          >
            {isSavingOrg ? "Saving..." : "Save"}
          </button>
          {saveMsg && <div className="text-xs text-slate-600">{saveMsg}</div>}
        </div>
      </div>

      {/* USERS SECTION */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-bold mb-4">Users</h2>

        {orgMembersLoading ? (
          <p className="text-sm text-gray-500 text-center py-2">Loading users…</p>
        ) : orgMembersError ? (
          <p className="text-sm text-red-600 text-center py-2">
            Error: {orgMembersError}
          </p>
        ) : orgMembers.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-2">No users added yet.</p>
        ) : (
          <div className="space-y-3 mb-4">
            {orgMembers.map((m) => (
              <div key={m.uid} className="border p-3 rounded bg-gray-50">
                <p className="font-semibold">{m.uid}</p>
                <p className="text-sm text-gray-500">
                  role: {m.role ?? "orgUser"}
                  {m.superAdmin ? " • superAdmin" : ""}
                </p>
              </div>
            ))}
          </div>
        )}

        {isSponsored ? (
          <div className="space-y-2 border p-4 rounded bg-gray-50">
            <h3 className="font-semibold text-gray-800">Edit User</h3>
            <p className="text-sm text-gray-600">
              Sponsored tier supports 1 user only. Additional users require an upgrade.
            </p>
          </div>
        ) : (
          <div className="space-y-3 border p-4 rounded bg-gray-50">
            <h3 className="font-semibold text-gray-800">Add User – Send Request</h3>

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
              placeholder='Requested Role ("orgAdmin" or "orgUser")'
              value={newUser.role || "orgAdmin"}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
              className="w-full border p-2 rounded bg-white text-black"
            />

            <button
              type="button"
              onClick={sendAddUserRequest}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
            >
              Add User – Send Request
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
