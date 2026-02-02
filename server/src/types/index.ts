// ============================================
// MAGS — Memory And Guidance System
// Type Definitions
// ============================================

// --- Config ---

export type ArchitectureType =
  | "monolith"
  | "microservices"
  | "library"
  | "cli"
  | "mobile"
  | "serverless";

export interface ModuleDefinition {
  name: string;
  aliases: string[];
}

export interface DetectedStack {
  languages: string[];
  frameworks: string[];
  databases: string[];
  apiStyle: string[];
  packageManager: string;
}

export interface StackConfig {
  primaryLanguage?: string;
  languages?: string[];
  frameworks?: string[];
  databases?: string[];
  apiStyle?: string[];
  packageManager?: string;
}

export interface TemplatePackManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  templates: string[];
}

export interface MagsConfig {
  docsDir: string;
  magsDir: string;
  templates: "general" | "saas" | "mobile" | "cli" | "custom";
  autoSessionSave: boolean;
  autoSessionLoad: boolean;
  docValidation: boolean;
  locale: string;
  architecture?: ArchitectureType;
  modules?: ModuleDefinition[];
  stack?: StackConfig;
  customTemplatePacks?: string[];
  embedding: {
    provider: "local" | "openai";
    openaiApiKey?: string;
    openaiModel?: string;
  };
}

export const DEFAULT_CONFIG: MagsConfig = {
  docsDir: "docs",
  magsDir: "docs/.mags",
  templates: "general",
  autoSessionSave: true,
  autoSessionLoad: true,
  docValidation: true,
  locale: "en",
  embedding: {
    provider: "local",
  },
};

// --- Document ---

export interface DocMetadata {
  title: string;
  version?: string;
  status?: "DRAFT" | "LOCKED" | "REVIEW" | "ACCEPTED";
  author?: string;
  lastUpdated?: string;
  tags?: string[];
  [key: string]: unknown;
}

export interface DocEntry {
  name: string;
  path: string;
  relativePath: string;
  title: string;
  status?: string;
  lastUpdated?: string;
  wordCount: number;
  sections: string[];
  metadata: DocMetadata;
}

export interface DocSearchResult {
  doc: string;
  section: string;
  snippet: string;
  score: number;
}

// --- Memory ---

export interface MemoryEntry {
  id: string;
  key: string;
  value: string;
  category?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  embedding?: number[];
}

export interface ScoredMemory extends MemoryEntry {
  score: number;
}

// --- Progress ---

export type ModuleStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "blocked";

export interface ProgressItem {
  name: string;
  status: ModuleStatus;
  notes?: string;
}

export interface ModuleProgress {
  name: string;
  status: ModuleStatus;
  phase: number;
  priority: number;
  dependsOn: string[];
  items: ProgressItem[];
  completionPercent: number;
  category?: "feature" | "tech-debt" | "migration";
}

export interface ProjectProgress {
  project: string;
  phase: number;
  startedAt: string;
  modules: ModuleProgress[];
}

// --- Session ---

export interface SessionEntry {
  sessionId: string;
  date: string;
  summary: string;
  decisions: string[];
  completed: string[];
  nextSteps: string[];
  blockers: string[];
  memoryUpdates?: string[];
}

// --- Validation ---

export type IssueSeverity = "error" | "warning" | "info";

export interface ValidationIssue {
  type: string;
  doc: string;
  detail: string;
  severity: IssueSeverity;
}

export interface ValidationResult {
  issues: ValidationIssue[];
  score: number;
  checkedAt: string;
}

// --- Embedding ---

export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  search(
    query: string,
    entries: MemoryEntry[],
    limit?: number
  ): Promise<ScoredMemory[]>;
}

// --- Template ---

export interface TemplateVariable {
  name: string;
  description: string;
  required: boolean;
  default?: string;
}

export interface DocTemplate {
  name: string;
  description: string;
  filename: string;
  variables: TemplateVariable[];
  content: string;
}

// --- Scaffold ---

export interface ScaffoldFile {
  path: string;
  content: string;
}

// --- Changelog ---

export interface ChangelogEntry {
  type: "feat" | "fix" | "refactor" | "docs" | "chore" | "breaking";
  scope?: string;
  message: string;
  hash?: string;
  date?: string;
}
