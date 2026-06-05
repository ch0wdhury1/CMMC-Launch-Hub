import React, { useEffect, useMemo, useState } from "react";
import { Inbox, RefreshCcw } from "lucide-react";
import {
  formatPilotFeedbackDate,
  loadPilotFeedback,
  PILOT_FEEDBACK_STATUSES,
  updatePilotFeedbackStatus,
  type PilotFeedbackEntry,
  type PilotFeedbackStatus,
} from "../src/pilotFeedback";

type Props = {
  isSuperAdmin: boolean;
};

const statusLabel = (status: string) => {
  if (status === "reviewed") return "Reviewed";
  if (status === "closed") return "Closed";
  return "New";
};

export const SuperAdminFeedbackReview: React.FC<Props> = ({ isSuperAdmin }) => {
  const [items, setItems] = useState<PilotFeedbackEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<PilotFeedbackStatus | "all">("all");

  const load = async () => {
    if (!isSuperAdmin) return;
    setLoading(true);
    setError("");
    try {
      setItems(await loadPilotFeedback());
    } catch (loadError) {
      console.error("[pilot-feedback] review load failed", loadError);
      setError("Feedback queue is unavailable. Confirm SuperAdmin Firestore access for pilotFeedback.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [isSuperAdmin]);

  const visibleItems = useMemo(
    () => filter === "all" ? items : items.filter(item => item.status === filter),
    [filter, items]
  );

  const updateStatus = async (id: string, status: PilotFeedbackStatus) => {
    await updatePilotFeedbackStatus(id, status);
    setItems(current => current.map(item => item.id === id ? { ...item, status } : item));
  };

  if (!isSuperAdmin) {
    return (
      <section className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-900">
        <h1 className="text-xl font-bold">Feedback Review</h1>
        <p className="mt-2 text-sm">SuperAdmin access is required.</p>
      </section>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      <section className="rounded-lg border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-blue-700">SuperAdmin only</p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">SuperAdmin Feedback Review</h1>
            <p className="mt-2 text-sm text-gray-600">Review controlled pilot feedback and move items through New, Reviewed, and Closed states.</p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </section>

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">Status</span>
          {(["all", ...PILOT_FEEDBACK_STATUSES] as Array<PilotFeedbackStatus | "all">).map(status => (
            <button
              key={status}
              type="button"
              onClick={() => setFilter(status)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${filter === status ? "bg-blue-700 text-white" : "border bg-white text-gray-700 hover:bg-gray-50"}`}
            >
              {status === "all" ? "All" : statusLabel(status)}
            </button>
          ))}
        </div>
      </section>

      {error && <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}</div>}
      {loading && <div className="rounded-lg border bg-white p-5 text-sm text-gray-600">Loading feedback queue...</div>}

      {!loading && visibleItems.length === 0 && (
        <section className="rounded-lg border bg-white p-8 text-center shadow-sm">
          <Inbox className="mx-auto h-8 w-8 text-gray-400" />
          <h2 className="mt-3 text-lg font-bold text-gray-900">No feedback in this view</h2>
          <p className="mt-1 text-sm text-gray-600">New pilot feedback will appear here after participants submit it.</p>
        </section>
      )}

      <div className="space-y-3">
        {visibleItems.map(item => (
          <article key={item.id} className="rounded-lg border bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">{item.category}</span>
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">{statusLabel(item.status)}</span>
                  <span className="text-xs text-gray-500">{formatPilotFeedbackDate(item.createdAt)}</span>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm text-gray-800">{item.message}</p>
                <div className="mt-3 grid gap-1 text-xs text-gray-500 md:grid-cols-2">
                  <span>Organization: {item.orgName || item.orgId || "Not provided"}</span>
                  <span>User: {item.userEmail || item.userName || item.uid || "Not provided"}</span>
                  <span>Role: {item.role || "Not provided"}</span>
                  <span>Page: {item.page || "Not provided"}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 md:justify-end">
                {PILOT_FEEDBACK_STATUSES.map(status => (
                  <button
                    key={status}
                    type="button"
                    disabled={item.status === status}
                    onClick={() => void updateStatus(item.id, status)}
                    className="rounded-md border px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                  >
                    {statusLabel(status)}
                  </button>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};
