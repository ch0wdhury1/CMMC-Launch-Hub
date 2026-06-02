import React, { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { loadOrgUsers, removeUserFromOrg, repairOrgMemberIdentities, repairUserAccessRecord, updateOrgMember, type ManagedOrgUser } from "../src/orgUsers";

type Props = {
  orgId: string;
  orgName: string;
  isSuperAdmin: boolean;
  onClose?: () => void;
  showTechnicalNotice?: boolean;
};

const formatDate = (value: any) => {
  if (!value) return "-";
  const date = value?.toDate ? value.toDate() : value?._seconds ? new Date(value._seconds * 1000) : new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString();
};

export const OrganizationUsers: React.FC<Props> = ({orgId, orgName, isSuperAdmin, onClose, showTechnicalNotice = true}) => {
  const [users, setUsers] = useState<ManagedOrgUser[]>([]);
  const [drafts, setDrafts] = useState<Record<string, {role: string; status: string}>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [canManageOrgOwner, setCanManageOrgOwner] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setMessage("");
    try {
      const result = await loadOrgUsers(orgId);
      setUsers(result.users);
      setCanManageOrgOwner(result.canManageOrgOwner);
      setDrafts(Object.fromEntries(result.users.map(user => [user.uid, {
        role: user.membership.role || "viewer",
        status: user.membership.status || "inactive",
      }])));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load organization users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, [orgId]);

  const save = async (user: ManagedOrgUser) => {
    const draft = drafts[user.uid];
    if (!draft || !window.confirm("Save this organization user status and role?")) return;
    setBusy(`save:${user.uid}`);
    setMessage("");
    try {
      await updateOrgMember(orgId, user.uid, draft.role, draft.status);
      await refresh();
      setMessage("Organization user updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update organization user.");
    } finally {
      setBusy("");
    }
  };

  const remove = async (user: ManagedOrgUser) => {
    if (!window.confirm("Remove this user from this organization? This will not delete the user's login account.")) return;
    const allowLastOwnerRemoval = user.membership.role === "orgOwner"
      && isSuperAdmin
      && window.confirm("This may remove the last orgOwner. Continue only if this organization is inactive or archived.");
    setBusy(`remove:${user.uid}`);
    setMessage("");
    try {
      await removeUserFromOrg(orgId, user.uid, allowLastOwnerRemoval);
      await refresh();
      setMessage("User removed from organization. The login account was not deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to remove organization user.");
    } finally {
      setBusy("");
    }
  };

  const repairIdentities = async () => {
    if (!window.confirm("Repair missing member identity fields for this organization? Existing role and access values will be preserved unless missing.")) return;
    setBusy("repair-identities");
    setMessage("");
    try {
      const repairedCount = await repairOrgMemberIdentities(orgId);
      await refresh();
      setMessage(`Repaired ${repairedCount} member record${repairedCount === 1 ? "" : "s"}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to repair member identity fields.");
    } finally {
      setBusy("");
    }
  };

  const repairAccessRecord = async (user: ManagedOrgUser) => {
    if (!window.confirm("Repair this user's access record for the selected organization? This will preserve any SuperAdmin permission.")) return;
    setBusy(`repair-access:${user.uid}`);
    setMessage("");
    try {
      await repairUserAccessRecord(orgId, user.uid);
      await refresh();
      setMessage("User access record repaired.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to repair user access record.");
    } finally {
      setBusy("");
    }
  };

  return (
    <section className="rounded-lg border bg-white shadow-sm">
      <div className="flex items-center justify-between border-b p-4">
        <div><h3 className="font-bold text-gray-900">Users for {orgName}</h3>{showTechnicalNotice && <p className="text-xs text-gray-500">Membership changes do not delete Firebase Auth accounts.</p>}</div>
        <div className="flex items-center gap-2">
          {isSuperAdmin && <button type="button" onClick={repairIdentities} disabled={busy === "repair-identities"} className="rounded border border-blue-200 px-2 py-1 text-xs font-semibold text-blue-700 disabled:opacity-40">Repair Member Identity Fields</button>}
          {onClose && <button type="button" onClick={onClose} title="Close users" className="p-1 text-gray-500 hover:text-gray-900"><X className="h-5 w-5" /></button>}
        </div>
      </div>
      {message && <p className="px-4 pt-3 text-sm text-gray-700">{message}</p>}
      {loading ? <div className="flex items-center p-4 text-sm text-gray-600"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading organization users...</div> : (
        <div className="overflow-x-auto p-4">
          <table className="w-full text-left text-sm">
            <thead className="border-b text-xs uppercase text-gray-500"><tr><th className="py-2 pr-3">User Name</th><th className="pr-3">User Email</th><th className="pr-3">Date Joined</th><th className="pr-3">Status</th><th className="pr-3">Role</th><th className="pr-3">Save</th><th className="pr-3">Repair Access</th><th>Remove from Org</th></tr></thead>
            <tbody>{users.map(user => {
              const protectedUser = user.isSuperAdmin || (!canManageOrgOwner && user.membership.role === "orgOwner");
              return <tr key={user.uid} className="border-b">
                <td className="py-3 pr-3">{user.fullName || user.displayName || user.uid}</td>
                <td className="pr-3">{user.email || "-"}</td>
                <td className="pr-3">{formatDate(user.membership.joinedAt || user.membership.createdAt)}</td>
                <td className="pr-3"><select value={drafts[user.uid]?.status || "inactive"} onChange={event => setDrafts(current => ({...current, [user.uid]: {...current[user.uid], status: event.target.value}}))} disabled={protectedUser} className="rounded border px-2 py-1 text-xs"><option>active</option><option>inactive</option><option>disabled</option></select></td>
                <td className="pr-3"><select value={drafts[user.uid]?.role || "viewer"} onChange={event => setDrafts(current => ({...current, [user.uid]: {...current[user.uid], role: event.target.value}}))} disabled={protectedUser} className="rounded border px-2 py-1 text-xs">{isSuperAdmin && <option>orgOwner</option>}<option>orgAdmin</option><option>contributor</option><option>viewer</option><option>assessor</option></select></td>
                <td className="pr-3"><button type="button" onClick={() => save(user)} disabled={protectedUser || busy === `save:${user.uid}`} className="rounded bg-blue-600 px-2 py-1 text-xs text-white disabled:opacity-40">Save</button></td>
                <td className="pr-3">{isSuperAdmin ? <button type="button" onClick={() => repairAccessRecord(user)} disabled={busy === `repair-access:${user.uid}`} className="rounded border border-blue-200 px-2 py-1 text-xs font-semibold text-blue-700 disabled:opacity-40">Repair User Access Record</button> : "-"}</td>
                <td><button type="button" onClick={() => remove(user)} disabled={protectedUser || busy === `remove:${user.uid}`} className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 disabled:opacity-40">Remove</button></td>
              </tr>;
            })}</tbody>
          </table>
          {users.length === 0 && <p className="py-5 text-center text-sm text-gray-500">No organization members found.</p>}
        </div>
      )}
    </section>
  );
};
