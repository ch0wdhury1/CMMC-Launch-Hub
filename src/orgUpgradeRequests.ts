import { addDoc, collection, getDocs, onSnapshot, query, serverTimestamp, where, type Unsubscribe } from "firebase/firestore";
import { db } from "./firebase";

export type OrgUpgradeRequest = {
  id: string;
  type: "upgradeRequest";
  orgId: string;
  orgName?: string;
  organization?: string;
  requestedTier: "COMM_L2";
  currentTier: string;
  status: "pending" | "approved" | "rejected" | "archived";
  requestedByUid: string;
  requestedByEmail?: string;
  requestedByName?: string;
  createdAt?: any;
};

const upgradeRequestsQuery = (orgId: string) => query(collection(db, "accessRequests"), where("orgId", "==", orgId));
const upgradeRequestsFromSnapshot = (snapshot: any): OrgUpgradeRequest[] => snapshot.docs
  .map((item: any) => ({id: item.id, ...item.data()}))
  .filter((item: any) => item.type === "upgradeRequest");

export function subscribeOrgUpgradeRequests(
  orgId: string,
  onRequests: (requests: OrgUpgradeRequest[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(upgradeRequestsQuery(orgId), snapshot => onRequests(upgradeRequestsFromSnapshot(snapshot)), onError);
}

export async function createTierUpgradeRequest(params: {
  orgId: string;
  requestedByUid: string;
  requestedByEmail?: string;
  requestedByName?: string;
  orgName?: string;
  currentTier?: string;
}): Promise<string> {
  const snapshot = await getDocs(upgradeRequestsQuery(params.orgId));
  if (upgradeRequestsFromSnapshot(snapshot).some(request => request.status === "pending")) {
    throw new Error("Upgrade request already pending.");
  }
  const orgName = String(params.orgName || "").trim();
  const ref = await addDoc(collection(db, "accessRequests"), {
    type: "upgradeRequest",
    orgId: params.orgId,
    orgName,
    organization: orgName,
    requestedTier: "COMM_L2",
    currentTier: params.currentTier || "COMM_L1",
    status: "pending",
    requestedByUid: params.requestedByUid,
    requestedByEmail: params.requestedByEmail || "",
    requestedByName: params.requestedByName || "",
    createdAt: serverTimestamp(),
  });
  return ref.id;
}
