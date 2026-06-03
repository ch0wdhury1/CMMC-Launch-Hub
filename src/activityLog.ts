import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { auth, db } from "./firebase";

export const ACTIVITY_ACTIONS = [
  "login.succeeded",
  "registration.approved",
  "invitation.created",
  "invitation.cancelled",
  "invitation.approved",
  "invitation.login_created",
  "user.activated",
  "user.updated",
  "user.removed",
  "profile.updated",
  "tier.requested",
  "tier.approved",
  "tier.rejected",
  "assessment.saved",
  "evidence.uploaded",
  "evidence.archived",
  "report.generated",
] as const;

export type ActivityAction = typeof ACTIVITY_ACTIONS[number] | string;

export type ActivityEvent = {
  id: string;
  orgId: string;
  orgName?: string;
  action: ActivityAction;
  actorUid: string;
  actorEmail?: string;
  actorName?: string;
  targetType?: string;
  targetId?: string;
  targetLabel?: string;
  summary: string;
  metadata?: Record<string, any>;
  createdAt?: any;
};

export type ActivityLogInput = {
  orgId?: string | null;
  orgName?: string | null;
  action: ActivityAction;
  actorUid?: string | null;
  actorEmail?: string | null;
  actorName?: string | null;
  targetType?: string;
  targetId?: string;
  targetLabel?: string;
  summary: string;
  metadata?: Record<string, any>;
};

const stripUndefined = (value: Record<string, any>) => Object.fromEntries(
  Object.entries(value).filter(([, entry]) => entry !== undefined)
);

const resolveOrgName = async (orgId: string, provided?: string | null) => {
  const trimmed = String(provided || "").trim();
  if (trimmed) return trimmed;
  try {
    const snapshot = await getDoc(doc(db, "orgs", orgId));
    const data = snapshot.data() as any;
    return String(
      data?.companyProfile?.legalName
      || data?.companyProfile?.companyName
      || data?.legalName
      || data?.name
      || data?.displayName
      || orgId
    ).trim();
  } catch {
    return orgId;
  }
};

export async function logActivityEvent(input: ActivityLogInput): Promise<void> {
  const currentUser = auth.currentUser;
  const actorUid = String(input.actorUid || currentUser?.uid || "").trim();
  const orgId = String(input.orgId || "").trim();
  if (!actorUid || !orgId) return;

  try {
    await addDoc(collection(db, "activityEvents"), stripUndefined({
      orgId,
      orgName: await resolveOrgName(orgId, input.orgName),
      action: input.action,
      actorUid,
      actorEmail: input.actorEmail || currentUser?.email || "",
      actorName: input.actorName || currentUser?.displayName || "",
      targetType: input.targetType,
      targetId: input.targetId,
      targetLabel: input.targetLabel,
      summary: input.summary,
      metadata: input.metadata ? stripUndefined(input.metadata) : undefined,
      createdAt: serverTimestamp(),
    }));
  } catch (error) {
    console.warn("[activity-log] event write failed; primary action retained", {
      action: input.action,
      orgId,
      targetId: input.targetId,
      error,
    });
  }
}

export async function loadActivityEvents(params: {
  orgId?: string | null;
  isSuperAdmin: boolean;
}): Promise<ActivityEvent[]> {
  const eventsQuery = params.isSuperAdmin
    ? collection(db, "activityEvents")
    : query(collection(db, "activityEvents"), where("orgId", "==", String(params.orgId || "")));
  const snapshot = await getDocs(eventsQuery as any);
  return snapshot.docs
    .map(item => ({ id: item.id, ...(item.data() as Omit<ActivityEvent, "id">) }))
    .sort((a, b) => {
      const left = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
      const right = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
      return right - left;
    });
}

export function formatActivityDate(value: any): string {
  if (!value) return "Pending";
  const date = value?.toDate ? value.toDate() : value?._seconds ? new Date(value._seconds * 1000) : new Date(value);
  return Number.isNaN(date.getTime()) ? "Unavailable" : date.toLocaleString();
}

