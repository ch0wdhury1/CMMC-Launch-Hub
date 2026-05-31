// Force redeploy: Gemini OCR header auth fix 2026-05-31

import express from "express";
import cors from "cors";
import { onRequest } from "firebase-functions/v2/https";
import admin from "firebase-admin";


import { defineSecret } from "firebase-functions/params";


admin.initializeApp();
const db = admin.firestore();
const app = express();
app.use(cors());
app.use(express.json());

const EVIDENCE_OCR_MODEL = "gemini-2.5-flash";
const SUPPORTED_EVIDENCE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "application/pdf",
  "text/plain",
]);

function safeErrorMessage(error: unknown, fallback = "OCR processing failed") {
  const message = error instanceof Error ? error.message : String(error || "");
  return message.trim().replace(/\s+/g, " ").slice(0, 160) || fallback;
}

function isSafePathSegment(value: string) {
  return value.trim().length > 0 && !value.includes("/") && !value.includes("\\");
}

function cleanStorageSegment(value: string) {
  return value.trim().replace(/[\\/]+/g, "_").replace(/[^a-zA-Z0-9._() -]+/g, "_") || "file";
}

function buildEvidenceStoragePath(orgId: string, evidenceId: string, fileName: string) {
  return `orgs/${cleanStorageSegment(orgId)}/evidence/${cleanStorageSegment(evidenceId)}/${cleanStorageSegment(fileName)}`;
}

function cleanDocId(value: string) {
  return encodeURIComponent(value).replace(/\./g, "%2E");
}

function evidenceDoc(orgId: string, evidenceId: string) {
  return db.doc(`orgs/${orgId}/evidence/${cleanDocId(evidenceId)}`);
}

async function canAccessOrg(uid: string, orgId: string) {
  const [userSnap, membershipSnap] = await Promise.all([
    db.doc(`users/${uid}`).get(),
    db.doc(`orgs/${orgId}/members/${uid}`).get(),
  ]);
  const isSuperAdmin = userSnap.exists && userSnap.data()?.roles?.superAdmin === true;
  const isActiveMember = membershipSnap.exists && membershipSnap.data()?.status === "active";
  return isSuperAdmin || isActiveMember;
}

async function updateEvidenceOcrFailure(
  orgId: string,
  evidenceId: string,
  error: unknown
) {
  const processedAt = admin.firestore.FieldValue.serverTimestamp();
  await evidenceDoc(orgId, evidenceId).set({
    processingStatus: "ocr_failed",
    processingError: safeErrorMessage(error),
    processedAt,
    processedBy: "function:evidence-ocr",
    updatedAt: processedAt,
  }, {merge: true});
}

app.post("/api/evidence/ocr", requireAuth, async (req: any, res) => {
  const {
    orgId,
    assessmentId,
    evidenceId,
    storagePath,
    fileName,
    fileType,
    fileSize,
    practiceIds,
    objectiveIds,
  } = req.body || {};

  if (
    typeof orgId !== "string" ||
    typeof assessmentId !== "string" ||
    typeof evidenceId !== "string" ||
    typeof storagePath !== "string" ||
    typeof fileName !== "string" ||
    typeof fileType !== "string" ||
    typeof fileSize !== "number" ||
    !Number.isFinite(fileSize) ||
    fileSize < 0 ||
    !isSafePathSegment(orgId) ||
    evidenceId.trim().length === 0 ||
    fileName.trim().length === 0 ||
    !Array.isArray(practiceIds) ||
    !practiceIds.every((id: unknown) => typeof id === "string") ||
    !Array.isArray(objectiveIds) ||
    !objectiveIds.every((id: unknown) => typeof id === "string")
  ) {
    return res.status(400).json({error: "Invalid evidence OCR request"});
  }

  let allowed: boolean;
  try {
    allowed = await canAccessOrg(req.user.uid, orgId);
  } catch (error) {
    console.error("[evidence-ocr] organization authorization failed", error);
    return res.status(500).json({error: "Could not verify organization access"});
  }

  if (!allowed) {
    return res.status(403).json({error: "Not authorized for this organization"});
  }

  const expectedStoragePath = buildEvidenceStoragePath(orgId, evidenceId, fileName);
  if (storagePath !== expectedStoragePath) {
    return res.status(400).json({error: "Invalid evidence storage path"});
  }

  if (!SUPPORTED_EVIDENCE_TYPES.has(fileType)) {
    await updateEvidenceOcrFailure(orgId, evidenceId, "Unsupported evidence file type")
      .catch((error) => console.error("[evidence-ocr] failed to record unsupported type", error));
    return res.status(415).json({
      error: "Unsupported evidence file type",
      processingStatus: "ocr_failed",
    });
  }

  try {
    const apiKey = GEMINI_API_KEY.value();
    if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

    const [fileBytes] = await admin.storage().bucket().file(storagePath).download();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      EVIDENCE_OCR_MODEL
    )}:generateContent`;
    console.info("[evidence-ocr] Gemini request diagnostics", {
      url,
      apiKeyPresent: Boolean(apiKey),
      apiKeyLength: apiKey.length,
      apiKeyStartsWithAIza: apiKey.startsWith("AIza"),
    });
    const geminiResponse = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [
            {
              text: "Extract the readable text from this evidence file and provide a concise compliance-oriented summary. Preserve important names, dates, controls, and findings.",
            },
            {
              inlineData: {
                mimeType: fileType,
                data: fileBytes.toString("base64"),
              },
            },
          ],
        }],
        generationConfig: {temperature: 0.1},
      }),
    });
    const data: any = await geminiResponse.json();
    console.info("[evidence-ocr] Gemini response diagnostics", {
      status: geminiResponse.status,
      error: data?.error || null,
    });
    if (!geminiResponse.ok) {
      throw new Error(data?.error?.message || "Gemini OCR request failed");
    }

    const ocrSummary =
      data?.candidates?.[0]?.content?.parts
        ?.map((part: any) => part?.text)
        ?.filter(Boolean)
        ?.join("")
        ?.trim() || "";
    if (!ocrSummary) throw new Error("Gemini OCR returned no summary");

    const processedAt = admin.firestore.FieldValue.serverTimestamp();
    await evidenceDoc(orgId, evidenceId).set({
      ocrSummary,
      processingStatus: "ocr_completed",
      processedAt,
      processedBy: "function:evidence-ocr",
      ocrModel: EVIDENCE_OCR_MODEL,
      updatedAt: processedAt,
    }, {merge: true});

    return res.json({
      ok: true,
      ocrSummary,
      processingStatus: "ocr_completed",
      ocrModel: EVIDENCE_OCR_MODEL,
    });
  } catch (error) {
    const processingError = safeErrorMessage(error);
    await updateEvidenceOcrFailure(orgId, evidenceId, processingError)
      .catch((failureError) => console.error("[evidence-ocr] failed to record OCR failure", failureError));
    console.warn("[evidence-ocr] OCR processing failed", {
      orgId,
      assessmentId,
      evidenceId,
      storagePath,
      practiceIds,
      objectiveIds,
      error: processingError,
    });
    return res.status(500).json({
      error: processingError,
      processingStatus: "ocr_failed",
    });
  }
});



app.post("/api/ai/gemini", requireAuth, async (req: any, res) => {
  try {
    const prompt = req.body?.prompt;
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "prompt is required" });
    }

    const model =
      typeof req.body?.model === "string" && req.body.model.trim()
        ? req.body.model.trim()
        : "gemini-2.5-flash";

    const temperature =
      typeof req.body?.temperature === "number" ? req.body.temperature : 0.2;

    const apiKey = GEMINI_API_KEY.value();
    if (!apiKey) return res.status(500).json({ error: "Missing GEMINI_API_KEY" });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent?key=${apiKey}`;

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature },
      }),
    });

    const data: any = await r.json();

    if (!r.ok) {
      return res.status(r.status).json({ error: "Gemini error", details: data });
    }

    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: any) => p?.text)
        ?.filter(Boolean)
        ?.join("") || "";

    return res.json({ text });
  } catch (e: any) {
    return res.status(500).json({ error: "Server error", details: String(e) });
  }
});






const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");






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
// export const api = onRequest(app);

export const api = onRequest({ secrets: [GEMINI_API_KEY] }, app);
