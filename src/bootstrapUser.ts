import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export async function bootstrapNewUser(user: {
  uid: string;
  email: string | null;
}) {
  const { uid, email } = user;

  const orgId = `org_${uid.slice(0, 6)}`;

  // 1️ User profile
  await setDoc(doc(db, "users", uid), {
    uid,
    email,
    tier: "CT_SPONSORED",
    track: "TRACK_1",
    singleUserOnly: true,
    orgId,
    entitlements: {
      l1_assessment: true,
      l2_assessment: false,
      evidence_basic: true,
      evidence_advanced: false,
      exports_readiness_pdf: true,
      exports_ssp_pdf: false,
      ai_assist_basic: true,
      ai_assist_advanced: false,
      admin_panel: false
    },
    roles: {
      superAdmin: false
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  // 2️ Org
  await setDoc(doc(db, "orgs", orgId), {
    name: email ?? "My Organization",
    tier: "CT_SPONSORED",
    track: "TRACK_1",
    createdAt: serverTimestamp()
  });

  // 3️ Org member
  await setDoc(doc(db, "orgs", orgId, "members", uid), {
    role: "admin",
    superAdmin: false,
    createdAt: serverTimestamp()
  });
}
