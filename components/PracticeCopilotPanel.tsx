import React, { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import type { PracticeCopilotResult } from "../types";
import {
  generatePracticeCopilot,
  PracticeCopilotError,
  subscribePracticeCopilot,
  type PracticeCopilotRequest,
} from "../src/practiceCopilot";

type Props = {
  request: PracticeCopilotRequest;
  canGenerate: boolean;
};

const formatDate = (value: any) =>
  typeof value === "string"
    ? new Date(value).toLocaleString()
    : value?.toDate
      ? value.toDate().toLocaleString()
      : "Pending";

const List = ({ items }: { items: string[] }) => (
  items.length > 0
    ? <ul className="list-disc pl-5 space-y-1">{items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>
    : <p className="text-gray-500">No items returned.</p>
);

export const PracticeCopilotPanel: React.FC<Props> = ({ request, canGenerate }) => {
  const [result, setResult] = useState<PracticeCopilotResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<{ errorCode: string; errorMessage: string } | null>(null);

  useEffect(() => subscribePracticeCopilot(request, setResult, subscriptionError => {
    console.warn("[practice-copilot] guidance load failed", subscriptionError);
  }), [request.assessmentId, request.orgId, request.practiceId]);

  const generate = async () => {
    if (!canGenerate) return;
    setIsGenerating(true);
    setError(null);
    try {
      setResult(await generatePracticeCopilot(request));
    } catch (generationError) {
      console.warn("[practice-copilot] guidance generation failed", generationError);
      setError(generationError instanceof PracticeCopilotError
        ? {
            errorCode: generationError.errorCode,
            errorMessage: generationError.message,
          }
        : {
            errorCode: "COPILOT_REQUEST_FAILED",
            errorMessage: "Unable to generate guidance.",
          });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <section className="mb-6 bg-indigo-50 p-4 rounded-lg border border-indigo-100">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-gray-800">Practice Copilot</h3>
          {result && <p className="text-xs text-gray-500 mt-1">Generated {formatDate(result.generatedAt)}</p>}
        </div>
        {canGenerate && (
          <button type="button" onClick={generate} disabled={isGenerating} className="inline-flex items-center px-3 py-2 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 disabled:bg-indigo-300">
            {isGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {isGenerating ? "Generating guidance..." : result ? "Re-run Guidance" : "Generate Guidance"}
          </button>
        )}
      </div>
      {error && (
        <div className="mt-3 text-sm text-red-600">
          <p><strong>Error Code:</strong> {error.errorCode}</p>
          <p><strong>Error Message:</strong> {error.errorMessage}</p>
        </div>
      )}
      {result && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
          <div><h4 className="font-semibold text-gray-800">Explanation</h4><p>{result.explanation}</p></div>
          <div><h4 className="font-semibold text-gray-800">Why It Matters</h4><p>{result.whyItMatters}</p></div>
          <div><h4 className="font-semibold text-gray-800">Expected Evidence</h4><List items={result.expectedEvidence} /></div>
          <div><h4 className="font-semibold text-gray-800">Common Gaps</h4><List items={result.commonGaps} /></div>
          <div><h4 className="font-semibold text-gray-800">Suggested Actions</h4><List items={result.suggestedActions} /></div>
          <div><h4 className="font-semibold text-gray-800">Caution</h4><p>{result.caution}</p></div>
        </div>
      )}
      <p className="mt-4 text-xs italic text-gray-500">AI guidance is advisory only. Human review is required.</p>
    </section>
  );
};
