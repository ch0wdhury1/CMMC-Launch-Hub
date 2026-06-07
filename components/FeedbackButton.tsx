import React, { useEffect, useState } from "react";
import { MessageSquare, X } from "lucide-react";
import {
  PILOT_FEEDBACK_CATEGORIES,
  submitPilotFeedback,
  type PilotFeedbackCategory,
} from "../src/pilotFeedback";

type Props = {
  orgId?: string | null;
  orgName?: string | null;
  uid?: string | null;
  userEmail?: string | null;
  userName?: string | null;
  role?: string | null;
  pageLabel?: string | null;
  triggerToken?: number;
};

export const FeedbackButton: React.FC<Props> = ({
  orgId,
  orgName,
  uid,
  userEmail,
  userName,
  role,
  pageLabel,
  triggerToken,
}) => {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<PilotFeedbackCategory>("Bug");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setCategory("Bug");
    setMessage("");
    setStatus("");
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setStatus("");
    try {
      await submitPilotFeedback({
        orgId,
        orgName,
        uid,
        userEmail,
        userName,
        role,
        category,
        message,
        page: pageLabel,
      });
      setMessage("");
      setStatus("Feedback sent. Thank you for helping improve the pilot.");
    } catch (error) {
      console.error("[pilot-feedback] submit failed", error);
      setStatus("Feedback could not be sent. Please contact pilot support if this continues.");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (triggerToken && triggerToken > 0) setOpen(true);
  }, [triggerToken]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-16 right-6 z-[60] inline-flex items-center gap-2 rounded-full bg-blue-700 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        <MessageSquare className="h-4 w-4" />
        Send Feedback
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <section className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="feedback-title">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 id="feedback-title" className="text-xl font-bold text-gray-900">Send Feedback</h2>
                <p className="mt-1 text-sm text-gray-600">Share pilot bugs, questions, and improvement requests.</p>
              </div>
              <button
                type="button"
                onClick={close}
                className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                aria-label="Close feedback"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submit} className="mt-5 space-y-4">
              <label className="block text-sm font-semibold text-gray-800">
                Category
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value as PilotFeedbackCategory)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  {PILOT_FEEDBACK_CATEGORIES.map(item => <option key={item}>{item}</option>)}
                </select>
              </label>

              <label className="block text-sm font-semibold text-gray-800">
                Feedback
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  required
                  rows={5}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Tell us what happened, what you expected, or what would help."
                />
              </label>

              {pageLabel && <p className="text-xs text-gray-500">Context: {pageLabel}</p>}
              {status && <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800">{status}</p>}

              <div className="flex justify-end gap-3">
                <button type="button" onClick={close} className="rounded-md border px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
                <button
                  type="submit"
                  disabled={submitting || !message.trim()}
                  className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-gray-400"
                >
                  {submitting ? "Sending..." : "Submit Feedback"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
};
