import { doc, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { auth, db } from "./firebase";
import { toFirestoreDocId } from "./assessmentFirestore";
import type { PracticeCopilotResult } from "../types";

export type PracticeCopilotRequest = {
  orgId: string;
  assessmentId: string;
  assessmentLevel?: number;
  practiceId: string;
  practiceTitle?: string;
  domain?: string;
  currentStatus?: string;
};

export class PracticeCopilotError extends Error {
  constructor(
    public readonly errorCode: string,
    message: string,
  ) {
    super(message);
    this.name = "PracticeCopilotError";
  }
}

const copilotDoc = (input: Pick<PracticeCopilotRequest, "orgId" | "assessmentId" | "practiceId">) =>
  doc(db, "orgs", input.orgId, "assessments", input.assessmentId, "practiceRecords", toFirestoreDocId(input.practiceId), "copilot", "latest");

function getApiBaseUrl() {
  return String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
}

export async function generatePracticeCopilot(input: PracticeCopilotRequest): Promise<PracticeCopilotResult> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Not authenticated");

  const response = await fetch(`${getApiBaseUrl()}/api/practice/copilot`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new PracticeCopilotError(
      data?.errorCode || "COPILOT_REQUEST_FAILED",
      data?.errorMessage || data?.error || "Practice Copilot request failed",
    );
  }
  return data as PracticeCopilotResult;
}

export function subscribePracticeCopilot(
  input: Pick<PracticeCopilotRequest, "orgId" | "assessmentId" | "practiceId">,
  onResult: (result: PracticeCopilotResult | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(copilotDoc(input), snapshot => {
    onResult(snapshot.exists()
      ? ({ id: snapshot.id, ...(snapshot.data() as Omit<PracticeCopilotResult, "id">) })
      : null);
  }, onError);
}
