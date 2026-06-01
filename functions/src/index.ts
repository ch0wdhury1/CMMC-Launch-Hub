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
  return userSnap.exists && userSnap.data()?.roles?.superAdmin === true;
}

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
