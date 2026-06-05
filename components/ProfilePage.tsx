import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Building2, CheckCircle2, Edit3, Loader2, Save, UserRound, X } from "lucide-react";
import { doc, getDoc, getDocFromServer, serverTimestamp, setDoc, writeBatch } from "firebase/firestore";
import { auth, db } from "../src/firebase";
import { useOrgMember } from "../src/useOrgMember";
import { useUserProfile } from "../src/useUserProfile";
import { OrganizationUsers } from "./OrganizationUsers";
import { OrgInvitations } from "./OrgInvitations";
import { logActivityEvent } from "../src/activityLog";
import type { OrgCompanyProfile } from "../types";

type ReadinessMetrics = {
  completionPercent: number;
  practicesAssessed: number;
  evidenceCount: number;
  openPoamCount: number;
  sprsScore: number;
};

type ProfilePageProps = {
  readinessMetrics?: ReadinessMetrics;
};

const emptyCompanyProfile = (): OrgCompanyProfile => ({
  legalName: "",
  contacts: { primary: {}, secondary: {} },
  address: {},
  cmmc: {},
  scope: {},
  providers: {},
});

const isValidEmail = (value: string) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const isValidWebsite = (value: string) => {
  if (!value) return true;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};
const valueOrMissing = (value: unknown) => String(value || "").trim() || "Not provided";
const isFilled = (value: unknown) => String(value || "").trim().length > 0;
const yesNoOptions = [
  ["", "Not provided"],
  ["yes", "Yes"],
  ["no", "No"],
  ["unknown", "Unknown"],
] as const;

const Field: React.FC<{ label: string; value: unknown }> = ({ label, value }) => (
  <div>
    <dt className="text-xs font-semibold uppercase text-gray-500">{label}</dt>
    <dd className="mt-1 whitespace-pre-wrap text-sm text-gray-800">{valueOrMissing(value)}</dd>
  </div>
);

const TextInput: React.FC<{
  label: string;
  value?: string;
  onChange: (value: string) => void;
  type?: string;
}> = ({ label, value, onChange, type = "text" }) => (
  <label className="block">
    <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">{label}</span>
    <input
      type={type}
      className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
      value={value || ""}
      onChange={event => onChange(event.target.value)}
    />
  </label>
);

const TextArea: React.FC<{ label: string; value?: string; onChange: (value: string) => void }> = ({ label, value, onChange }) => (
  <label className="block">
    <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">{label}</span>
    <textarea
      className="min-h-24 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
      value={value || ""}
      onChange={event => onChange(event.target.value)}
    />
  </label>
);

const SelectInput: React.FC<{
  label: string;
  value?: string;
  options: ReadonlyArray<readonly [string, string]>;
  onChange: (value: string) => void;
}> = ({ label, value, options, onChange }) => (
  <label className="block">
    <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">{label}</span>
    <select
      className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
      value={value || ""}
      onChange={event => onChange(event.target.value)}
    >
      {options.map(([optionValue, labelText]) => <option key={optionValue} value={optionValue}>{labelText}</option>)}
    </select>
  </label>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="rounded-lg border bg-white p-5 shadow-sm">
    <h3 className="text-base font-bold text-gray-900">{title}</h3>
    <div className="mt-4">{children}</div>
  </section>
);

const MetricCard: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div className="rounded-md border bg-gray-50 p-3">
    <div className="text-xs font-semibold uppercase text-gray-500">{label}</div>
    <div className="mt-1 text-2xl font-bold text-gray-900">{value}</div>
  </div>
);

const confirmIdentityCommit = async (ref: ReturnType<typeof doc>, identity: { displayName: string; fullName: string; phone: string; title: string }) => {
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

export const ProfilePage: React.FC<ProfilePageProps> = ({ readinessMetrics }) => {
  const { loading: profileLoading, profile } = useUserProfile();
  const uid = auth.currentUser?.uid || "";
  const orgId = String((profile as any)?.orgId || "");
  const { loading: memberLoading, member } = useOrgMember(orgId || undefined);
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
  const [myInfo, setMyInfo] = useState({ fullName: "", email: "", phone: "", title: "" });
  const fullNameInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const loadOrg = async () => {
    if (!orgId) return;
    const snapshot = await getDoc(doc(db, "orgs", orgId));
    if (!snapshot.exists()) throw new Error("Organization not found.");
    const next = { id: snapshot.id, ...snapshot.data() };
    const persisted = next.companyProfile || {};
    setOrg(next);
    setCompanyProfile({
      ...emptyCompanyProfile(),
      ...persisted,
      legalName: persisted.legalName || persisted.companyName || next.name || "",
      website: persisted.website || next.website || "",
      contacts: {
        primary: {
          ...persisted.contacts?.primary,
          name: persisted.contacts?.primary?.name || next.primaryContactName || "",
          email: persisted.contacts?.primary?.email || next.primaryContactEmail || "",
          phone: persisted.contacts?.primary?.phone || next.primaryContactPhone || "",
        },
        secondary: { ...persisted.contacts?.secondary },
      },
      address: { street: typeof next.address === "string" ? next.address : "", ...persisted.address },
      cmmc: { ...persisted.cmmc },
      scope: { ...persisted.scope },
      providers: { ...persisted.providers },
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

  const setProfileField = (field: keyof OrgCompanyProfile, value: string) => setCompanyProfile(current => ({ ...current, [field]: value }));
  const setContactField = (contact: "primary" | "secondary", field: keyof OrgCompanyProfile["contacts"]["primary"], value: string) =>
    setCompanyProfile(current => ({ ...current, contacts: { ...current.contacts, [contact]: { ...current.contacts[contact], [field]: value } } }));
  const setAddressField = (field: keyof OrgCompanyProfile["address"], value: string) =>
    setCompanyProfile(current => ({ ...current, address: { ...current.address, [field]: value } }));
  const setCmmcField = (field: keyof OrgCompanyProfile["cmmc"], value: string) =>
    setCompanyProfile(current => ({ ...current, cmmc: { ...current.cmmc, [field]: value } }));
  const setScopeField = (field: keyof NonNullable<OrgCompanyProfile["scope"]>, value: string) =>
    setCompanyProfile(current => ({ ...current, scope: { ...current.scope, [field]: value } }));
  const setProviderField = (field: keyof NonNullable<OrgCompanyProfile["providers"]>, value: string) =>
    setCompanyProfile(current => ({ ...current, providers: { ...current.providers, [field]: value } }));
  const inputClass = "w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900";

  const headquarters = companyProfile.scope?.headquarters
    || [companyProfile.address.street, companyProfile.address.city, companyProfile.address.state, companyProfile.address.zip, companyProfile.address.country].filter(Boolean).join(", ");

  const dataQualityFlags = useMemo(() => [
    { label: "Missing CAGE", active: !isFilled(companyProfile.cageCode) },
    { label: "Missing UEI", active: !isFilled(companyProfile.uei) },
    {
      label: "Missing Contacts",
      active: !isFilled(companyProfile.contacts.primary.name)
        || !isFilled(companyProfile.contacts.primary.email)
        || !isFilled(companyProfile.contacts.primary.phone),
    },
    { label: "Missing Locations", active: !isFilled(headquarters) && !isFilled(companyProfile.scope?.additionalLocations) },
  ], [companyProfile, headquarters]);

  const profileCompleteness = useMemo(() => {
    const requiredFields = [
      companyProfile.legalName,
      companyProfile.website,
      companyProfile.contacts.primary.name,
      companyProfile.contacts.primary.email,
      companyProfile.contacts.primary.phone,
      companyProfile.contacts.secondary.name,
      companyProfile.contacts.secondary.email,
      companyProfile.cageCode,
      companyProfile.uei,
      companyProfile.naicsCodes || companyProfile.naics,
      companyProfile.cmmc.assessmentLevel,
      companyProfile.cmmc.handlesFCI,
      companyProfile.cmmc.handlesCUI,
      companyProfile.cmmc.mspMsspUsed,
      companyProfile.cmmc.employeeCount,
      companyProfile.cmmc.userCount,
      companyProfile.cmmc.locationCount,
      headquarters,
      companyProfile.providers?.cloudProvider,
      companyProfile.providers?.emailProvider,
      companyProfile.providers?.backupProvider,
    ];
    const missing = requiredFields.filter(field => !isFilled(field)).length;
    return {
      missing,
      percent: Math.round(((requiredFields.length - missing) / requiredFields.length) * 100),
    };
  }, [companyProfile, headquarters]);

  const metricValues = readinessMetrics || {
    completionPercent: 0,
    practicesAssessed: 0,
    evidenceCount: 0,
    openPoamCount: 0,
    sprsScore: 0,
  };

  const saveCompany = async () => {
    if (!orgId || !uid || !canManageCompany) return;
    const legalName = companyProfile.legalName.trim();
    const primaryEmail = companyProfile.contacts.primary.email?.trim() || "";
    const secondaryEmail = companyProfile.contacts.secondary.email?.trim() || "";
    const website = companyProfile.website?.trim() || "";
    if (!legalName) return setCompanyMessage("Legal name is required.");
    if (!isValidEmail(primaryEmail)) return setCompanyMessage("Enter a valid primary contact email.");
    if (!isValidEmail(secondaryEmail)) return setCompanyMessage("Enter a valid secondary contact email.");
    if (!isValidWebsite(website)) return setCompanyMessage("Enter a valid website URL including http:// or https://.");
    setSavingCompany(true);
    setCompanyMessage("");
    try {
      const nextProfile: OrgCompanyProfile = {
        ...companyProfile,
        legalName,
        website,
        naics: (companyProfile.naicsCodes || companyProfile.naics || "").trim(),
        naicsCodes: (companyProfile.naicsCodes || companyProfile.naics || "").trim(),
        contacts: {
          primary: { ...companyProfile.contacts.primary, email: primaryEmail },
          secondary: { ...companyProfile.contacts.secondary, email: secondaryEmail },
        },
      };
      await setDoc(doc(db, "orgs", orgId), {
        companyProfile: nextProfile,
        website: nextProfile.website || "",
        address: nextProfile.address.street || "",
        primaryContactName: nextProfile.contacts.primary.name || "",
        primaryContactEmail: nextProfile.contacts.primary.email || "",
        primaryContactPhone: nextProfile.contacts.primary.phone || "",
        companyProfileUpdatedAt: serverTimestamp(),
        companyProfileUpdatedBy: uid,
      }, { merge: true });
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
        metadata: { legalName: nextProfile.legalName, website: nextProfile.website || "", completeness: profileCompleteness.percent },
      });
      setEditingCompany(false);
      setCompanyMessage("Company profile saved.");
    } catch (error) {
      console.error("[profile] company save failed", error);
      setCompanyMessage("Unable to save company profile.");
    } finally {
      setSavingCompany(false);
    }
  };

  const saveMyInfo = async () => {
    if (!uid || !orgId) return;
    const fullName = (fullNameInputRef.current?.value ?? myInfo.fullName).trim();
    if (!fullName) return setMyInfoMessage("Full name is required.");
    setSavingMyInfo(true);
    setMyInfoMessage("");
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
      batch.set(userRef, identity, { merge: true });
      batch.set(memberRef, identity, { merge: true });
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
        metadata: { fields: ["displayName", "fullName", "phone", "title"] },
      });
      setMyInfo(current => ({ ...current, fullName: identity.fullName, phone: identity.phone, title: identity.title }));
      setEditingMyInfo(false);
      setMyInfoMessage("My information saved.");
    } catch (error) {
      console.error("[profile] self save failed", error);
      setMyInfoMessage("Unable to save my information.");
    } finally {
      setSavingMyInfo(false);
    }
  };

  if (profileLoading || memberLoading) return <div className="rounded-lg border bg-white p-6 text-sm text-gray-600">Loading Company Profile...</div>;
  if (!uid || !orgId || !org) return <div className="rounded-lg border bg-white p-6 text-sm text-red-700">{companyMessage || "Current organization is unavailable."}</div>;

  return <div className="space-y-5 animate-fadeIn">
    <section className="rounded-lg border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900"><Building2 className="h-5 w-5 text-blue-700" /> Company Profile</h2>
          <p className="mt-1 text-sm text-gray-600">{companyProfile.legalName || org.name || "Your Organization"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-md border bg-blue-50 px-3 py-2 text-sm text-blue-900">
            <strong>{profileCompleteness.percent}%</strong> complete · {profileCompleteness.missing} missing
          </div>
          {canManageCompany && !editingCompany && <button type="button" onClick={() => setEditingCompany(true)} className="inline-flex items-center rounded border px-3 py-2 text-sm font-semibold text-blue-700"><Edit3 className="mr-1 h-4 w-4" /> Edit</button>}
        </div>
      </div>
      {companyMessage && <p className="mt-3 text-sm text-gray-700">{companyMessage}</p>}
    </section>

    <Section title="Data Quality Flags">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {dataQualityFlags.map(flag => (
          <div key={flag.label} className={`flex items-center gap-2 rounded-md border p-3 text-sm ${flag.active ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-900"}`}>
            {flag.active ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            {flag.label}
          </div>
        ))}
      </div>
    </Section>

    <Section title="Readiness Metrics">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <MetricCard label="Completion %" value={`${metricValues.completionPercent}%`} />
        <MetricCard label="Practices Assessed" value={metricValues.practicesAssessed} />
        <MetricCard label="Evidence Count" value={metricValues.evidenceCount} />
        <MetricCard label="Open POA&M" value={metricValues.openPoamCount} />
        <MetricCard label="SPRS Score" value={metricValues.sprsScore} />
      </div>
    </Section>

    {!editingCompany ? (
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Section title="Organization Identity">
          <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Legal Name" value={companyProfile.legalName} />
            <Field label="DBA Name" value={companyProfile.dbaName} />
            <Field label="Website" value={companyProfile.website} />
            <Field label="Primary Contact" value={companyProfile.contacts.primary.name} />
            <Field label="Primary Contact Email" value={companyProfile.contacts.primary.email} />
            <Field label="Primary Contact Phone" value={companyProfile.contacts.primary.phone} />
            <Field label="Secondary Contact" value={companyProfile.contacts.secondary.name} />
            <Field label="Secondary Contact Email" value={companyProfile.contacts.secondary.email} />
            <Field label="Secondary Contact Phone" value={companyProfile.contacts.secondary.phone} />
          </dl>
        </Section>
        <Section title="Government Information">
          <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="CAGE Code" value={companyProfile.cageCode} />
            <Field label="UEI" value={companyProfile.uei} />
            <Field label="DUNS" value={companyProfile.duns} />
            <Field label="NAICS Codes" value={companyProfile.naicsCodes || companyProfile.naics} />
          </dl>
        </Section>
        <Section title="Compliance Profile">
          <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Handles FCI" value={companyProfile.cmmc.handlesFCI} />
            <Field label="Handles CUI" value={companyProfile.cmmc.handlesCUI} />
            <Field label="Assessment Level" value={companyProfile.cmmc.assessmentLevel} />
            <Field label="MSP/MSSP Used" value={companyProfile.cmmc.mspMsspUsed} />
            <Field label="MSP/MSSP Name" value={companyProfile.cmmc.mspMsspName} />
            <Field label="Employee Count" value={companyProfile.cmmc.employeeCount} />
            <Field label="User Count" value={companyProfile.cmmc.userCount} />
            <Field label="Location Count" value={companyProfile.cmmc.locationCount} />
          </dl>
        </Section>
        <Section title="Scope Profile">
          <dl className="grid grid-cols-1 gap-4">
            <Field label="Headquarters" value={headquarters} />
            <Field label="Additional Locations" value={companyProfile.scope?.additionalLocations} />
          </dl>
        </Section>
        <Section title="External Providers">
          <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="MSP" value={companyProfile.providers?.msp || companyProfile.cmmc.itProvider} />
            <Field label="MSSP" value={companyProfile.providers?.mssp} />
            <Field label="Cloud Provider" value={companyProfile.providers?.cloudProvider || companyProfile.cmmc.cloudProviders} />
            <Field label="Email Provider" value={companyProfile.providers?.emailProvider} />
            <Field label="Backup Provider" value={companyProfile.providers?.backupProvider} />
          </dl>
        </Section>
      </div>
    ) : (
      <section className="rounded-lg border bg-white p-5 shadow-sm">
        <div className="space-y-6">
          <div>
            <h3 className="text-base font-bold text-gray-900">Organization Identity</h3>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <TextInput label="Legal Name" value={companyProfile.legalName} onChange={value => setProfileField("legalName", value)} />
              <TextInput label="DBA Name" value={companyProfile.dbaName} onChange={value => setProfileField("dbaName", value)} />
              <TextInput label="Website" value={companyProfile.website} onChange={value => setProfileField("website", value)} />
              <TextInput label="Primary Contact" value={companyProfile.contacts.primary.name} onChange={value => setContactField("primary", "name", value)} />
              <TextInput label="Primary Contact Email" value={companyProfile.contacts.primary.email} onChange={value => setContactField("primary", "email", value)} />
              <TextInput label="Primary Contact Phone" value={companyProfile.contacts.primary.phone} onChange={value => setContactField("primary", "phone", value)} />
              <TextInput label="Secondary Contact" value={companyProfile.contacts.secondary.name} onChange={value => setContactField("secondary", "name", value)} />
              <TextInput label="Secondary Contact Email" value={companyProfile.contacts.secondary.email} onChange={value => setContactField("secondary", "email", value)} />
              <TextInput label="Secondary Contact Phone" value={companyProfile.contacts.secondary.phone} onChange={value => setContactField("secondary", "phone", value)} />
            </div>
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">Government Information</h3>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
              <TextInput label="CAGE Code" value={companyProfile.cageCode} onChange={value => setProfileField("cageCode", value)} />
              <TextInput label="UEI" value={companyProfile.uei} onChange={value => setProfileField("uei", value)} />
              <TextInput label="DUNS" value={companyProfile.duns} onChange={value => setProfileField("duns", value)} />
              <TextInput label="NAICS Codes" value={companyProfile.naicsCodes || companyProfile.naics} onChange={value => setProfileField("naicsCodes", value)} />
            </div>
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">Compliance Profile</h3>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
              <SelectInput label="Handles FCI" value={companyProfile.cmmc.handlesFCI} options={yesNoOptions} onChange={value => setCmmcField("handlesFCI", value)} />
              <SelectInput label="Handles CUI" value={companyProfile.cmmc.handlesCUI} options={yesNoOptions} onChange={value => setCmmcField("handlesCUI", value)} />
              <SelectInput label="Assessment Level" value={companyProfile.cmmc.assessmentLevel} options={[["", "Not provided"], ["L1", "L1"], ["L2", "L2"]]} onChange={value => setCmmcField("assessmentLevel", value)} />
              <SelectInput label="MSP/MSSP Used" value={companyProfile.cmmc.mspMsspUsed} options={yesNoOptions} onChange={value => setCmmcField("mspMsspUsed", value)} />
              <TextInput label="MSP/MSSP Name" value={companyProfile.cmmc.mspMsspName} onChange={value => setCmmcField("mspMsspName", value)} />
              <TextInput label="Employee Count" value={companyProfile.cmmc.employeeCount} onChange={value => setCmmcField("employeeCount", value)} />
              <TextInput label="User Count" value={companyProfile.cmmc.userCount} onChange={value => setCmmcField("userCount", value)} />
              <TextInput label="Location Count" value={companyProfile.cmmc.locationCount} onChange={value => setCmmcField("locationCount", value)} />
            </div>
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">Scope Profile</h3>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <TextInput label="Headquarters" value={companyProfile.scope?.headquarters || headquarters} onChange={value => setScopeField("headquarters", value)} />
              <TextArea label="Additional Locations" value={companyProfile.scope?.additionalLocations} onChange={value => setScopeField("additionalLocations", value)} />
            </div>
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">External Providers</h3>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <TextInput label="MSP" value={companyProfile.providers?.msp} onChange={value => setProviderField("msp", value)} />
              <TextInput label="MSSP" value={companyProfile.providers?.mssp} onChange={value => setProviderField("mssp", value)} />
              <TextInput label="Cloud Provider" value={companyProfile.providers?.cloudProvider} onChange={value => setProviderField("cloudProvider", value)} />
              <TextInput label="Email Provider" value={companyProfile.providers?.emailProvider} onChange={value => setProviderField("emailProvider", value)} />
              <TextInput label="Backup Provider" value={companyProfile.providers?.backupProvider} onChange={value => setProviderField("backupProvider", value)} />
            </div>
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">Headquarters Address</h3>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-5">
              {(["street", "city", "state", "zip", "country"] as const).map(field => (
                <TextInput key={field} label={field} value={companyProfile.address[field]} onChange={value => setAddressField(field, value)} />
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={saveCompany} disabled={savingCompany} className="inline-flex items-center rounded bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{savingCompany ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />} Save Profile</button>
            <button type="button" onClick={() => { setEditingCompany(false); void loadOrg(); }} className="rounded border px-3 py-2 text-sm">Cancel</button>
          </div>
        </div>
      </section>
    )}

    <section className="rounded-lg border bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-xl font-bold text-gray-900"><UserRound className="h-5 w-5 text-blue-700" /> My Information</h2><button type="button" onClick={() => setEditingMyInfo(true)} className="inline-flex items-center rounded border px-3 py-1.5 text-sm font-semibold text-blue-700"><Edit3 className="mr-1 h-4 w-4" /> Edit My Info</button></div>
      <dl className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4"><Field label="Name" value={myInfo.fullName || myInfo.email || uid} /><Field label="Email" value={myInfo.email} /><Field label="Phone" value={myInfo.phone} /><Field label="Title / Position" value={myInfo.title} /></dl>
      {myInfoMessage && <p className="mt-3 text-sm text-gray-700">{myInfoMessage}</p>}
    </section>
    {canManageCompany && <OrganizationUsers orgId={orgId} orgName={org.name || companyProfile.legalName} isSuperAdmin={isSuperAdmin} showTechnicalNotice={false} />}
    {canManageCompany && <OrgInvitations orgId={orgId} uid={uid} role={role} isSuperAdmin={isSuperAdmin} embedded />}
    {editingMyInfo && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={event => { if (event.target === event.currentTarget) setEditingMyInfo(false); }}><form className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl" onSubmit={event => { event.preventDefault(); void saveMyInfo(); }}><div className="flex items-center justify-between"><h3 className="text-lg font-bold">Edit My Info</h3><button type="button" onClick={() => setEditingMyInfo(false)} title="Close edit my info" className="p-1 text-gray-500 hover:text-gray-900"><X className="h-5 w-5" /></button></div><div className="mt-4 space-y-3"><input ref={fullNameInputRef} value={myInfo.fullName} onChange={event => setMyInfo(current => ({ ...current, fullName: event.target.value }))} placeholder="Full Name" className={inputClass} /><input readOnly value={myInfo.email} placeholder="Email" className={`${inputClass} bg-gray-50`} /><input ref={phoneInputRef} value={myInfo.phone} onChange={event => setMyInfo(current => ({ ...current, phone: event.target.value }))} placeholder="Phone" className={inputClass} /><input ref={titleInputRef} value={myInfo.title} onChange={event => setMyInfo(current => ({ ...current, title: event.target.value }))} placeholder="Title / Position" className={inputClass} /><div className="flex gap-2"><button type="submit" disabled={savingMyInfo} className="inline-flex items-center rounded bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Save className="mr-1 h-4 w-4" /> {savingMyInfo ? "Saving..." : "Save"}</button><button type="button" onClick={() => setEditingMyInfo(false)} className="rounded border px-3 py-2 text-sm">Cancel</button></div></div></form></div>}
  </div>;
};
