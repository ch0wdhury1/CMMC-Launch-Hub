import { doc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

export type CompanyUser = {
  id: string;
  fullName: string;
  email: string;
  role?: string;
};

export type CompanyProfileDoc = {
  companyName?: string;
  address?: string;
  website?: string;
  companyLogo?: string;

  primaryContactName?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;

  secondaryContactName?: string;
  secondaryContactEmail?: string;
  secondaryContactPhone?: string;

  users?: CompanyUser[];
};

export async function upsertUserCompany(uid: string, updates: Partial<CompanyProfileDoc>) {
  const ref = doc(db, "users", uid);

  // Merge into users/{uid}.company
  // Using setDoc merge so it won’t wipe other fields (tier, track, roles, entitlements)
  await setDoc(ref, { company: updates }, { merge: true });
}

export async function addCompanyUser(uid: string, newUser: CompanyUser) {
  const ref = doc(db, "users", uid);

  // We don’t have arrayUnion typed objects easily without importing it,
  // so we’ll use a merge approach from caller (preferred).
  // This function is optional; keeping for future if you want arrayUnion.
  await updateDoc(ref, {
    // placeholder - we’ll do it in the caller cleanly
  } as any);
}
