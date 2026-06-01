import React, { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import type { EvidenceValidationResult } from "../types";
import {
  subscribeEvidenceValidation,
  validateEvidence,
  type EvidenceValidationRequest,
} from "../src/evidenceValidation";

type Props = {
  request: EvidenceValidationRequest;
  canValidate: boolean;
};

const formatDate = (value: any) =>
  typeof value === "string"
    ? new Date(value).toLocaleString()
    : value?.toDate
      ? value.toDate().toLocaleString()
      : "Pending";

const statusLabel: Record<EvidenceValidationResult["validationStatus"], string> = {
  supportive: "Supportive",
  partial: "Partial",
  weak: "Weak",
  not_relevant: "Not Relevant",
  needs_review: "Needs Review",
};

export const EvidenceValidationPanel: React.FC<Props> = ({ request, canValidate }) => {
  const [result, setResult] = useState<EvidenceValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => subscribeEvidenceValidation(request, setResult, subscriptionError => {
    console.warn("[evidence-validation] result load failed", subscriptionError);
  }), [request.assessmentId, request.evidenceId, request.objectiveId, request.orgId, request.practiceId]);

  const runValidation = async () => {
    if (!canValidate) return;
    setIsValidating(true);
    setError("");
    try {
      setResult(await validateEvidence(request));
    } catch (validationError) {
      console.warn("[evidence-validation] validation failed", validationError);
      setError("Validation failed. Please try again.");
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="mt-2 border-t border-gray-200 pt-2 text-xs">
      {canValidate && (
        <button type="button" onClick={runValidation} disabled={isValidating} className="inline-flex items-center px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:bg-indigo-300">
          {isValidating ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <ShieldCheck className="h-3 w-3 mr-1" />}
          {isValidating ? "Validating..." : result ? "Re-run Validation" : "Validate Evidence"}
        </button>
      )}
      {error && <p className="mt-1 text-red-600">{error}</p>}
      {result && (
        <div className="mt-2 space-y-1 text-gray-600">
          <p><strong>Status:</strong> {statusLabel[result.validationStatus]} <strong className="ml-2">Confidence:</strong> {result.confidence}</p>
          <p><strong>Summary:</strong> {result.summary}</p>
          {result.strengths.length > 0 && <p><strong>Strengths:</strong> {result.strengths.join("; ")}</p>}
          {result.gaps.length > 0 && <p><strong>Gaps:</strong> {result.gaps.join("; ")}</p>}
          {result.recommendedActions.length > 0 && <p><strong>Recommended Actions:</strong> {result.recommendedActions.join("; ")}</p>}
          <p><strong>Reviewed At:</strong> {formatDate(result.reviewedAt)}</p>
          <p className="italic text-gray-500">AI validation is advisory only. Human review is required.</p>
        </div>
      )}
    </div>
  );
};
