import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "./firebase";

export const PILOT_FEEDBACK_CATEGORIES = ["Bug", "Feature Request", "Question", "Other"] as const;
export const PILOT_FEEDBACK_STATUSES = ["new", "reviewed", "closed"] as const;

export type PilotFeedbackCategory = typeof PILOT_FEEDBACK_CATEGORIES[number];
export type PilotFeedbackStatus = typeof PILOT_FEEDBACK_STATUSES[number];

export type PilotFeedbackEntry = {
  id: string;
  orgId: string;
  orgName?: string;
  uid: string;
  userEmail?: string;
  userName?: string;
  role?: string;
  category: PilotFeedbackCategory;
  message: string;
  page?: string;
  status: PilotFeedbackStatus;
  createdAt?: any;
  updatedAt?: any;
  reviewedByUid?: string;
};

type SubmitFeedbackInput = {
  orgId?: string | null;
  orgName?: string | null;
  uid?: string | null;
  userEmail?: string | null;
  userName?: string | null;
  role?: string | null;
  category: PilotFeedbackCategory;
  message: string;
  page?: string | null;
};

const stripUndefined = (value: Record<string, any>) => Object.fromEntries(
  Object.entries(value).filter(([, entry]) => entry !== undefined)
);

export async function submitPilotFeedback(input: SubmitFeedbackInput): Promise<void> {
  const currentUser = auth.currentUser;
  const uid = String(input.uid || currentUser?.uid || "").trim();
  const orgId = String(input.orgId || "").trim();
  const message = String(input.message || "").trim();
  if (!uid) throw new Error("You must be signed in to send feedback.");
  if (!message) throw new Error("Feedback message is required.");

  await addDoc(collection(db, "pilotFeedback"), stripUndefined({
    orgId,
    orgName: input.orgName || "",
    uid,
    userEmail: input.userEmail || currentUser?.email || "",
    userName: input.userName || currentUser?.displayName || "",
    role: input.role || "",
    category: input.category,
    message,
    page: input.page || "",
    status: "new",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));
}

export async function loadPilotFeedback(): Promise<PilotFeedbackEntry[]> {
  const snapshot = await getDocs(query(collection(db, "pilotFeedback"), orderBy("createdAt", "desc")));
  return snapshot.docs.map(item => ({ id: item.id, ...(item.data() as Omit<PilotFeedbackEntry, "id">) }));
}

export async function updatePilotFeedbackStatus(id: string, status: PilotFeedbackStatus): Promise<void> {
  await updateDoc(doc(db, "pilotFeedback", id), {
    status,
    reviewedByUid: auth.currentUser?.uid || "",
    updatedAt: serverTimestamp(),
  });
}

export function formatPilotFeedbackDate(value: any): string {
  if (!value) return "Pending";
  const date = value?.toDate ? value.toDate() : value?._seconds ? new Date(value._seconds * 1000) : new Date(value);
  return Number.isNaN(date.getTime()) ? "Unavailable" : date.toLocaleString();
}
