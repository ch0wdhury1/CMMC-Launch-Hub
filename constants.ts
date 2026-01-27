
/**
 * ============================================
 *  CMMC LAUNCH HUB — GLOBAL CONSTANTS
 * ============================================
 * Central location for all configuration values,
 * keys, model names, and reusable constants.
 */

/* --------------------------------------------
 * LOCAL STORAGE
 * -------------------------------------------- */
export const LOCAL_STORAGE_KEY = "cmmc_unified_state_v2";
export const SAVED_TEMPLATES_KEY = "saved_templates";
export const READINESS_ANALYZER_KEY = "readiness_analyzer_answers";
export const SAVED_REPORTS_KEY = "saved_readiness_reports";
export const SSP_PROFILE_KEY = "ssp_profile_data";

export const STORAGE_VERSION = 2;

/* --------------------------------------------
 * LEVEL 1 AUTHORITATIVE PRACTICE LIST
 * -------------------------------------------- */
export const LEVEL_1_PRACTICE_IDS = [
  "AC.L1-3.1.1",
  "AC.L1-3.1.2",
  "AC.L1-3.1.20",
  "AC.L1-3.1.22",
  "IA.L1-3.5.1",
  "IA.L1-3.5.2",
  "MP.L1-3.8.3",
  "PE.L1-3.10.1",
  "PE.L1-3.10.3",
  "PE.L1-3.10.4",
  "PE.L1-3.10.5",
  "SC.L1-3.13.1",
  "SC.L1-3.13.5",
  "SI.L1-3.14.1",
  "SI.L1-3.14.2",
  "SI.L1-3.14.4",
  "SI.L1-3.14.5"
] as const;

export const L1_PRACTICE_COUNT = 21; // Official display requirement
export const L2_PRACTICE_COUNT = 110; // Official L2 requirement

/* --------------------------------------------
 * AI MODEL CONFIGURATIONS
 * -------------------------------------------- */
export const MODEL_TEXT = "gemini-3-flash-preview";
export const MODEL_OCR = "gemini-2.5-flash-image";
export const MODEL_CHAT = "gemini-3-flash-preview";
export const MODEL_TTS = "gemini-2.5-flash-preview-tts";
export const DEFAULT_TTS_VOICE = "Kore";

/* --------------------------------------------
 * FILE UPLOAD RULES
 * -------------------------------------------- */
export const MAX_FILE_SIZE_MB = 12;
export const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export const UPLOAD_ERRORS = {
  TOO_LARGE: "The selected file is too large. Maximum allowed size is 12MB.",
  INVALID_TYPE: "This file type is not supported for artifact uploads.",
};

/* --------------------------------------------
 * UI CONSTANTS
 * -------------------------------------------- */
export const PROGRESS_THRESHOLDS = {
  LOW: 33,
  MEDIUM: 66,
};
export const SIDEBAR_WIDTH = 352;
export const ANIMATION_MS = 300;

/* --------------------------------------------
 * HIGH-RISK PRACTICES (CMMC LEVEL 1)
 * -------------------------------------------- */
export const HIGH_RISK_PRACTICE_IDS = [
  "AC.L1-3.1.1",
  "AC.L1-3.1.2",
  "IA.L1-3.5.1",
  "IA.L1-3.5.2",
  "MP.L1-3.8.3",
  "PE.L1-3.10.1",
  "SC.L1-3.13.1",
  "SC.L1-3.13.5",
  "SI.L1-3.14.1",
  "SI.L1-3.14.2",
  "SI.L1-3.14.4",
] as const;
