
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
  fileType: string;
  ocrSummary: string;
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
