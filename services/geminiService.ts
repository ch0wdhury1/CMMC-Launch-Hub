
import {
  GoogleGenAI,
  GenerateContentResponse,
  Modality,
  Type,
} from "@google/genai";

import { 
  Practice, 
  Domain, 
  AssessmentObjective, 
  ReadinessAnswers, 
  ReadinessReport,
  L2ExtractionResult,
  L2ValidationResult
} from "../types";
import { fileToBase64 } from "./fileUtils";
import { decode, decodeAudioData } from "./audioUtils";

// -------------------------------------------------------------
// INITIALIZE MODEL CLIENT
// -------------------------------------------------------------
const ai = new GoogleGenAI({
  apiKey: process.env.API_KEY as string,
});

// Update models based on latest guidelines
const MODELS = {
  OCR: "gemini-2.5-flash-image",
  TEXT: "gemini-3-pro-preview", // Use pro for complex extraction/logic
  TTS: "gemini-2.5-flash-preview-tts",
  CHAT: "gemini-3-flash-preview",
  IMAGE: "gemini-2.5-flash-image",
};

// -------------------------------------------------------------
// CACHING HELPERS
// -------------------------------------------------------------

function simpleHash(str: string): number {
  let hash = 0;
  if (str.length === 0) return hash;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; 
  }
  return hash;
}

function safeSessionSet(key: string, value: string) {
    try {
        sessionStorage.setItem(key, value);
    } catch (e) {
        console.warn(`Could not cache item for key ${key}.`);
    }
}

function safeSessionGet(key: string): string | null {
    try {
        return sessionStorage.getItem(key);
    } catch (e) {
        return null;
    }
}

// -------------------------------------------------------------
// SAFE TEXT EXTRACTION
// -------------------------------------------------------------
function extractText(response: GenerateContentResponse): string {
  try {
    // Correct method: property text directly returns the string output.
    return response.text?.trim() || "";
  } catch {
    return "";
  }
}

// -------------------------------------------------------------
// RETRY HELPER FOR API CALLS
// -------------------------------------------------------------
async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === attempts - 1) throw err;
      const delay = Math.pow(2, i) * 1000 + Math.random() * 500;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error("Retry logic failed.");
}

// -------------------------------------------------------------
// LEVEL 2 EXTRACTION & PIPELINE
// -------------------------------------------------------------

/**
 * Stage 3: Extraction (The Miner)
 */
export async function extractL2Requirement(textSegment: string): Promise<L2ExtractionResult> {
  const prompt = `
SYSTEM: You are a CMMC Data Engineer. Your task is to extract CMMC Level 2 requirement data from the provided PDF text. 
Strictly follow the JSON schema. Do NOT paraphrase the Requirement Statement or Assessment Objectives. 
If a section is missing, return null in that field.

USER:
PDF CONTENT: 
---
${textSegment}
---

OUTPUT: Return valid JSON matching the approved schema.
NO HALLUCINATIONS. Preserve exact wording.
`;

  return await withRetry(async () => {
    const response = await ai.models.generateContent({
      model: MODELS.TEXT,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            requirementId: { type: Type.STRING },
            domain: { type: Type.STRING },
            level: { type: Type.INTEGER },
            requirementName: { type: Type.STRING },
            requirementStatement: { type: Type.STRING },
            assessmentObjectives: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  objectiveId: { type: Type.STRING },
                  determinationStatement: { type: Type.STRING },
                  assessmentMethods: { type: Type.ARRAY, items: { type: Type.STRING } },
                  assessmentObjects: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ["objectiveId", "determinationStatement"],
              }
            },
            discussion: { type: Type.STRING },
            furtherDiscussion: { type: Type.STRING },
            examples: { type: Type.ARRAY, items: { type: Type.STRING } },
            references: { type: Type.ARRAY, items: { type: Type.STRING } },
            sourceTrace: {
              type: Type.OBJECT,
              properties: {
                pdfVersion: { type: Type.STRING },
                pageStart: { type: Type.INTEGER },
                pageEnd: { type: Type.INTEGER }
              }
            },
            extractionConfidence: { type: Type.STRING }
          }
        }
      }
    });
    return JSON.parse(extractText(response));
  });
}

/**
 * Stage 4: Validation & Repair (The Auditor)
 */
export async function validateAndRepairL2Json(rawJson: string, sourceText: string): Promise<L2ValidationResult> {
  const prompt = `
SYSTEM ROLE:
You are a validation and repair engine for CMMC Launch Hub — Level 2 JSON.

INPUT:
You will receive extracted requirement JSON and the original source text segment.

TASK:
Validate the JSON against these rules:

VALIDATION RULES:
- Every requirement must have at least one assessment objective
- Objective letters must be sequential (no missing [a], [b], etc.)
- assessmentMethods must only include: examine | interview | test
- assessmentObjects must be structured categories, not free text
- sourceTrace must include pageStart and pageEnd

REPAIR RULES:
- You MAY fix structural issues (arrays, enums, missing fields)
- You MAY NOT invent missing content
- If content cannot be repaired, flag: "validationStatus": "NEEDS_HUMAN_REVIEW"

USER:
SOURCE TEXT: ${sourceText}
EXTRACTED JSON: ${rawJson}

OUTPUT:
Return ONLY valid JSON.
`;

  return await withRetry(async () => {
    const response = await ai.models.generateContent({
      model: MODELS.TEXT,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });
    return JSON.parse(extractText(response));
  });
}

// -------------------------------------------------------------
// EXISTING SERVICES (UPGRADED FOR L2 SUPPORT)
// -------------------------------------------------------------

export async function getOcrSummary(file: File): Promise<string> {
  const { base64, mimeType } = await fileToBase64(file);

  return await withRetry(async () => {
    const response = await ai.models.generateContent({
      model: MODELS.OCR,
      contents: [
        {
          parts: [
            {
              text:
                "You are analyzing an uploaded file for a CMMC assessment. " +
                "Provide a single short sentence describing what the document *appears* to be " +
                "and how it might relate to compliance. Mention if it looks like a final form document or a draft.",
            },
            { inlineData: { mimeType, data: base64 } },
          ],
        },
      ],
    });

    return extractText(response);
  });
}

export async function generateObjectiveActionPoints(practice: Practice, objective: AssessmentObjective) {
  const cacheKey = `action_points:${practice.id}:${objective.id}`;
  const cached = safeSessionGet(cacheKey);
  if (cached) return JSON.parse(cached);

  const result = await withRetry(async () => {
    const prompt = `
Context:
- Practice: ${practice.id} - ${practice.name}
- Objective: "${objective.text}"

Generate a detailed set of action points required to meet this objective. Also, if a policy or procedure document is appropriate, generate one or more templates.
Ensure instructions focus on creating FINAL evidence artifacts as required for CMMC Level 2.

Return a structured JSON.
`;

    const response = await ai.models.generateContent({
      model: MODELS.TEXT,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            actionPoints: { type: Type.STRING },
            summary: { type: Type.STRING },
            templates: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  filename: { type: Type.STRING },
                  content: { type: Type.STRING },
                },
                required: ["name", "filename", "content"],
              },
            },
          },
          required: ["actionPoints", "summary", "templates"],
        },
        systemInstruction: `You are an expert CMMC consultant. Your task is to provide expert guidance for CMMC Level 2 objectives.`
      },
    });

    const jsonText = extractText(response);
    return JSON.parse(jsonText);
  });
  
  safeSessionSet(cacheKey, JSON.stringify(result));
  return result;
}

export async function generateInstructionAudio(text: string): Promise<string> {
    const cacheKey = `audio:${simpleHash(text)}`;
    const cached = safeSessionGet(cacheKey);
    if(cached) return cached;

    const response = await ai.models.generateContent({
      model: MODELS.TTS,
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
        },
      },
    });
    const base64Audio = response?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("Audio generation failed.");

    safeSessionSet(cacheKey, base64Audio);
    return base64Audio;
}

export async function startObjectiveChat(
  objective: AssessmentObjective,
  history: { role: 'user' | 'model'; text: string }[],
  newMessage: string
) {
  const formattedHistory = history.map((msg) => ({
    role: msg.role,
    parts: [{ text: msg.text }],
  }));

  const chat = ai.chats.create({
    model: MODELS.CHAT,
    config: {
      systemInstruction: `You are a CMMC Level 2 compliance expert. Help the user understand and implement objective: "${objective.text}". Focus on high-quality evidence and objective-level satisfaction.`,
    },
    history: formattedHistory,
  });

  return await chat.sendMessageStream({ message: newMessage });
}

export async function generateDomainExplanation(domainName: string): Promise<{ script: string; audioB64: string }> {
  const cacheKey = `domain_explanation:${domainName}`;
  const cached = safeSessionGet(cacheKey);
  if(cached) return JSON.parse(cached);

  const result = await withRetry(async () => {
    const scriptPrompt = `Explain the CMMC domain "${domainName}" for a Level 2 assessment. Focus on the impact of Controlled Unclassified Information (CUI).`;
    const scriptResponse = await ai.models.generateContent({ model: MODELS.TEXT, contents: scriptPrompt });
    const script = extractText(scriptResponse);
    const audioB64 = await generateInstructionAudio(script);
    return { script, audioB64 };
  });

  safeSessionSet(cacheKey, JSON.stringify(result));
  return result;
}

export async function generateSlideshow(actionPointsText: string): Promise<string[]> {
  const concepts = await withRetry(async () => {
    const response = await ai.models.generateContent({
      model: MODELS.TEXT,
      contents: `Extract 3-4 visual concepts for a CMMC Level 2 training slideshow based on: "${actionPointsText}"`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            concepts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  visualPrompt: { type: Type.STRING },
                },
                required: ["title", "visualPrompt"],
              }
            }
          },
          required: ["concepts"]
        }
      }
    });
    return JSON.parse(extractText(response)).concepts;
  });
  
  const images = await Promise.all(concepts.map(async (concept: any) => {
    const response = await ai.models.generateContent({
      model: MODELS.IMAGE,
      contents: { parts: [{ text: `Professional CMMC compliance slide for: ${concept.title}. ${concept.visualPrompt}. Semi-transparent dark header with title text.` }] },
      config: { imageConfig: { aspectRatio: "16:9" } }
    });
    // Correct method: iterate through all parts to find the image part.
    return response.candidates?.[0]?.content?.parts.find(p => p.inlineData)?.inlineData.data;
  }));

  return images.filter(Boolean);
}

export async function getExecutiveAiSummary(input: {
  overall: number;
  notMet: Practice[];
  domains: Domain[];
}): Promise<string> {
  const unmetIds = input.notMet.map(p => p.id).join(',') || 'None';
  const prompt = `Generate a Level 2 CMMC executive summary. Readiness: ${input.overall}%. Highlighting gaps in: ${unmetIds}. Mention that Level 2 requires evidence at the objective level and any one failure fails the practice.`;
  const response = await ai.models.generateContent({ model: MODELS.TEXT, contents: prompt });
  return extractText(response);
}

// Added missing export for generating readiness reports
export async function generateReadinessReport(answers: ReadinessAnswers): Promise<ReadinessReport> {
  const prompt = `Analyze these CMMC Readiness questionnaire answers and generate a comprehensive report: ${JSON.stringify(answers)}`;
  return await withRetry(async () => {
    const response = await ai.models.generateContent({
      model: MODELS.TEXT,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overallReadinessScore: { type: Type.NUMBER },
            practiceEvaluation: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  practiceId: { type: Type.STRING },
                  status: { type: Type.STRING },
                  summaryOfGaps: { type: Type.STRING },
                  reasoning: { type: Type.STRING },
                  remediationSteps: { type: Type.STRING },
                }
              }
            },
            recommendedTools: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  toolType: { type: Type.STRING },
                  recommendation: { type: Type.STRING },
                  reasoning: { type: Type.STRING },
                }
              }
            },
            implementationPlan: {
              type: Type.OBJECT,
              properties: {
                immediate: { type: Type.ARRAY, items: { type: Type.STRING } },
                shortTerm: { type: Type.ARRAY, items: { type: Type.STRING } },
                mediumTerm: { type: Type.ARRAY, items: { type: Type.STRING } },
              }
            },
            modificationsToExistingTools: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  toolName: { type: Type.STRING },
                  suggestedModifications: { type: Type.STRING },
                }
              }
            },
            policyRequirements: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  policyName: { type: Type.STRING },
                  reasoning: { type: Type.STRING },
                  practicesSatisfied: { type: Type.ARRAY, items: { type: Type.STRING } },
                }
              }
            },
            finalSummary: {
              type: Type.OBJECT,
              properties: {
                strengths: { type: Type.STRING },
                weaknesses: { type: Type.STRING },
                priorityActions: { type: Type.STRING },
                estimatedDifficulty: { type: Type.STRING },
                quickWins: { type: Type.STRING },
              }
            }
          }
        }
      }
    });
    return JSON.parse(extractText(response));
  });
}

// Added missing export for practice explanations
export async function getPracticeExplanation(practice: Practice): Promise<string> {
  const prompt = `Explain CMMC practice ${practice.id} (${practice.name}) in plain English.`;
  const response = await ai.models.generateContent({ model: MODELS.TEXT, contents: prompt });
  return extractText(response);
}

// Added missing export for explanation audio (alias for generateInstructionAudio)
export async function getExplanationAudio(text: string): Promise<string> {
  return await generateInstructionAudio(text);
}

// Added missing export for artifact suggestions
export async function getArtifactSuggestions(practice: Practice): Promise<string[]> {
  const prompt = `List 3-5 specific artifacts or evidence examples that would satisfy CMMC practice ${practice.id}. Return as JSON array of strings.`;
  const response = await ai.models.generateContent({
    model: MODELS.TEXT,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    }
  });
  return JSON.parse(extractText(response));
}

// Added missing export for chat streaming
export async function startChatStream(practice: Practice, history: any[], newMessage: string) {
  const chat = ai.chats.create({
    model: MODELS.CHAT,
    config: {
      systemInstruction: `You are a CMMC expert assisting with practice ${practice.id}.`,
    },
    history: history.map(h => ({ role: h.role, parts: [{ text: h.text }] })),
  });
  return await chat.sendMessageStream({ message: newMessage });
}

// Added missing export for practice overview audio
export async function generatePracticeExplanationAudio(practice: Practice): Promise<{ script: string; audioB64: string }> {
  const script = await getPracticeExplanation(practice);
  const audioB64 = await generateInstructionAudio(script);
  return { script, audioB64 };
}

// Added missing export for template recommendations
export async function generateTemplateRecommendations(objective: AssessmentObjective): Promise<{ templateType: string; explanation: string }[]> {
  const prompt = `For CMMC objective "${objective.text}", recommend 1-3 types of document templates (e.g., Policy, Procedure). Return JSON array of objects with templateType and explanation.`;
  const response = await ai.models.generateContent({
    model: MODELS.TEXT,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            templateType: { type: Type.STRING },
            explanation: { type: Type.STRING },
          }
        }
      }
    }
  });
  return JSON.parse(extractText(response));
}

// Added missing export for single template generation
export async function generateSingleTemplate(params: { domain: string, practice: Practice, objective: AssessmentObjective, templateType: string }): Promise<any> {
  const prompt = `Generate a ${params.templateType} template for CMMC ${params.practice.id} objective "${params.objective.text}".`;
  const response = await ai.models.generateContent({
    model: MODELS.TEXT,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          domain: { type: Type.STRING },
          practiceId: { type: Type.STRING },
          objectiveId: { type: Type.STRING },
          templateType: { type: Type.STRING },
          title: { type: Type.STRING },
          content: { type: Type.STRING },
          filename: { type: Type.STRING },
          version: { type: Type.STRING },
          createdAt: { type: Type.STRING },
        }
      }
    }
  });
  const res = JSON.parse(extractText(response));
  return {
    ...res,
    id: res.id || crypto.randomUUID(),
    domain: params.domain,
    practiceId: params.practice.id,
    objectiveId: params.objective.id,
    templateType: params.templateType,
    createdAt: res.createdAt || new Date().toISOString()
  };
}

// Added missing export for solution details
export async function getSolutionDetails(title: string): Promise<string> {
  const prompt = `Provide detailed information and CMMC relevance for: ${title}. Use HTML tags for formatting.`;
  const response = await ai.models.generateContent({ model: MODELS.TEXT, contents: prompt });
  return extractText(response);
}

// Added missing export for policy template generation
export async function generatePolicyTemplate(title: string): Promise<any> {
  const prompt = `Generate a full template for ${title} in plain text. Return JSON with title, filename, and content.`;
  const response = await ai.models.generateContent({
    model: MODELS.TEXT,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          filename: { type: Type.STRING },
          content: { type: Type.STRING },
        }
      }
    }
  });
  return JSON.parse(extractText(response));
}
