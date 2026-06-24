import React, { useEffect, useMemo, useState } from "react";
import {
  archiveProgram,
  addProgramObserver,
  createProgram,
  listProgramsWithCounts,
  reactivateProgram,
  removeProgramObserver,
  updateProgram,
  type ProgramInput,
  type ProgramStatus,
  type ProgramType,
  type ProgramWithCounts,
} from "../src/programService";
import { useUserProfile } from "../src/useUserProfile";

const emptyDraft: ProgramInput = {
  name: "",
  programCode: "",
  programType: "STATE",
  state: "",
  sponsorName: "",
  description: "",
  status: "active",
  allowL1: true,
  allowL2: true,
  startDate: "",
  endDate: "",
  sponsorObserverEmails: [],
  sponsorObserverUids: [],
};

const splitList = (value: string) => value
  .split(/[\n,]/)
  .map(item => item.trim())
  .filter(Boolean);

const joinList = (items?: string[]) => (items || []).join("\n");

const dateLabel = (value: any) => {
  if (!value) return "Not provided";
  const date = value?.toDate ? value.toDate() : value?._seconds ? new Date(value._seconds * 1000) : new Date(value);
  return Number.isNaN(date.getTime()) ? "Not provided" : date.toLocaleDateString();
};

type Props = {
  isSuperAdmin: boolean;
};

export const ProgramManagementPage: React.FC<Props> = ({ isSuperAdmin }) => {
  const { profile } = useUserProfile();
  const [programs, setPrograms] = useState<ProgramWithCounts[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<ProgramWithCounts | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<ProgramInput>(emptyDraft);
  const [observerEmailsText, setObserverEmailsText] = useState("");
  const [observerEmail, setObserverEmail] = useState("");

  const actorUid = String((profile as any)?.uid || "");

  const load = async () => {
    if (!isSuperAdmin) return;
    setLoading(true);
    setError("");
    try {
      setPrograms(await listProgramsWithCounts());
    } catch (loadError: any) {
      console.error("[programs] load failed", loadError);
      setError(loadError?.message || "Programs are unavailable.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [isSuperAdmin]);

  const beginAdd = () => {
    setEditing(null);
    setDraft(emptyDraft);
    setObserverEmailsText("");
    setMessage("");
    setError("");
    setShowForm(true);
  };

  const beginEdit = (program: ProgramWithCounts) => {
    setEditing(program);
    setDraft({
      name: program.name || "",
      programCode: program.programCode || "",
      programType: program.programType || "STATE",
      state: program.state || "",
      sponsorName: program.sponsorName || "",
      description: program.description || "",
      status: program.status || "active",
      allowL1: program.allowL1 !== false,
      allowL2: program.allowL2 !== false,
      startDate: program.startDate || "",
      endDate: program.endDate || "",
      sponsorObserverEmails: program.sponsorObserverEmails || [],
      sponsorObserverUids: program.sponsorObserverUids || [],
    });
    setObserverEmailsText(joinList(program.sponsorObserverEmails));
    setMessage("");
    setError("");
    setShowForm(true);
  };

  const updateDraft = (key: keyof ProgramInput, value: any) => {
    setDraft(current => ({ ...current, [key]: value }));
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isSuperAdmin) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const payload = {
        ...draft,
        sponsorObserverEmails: splitList(observerEmailsText),
      };
      if (editing) {
        await updateProgram(editing.id, payload, actorUid);
        setMessage(`Updated program ${payload.programCode.trim().toUpperCase()}.`);
      } else {
        await createProgram(payload, actorUid);
        setMessage(`Created program ${payload.programCode.trim().toUpperCase()}.`);
      }
      setShowForm(false);
      setEditing(null);
      setDraft(emptyDraft);
      setObserverEmailsText("");
      await load();
    } catch (saveError: any) {
      setError(saveError?.message || "Unable to save program.");
    } finally {
      setSaving(false);
    }
  };

  const setProgramStatus = async (program: ProgramWithCounts, status: "archived" | "active") => {
    if (!isSuperAdmin) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      if (status === "archived") await archiveProgram(program.id, actorUid);
      else await reactivateProgram(program.id, actorUid);
      setMessage(`${status === "archived" ? "Archived" : "Reactivated"} ${program.programCode}.`);
      await load();
    } catch (statusError: any) {
      setError(statusError?.message || "Unable to update program status.");
    } finally {
      setSaving(false);
    }
  };

  const addObserver = async () => {
    if (!editing) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const assignment = await addProgramObserver(editing, observerEmail, actorUid);
      setMessage(assignment.status === "linked"
        ? `Linked ${assignment.email} to ${editing.programCode}.`
        : `Added pending observer email ${assignment.email}. Create the Sponsor Observer login from Sponsor Observer Management if needed.`);
      setObserverEmail("");
      await load();
      const refreshed = await listProgramsWithCounts();
      const refreshedProgram = refreshed.find(program => program.id === editing.id) || null;
      setEditing(refreshedProgram);
      if (refreshedProgram) {
        setObserverEmailsText(joinList(refreshedProgram.sponsorObserverEmails));
        setDraft(current => ({
          ...current,
          sponsorObserverEmails: refreshedProgram.sponsorObserverEmails || [],
          sponsorObserverUids: refreshedProgram.sponsorObserverUids || [],
        }));
      }
    } catch (assignmentError: any) {
      setError(assignmentError?.message || "Unable to add observer.");
    } finally {
      setSaving(false);
    }
  };

  const removeObserver = async (email: string, uid?: string) => {
    if (!editing) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await removeProgramObserver(editing, email, uid, actorUid);
      setMessage(`Removed ${email} from ${editing.programCode}.`);
      await load();
      const refreshed = await listProgramsWithCounts();
      const refreshedProgram = refreshed.find(program => program.id === editing.id) || null;
      setEditing(refreshedProgram);
      if (refreshedProgram) {
        setObserverEmailsText(joinList(refreshedProgram.sponsorObserverEmails));
        setDraft(current => ({
          ...current,
          sponsorObserverEmails: refreshedProgram.sponsorObserverEmails || [],
          sponsorObserverUids: refreshedProgram.sponsorObserverUids || [],
        }));
      }
    } catch (assignmentError: any) {
      setError(assignmentError?.message || "Unable to remove observer.");
    } finally {
      setSaving(false);
    }
  };

  const sortedPrograms = useMemo(
    () => programs.slice().sort((a, b) => a.programCode.localeCompare(b.programCode)),
    [programs]
  );

  if (!isSuperAdmin) {
    return (
      <section className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-900">
        <h1 className="text-xl font-bold">Programs</h1>
        <p className="mt-2 text-sm">SuperAdmin access is required.</p>
      </section>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      <section className="rounded-lg border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-blue-700">SuperAdmin</p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">Programs</h1>
            <p className="mt-2 text-sm text-gray-600">Create and manage commercial, state, sponsor, partner, and internal program records.</p>
          </div>
          <button type="button" onClick={beginAdd} className="rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">
            Add Program
          </button>
        </div>
      </section>

      {message ? <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div> : null}
      {error ? <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}

      {showForm && (
        <section className="rounded-lg border bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900">{editing ? "Edit Program" : "Add Program"}</h2>
              <p className="mt-1 text-sm text-gray-600">Program assignment is separate from organization tier.</p>
            </div>
            <button type="button" onClick={() => setShowForm(false)} className="rounded border px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Close</button>
          </div>
          <form onSubmit={save} className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-gray-700">Program Name<input required value={draft.name} onChange={event => updateDraft("name", event.target.value)} className="mt-1 w-full rounded border px-3 py-2" /></label>
            <label className="text-sm font-medium text-gray-700">Program Code<input required value={draft.programCode} onChange={event => updateDraft("programCode", event.target.value)} className="mt-1 w-full rounded border px-3 py-2 uppercase" /></label>
            <label className="text-sm font-medium text-gray-700">Program Type<select required value={draft.programType} onChange={event => updateDraft("programType", event.target.value as ProgramType)} className="mt-1 w-full rounded border px-3 py-2"><option value="STATE">STATE</option><option value="SPONSOR">SPONSOR</option><option value="PARTNER">PARTNER</option><option value="INTERNAL">INTERNAL</option><option value="COMMERCIAL">COMMERCIAL</option></select></label>
            <label className="text-sm font-medium text-gray-700">Status<select required value={draft.status} onChange={event => updateDraft("status", event.target.value as ProgramStatus)} className="mt-1 w-full rounded border px-3 py-2"><option value="active">active</option><option value="inactive">inactive</option><option value="archived">archived</option></select></label>
            <label className="text-sm font-medium text-gray-700">State<input value={draft.state || ""} onChange={event => updateDraft("state", event.target.value)} className="mt-1 w-full rounded border px-3 py-2" placeholder="CT" /></label>
            <label className="text-sm font-medium text-gray-700">Sponsor Organization<input value={draft.sponsorName || ""} onChange={event => updateDraft("sponsorName", event.target.value)} className="mt-1 w-full rounded border px-3 py-2" placeholder="CCAT / DECD" /></label>
            <label className="text-sm font-medium text-gray-700">Start Date<input type="date" value={draft.startDate || ""} onChange={event => updateDraft("startDate", event.target.value)} className="mt-1 w-full rounded border px-3 py-2" /></label>
            <label className="text-sm font-medium text-gray-700">End Date<input type="date" value={draft.endDate || ""} onChange={event => updateDraft("endDate", event.target.value)} className="mt-1 w-full rounded border px-3 py-2" /></label>
            <label className="flex items-center gap-2 rounded border bg-gray-50 p-3 text-sm font-medium text-gray-700"><input type="checkbox" checked={draft.allowL1} onChange={event => updateDraft("allowL1", event.target.checked)} /> Allow L1</label>
            <label className="flex items-center gap-2 rounded border bg-gray-50 p-3 text-sm font-medium text-gray-700"><input type="checkbox" checked={draft.allowL2} onChange={event => updateDraft("allowL2", event.target.checked)} /> Allow L2</label>
            <label className="md:col-span-2 text-sm font-medium text-gray-700">Sponsor Observer Emails<textarea value={observerEmailsText} onChange={event => setObserverEmailsText(event.target.value)} className="mt-1 w-full rounded border px-3 py-2" rows={3} placeholder="one@example.com&#10;two@example.com" /></label>
            <label className="md:col-span-2 text-sm font-medium text-gray-700">Description<textarea value={draft.description || ""} onChange={event => updateDraft("description", event.target.value)} className="mt-1 w-full rounded border px-3 py-2" rows={4} /></label>
            <div className="md:col-span-2 flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="rounded border px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={saving} className="rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">{saving ? "Saving..." : "Save Program"}</button>
            </div>
          </form>
          {editing && (
            <section className="mt-6 rounded-lg border bg-gray-50 p-4">
              <h3 className="font-semibold text-gray-900">Assigned Program Observers</h3>
              <p className="mt-1 text-xs text-gray-500">Existing users are linked with roles.programObserver and this program scope. New emails remain pending until a Sponsor Observer login is created through the existing Sponsor Observer Management flow.</p>
              <div className="mt-3 flex flex-col gap-2 md:flex-row">
                <input type="email" value={observerEmail} onChange={event => setObserverEmail(event.target.value)} placeholder="observer@example.com" className="flex-1 rounded border px-3 py-2 text-sm" />
                <button type="button" onClick={addObserver} disabled={saving || !observerEmail.trim()} className="rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">Add Observer</button>
              </div>
              <div className="mt-4 overflow-auto rounded border bg-white">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="p-3">Email</th><th className="p-3">UID if available</th><th className="p-3">Status</th><th className="p-3">Actions</th></tr></thead>
                  <tbody>
                    {(editing.sponsorObserverEmails || []).map(email => {
                      const index = (editing.sponsorObserverEmails || []).indexOf(email);
                      const uid = (editing.sponsorObserverUids || [])[index] || "";
                      return (
                        <tr key={email} className="border-t">
                          <td className="p-3">{email}</td>
                          <td className="p-3 font-mono text-xs">{uid || "Pending user link"}</td>
                          <td className="p-3">{uid ? "linked" : "pending"}</td>
                          <td className="p-3"><button type="button" onClick={() => removeObserver(email, uid)} disabled={saving} className="rounded border px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">Remove from Program</button></td>
                        </tr>
                      );
                    })}
                    {(editing.sponsorObserverEmails || []).length === 0 && <tr><td colSpan={4} className="p-4 text-sm text-gray-500">No assigned program observers.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </section>
      )}

      <section className="rounded-lg border bg-white shadow-sm">
        <div className="border-b p-4">
          <h2 className="font-semibold text-gray-900">Programs List</h2>
          <p className="mt-1 text-xs text-gray-500">Programs are first-class enrollment records and do not replace tiers.</p>
        </div>
        {loading ? <p className="p-4 text-sm text-gray-600">Loading programs...</p> : sortedPrograms.length === 0 ? <p className="p-4 text-sm text-gray-600">No programs yet.</p> : (
          <div className="overflow-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr><th className="p-3">Program Name</th><th className="p-3">Program Code</th><th className="p-3">Program Type</th><th className="p-3">State</th><th className="p-3">Sponsor</th><th className="p-3">Participants Count</th><th className="p-3">Observer Count</th><th className="p-3">Status</th><th className="p-3">Updated</th><th className="p-3">Actions</th></tr>
              </thead>
              <tbody>
                {sortedPrograms.map(program => (
                  <tr key={program.id} className="border-t">
                    <td className="p-3 font-semibold text-gray-900">{program.name}</td>
                    <td className="p-3 font-mono text-xs">{program.programCode}</td>
                    <td className="p-3">{program.programType}</td>
                    <td className="p-3">{program.state || "-"}</td>
                    <td className="p-3">{program.sponsorName || "-"}</td>
                    <td className="p-3">{program.participantsCount}</td>
                    <td className="p-3">{program.observerCount}</td>
                    <td className="p-3">{program.status}</td>
                    <td className="p-3">{dateLabel(program.updatedAt || program.createdAt)}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => beginEdit(program)} className="rounded border px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50">Edit</button>
                        {program.status === "archived" ? (
                          <button type="button" disabled={saving} onClick={() => setProgramStatus(program, "active")} className="rounded border px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">Reactivate</button>
                        ) : (
                          <button type="button" disabled={saving} onClick={() => setProgramStatus(program, "archived")} className="rounded border px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">Archive</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
