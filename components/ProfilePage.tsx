import React, { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { Upload } from "lucide-react";

import { auth, db } from "../src/firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

import { useOrgMember } from "../src/useOrgMember";
import { useUserProfile } from "../src/useUserProfile";

import { OrgCompanyProfile, UserProfile } from "../types";

const emptyCompanyProfile = (): OrgCompanyProfile => ({
  legalName: "",
  contacts: { primary: {}, secondary: {} },
  address: {},
  cmmc: {},
});

const isValidEmail = (value: string) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const isValidWebsite = (value: string) => {
  if (!value) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

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
  const [orgForm, setOrgForm] = useState<OrgCompanyProfile>(emptyCompanyProfile);
  const [isSavingOrg, setIsSavingOrg] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string>("");

  // ✅ Members list (login access list)
  const [orgMembers, setOrgMembers] = useState<any[]>([]);
  const [orgMembersLoading, setOrgMembersLoading] = useState(false);
  const [orgMembersError, setOrgMembersError] = useState<string | null>(null);





const [memberProfiles, setMemberProfiles] = useState<Record<string, any>>({});





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
    if (!orgDoc) return;
    setOrgForm({
      ...emptyCompanyProfile(),
      ...orgDoc.companyProfile,
      legalName: orgDoc.companyProfile?.legalName || orgDoc.name || "",
      website: orgDoc.companyProfile?.website || orgDoc.website || "",
      contacts: {
        primary: {
          name: orgDoc.primaryContactName || "",
          email: orgDoc.primaryContactEmail || "",
          phone: orgDoc.primaryContactPhone || "",
          ...orgDoc.companyProfile?.contacts?.primary,
        },
        secondary: {
          name: orgDoc.secondaryContactName || "",
          email: orgDoc.secondaryContactEmail || "",
          phone: orgDoc.secondaryContactPhone || "",
          ...orgDoc.companyProfile?.contacts?.secondary,
        },
      },
      address: {
        street: typeof orgDoc.address === "string" ? orgDoc.address : "",
        ...orgDoc.companyProfile?.address,
      },
      cmmc: {
        ...orgDoc.companyProfile?.cmmc,
      },
    });
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






useEffect(() => {
  const run = async () => {
    const uids = (orgMembers || []).map((m) => m.uid).filter(Boolean);
    if (uids.length === 0) {
      setMemberProfiles({});
      return;
    }

    // Fetch each users/{uid} doc (MVP simple; small org sizes)
    const entries = await Promise.all(
      uids.map(async (id) => {
        try {
          const snap = await getDoc(doc(db, "users", String(id)));
          return [id, snap.exists() ? snap.data() : null] as const;
        } catch (e) {
          console.error("member profile fetch failed", id, e);
          return [id, null] as const;
        }
      })
    );

    const map: Record<string, any> = {};
    for (const [id, data] of entries) map[id] = data;
    setMemberProfiles(map);
  };

  run();
}, [orgMembers]);






  // Permissions for editing org info (owner OR orgAdmin OR superAdmin)
  const canEditCompany =
    !!uid &&
    !!orgDoc &&
    (String(orgDoc.ownerUid) === String(uid) ||
      member?.role === "orgAdmin" ||
      (profile as any)?.roles?.superAdmin === true);

  const orgTier = String(orgDoc?.tier ?? "COMM_L1").toUpperCase();
  const isSponsored = orgTier === "SPONSORED";

  // Save company info
  const saveOrgProfile = async () => {
    if (!orgId) return;
    if (!canEditCompany) {
      setSaveMsg("Unable to save company profile.");
      return;
    }

    const legalName = orgForm.legalName.trim();
    if (!legalName) {
      setSaveMsg("Legal name is required.");
      return;
    }
    if (!isValidEmail(orgForm.contacts.primary.email?.trim() || "") ||
        !isValidEmail(orgForm.contacts.secondary.email?.trim() || "")) {
      setSaveMsg("Enter a valid email address.");
      return;
    }
    if (!isValidWebsite(orgForm.website?.trim() || "")) {
      setSaveMsg("Enter a valid website URL including http:// or https://.");
      return;
    }

    setIsSavingOrg(true);
    setSaveMsg("");

    try {
      const trimValues = (values: Record<string, string | undefined>) =>
        Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value?.trim()]));
      const companyProfile: OrgCompanyProfile = {
        ...orgForm,
        legalName,
        website: orgForm.website?.trim(),
        contacts: {
          primary: trimValues(orgForm.contacts.primary),
          secondary: trimValues(orgForm.contacts.secondary),
        },
        address: trimValues(orgForm.address),
        cmmc: trimValues(orgForm.cmmc),
      };

      await setDoc(doc(db, "orgs", String(orgId)), {
        companyProfile,
        companyProfileUpdatedAt: serverTimestamp(),
        companyProfileUpdatedBy: uid,
      }, { merge: true });
      setOrgDoc((current: any) => ({ ...current, companyProfile }));
      setSaveMsg("Company profile saved.");
    } catch (e: any) {
      console.error(e);
      setSaveMsg("Unable to save company profile.");
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

  const setProfileField = (field: keyof OrgCompanyProfile, value: string) =>
    setOrgForm(current => ({ ...current, [field]: value }));
  const setContactField = (contact: "primary" | "secondary", field: string, value: string) =>
    setOrgForm(current => ({
      ...current,
      contacts: {
        ...current.contacts,
        [contact]: { ...current.contacts[contact], [field]: value },
      },
    }));
  const setAddressField = (field: string, value: string) =>
    setOrgForm(current => ({ ...current, address: { ...current.address, [field]: value } }));
  const setCmmcField = (field: string, value: string) =>
    setOrgForm(current => ({ ...current, cmmc: { ...current.cmmc, [field]: value } }));
  const inputClass = "w-full border p-2 rounded bg-white text-black";

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

        <div className="space-y-5">
          <section>
            <h3 className="font-semibold text-gray-800 mb-2">Company Identity</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input className={inputClass} placeholder="Legal Name *" value={orgForm.legalName} onChange={e => setProfileField("legalName", e.target.value)} disabled={!canEditCompany} />
              <input className={inputClass} placeholder="DBA Name" value={orgForm.dbaName || ""} onChange={e => setProfileField("dbaName", e.target.value)} disabled={!canEditCompany} />
              <input className={inputClass} placeholder="Website (https://...)" value={orgForm.website || ""} onChange={e => setProfileField("website", e.target.value)} disabled={!canEditCompany} />
              <input className={inputClass} placeholder="Industry" value={orgForm.industry || ""} onChange={e => setProfileField("industry", e.target.value)} disabled={!canEditCompany} />
              <input className={inputClass} placeholder="NAICS" value={orgForm.naics || ""} onChange={e => setProfileField("naics", e.target.value)} disabled={!canEditCompany} />
              <input className={inputClass} placeholder="CAGE Code" value={orgForm.cageCode || ""} onChange={e => setProfileField("cageCode", e.target.value)} disabled={!canEditCompany} />
              <input className={inputClass} placeholder="UEI" value={orgForm.uei || ""} onChange={e => setProfileField("uei", e.target.value)} disabled={!canEditCompany} />
              <input className={inputClass} placeholder="DUNS" value={orgForm.duns || ""} onChange={e => setProfileField("duns", e.target.value)} disabled={!canEditCompany} />
            </div>
          </section>

          <section className="pt-4 border-t">
            <h3 className="font-semibold text-gray-800 mb-2">Contacts</h3>
            {(["primary", "secondary"] as const).map(contact => (
              <div key={contact} className="mb-3">
                <p className="text-xs font-semibold uppercase text-gray-500 mb-1">{contact}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(["name", "title", "email", "phone"] as const).map(field => (
                    <input key={field} type={field === "email" ? "email" : field === "phone" ? "tel" : "text"} className={inputClass} placeholder={field[0].toUpperCase() + field.slice(1)} value={orgForm.contacts[contact][field] || ""} onChange={e => setContactField(contact, field, e.target.value)} disabled={!canEditCompany} />
                  ))}
                </div>
              </div>
            ))}
          </section>

          <section className="pt-4 border-t">
            <h3 className="font-semibold text-gray-800 mb-2">Address</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(["street", "city", "state", "zip", "country"] as const).map(field => (
                <input key={field} className={inputClass} placeholder={field === "zip" ? "ZIP" : field[0].toUpperCase() + field.slice(1)} value={orgForm.address[field] || ""} onChange={e => setAddressField(field, e.target.value)} disabled={!canEditCompany} />
              ))}
            </div>
          </section>

          <section className="pt-4 border-t">
            <h3 className="font-semibold text-gray-800 mb-2">CMMC / SSP Source Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <select className={inputClass} value={orgForm.cmmc.assessmentLevel || ""} onChange={e => setCmmcField("assessmentLevel", e.target.value)} disabled={!canEditCompany}>
                <option value="">Assessment Level</option><option value="L1">L1</option><option value="L2">L2</option>
              </select>
              {(["handlesFCI", "handlesCUI"] as const).map(field => (
                <select key={field} className={inputClass} value={orgForm.cmmc[field] || ""} onChange={e => setCmmcField(field, e.target.value)} disabled={!canEditCompany}>
                  <option value="">{field === "handlesFCI" ? "Handles FCI" : "Handles CUI"}</option><option value="yes">Yes</option><option value="no">No</option><option value="unknown">Unknown</option>
                </select>
              ))}
              {(["contractingAgency", "systemName", "systemOwner", "externalServiceProviders", "cloudProviders", "itProvider"] as const).map(field => (
                <input key={field} className={inputClass} placeholder={field.replace(/([A-Z])/g, " $1").replace(/^./, value => value.toUpperCase())} value={orgForm.cmmc[field] || ""} onChange={e => setCmmcField(field, e.target.value)} disabled={!canEditCompany} />
              ))}
              <textarea className={inputClass} rows={3} placeholder="System Description" value={orgForm.cmmc.systemDescription || ""} onChange={e => setCmmcField("systemDescription", e.target.value)} disabled={!canEditCompany} />
              <textarea className={inputClass} rows={3} placeholder="System Boundary Summary" value={orgForm.cmmc.systemBoundarySummary || ""} onChange={e => setCmmcField("systemBoundarySummary", e.target.value)} disabled={!canEditCompany} />
            </div>
          </section>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={saveOrgProfile}
            disabled={!canEditCompany || isSavingOrg}
            className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
          >
            {isSavingOrg ? "Saving..." : "Save Profile"}
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


{orgMembers.map((m) => {
  const p = memberProfiles[m.uid] || {};
  return (
    <div key={m.uid} className="border p-3 rounded bg-gray-50">
      <p className="font-semibold">{p?.fullName || p?.name || "—"}</p>
      <p className="text-sm text-gray-600">Email: {p?.email || "—"}</p>
      <p className="text-sm text-gray-600">Phone: {p?.phone || "—"}</p>

      <p className="text-sm text-gray-500 mt-1">
        Role: {m.role ?? "orgUser"}
        {m.superAdmin ? " • superAdmin" : ""}
      </p>

      {/* Optional: keep UID visible for debugging */}
      <p className="text-[11px] text-gray-400 mt-1">{m.uid}</p>
    </div>
  );
})}

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

<select
  value={newUser.role || "orgAdmin"}
  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
  className="w-full border p-2 rounded bg-white text-black"
>
  <option value="orgAdmin">Org Admin User</option>
  <option value="orgUser">Org Standard User</option>
</select>


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
