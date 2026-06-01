import React, { useEffect, useMemo, useState } from "react";
import { FileText, Loader2, X } from "lucide-react";
import type { EvidenceLibraryItem } from "../types";
import { EVIDENCE_LIBRARY_CATEGORIES } from "../src/evidenceLibrary";
import { loadActiveEvidenceLibraryItems } from "../src/evidenceReferences";

type EvidenceLibraryPickerModalProps = {
  isOpen: boolean;
  orgId: string;
  attachedEvidenceIds: Set<string>;
  onClose: () => void;
  onAttach: (item: EvidenceLibraryItem) => Promise<void>;
};

const formatDate = (value: any) => {
  if (!value) return "Pending";
  if (typeof value === "string") return new Date(value).toLocaleDateString();
  if (value?.toDate) return value.toDate().toLocaleDateString();
  return "Unavailable";
};

export const EvidenceLibraryPickerModal: React.FC<EvidenceLibraryPickerModalProps> = ({
  isOpen,
  orgId,
  attachedEvidenceIds,
  onClose,
  onAttach,
}) => {
  const [items, setItems] = useState<EvidenceLibraryItem[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(false);
  const [attachingId, setAttachingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError("");
    loadActiveEvidenceLibraryItems(orgId)
      .then(setItems)
      .catch(loadError => {
        console.error("[evidence-library-picker] load failed", loadError);
        setError("Unable to load Evidence Library.");
      })
      .finally(() => setLoading(false));
  }, [isOpen, orgId]);

  const filteredItems = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return items.filter(item => {
      if (category !== "all" && item.category !== category) return false;
      if (!needle) return true;
      return [item.fileName, item.description, ...(item.tags || [])]
        .some(value => String(value || "").toLowerCase().includes(needle));
    });
  }, [category, items, search]);

  const attach = async (item: EvidenceLibraryItem) => {
    setAttachingId(item.id);
    setError("");
    try {
      await onAttach(item);
    } catch (attachError) {
      console.error("[evidence-library-picker] attach failed", attachError);
      setError("Unable to attach library evidence.");
    } finally {
      setAttachingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-3xl max-h-[85vh] overflow-hidden bg-white rounded-lg shadow-xl border flex flex-col">
        <header className="flex items-center justify-between p-4 border-b">
          <div><h3 className="font-bold text-gray-900">Attach Existing Evidence</h3><p className="text-xs text-gray-500">Choose an active Evidence Library item.</p></div>
          <button type="button" onClick={onClose} title="Close"><X className="h-5 w-5 text-gray-500" /></button>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 border-b">
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search files, descriptions, or tags" className="border rounded p-2 text-sm" />
          <select value={category} onChange={event => setCategory(event.target.value)} className="border rounded p-2 text-sm bg-white">
            <option value="all">All categories</option>
            {EVIDENCE_LIBRARY_CATEGORIES.map(option => <option key={option}>{option}</option>)}
          </select>
        </div>
        <div className="overflow-y-auto p-4 space-y-2">
          {loading && <p className="text-sm text-gray-500">Loading Evidence Library...</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {!loading && filteredItems.map(item => {
            const attached = attachedEvidenceIds.has(item.id);
            return (
              <div key={item.id} className="flex items-start gap-3 border rounded p-3">
                <FileText className="h-5 w-5 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-800 break-all">{item.fileName}</p>
                  <p className="text-xs text-gray-500">{item.category || "Other"} | Uploaded {formatDate(item.uploadedAt)}</p>
                  {item.description && <p className="text-xs text-gray-600 mt-1">{item.description}</p>}
                  {(item.tags || []).length > 0 && <p className="text-xs text-gray-500 mt-1">Tags: {item.tags?.join(", ")}</p>}
                </div>
                <button type="button" onClick={() => attach(item)} disabled={attached || attachingId === item.id} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50">
                  {attachingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : attached ? "Attached" : "Attach"}
                </button>
              </div>
            );
          })}
          {!loading && filteredItems.length === 0 && <p className="text-sm text-gray-500">No active library evidence matches the current filters.</p>}
        </div>
      </div>
    </div>
  );
};
