// ============================================
// MAGS — Project Orchestrator Types
// ============================================

// --- PRD Parsing ---

export type Priority = "P0" | "P1" | "P2";
export type PhaseNumber = 1 | 2 | 3;

export interface Feature {
  id: string;           // "M1-001"
  name: string;         // "Login"
  description: string;
  priority: Priority;
  phase: PhaseNumber;
  status: "pending" | "in_progress" | "completed" | "skipped";
}

export interface ModuleDependencies {
  requires: string[];   // Modules this depends on
  blocks: string[];     // Modules waiting for this
}

export interface ExtractedModule {
  id: string;           // "M1"
  name: string;         // "auth"
  description: string;
  features: Feature[];
  acceptanceCriteria: string[];
  dependencies: ModuleDependencies;
  phase: PhaseNumber;
  priority: Priority;
}

export interface Phase {
  phase: PhaseNumber;
  name: string;         // "MVP", "Growth", "Scale"
  modules: string[];    // Module names
}

export interface DependencyNode {
  module: string;
  dependsOn: string[];
  blockedBy: string[];
}

export interface ExtractedPlan {
  version: string;
  extractedAt: string;
  source: string;       // PRD file path
  project: {
    name: string;
    overview: string;
  };
  phases: Phase[];
  modules: ExtractedModule[];
  totalFeatures: number;
  dependencyGraph: DependencyNode[];
}

// --- Validation ---

export interface PrdValidationError {
  line?: number;
  type: "format" | "reference" | "dependency" | "missing";
  message: string;
  suggestion?: string;
}

export interface PrdValidationResult {
  valid: boolean;
  errors: PrdValidationError[];
  warnings: PrdValidationError[];
}

// --- Execution ---

export type StepType =
  | "scaffold"
  | "code"
  | "test"
  | "migrate"
  | "config"
  | "verify"
  | "document"
  | "checkpoint";

export type StepStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "skipped";

export interface ExecutionStep {
  step: number;
  type: StepType;
  description: string;
  file?: string;
  module: string;
  feature?: string;     // Feature ID
  commands?: string[];
  expectedOutput?: string;
}

export interface StepResult {
  step: number;
  status: StepStatus;
  duration: string;
  output?: string;
  error?: string;
  timestamp: string;
}

export type ExecutionStatus =
  | "idle"
  | "in_progress"
  | "paused"
  | "completed"
  | "failed";

export interface ExecutionCheckpoint {
  lastCommit?: string;
  lastSave: string;
  branch?: string;
}

export interface ExecutionState {
  version: string;
  updatedAt: string;
  status: ExecutionStatus;
  currentPhase: PhaseNumber;
  currentModule: string;
  currentStep: number;
  totalSteps: number;
  completed: {
    modules: string[];
    steps: StepResult[];
  };
  pending: {
    steps: ExecutionStep[];
  };
  errors: ErrorRecord[];
  blockers: ErrorRecord[];
  checkpoint: ExecutionCheckpoint;
}

// --- User Interaction ---

export type UserAction =
  | "approve"     // a
  | "edit"        // e
  | "skip"        // s
  | "retry"       // r
  | "next"        // n
  | "previous"    // p
  | "quit"        // q
  | "help"        // h
  | "details"     // d
  | "list";       // l

export interface StepPrompt {
  step: number;
  totalSteps: number;
  title: string;
  description: string;
  file?: string;
  actions: string[];    // PRD references
  availableActions: UserAction[];
}

// --- Error Handling ---

export type ErrorSeverity = "info" | "warning" | "error" | "blocker";

export interface ErrorRecord {
  id: string;
  severity: ErrorSeverity;
  type: string;
  message: string;
  step?: number;
  file?: string;
  timestamp: string;
  suggestions: string[];
  resolved: boolean;
  resolution?: string;
}

export interface RecoveryOption {
  key: string;          // Shortcut key
  label: string;
  description: string;
  action: () => Promise<void>;
}

// --- TDD Verification ---

export type TestCategory =
  | "unit"
  | "integration"
  | "e2e"
  | "isolation"
  | "permission";

export interface TestResult {
  name: string;
  file: string;
  line?: number;
  status: "pass" | "fail" | "skip";
  duration: string;
  error?: string;
}

export interface CategoryResult {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  coverage?: number;
}

export interface AcceptanceCriteriaVerification {
  criteria: string;
  testFile?: string;
  testName?: string;
  status: "verified" | "unverified" | "failed";
}

export interface VerificationReport {
  module: string;
  timestamp: string;
  status: "passed" | "failed" | "partial";
  tests: Record<TestCategory, CategoryResult>;
  results: TestResult[];
  acceptance: AcceptanceCriteriaVerification[];
  coverageTotal: number;
}

// --- Skill/Agent Generation ---

export interface GeneratedSkill {
  name: string;         // "{module}-dev"
  path: string;
  content: string;
  module: string;
  features: string[];   // Feature IDs covered
}

export interface GeneratedAgent {
  name: string;         // "{module}-builder"
  path: string;
  content: string;
  module: string;
  type: "core" | "module";
}

export type CoreAgentType =
  | "project-manager"
  | "business-analyst"
  | "backend-builder"
  | "frontend-builder"
  | "api-designer"
  | "db-modeler"
  | "test-writer"
  | "doc-writer";

export type CoreSkillType =
  | "backend-dev"
  | "frontend-dev"
  | "api-dev"
  | "database-dev"
  | "testing"
  | "documentation";

// --- Deep Analysis (Brownfield) ---

export interface DiscoveredEndpoint {
  method: string;       // GET, POST, etc.
  path: string;
  file: string;
  line: number;
  handler: string;
}

export interface DiscoveredTable {
  name: string;
  columns: string[];
  file: string;
  relations: string[];
}

export interface DiscoveredModule {
  name: string;
  path: string;
  confidence: number;   // 0-100
  files: string[];
  endpoints: DiscoveredEndpoint[];
  tables: DiscoveredTable[];
}

export interface TechDebtItem {
  type: "todo" | "fixme" | "deprecated" | "unused" | "hack" | "xxx" | "bug";
  message: string;
  file: string;
  line: number;
}

export interface CodeAnalysisResult {
  timestamp: string;
  projectName: string;
  stack: {
    languages: string[];
    frameworks: string[];
    databases: string[];
  };
  modules: DiscoveredModule[];
  endpoints: DiscoveredEndpoint[];
  tables: DiscoveredTable[];
  techDebt: TechDebtItem[];
  testCoverage: number;
  patterns: string[];
  conventions: Record<string, string>;
}

export interface ReversePrd {
  generatedAt: string;
  source: "analysis";
  project: {
    name: string;
    overview: string;
  };
  stack: CodeAnalysisResult["stack"];
  modules: Array<{
    id: string;
    name: string;
    confidence: number;
    existingFeatures: Array<{
      id: string;
      name: string;
      status: "complete" | "partial" | "missing";
      files: string[];
    }>;
    missingFeatures: string[];
    techDebt: TechDebtItem[];
  }>;
  dependencyGraph: DependencyNode[];
  recommendations: string[];
}
