import React, { useEffect, useState } from "react";
import { Download, ExternalLink, FileText, Link2, Loader2, Unlink } from "lucide-react";
import type { AttachedLibraryEvidence, EvidenceLibraryItem } from "../types";
import { EvidenceLibraryPickerModal } from "./EvidenceLibraryPickerModal";
import { attachEvidenceLibraryItem, detachEvidenceLibraryItem, subscribeAttachedLibraryEvidence } from "../src/evidenceReferences";
import { EvidenceValidationPanel } from "./EvidenceValidationPanel";

type PracticeLibraryEvidenceProps = {
  practiceId: string;
  practiceTitle: string;
  context: {
    orgId: string;
    assessmentId: string;
    uid: string;
    canManage: boolean;
  };
};

const downloadEvidence = async (item: EvidenceLibraryItem) => {
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
    console.warn("[evidence-library] practice evidence download failed; opening file", error);
    window.open(item.downloadURL, "_blank", "noopener,noreferrer");
  }
};

const formatDate = (value: any) =>
  typeof value === "string" ? new Date(value).toLocaleDateString() : value?.toDate ? value.toDate().toLocaleDateString() : "Pending";

export const PracticeLibraryEvidence: React.FC<PracticeLibraryEvidenceProps> = ({ practiceId, practiceTitle, context }) => {
  const [items, setItems] = useState<AttachedLibraryEvidence[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [detachingId, setDetachingId] = useState<string | null>(null);
  const target = { orgId: context.orgId, assessmentId: context.assessmentId, practiceId };

  useEffect(() => subscribeAttachedLibraryEvidence(target, setItems, error => {
    console.warn("[evidence-library] practice evidence load failed", error);
  }), [context.assessmentId, context.orgId, practiceId]);

  const attach = async (item: EvidenceLibraryItem) => {
    if (!context.canManage) return;
    await attachEvidenceLibraryItem(target, item.id, context.uid);
  };

  const detach = async (reference: AttachedLibraryEvidence) => {
    if (!context.canManage) return;
    if (!window.confirm("Detach this evidence from this practice/objective? The original library file will remain available.")) return;
    setDetachingId(reference.evidenceId);
    try {
      await detachEvidenceLibraryItem(target, reference.evidenceId, context.uid);
    } finally {
      setDetachingId(null);
    }
  };

  return (
    <div className="mb-5 p-3 bg-blue-50 border border-blue-100 rounded-lg space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-gray-700">Practice Library Evidence</h4>
        {context.canManage && <button type="button" onClick={() => setPickerOpen(true)} className="flex items-center text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"><Link2 className="h-3 w-3 mr-1" /> Attach Existing Evidence</button>}
      </div>
      {items.length === 0 ? <p className="text-xs text-gray-500">No library evidence attached to this practice.</p> : items.map(reference => {
        const item = reference.libraryItem;
        return <div key={reference.evidenceId} className="flex items-start gap-2 bg-white border border-blue-100 rounded p-2">
          <FileText className="h-5 w-5 text-blue-400" />
          <div className="flex-1 min-w-0"><p className="text-sm font-medium break-all">{item?.fileName || reference.evidenceId}</p><p className="text-xs text-blue-700 font-semibold">Library Evidence</p><p className="text-xs text-gray-500">{item?.category || "Other"}{item?.tags?.length ? ` | ${item.tags.join(", ")}` : ""}</p>{item?.description && <p className="text-xs text-gray-600">{item.description}</p>}<p className="text-xs text-gray-500">Attached: {formatDate(reference.attachedAt)}</p>{item?.status === "archived" && <p className="text-xs font-semibold text-amber-700">Archived in Library</p>}<EvidenceValidationPanel canValidate={context.canManage} request={{ orgId: context.orgId, assessmentId: context.assessmentId, practiceId, evidenceId: reference.evidenceId, evidenceSource: "evidenceLibrary", practiceTitle, fileName: item?.fileName || reference.evidenceId, category: item?.category, description: item?.description, tags: item?.tags, ocrSummary: item?.ocrSummary }} /></div>
          <button type="button" disabled={!item?.downloadURL} onClick={() => item?.downloadURL && window.open(item.downloadURL, "_blank", "noopener,noreferrer")} className="p-1 text-blue-700 disabled:text-gray-300" title="View library evidence"><ExternalLink className="h-4 w-4" /></button>
          <button type="button" disabled={!item?.downloadURL} onClick={() => item && downloadEvidence(item)} className="p-1 text-blue-700 disabled:text-gray-300" title="Download library evidence"><Download className="h-4 w-4" /></button>
          {context.canManage && <button type="button" disabled={detachingId === reference.evidenceId} onClick={() => detach(reference)} className="p-1 text-gray-600 disabled:text-gray-300" title="Detach library evidence">{detachingId === reference.evidenceId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}</button>}
        </div>;
      })}
      <EvidenceLibraryPickerModal isOpen={pickerOpen} orgId={context.orgId} attachedEvidenceIds={new Set(items.map(item => item.evidenceId))} onClose={() => setPickerOpen(false)} onAttach={attach} />
    </div>
  );
};
