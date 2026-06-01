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
    targetType: "org" | "member" | "accessRequest" | "invitation";
    targetId: string;
    performedBy: string;
    orgId?: string;
    userId?: string;
    before?: Record<string, any>;
    after?: Record<string, any>;
    note?: string;
  }
) {
  const ref = cleanupActivityRef();
  batch.set(ref, {
    id: ref.id,
    type: "cleanup_control_action",
    ...params,
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

app.get("/api/admin/cleanup-controls", requireAuth, async (req: any, res) => {
  try {
    if (!(await isSuperAdminUser(req.user.uid))) {
      res.status(403).json({success: false, errorMessage: "SuperAdmin access required"});
      return;
    }

    const [orgsSnap, accessRequestsSnap] = await Promise.all([
      db.collection("orgs").limit(250).get(),
      db.collection("accessRequests").limit(1000).get(),
    ]);

    const orgs: any[] = await Promise.all(orgsSnap.docs.map(async (orgDoc) => {
      const [membersSnap, legacyMembersSnap, invitationsSnap, assessmentsSnap, evidenceSnap] = await Promise.all([
        orgDoc.ref.collection("members").limit(500).get(),
        db.collection("orgMembers").doc(orgDoc.id).collection("members").limit(500).get(),
        orgDoc.ref.collection("invitations").limit(500).get(),
        orgDoc.ref.collection("assessments").limit(250).get(),
        orgDoc.ref.collection("evidence").limit(1000).get(),
      ]);
      const data = orgDoc.data();
      return {
        id: orgDoc.id,
        ...data,
        name: cleanupOrgName({id: orgDoc.id, ...data}),
        members: cleanupDocs(membersSnap),
        legacyMembers: cleanupDocs(legacyMembersSnap),
        invitations: cleanupDocs(invitationsSnap),
        memberCount: membersSnap.size,
        assessmentCount: assessmentsSnap.size,
        evidenceCount: evidenceSnap.size,
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

    res.json({
      success: true,
      inventory: {
        generatedAt: new Date().toISOString(),
        orgs,
        accessRequests: cleanupDocs(accessRequestsSnap),
        duplicateGroups,
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

    const {action, orgId, targetId, userId, updates = {}, note} = req.body || {};
    const reviewedNote = cleanupNote(note);
    const now = admin.firestore.FieldValue.serverTimestamp();

    if (action === "update_org_status") {
      if (!orgId || !CLEANUP_ORG_STATUSES.has(updates.status)) throw new Error("Invalid organization status update");
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
      const after = {status: updates.status, active: updates.active, role: updates.role, updatedAt: now};
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
      });
      await batch.commit();
    } else if (action === "archive_access_request") {
      if (!targetId) throw new Error("Access request is required");
      const ref = db.collection("accessRequests").doc(targetId);
      const snapshot = await ref.get();
      if (!snapshot.exists) throw new Error("Access request not found");
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
      });
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
