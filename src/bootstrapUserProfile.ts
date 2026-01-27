// src/bootstrapUserProfile.ts
import { auth, db } from "./firebase";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
} from "firebase/firestore";

type ActivationConfig = {
  defaultTier?: string;
  activeTrack?: string;
  singleUserOnly?: boolean;
  ctSponsoredDurationDays?: number;
};

function entitlementsForTier(tier: string) {
  // ✅ Adjust these defaults as you like
  // CT_SPONSORED should at least have L1 + basic tools enabled
  if (tier === "CT_SPONSORED") {
    return {
      l1_assessment: true,
      l2_assessment: false,
      evidence_basic: true,
      evidence_advanced: false,
      exports_readiness_pdf: true,
      exports_ssp_pdf: false,
      ai_assist_basic: true,
      ai_assist_advanced: false,
      admin_panel: false,
    };
  }

  // Example: Paid tier (if you use it)
  if (tier === "TIER_2") {
    return {
      l1_assessment: true,
      l2_assessment: true,
      evidence_basic: true,
      evidence_advanced: true,
      exports_readiness_pdf: true,
      exports_ssp_pdf: true,
      ai_assist_basic: true,
      ai_assist_advanced: true,
      admin_panel: false, // keep false unless you explicitly grant admin
    };
  }

  // Default minimal (safe)
  return {
    l1_assessment: false,
    l2_assessment: false,
    evidence_basic: false,
    evidence_advanced: false,
    exports_readiness_pdf: false,
    exports_ssp_pdf: false,
    ai_assist_basic: false,
    ai_assist_advanced: false,
    admin_panel: false,
  };
}

function addDays(ts: Timestamp, days: number) {
  const ms = ts.toMillis() + days * 24 * 60 * 60 * 1000;
  return Timestamp.fromMillis(ms);
}

export async function bootstrapUserProfile() {
  const user = auth.currentUser;
  if (!user) throw new Error("No authenticated user");

  const uid = user.uid;
  const email = user.email ?? "";

  // Read activation config (optional but recommended)
  const activationRef = doc(db, "system", "activation");
  const activationSnap = await getDoc(activationRef);
  const activation = (activationSnap.exists() ? activationSnap.data() : {}) as ActivationConfig;

  const tier = activation.defaultTier ?? "CT_SPONSORED";
  const track = activation.activeTrack ?? "TRACK_1";
  const singleUserOnly = activation.singleUserOnly === true;

  const now = Timestamp.now();
  const durationDays = activation.ctSponsoredDurationDays ?? 365;
  const ctSponsoredEndsAt = addDays(now, durationDays);

  const userRef = doc(db, "users", uid);
  const existingSnap = await getDoc(userRef);
  const existing = existingSnap.exists() ? existingSnap.data() : null;

  const existingEnt = (existing?.entitlements ?? null) as any;

  // If entitlements missing → create them based on tier
  const entitlements = existingEnt ?? entitlementsForTier(tier);

  // Roles: default empty
  const roles = existing?.roles ?? { superAdmin: false };

  // ✅ For Option 1 (single-user only), we do NOT force orgId
  // You can add it later when you enable /orgs rules
  const payload: any = {
    uid,
    email,
    tier,
    track,
    singleUserOnly,
    ctSponsoredEndsAt,
    entitlements,
    roles,
    updatedAt: serverTimestamp(),
  };

  if (!existing) {
    payload.createdAt = serverTimestamp();
  }

  await setDoc(userRef, payload, { merge: true });
}
