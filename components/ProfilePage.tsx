import React, { useEffect, useMemo, useRef, useState } from "react";
import { Building2, Edit3, Loader2, Save, UserRound, X } from "lucide-react";
import { doc, getDoc, getDocFromServer, serverTimestamp, setDoc, writeBatch } from "firebase/firestore";
import { auth, db } from "../src/firebase";
import { useOrgMember } from "../src/useOrgMember";
import { useUserProfile } from "../src/useUserProfile";
import { OrganizationUsers } from "./OrganizationUsers";
import { OrgInvitations } from "./OrgInvitations";
import { logActivityEvent } from "../src/activityLog";
import type { OrgCompanyProfile } from "../types";

const emptyCompanyProfile = (): OrgCompanyProfile => ({
  legalName: "",
  contacts: {primary: {}, secondary: {}},
  address: {},
  cmmc: {},
});

const isValidEmail = (value: string) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const isValidWebsite = (value: string) => {
  if (!value) return true;
  try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
};
const valueOrMissing = (value: unknown) => String(value || "").trim() || "Not provided";
const Field: React.FC<{label: string; value: unknown}> = ({label, value}) =>
  <div><dt className="text-xs font-semibold uppercase text-gray-500">{label}</dt><dd className="mt-1 text-sm text-gray-800">{valueOrMissing(value)}</dd></div>;

const confirmIdentityCommit = async (ref: ReturnType<typeof doc>, identity: {displayName: string; fullName: string; phone: string; title: string}) => {
  const snapshot = await getDocFromServer(ref);
  const saved = snapshot.data();
  if (
    !snapshot.exists()
    || saved?.displayName !== identity.displayName
    || saved?.fullName !== identity.fullName
    || saved?.phone !== identity.phone
    || saved?.title !== identity.title
  ) {
    throw new Error("Self profile update was not confirmed by the server.");
  }
};

export const ProfilePage: React.FC = () => {
  const {loading: profileLoading, profile} = useUserProfile();
  const uid = auth.currentUser?.uid || "";
  const orgId = String((profile as any)?.orgId || "");
  const {loading: memberLoading, member} = useOrgMember(orgId || undefined);
  const role = member?.role || (profile as any)?.roles?.orgRole;
  const isSuperAdmin = (profile as any)?.roles?.superAdmin === true;
  const canManageCompany = isSuperAdmin || role === "orgOwner" || role === "orgAdmin";
  const [org, setOrg] = useState<any>(null);
  const [companyProfile, setCompanyProfile] = useState<OrgCompanyProfile>(emptyCompanyProfile);
  const [editingCompany, setEditingCompany] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);
  const [companyMessage, setCompanyMessage] = useState("");
  const [editingMyInfo, setEditingMyInfo] = useState(false);
  const [savingMyInfo, setSavingMyInfo] = useState(false);
  const [myInfoMessage, setMyInfoMessage] = useState("");
  const [myInfo, setMyInfo] = useState({fullName: "", email: "", phone: "", title: ""});
  const fullNameInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const loadOrg = async () => {
    if (!orgId) return;
    const snapshot = await getDoc(doc(db, "orgs", orgId));
    if (!snapshot.exists()) throw new Error("Organization not found.");
    const next = {id: snapshot.id, ...snapshot.data()};
    setOrg(next);
    setCompanyProfile({
      ...emptyCompanyProfile(),
      ...next.companyProfile,
      legalName: next.companyProfile?.legalName || next.name || "",
      website: next.companyProfile?.website || next.website || "",
      contacts: {
        primary: {...next.companyProfile?.contacts?.primary, name: next.companyProfile?.contacts?.primary?.name || next.primaryContactName || "", email: next.companyProfile?.contacts?.primary?.email || next.primaryContactEmail || "", phone: next.companyProfile?.contacts?.primary?.phone || next.primaryContactPhone || ""},
        secondary: {...next.companyProfile?.contacts?.secondary},
      },
      address: {street: typeof next.address === "string" ? next.address : "", ...next.companyProfile?.address},
      cmmc: {...next.companyProfile?.cmmc},
    });
  };

  useEffect(() => {
    void loadOrg().catch(error => setCompanyMessage(error instanceof Error ? error.message : "Unable to load company information."));
  }, [orgId]);

  useEffect(() => {
    setMyInfo({
      fullName: String((profile as any)?.displayName || (profile as any)?.fullName || member?.displayName || member?.fullName || ""),
      email: String((profile as any)?.email || auth.currentUser?.email || member?.email || ""),
      phone: String((profile as any)?.phone || member?.phone || ""),
      title: String((profile as any)?.title || member?.title || ""),
    });
  }, [member, profile]);

  const setProfileField = (field: keyof OrgCompanyProfile, value: string) => setCompanyProfile(current => ({...current, [field]: value}));
  const setContactField = (contact: "primary" | "secondary", field: string, value: string) => setCompanyProfile(current => ({...current, contacts: {...current.contacts, [contact]: {...current.contacts[contact], [field]: value}}}));
  const setAddressField = (field: string, value: string) => setCompanyProfile(current => ({...current, address: {...current.address, [field]: value}}));
  const setCmmcField = (field: string, value: string) => setCompanyProfile(current => ({...current, cmmc: {...current.cmmc, [field]: value}}));
  const inputClass = "w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900";

  const summary = useMemo(() => [
    ["Legal Name", companyProfile.legalName], ["DBA Name", companyProfile.dbaName], ["Website", companyProfile.website], ["Industry", companyProfile.industry],
    ["NAICS", companyProfile.naics], ["CAGE Code", companyProfile.cageCode], ["UEI", companyProfile.uei],
    ["Primary Contact", companyProfile.contacts.primary.name], ["Primary Contact Email", companyProfile.contacts.primary.email], ["Primary Contact Phone", companyProfile.contacts.primary.phone],
    ["Address", [companyProfile.address.street, companyProfile.address.city, companyProfile.address.state, companyProfile.address.zip].filter(Boolean).join(", ")],
    ["Assessment Level", companyProfile.cmmc.assessmentLevel], ["Handles FCI", companyProfile.cmmc.handlesFCI], ["Handles CUI", companyProfile.cmmc.handlesCUI],
    ["System Name", companyProfile.cmmc.systemName], ["System Owner", companyProfile.cmmc.systemOwner],
  ], [companyProfile]);

  const saveCompany = async () => {
    if (!orgId || !uid || !canManageCompany) return;
    const legalName = companyProfile.legalName.trim();
    const primaryEmail = companyProfile.contacts.primary.email?.trim() || "";
    const website = companyProfile.website?.trim() || "";
    if (!legalName) return setCompanyMessage("Legal name is required.");
    if (!isValidEmail(primaryEmail)) return setCompanyMessage("Enter a valid primary contact email.");
    if (!isValidWebsite(website)) return setCompanyMessage("Enter a valid website URL including http:// or https://.");
    setSavingCompany(true); setCompanyMessage("");
    try {
      const nextProfile = {...companyProfile, legalName, website, contacts: {...companyProfile.contacts, primary: {...companyProfile.contacts.primary, email: primaryEmail}}};
      await setDoc(doc(db, "orgs", orgId), {companyProfile: nextProfile, companyProfileUpdatedAt: serverTimestamp(), companyProfileUpdatedBy: uid}, {merge: true});
      setCompanyProfile(nextProfile);
      void logActivityEvent({
        orgId,
        orgName: nextProfile.legalName || org?.name || orgId,
        action: "profile.updated",
        actorUid: uid,
        targetType: "organization",
        targetId: orgId,
        targetLabel: nextProfile.legalName || org?.name || orgId,
        summary: "Company profile updated",
        metadata: {legalName: nextProfile.legalName, website: nextProfile.website || ""},
      });
      setEditingCompany(false);
      setCompanyMessage("Company profile saved.");
    } catch (error) {
      console.error("[profile] company save failed", error);
      setCompanyMessage("Unable to save company profile.");
    } finally { setSavingCompany(false); }
  };

  const saveMyInfo = async () => {
    if (!uid || !orgId) return;
    const fullName = (fullNameInputRef.current?.value ?? myInfo.fullName).trim();
    if (!fullName) return setMyInfoMessage("Full name is required.");
    setSavingMyInfo(true); setMyInfoMessage("");
    try {
      const identity = {
        displayName: fullName,
        fullName,
        phone: (phoneInputRef.current?.value ?? myInfo.phone).trim(),
        title: (titleInputRef.current?.value ?? myInfo.title).trim(),
        updatedAt: serverTimestamp(),
      };
      const userRef = doc(db, "users", uid);
      const memberRef = doc(db, "orgs", orgId, "members", uid);
      const batch = writeBatch(db);
      batch.set(userRef, identity, {merge: true});
      batch.set(memberRef, identity, {merge: true});
      await batch.commit();
      await Promise.all([confirmIdentityCommit(userRef, identity), confirmIdentityCommit(memberRef, identity)]);
      void logActivityEvent({
        orgId,
        orgName: org?.companyProfile?.legalName || org?.name || orgId,
        action: "profile.updated",
        actorUid: uid,
        targetType: "user",
        targetId: uid,
        targetLabel: identity.fullName,
        summary: "My information updated",
        metadata: {fields: ["displayName", "fullName", "phone", "title"]},
      });
      setMyInfo(current => ({...current, fullName: identity.fullName, phone: identity.phone, title: identity.title}));
      setEditingMyInfo(false);
      setMyInfoMessage("My information saved.");
    } catch (error) {
      console.error("[profile] self save failed", error);
      setMyInfoMessage("Unable to save my information.");
    } finally { setSavingMyInfo(false); }
  };

  if (profileLoading || memberLoading) return <div className="rounded-lg border bg-white p-6 text-sm text-gray-600">Loading Company Profile...</div>;
  if (!uid || !orgId || !org) return <div className="rounded-lg border bg-white p-6 text-sm text-red-700">{companyMessage || "Current organization is unavailable."}</div>;

  return <div className="space-y-5 animate-fadeIn">
    <section className="rounded-lg border bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 text-xl font-bold text-gray-900"><Building2 className="h-5 w-5 text-blue-700" /> Company Information</h2><p className="mt-1 text-sm text-gray-600">{org.name || companyProfile.legalName}</p></div>{canManageCompany && !editingCompany && <button type="button" onClick={() => setEditingCompany(true)} className="inline-flex items-center rounded border px-3 py-1.5 text-sm font-semibold text-blue-700"><Edit3 className="mr-1 h-4 w-4" /> Edit</button>}</div>
      {!editingCompany ? <dl className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">{summary.map(([label, value]) => <Field key={String(label)} label={String(label)} value={value} />)}</dl> :
      <div className="mt-4 space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{(["legalName", "dbaName", "website", "industry", "naics", "cageCode", "uei", "duns"] as const).map(field => <input key={field} className={inputClass} placeholder={field.replace(/([A-Z])/g, " $1").replace(/^./, value => value.toUpperCase())} value={companyProfile[field] || ""} onChange={event => setProfileField(field, event.target.value)} />)}</div>
        {(["primary", "secondary"] as const).map(contact => <div key={contact}><p className="mb-1 text-xs font-semibold uppercase text-gray-500">{contact} Contact</p><div className="grid grid-cols-1 gap-3 md:grid-cols-2">{(["name", "title", "email", "phone"] as const).map(field => <input key={field} className={inputClass} placeholder={field} value={companyProfile.contacts[contact][field] || ""} onChange={event => setContactField(contact, field, event.target.value)} />)}</div></div>)}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{(["street", "city", "state", "zip", "country"] as const).map(field => <input key={field} className={inputClass} placeholder={field} value={companyProfile.address[field] || ""} onChange={event => setAddressField(field, event.target.value)} />)}</div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2"><select className={inputClass} value={companyProfile.cmmc.assessmentLevel || ""} onChange={event => setCmmcField("assessmentLevel", event.target.value)}><option value="">Assessment Level</option><option value="L1">L1</option><option value="L2">L2</option></select>{(["handlesFCI", "handlesCUI"] as const).map(field => <select key={field} className={inputClass} value={companyProfile.cmmc[field] || ""} onChange={event => setCmmcField(field, event.target.value)}><option value="">{field}</option><option value="yes">Yes</option><option value="no">No</option><option value="unknown">Unknown</option></select>)}{(["systemName", "systemOwner", "cloudProviders", "itProvider"] as const).map(field => <input key={field} className={inputClass} placeholder={field} value={companyProfile.cmmc[field] || ""} onChange={event => setCmmcField(field, event.target.value)} />)}<textarea className={inputClass} placeholder="System Description" value={companyProfile.cmmc.systemDescription || ""} onChange={event => setCmmcField("systemDescription", event.target.value)} /><textarea className={inputClass} placeholder="System Boundary Summary" value={companyProfile.cmmc.systemBoundarySummary || ""} onChange={event => setCmmcField("systemBoundarySummary", event.target.value)} /></div>
        <div className="flex gap-2"><button type="button" onClick={saveCompany} disabled={savingCompany} className="inline-flex items-center rounded bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{savingCompany ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />} Save Profile</button><button type="button" onClick={() => { setEditingCompany(false); void loadOrg(); }} className="rounded border px-3 py-2 text-sm">Cancel</button></div>
      </div>}
      {companyMessage && <p className="mt-3 text-sm text-gray-700">{companyMessage}</p>}
    </section>
    <section className="rounded-lg border bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-xl font-bold text-gray-900"><UserRound className="h-5 w-5 text-blue-700" /> My Information</h2><button type="button" onClick={() => setEditingMyInfo(true)} className="inline-flex items-center rounded border px-3 py-1.5 text-sm font-semibold text-blue-700"><Edit3 className="mr-1 h-4 w-4" /> Edit My Info</button></div>
      <dl className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4"><Field label="Name" value={myInfo.fullName || myInfo.email || uid} /><Field label="Email" value={myInfo.email} /><Field label="Phone" value={myInfo.phone} /><Field label="Title / Position" value={myInfo.title} /></dl>
      {myInfoMessage && <p className="mt-3 text-sm text-gray-700">{myInfoMessage}</p>}
    </section>
    {canManageCompany && <OrganizationUsers orgId={orgId} orgName={org.name || companyProfile.legalName} isSuperAdmin={isSuperAdmin} showTechnicalNotice={false} />}
    {canManageCompany && <OrgInvitations orgId={orgId} uid={uid} role={role} isSuperAdmin={isSuperAdmin} embedded />}
    {editingMyInfo && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={event => { if (event.target === event.currentTarget) setEditingMyInfo(false); }}><form className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl" onSubmit={event => { event.preventDefault(); void saveMyInfo(); }}><div className="flex items-center justify-between"><h3 className="text-lg font-bold">Edit My Info</h3><button type="button" onClick={() => setEditingMyInfo(false)} title="Close edit my info" className="p-1 text-gray-500 hover:text-gray-900"><X className="h-5 w-5" /></button></div><div className="mt-4 space-y-3"><input ref={fullNameInputRef} value={myInfo.fullName} onChange={event => setMyInfo(current => ({...current, fullName: event.target.value}))} placeholder="Full Name" className={inputClass} /><input readOnly value={myInfo.email} placeholder="Email" className={`${inputClass} bg-gray-50`} /><input ref={phoneInputRef} value={myInfo.phone} onChange={event => setMyInfo(current => ({...current, phone: event.target.value}))} placeholder="Phone" className={inputClass} /><input ref={titleInputRef} value={myInfo.title} onChange={event => setMyInfo(current => ({...current, title: event.target.value}))} placeholder="Title / Position" className={inputClass} /><div className="flex gap-2"><button type="submit" disabled={savingMyInfo} className="inline-flex items-center rounded bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Save className="mr-1 h-4 w-4" /> {savingMyInfo ? "Saving..." : "Save"}</button><button type="button" onClick={() => setEditingMyInfo(false)} className="rounded border px-3 py-2 text-sm">Cancel</button></div></div></form></div>}
  </div>;
};
