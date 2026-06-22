import React, { useEffect, useMemo, useState } from "react";
import { Eye, Loader2, Plus, X } from "lucide-react";
import {
  formatSponsorObserverDate,
  loadSponsorObservers,
  saveSponsorObserver,
  SPONSOR_PROGRAM_OPTIONS,
  type SponsorObserver,
} from "../src/sponsorObservers";

type Props = {
  isSuperAdmin: boolean;
};

type FormState = {
  uid: string;
  email: string;
  displayName: string;
  temporaryPassword: string;
  confirmTemporaryPassword: string;
  status: "active" | "inactive";
  sponsorProgram: string;
  sponsorProgramOther: string;
};

const emptyForm: FormState = {
  uid: "",
  email: "",
  displayName: "",
  temporaryPassword: "",
  confirmTemporaryPassword: "",
  status: "active",
  sponsorProgram: "CT Manufacturing Pilot",
  sponsorProgramOther: "",
};

export const SponsorObserversManager: React.FC<Props> = ({ isSuperAdmin }) => {
  const [observers, setObservers] = useState<SponsorObserver[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const isEditing = Boolean(form.uid);
  const visibleObservers = useMemo(
    () => observers.slice().sort((a, b) => String(a.email || "").localeCompare(String(b.email || ""))),
    [observers]
  );

  const refresh = async () => {
    if (!isSuperAdmin) return;
    setLoading(true);
    setError("");
    try {
      setObservers(await loadSponsorObservers());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load sponsor observers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, [isSuperAdmin]);

  const startCreate = () => {
    setForm(emptyForm);
    setMessage("");
    setError("");
    setOpen(true);
  };

  const startEdit = (observer: SponsorObserver) => {
    setForm({
      uid: observer.uid,
      email: observer.email || "",
      displayName: observer.displayName || observer.fullName || "",
      temporaryPassword: "",
      confirmTemporaryPassword: "",
      status: observer.status === "inactive" ? "inactive" : "active",
      sponsorProgram: observer.sponsorProgram || "CT Manufacturing Pilot",
      sponsorProgramOther: observer.sponsorProgramOther || "",
    });
    setMessage("");
    setError("");
    setOpen(true);
  };

  const submit = async () => {
    const email = form.email.trim().toLowerCase();
    const displayName = form.displayName.trim();
    setError("");
    setMessage("");
    if (!email || !displayName) return setError("Name and email are required.");
    if (!isEditing && form.temporaryPassword.length < 6) return setError("Temporary password must be at least 6 characters.");
    if (!isEditing && form.temporaryPassword !== form.confirmTemporaryPassword) return setError("Temporary passwords do not match.");
    if (form.sponsorProgram === "Other" && !form.sponsorProgramOther.trim()) return setError("Enter the sponsor program name for Other.");
    setSaving(true);
    try {
      const result = await saveSponsorObserver({
        uid: form.uid || undefined,
        email,
        displayName,
        temporaryPassword: isEditing ? undefined : form.temporaryPassword,
        status: form.status,
        sponsorProgram: form.sponsorProgram,
        sponsorProgramOther: form.sponsorProgram === "Other" ? form.sponsorProgramOther.trim() : "",
      });
      setMessage(result.message);
      setOpen(false);
      await refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save sponsor observer.");
    } finally {
      setSaving(false);
    }
  };

  if (!isSuperAdmin) return null;

  return (
    <section className="rounded-lg border bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Sponsor Observers</h3>
          <p className="mt-1 text-xs text-gray-500">Manage read-only Sponsor Observer users for pilot oversight programs.</p>
        </div>
        <button type="button" onClick={startCreate} className="inline-flex items-center rounded bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800">
          <Plus className="mr-2 h-4 w-4" /> Add Sponsor Observer
        </button>
      </div>

      {(message || error) && <p className={`m-4 rounded border px-3 py-2 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{error || message}</p>}
      {loading ? <p className="p-4 text-sm text-gray-600">Loading sponsor observers...</p> : visibleObservers.length === 0 ? <p className="p-4 text-sm text-gray-600">No Sponsor Observer users yet.</p> :
      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr><th className="p-3 text-left">Name</th><th className="p-3 text-left">Email</th><th className="p-3 text-left">Sponsor Program</th><th className="p-3 text-left">Status</th><th className="p-3 text-left">Created Date</th><th className="p-3 text-left">Last Login</th><th className="p-3 text-left">Actions</th></tr>
          </thead>
          <tbody>
            {visibleObservers.map(observer => (
              <tr key={observer.uid} className="border-t">
                <td className="p-3 font-medium text-gray-900">{observer.displayName || observer.fullName || "Not provided"}</td>
                <td className="p-3">{observer.email}</td>
                <td className="p-3">{observer.sponsorProgram === "Other" ? observer.sponsorProgramOther || "Other" : observer.sponsorProgram || "Not provided"}</td>
                <td className="p-3 capitalize">{observer.status || "active"}</td>
                <td className="p-3">{formatSponsorObserverDate(observer.createdAt)}</td>
                <td className="p-3">{formatSponsorObserverDate(observer.lastLoginAt)}</td>
                <td className="p-3">
                  <button type="button" onClick={() => startEdit(observer)} className="inline-flex items-center rounded border px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50">
                    <Eye className="mr-1 h-3.5 w-3.5" /> Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-xl rounded-lg bg-white p-5 shadow-xl" onClick={event => event.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">{isEditing ? "Edit Sponsor Observer" : "Add Sponsor Observer"}</h3>
              <button type="button" onClick={() => setOpen(false)} title="Close Sponsor Observer form" className="p-1 text-gray-500 hover:text-gray-900"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-4 space-y-3">
              <label className="block text-sm text-gray-700">Name<input value={form.displayName} onChange={event => setForm(current => ({ ...current, displayName: event.target.value }))} className="mt-1 w-full rounded border px-3 py-2" /></label>
              <label className="block text-sm text-gray-700">Email<input type="email" value={form.email} readOnly={isEditing} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} className="mt-1 w-full rounded border px-3 py-2 read-only:bg-gray-50" /></label>
              {!isEditing && (
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block text-sm text-gray-700">Temporary Password<input type="password" autoComplete="new-password" value={form.temporaryPassword} onChange={event => setForm(current => ({ ...current, temporaryPassword: event.target.value }))} className="mt-1 w-full rounded border px-3 py-2" /></label>
                  <label className="block text-sm text-gray-700">Confirm Password<input type="password" autoComplete="new-password" value={form.confirmTemporaryPassword} onChange={event => setForm(current => ({ ...current, confirmTemporaryPassword: event.target.value }))} className="mt-1 w-full rounded border px-3 py-2" /></label>
                </div>
              )}
              <label className="block text-sm text-gray-700">Sponsor for this Program<select value={form.sponsorProgram} onChange={event => setForm(current => ({ ...current, sponsorProgram: event.target.value }))} className="mt-1 w-full rounded border bg-white px-3 py-2">{SPONSOR_PROGRAM_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}</select></label>
              {form.sponsorProgram === "Other" && <label className="block text-sm text-gray-700">Sponsor Program Other<input value={form.sponsorProgramOther} onChange={event => setForm(current => ({ ...current, sponsorProgramOther: event.target.value }))} className="mt-1 w-full rounded border px-3 py-2" /></label>}
              <label className="block text-sm text-gray-700">Status<select value={form.status} onChange={event => setForm(current => ({ ...current, status: event.target.value as FormState["status"] }))} className="mt-1 w-full rounded border bg-white px-3 py-2"><option value="active">active</option><option value="inactive">inactive</option></select></label>
              <p className="text-xs text-gray-500">Sponsor Observer maps to the internal pilotObserver role. Temporary passwords are used only for Auth account creation and are not stored in Firestore.</p>
              <button type="button" onClick={submit} disabled={saving} className="inline-flex w-full items-center justify-center rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Sponsor Observer</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
