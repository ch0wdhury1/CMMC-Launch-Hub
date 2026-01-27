import express from "express";
import cors from "cors";
import { onRequest } from "firebase-functions/v2/https";
import admin from "firebase-admin";

admin.initializeApp();

const db = admin.firestore();

const app = express();
app.use(cors());
app.use(express.json());

// --- Auth middleware: requires Bearer token ---
async function requireAuth(req: any, res: any, next: any) {
  try {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing Bearer token" });
    }
    const token = authHeader.substring("Bearer ".length);
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    return next();
  } catch (e: any) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// Health / identity check
app.get("/api/me", requireAuth, async (req: any, res) => {
  return res.json({ uid: req.user.uid, email: req.user.email || null });
});

/**
 * Bootstrap endpoint:
 * - Reads system/activation
 * - Creates/updates users/{uid} with tier/track/expiration
 */
app.post("/api/bootstrap", requireAuth, async (req: any, res) => {
  const uid = req.user.uid;
  const email = req.user.email || null;

  const activationRef = db.doc("system/activation");
  const activationSnap = await activationRef.get();

  if (!activationSnap.exists) {
    return res.status(500).json({ error: "Missing system/activation" });
  }

  const activation = activationSnap.data() as any;

  const activeTrack: string = activation.activeTrack || "TRACK_2";
  const defaultTier: string = activation.defaultTier || "TIER_1";
  const ctSponsoredDurationDays: number = Number(activation.ctSponsoredDurationDays || 365);
  const singleUserOnly: boolean = Boolean(activation.singleUserOnly ?? true);

  const tiersEnabled = activation.tiersEnabled || {};
  const isDefaultTierEnabled = tiersEnabled[defaultTier] !== false;

  // If default tier is disabled, fall back safely
  const assignedTier = isDefaultTierEnabled ? defaultTier : "TIER_1";

  const userRef = db.doc(`users/${uid}`);
  const userSnap = await userRef.get();

  // Compute sponsored end date only if tier is CT_SPONSORED

  let ctSponsoredEndsAt: admin.firestore.Timestamp | null = null;

  if (assignedTier === "CT_SPONSORED") {
    const ms = Date.now() + ctSponsoredDurationDays * 24 * 60 * 60 * 1000;
    ctSponsoredEndsAt = admin.firestore.Timestamp.fromDate(new Date(ms));
  }

  const baseData = {
    uid,
    email,
    track: activeTrack,
    tier: assignedTier,
    singleUserOnly,
    ctSponsoredEndsAt,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (!userSnap.exists) {
    await userRef.set({
      ...baseData,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } else {
    await userRef.set(baseData, { merge: true });
  }

  const finalSnap = await userRef.get();
  return res.json({ ok: true, user: finalSnap.data() });
});

// --- CRITICAL export ---
export const api = onRequest(app);
