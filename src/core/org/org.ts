import { doc, getDoc, getFirestore } from "firebase/firestore";
import type { AppUser, Org } from "../store/AppContext";

export async function fetchUserProfile(uid: string): Promise<AppUser> {
  const db = getFirestore();
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("User profile missing in Firestore (users/{uid})");
  const data = snap.data() as any;
  return {
    uid,
    email: data.email,
    displayName: data.displayName,
    orgId: data.orgId,
    roles: data.roles,
    status: data.status,
  };
}

export async function fetchOrg(orgId: string): Promise<Org> {
  const db = getFirestore();
  const ref = doc(db, "orgs", orgId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Org missing in Firestore (orgs/{orgId})");
  const data = snap.data() as any;
  return {
    id: orgId,
    name: data.name,
    tier: data.tier,
    maxUsers: data.maxUsers,
    activeMemberCount: data.activeMemberCount,
    billingCycle: data.billingCycle,
    subscriptionStatus: data.subscriptionStatus,
    subscriptionStartDate: data.subscriptionStartDate,
    subscriptionEndDate: data.subscriptionEndDate,
  };
}



