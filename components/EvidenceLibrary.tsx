import React, { useEffect, useMemo, useState } from "react";
import { Archive, Download, ExternalLink, FileText, Loader2, RotateCcw, Upload } from "lucide-react";
import type { EvidenceLibraryItem } from "../types";
import {
  EVIDENCE_LIBRARY_CATEGORIES,
  setEvidenceLibraryItemStatus,
  subscribeEvidenceLibraryItems,
  uploadEvidenceLibraryItem,
} from "../src/evidenceLibrary";

type EvidenceLibraryProps = {
  orgId: string | null;
  uid: string | null;
  role?: string;
  isSuperAdmin: boolean;
};

const formatDate = (value: any) => {
  if (!value) return "Pending";
  if (typeof value === "string") return new Date(value).toLocaleDateString();
  if (value?.toDate) return value.toDate().toLocaleDateString();
  return "Unavailable";
};

const downloadItem = async (item: EvidenceLibraryItem) => {
  if (!item.downloadURL) return;
  try {
    const response = await fetch(item.downloadURL);
    if (!response.ok) throw new Error(`Download failed with status ${response.status}`);
    const blobUrl = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = item.fileName || "evidence-file";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
  } catch (error) {
    console.warn("[evidence-library] blob download failed; opening file", error);
    window.open(item.downloadURL, "_blank", "noopener,noreferrer");
  }
};

export const EvidenceLibrary: React.FC<EvidenceLibraryProps> = ({ orgId, uid, role, isSuperAdmin }) => {
  const [items, setItems] = useState<EvidenceLibraryItem[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState("Other");
  const [description, setDescription] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"active" | "archived" | "all">("active");
  const [message, setMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);

  const canManage = Boolean(uid && (isSuperAdmin || ["orgOwner", "orgAdmin", "assessor", "contributor"].includes(role || "")));

  useEffect(() => {
    if (!orgId) {
      setItems([]);
      return;
    }
    return subscribeEvidenceLibraryItems(orgId, setItems, error => {
      console.error("[evidence-library] load failed", error);
      setMessage("Unable to load evidence library.");
    });
  }, [orgId]);

  const filteredItems = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return items.filter(item => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
      if (!needle) return true;
      return [item.fileName, item.description, ...(item.tags || [])]
        .some(value => String(value || "").toLowerCase().includes(needle));
    });
  }, [categoryFilter, items, search, statusFilter]);

  const handleUpload = async () => {
    if (!orgId || !uid || !file || !canManage) return;
    setIsUploading(true);
    setMessage("");
    try {
      await uploadEvidenceLibraryItem({
        orgId,
        evidenceId: crypto.randomUUID(),
        file,
        category,
        description: description.trim(),
        tags: tagsText.split(",").map(tag => tag.trim()).filter(Boolean),
        uploadedBy: uid,
      });
      setFile(null);
      setDescription("");
      setTagsText("");
      setMessage("Evidence uploaded.");
    } catch (error) {
      console.error("[evidence-library] upload failed", error);
      setMessage("Unable to upload evidence.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleStatusChange = async (item: EvidenceLibraryItem) => {
    if (!orgId || !uid || !canManage) return;
    const nextStatus = item.status === "archived" ? "active" : "archived";
    if (nextStatus === "archived" && !window.confirm("Archive this evidence library item? The file will not be deleted.")) return;
    setPendingStatusId(item.id);
    try {
      await setEvidenceLibraryItemStatus(orgId, item.id, nextStatus, uid);
    } catch (error) {
      console.error("[evidence-library] status update failed", error);
      setMessage("Unable to update evidence status.");
    } finally {
      setPendingStatusId(null);
    }
  };

  if (!orgId) return <div className="p-6 bg-white border rounded">Current organization is unavailable.</div>;

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="bg-white border rounded-lg p-4 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900">Evidence Library</h2>
        <p className="text-sm text-gray-500 mt-1">Organization-level reusable documentation repository.</p>
      </div>

      {canManage ? (
        <div className="bg-white border rounded-lg p-4 shadow-sm space-y-3">
          <h3 className="font-semibold text-gray-800">Upload Evidence</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input type="file" onChange={event => setFile(event.target.files?.[0] || null)} disabled={isUploading} className="w-full border rounded p-2 text-sm" />
            <select value={category} onChange={event => setCategory(event.target.value)} disabled={isUploading} className="w-full border rounded p-2 text-sm bg-white">
              {EVIDENCE_LIBRARY_CATEGORIES.map(option => <option key={option}>{option}</option>)}
            </select>
            <input value={description} onChange={event => setDescription(event.target.value)} disabled={isUploading} placeholder="Description" className="w-full border rounded p-2 text-sm" />
            <input value={tagsText} onChange={event => setTagsText(event.target.value)} disabled={isUploading} placeholder="Tags, comma-separated" className="w-full border rounded p-2 text-sm" />
          </div>
          <button type="button" onClick={handleUpload} disabled={!file || isUploading} className="flex items-center px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50">
            {isUploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            {isUploading ? "Uploading..." : "Upload"}
          </button>
          {message && <p className="text-xs text-gray-600">{message}</p>}
        </div>
      ) : (
        <p className="text-xs text-gray-500">Your role has read-only access to the Evidence Library.</p>
      )}

      <div className="bg-white border rounded-lg p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search files, descriptions, or tags" className="border rounded p-2 text-sm" />
          <select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)} className="border rounded p-2 text-sm bg-white">
            <option value="all">All categories</option>
            {EVIDENCE_LIBRARY_CATEGORIES.map(option => <option key={option}>{option}</option>)}
          </select>
          <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as typeof statusFilter)} className="border rounded p-2 text-sm bg-white">
            <option value="active">Active</option><option value="archived">Archived</option><option value="all">All statuses</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase text-gray-500 border-b"><tr><th className="py-2">File</th><th>Category</th><th>Description</th><th>Tags</th><th>Uploaded</th><th>Uploaded By</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {filteredItems.map(item => (
                <tr key={item.id} className={`border-b ${item.status === "archived" ? "text-gray-400 bg-gray-50" : "text-gray-700"}`}>
                  <td className="py-3 pr-3"><span className="flex items-center gap-2"><FileText className="h-4 w-4" />{item.fileName}</span></td>
                  <td className="pr-3">{item.category || "Other"}</td><td className="pr-3">{item.description || "-"}</td><td className="pr-3">{(item.tags || []).join(", ") || "-"}</td>
                  <td className="pr-3">{formatDate(item.uploadedAt)}</td><td className="pr-3 font-mono text-xs">{item.uploadedBy}</td><td className="pr-3 capitalize">{item.status}</td>
                  <td><div className="flex items-center gap-1">
                    <button type="button" disabled={!item.downloadURL} onClick={() => item.downloadURL && window.open(item.downloadURL, "_blank", "noopener,noreferrer")} title="View file" className="p-1 text-blue-700 disabled:text-gray-300"><ExternalLink className="h-4 w-4" /></button>
                    <button type="button" disabled={!item.downloadURL} onClick={() => downloadItem(item)} title="Download file" className="p-1 text-blue-700 disabled:text-gray-300"><Download className="h-4 w-4" /></button>
                    {canManage && (
                      <button type="button" disabled={pendingStatusId === item.id} onClick={() => handleStatusChange(item)} title={item.status === "archived" ? "Unarchive item" : "Archive item"} className="p-1 text-gray-600 disabled:text-gray-300">
                        {pendingStatusId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : item.status === "archived" ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                      </button>
                    )}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredItems.length === 0 && <p className="py-6 text-center text-sm text-gray-500">No evidence library items match the current filters.</p>}
        </div>
      </div>
    </div>
  );
};
