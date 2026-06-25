// Force redeploy: Gemini OCR header auth fix 2026-05-31

import express from "express";
import cors from "cors";
import { onRequest } from "firebase-functions/v2/https";
import admin from "firebase-admin";
import { randomUUID } from "node:crypto";


import { defineSecret } from "firebase-functions/params";


admin.initializeApp();
const db = admin.firestore();
const app = express();
app.use(cors());
app.use(express.json({limit: "15mb"}));

const EVIDENCE_OCR_MODEL = "gemini-2.5-flash";
const MAX_EVIDENCE_UPLOAD_BYTES = 10 * 1024 * 1024;
const EVIDENCE_UPLOAD_ROLES = new Set(["orgOwner", "orgAdmin", "assessor", "contributor"]);
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
  const [userSnap, orgSnap, membershipSnap] = await Promise.all([
    db.doc(`users/${uid}`).get(),
    db.doc(`orgs/${orgId}`).get(),
    db.doc(`orgs/${orgId}/members/${uid}`).get(),
  ]);
  const user = userSnap.data();
  const membership = membershipSnap.data();
  const isSuperAdmin = userSnap.exists && user?.status === "active" && user?.roles?.superAdmin === true;
  const isActiveMember = userSnap.exists
    && user?.status === "active"
    && user?.orgId === orgId
    && orgSnap.exists
    && orgSnap.data()?.status === "active"
    && membershipSnap.exists
    && membership?.status === "active"
    && membership?.active === true
    && typeof membership?.role === "string";
  return isSuperAdmin || isActiveMember;
}

async function getEvidenceUploadAuthorization(uid: string, orgId: string) {
  const [userSnap, orgSnap, membershipSnap] = await Promise.all([
    db.doc(`users/${uid}`).get(),
    db.doc(`orgs/${orgId}`).get(),
    db.doc(`orgs/${orgId}/members/${uid}`).get(),
  ]);
  const user = userSnap.data();
  const org = orgSnap.data();
  const membership = membershipSnap.data();
  const superAdmin = userSnap.exists && user?.status === "active" && user?.roles?.superAdmin === true;
  if (superAdmin) return {allowed: true, role: "superAdmin", user, org, membership};
  if (!userSnap.exists || user?.status !== "active") {
    return {allowed: false, errorCode: "NOT_AUTHORIZED", errorMessage: "Active user access is required.", user, org, membership};
  }
  if (user?.orgId !== orgId) {
    return {allowed: false, errorCode: "NOT_AUTHORIZED", errorMessage: "User organization does not match upload organization.", user, org, membership};
  }
  if (!orgSnap.exists || org?.status !== "active") {
    return {allowed: false, errorCode: "ORG_NOT_ACTIVE", errorMessage: "Organization is not active.", user, org, membership};
  }
  if (!membershipSnap.exists || membership?.status !== "active" || membership?.active !== true) {
    return {allowed: false, errorCode: "NOT_AUTHORIZED", errorMessage: "Active organization membership is required.", user, org, membership};
  }
  if (membership?.role === "viewer") {
    return {allowed: false, errorCode: "VIEWER_UPLOAD_DENIED", errorMessage: "Viewer role cannot upload evidence.", user, org, membership};
  }
  if (!EVIDENCE_UPLOAD_ROLES.has(membership?.role)) {
    return {allowed: false, errorCode: "NOT_AUTHORIZED", errorMessage: "Organization role cannot upload evidence.", user, org, membership};
  }
  return {allowed: true, role: membership.role, user, org, membership};
}

async function canValidateEvidence(uid: string, orgId: string) {
  const [userSnap, membershipSnap] = await Promise.all([
    db.doc(`users/${uid}`).get(),
    db.doc(`orgs/${orgId}/members/${uid}`).get(),
  ]);
  if (userSnap.exists && userSnap.data()?.roles?.superAdmin === true) return true;
  const membership = membershipSnap.data();
  return membershipSnap.exists
    && membership?.status === "active"
    && ["orgOwner", "orgAdmin", "assessor", "contributor"].includes(membership?.role);
}

async function isSuperAdminUser(uid: string) {
  const userSnap = await db.doc(`users/${uid}`).get();
  return userSnap.exists && userSnap.data()?.status === "active" && userSnap.data()?.roles?.superAdmin === true;
}

const SPONSOR_PROGRAM_OPTIONS = new Set([
  "CT Manufacturing Pilot",
  "CCAT Sponsored Pilot",
  "DECD / Office of Manufacturing Pilot",
  "APEX Accelerator Pilot",
  "Cyber Blue Star Internal Pilot",
  "Other",
]);

const listRegistrationPrograms = async (_req: any, res: any) => {
  try {
    const snapshot = await db.collection("programs")
      .where("status", "==", "active")
      .limit(100)
      .get();
    const programs = snapshot.docs
      .map(docSnap => {
        const data = docSnap.data() || {};
        return {
          id: docSnap.id,
          name: String(data.name || ""),
          programCode: String(data.programCode || ""),
          programType: String(data.programType || ""),
          state: String(data.state || ""),
          sponsorName: String(data.sponsorName || ""),
          allowL1: data.allowL1 !== false,
          allowL2: data.allowL2 === true,
          status: "active",
        };
      })
      .filter(program => program.name && program.programCode)
      .sort((a, b) => a.programCode.localeCompare(b.programCode));
    return res.json({success: true, programs});
  } catch (error) {
    console.error("Registration programs load failed", error);
    return res.status(500).json({success: false, errorMessage: "Unable to load sponsored programs"});
  }
};

app.get("/api/registration/programs", listRegistrationPrograms);
app.get("/registration/programs", listRegistrationPrograms);
app.get("/api/api/registration/programs", listRegistrationPrograms);

const EVIDENCE_VALIDATION_STATUSES = new Set([
  "supportive",
  "partial",
  "weak",
  "not_relevant",
  "needs_review",
]);
const EVIDENCE_VALIDATION_CONFIDENCE = new Set(["high", "medium", "low"]);

function objectiveRecordDocId(practiceId: string, objectiveId: string) {
  return cleanDocId(`${practiceId}::${objectiveId}`);
}

function evidenceValidationDoc(
  orgId: string,
  assessmentId: string,
  practiceId: string,
  objectiveId: string | undefined,
  evidenceId: string
) {
  const recordPath = objectiveId
    ? `objectiveRecords/${objectiveRecordDocId(practiceId, objectiveId)}`
    : `practiceRecords/${cleanDocId(practiceId)}`;
  return db.doc(
    `orgs/${orgId}/assessments/${assessmentId}/${recordPath}/evidenceValidations/${cleanDocId(evidenceId)}`
  );
}

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.every(item => typeof item === "string")) return null;
  return value.map(item => item.trim()).filter(Boolean).slice(0, 12);
}

function parseEvidenceValidation(text: string) {
  const normalized = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const parsed = JSON.parse(normalized);
  const strengths = stringArray(parsed?.strengths);
  const gaps = stringArray(parsed?.gaps);
  const recommendedActions = stringArray(parsed?.recommendedActions);
  if (
    !EVIDENCE_VALIDATION_STATUSES.has(parsed?.validationStatus)
    || !EVIDENCE_VALIDATION_CONFIDENCE.has(parsed?.confidence)
    || typeof parsed?.summary !== "string"
    || !parsed.summary.trim()
    || !strengths
    || !gaps
    || !recommendedActions
  ) {
    throw new Error("Gemini returned an invalid evidence validation result");
  }
  return {
    validationStatus: parsed.validationStatus,
    confidence: parsed.confidence,
    summary: parsed.summary.trim().slice(0, 1200),
    strengths,
    gaps,
    recommendedActions,
  };
}

function requiredString(value: unknown, fieldName: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Gemini returned an invalid ${fieldName}`);
  }
  return value.trim().slice(0, 1600);
}

function requiredStringArray(value: unknown, fieldName: string) {
  const result = stringArray(value);
  if (!result) throw new Error(`Gemini returned an invalid ${fieldName}`);
  return result;
}

function parsePracticeCopilot(text: string) {
  const normalized = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const parsed = JSON.parse(normalized);
  return {
    explanation: requiredString(parsed?.explanation, "explanation"),
    whyItMatters: requiredString(parsed?.whyItMatters, "whyItMatters"),
    expectedEvidence: requiredStringArray(parsed?.expectedEvidence, "expectedEvidence"),
    commonGaps: requiredStringArray(parsed?.commonGaps, "commonGaps"),
    suggestedActions: requiredStringArray(parsed?.suggestedActions, "suggestedActions"),
    caution: requiredString(parsed?.caution, "caution"),
  };
}

async function generateGeminiJson(prompt: string) {
  const apiKey = GEMINI_API_KEY.value();
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    EVIDENCE_OCR_MODEL
  )}:generateContent`;
  const geminiResponse = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{role: "user", parts: [{text: prompt}]}],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    }),
  });
  const data: any = await geminiResponse.json();
  if (!geminiResponse.ok) {
    throw new Error(data?.error?.message || "Gemini JSON request failed");
  }
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((part: any) => part?.text)
    ?.filter(Boolean)
    ?.join("")
    ?.trim() || "";
  if (!text) throw new Error("Gemini returned no JSON result");
  return text;
}

async function updateEvidenceOcrFailure(
  orgId: string,
  evidenceId: string,
  error: unknown
) {
  const processedAt = admin.firestore.FieldValue.serverTimestamp();
  await evidenceDoc(orgId, evidenceId).set({
    ocrStatus: "failed",
    processingStatus: "ocr_failed",
    processingError: safeErrorMessage(error),
    processedAt,
    processedBy: "function:evidence-ocr",
    updatedAt: processedAt,
  }, {merge: true});
}

app.post("/api/evidence/upload", requireEvidenceUploadAuth, async (req: any, res) => {
  const {
    orgId,
    assessmentId,
    practiceId,
    objectiveId,
    evidenceId: requestedEvidenceId,
    fileName,
    fileType,
    fileSize,
    fileBase64,
  } = req.body || {};
  const uploadLog = {
    uid: req.user.uid,
    orgId,
    assessmentId,
    practiceId,
    objectiveId,
    fileName,
    fileSize,
  };

  if (
    typeof orgId !== "string"
    || typeof assessmentId !== "string"
    || typeof practiceId !== "string"
    || typeof fileName !== "string"
    || typeof fileType !== "string"
    || typeof fileSize !== "number"
    || !Number.isFinite(fileSize)
    || fileSize < 0
    || typeof fileBase64 !== "string"
    || !isSafePathSegment(orgId)
    || !isSafePathSegment(assessmentId)
    || practiceId.trim().length === 0
    || fileName.trim().length === 0
    || (objectiveId !== undefined && typeof objectiveId !== "string")
    || (requestedEvidenceId !== undefined && (typeof requestedEvidenceId !== "string" || !isSafePathSegment(requestedEvidenceId)))
  ) {
    console.warn("[evidence-upload] invalid request", uploadLog);
    return res.status(400).json({success: false, errorCode: "INVALID_REQUEST", errorMessage: "Invalid evidence upload request."});
  }
  if (fileSize > MAX_EVIDENCE_UPLOAD_BYTES) {
    return res.status(413).json({success: false, errorCode: "FILE_TOO_LARGE", errorMessage: "Evidence file exceeds the 10 MB upload limit."});
  }

  const authorization = await getEvidenceUploadAuthorization(req.user.uid, orgId).catch((error) => {
    console.error("[evidence-upload] authorization lookup failed", {...uploadLog, error: safeErrorMessage(error, "Authorization lookup failed")});
    return null;
  });
  if (!authorization) {
    return res.status(500).json({success: false, errorCode: "AUTHORIZATION_CHECK_FAILED", errorMessage: "Could not verify upload access."});
  }
  if (!authorization.allowed) {
    console.warn("[evidence-upload] denied", {...uploadLog, role: authorization.membership?.role, errorCode: authorization.errorCode});
    return res.status(403).json({success: false, errorCode: authorization.errorCode, errorMessage: authorization.errorMessage});
  }

  let fileBytes: Buffer;
  try {
    fileBytes = Buffer.from(fileBase64, "base64");
  } catch (error) {
    return res.status(400).json({success: false, errorCode: "INVALID_FILE_CONTENT", errorMessage: "Evidence file content could not be read."});
  }
  if (fileBytes.length !== fileSize || fileBytes.length > MAX_EVIDENCE_UPLOAD_BYTES) {
    return res.status(400).json({success: false, errorCode: "INVALID_FILE_SIZE", errorMessage: "Evidence file size did not match the uploaded content."});
  }

  const evidenceId = requestedEvidenceId || randomUUID();
  const safeFileName = cleanStorageSegment(fileName);
  const storagePath = buildEvidenceStoragePath(orgId, evidenceId, safeFileName);
  const uploadedAt = admin.firestore.FieldValue.serverTimestamp();
  const downloadToken = randomUUID();
  const bucket = admin.storage().bucket();

  console.info("[evidence-upload] starting", {...uploadLog, evidenceId, storagePath, role: authorization.role});
  try {
    await bucket.file(storagePath).save(fileBytes, {
      resumable: false,
      metadata: {
        contentType: fileType || "application/octet-stream",
        metadata: {firebaseStorageDownloadTokens: downloadToken},
      },
    });
  } catch (error) {
    console.error("[evidence-upload] Storage write failed", {...uploadLog, evidenceId, storagePath, role: authorization.role, error: safeErrorMessage(error, "Storage upload failed")});
    return res.status(500).json({success: false, errorCode: "STORAGE_UPLOAD_FAILED", errorMessage: "Evidence file could not be uploaded."});
  }

  const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(storagePath)}?alt=media&token=${encodeURIComponent(downloadToken)}`;
  try {
    await evidenceDoc(orgId, evidenceId).set({
      id: evidenceId,
      evidenceId,
      orgId,
      assessmentId,
      practiceId,
      objectiveId: objectiveId || null,
      practiceIds: [practiceId],
      objectiveIds: objectiveId ? [objectiveId] : [],
      fileName,
      fileType,
      fileSize,
      storagePath,
      downloadUrl,
      storageStatus: "uploaded",
      status: "active",
      active: true,
      uploadedByUid: req.user.uid,
      uploadedByEmail: req.user.email || authorization.user?.email || "",
      uploadedAt,
      updatedAt: uploadedAt,
      source: "backend_upload",
      ocrStatus: "pending",
      processingStatus: "ocr_pending",
    }, {merge: true});
  } catch (error) {
    console.error("[evidence-upload] metadata write failed", {...uploadLog, evidenceId, storagePath, role: authorization.role, error: safeErrorMessage(error, "Metadata write failed")});
    return res.status(500).json({success: false, errorCode: "METADATA_WRITE_FAILED", errorMessage: "Evidence file uploaded, but metadata could not be saved."});
  }

  console.info("[evidence-upload] complete", {...uploadLog, evidenceId, storagePath, role: authorization.role});
  return res.json({
    success: true,
    evidenceId,
    storagePath,
    downloadUrl,
    fileName,
    fileType,
    fileSize,
    storageStatus: "uploaded",
    status: "active",
    active: true,
    source: "backend_upload",
    ocrStatus: "pending",
    processingStatus: "ocr_pending",
    uploadedAt: new Date().toISOString(),
  });
});

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
      ocrStatus: "completed",
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

app.post("/api/evidence/validate", requireAuth, async (req: any, res) => {
  const {
    orgId,
    assessmentId,
    practiceId,
    objectiveId,
    evidenceId,
    evidenceSource,
    practiceTitle,
    objectiveTitle,
    fileName,
    category,
    description,
    tags,
    ocrSummary,
  } = req.body || {};

  if (
    typeof orgId !== "string"
    || typeof assessmentId !== "string"
    || typeof practiceId !== "string"
    || typeof evidenceId !== "string"
    || typeof evidenceSource !== "string"
    || typeof practiceTitle !== "string"
    || typeof fileName !== "string"
    || !isSafePathSegment(orgId)
    || !isSafePathSegment(assessmentId)
    || practiceId.trim().length === 0
    || evidenceId.trim().length === 0
    || practiceTitle.trim().length === 0
    || fileName.trim().length === 0
    || (objectiveId !== undefined && typeof objectiveId !== "string")
    || !["uploaded", "evidenceLibrary"].includes(evidenceSource)
    || (tags !== undefined && stringArray(tags) === null)
  ) {
    return res.status(400).json({error: "Invalid evidence validation request"});
  }

  try {
    if (!(await canValidateEvidence(req.user.uid, orgId))) {
      return res.status(403).json({error: "Not authorized to validate evidence for this organization"});
    }

    const sourceRef = evidenceSource === "evidenceLibrary"
      ? db.doc(`orgs/${orgId}/evidenceLibrary/${cleanDocId(evidenceId)}`)
      : evidenceDoc(orgId, evidenceId);
    const sourceSnap = await sourceRef.get();
    if (!sourceSnap.exists) {
      return res.status(404).json({error: "Evidence metadata not found"});
    }
    const source = sourceSnap.data() || {};
    const apiKey = GEMINI_API_KEY.value();
    if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

    const prompt = [
      "You are reviewing evidence for CMMC readiness support.",
      "Do not state that evidence proves compliance. Do not make certification claims. Do not give legal assurance.",
      "Use cautious language and make clear that human review is required.",
      "Return JSON only with exactly these keys:",
      '{"validationStatus":"supportive|partial|weak|not_relevant|needs_review","confidence":"high|medium|low","summary":"string","strengths":["string"],"gaps":["string"],"recommendedActions":["string"]}',
      "",
      "Review context:",
      JSON.stringify({
        practiceId,
        practiceTitle,
        objectiveId: objectiveId || null,
        objectiveTitle: typeof objectiveTitle === "string" ? objectiveTitle : null,
        evidenceId,
        evidenceSource,
        fileName: source.fileName || fileName,
        category: source.category || category || null,
        description: source.description || description || null,
        tags: source.tags || stringArray(tags) || [],
        ocrSummary: source.ocrSummary || ocrSummary || "",
      }),
    ].join("\n");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      EVIDENCE_OCR_MODEL
    )}:generateContent`;
    const geminiResponse = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{role: "user", parts: [{text: prompt}]}],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      }),
    });
    const data: any = await geminiResponse.json();
    if (!geminiResponse.ok) {
      throw new Error(data?.error?.message || "Gemini evidence validation request failed");
    }
    const text = data?.candidates?.[0]?.content?.parts
      ?.map((part: any) => part?.text)
      ?.filter(Boolean)
      ?.join("")
      ?.trim() || "";
    if (!text) throw new Error("Gemini returned no evidence validation result");

    const aiResult = parseEvidenceValidation(text);
    const reviewedAt = admin.firestore.FieldValue.serverTimestamp();
    const result = {
      id: evidenceId,
      evidenceId,
      orgId,
      assessmentId,
      practiceId,
      ...(objectiveId ? {objectiveId} : {}),
      ...aiResult,
      reviewedBy: "ai",
      reviewedAt,
      model: EVIDENCE_OCR_MODEL,
    };
    await evidenceValidationDoc(orgId, assessmentId, practiceId, objectiveId, evidenceId)
      .set(result, {merge: true});

    return res.json({
      ...result,
      reviewedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.warn("[evidence-validation] validation failed", {
      orgId,
      assessmentId,
      practiceId,
      objectiveId,
      evidenceId,
      error: safeErrorMessage(error, "Evidence validation failed"),
    });
    return res.status(500).json({error: "Evidence validation failed"});
  }
});

app.post("/api/practice/copilot", requireAuth, async (req: any, res) => {
  const {
    orgId,
    assessmentId,
    assessmentLevel,
    practiceId,
    practiceTitle,
    domain,
    currentStatus,
  } = req.body || {};
  console.info("[practice-copilot] request received", {
    authenticatedUid: req.user.uid,
    orgId,
    practiceId,
  });

  const missingFields = [
    typeof orgId !== "string" || !orgId.trim() ? "orgId" : null,
    typeof assessmentId !== "string" || !assessmentId.trim() ? "assessmentId" : null,
    typeof practiceId !== "string" || !practiceId.trim() ? "practiceId" : null,
  ].filter((field): field is string => Boolean(field));

  if (
    missingFields.length > 0
    || !isSafePathSegment(orgId)
    || !isSafePathSegment(assessmentId)
    || (assessmentLevel !== undefined && (typeof assessmentLevel !== "number" || ![1, 2].includes(assessmentLevel)))
    || (practiceTitle !== undefined && typeof practiceTitle !== "string")
    || (domain !== undefined && typeof domain !== "string")
    || (currentStatus !== undefined && typeof currentStatus !== "string")
  ) {
    console.warn("Invalid Practice Copilot request payload", {
      hasOrgId: !!orgId,
      hasAssessmentId: !!assessmentId,
      hasPracticeId: !!practiceId,
      bodyKeys: Object.keys(req.body || {}),
    });
    return res.status(400).json({
      success: false,
      errorCode: "INVALID_REQUEST",
      errorMessage: "Missing required fields: orgId, assessmentId, or practiceId.",
      missingFields,
    });
  }

  try {
    if (!(await canValidateEvidence(req.user.uid, orgId))) {
      return res.status(403).json({
        success: false,
        errorCode: "NOT_AUTHORIZED",
        errorMessage: "Not authorized to generate Practice Copilot guidance",
      });
    }

    const orgRef = db.doc(`orgs/${orgId}`);
    const assessmentRef = orgRef.collection("assessments").doc(assessmentId);
    const practiceRef = assessmentRef.collection("practiceRecords").doc(cleanDocId(practiceId));
    const [
      orgSnap,
      practiceSnap,
      objectivesSnap,
      evidenceSnap,
      notesSnap,
      poamSnap,
      practiceValidationsSnap,
      practiceEvidenceRefsSnap,
    ] = await Promise.all([
      orgRef.get(),
      practiceRef.get(),
      assessmentRef.collection("objectiveRecords").where("practiceId", "==", practiceId).get(),
      orgRef.collection("evidence").where("assessmentId", "==", assessmentId).get(),
      orgRef.collection("notes").where("assessmentId", "==", assessmentId).get(),
      assessmentRef.collection("poamItems").get(),
      practiceRef.collection("evidenceValidations").get(),
      practiceRef.collection("evidenceRefs").get(),
    ]);

    const objectives = objectivesSnap.docs.slice(0, 30).map(snapshot => snapshot.data());
    const objectiveContext = await Promise.all(objectivesSnap.docs.slice(0, 30).map(async snapshot => {
      const [validations, evidenceRefs] = await Promise.all([
        snapshot.ref.collection("evidenceValidations").get(),
        snapshot.ref.collection("evidenceRefs").get(),
      ]);
      return {
        validations: validations.docs.slice(0, 12).map(validation => validation.data()),
        evidenceRefs: evidenceRefs.docs
          .map(reference => reference.data())
          .filter(reference => reference.status === "active")
          .slice(0, 12),
      };
    }));
    const objectiveValidations = objectiveContext.flatMap(context => context.validations);
    const libraryEvidenceIds = Array.from(new Set([
      ...practiceEvidenceRefsSnap.docs
        .map(snapshot => snapshot.data())
        .filter(reference => reference.status === "active")
        .map(reference => reference.evidenceId),
      ...objectiveContext.flatMap(context => context.evidenceRefs.map(reference => reference.evidenceId)),
    ].filter((evidenceId): evidenceId is string => typeof evidenceId === "string"))).slice(0, 30);
    const libraryEvidence = (await Promise.all(libraryEvidenceIds.map(async evidenceId => {
      const snapshot = await orgRef.collection("evidenceLibrary").doc(cleanDocId(evidenceId)).get();
      return snapshot.exists ? {evidenceId, ...snapshot.data()} : null;
    }))).filter(Boolean);
    const evidence = evidenceSnap.docs
      .map(snapshot => snapshot.data())
      .filter(item => Array.isArray(item.practiceIds) && item.practiceIds.includes(practiceId))
      .slice(0, 30);
    const notes = notesSnap.docs
      .map(snapshot => snapshot.data())
      .filter(item => item.practiceId === practiceId)
      .slice(0, 30);
    const poamItems = poamSnap.docs
      .map(snapshot => snapshot.data())
      .filter(item => Array.isArray(item.relatedPracticeIds) && item.relatedPracticeIds.includes(practiceId))
      .slice(0, 30);
    const validations = [
      ...practiceValidationsSnap.docs.slice(0, 12).map(snapshot => snapshot.data()),
      ...objectiveValidations,
    ].slice(0, 40);

    const prompt = [
      "You are providing CMMC practice guidance.",
      "Guidance is advisory only. Do not say the organization is compliant.",
      "Do not say evidence proves compliance. Do not guarantee certification.",
      "Human review is required.",
      "Return JSON only with exactly these keys:",
      '{"explanation":"string","whyItMatters":"string","expectedEvidence":["string"],"commonGaps":["string"],"suggestedActions":["string"],"caution":"string"}',
      "",
      "Practice context:",
      JSON.stringify({
        assessmentLevel,
        practiceId,
        practiceTitle,
        domain: domain || null,
        currentStatus: currentStatus || practiceSnap.data()?.status || null,
        practiceRecord: practiceSnap.exists ? practiceSnap.data() : null,
        objectives,
        evidence: evidence.map(item => ({
          evidenceId: item.evidenceId,
          fileName: item.fileName || item.name,
          description: item.description,
          ocrSummary: item.ocrSummary,
          processingStatus: item.processingStatus,
        })),
        reusedLibraryEvidence: libraryEvidence.map((item: any) => ({
          evidenceId: item.evidenceId,
          fileName: item.fileName,
          category: item.category,
          description: item.description,
          tags: item.tags,
          ocrSummary: item.ocrSummary,
          status: item.status,
        })),
        evidenceValidations: validations.map(item => ({
          evidenceId: item.evidenceId,
          validationStatus: item.validationStatus,
          confidence: item.confidence,
          summary: item.summary,
          gaps: item.gaps,
        })),
        notes: notes.map(item => ({
          objectiveId: item.objectiveId,
          content: item.content || item.body,
        })),
        poamItems: poamItems.map(item => ({
          title: item.title,
          description: item.description,
          priority: item.priority,
          status: item.status,
          remediationPlan: item.remediationPlan,
        })),
        companyProfile: orgSnap.data()?.companyProfile || null,
      }),
    ].join("\n");

    const geminiRawResponse = await generateGeminiJson(prompt);
    console.info("[practice-copilot] Gemini raw response", {
      orgId,
      practiceId,
      response: geminiRawResponse,
    });
    let aiResult;
    try {
      aiResult = parsePracticeCopilot(geminiRawResponse);
    } catch (error) {
      console.error("[practice-copilot] JSON parse error", {
        orgId,
        practiceId,
        error: safeErrorMessage(error, "Practice Copilot JSON parse failed"),
      });
      return res.status(502).json({
        success: false,
        errorCode: "GEMINI_JSON_PARSE_ERROR",
        errorMessage: "Unable to parse Practice Copilot guidance",
      });
    }
    const generatedAt = admin.firestore.FieldValue.serverTimestamp();
    const result = {
      id: "latest",
      orgId,
      assessmentId,
      practiceId,
      ...aiResult,
      generatedBy: "ai",
      generatedAt,
      model: EVIDENCE_OCR_MODEL,
    };
    try {
      await practiceRef.collection("copilot").doc("latest").set(result, {merge: true});
    } catch (error) {
      console.error("[practice-copilot] Firestore write error", {
        orgId,
        practiceId,
        error: safeErrorMessage(error, "Practice Copilot Firestore write failed"),
      });
      return res.status(500).json({
        success: false,
        errorCode: "FIRESTORE_WRITE_ERROR",
        errorMessage: "Unable to save Practice Copilot guidance",
      });
    }

    return res.json({
      ...result,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.warn("[practice-copilot] generation failed", {
      orgId,
      assessmentId,
      practiceId,
      error: safeErrorMessage(error, "Practice Copilot generation failed"),
    });
    return res.status(500).json({
      success: false,
      errorCode: "COPILOT_GENERATION_ERROR",
      errorMessage: "Unable to generate guidance",
    });
  }
});

app.get("/api/admin/cleanup-audit", requireAuth, async (req: any, res) => {
  try {
    if (!(await isSuperAdminUser(req.user.uid))) {
      return res.status(403).json({error: "Super admin access required"});
    }

    const generatedAt = new Date().toISOString();
    const findings: any[] = [];
    let findingSequence = 0;
    const addFinding = (finding: Omit<any, "id" | "detectedAt">) => {
      findings.push({
        id: `cleanup-audit-${++findingSequence}`,
        ...finding,
        detectedAt: generatedAt,
      });
    };
    const normalize = (value: unknown) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    const timestampMillis = (value: any) => value?.toMillis?.() || (value ? new Date(value).getTime() : 0);
    const isStale = (value: any) => {
      const millis = timestampMillis(value);
      return millis > 0 && Date.now() - millis > 14 * 24 * 60 * 60 * 1000;
    };
    const docs = (snapshot: admin.firestore.QuerySnapshot) =>
      snapshot.docs.map(document => ({id: document.id, ...document.data()} as any));

    const [orgsSnap, usersSnap, accessRequestsSnap, legacyOrgRefs] = await Promise.all([
      db.collection("orgs").limit(250).get(),
      db.collection("users").limit(1000).get(),
      db.collection("accessRequests").limit(1000).get(),
      db.collection("orgMembers").listDocuments(),
    ]);
    const orgs = docs(orgsSnap);
    const users = docs(usersSnap);
    const accessRequests = docs(accessRequestsSnap);
    const orgIds = new Set(orgs.map(org => org.id));
    const usersById = new Map(users.map(user => [user.id, user]));
    const orgAuditData = new Map<string, any>();

    await Promise.all(orgs.map(async org => {
      const orgRef = db.collection("orgs").doc(org.id);
      const legacyMemberRef = db.collection("orgMembers").doc(org.id);
      const [membersSnap, legacyMembersSnap, invitationsSnap, assessmentsSnap, evidenceSnap, evidenceLibrarySnap] = await Promise.all([
        orgRef.collection("members").limit(500).get(),
        legacyMemberRef.collection("members").limit(500).get(),
        orgRef.collection("invitations").limit(500).get(),
        orgRef.collection("assessments").limit(50).get(),
        orgRef.collection("evidence").limit(1000).get(),
        orgRef.collection("evidenceLibrary").limit(1000).get(),
      ]);
      const members = docs(membersSnap);
      const legacyMembers = docs(legacyMembersSnap);
      const invitations = docs(invitationsSnap);
      const assessments = docs(assessmentsSnap);
      orgAuditData.set(org.id, {members, legacyMembers, invitations, assessments});

      const profile = org.companyProfile || {};
      const primaryEmail = profile.contacts?.primary?.email || org.primaryContactEmail;
      const missingFields = [
        !(org.name || org.orgName || profile.legalName) ? "orgName/companyProfile.legalName" : null,
        !(org.ownerUid || org.owner) ? "ownerUid/owner" : null,
        !org.tier ? "tier" : null,
        !org.status ? "status" : null,
        !primaryEmail ? "primary contact email" : null,
        Object.prototype.hasOwnProperty.call(org, "subscriptionStatus") && !org.subscriptionStatus ? "subscriptionStatus" : null,
      ].filter(Boolean);
      if (missingFields.length) {
        addFinding({
          category: "missing_org_fields", severity: "medium", recommendation: "needs_review",
          title: "Organization is missing critical fields",
          description: `Missing: ${missingFields.join(", ")}.`,
          orgId: org.id,
        });
      }

      const activeMembers = members.filter(member => member.status === "active" || member.active === true);
      if (activeMembers.length === 0) {
        addFinding({
          category: "no_active_members", severity: "high", recommendation: "needs_review",
          title: "Organization has no active members",
          description: members.length === 0 ? "No org-scoped member records exist." : "Member records exist, but none are active.",
          orgId: org.id,
        });
      }

      const memberMap = new Map(members.map(member => [member.id, member]));
      const legacyMemberMap = new Map(legacyMembers.map(member => [member.id, member]));
      for (const member of members) {
        if (!usersById.has(member.id)) {
          addFinding({
            category: "orphaned_membership", severity: "medium", recommendation: "needs_review",
            title: "Membership references missing user",
            description: "Org-scoped membership exists without a matching users document.",
            orgId: org.id, userId: member.id,
          });
        }
        const legacy = legacyMemberMap.get(member.id);
        if (legacy && (legacy.role !== member.role || legacy.status !== member.status)) {
          addFinding({
            category: "orphaned_membership", severity: "medium", recommendation: "needs_review",
            title: "Legacy and current memberships disagree",
            description: "Role or status differs between orgMembers and orgs/{orgId}/members.",
            orgId: org.id, userId: member.id,
          });
        }
      }
      for (const member of legacyMembers) {
        if (!memberMap.has(member.id)) {
          addFinding({
            category: "orphaned_membership", severity: "medium", recommendation: "needs_review",
            title: "Legacy membership has no current membership",
            description: "Legacy orgMembers record has no matching orgs/{orgId}/members record.",
            orgId: org.id, userId: member.id,
          });
        }
      }

      for (const invitation of invitations) {
        const normalizedEmail = normalize(invitation.email);
        const activeMember = members.find(member =>
          (member.id === invitation.acceptedBy || normalize(member.email) === normalizedEmail)
          && (member.status === "active" || member.active === true)
        );
        if (invitation.status === "pending" && isStale(invitation.invitedAt)) {
          addFinding({
            category: "stale_request", severity: "low", recommendation: "safe_to_archive",
            title: "Stale pending invitation",
            description: "Pending organization invitation is older than 14 days.",
            orgId: org.id, relatedIds: [invitation.id],
          });
        }
        if (invitation.status === "accepted" && !activeMember) {
          addFinding({
            category: "invitation_membership_issue", severity: "high", recommendation: "needs_review",
            title: "Accepted invitation has no active membership",
            description: "Invitation is accepted, but no matching active member record was found.",
            orgId: org.id, relatedIds: [invitation.id],
          });
        }
        if (invitation.status === "pending" && activeMember) {
          addFinding({
            category: "invitation_membership_issue", severity: "low", recommendation: "safe_to_archive",
            title: "Pending invitation targets active member",
            description: "The invited email already belongs to an active organization member.",
            orgId: org.id, userId: activeMember.id, relatedIds: [invitation.id],
          });
        }
        if (invitation.status === "pending" && invitation.cancelledAt) {
          addFinding({
            category: "invitation_membership_issue", severity: "low", recommendation: "needs_review",
            title: "Cancelled invitation still appears pending",
            description: "Invitation has cancellation metadata but its status remains pending.",
            orgId: org.id, relatedIds: [invitation.id],
          });
        }
      }

      const inspectEvidence = (items: any[], source: string) => items.forEach(item => {
        const issues = [
          !item.storagePath ? "missing storagePath" : null,
          !item.fileName ? "missing fileName" : null,
          source === "evidence" && !item.orgId ? "missing orgId" : null,
          source === "evidence" && !item.assessmentId ? "missing assessmentId" : null,
          item.archived === true && item.active === true ? "archived evidence is still active" : null,
        ].filter(Boolean);
        if (issues.length) {
          addFinding({
            category: "evidence_metadata_issue", severity: "medium", recommendation: "needs_review",
            title: `${source} metadata issue`,
            description: `Evidence metadata has: ${issues.join(", ")}.`,
            orgId: org.id, relatedIds: [item.id],
          });
        }
      });
      inspectEvidence(docs(evidenceSnap), "evidence");
      inspectEvidence(docs(evidenceLibrarySnap), "evidenceLibrary");

      await Promise.all(assessments.map(async assessment => {
        const assessmentRef = orgRef.collection("assessments").doc(assessment.id);
        const [practicesSnap, objectivesSnap, poamSnap] = await Promise.all([
          assessmentRef.collection("practiceRecords").limit(500).get(),
          assessmentRef.collection("objectiveRecords").limit(1000).get(),
          assessmentRef.collection("poamItems").limit(500).get(),
        ]);
        const practices = docs(practicesSnap);
        if (!assessment.level || !assessment.orgId) {
          addFinding({
            category: "assessment_integrity_issue", severity: "high", recommendation: "needs_review",
            title: "Assessment shell is incomplete",
            description: `Missing: ${[!assessment.level ? "level" : null, !assessment.orgId ? "orgId" : null].filter(Boolean).join(", ")}.`,
            orgId: org.id, relatedIds: [assessment.id],
          });
        }
        if (practices.length === 0) {
          addFinding({
            category: "assessment_integrity_issue", severity: "medium", recommendation: "needs_review",
            title: "Assessment has zero practice records",
            description: "Assessment shell exists but has no practice records.",
            orgId: org.id, relatedIds: [assessment.id],
          });
        }
        practices.filter(practice => !practice.practiceId).forEach(practice => addFinding({
          category: "assessment_integrity_issue", severity: "medium", recommendation: "needs_review",
          title: "Practice record is missing practiceId", description: "Practice document does not contain practiceId.",
          orgId: org.id, relatedIds: [assessment.id, practice.id],
        }));
        docs(objectivesSnap).filter(objective => !objective.objectiveId || !objective.practiceId).forEach(objective => addFinding({
          category: "assessment_integrity_issue", severity: "medium", recommendation: "needs_review",
          title: "Objective record is incomplete", description: "Objective document is missing objectiveId or practiceId.",
          orgId: org.id, relatedIds: [assessment.id, objective.id],
        }));
        docs(poamSnap).filter(item => (!Array.isArray(item.relatedPracticeIds) || item.relatedPracticeIds.length === 0) && !item.practiceId).forEach(item => addFinding({
          category: "assessment_integrity_issue", severity: "medium", recommendation: "needs_review",
          title: "POA&M item has no related practice", description: "POA&M item is not linked to a practice.",
          orgId: org.id, relatedIds: [assessment.id, item.id],
        }));
      }));
    }));

    const duplicateKeys = new Map<string, any[]>();
    for (const org of orgs) {
      const profile = org.companyProfile || {};
      const values = [
        ["name", org.name || org.orgName || profile.legalName],
        ["email", profile.contacts?.primary?.email || org.primaryContactEmail || org.ownerEmail],
        ["cage", profile.cageCode || org.cageCode],
        ["uei", profile.uei || org.uei],
      ];
      values.forEach(([kind, value]) => {
        const normalized = normalize(value);
        if (!normalized) return;
        const key = `${kind}:${normalized}`;
        duplicateKeys.set(key, [...(duplicateKeys.get(key) || []), org]);
      });
    }
    for (const [reason, matchedOrgs] of duplicateKeys) {
      if (matchedOrgs.length < 2) continue;
      const relatedIds = matchedOrgs.map(org => org.id);
      matchedOrgs.forEach(org => addFinding({
        category: "duplicate_org", severity: "high", recommendation: "do_not_touch",
        title: "Likely duplicate organization",
        description: `Multiple organizations share normalized ${reason.split(":")[0]}. Review owner, tier, status, and createdAt before any cleanup.`,
        orgId: org.id, relatedIds,
      }));
    }

    const orgById = new Map(orgs.map(org => [org.id, org]));
    for (const user of users) {
      const isSuperAdmin = user.roles?.superAdmin === true;
      if (user.orgId && !orgIds.has(user.orgId)) {
        addFinding({
          category: "orphaned_user", severity: "high", recommendation: "needs_review",
          title: "User references missing organization", description: "User orgId does not match an existing organization.",
          orgId: user.orgId, userId: user.id,
        });
      } else if (!user.orgId && !isSuperAdmin) {
        addFinding({
          category: "orphaned_user", severity: "medium", recommendation: "needs_review",
          title: "User has no organization", description: "Non-SuperAdmin user does not have an orgId.",
          userId: user.id,
        });
      } else if (user.orgId && ["inactive", "deleted", "disabled"].includes(orgById.get(user.orgId)?.status)) {
        addFinding({
          category: "orphaned_user", severity: "high", recommendation: "needs_review",
          title: "User references inactive organization", description: "User orgId points to an organization marked inactive, deleted, or disabled.",
          orgId: user.orgId, userId: user.id,
        });
      } else if (user.orgId && orgIds.has(user.orgId)) {
        const members = orgAuditData.get(user.orgId)?.members || [];
        if (!members.some((member: any) => member.id === user.id)) {
          addFinding({
            category: "orphaned_user", severity: "medium", recommendation: "needs_review",
            title: "User has no matching org membership", description: "User references an organization but lacks an org-scoped membership.",
            orgId: user.orgId, userId: user.id,
          });
        }
      }
    }

    const pendingRequestKeys = new Map<string, any[]>();
    for (const request of accessRequests.filter(request => request.status === "pending")) {
      if (isStale(request.createdAt)) {
        addFinding({
          category: "stale_request", severity: "low", recommendation: "safe_to_archive",
          title: "Stale pending access request", description: "Pending access request is older than 14 days.",
          orgId: request.orgId, userId: request.requestedByUid, relatedIds: [request.id],
        });
      }
      const key = `${request.type || "unknown"}:${request.orgId || normalize(request.orgName)}:${normalize(request.email || request.ownerEmail)}`;
      pendingRequestKeys.set(key, [...(pendingRequestKeys.get(key) || []), request]);
    }
    for (const requests of pendingRequestKeys.values()) {
      if (requests.length < 2) continue;
      addFinding({
        category: "stale_request", severity: "medium", recommendation: "needs_review",
        title: "Duplicate pending access requests", description: "Multiple pending requests have the same type, organization, and email.",
        orgId: requests[0].orgId, relatedIds: requests.map(request => request.id),
      });
    }

    for (const legacyRef of legacyOrgRefs) {
      if (orgIds.has(legacyRef.id)) continue;
      const legacyMembers = docs(await legacyRef.collection("members").limit(500).get());
      legacyMembers.forEach(member => addFinding({
        category: "orphaned_membership", severity: "high", recommendation: "needs_review",
        title: "Legacy membership references missing organization",
        description: "Legacy orgMembers parent has no matching organization.",
        orgId: legacyRef.id, userId: member.id,
      }));
    }

    return res.json({
      generatedAt,
      totalFindings: findings.length,
      highCount: findings.filter(finding => finding.severity === "high").length,
      mediumCount: findings.filter(finding => finding.severity === "medium").length,
      lowCount: findings.filter(finding => finding.severity === "low").length,
      safeToArchiveCount: findings.filter(finding => finding.recommendation === "safe_to_archive").length,
      needsReviewCount: findings.filter(finding => finding.recommendation === "needs_review").length,
      doNotTouchCount: findings.filter(finding => finding.recommendation === "do_not_touch").length,
      findings,
    });
  } catch (error) {
    console.error("[cleanup-audit] audit failed", error);
    return res.status(500).json({error: "Cleanup audit failed"});
  }
});

const CLEANUP_ORG_STATUSES = new Set(["active", "inactive", "archived"]);
const CLEANUP_TIERS = new Set(["SPONSORED", "COMM_L1", "COMM_L2"]);
const CLEANUP_SUBSCRIPTION_STATUSES = new Set(["active", "trial", "expired", "cancelled"]);
const CLEANUP_BILLING_CYCLES = new Set(["monthly", "annual", "sponsored", "manual"]);
const CLEANUP_MEMBER_STATUSES = new Set(["active", "inactive", "disabled"]);
const CLEANUP_MEMBER_ROLES = new Set(["orgOwner", "orgAdmin", "contributor", "viewer", "assessor"]);
const PROTECTED_CLEANUP_ORGS = new Set(["cyber_blue_star"]);
const PHASE_23C_DUPLICATE_ORGS = new Set([
  "org_bruce_inc",
  "org_bruce_inc_8e0i",
  "org_bruce_inc_99oz",
  "org_bruce_inc_e05f",
  "org_bruce_inc_fpmg",
  "org_bruce_inc_rz2f",
  "org_bruce_inc_whji",
  "org_bruce_inc_wnrv",
]);

function cleanupActivityRef() {
  return db.collection("system").doc("cleanupActivity").collection("entries").doc();
}

function cleanupNote(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 500) : "";
}

function cleanupDate(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") throw new Error("Invalid cleanup date");
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error("Invalid cleanup date");
  return admin.firestore.Timestamp.fromDate(parsed);
}

function pickCleanupFields(data: Record<string, any> | undefined, fields: string[]) {
  return Object.fromEntries(fields.map((field) => [field, data?.[field] ?? null]));
}

function addCleanupActivity(
  batch: admin.firestore.WriteBatch,
  params: {
    action: string;
    targetType: "org" | "member" | "user" | "accessRequest" | "invitation" | "addUserRequest" | "upgradeRequest";
    targetId: string;
    performedBy: string;
    orgId?: string;
    userId?: string;
    before?: Record<string, any>;
    after?: Record<string, any>;
    note?: string;
    cleanupPhase?: string;
  }
) {
  const ref = cleanupActivityRef();
  const {cleanupPhase, ...activity} = params;
  batch.set(ref, {
    id: ref.id,
    type: "cleanup_control_action",
    ...activity,
    ...(cleanupPhase ? {cleanupPhase} : {}),
    performedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

function cleanupDoc(snapshot: admin.firestore.DocumentSnapshot) {
  return {id: snapshot.id, ...snapshot.data()};
}

function cleanupDocs(snapshot: admin.firestore.QuerySnapshot) {
  return snapshot.docs.map(cleanupDoc);
}

function cleanupOrgName(org: Record<string, any>) {
  return String(org.orgName || org.companyProfile?.legalName || org.name || org.id || "Unnamed organization");
}

function cleanupNormalized(value: unknown) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function cleanupTimestampMillis(value: any) {
  return value?.toMillis?.() || value?._seconds * 1000 || (value ? new Date(value).getTime() : 0);
}

function isCleanupStale(value: any) {
  const millis = cleanupTimestampMillis(value);
  return millis > 0 && Date.now() - millis > 14 * 24 * 60 * 60 * 1000;
}

function isValidCleanupEmail(value: unknown) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

async function getOrgSafeDeleteMetadata(orgId: string, accessRequests?: any[]) {
  const orgRef = db.collection("orgs").doc(orgId);
  const [membersSnap, legacyMembersSnap, usersSnap, assessmentsSnap, evidenceSnap, evidenceLibrarySnap, invitationsSnap, requestSnap] = await Promise.all([
    orgRef.collection("members").limit(500).get(),
    db.collection("orgMembers").doc(orgId).collection("members").limit(500).get(),
    db.collection("users").where("orgId", "==", orgId).limit(500).get(),
    orgRef.collection("assessments").limit(500).get(),
    orgRef.collection("evidence").limit(1000).get(),
    orgRef.collection("evidenceLibrary").limit(1000).get(),
    orgRef.collection("invitations").limit(500).get(),
    accessRequests ? Promise.resolve(null) : db.collection("accessRequests").where("orgId", "==", orgId).limit(1000).get(),
  ]);
  const requests = accessRequests || cleanupDocs(requestSnap as admin.firestore.QuerySnapshot);
  const pendingRequests = requests.filter((request: any) => request.orgId === orgId && request.status === "pending");
  const activeMemberCount = cleanupDocs(membersSnap).filter((member: any) => member.active === true || member.status === "active").length;
  const pendingInvitationCount = cleanupDocs(invitationsSnap).filter((invitation: any) => invitation.status === "pending").length;
  const pendingAddUserCount = pendingRequests.filter((request: any) => request.type === "addUser").length;
  const pendingUpgradeCount = pendingRequests.filter((request: any) => request.type === "upgradeRequest").length;
  const blockers: string[] = [];
  if (PROTECTED_CLEANUP_ORGS.has(orgId)) blockers.push("protected organization");
  if (activeMemberCount) blockers.push(`${activeMemberCount} active member${activeMemberCount === 1 ? "" : "s"}`);
  if (membersSnap.size) blockers.push(`${membersSnap.size} member record${membersSnap.size === 1 ? "" : "s"}`);
  if (legacyMembersSnap.size) blockers.push(`${legacyMembersSnap.size} legacy member record${legacyMembersSnap.size === 1 ? "" : "s"}`);
  if (usersSnap.size) blockers.push(`${usersSnap.size} linked user record${usersSnap.size === 1 ? "" : "s"}`);
  if (assessmentsSnap.size) blockers.push(`${assessmentsSnap.size} assessment${assessmentsSnap.size === 1 ? "" : "s"}`);
  if (evidenceSnap.size) blockers.push(`${evidenceSnap.size} evidence record${evidenceSnap.size === 1 ? "" : "s"}`);
  if (evidenceLibrarySnap.size) blockers.push(`${evidenceLibrarySnap.size} evidence library record${evidenceLibrarySnap.size === 1 ? "" : "s"}`);
  if (pendingInvitationCount) blockers.push(`${pendingInvitationCount} pending invitation${pendingInvitationCount === 1 ? "" : "s"}`);
  if (pendingRequests.length) blockers.push(`${pendingRequests.length} pending access request${pendingRequests.length === 1 ? "" : "s"}`);
  if (pendingAddUserCount) blockers.push(`${pendingAddUserCount} pending add-user request${pendingAddUserCount === 1 ? "" : "s"}`);
  if (pendingUpgradeCount) blockers.push(`${pendingUpgradeCount} pending upgrade${pendingUpgradeCount === 1 ? "" : "s"}`);
  const subcollections = await orgRef.listCollections();
  const nonEmptySubcollections = (await Promise.all(subcollections.map(async collectionRef => ({
    id: collectionRef.id,
    hasDocuments: !(await collectionRef.limit(1).get()).empty,
  })))).filter(collection => collection.hasDocuments).map(collection => collection.id);
  for (const collectionId of nonEmptySubcollections) {
    if (!["members", "assessments", "evidence", "evidenceLibrary", "invitations"].includes(collectionId)) {
      blockers.push(`related ${collectionId} records`);
    }
  }
  return {
    activeMemberCount,
    memberCount: membersSnap.size,
    assessmentCount: assessmentsSnap.size,
    evidenceCount: evidenceSnap.size,
    evidenceLibraryCount: evidenceLibrarySnap.size,
    pendingInvitationCount,
    pendingAccessRequestCount: pendingRequests.length,
    pendingAddUserCount,
    pendingUpgradeCount,
    safeDeleteEligible: blockers.length === 0,
    safeDeleteBlockers: blockers,
  };
}

app.get("/api/admin/cleanup-controls", requireAuth, async (req: any, res) => {
  try {
    if (!(await isSuperAdminUser(req.user.uid))) {
      res.status(403).json({success: false, errorMessage: "SuperAdmin access required"});
      return;
    }

    const [orgsSnap, usersSnap, accessRequestsSnap] = await Promise.all([
      db.collection("orgs").limit(250).get(),
      db.collection("users").limit(1000).get(),
      db.collection("accessRequests").limit(1000).get(),
    ]);
    const users = cleanupDocs(usersSnap) as any[];
    const orgIds = new Set(orgsSnap.docs.map(org => org.id));

    const orgs: any[] = await Promise.all(orgsSnap.docs.map(async (orgDoc) => {
      const [membersSnap, legacyMembersSnap, invitationsSnap, assessmentsSnap, evidenceSnap, evidenceLibrarySnap] = await Promise.all([
        orgDoc.ref.collection("members").limit(500).get(),
        db.collection("orgMembers").doc(orgDoc.id).collection("members").limit(500).get(),
        orgDoc.ref.collection("invitations").limit(500).get(),
        orgDoc.ref.collection("assessments").limit(250).get(),
        orgDoc.ref.collection("evidence").limit(1000).get(),
        orgDoc.ref.collection("evidenceLibrary").limit(1000).get(),
      ]);
      const data = orgDoc.data();
      const safeDelete = await getOrgSafeDeleteMetadata(orgDoc.id, cleanupDocs(accessRequestsSnap));
      const evidenceIssues = [...cleanupDocs(evidenceSnap), ...cleanupDocs(evidenceLibrarySnap)]
        .filter((item: any) => !item.storagePath)
        .map((item: any) => ({id: item.id, fileName: item.fileName || "", issue: "Needs manual evidence review: missing storagePath"}));
      const assessmentWarnings = (await Promise.all(assessmentsSnap.docs.map(async assessmentDoc => {
        const practiceSnap = await assessmentDoc.ref.collection("practiceRecords").limit(1).get();
        return practiceSnap.empty ? {id: assessmentDoc.id, issue: "Assessment shell has zero practice records. Review manually; no cleanup action is provided."} : null;
      }))).filter(Boolean);
      return {
        id: orgDoc.id,
        ...data,
        name: cleanupOrgName({id: orgDoc.id, ...data}),
        members: cleanupDocs(membersSnap),
        legacyMembers: cleanupDocs(legacyMembersSnap),
        invitations: cleanupDocs(invitationsSnap),
        evidenceIssues,
        assessmentWarnings,
        ...safeDelete,
      };
    }));

    const duplicateBuckets = new Map<string, any[]>();
    for (const org of orgs) {
      const keys = [
        ["name", cleanupNormalized(org.name)],
        ["contact", cleanupNormalized(org.companyProfile?.contacts?.primary?.email || org.ownerEmail)],
        ["cage", cleanupNormalized(org.companyProfile?.cageCode)],
        ["uei", cleanupNormalized(org.companyProfile?.uei)],
      ];
      for (const [field, value] of keys) {
        if (!value) continue;
        const key = `${field}:${value}`;
        duplicateBuckets.set(key, [...(duplicateBuckets.get(key) || []), org]);
      }
    }
    const duplicateGroups = [...duplicateBuckets.entries()]
      .filter(([, bucket]) => bucket.length > 1)
      .map(([id, bucket]) => ({
        id,
        reason: `Matching normalized ${id.split(":")[0]}`,
        orgs: bucket,
      }));
    const memberOrgIds = new Map<string, Set<string>>();
    for (const org of orgs) {
      for (const member of org.members) {
        const current = memberOrgIds.get(member.id) || new Set<string>();
        current.add(org.id);
        memberOrgIds.set(member.id, current);
      }
    }
    const orphanUsers = users.filter(user => {
      if (user.roles?.superAdmin === true) return false;
      if (!user.orgId || !orgIds.has(user.orgId)) return true;
      return !memberOrgIds.get(user.id)?.has(user.orgId);
    });

    res.json({
      success: true,
      inventory: {
        generatedAt: new Date().toISOString(),
        orgs,
        accessRequests: cleanupDocs(accessRequestsSnap),
        duplicateGroups,
        orphanUsers,
        protectedOrgIds: [...PROTECTED_CLEANUP_ORGS],
        phase23cDuplicateOrgIds: [...PHASE_23C_DUPLICATE_ORGS],
      },
    });
  } catch (error) {
    console.error("Cleanup controls inventory failed", error);
    res.status(500).json({success: false, errorMessage: "Unable to load cleanup controls"});
  }
});

app.post("/api/admin/cleanup-control", requireAuth, async (req: any, res) => {
  try {
    const performedBy = req.user.uid;
    if (!(await isSuperAdminUser(performedBy))) {
      res.status(403).json({success: false, errorMessage: "SuperAdmin access required"});
      return;
    }

    const {action, orgId, targetId, userId, updates = {}, note, cleanupPhase} = req.body || {};
    const reviewedNote = cleanupNote(note);
    const activityPhase = ["23C", "23C-UI"].includes(cleanupPhase) ? cleanupPhase : undefined;
    const now = admin.firestore.FieldValue.serverTimestamp();

    if (action === "update_org_status") {
      if (!orgId || !CLEANUP_ORG_STATUSES.has(updates.status)) throw new Error("Invalid organization status update");
      if (PROTECTED_CLEANUP_ORGS.has(orgId) && updates.status !== "active") throw new Error("Protected organization must remain active");
      const ref = db.collection("orgs").doc(orgId);
      const snapshot = await ref.get();
      if (!snapshot.exists) throw new Error("Organization not found");
      const after = {
        status: updates.status,
        cleanupNote: reviewedNote,
        cleanupReviewedAt: now,
        cleanupReviewedBy: performedBy,
        updatedAt: now,
      };
      const batch = db.batch();
      batch.set(ref, after, {merge: true});
      addCleanupActivity(batch, {
        action,
        targetType: "org",
        targetId: orgId,
        orgId,
        performedBy,
        before: pickCleanupFields(snapshot.data(), ["status", "cleanupNote"]),
        after,
        note: reviewedNote,
        cleanupPhase: activityPhase,
      });
      await batch.commit();
    } else if (action === "update_org_subscription") {
      if (!orgId) throw new Error("Organization is required");
      if (!CLEANUP_TIERS.has(updates.tier)) throw new Error("Invalid organization tier");
      if (!CLEANUP_SUBSCRIPTION_STATUSES.has(updates.subscriptionStatus)) throw new Error("Invalid subscription status");
      if (!CLEANUP_BILLING_CYCLES.has(updates.billingCycle)) throw new Error("Invalid billing cycle");
      const ref = db.collection("orgs").doc(orgId);
      const snapshot = await ref.get();
      if (!snapshot.exists) throw new Error("Organization not found");
      const after = {
        tier: updates.tier,
        subscriptionStatus: updates.subscriptionStatus,
        subscriptionStart: cleanupDate(updates.subscriptionStart),
        subscriptionEnd: cleanupDate(updates.subscriptionEnd),
        billingCycle: updates.billingCycle,
        cleanupReviewedAt: now,
        cleanupReviewedBy: performedBy,
        updatedAt: now,
      };
      const batch = db.batch();
      batch.set(ref, after, {merge: true});
      addCleanupActivity(batch, {
        action,
        targetType: "org",
        targetId: orgId,
        orgId,
        performedBy,
        before: pickCleanupFields(snapshot.data(), ["tier", "subscriptionStatus", "subscriptionStart", "subscriptionEnd", "billingCycle"]),
        after,
      });
      await batch.commit();
    } else if (action === "update_member") {
      if (!orgId || !userId) throw new Error("Organization and member are required");
      if (!CLEANUP_MEMBER_STATUSES.has(updates.status)) throw new Error("Invalid member status");
      if (!CLEANUP_MEMBER_ROLES.has(updates.role)) throw new Error("Invalid member role");
      if (typeof updates.active !== "boolean") throw new Error("Invalid active state");
      const memberRef = db.collection("orgs").doc(orgId).collection("members").doc(userId);
      const userRef = db.collection("users").doc(userId);
      const [memberSnapshot, userSnapshot] = await Promise.all([memberRef.get(), userRef.get()]);
      if (!memberSnapshot.exists) throw new Error("Member not found");
      if (userSnapshot.data()?.roles?.superAdmin === true && (updates.status !== "active" || updates.active !== true)) {
        throw new Error("SuperAdmin users cannot be disabled or marked inactive");
      }
      if (userSnapshot.data()?.roles?.superAdmin === true && updates.role !== memberSnapshot.data()?.role) {
        throw new Error("SuperAdmin membership roles cannot be changed by cleanup controls");
      }
      const after = {
        status: updates.status,
        active: updates.active,
        role: updates.role,
        cleanupNote: reviewedNote,
        cleanupReviewedAt: now,
        cleanupReviewedBy: performedBy,
        updatedAt: now,
      };
      const batch = db.batch();
      batch.set(memberRef, after, {merge: true});
      const userData = userSnapshot.data();
      if (userSnapshot.exists && (!userData?.orgId || userData.orgId === orgId)) {
        batch.set(userRef, {
          orgId,
          status: updates.status,
          roles: {...(userData?.roles || {}), orgRole: updates.role},
          updatedAt: now,
        }, {merge: true});
      }
      addCleanupActivity(batch, {
        action,
        targetType: "member",
        targetId: userId,
        orgId,
        userId,
        performedBy,
        before: pickCleanupFields(memberSnapshot.data(), ["status", "active", "role"]),
        after,
        note: reviewedNote,
        cleanupPhase: activityPhase,
      });
      await batch.commit();
    } else if (action === "archive_access_request") {
      if (!targetId) throw new Error("Access request is required");
      const ref = db.collection("accessRequests").doc(targetId);
      const snapshot = await ref.get();
      if (!snapshot.exists) throw new Error("Access request not found");
      if (activityPhase === "23C" && (snapshot.data()?.status !== "pending" || !isCleanupStale(snapshot.data()?.createdAt))) {
        throw new Error("Phase 23C only archives stale pending access requests");
      }
      const after = {status: "archived", archivedAt: now, archivedBy: performedBy, cleanupReason: reviewedNote};
      const batch = db.batch();
      batch.set(ref, after, {merge: true});
      addCleanupActivity(batch, {
        action,
        targetType: "accessRequest",
        targetId,
        orgId: snapshot.data()?.orgId,
        userId: snapshot.data()?.uid,
        performedBy,
        before: pickCleanupFields(snapshot.data(), ["status"]),
        after,
        note: reviewedNote,
        cleanupPhase: activityPhase,
      });
      await batch.commit();
    } else if (action === "cancel_invitation") {
      if (!orgId || !targetId) throw new Error("Organization and invitation are required");
      const ref = db.collection("orgs").doc(orgId).collection("invitations").doc(targetId);
      const snapshot = await ref.get();
      if (!snapshot.exists) throw new Error("Invitation not found");
      if (snapshot.data()?.status !== "pending") throw new Error("Only pending invitations can be cancelled");
      const after = {status: "cancelled", cancelledAt: now, cancelledBy: performedBy};
      const batch = db.batch();
      batch.set(ref, after, {merge: true});
      addCleanupActivity(batch, {
        action,
        targetType: "invitation",
        targetId,
        orgId,
        performedBy,
        before: pickCleanupFields(snapshot.data(), ["status"]),
        after,
        cleanupPhase: activityPhase,
      });
      await batch.commit();
    } else if (action === "disable_orphan_user") {
      if (!userId || !CLEANUP_MEMBER_STATUSES.has(updates.status) || updates.status === "active") throw new Error("Invalid orphan user status");
      const ref = db.collection("users").doc(userId);
      const snapshot = await ref.get();
      if (!snapshot.exists) throw new Error("User not found");
      if (snapshot.data()?.roles?.superAdmin === true) throw new Error("SuperAdmin users cannot be disabled or marked inactive");
      const existingOrgId = snapshot.data()?.orgId;
      const [orgSnapshot, memberSnapshot] = existingOrgId
        ? await Promise.all([
          db.collection("orgs").doc(existingOrgId).get(),
          db.collection("orgs").doc(existingOrgId).collection("members").doc(userId).get(),
        ])
        : [null, null];
      if (existingOrgId && orgSnapshot?.exists && memberSnapshot?.exists) throw new Error("User is not orphaned");
      const after = {
        status: updates.status,
        cleanupNote: reviewedNote,
        cleanupReviewedAt: now,
        cleanupReviewedBy: performedBy,
        updatedAt: now,
      };
      const batch = db.batch();
      batch.set(ref, after, {merge: true});
      addCleanupActivity(batch, {
        action,
        targetType: "user",
        targetId: userId,
        userId,
        orgId: snapshot.data()?.orgId,
        performedBy,
        before: pickCleanupFields(snapshot.data(), ["status", "cleanupNote"]),
        after,
        note: reviewedNote,
        cleanupPhase: activityPhase,
      });
      await batch.commit();
    } else if (action === "repair_org_fields") {
      if (!orgId) throw new Error("Organization is required");
      if (!CLEANUP_ORG_STATUSES.has(updates.status)) throw new Error("Invalid organization status");
      if (!CLEANUP_TIERS.has(updates.tier)) throw new Error("Invalid organization tier");
      if (!CLEANUP_SUBSCRIPTION_STATUSES.has(updates.subscriptionStatus)) throw new Error("Invalid subscription status");
      if (!isValidCleanupEmail(updates.primaryContactEmail)) throw new Error("Valid primary contact email is required");
      if (typeof updates.legalName !== "string" || !updates.legalName.trim()) throw new Error("Legal name is required");
      if (PROTECTED_CLEANUP_ORGS.has(orgId) && updates.status !== "active") throw new Error("Protected organization must remain active");
      const ref = db.collection("orgs").doc(orgId);
      const snapshot = await ref.get();
      if (!snapshot.exists) throw new Error("Organization not found");
      const after = {
        status: updates.status,
        tier: updates.tier,
        subscriptionStatus: updates.subscriptionStatus,
        primaryContactEmail: updates.primaryContactEmail.trim(),
        "companyProfile.legalName": updates.legalName.trim(),
        "companyProfile.contacts.primary.email": updates.primaryContactEmail.trim(),
        cleanupNote: reviewedNote,
        cleanupReviewedAt: now,
        cleanupReviewedBy: performedBy,
        updatedAt: now,
      };
      const batch = db.batch();
      batch.update(ref, after);
      addCleanupActivity(batch, {
        action,
        targetType: "org",
        targetId: orgId,
        orgId,
        performedBy,
        before: pickCleanupFields(snapshot.data(), ["status", "tier", "subscriptionStatus", "primaryContactEmail", "companyProfile"]),
        after,
        note: reviewedNote,
        cleanupPhase: activityPhase,
      });
      await batch.commit();
    } else if (action === "update_org_admin_fields") {
      if (!orgId) throw new Error("Organization is required");
      if (!CLEANUP_ORG_STATUSES.has(updates.status)) throw new Error("Invalid organization status");
      if (!CLEANUP_TIERS.has(updates.tier)) throw new Error("Invalid organization tier");
      if (PROTECTED_CLEANUP_ORGS.has(orgId) && updates.status !== "active") throw new Error("Protected organization must remain active");
      const ref = db.collection("orgs").doc(orgId);
      const snapshot = await ref.get();
      if (!snapshot.exists) throw new Error("Organization not found");
      const after: Record<string, any> = {
        status: updates.status,
        tier: updates.tier,
        cleanupReviewedAt: now,
        cleanupReviewedBy: performedBy,
        updatedAt: now,
      };
      if (updates.subscriptionStatus !== undefined) {
        if (!CLEANUP_SUBSCRIPTION_STATUSES.has(updates.subscriptionStatus)) throw new Error("Invalid subscription status");
        after.subscriptionStatus = updates.subscriptionStatus;
      }
      if (updates.subscriptionStartDate !== undefined) after.subscriptionStartDate = cleanupDate(updates.subscriptionStartDate);
      if (updates.subscriptionEndDate !== undefined) after.subscriptionEndDate = cleanupDate(updates.subscriptionEndDate);
      const batch = db.batch();
      batch.set(ref, after, {merge: true});
      addCleanupActivity(batch, {
        action,
        targetType: "org",
        targetId: orgId,
        orgId,
        performedBy,
        before: pickCleanupFields(snapshot.data(), ["status", "tier", "subscriptionStatus", "subscriptionStartDate", "subscriptionEndDate"]),
        after,
        cleanupPhase: activityPhase,
      });
      await batch.commit();
    } else if (action === "archive_org_from_table") {
      if (!orgId) throw new Error("Organization is required");
      if (PROTECTED_CLEANUP_ORGS.has(orgId)) throw new Error("Protected organization cannot be archived");
      const ref = db.collection("orgs").doc(orgId);
      const snapshot = await ref.get();
      if (!snapshot.exists) throw new Error("Organization not found");
      const after = {
        status: "archived",
        cleanupNote: "Archived from Super Admin Orgs table",
        cleanupReviewedAt: now,
        cleanupReviewedBy: performedBy,
        updatedAt: now,
      };
      const batch = db.batch();
      batch.set(ref, after, {merge: true});
      addCleanupActivity(batch, {
        action,
        targetType: "org",
        targetId: orgId,
        orgId,
        performedBy,
        before: pickCleanupFields(snapshot.data(), ["status", "cleanupNote"]),
        after,
        note: after.cleanupNote,
        cleanupPhase: activityPhase,
      });
      await batch.commit();
    } else if (action === "safe_delete_empty_org") {
      if (!orgId || updates.confirmation !== `DELETE ${orgId}`) throw new Error("Typed organization delete confirmation is required");
      if (PROTECTED_CLEANUP_ORGS.has(orgId)) throw new Error("Protected organization cannot be deleted");
      const ref = db.collection("orgs").doc(orgId);
      const snapshot = await ref.get();
      if (!snapshot.exists) throw new Error("Organization not found");
      const safeDelete = await getOrgSafeDeleteMetadata(orgId);
      if (!safeDelete.safeDeleteEligible) throw new Error(`Delete unavailable: ${safeDelete.safeDeleteBlockers.join(", ")}. Archive instead.`);
      const batch = db.batch();
      addCleanupActivity(batch, {
        action,
        targetType: "org",
        targetId: orgId,
        orgId,
        performedBy,
        before: snapshot.data(),
        after: {deleted: true},
        cleanupPhase: activityPhase,
      });
      batch.delete(ref);
      await batch.commit();
    } else {
      throw new Error("Unsupported cleanup control action");
    }

    res.json({success: true});
  } catch (error) {
    console.error("Cleanup control action failed", error);
    res.status(400).json({
      success: false,
      errorMessage: error instanceof Error ? error.message : "Unable to complete cleanup action",
    });
  }
});

const ORG_MEMBER_ROLES = new Set(["orgOwner", "orgAdmin", "contributor", "viewer", "assessor"]);
const ORG_ADMIN_MEMBER_ROLES = new Set(["orgAdmin", "contributor", "viewer", "assessor"]);

async function getOrgUserManager(uid: string, orgId: string) {
  const [userSnap, orgSnap, memberSnap] = await Promise.all([
    db.doc(`users/${uid}`).get(),
    db.doc(`orgs/${orgId}`).get(),
    db.doc(`orgs/${orgId}/members/${uid}`).get(),
  ]);
  const user = userSnap.data();
  const member = memberSnap.data();
  const superAdmin = userSnap.exists && user?.status === "active" && user?.roles?.superAdmin === true;
  const orgAdmin = userSnap.exists
    && user?.status === "active"
    && user?.orgId === orgId
    && orgSnap.exists
    && orgSnap.data()?.status === "active"
    && memberSnap.exists
    && member?.status === "active"
    && member?.active === true
    && ["orgOwner", "orgAdmin"].includes(member?.role);
  return {allowed: superAdmin || orgAdmin, superAdmin, orgAdmin, org: orgSnap.data()};
}

app.get("/api/org/users", requireAuth, async (req: any, res) => {
  const orgId = typeof req.query?.orgId === "string" ? req.query.orgId.trim() : "";
  if (!isSafePathSegment(orgId)) return res.status(400).json({success: false, errorMessage: "Valid orgId is required"});
  try {
    const manager = await getOrgUserManager(req.user.uid, orgId);
    if (!manager.allowed) return res.status(403).json({success: false, errorMessage: "Organization user management access required"});
    const memberSnap = await db.collection("orgs").doc(orgId).collection("members").limit(500).get();
    const users = await Promise.all(memberSnap.docs.map(async memberDoc => {
      const userSnap = await db.doc(`users/${memberDoc.id}`).get();
      const user = userSnap.data() || {};
      const member = memberDoc.data() || {};
      const email = user.email || member.email || "";
      const displayName = user.displayName || user.fullName || member.displayName || member.fullName || email || memberDoc.id;
      return {
        uid: memberDoc.id,
        ...user,
        email,
        displayName,
        fullName: user.fullName || member.fullName || displayName,
        phone: user.phone || member.phone || "",
        membership: {id: memberDoc.id, ...member},
        isSuperAdmin: user.roles?.superAdmin === true,
      };
    }));
    return res.json({success: true, users, canManageOrgOwner: manager.superAdmin});
  } catch (error) {
    console.error("Organization users load failed", error);
    return res.status(500).json({success: false, errorMessage: "Unable to load organization users"});
  }
});

const PENDING_REQUEST_MEMBER_ROLES = new Set(["orgAdmin", "contributor", "viewer", "assessor"]);

async function findAuthUserByEmail(email: string) {
  try {
    return await admin.auth().getUserByEmail(email);
  } catch (error: any) {
    if (error?.code === "auth/user-not-found") return null;
    throw error;
  }
}

async function inviterDisplay(invitedBy: unknown) {
  const uid = typeof invitedBy === "string" ? invitedBy : "";
  if (!uid) return {invitedByUid: "", invitedByName: "", invitedByEmail: "", invitedByDisplay: "Not provided"};
  const user = (await db.doc(`users/${uid}`).get()).data() || {};
  const invitedByName = user.displayName || user.fullName || "";
  const invitedByEmail = user.email || "";
  return {
    invitedByUid: uid,
    invitedByName,
    invitedByEmail,
    invitedByDisplay: invitedByName || invitedByEmail || uid,
  };
}

function normalizePendingEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function validatePendingRole(value: unknown) {
  if (typeof value !== "string" || !PENDING_REQUEST_MEMBER_ROLES.has(value)) {
    throw new Error("Invalid requested role");
  }
  return value;
}

app.get("/api/org/invitation-inviters", requireAuth, async (req: any, res) => {
  try {
    const orgId = typeof req.query?.orgId === "string" ? req.query.orgId.trim() : "";
    if (!isSafePathSegment(orgId)) throw new Error("Organization is required");
    const manager = await getOrgUserManager(req.user.uid, orgId);
    if (!manager.allowed) return res.status(403).json({success: false, errorMessage: "Organization invitation access required"});
    const invitations = await db.doc(`orgs/${orgId}`).collection("invitations").limit(500).get();
    const displays = Object.fromEntries(await Promise.all(invitations.docs.map(async invitation => {
      const display = await inviterDisplay(invitation.data().invitedBy);
      return [invitation.id, display];
    })));
    return res.json({success: true, displays});
  } catch (error) {
    console.error("Invitation inviter display load failed", error);
    return res.status(400).json({success: false, errorMessage: error instanceof Error ? error.message : "Unable to load invitation inviter details"});
  }
});

async function activatePendingMember(params: {
  orgId: string;
  uid: string;
  email: string;
  displayName: string;
  role: string;
  performedBy: string;
  batch: admin.firestore.WriteBatch;
  invitationId?: string;
}) {
  const {orgId, uid, email, displayName, role, batch, invitationId} = params;
  const memberRef = db.doc(`orgs/${orgId}/members/${uid}`);
  const userRef = db.doc(`users/${uid}`);
  const [memberSnap, userSnap] = await Promise.all([memberRef.get(), userRef.get()]);
  if (userSnap.data()?.roles?.superAdmin === true) throw new Error("SuperAdmin accounts cannot be activated through invitations");
  if (userSnap.data()?.orgId && userSnap.data()?.orgId !== orgId) throw new Error("User already belongs to another organization");
  const now = admin.firestore.FieldValue.serverTimestamp();
  batch.set(memberRef, {
    uid,
    displayName: displayName || email,
    fullName: displayName || email,
    email,
    phone: memberSnap.data()?.phone || userSnap.data()?.phone || "",
    role,
    status: "active",
    active: true,
    superAdmin: false,
    ...(invitationId ? {invitationId} : {}),
    joinedAt: memberSnap.data()?.joinedAt || now,
    createdAt: memberSnap.data()?.createdAt || now,
    updatedAt: now,
  }, {merge: true});
  batch.set(userRef, {
    uid,
    displayName: userSnap.data()?.displayName || displayName || email,
    fullName: userSnap.data()?.fullName || displayName || email,
    email,
    phone: userSnap.data()?.phone || memberSnap.data()?.phone || "",
    orgId,
    status: "active",
    roles: {...(userSnap.data()?.roles || {}), orgRole: role},
    updatedAt: now,
  }, {merge: true});
}

app.get("/api/admin/pending-requests", requireAuth, async (req: any, res) => {
  try {
    if (!(await isSuperAdminUser(req.user.uid))) {
      return res.status(403).json({success: false, errorMessage: "SuperAdmin access required"});
    }
    const [orgsSnap, accessRequestsSnap] = await Promise.all([
      db.collection("orgs").limit(250).get(),
      db.collection("accessRequests").limit(1000).get(),
    ]);
    const orgs = new Map(orgsSnap.docs.map(org => [org.id, cleanupOrgName({id: org.id, ...org.data()})]));
    const invitations = (await Promise.all(orgsSnap.docs.map(async org => {
      const snap = await org.ref.collection("invitations").limit(500).get();
      return Promise.all(snap.docs.map(async invitation => ({
        id: invitation.id,
        ...invitation.data(),
        ...await inviterDisplay(invitation.data().invitedBy),
        orgId: org.id,
        organization: orgs.get(org.id) || org.id,
        source: "invitation",
      })));
    }))).flat();
    const accessRequests: any[] = accessRequestsSnap.docs
      .map(request => ({
        id: request.id,
        organization: orgs.get(request.data().orgId) || request.data().orgId || "Unknown organization",
        source: "accessRequest",
        ...request.data(),
      }))
      .filter((request: any) => request.type === "addUser" || request.type === "upgradeRequest");
    return res.json({success: true, invitations, accessRequests});
  } catch (error) {
    console.error("Pending request inventory failed", error);
    return res.status(500).json({success: false, errorMessage: "Unable to load pending requests"});
  }
});

app.post("/api/admin/pending-request-control", requireAuth, async (req: any, res) => {
  try {
    const performedBy = req.user.uid;
    if (!(await isSuperAdminUser(performedBy))) {
      return res.status(403).json({success: false, errorMessage: "SuperAdmin access required"});
    }
    const {action, orgId, targetId, rejectionReason} = req.body || {};
    if (!isSafePathSegment(orgId || "") || !isSafePathSegment(targetId || "")) {
      throw new Error("Organization and request are required");
    }
    const orgRef = db.doc(`orgs/${orgId}`);
    const orgSnap = await orgRef.get();
    if (!orgSnap.exists) throw new Error("Organization not found");
    if (orgSnap.data()?.status !== "active") throw new Error("Organization must be active");
    const now = admin.firestore.FieldValue.serverTimestamp();
    const reason = cleanupNote(rejectionReason);

    if (action === "approve_upgrade_request" || action === "reject_upgrade_request") {
      const requestRef = db.doc(`accessRequests/${targetId}`);
      const requestSnap = await requestRef.get();
      const request = requestSnap.data();
      if (!requestSnap.exists || request?.type !== "upgradeRequest" || request?.orgId !== orgId || request?.status !== "pending") {
        throw new Error("Pending upgrade request not found");
      }
      const batch = db.batch();
      const after = action === "approve_upgrade_request"
        ? {status: "approved", approvedBy: performedBy, approvedAt: now, updatedAt: now}
        : {status: "rejected", rejectedBy: performedBy, rejectedAt: now, rejectionReason: reason, updatedAt: now};
      if (action === "approve_upgrade_request") {
        if (!["COMM_L1", "COMM_L2", "SPONSORED"].includes(request.requestedTier)) throw new Error("Invalid requested tier");
        batch.set(orgRef, {
          tier: request.requestedTier,
          subscriptionStatus: orgSnap.data()?.subscriptionStatus || "active",
          updatedAt: now,
          updatedBy: performedBy,
        }, {merge: true});
      }
      batch.set(requestRef, after, {merge: true});
      addCleanupActivity(batch, {
        action,
        targetType: "upgradeRequest",
        targetId,
        orgId,
        performedBy,
        before: request,
        after,
        cleanupPhase: "25B",
      });
      await batch.commit();
      return res.json({success: true});
    }

    const invitationAction = action === "approve_invitation_request" || action === "cancel_invitation_request";
    const addUserAction = action === "approve_add_user_request" || action === "reject_add_user_request";
    if (!invitationAction && !addUserAction) throw new Error("Unsupported pending request action");
    const requestRef = invitationAction
      ? orgRef.collection("invitations").doc(targetId)
      : db.doc(`accessRequests/${targetId}`);
    const requestSnap = await requestRef.get();
    const request = requestSnap.data();
    if (!requestSnap.exists || request?.status !== "pending" || request?.orgId !== orgId) {
      throw new Error("Pending request not found");
    }
    if (addUserAction && request?.type !== "addUser") throw new Error("Pending add-user request not found");

    const batch = db.batch();
    if (action === "cancel_invitation_request" || action === "reject_add_user_request") {
      const after = action === "cancel_invitation_request"
        ? {status: "cancelled", cancelledBy: performedBy, cancelledAt: now, cancellationReason: reason, updatedAt: now}
        : {status: "rejected", rejectedBy: performedBy, rejectedAt: now, rejectionReason: reason, updatedAt: now};
      batch.set(requestRef, after, {merge: true});
      addCleanupActivity(batch, {
        action,
        targetType: invitationAction ? "invitation" : "addUserRequest",
        targetId,
        orgId,
        performedBy,
        before: request,
        after,
        cleanupPhase: "25B",
      });
      await batch.commit();
      return res.json({success: true});
    }

    const email = normalizePendingEmail(request.email);
    if (!email) throw new Error("Request email is required");
    const role = validatePendingRole(request.role || request.requestedRole);
    const authUser = await findAuthUserByEmail(email);
    if (!authUser) {
      const after = {superAdminApprovalStatus: "approved", superAdminApprovedBy: performedBy, superAdminApprovedAt: now, updatedAt: now};
      batch.set(requestRef, after, {merge: true});
      addCleanupActivity(batch, {
        action,
        targetType: invitationAction ? "invitation" : "addUserRequest",
        targetId,
        orgId,
        performedBy,
        before: request,
        after,
        cleanupPhase: "25B",
      });
      await batch.commit();
      return res.json({success: true, awaitingUser: true, message: "User must sign in/register with this email to accept invitation."});
    }
    await activatePendingMember({
      orgId,
      uid: authUser.uid,
      email,
      displayName: request.fullName || authUser.displayName || email,
      role,
      performedBy,
      batch,
      invitationId: invitationAction ? targetId : undefined,
    });
    const after = invitationAction
      ? {status: "accepted", acceptedBy: authUser.uid, acceptedAt: now, approvedBy: performedBy, approvedAt: now, updatedAt: now}
      : {status: "approved", approvedBy: performedBy, approvedAt: now, approvedUserUid: authUser.uid, updatedAt: now};
    batch.set(requestRef, after, {merge: true});
    addCleanupActivity(batch, {
      action,
      targetType: invitationAction ? "invitation" : "addUserRequest",
      targetId,
      orgId,
      userId: authUser.uid,
      performedBy,
      before: request,
      after,
      cleanupPhase: "25B",
    });
    await batch.commit();
    return res.json({success: true, activatedUser: true});
  } catch (error) {
    console.error("Pending request control failed", error);
    return res.status(400).json({success: false, errorMessage: error instanceof Error ? error.message : "Unable to update pending request"});
  }
});

app.post("/api/admin/create-invited-user-login", requireAuth, async (req: any, res) => {
  try {
    const performedBy = req.user.uid;
    if (!(await isSuperAdminUser(performedBy))) {
      return res.status(403).json({success: false, errorMessage: "SuperAdmin access required"});
    }
    const orgId = typeof req.body?.orgId === "string" ? req.body.orgId.trim() : "";
    const invitationId = typeof req.body?.invitationId === "string" ? req.body.invitationId.trim() : "";
    const temporaryPassword = typeof req.body?.temporaryPassword === "string" ? req.body.temporaryPassword : "";
    if (!isSafePathSegment(orgId) || !isSafePathSegment(invitationId)) throw new Error("Organization and invitation are required");
    if (temporaryPassword.length < 6) throw new Error("Temporary password must be at least 6 characters");

    const orgRef = db.doc(`orgs/${orgId}`);
    const invitationRef = orgRef.collection("invitations").doc(invitationId);
    const [orgSnap, invitationSnap] = await Promise.all([orgRef.get(), invitationRef.get()]);
    if (!orgSnap.exists || orgSnap.data()?.status !== "active") throw new Error("Organization must be active");
    const invitation = invitationSnap.data();
    if (!invitationSnap.exists || invitation?.orgId !== orgId) throw new Error("Invitation not found");
    if (invitation?.status !== "pending" || invitation?.superAdminApprovalStatus !== "approved") {
      throw new Error("Invitation must be approved and awaiting login");
    }
    const email = normalizePendingEmail(invitation.email);
    if (!email) throw new Error("Invitation email is required");
    const role = validatePendingRole(invitation.role);
    let authUser = await findAuthUserByEmail(email);
    const loginCreated = !authUser;
    if (!authUser) {
      authUser = await admin.auth().createUser({
        email,
        password: temporaryPassword,
        displayName: invitation.fullName || undefined,
      });
    }

    const batch = db.batch();
    await activatePendingMember({
      orgId,
      uid: authUser.uid,
      email,
      displayName: invitation.fullName || authUser.displayName || email,
      role,
      performedBy,
      batch,
      invitationId,
    });
    const now = admin.firestore.FieldValue.serverTimestamp();
    const after = {
      status: "accepted",
      acceptedBy: authUser.uid,
      acceptedAt: now,
      activatedBy: performedBy,
      activatedAt: now,
      updatedAt: now,
    };
    batch.set(invitationRef, after, {merge: true});
    addCleanupActivity(batch, {
      action: "create_invited_user_login",
      targetType: "invitation",
      targetId: invitationId,
      orgId,
      userId: authUser.uid,
      performedBy,
      before: invitation,
      after,
      cleanupPhase: "25C",
    });
    await batch.commit();
    return res.json({
      success: true,
      email,
      displayName: invitation.fullName || authUser.displayName || email,
      message: loginCreated ? "Login created. Provide the temporary password to the user." : "User already has a login account.",
    });
  } catch (error) {
    console.error("Invited user login creation failed", error);
    return res.status(400).json({success: false, errorMessage: error instanceof Error ? error.message : "Unable to create invited user login"});
  }
});

app.get("/api/admin/sponsor-observers", requireAuth, async (req: any, res) => {
  try {
    if (!(await isSuperAdminUser(req.user.uid))) {
      return res.status(403).json({success: false, errorMessage: "SuperAdmin access required"});
    }
    const [pilotSnapshot, programSnapshot] = await Promise.all([
      db.collection("users").where("roles.pilotObserver", "==", true).limit(500).get(),
      db.collection("users").where("roles.programObserver", "==", true).limit(500).get(),
    ]);
    const observerDocs = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
    pilotSnapshot.docs.forEach(docSnap => observerDocs.set(docSnap.id, docSnap));
    programSnapshot.docs.forEach(docSnap => observerDocs.set(docSnap.id, docSnap));
    const observers = Array.from(observerDocs.values()).map(docSnap => {
      const data = docSnap.data();
      return {
        uid: docSnap.id,
        email: data.email || "",
        displayName: data.displayName || data.fullName || "",
        fullName: data.fullName || data.displayName || "",
        status: data.status || "active",
        sponsorProgram: data.sponsorProgram || "",
        sponsorProgramOther: data.sponsorProgramOther || "",
        observerType: data.observerType || "",
        programIds: Array.isArray(data.programIds) ? data.programIds.map(String).filter(Boolean) : [],
        programCodes: Array.isArray(data.programCodes) ? data.programCodes.map(String).filter(Boolean) : [],
        createdAt: data.createdAt || null,
        updatedAt: data.updatedAt || null,
        lastLoginAt: data.lastLoginAt || null,
      };
    });
    return res.json({success: true, observers});
  } catch (error) {
    console.error("Sponsor observers load failed", error);
    return res.status(500).json({success: false, errorMessage: "Unable to load sponsor observers"});
  }
});

function safePilotOrgName(org: any, id: string) {
  return String(
    org?.name
    || org?.companyProfile?.companyName
    || org?.companyProfile?.legalName
    || org?.legalName
    || org?.displayName
    || id
  );
}

function isPilotVisibleOrg(org: any, id: string) {
  const status = String(org?.status || "active").toLowerCase();
  const name = safePilotOrgName(org, id).toLowerCase();
  const orgType = String(org?.orgType || org?.type || "").toLowerCase();
  if (status !== "active") return false;
  if (org?.isInternal === true || org?.internal === true) return false;
  if (["internal", "superadmin"].includes(orgType)) return false;
  if (id.toLowerCase().includes("superadmin") || id.toLowerCase().includes("internal") || id.toLowerCase().includes("cyber_blue_star")) return false;
  if (name.includes("superadmin") || name.includes("internal") || name.includes("cyber blue star")) return false;
  return true;
}

function safeActivitySummary(event: any) {
  const action = String(event?.action || "activity");
  if (action.startsWith("evidence.")) return action === "evidence.uploaded" ? "Evidence uploaded" : "Evidence status changed";
  if (action === "assessment.saved") return "Assessment progress saved";
  if (action === "report.generated") return "Report generated";
  return String(event?.summary || action).slice(0, 180);
}

async function programAssessmentSummary(orgId: string, assessmentId: string) {
  try {
    const assessmentRef = db.doc(`orgs/${orgId}/assessments/${assessmentId}`);
    const [practiceRecords, poamItems, scoreSnapshots] = await Promise.all([
      assessmentRef.collection("practiceRecords").get(),
      assessmentRef.collection("poamItems").get(),
      assessmentRef.collection("scoreSnapshots").orderBy("createdAt", "desc").limit(1).get(),
    ]);
    const completed = practiceRecords.docs.filter(item => ["met", "partial", "not_met"].includes(String(item.data()?.status || item.data()?.state || "").toLowerCase())).length;
    const total = practiceRecords.size;
    const latestScore = scoreSnapshots.docs[0]?.data() || {};
    return {
      practicesCompleted: completed,
      practicesRemaining: Math.max(0, total - completed),
      completionPercent: Number(latestScore.completionPercent ?? latestScore.practiceCompletionScore ?? (total ? Math.round((completed / total) * 100) : 0)),
      sprsScore: Number(latestScore.sprsScore ?? -250),
      openPoamCount: poamItems.docs.filter(item => String(item.data()?.status || "").toLowerCase() !== "completed").length,
      domainReadiness: [],
    };
  } catch {
    return {practicesCompleted: 0, practicesRemaining: 0, completionPercent: 0, sprsScore: -250, openPoamCount: 0, domainReadiness: []};
  }
}

app.get("/api/pilot/oversight", requireAuth, async (req: any, res) => {
  try {
    const userSnap = await db.doc(`users/${req.user.uid}`).get();
    const user = userSnap.data() || {};
    if (!userSnap.exists || user.status !== "active") return res.status(403).json({success: false, errorMessage: "Active observer access required"});
    const roles = user.roles || {};
    const programIds = Array.isArray(user.programIds) ? user.programIds.map(String).filter(Boolean) : [];
    const programScoped = roles.programObserver === true && programIds.length > 0;
    const legacyPilotObserver = roles.pilotObserver === true && !programScoped;
    if (!programScoped && !legacyPilotObserver) {
      return res.json({success: true, data: {
        summary: {activeOrganizations: 0, totalPilotUsers: 0, averageCompletionPercent: 0, averageSprsScore: -250, evidenceUploaded: 0, openPoamItems: 0, reportsGenerated: 0, feedbackItems: 0},
        organizations: [],
        recentActivity: [],
        progressHistory: [{label: "Current", averageCompletionPercent: 0}],
        hasHistoricalSnapshots: false,
      }});
    }

    const [orgSnap, activitySnap] = await Promise.all([
      db.collection("orgs").get(),
      db.collection("activityEvents").orderBy("createdAt", "desc").limit(300).get(),
    ]);
    const allActivity = activitySnap.docs.map(item => ({id: item.id, ...item.data()}));
    const reportEvents = allActivity.filter((event: any) => event.action === "report.generated");
    const evidenceEvents = allActivity.filter((event: any) => event.action === "evidence.uploaded");
    const reportsByOrg = new Map<string, any[]>();
    const activityByOrg = new Map<string, any[]>();
    reportEvents.forEach((event: any) => reportsByOrg.set(event.orgId, [...(reportsByOrg.get(event.orgId) || []), event]));
    allActivity.forEach((event: any) => activityByOrg.set(event.orgId, [...(activityByOrg.get(event.orgId) || []), event]));

    const allowedProgramIds = new Set(programIds);
    const orgDocs = orgSnap.docs
      .map(item => ({id: item.id, ...(item.data() || {})}))
      .filter((org: any) => isPilotVisibleOrg(org, org.id))
      .filter((org: any) => {
        if (!programScoped) return true;
        const orgProgramId = String(org.programId || "").trim();
        return orgProgramId !== "" && allowedProgramIds.has(orgProgramId);
      });

    const organizations = await Promise.all(orgDocs.map(async (org: any) => {
      const assessmentId = String(org.tier || "").toUpperCase() === "COMM_L2" ? "default_l2" : "default_l1";
      const assessment = await programAssessmentSummary(org.id, assessmentId);
      const orgReports = reportsByOrg.get(org.id) || [];
      const orgActivity = activityByOrg.get(org.id) || [];
      const evidenceCount = Number(org.evidenceCount ?? org.readiness?.evidenceCount ?? evidenceEvents.filter((event: any) => event.orgId === org.id).length);
      return {
        id: org.id,
        companyName: safePilotOrgName(org, org.id),
        name: org.name || "",
        town: org.companyProfile?.address?.city || org.companyProfile?.headquarters?.city || org.address?.city || "",
        state: org.companyProfile?.address?.state || org.companyProfile?.headquarters?.state || org.address?.state || "",
        programId: String(org.programId || ""),
        programName: String(org.programName || ""),
        programCode: String(org.programCode || ""),
        startingDate: org.subscriptionStartDate || org.createdAt || org.approvedAt || null,
        tier: String(org.tier || org.subscriptionTier || "Not provided"),
        status: String(org.status || "active"),
        completionPercent: assessment.completionPercent,
        sprsScore: assessment.sprsScore,
        usersCount: Number(org.activeMemberCount || org.memberCount || 0),
        evidenceCount,
        openPoamCount: assessment.openPoamCount,
        practicesCompleted: assessment.practicesCompleted,
        practicesRemaining: assessment.practicesRemaining,
        sspGenerated: orgReports.some((event: any) => /ssp|system security plan/i.test(event.targetLabel || event.summary || "")),
        poamGenerated: orgReports.some((event: any) => /poa&m|poam/i.test(event.targetLabel || event.summary || "")),
        policyGenerated: orgReports.some((event: any) => /policy/i.test(event.targetLabel || event.summary || "")),
        reportsGenerated: orgReports.length,
        lastActivity: orgActivity[0]?.createdAt || null,
        primaryContactEmail: String(org.companyProfile?.primaryContactEmail || org.primaryContactEmail || org.ownerEmail || ""),
        primaryUserId: String(org.ownerUid || org.primaryUserId || ""),
        overallReadinessPercent: assessment.completionPercent,
        domainReadiness: assessment.domainReadiness,
      };
    }));

    const recentOrgIds = new Set(organizations.map(org => org.id));
    const recentActivity = allActivity
      .filter((event: any) => recentOrgIds.has(event.orgId))
      .slice(0, 20)
      .map((event: any) => ({
        id: event.id,
        orgId: event.orgId,
        orgName: event.orgName || "",
        action: event.action || "activity",
        actorUid: event.actorUid || "",
        actorEmail: event.actorEmail || "",
        actorName: event.actorName || "",
        targetType: event.targetType || "",
        targetId: event.targetId || "",
        targetLabel: event.targetType === "evidence" ? "" : (event.targetLabel || ""),
        summary: safeActivitySummary(event),
        createdAt: event.createdAt || null,
      }));
    const activeOrganizations = organizations.filter(org => String(org.status || "").toLowerCase() === "active");
    const averageCompletionPercent = activeOrganizations.length ? Math.round(activeOrganizations.reduce((sum, org) => sum + org.completionPercent, 0) / activeOrganizations.length) : 0;
    const averageSprsScore = activeOrganizations.length ? Math.round(activeOrganizations.reduce((sum, org) => sum + org.sprsScore, 0) / activeOrganizations.length) : -250;
    return res.json({success: true, data: {
      summary: {
        activeOrganizations: activeOrganizations.length,
        totalPilotUsers: organizations.reduce((sum, org) => sum + org.usersCount, 0),
        averageCompletionPercent,
        averageSprsScore,
        evidenceUploaded: organizations.reduce((sum, org) => sum + org.evidenceCount, 0),
        openPoamItems: organizations.reduce((sum, org) => sum + org.openPoamCount, 0),
        reportsGenerated: organizations.reduce((sum, org) => sum + org.reportsGenerated, 0),
        feedbackItems: 0,
      },
      organizations: organizations.sort((a, b) => a.companyName.localeCompare(b.companyName)),
      recentActivity,
      progressHistory: [{label: "Current", averageCompletionPercent}],
      hasHistoricalSnapshots: false,
    }});
  } catch (error) {
    console.error("Pilot oversight scoped load failed", error);
    return res.status(500).json({success: false, errorMessage: "Unable to load pilot oversight summary"});
  }
});

const emptyProgramAnalyticsData = (input: {
  programs: any[];
  selectedProgram: any | null;
  isSuperAdmin: boolean;
  isProgramObserver: boolean;
  isLegacyPilotObserver: boolean;
}) => ({
  programs: input.programs,
  selectedProgram: input.selectedProgram,
  scope: {
    isSuperAdmin: input.isSuperAdmin,
    isProgramObserver: input.isProgramObserver,
    isLegacyPilotObserver: input.isLegacyPilotObserver,
  },
  summary: {
    totalOrganizations: 0,
    activeOrganizations: 0,
    totalUsers: 0,
    averageCompletionPercent: 0,
    averageSprsScore: -250,
    evidenceUploaded: 0,
    sspGeneratedCount: 0,
    poamGeneratedCount: 0,
    openPoamItems: 0,
    lastActivityDate: null,
    completedPractices: 0,
    remainingPractices: 0,
    averageReadinessPercent: 0,
    l1Organizations: 0,
    l2Organizations: 0,
  },
  organizations: [],
  recentActivity: [],
  charts: {
    completionDistribution: [
      {label: "0-24%", count: 0},
      {label: "25-49%", count: 0},
      {label: "50-74%", count: 0},
      {label: "75-100%", count: 0},
    ],
    tierSplit: {l1: 0, l2: 0},
    reportsSummary: {ssp: 0, poam: 0, other: 0},
  },
});

const programAnalyticsHandler = async (req: any, res: any) => {
  try {
    const userSnap = await db.doc(`users/${req.user.uid}`).get();
    const user = userSnap.data() || {};
    if (!userSnap.exists || user.status !== "active") {
      return res.status(403).json({success: false, errorMessage: "Active program analytics access required"});
    }
    const roles = user.roles || {};
    const isSuperAdmin = await isSuperAdminUser(req.user.uid);
    const assignedProgramIds = Array.isArray(user.programIds) ? user.programIds.map(String).filter(Boolean) : [];
    const assignedProgramCodes = Array.isArray(user.programCodes) ? user.programCodes.map((item: any) => String(item || "").trim().toUpperCase()).filter(Boolean) : [];
    const programScopedObserver = roles.programObserver === true && assignedProgramIds.length > 0;
    const programCodeScopedObserver = roles.programObserver === true && !programScopedObserver && assignedProgramCodes.length > 0;
    const legacyPilotObserver = roles.pilotObserver === true && !programScopedObserver && !programCodeScopedObserver;
    if (!isSuperAdmin && !programScopedObserver && !programCodeScopedObserver && !legacyPilotObserver) {
      return res.status(403).json({success: false, errorMessage: "Program Analytics is limited to SuperAdmin and Sponsor Observers"});
    }

    const requestedProgramId = typeof req.query?.programId === "string" ? req.query.programId.trim() : "";
    const requestedProgramCode = requestedProgramId.toUpperCase();

    const [programSnap, orgSnap, activitySnap] = await Promise.all([
      db.collection("programs").where("status", "==", "active").limit(500).get(),
      db.collection("orgs").get(),
      db.collection("activityEvents").orderBy("createdAt", "desc").limit(500).get(),
    ]);
    const allPrograms = programSnap.docs.map(docSnap => {
      const data = docSnap.data() || {};
      return {
        id: docSnap.id,
        name: String(data.name || ""),
        programCode: String(data.programCode || ""),
        programType: String(data.programType || ""),
        state: String(data.state || ""),
        sponsorName: String(data.sponsorName || ""),
        status: "active",
      };
    }).filter(program => program.name && program.programCode);

    const visiblePrograms = isSuperAdmin
      ? allPrograms
      : programScopedObserver
        ? allPrograms.filter(program => assignedProgramIds.includes(program.id) || assignedProgramCodes.includes(program.programCode.toUpperCase()))
        : programCodeScopedObserver
          ? allPrograms.filter(program => assignedProgramCodes.includes(program.programCode.toUpperCase()))
        : allPrograms;
    const selectedProgram = requestedProgramId
      ? visiblePrograms.find(program => program.id === requestedProgramId || program.programCode.toUpperCase() === requestedProgramCode)
      : visiblePrograms[0];
    if ((programScopedObserver || programCodeScopedObserver) && requestedProgramId && !selectedProgram) {
      return res.status(403).json({success: false, errorMessage: "Requested program is outside observer scope"});
    }
    if (!selectedProgram) {
      return res.json({success: true, data: emptyProgramAnalyticsData({
        programs: visiblePrograms,
        selectedProgram: null,
        isSuperAdmin,
        isProgramObserver: programScopedObserver || programCodeScopedObserver,
        isLegacyPilotObserver: legacyPilotObserver,
      })});
    }

    const selectedProgramId = selectedProgram.id;
    const selectedProgramCode = selectedProgram.programCode.toUpperCase();
    const allActivity = activitySnap.docs.map(item => ({id: item.id, ...item.data()}));
    const reportEvents = allActivity.filter((event: any) => event.action === "report.generated");
    const evidenceEvents = allActivity.filter((event: any) => event.action === "evidence.uploaded");
    const reportsByOrg = new Map<string, any[]>();
    const activityByOrg = new Map<string, any[]>();
    reportEvents.forEach((event: any) => reportsByOrg.set(event.orgId, [...(reportsByOrg.get(event.orgId) || []), event]));
    allActivity.forEach((event: any) => activityByOrg.set(event.orgId, [...(activityByOrg.get(event.orgId) || []), event]));

    const orgDocs = orgSnap.docs
      .map(item => ({id: item.id, ...(item.data() || {})}))
      .filter((org: any) => isPilotVisibleOrg(org, org.id))
      .filter((org: any) => {
        const orgProgramId = String(org.programId || "").trim();
        const orgProgramCode = String(org.programCode || "").trim().toUpperCase();
        return orgProgramId === selectedProgramId || orgProgramCode === selectedProgramCode;
      });

    const organizations = await Promise.all(orgDocs.map(async (org: any) => {
      const assessmentId = String(org.tier || "").toUpperCase() === "COMM_L2" ? "default_l2" : "default_l1";
      const assessment = await programAssessmentSummary(org.id, assessmentId);
      const orgReports = reportsByOrg.get(org.id) || [];
      const orgActivity = activityByOrg.get(org.id) || [];
      const evidenceCount = Number(org.evidenceCount ?? org.readiness?.evidenceCount ?? evidenceEvents.filter((event: any) => event.orgId === org.id).length);
      const sspGenerated = orgReports.some((event: any) => /ssp|system security plan/i.test(event.targetLabel || event.summary || ""));
      const poamGenerated = orgReports.some((event: any) => /poa&m|poam/i.test(event.targetLabel || event.summary || ""));
      const lastActivity = orgActivity[0]?.createdAt || null;
      const daysSinceActivity = lastActivity
        ? Math.floor((Date.now() - (lastActivity.toDate ? lastActivity.toDate().getTime() : lastActivity._seconds ? lastActivity._seconds * 1000 : new Date(lastActivity).getTime())) / 86400000)
        : 999;
      const attentionFlag = daysSinceActivity >= 14
        ? "Needs Attention"
        : assessment.completionPercent < 25
          ? "Low Progress"
          : orgReports.length === 0
            ? "Reports Missing"
            : "On Track";
      return {
        id: org.id,
        companyName: safePilotOrgName(org, org.id),
        tier: String(org.tier || org.subscriptionTier || "Not provided"),
        status: String(org.status || "active"),
        usersCount: Number(org.activeMemberCount || org.memberCount || 0),
        completionPercent: assessment.completionPercent,
        sprsScore: assessment.sprsScore,
        evidenceCount,
        sspGenerated,
        poamGenerated,
        reportsGenerated: orgReports.length,
        openPoamCount: assessment.openPoamCount,
        practicesCompleted: assessment.practicesCompleted,
        practicesRemaining: assessment.practicesRemaining,
        lastActivity,
        attentionFlag,
      };
    }));

    const activeOrganizations = organizations.filter(org => String(org.status || "").toLowerCase() === "active");
    const averageCompletionPercent = activeOrganizations.length ? Math.round(activeOrganizations.reduce((sum, org) => sum + org.completionPercent, 0) / activeOrganizations.length) : 0;
    const averageSprsScore = activeOrganizations.length ? Math.round(activeOrganizations.reduce((sum, org) => sum + org.sprsScore, 0) / activeOrganizations.length) : -250;
    const recentOrgIds = new Set(organizations.map(org => org.id));
    const recentActivity = allActivity
      .filter((event: any) => recentOrgIds.has(event.orgId))
      .slice(0, 10)
      .map((event: any) => ({
        id: event.id,
        orgId: event.orgId,
        orgName: event.orgName || "",
        action: event.action || "activity",
        actorName: event.actorName || "",
        actorEmail: event.actorEmail || "",
        targetType: event.targetType || "",
        targetLabel: event.targetType === "evidence" ? "" : (event.targetLabel || ""),
        summary: safeActivitySummary(event),
        createdAt: event.createdAt || null,
      }));
    const reportsSummary = {
      ssp: organizations.filter(org => org.sspGenerated).length,
      poam: organizations.filter(org => org.poamGenerated).length,
      other: organizations.reduce((sum, org) => sum + Math.max(0, org.reportsGenerated - Number(org.sspGenerated) - Number(org.poamGenerated)), 0),
    };
    return res.json({success: true, data: {
      programs: visiblePrograms,
      selectedProgram,
      scope: {isSuperAdmin, isProgramObserver: programScopedObserver || programCodeScopedObserver, isLegacyPilotObserver: legacyPilotObserver},
      summary: {
        totalOrganizations: organizations.length,
        activeOrganizations: activeOrganizations.length,
        totalUsers: organizations.reduce((sum, org) => sum + org.usersCount, 0),
        averageCompletionPercent,
        averageSprsScore,
        evidenceUploaded: organizations.reduce((sum, org) => sum + org.evidenceCount, 0),
        sspGeneratedCount: reportsSummary.ssp,
        poamGeneratedCount: reportsSummary.poam,
        openPoamItems: organizations.reduce((sum, org) => sum + org.openPoamCount, 0),
        lastActivityDate: recentActivity[0]?.createdAt || null,
        completedPractices: organizations.reduce((sum, org) => sum + org.practicesCompleted, 0),
        remainingPractices: organizations.reduce((sum, org) => sum + org.practicesRemaining, 0),
        averageReadinessPercent: averageCompletionPercent,
        l1Organizations: organizations.filter(org => String(org.tier).toUpperCase() !== "COMM_L2").length,
        l2Organizations: organizations.filter(org => String(org.tier).toUpperCase() === "COMM_L2").length,
      },
      organizations: organizations.sort((a, b) => a.companyName.localeCompare(b.companyName)),
      recentActivity,
      charts: {
        completionDistribution: [
          {label: "0-24%", count: organizations.filter(org => org.completionPercent < 25).length},
          {label: "25-49%", count: organizations.filter(org => org.completionPercent >= 25 && org.completionPercent < 50).length},
          {label: "50-74%", count: organizations.filter(org => org.completionPercent >= 50 && org.completionPercent < 75).length},
          {label: "75-100%", count: organizations.filter(org => org.completionPercent >= 75).length},
        ],
        tierSplit: {l1: organizations.filter(org => String(org.tier).toUpperCase() !== "COMM_L2").length, l2: organizations.filter(org => String(org.tier).toUpperCase() === "COMM_L2").length},
        reportsSummary,
      },
    }});
  } catch (error) {
    console.error("Program analytics load failed", error);
    return res.status(500).json({success: false, errorMessage: "Unable to load program analytics"});
  }
};

app.get("/api/program/analytics", requireAuth, programAnalyticsHandler);
app.get("/program/analytics", requireAuth, programAnalyticsHandler);
app.get("/api/api/program/analytics", requireAuth, programAnalyticsHandler);

const MARKETPLACE_CATEGORIES = new Set(["CONSULTING", "SOFTWARE", "HARDWARE", "TRAINING", "ASSESSMENT", "OTHER"]);
const MARKETPLACE_STATUSES = new Set(["active", "inactive", "archived"]);

async function requireActiveMarketplaceUser(uid: string) {
  const userSnap = await db.doc(`users/${uid}`).get();
  const user = userSnap.data() || {};
  return userSnap.exists && user.status === "active";
}

function cleanMarketplaceList(value: any) {
  if (Array.isArray(value)) return value.map(item => String(item || "").trim()).filter(Boolean).slice(0, 50);
  if (typeof value === "string") return value.split(",").map(item => item.trim()).filter(Boolean).slice(0, 50);
  return [];
}

function sanitizeMarketplaceVendor(docSnap: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot) {
  const data = docSnap.data() || {};
  return {
    id: docSnap.id,
    companyName: String(data.companyName || ""),
    logoUrl: String(data.logoUrl || ""),
    description: String(data.description || ""),
    primaryCategory: String(data.primaryCategory || "OTHER"),
    subcategories: cleanMarketplaceList(data.subcategories),
    cyberAbRoles: cleanMarketplaceList(data.cyberAbRoles),
    website: String(data.website || ""),
    email: String(data.email || ""),
    phone: String(data.phone || ""),
    address: String(data.address || ""),
    city: String(data.city || ""),
    state: String(data.state || ""),
    country: String(data.country || ""),
    serviceArea: cleanMarketplaceList(data.serviceArea),
    remoteAvailable: data.remoteAvailable === true,
    languages: cleanMarketplaceList(data.languages),
    yearsInBusiness: String(data.yearsInBusiness || ""),
    industriesServed: cleanMarketplaceList(data.industriesServed),
    programsSupported: cleanMarketplaceList(data.programsSupported),
    programIds: cleanMarketplaceList(data.programIds),
    status: String(data.status || "active"),
    featured: data.featured === true,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
  };
}

function normalizeMarketplaceVendorInput(input: any) {
  const primaryCategory = String(input?.primaryCategory || "OTHER").trim().toUpperCase();
  const status = String(input?.status || "active").trim().toLowerCase();
  return {
    companyName: String(input?.companyName || "").trim().slice(0, 180),
    logoUrl: String(input?.logoUrl || "").trim().slice(0, 500),
    description: String(input?.description || "").trim().slice(0, 2000),
    primaryCategory: MARKETPLACE_CATEGORIES.has(primaryCategory) ? primaryCategory : "OTHER",
    subcategories: cleanMarketplaceList(input?.subcategories),
    cyberAbRoles: cleanMarketplaceList(input?.cyberAbRoles),
    website: String(input?.website || "").trim().slice(0, 500),
    email: String(input?.email || "").trim().slice(0, 240),
    phone: String(input?.phone || "").trim().slice(0, 80),
    address: String(input?.address || "").trim().slice(0, 300),
    city: String(input?.city || "").trim().slice(0, 120),
    state: String(input?.state || "").trim().slice(0, 80),
    country: String(input?.country || "").trim().slice(0, 120),
    serviceArea: cleanMarketplaceList(input?.serviceArea),
    remoteAvailable: input?.remoteAvailable === true,
    languages: cleanMarketplaceList(input?.languages),
    yearsInBusiness: String(input?.yearsInBusiness || "").trim().slice(0, 80),
    industriesServed: cleanMarketplaceList(input?.industriesServed),
    programsSupported: cleanMarketplaceList(input?.programsSupported),
    programIds: cleanMarketplaceList(input?.programIds),
    status: MARKETPLACE_STATUSES.has(status) ? status : "active",
    featured: input?.featured === true,
  };
}

const listMarketplaceVendors = async (req: any, res: any) => {
  try {
    if (!(await requireActiveMarketplaceUser(req.user.uid))) {
      return res.status(403).json({success: false, errorMessage: "Active user access required"});
    }
    const snapshot = await db.collection("marketplaceVendors")
      .where("status", "==", "active")
      .limit(500)
      .get();
    const vendors = snapshot.docs.map(sanitizeMarketplaceVendor)
      .sort((a, b) => Number(b.featured) - Number(a.featured) || a.companyName.localeCompare(b.companyName));
    return res.json({success: true, vendors});
  } catch (error) {
    console.error("Marketplace vendors load failed", error);
    return res.status(500).json({success: false, errorMessage: "Unable to load marketplace vendors"});
  }
};

const listAdminMarketplaceVendors = async (req: any, res: any) => {
  try {
    if (!(await isSuperAdminUser(req.user.uid))) {
      return res.status(403).json({success: false, errorMessage: "SuperAdmin access required"});
    }
    const snapshot = await db.collection("marketplaceVendors").limit(500).get();
    const vendors = snapshot.docs.map(sanitizeMarketplaceVendor)
      .sort((a, b) => a.companyName.localeCompare(b.companyName));
    return res.json({success: true, vendors});
  } catch (error) {
    console.error("Admin marketplace vendors load failed", error);
    return res.status(500).json({success: false, errorMessage: "Unable to load marketplace management data"});
  }
};

const saveMarketplaceVendor = async (req: any, res: any) => {
  try {
    if (!(await isSuperAdminUser(req.user.uid))) {
      return res.status(403).json({success: false, errorMessage: "SuperAdmin access required"});
    }
    const vendorId = typeof req.body?.id === "string" ? req.body.id.trim() : "";
    if (vendorId && !isSafePathSegment(vendorId)) throw new Error("Invalid vendor id");
    const clean = normalizeMarketplaceVendorInput(req.body || {});
    if (!clean.companyName) throw new Error("Company Name is required");
    if (!clean.description) throw new Error("Description is required");
    if (!clean.primaryCategory) throw new Error("Primary Category is required");
    const now = admin.firestore.FieldValue.serverTimestamp();
    const ref = vendorId ? db.doc(`marketplaceVendors/${vendorId}`) : db.collection("marketplaceVendors").doc();
    const existingSnap = await ref.get();
    await ref.set({
      ...clean,
      ...(existingSnap.exists ? {} : {createdAt: now, createdBy: req.user.uid}),
      updatedAt: now,
      updatedBy: req.user.uid,
    }, {merge: true});
    const savedSnap = await ref.get();
    return res.json({success: true, vendor: sanitizeMarketplaceVendor(savedSnap)});
  } catch (error) {
    console.error("Marketplace vendor save failed", error);
    return res.status(400).json({success: false, errorMessage: error instanceof Error ? error.message : "Unable to save marketplace vendor"});
  }
};

app.get("/api/marketplace/vendors", requireAuth, listMarketplaceVendors);
app.get("/marketplace/vendors", requireAuth, listMarketplaceVendors);
app.get("/api/api/marketplace/vendors", requireAuth, listMarketplaceVendors);
app.get("/api/admin/marketplace/vendors", requireAuth, listAdminMarketplaceVendors);
app.get("/admin/marketplace/vendors", requireAuth, listAdminMarketplaceVendors);
app.get("/api/api/admin/marketplace/vendors", requireAuth, listAdminMarketplaceVendors);
app.post("/api/admin/marketplace/vendor", requireAuth, saveMarketplaceVendor);
app.post("/admin/marketplace/vendor", requireAuth, saveMarketplaceVendor);
app.post("/api/api/admin/marketplace/vendor", requireAuth, saveMarketplaceVendor);

app.post("/api/admin/sponsor-observer", requireAuth, async (req: any, res) => {
  try {
    if (!(await isSuperAdminUser(req.user.uid))) {
      return res.status(403).json({success: false, errorMessage: "SuperAdmin access required"});
    }
    const uid = typeof req.body?.uid === "string" ? req.body.uid.trim() : "";
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const displayName = typeof req.body?.displayName === "string" ? req.body.displayName.trim() : "";
    const temporaryPassword = typeof req.body?.temporaryPassword === "string" ? req.body.temporaryPassword : "";
    const status = req.body?.status === "inactive" ? "inactive" : "active";
    const sponsorProgram = typeof req.body?.sponsorProgram === "string" ? req.body.sponsorProgram.trim() : "";
    const sponsorProgramOther = sponsorProgram === "Other" && typeof req.body?.sponsorProgramOther === "string"
      ? req.body.sponsorProgramOther.trim().slice(0, 120)
      : "";
    const programId = typeof req.body?.programId === "string" ? req.body.programId.trim() : "";
    const requestedProgramCode = typeof req.body?.programCode === "string" ? req.body.programCode.trim().toUpperCase() : "";

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Valid email is required");
    if (!displayName) throw new Error("Name is required");
    if (programId && !isSafePathSegment(programId)) throw new Error("Select a valid program");

    let selectedProgramId = "";
    let selectedProgramCode = "";
    let selectedSponsorProgram = sponsorProgram;
    if (programId) {
      const programSnap = await db.doc(`programs/${programId}`).get();
      if (!programSnap.exists) throw new Error("Selected program was not found");
      const program = programSnap.data() || {};
      if (String(program.status || "").toLowerCase() !== "active") throw new Error("Selected program is not active");
      selectedProgramId = programSnap.id;
      selectedProgramCode = String(program.programCode || requestedProgramCode || "").trim().toUpperCase();
      selectedSponsorProgram = String(program.name || selectedProgramCode || sponsorProgram).trim();
      if (!selectedProgramCode) throw new Error("Selected program is missing a program code");
    } else {
      if (sponsorProgram && !SPONSOR_PROGRAM_OPTIONS.has(sponsorProgram)) throw new Error("Select a valid sponsor program");
      if (sponsorProgram === "Other" && !sponsorProgramOther) throw new Error("Sponsor Program Other is required");
    }

    let authUser: admin.auth.UserRecord | null = null;
    let loginCreated = false;
    let temporaryPasswordApplied = false;
    if (uid) {
      authUser = await admin.auth().getUser(uid);
      if (authUser.email && authUser.email.toLowerCase() !== email) throw new Error("Email cannot be changed for an existing Sponsor Observer");
      const existingUserSnap = await db.doc(`users/${uid}`).get();
      const existingRoles = existingUserSnap.data()?.roles || {};
      if (existingUserSnap.exists && existingRoles?.pilotObserver !== true && existingRoles?.programObserver !== true) {
        throw new Error("Only existing Sponsor Observer accounts can be edited here.");
      }
      const authUpdate: admin.auth.UpdateRequest = {displayName, disabled: status !== "active"};
      if (temporaryPassword) {
        if (temporaryPassword.length < 6) throw new Error("Temporary password must be at least 6 characters");
        authUpdate.password = temporaryPassword;
        temporaryPasswordApplied = true;
      }
      authUser = await admin.auth().updateUser(uid, authUpdate);
    } else {
      authUser = await findAuthUserByEmail(email);
      if (!authUser) {
        if (temporaryPassword.length < 6) throw new Error("Temporary password must be at least 6 characters");
        authUser = await admin.auth().createUser({
          email,
          password: temporaryPassword,
          displayName,
          disabled: status !== "active",
        });
        loginCreated = true;
        temporaryPasswordApplied = true;
      } else {
        if (temporaryPassword.length < 6) throw new Error("Temporary password must be at least 6 characters");
        const existingUserSnap = await db.doc(`users/${authUser.uid}`).get();
        const existingUser = existingUserSnap.data() || {};
        const isExistingSponsorObserver = existingUser?.roles?.pilotObserver === true || existingUser?.roles?.programObserver === true;
        const hasExistingPlatformRole = existingUser?.roles?.superAdmin === true || typeof existingUser?.roles?.orgRole === "string" || typeof existingUser?.orgId === "string";
        if (existingUserSnap.exists && !isExistingSponsorObserver && hasExistingPlatformRole) {
          throw new Error("Email already belongs to an existing platform user. Use Edit for an existing Sponsor Observer or choose a different email.");
        }
        authUser = await admin.auth().updateUser(authUser.uid, {
          displayName,
          disabled: status !== "active",
          password: temporaryPassword,
        });
        temporaryPasswordApplied = true;
      }
    }

    const userRef = db.doc(`users/${authUser.uid}`);
    const beforeSnap = await userRef.get();
    const before = beforeSnap.data() || {};
    const now = admin.firestore.FieldValue.serverTimestamp();
    const beforeProgramIds = Array.isArray(before.programIds) ? before.programIds.map(String).filter(Boolean) : [];
    const beforeProgramCodes = Array.isArray(before.programCodes) ? before.programCodes.map(String).filter(Boolean) : [];
    const programIds = selectedProgramId ? Array.from(new Set([...beforeProgramIds, selectedProgramId])) : beforeProgramIds;
    const programCodes = selectedProgramCode ? Array.from(new Set([...beforeProgramCodes, selectedProgramCode])) : beforeProgramCodes;
    const after = {
      uid: authUser.uid,
      email,
      displayName,
      fullName: displayName,
      status,
      roles: {
        ...(before.roles || {}),
        pilotObserver: true,
        ...(selectedProgramId ? {programObserver: true} : {}),
        superAdmin: false,
      },
      sponsorProgram: selectedSponsorProgram,
      sponsorProgramOther,
      ...(programIds.length > 0 ? {programIds} : {}),
      ...(programCodes.length > 0 ? {programCodes} : {}),
      ...(selectedProgramId ? {observerType: "program"} : {}),
      updatedAt: now,
      updatedBy: req.user.uid,
      ...(beforeSnap.exists ? {} : {createdAt: now, createdBy: req.user.uid}),
    };
    const batch = db.batch();
    batch.set(userRef, after, {merge: true});
    if (selectedProgramId) {
      batch.set(db.doc(`programs/${selectedProgramId}`), {
        sponsorObserverEmails: admin.firestore.FieldValue.arrayUnion(email),
        sponsorObserverUids: admin.firestore.FieldValue.arrayUnion(authUser.uid),
        updatedAt: now,
        updatedBy: req.user.uid,
      }, {merge: true});
    }
    await batch.commit();
    const activityBatch = db.batch();
    addCleanupActivity(activityBatch, {
      action: uid ? "update_sponsor_observer" : "create_sponsor_observer",
      targetType: "user",
      targetId: authUser.uid,
      userId: authUser.uid,
      performedBy: req.user.uid,
      before,
      after,
      cleanupPhase: "28F-FIX",
    });
    if (selectedProgramId) {
      addCleanupActivity(activityBatch, {
        action: "assign_program_observer",
        targetType: "user",
        targetId: authUser.uid,
        userId: authUser.uid,
        performedBy: req.user.uid,
        before: {programIds: beforeProgramIds, programCodes: beforeProgramCodes},
        after: {programIds, programCodes, programCode: selectedProgramCode},
        cleanupPhase: "25A.2",
      });
    }
    await activityBatch.commit();
    return res.json({
      success: true,
      observer: after,
      message: loginCreated
        ? "Sponsor Observer login created. Share the temporary password securely with the sponsor observer."
        : temporaryPasswordApplied
          ? "Sponsor Observer login linked. Share the temporary password securely with the sponsor observer."
          : "Sponsor Observer saved.",
    });
  } catch (error) {
    console.error("Sponsor observer save failed", error);
    return res.status(400).json({success: false, errorMessage: error instanceof Error ? error.message : "Unable to save Sponsor Observer"});
  }
});

app.get("/api/org/active-members", requireAuth, async (req: any, res) => {
  const orgId = typeof req.query?.orgId === "string" ? req.query.orgId.trim() : "";
  if (!isSafePathSegment(orgId)) return res.status(400).json({success: false, errorMessage: "Valid orgId is required"});
  try {
    if (!(await canAccessOrg(req.user.uid, orgId))) {
      return res.status(403).json({success: false, errorMessage: "Organization access required"});
    }
    const memberSnap = await db.collection("orgs").doc(orgId).collection("members").limit(500).get();
    const members = (await Promise.all(memberSnap.docs.map(async memberDoc => {
      const member = memberDoc.data();
      if (member.status !== "active" || member.active !== true) return null;
      const userSnap = await db.doc(`users/${memberDoc.id}`).get();
      const user = userSnap.data() || {};
      return {
        uid: memberDoc.id,
        displayName: member.displayName || member.name || member.fullName || user.displayName || user.fullName || "",
        email: member.email || user.email || "",
        role: member.role || "",
        status: member.status,
        active: member.active,
      };
    }))).filter(Boolean);
    return res.json({success: true, members});
  } catch (error) {
    console.error("Active organization members load failed", error);
    return res.status(500).json({success: false, errorMessage: "Unable to load active organization members"});
  }
});

app.post("/api/org/repair-member-identities", requireAuth, async (req: any, res) => {
  const orgId = typeof req.body?.orgId === "string" ? req.body.orgId.trim() : "";
  if (!isSafePathSegment(orgId)) return res.status(400).json({success: false, errorMessage: "Valid orgId is required"});
  try {
    if (!(await isSuperAdminUser(req.user.uid))) {
      return res.status(403).json({success: false, errorMessage: "SuperAdmin access required"});
    }
    const orgRef = db.doc(`orgs/${orgId}`);
    const [orgSnap, memberSnap] = await Promise.all([
      orgRef.get(),
      orgRef.collection("members").limit(500).get(),
    ]);
    if (!orgSnap.exists) return res.status(404).json({success: false, errorMessage: "Organization not found"});
    const org = orgSnap.data() || {};
    const repairs: Array<{ref: admin.firestore.DocumentReference; update: Record<string, any>}> = [];
    for (const memberDoc of memberSnap.docs) {
      const member = memberDoc.data();
      const userSnap = await db.doc(`users/${memberDoc.id}`).get();
      const user = userSnap.data() || {};
      const role = member.role || user.roles?.orgRole || "viewer";
      const status = member.status || "active";
      const update = {
        uid: member.uid || memberDoc.id,
        displayName: member.displayName || member.name || member.fullName || user.displayName || user.fullName || org.primaryContactName || member.email || user.email || org.primaryContactEmail || memberDoc.id,
        email: member.email || user.email || org.primaryContactEmail || "",
        joinedAt: member.joinedAt || member.createdAt || admin.firestore.FieldValue.serverTimestamp(),
        role,
        status,
        active: typeof member.active === "boolean" ? member.active : status === "active",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      const needsRepair = !member.uid || !member.displayName || !member.email || !member.joinedAt || !member.role || !member.status || typeof member.active !== "boolean";
      if (needsRepair) repairs.push({ref: memberDoc.ref, update});
    }
    for (let index = 0; index < repairs.length; index += 400) {
      const batch = db.batch();
      repairs.slice(index, index + 400).forEach(repair => batch.set(repair.ref, repair.update, {merge: true}));
      await batch.commit();
    }
    const activityBatch = db.batch();
    addCleanupActivity(activityBatch, {
      action: "repair_member_identity_fields",
      targetType: "org",
      targetId: orgId,
      orgId,
      performedBy: req.user.uid,
      before: {memberCount: memberSnap.size},
      after: {repairedCount: repairs.length},
      cleanupPhase: "24C",
    });
    await activityBatch.commit();
    return res.json({success: true, repairedCount: repairs.length});
  } catch (error) {
    console.error("Organization member identity repair failed", error);
    return res.status(500).json({success: false, errorMessage: "Unable to repair organization member identity fields"});
  }
});

app.post("/api/org/repair-user-access-record", requireAuth, async (req: any, res) => {
  const orgId = typeof req.body?.orgId === "string" ? req.body.orgId.trim() : "";
  const userId = typeof req.body?.userId === "string" ? req.body.userId.trim() : "";
  if (!isSafePathSegment(orgId) || !isSafePathSegment(userId)) {
    return res.status(400).json({success: false, errorMessage: "Valid orgId and userId are required"});
  }
  try {
    if (!(await isSuperAdminUser(req.user.uid))) {
      return res.status(403).json({success: false, errorMessage: "SuperAdmin access required"});
    }
    const orgRef = db.doc(`orgs/${orgId}`);
    const memberRef = orgRef.collection("members").doc(userId);
    const userRef = db.doc(`users/${userId}`);
    const [orgSnap, memberSnap, userSnap] = await Promise.all([
      orgRef.get(),
      memberRef.get(),
      userRef.get(),
    ]);
    if (!orgSnap.exists) return res.status(404).json({success: false, errorMessage: "Organization not found"});
    if (!memberSnap.exists) return res.status(404).json({success: false, errorMessage: "Organization member not found"});
    const org = orgSnap.data() || {};
    const member = memberSnap.data() || {};
    const user = userSnap.data() || {};
    if (member.status !== "active" || member.active !== true || typeof member.role !== "string" || !member.role) {
      return res.status(400).json({success: false, errorMessage: "Member must be active and have a role before repairing the user access record"});
    }
    const now = admin.firestore.FieldValue.serverTimestamp();
    const after = {
      uid: userId,
      email: member.email || user.email || org.primaryContactEmail || "",
      displayName: member.displayName || member.name || member.fullName || user.displayName || user.fullName || member.email || user.email || userId,
      orgId,
      status: "active",
      roles: {...(user.roles || {}), orgRole: member.role},
      updatedAt: now,
    };
    const batch = db.batch();
    batch.set(userRef, after, {merge: true});
    addCleanupActivity(batch, {
      action: "repair_user_access_record",
      targetType: "user",
      targetId: userId,
      orgId,
      userId,
      performedBy: req.user.uid,
      before: pickCleanupFields(user, ["uid", "email", "displayName", "orgId", "status", "roles"]),
      after,
      cleanupPhase: "24D",
    });
    await batch.commit();
    return res.json({success: true});
  } catch (error) {
    console.error("User access record repair failed", error);
    return res.status(500).json({success: false, errorMessage: "Unable to repair user access record"});
  }
});

app.post("/api/org/member-control", requireAuth, async (req: any, res) => {
  try {
    const performedBy = req.user.uid;
    const {action, orgId, userId, updates = {}, allowLastOwnerRemoval = false} = req.body || {};
    if (!isSafePathSegment(orgId || "") || !isSafePathSegment(userId || "")) throw new Error("Organization and member are required");
    const manager = await getOrgUserManager(performedBy, orgId);
    if (!manager.allowed) return res.status(403).json({success: false, errorMessage: "Organization user management access required"});
    const memberRef = db.doc(`orgs/${orgId}/members/${userId}`);
    const userRef = db.doc(`users/${userId}`);
    const [memberSnap, userSnap] = await Promise.all([memberRef.get(), userRef.get()]);
    if (!memberSnap.exists) throw new Error("Organization member not found");
    const member = memberSnap.data() || {};
    const user = userSnap.data() || {};
    if (user.roles?.superAdmin === true) throw new Error("SuperAdmin users cannot be changed or removed");
    if (!manager.superAdmin && member.role === "orgOwner") throw new Error("Org Admin cannot change or remove an orgOwner");

    const ownerSnap = await db.collection("orgs").doc(orgId).collection("members").where("role", "==", "orgOwner").get();
    const removingLastOwner = member.role === "orgOwner" && ownerSnap.size <= 1;
    if (removingLastOwner && (!manager.superAdmin || !allowLastOwnerRemoval || !["inactive", "archived"].includes(manager.org?.status))) {
      throw new Error("Last orgOwner can only be removed by SuperAdmin after explicit confirmation while the org is inactive or archived");
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const batch = db.batch();
    if (action === "update_org_member") {
      const allowedRoles = manager.superAdmin ? ORG_MEMBER_ROLES : ORG_ADMIN_MEMBER_ROLES;
      if (!allowedRoles.has(updates.role)) throw new Error("Invalid member role");
      if (!CLEANUP_MEMBER_STATUSES.has(updates.status)) throw new Error("Invalid member status");
      const active = updates.status === "active";
      const after = {role: updates.role, status: updates.status, active, updatedAt: now};
      batch.set(memberRef, after, {merge: true});
      if (userSnap.exists && (!user.orgId || user.orgId === orgId)) {
        batch.set(userRef, {orgId, status: updates.status, roles: {...(user.roles || {}), orgRole: updates.role}, updatedAt: now}, {merge: true});
      }
      addCleanupActivity(batch, {
        action,
        targetType: "member",
        targetId: userId,
        orgId,
        userId,
        performedBy,
        before: pickCleanupFields(member, ["role", "status", "active"]),
        after,
        cleanupPhase: "24A",
      });
    } else if (action === "remove_user_from_org") {
      batch.delete(memberRef);
      if (userSnap.exists && user.orgId === orgId) {
        batch.set(userRef, {status: "inactive", updatedAt: now}, {merge: true});
      }
      addCleanupActivity(batch, {
        action,
        targetType: "member",
        targetId: userId,
        orgId,
        userId,
        performedBy,
        before: member,
        after: {membershipRemoved: true, userStatus: userSnap.exists && user.orgId === orgId ? "inactive" : user.status || null},
        cleanupPhase: "24A",
      });
    } else {
      throw new Error("Unsupported organization member action");
    }
    await batch.commit();
    return res.json({success: true});
  } catch (error) {
    console.error("Organization member control failed", error);
    return res.status(400).json({success: false, errorMessage: error instanceof Error ? error.message : "Unable to update organization member"});
  }
});

app.get("/api/admin/export-assessment", requireAuth, async (req: any, res) => {
  const orgId = typeof req.query?.orgId === "string" ? req.query.orgId.trim() : "";
  const assessmentId = typeof req.query?.assessmentId === "string" ? req.query.assessmentId.trim() : "";

  if (!isSafePathSegment(orgId) || !isSafePathSegment(assessmentId)) {
    return res.status(400).json({error: "Valid orgId and assessmentId are required"});
  }

  try {
    if (!(await isSuperAdminUser(req.user.uid))) {
      return res.status(403).json({error: "Super admin access required"});
    }

    const orgRef = db.doc(`orgs/${orgId}`);
    const assessmentRef = orgRef.collection("assessments").doc(assessmentId);
    const [
      orgSnap,
      assessmentSnap,
      practiceRecordsSnap,
      objectiveRecordsSnap,
      evidenceSnap,
      notesSnap,
      poamItemsSnap,
      scoreSnapshotsSnap,
      activityLogSnap,
    ] = await Promise.all([
      orgRef.get(),
      assessmentRef.get(),
      assessmentRef.collection("practiceRecords").get(),
      assessmentRef.collection("objectiveRecords").get(),
      orgRef.collection("evidence").where("assessmentId", "==", assessmentId).get(),
      orgRef.collection("notes").where("assessmentId", "==", assessmentId).get(),
      assessmentRef.collection("poamItems").get(),
      assessmentRef.collection("scoreSnapshots").orderBy("createdAt", "desc").limit(25).get(),
      assessmentRef.collection("activityLog").orderBy("createdAt", "desc").limit(100).get(),
    ]);

    const docs = (snap: admin.firestore.QuerySnapshot) =>
      snap.docs.map(docSnap => ({id: docSnap.id, ...docSnap.data()}));

    return res.json({
      metadata: {
        exportedAt: new Date().toISOString(),
        exportedByUid: req.user.uid,
        orgId,
        assessmentId,
        exportVersion: "backup_v1",
      },
      org: orgSnap.exists ? {id: orgSnap.id, ...orgSnap.data()} : null,
      assessment: assessmentSnap.exists ? {id: assessmentSnap.id, ...assessmentSnap.data()} : null,
      practiceRecords: docs(practiceRecordsSnap),
      objectiveRecords: docs(objectiveRecordsSnap),
      evidence: docs(evidenceSnap),
      notes: docs(notesSnap),
      poamItems: docs(poamItemsSnap),
      scoreSnapshots: docs(scoreSnapshotsSnap),
      activityLog: docs(activityLogSnap),
    });
  } catch (error) {
    console.error("[admin-export] assessment export failed", {
      orgId,
      assessmentId,
      error: safeErrorMessage(error, "Assessment export failed"),
    });
    return res.status(500).json({error: "Assessment export failed"});
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
async function requireEvidenceUploadAuth(req: any, res: any, next: any) {
  try {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({success: false, errorCode: "NOT_AUTHENTICATED", errorMessage: "Authentication is required to upload evidence."});
    }
    const token = authHeader.substring("Bearer ".length);
    req.user = await admin.auth().verifyIdToken(token);
    return next();
  } catch (error) {
    return res.status(401).json({success: false, errorCode: "NOT_AUTHENTICATED", errorMessage: "Authentication is required to upload evidence."});
  }
}

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
