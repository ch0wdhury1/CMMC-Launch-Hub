import React, { useEffect, useMemo, useState } from "react";
import { Building2, CreditCard, Edit3, Loader2, Save, ShieldCheck, X } from "lucide-react";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../src/firebase";
import { useUserProfile } from "../src/useUserProfile";
import { useOrgMember } from "../src/useOrgMember";
import { OrganizationUsers } from "./OrganizationUsers";
import { OrgInvitations } from "./OrgInvitations";
import { createTierUpgradeRequest, subscribeOrgUpgradeRequests } from "../src/orgUpgradeRequests";
import { loadOrgUsers } from "../src/orgUsers";
import { logActivityEvent } from "../src/activityLog";
import type { OrgCompanyProfile } from "../types";

const emptyCompanyProfile = (): OrgCompanyProfile => ({
  legalName: "",
  contacts: {primary: {}, secondary: {}},
  address: {},
  cmmc: {},
});

const valueOrMissing = (value: unknown) => String(value || "").trim() || "Not provided";
const isValidEmail = (value: string) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const isValidWebsite = (value: string) => {
  if (!value) return true;
  try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
};
const formatDate = (value: any) => {
  if (!value) return "Not provided";
  const date = value?.toDate ? value.toDate() : value?._seconds ? new Date(value._seconds * 1000) : new Date(value);
  return Number.isNaN(date.getTime()) ? "Not provided" : date.toLocaleDateString();
};

const Field: React.FC<{label: string; value: unknown}> = ({label, value}) => (
  <div><dt className="text-xs font-semibold uppercase text-gray-500">{label}</dt><dd className="mt-1 text-sm text-gray-800">{valueOrMissing(value)}</dd></div>
);

export const AdminPanel: React.FC = () => {
  const {loading: profileLoading, profile} = useUserProfile();
  const orgId = String((profile as any)?.orgId || "");
  const uid = auth.currentUser?.uid || "";
  const {loading: memberLoading, member} = useOrgMember(orgId || undefined);
  const role = member?.role || (profile as any)?.roles?.orgRole;
  const isSuperAdmin = (profile as any)?.roles?.superAdmin === true;
  const canEdit = isSuperAdmin || role === "orgOwner" || role === "orgAdmin";
  const [org, setOrg] = useState<any>(null);
  const [profileForm, setProfileForm] = useState<OrgCompanyProfile>(emptyCompanyProfile);
  const [companyName, setCompanyName] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [pendingUpgrade, setPendingUpgrade] = useState(false);
  const [requestingUpgrade, setRequestingUpgrade] = useState(false);
  const [activeUserCount, setActiveUserCount] = useState(0);

  const loadOrg = async () => {
    if (!orgId) return;
    const snapshot = await getDoc(doc(db, "orgs", orgId));
    if (!snapshot.exists()) throw new Error("Organization not found.");
    const next = {id: snapshot.id, ...snapshot.data()};
    setOrg(next);
    setCompanyName(next.name || next.companyProfile?.legalName || "");
    setCompanyPhone(next.phone || next.primaryContactPhone || "");
    setProfileForm({
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
    if (!orgId) return;
    void loadOrg().catch(error => setMessage(error instanceof Error ? error.message : "Unable to load company information."));
    return subscribeOrgUpgradeRequests(orgId, requests => setPendingUpgrade(requests.some(request => request.status === "pending")), error => {
      console.warn("[admin-panel] upgrade request load failed", error);
      setMessage("Unable to load upgrade request status.");
    });
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;
    void loadOrgUsers(orgId).then(result => {
      setActiveUserCount(result.users.filter(user => user.membership.status === "active" && user.membership.active !== false).length);
    }).catch(error => console.warn("[admin-panel] active user count unavailable", error));
  }, [orgId]);

  const setProfileField = (field: keyof OrgCompanyProfile, value: string) => setProfileForm(current => ({...current, [field]: value}));
  const setContactField = (field: string, value: string) => setProfileForm(current => ({...current, contacts: {...current.contacts, primary: {...current.contacts.primary, [field]: value}}}));
  const setCmmcField = (field: string, value: string) => setProfileForm(current => ({...current, cmmc: {...current.cmmc, [field]: value}}));

  const saveCompany = async () => {
    if (!orgId || !uid || !canEdit) return;
    const name = companyName.trim();
    const legalName = profileForm.legalName.trim();
    const website = profileForm.website?.trim() || "";
    const email = profileForm.contacts.primary.email?.trim() || "";
    if (!name) return setMessage("Company name is required.");
    if (!legalName) return setMessage("Legal name is required.");
    if (!isValidEmail(email)) return setMessage("Enter a valid primary contact email.");
    if (!isValidWebsite(website)) return setMessage("Enter a valid website URL including http:// or https://.");
    setSaving(true); setMessage("");
    try {
      const companyProfile = {...profileForm, legalName, website, contacts: {...profileForm.contacts, primary: {...profileForm.contacts.primary, email}}};
      await setDoc(doc(db, "orgs", orgId), {
        name,
        address: companyProfile.address.street || "",
        phone: companyPhone.trim(),
        website,
        primaryContactName: companyProfile.contacts.primary.name || "",
        primaryContactEmail: email,
        primaryContactPhone: companyProfile.contacts.primary.phone || "",
        companyProfile,
        companyProfileUpdatedAt: serverTimestamp(),
        companyProfileUpdatedBy: uid,
      }, {merge: true});
      await loadOrg();
      void logActivityEvent({
        orgId,
        orgName: name || legalName,
        action: "profile.updated",
        actorUid: uid,
        targetType: "organization",
        targetId: orgId,
        targetLabel: name || legalName,
        summary: "Company information updated",
        metadata: {legalName, website},
      });
      setEditing(false);
      setMessage("Company information saved.");
    } catch (error) {
      console.error("[admin-panel] company save failed", error);
      setMessage("Unable to save company information.");
    } finally { setSaving(false); }
  };

  const requestUpgrade = async () => {
    if (!orgId || !uid || !canEdit || pendingUpgrade) return;
    if (!window.confirm("Request upgrade from COMM_L1 to COMM_L2?")) return;
    setRequestingUpgrade(true); setMessage("");
    try {
      const requestId = await createTierUpgradeRequest({orgId, requestedByUid: uid, requestedByEmail: String((profile as any)?.email || auth.currentUser?.email || "")});
      void logActivityEvent({
        orgId,
        orgName: org?.name || org?.companyProfile?.legalName || orgId,
        action: "tier.requested",
        actorUid: uid,
        targetType: "accessRequest",
        targetId: requestId,
        targetLabel: "COMM_L2",
        summary: "Tier upgrade requested from COMM_L1 to COMM_L2",
        metadata: {currentTier: "COMM_L1", requestedTier: "COMM_L2"},
      });
      setMessage("Upgrade request pending.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to request tier upgrade.");
    } finally { setRequestingUpgrade(false); }
  };

  const tier = String(org?.tier || "COMM_L1").toUpperCase();
  const inputClass = "w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900";
  const summary = useMemo(() => [
    ["Company Name", org?.name], ["Legal Name", org?.companyProfile?.legalName], ["Tier", org?.tier], ["Subscription Status", org?.subscriptionStatus],
    ["Subscription Start Date", formatDate(org?.subscriptionStartDate || org?.subscriptionStart)], ["Subscription End Date", formatDate(org?.subscriptionEndDate || org?.subscriptionEnd)],
    ["Billing Cycle", org?.billingCycle], ["Primary Contact Name", org?.primaryContactName || org?.companyProfile?.contacts?.primary?.name],
    ["Primary Contact Email", org?.primaryContactEmail || org?.companyProfile?.contacts?.primary?.email], ["Primary Contact Phone", org?.primaryContactPhone || org?.companyProfile?.contacts?.primary?.phone],
    ["Address", typeof org?.address === "string" ? org.address : org?.companyProfile?.address?.street], ["Website", org?.website || org?.companyProfile?.website],
    ["CAGE Code", org?.companyProfile?.cageCode], ["UEI", org?.companyProfile?.uei], ["NAICS", org?.companyProfile?.naics], ["Assessment Level", org?.companyProfile?.cmmc?.assessmentLevel],
    ["Handles FCI", org?.companyProfile?.cmmc?.handlesFCI], ["Handles CUI", org?.companyProfile?.cmmc?.handlesCUI],
  ], [org]);

  if (profileLoading || memberLoading) return <div className="rounded-lg border bg-white p-6 text-sm text-gray-600">Loading Admin Panel...</div>;
  if (!orgId || !org) return <div className="rounded-lg border bg-white p-6 text-sm text-red-700">{message || "Current organization is unavailable."}</div>;

  return <div className="space-y-5 animate-fadeIn">
    <section className="rounded-lg border bg-white p-5 shadow-sm"><h2 className="text-xl font-bold text-gray-900">Organization Admin</h2><p className="mt-1 text-sm text-gray-600">{org.name || org.companyProfile?.legalName || "Your Organization"}</p></section>
    <section className="rounded-lg border bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3"><h3 className="flex items-center gap-2 font-bold text-gray-900"><Building2 className="h-5 w-5 text-blue-700" /> Company Information</h3>{canEdit && !editing && <button onClick={() => setEditing(true)} className="flex items-center rounded border px-3 py-1.5 text-sm font-semibold text-blue-700"><Edit3 className="mr-1 h-4 w-4" /> Edit</button>}</div>
      {!editing ? <dl className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">{summary.map(([label, value]) => <Field key={label} label={String(label)} value={value} />)}</dl> :
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <input className={inputClass} placeholder="Company Name *" value={companyName} onChange={event => setCompanyName(event.target.value)} /><input className={inputClass} placeholder="Legal Name *" value={profileForm.legalName} onChange={event => setProfileField("legalName", event.target.value)} />
        <input className={inputClass} placeholder="Address" value={profileForm.address.street || ""} onChange={event => setProfileForm(current => ({...current, address: {...current.address, street: event.target.value}}))} /><input className={inputClass} placeholder="Phone" value={companyPhone} onChange={event => setCompanyPhone(event.target.value)} />
        <input className={inputClass} placeholder="Website (https://...)" value={profileForm.website || ""} onChange={event => setProfileField("website", event.target.value)} />
        <input className={inputClass} placeholder="Primary Contact Name" value={profileForm.contacts.primary.name || ""} onChange={event => setContactField("name", event.target.value)} /><input className={inputClass} placeholder="Primary Contact Email" value={profileForm.contacts.primary.email || ""} onChange={event => setContactField("email", event.target.value)} />
        <input className={inputClass} placeholder="Primary Contact Phone" value={profileForm.contacts.primary.phone || ""} onChange={event => setContactField("phone", event.target.value)} /><input className={inputClass} placeholder="CAGE Code" value={profileForm.cageCode || ""} onChange={event => setProfileField("cageCode", event.target.value)} />
        <input className={inputClass} placeholder="UEI" value={profileForm.uei || ""} onChange={event => setProfileField("uei", event.target.value)} /><input className={inputClass} placeholder="NAICS" value={profileForm.naics || ""} onChange={event => setProfileField("naics", event.target.value)} />
        <select className={inputClass} value={profileForm.cmmc.handlesFCI || ""} onChange={event => setCmmcField("handlesFCI", event.target.value)}><option value="">Handles FCI</option><option value="yes">Yes</option><option value="no">No</option><option value="unknown">Unknown</option></select>
        <select className={inputClass} value={profileForm.cmmc.handlesCUI || ""} onChange={event => setCmmcField("handlesCUI", event.target.value)}><option value="">Handles CUI</option><option value="yes">Yes</option><option value="no">No</option><option value="unknown">Unknown</option></select>
        <input className={inputClass} placeholder="System Name" value={profileForm.cmmc.systemName || ""} onChange={event => setCmmcField("systemName", event.target.value)} /><input className={inputClass} placeholder="System Owner" value={profileForm.cmmc.systemOwner || ""} onChange={event => setCmmcField("systemOwner", event.target.value)} />
        <textarea className={inputClass} placeholder="System Description" value={profileForm.cmmc.systemDescription || ""} onChange={event => setCmmcField("systemDescription", event.target.value)} /><textarea className={inputClass} placeholder="System Boundary Summary" value={profileForm.cmmc.systemBoundarySummary || ""} onChange={event => setCmmcField("systemBoundarySummary", event.target.value)} />
        <input className={inputClass} placeholder="Cloud Providers" value={profileForm.cmmc.cloudProviders || ""} onChange={event => setCmmcField("cloudProviders", event.target.value)} /><input className={inputClass} placeholder="IT Provider" value={profileForm.cmmc.itProvider || ""} onChange={event => setCmmcField("itProvider", event.target.value)} />
        <div className="flex gap-2 md:col-span-2"><button onClick={saveCompany} disabled={saving} className="flex items-center rounded bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />} Save</button><button onClick={() => { setEditing(false); void loadOrg(); }} className="flex items-center rounded border px-3 py-2 text-sm"><X className="mr-1 h-4 w-4" /> Cancel</button></div>
      </div>}
      {message && <p className="mt-3 text-sm text-gray-700">{message}</p>}
    </section>
    <section className="rounded-lg border bg-white p-5 shadow-sm"><h3 className="flex items-center gap-2 font-bold text-gray-900"><CreditCard className="h-5 w-5 text-blue-700" /> Subscription / Tier Information</h3><dl className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4"><Field label="Current Tier" value={tier} /><Field label="Subscription" value={org.subscriptionStatus} /><Field label="Start Date" value={formatDate(org.subscriptionStartDate || org.subscriptionStart)} /><Field label="End Date" value={formatDate(org.subscriptionEndDate || org.subscriptionEnd)} /><Field label="Billing Cycle" value={org.billingCycle} /><Field label="Users" value={`${activeUserCount} / ${org.maxUsers || "Not provided"}`} /></dl></section>
    <OrganizationUsers orgId={orgId} orgName={org.name || org.companyProfile?.legalName || "Your Organization"} isSuperAdmin={isSuperAdmin} showTechnicalNotice={false} />
    <OrgInvitations orgId={orgId} uid={uid} role={role} isSuperAdmin={isSuperAdmin} embedded />
    <section className="rounded-lg border bg-white p-5 shadow-sm"><h3 className="flex items-center gap-2 font-bold text-gray-900"><ShieldCheck className="h-5 w-5 text-blue-700" /> Tier Upgrade Request</h3><div className="mt-3 text-sm text-gray-700">{tier === "COMM_L1" ? pendingUpgrade ? <p>Upgrade request pending.</p> : <button onClick={requestUpgrade} disabled={!canEdit || requestingUpgrade} className="rounded bg-blue-700 px-3 py-2 font-semibold text-white disabled:opacity-50">{requestingUpgrade ? "Requesting..." : "Request Upgrade to COMM_L2"}</button> : tier === "COMM_L2" ? <p>Your organization is already on COMM_L2.</p> : <p>Your organization is on a Sponsored plan.</p>}</div></section>
  </div>;
};
