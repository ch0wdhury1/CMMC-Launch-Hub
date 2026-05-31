
/**
 * ============================================
 *   CMMC LAUNCH HUB — STRONGLY TYPED MODELS
 * ============================================
 */

export enum ObjectiveStatus {
  Met = "MET",
  NotMet = "NOT_MET",
  NotApplicable = "N/A",
  Pending = "PENDING",
}

export type PracticeStatus = "met" | "partial" | "not_met" | "not_assessed";
export type StatusSource = "manual" | "analyzer_suggested" | "none" | "auto";
export type TextBlock = string | string[];

export interface Artifact {
  id: string;
  name: string;
  description?: string;
  fileName?: string;
  fileType: string;
  fileSize?: number;
  ocrSummary: string;
  processingStatus?: "ocr_failed";
  processingError?: string;
  uploadedAt: string;
  isFinalForm: boolean;
}

export interface ObjectiveRecord {
  status: ObjectiveStatus;
  note: string;
  artifacts: Artifact[];
  actionPoints?: string;
  actionPointsSummary?: string;
  templates?: Array<{
    id: string;
    name: string;
    filename: string;
    content: string;
    createdAt: string;
  }>;
}

export interface AssessmentObjective {
  id: string;
  text: string;
  status: ObjectiveStatus;
  note: string;
  artifacts: Artifact[];
  actionPoints?: string;
  actionPointsSummary?: string;
  templates?: Array<{
    id: string;
    name: string;
    filename: string;
    content: string;
    createdAt: string;
  }>;
}

export interface Practice {
  uid: string;
  id: string;
  level: 1 | 2; // Explicit level field
  domainName: string;
  name: string;
  brief_description: string;
  assessment_objectives: AssessmentObjective[];
  potential_assessment_methods_and_objects: TextBlock;
  discussion: TextBlock;
  further_discussion?: TextBlock;
  key_references?: string[];
  sprsWeight?: number;
}

export interface PracticeRecord {
  id: string;
  status: PracticeStatus;
  statusSource: StatusSource;
  lastUpdated: string;
  analyzerSuggestion?: {
    status: PracticeStatus;
    reason: string;
  };
  note: string;
  objectiveRecords: { [objectiveId: string]: ObjectiveRecord };
}

export interface Domain {
  name: string;
  practices: Practice[];
}

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  role?: string;
}

export interface CompanyProfile {
  id: string;
  companyName: string;
  companyLogo?: string;
  address?: string;
  website?: string;
  users: UserProfile[];
  primaryContactName?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
  secondaryContactName?: string;
  secondaryContactEmail?: string;
  secondaryContactPhone?: string;
}

export type PoamStatus = "open" | "in_progress" | "completed" | "deferred";
export type PoamPriority = "high" | "medium" | "low";

export interface PoamItem {
  id: string;
  title: string;
  description: string;
  relatedPracticeIds: string[];
  category: "technical" | "policy" | "process" | "physical" | "other";
  priority: PoamPriority;
  status: PoamStatus;
  owner?: string;
  createdAt: string;
  targetDate?: string;
  completedDate?: string;
  source: "analyzer" | "practice" | "manual";
  notes?: string;
}

export type ResponsibilityType = "customer" | "provider" | "shared";

export interface ResponsibilityMatrixEntry {
  id: string;
  practiceId: string;
  practiceName: string;
  domain: string;
  responsibility: ResponsibilityType;
  providerName?: string;
  internalOwner?: string;
  notes?: string;
  lastUpdated: string;
}

export interface SavedTemplate {
  id: string;
  practiceId: string;
  objectiveId: string;
  title: string;
  content: string;
  createdAt: string;
  type?: 'text' | 'pdf';
  templateType?: string;
  domain?: string;
}

export interface GeneratedTemplate {
  id: string;
  domain: string;
  practiceId: string;
  objectiveId: string;
  templateType: string;
  title: string;
  content: string;
  filename: string;
  version: string;
  createdAt: string;
}

export interface ReadinessAnswers {
  [key: string]: string | number | boolean | string[];
}

export interface ReadinessReport {
  overallReadinessScore: number;
  practiceEvaluation: Array<{
    practiceId: string;
    status: 'Met' | 'Partially Met' | 'Not Met';
    summaryOfGaps: string;
    reasoning: string;
    remediationSteps: string;
  }>;
  recommendedTools: Array<{
    toolType: string;
    recommendation: string;
    reasoning: string;
  }>;
  implementationPlan: {
    immediate: string[];
    shortTerm: string[];
    mediumTerm: string[];
  };
  modificationsToExistingTools: Array<{
    toolName: string;
    suggestedModifications: string;
  }>;
  policyRequirements: Array<{
    policyName: string;
    reasoning: string;
    practicesSatisfied: string[];
  }>;
  finalSummary: {
    strengths: string;
    weaknesses: string;
    priorityActions: string;
    estimatedDifficulty: string;
    quickWins: string;
  };
}

export interface ReadinessScores {
  practiceCompletionScore: number;
  controlsPostureScore: number;
  overallReadinessScore: number;
}

export interface SavedReport {
  id: string;
  dateGenerated: string;
  readinessScore: number;
  complianceScore: number;
  pdfDataURL: string;
}

export interface SourceTrace {
  pdfVersion: string;
  pageStart: number;
  pageEnd: number;
}

export interface L2ExtractionResult {
  requirementId: string;
  domain: string;
  level: number;
  requirementName: string;
  requirementStatement: string;
  assessmentObjectives: Array<{
    objectiveId: string;
    determinationStatement: string;
    assessmentMethods: Array<"examine" | "interview" | "test">;
    assessmentObjects: string[];
  }>;
  discussion: string;
  furtherDiscussion?: string;
  examples?: string | string[];
  references?: string[];
  sourceTrace: SourceTrace;
  extractionConfidence: "HIGH" | "LOW";
}

export interface L2ValidationResult {
  validationStatus: "PASS" | "NEEDS_HUMAN_REVIEW";
  normalizedRequirement: L2ExtractionResult;
  issues: string[];
}

export type SubscriptionLevel = "L1" | "L2";

export type AssessmentLevel = 1 | 2;
export type AssessmentStatus = "draft" | "in_progress" | "review" | "complete" | "archived";
export type FirestoreObjectiveStatus = "pending" | "met" | "not_met" | "not_applicable";
export type EvidenceReviewStatus = "uploaded" | "needs_review" | "accepted" | "rejected" | "superseded";

export interface AssessmentDoc {
  assessmentId: string;
  orgId: string;
  frameworkId: string;
  level: AssessmentLevel;
  name: string;
  status: AssessmentStatus;
  state?: string;
  stateVersion?: number;
  ownerUid?: string;
  createdByUid?: string;
  updatedByUid?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface FirestorePracticeRecord {
  practiceId: string;
  orgId: string;
  assessmentId: string;
  frameworkId?: string;
  level?: AssessmentLevel;
  domainId?: string;
  status: PracticeStatus;
  statusSource: StatusSource;
  note?: string;
  implementationSummary?: string;
  responsibility?: ResponsibilityType;
  providerName?: string;
  ownerUid?: string;
  riskRating?: "low" | "medium" | "high" | "critical";
  evidenceCount?: number;
  openPoamCount?: number;
  lastUpdated?: string;
  lastReviewedByUid?: string;
  lastReviewedAt?: any;
  createdByUid?: string;
  updatedByUid?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface FirestoreObjectiveRecord {
  objectiveId: string;
  storageKey?: string;
  orgId: string;
  assessmentId: string;
  practiceId: string;
  frameworkId?: string;
  level?: AssessmentLevel;
  domainId?: string;
  sequence?: number;
  status: FirestoreObjectiveStatus;
  note?: string;
  noteSummary?: string;
  assessorComment?: string;
  aiGuidanceSummary?: string;
  actionPoints?: string;
  actionPointsSummary?: string;
  evidenceIds?: string[];
  evidenceCount?: number;
  ownerUid?: string;
  lastReviewedByUid?: string;
  lastReviewedAt?: any;
  createdByUid?: string;
  updatedByUid?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface EvidenceRecord {
  evidenceId: string;
  orgId: string;
  assessmentId: string;
  frameworkId?: string;
  practiceIds: string[];
  objectiveIds: string[];
  title?: string;
  description?: string;
  name?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  storagePath?: string;
  sha256?: string;
  ocrSummary?: string;
  processingStatus?: "ocr_failed";
  processingError?: string;
  aiExtractedSignals?: Record<string, any>;
  isFinalForm?: boolean;
  reviewStatus?: EvidenceReviewStatus;
  uploadedByUid?: string;
  uploadedAt?: any;
  reviewedByUid?: string;
  reviewedAt?: any;
  tags?: string[];
  source?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface NoteRecord {
  noteId: string;
  orgId: string;
  assessmentId: string;
  noteType: "assessor_review";
  content: string;
  practiceId?: string;
  objectiveId?: string;
  targetType?: "assessment" | "practice" | "objective" | "evidence" | "poam" | "ssp";
  targetId?: string;
  body?: string;
  visibility?: "internal" | "assessor" | "customer";
  pinned?: boolean;
  createdByUid?: string;
  updatedByUid?: string;
  createdAt?: any;
  updatedAt?: any;
  deletedAt?: any;
}

export interface FirestorePoamItem extends Omit<PoamItem, "source"> {
  poamId: string;
  orgId: string;
  assessmentId: string;
  relatedObjectiveIds?: string[];
  relatedEvidenceIds?: string[];
  ownerUid?: string;
  ownerName?: string;
  source: PoamItem["source"] | "objective_gap" | "ai_generated" | "assessor";
  riskStatement?: string;
  remediationPlan?: string;
  milestones?: Array<{
    title: string;
    status: "open" | "in_progress" | "completed";
    targetDate?: string;
    completedDate?: string;
  }>;
  createdByUid?: string;
  updatedByUid?: string;
  updatedAt?: any;
}

export interface ScoreSnapshot {
  snapshotId: string;
  orgId: string;
  assessmentId: string;
  frameworkId?: string;
  level: AssessmentLevel;
  completionPercent: number;
  totalPractices: number;
  totalObjectives: number;
  metCount: number;
  partialCount: number;
  notMetCount: number;
  notAssessedCount: number;
  evidenceCount: number;
  poamOpenCount: number;
  poamCompletedCount: number;
  practiceCompletionScore: number;
  controlsPostureScore: number;
  overallReadinessScore: number;
  sprsScore?: number;
  counts?: Record<string, number>;
  byDomain?: Record<string, number>;
  byStatus?: Record<string, number>;
  highRiskOpenCount?: number;
  openPoamCount?: number;
  evidenceCoverage?: number;
  generatedByUid?: string;
  createdByUid: string;
  generationReason?: "manual" | "scheduled" | "state_transition" | "ai_run" | "client_mvp";
  source: "client_mvp";
  createdAt?: any;
}

export interface PersistedState {
  version: number;
  subscriptionLevel: SubscriptionLevel; // New field
  companyProfile?: CompanyProfile;
  practiceRecords: PracticeRecord[];
  minedPractices?: Practice[];
  analyzerAnswers: ReadinessAnswers;
  savedReports: SavedReport[];
  poamItems: PoamItem[];
  responsibilityMatrix: ResponsibilityMatrixEntry[];
}

export interface PrepopulatedCmmcFile {
  domains: Array<{
    domain_id: string;
    domain_name: string;
    practices: Array<{
      id: string;
      name: string;
      brief_description: string;
      assessment_objectives: Array<{
        id: string;
        text: string;
      }>;
      potential_assessment_methods_and_objects: TextBlock;
      discussion: TextBlock;
      further_discussion?: TextBlock;
      key_references?: string[];
      sprsWeight?: number;
    }>;
  }>;
  high_risk_practices: string[];
}
