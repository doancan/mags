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
  versions: Record<string, string>;
}

export interface TechTerm {
  name: string;
  version?: string;
  doc: string;
  line?: number;
}

export interface FrontmatterSchema {
  required: string[];
  status_values?: string[];
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
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  embedding?: number[];
}

export interface ScoredMemory extends MemoryEntry {
  score: number;
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
