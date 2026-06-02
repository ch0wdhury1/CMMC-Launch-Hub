import { addDoc, collection, getDocs, onSnapshot, query, serverTimestamp, where, type Unsubscribe } from "firebase/firestore";
import { db } from "./firebase";

export type OrgUpgradeRequest = {
  id: string;
  type: "upgradeRequest";
  orgId: string;
  requestedTier: "COMM_L2";
  currentTier: "COMM_L1";
  status: "pending" | "approved" | "rejected" | "archived";
  requestedByUid: string;
  requestedByEmail?: string;
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
}): Promise<string> {
  const snapshot = await getDocs(upgradeRequestsQuery(params.orgId));
  if (upgradeRequestsFromSnapshot(snapshot).some(request => request.status === "pending")) {
    throw new Error("Upgrade request pending.");
  }
  const ref = await addDoc(collection(db, "accessRequests"), {
    type: "upgradeRequest",
    orgId: params.orgId,
    requestedTier: "COMM_L2",
    currentTier: "COMM_L1",
    status: "pending",
    requestedByUid: params.requestedByUid,
    requestedByEmail: params.requestedByEmail || "",
    createdAt: serverTimestamp(),
  });
  return ref.id;
}
