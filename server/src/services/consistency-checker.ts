// ============================================
// MAGS — Consistency Checker
// Deep cross-document validation service
// ============================================

import type { DocIndexer } from "./doc-indexer.js";
import type { MemoryStore } from "./memory-store.js";
import type { ProgressManager } from "./progress-manager.js";
import type { StackDetector } from "./stack-detector.js";
import type {
  ValidationIssue,
  TechTerm,
  DocEntry,
  ProjectProgress,
} from "../types/index.js";
import { FRONTMATTER_SCHEMAS } from "../config/defaults.js";

const KNOWN_TECH_NAMES = [
  "React",
  "Next\\.js",
  "NestJS",
  "Node\\.js",
  "PostgreSQL",
  "MySQL",
  "Redis",
  "TypeScript",
  "Python",
  "Django",
  "FastAPI",
  "Flask",
  "Vue",
  "Angular",
  "Svelte",
  "Express",
  "Fastify",
  "Hono",
  "MongoDB",
  "SQLite",
  "Prisma",
  "Drizzle",
  "Docker",
  "Kubernetes",
  "Nginx",
  "Caddy",
  "Tailwind",
  "Vite",
  "Webpack",
  "Turborepo",
  "Go",
  "Rust",
  "Java",
  "Spring Boot",
  "Remix",
  "Astro",
  "Expo",
  "Electron",
];

const TECH_REGEX = new RegExp(
  `\\b(${KNOWN_TECH_NAMES.join("|")})\\s+(v?\\d+(?:\\.\\d+)*[+*]?)`,
  "gi"
);

const ADR_REQUIRED_SECTIONS = [
  ["Status", "Durum"],
  ["Context", "Bağlam"],
  ["Decision", "Karar"],
  ["Consequences", "Sonuçlar"],
];

export class ConsistencyChecker {
  constructor(
    private docIndexer: DocIndexer,
    private memoryStore: MemoryStore,
    private progressManager: ProgressManager,
    private stackDetector: StackDetector,
    private projectRoot: string
  ) {}

  extractTechTerms(content: string, doc: string): TechTerm[] {
    const terms: TechTerm[] = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      TECH_REGEX.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = TECH_REGEX.exec(lines[i])) !== null) {
        terms.push({
          name: normalizeTechName(match[1]),
          version: match[2].replace(/^v/, ""),
          doc,
          line: i + 1,
        });
      }
    }

    // Also find tech names without versions
    const nameOnlyRegex = new RegExp(
      `\\b(${KNOWN_TECH_NAMES.join("|")})\\b`,
      "gi"
    );
    for (let i = 0; i < lines.length; i++) {
      nameOnlyRegex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = nameOnlyRegex.exec(lines[i])) !== null) {
        const name = normalizeTechName(match[1]);
        // Only add if we don't already have a versioned entry on this line
        const alreadyHasVersioned = terms.some(
          (t) => t.name === name && t.line === i + 1 && t.version
        );
        if (!alreadyHasVersioned) {
          // Avoid duplicates — only keep one unversioned entry per doc
          const alreadyExists = terms.some(
            (t) => t.name === name && t.doc === doc && !t.version
          );
          if (!alreadyExists) {
            terms.push({ name, doc, line: i + 1 });
          }
        }
      }
    }

    return terms;
  }

  checkVersionConflicts(): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const docs = this.docIndexer.listDocs();
    const allTerms: TechTerm[] = [];

    // Collect tech terms from all docs
    for (const doc of docs) {
      const content = this.docIndexer.getDocContent(doc.name);
      if (!content) continue;
      allTerms.push(...this.extractTechTerms(content, doc.name));
    }

    // Get actual versions from project files
    const projectVersions = this.stackDetector.extractVersions(this.projectRoot);

    // Group versioned terms by tech name
    const versionedTerms = allTerms.filter((t) => t.version);
    const grouped = new Map<string, TechTerm[]>();
    for (const term of versionedTerms) {
      const existing = grouped.get(term.name) || [];
      existing.push(term);
      grouped.set(term.name, existing);
    }

    // Check cross-document conflicts
    for (const [techName, terms] of grouped) {
      const majors = new Map<string, TechTerm[]>();
      for (const term of terms) {
        const major = getMajorVersion(term.version!);
        const existing = majors.get(major) || [];
        existing.push(term);
        majors.set(major, existing);
      }

      if (majors.size > 1) {
        const details = terms
          .map((t) => `${t.doc}: ${t.name} ${t.version}`)
          .join(", ");
        issues.push({
          type: "version_conflict",
          doc: terms[0].doc,
          detail: `Major version conflict for ${techName}: ${details}`,
          severity: "error",
        });
      }
    }

    // Check doc versions vs package.json
    for (const [techName, terms] of grouped) {
      const projectVer = projectVersions[techName];
      if (!projectVer) continue;

      const projectMajor = getMajorVersion(projectVer);
      for (const term of terms) {
        const docMajor = getMajorVersion(term.version!);
        if (docMajor !== projectMajor) {
          issues.push({
            type: "version_conflict",
            doc: term.doc,
            detail: `${techName} version mismatch: doc says ${term.version}, package.json says ${projectVer}`,
            severity: "error",
          });
        } else if (term.version !== projectVer && !term.version!.endsWith("+")) {
          issues.push({
            type: "version_drift",
            doc: term.doc,
            detail: `${techName} minor version drift: doc says ${term.version}, package.json says ${projectVer}`,
            severity: "info",
          });
        }
      }
    }

    return issues;
  }

  checkMemoryDocConsistency(): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const memories = this.memoryStore.getAll();
    const decisions = memories.filter((m) => m.category === "decisions");

    if (decisions.length === 0) return issues;

    const docs = this.docIndexer.listDocs();

    for (const decision of decisions) {
      // Search docs for related content using both keywords and the key itself
      const keywords = extractKeywords(decision.value);
      const keyTerms = decision.key.split(/[_\-\s]+/).filter((t) => t.length > 2);
      const allTerms = [...keywords, ...keyTerms];

      if (allTerms.length === 0) continue;

      for (const doc of docs) {
        const content = this.docIndexer.getDocContent(doc.name);
        if (!content) continue;

        // Check if doc discusses the same topic
        const topicMatch = allTerms.some((kw) =>
          content.toLowerCase().includes(kw.toLowerCase())
        );
        if (!topicMatch) continue;

        // Check for technology/strategy contradiction
        const contradiction = detectContradiction(decision.value, content);
        if (contradiction) {
          issues.push({
            type: "memory_doc_conflict",
            doc: doc.name,
            detail: `Memory "${decision.key}" may conflict with doc: ${contradiction}`,
            severity: "warning",
          });
        }
      }
    }

    return issues;
  }

  validateFrontmatterSchemas(): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const docs = this.docIndexer.listDocs();

    for (const doc of docs) {
      const schemaKey = getSchemaKey(doc);
      const schema = FRONTMATTER_SCHEMAS[schemaKey] || FRONTMATTER_SCHEMAS.default;

      for (const field of schema.required) {
        const val = doc.metadata[field];
        const hasField = val !== undefined && val !== null && val !== "";

        // Check camelCase variant (e.g., last_updated → lastUpdated)
        const camelField = field.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
        const camelVal = doc.metadata[camelField];
        const hasCamelField = camelVal !== undefined && camelVal !== null && camelVal !== "";

        if (!hasField && !hasCamelField) {
          issues.push({
            type: "frontmatter_missing",
            doc: doc.name,
            detail: `Missing required frontmatter field: "${field}" (schema: ${schemaKey})`,
            severity: schemaKey === "adr" ? "error" : "warning",
          });
        }
      }

      // Check ADR status values
      if (schemaKey === "adr" && schema.status_values && doc.metadata.status) {
        const status = String(doc.metadata.status).toLowerCase();
        if (!schema.status_values.includes(status)) {
          issues.push({
            type: "invalid_status",
            doc: doc.name,
            detail: `Invalid ADR status "${doc.metadata.status}". Valid values: ${schema.status_values.join(", ")}`,
            severity: "warning",
          });
        }
      }
    }

    return issues;
  }

  validateADRStructure(): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const docs = this.docIndexer.listDocs();

    for (const doc of docs) {
      if (!isADR(doc)) continue;

      const content = this.docIndexer.getDocContent(doc.name);
      if (!content) continue;

      const headings = content
        .split("\n")
        .filter((l) => /^#{1,3}\s/.test(l))
        .map((l) => l.replace(/^#+\s*/, "").trim());

      for (const [enName, trName] of ADR_REQUIRED_SECTIONS) {
        const found = headings.some(
          (h) =>
            h.toLowerCase() === enName.toLowerCase() ||
            h.toLowerCase() === trName.toLowerCase()
        );

        // Accept frontmatter "status" as alternative to ## Status / ## Durum heading
        if (!found && enName === "Status") {
          const fmStatus = doc.metadata?.status;
          if (fmStatus && String(fmStatus).trim() !== "") {
            continue; // frontmatter has status — no heading needed
          }
        }

        if (!found) {
          issues.push({
            type: "adr_missing_section",
            doc: doc.name,
            detail: `ADR missing required section: "${enName}" (or "${trName}")`,
            severity: "warning",
          });
        }
      }

      // Check status value — from heading section OR frontmatter
      const statusContent = this.docIndexer.getDocContent(doc.name, "Status") ||
        this.docIndexer.getDocContent(doc.name, "Durum");
      const fmStatus = doc.metadata?.status ? String(doc.metadata.status).toLowerCase().trim() : "";
      const validStatuses = FRONTMATTER_SCHEMAS.adr.status_values || [];

      if (statusContent) {
        const hasValidStatus = validStatuses.some((s) =>
          statusContent.toLowerCase().includes(s)
        );
        if (!hasValidStatus) {
          issues.push({
            type: "adr_invalid_status",
            doc: doc.name,
            detail: `ADR Status section does not contain a valid status value`,
            severity: "warning",
          });
        }
      } else if (fmStatus) {
        // No heading — validate frontmatter status value
        if (!validStatuses.includes(fmStatus)) {
          issues.push({
            type: "adr_invalid_status",
            doc: doc.name,
            detail: `ADR frontmatter status "${doc.metadata.status}" is not valid. Valid values: ${validStatuses.join(", ")}`,
            severity: "warning",
          });
        }
      }
    }

    return issues;
  }

  checkModuleCompleteness(): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const progress = this.progressManager.getProgress() as ProjectProgress | null;
    if (!progress) return issues;

    const docs = this.docIndexer.listDocs();

    for (const mod of progress.modules) {
      const moduleName = mod.name.toLowerCase();

      // Check PRD
      const hasPRD = docs.some((d) => {
        if (!d.name.toLowerCase().includes("prd")) return false;
        const content = this.docIndexer.getDocContent(d.name);
        return content ? content.toLowerCase().includes(moduleName) : false;
      });
      if (!hasPRD) {
        issues.push({
          type: "module_incomplete",
          doc: mod.name,
          detail: `Module "${mod.name}" not found in any PRD document`,
          severity: "warning",
        });
      }

      // Check data-model
      const hasDataModel = docs.some((d) => {
        if (!d.name.toLowerCase().includes("data-model") && !d.name.toLowerCase().includes("data_model")) return false;
        const content = this.docIndexer.getDocContent(d.name);
        return content ? content.toLowerCase().includes(moduleName) : false;
      });
      if (!hasDataModel) {
        issues.push({
          type: "module_incomplete",
          doc: mod.name,
          detail: `Module "${mod.name}" not found in data model document`,
          severity: "warning",
        });
      }

      // Check api-design
      const hasAPI = docs.some((d) => {
        if (!d.name.toLowerCase().includes("api")) return false;
        const content = this.docIndexer.getDocContent(d.name);
        return content ? content.toLowerCase().includes(moduleName) : false;
      });
      if (!hasAPI) {
        issues.push({
          type: "module_incomplete",
          doc: mod.name,
          detail: `Module "${mod.name}" not found in API design document`,
          severity: "warning",
        });
      }
    }

    return issues;
  }

  async runDeepValidation(): Promise<ValidationIssue[]> {
    const [versions, memory, frontmatter, adr, modules] = await Promise.all([
      this.checkVersionConflicts(),
      this.checkMemoryDocConsistency(),
      this.validateFrontmatterSchemas(),
      this.validateADRStructure(),
      this.checkModuleCompleteness(),
    ]);
    return [...versions, ...memory, ...frontmatter, ...adr, ...modules];
  }
}

// --- Helpers ---

function normalizeTechName(name: string): string {
  const map: Record<string, string> = {
    "next.js": "Next.js",
    nextjs: "Next.js",
    nestjs: "NestJS",
    "node.js": "Node.js",
    nodejs: "Node.js",
    postgresql: "PostgreSQL",
    postgres: "PostgreSQL",
    mysql: "MySQL",
    redis: "Redis",
    typescript: "TypeScript",
    react: "React",
    vue: "Vue",
    angular: "Angular",
    svelte: "Svelte",
    express: "Express",
    fastify: "Fastify",
    python: "Python",
    django: "Django",
    fastapi: "FastAPI",
    flask: "Flask",
    mongodb: "MongoDB",
    sqlite: "SQLite",
    prisma: "Prisma",
    drizzle: "Drizzle",
    docker: "Docker",
    kubernetes: "Kubernetes",
    tailwind: "Tailwind",
    vite: "Vite",
    go: "Go",
    rust: "Rust",
    java: "Java",
    "spring boot": "Spring Boot",
    hono: "Hono",
    remix: "Remix",
    astro: "Astro",
    expo: "Expo",
    electron: "Electron",
    nginx: "Nginx",
    caddy: "Caddy",
    webpack: "Webpack",
    turborepo: "Turborepo",
  };
  return map[name.toLowerCase()] || name;
}

function getMajorVersion(version: string): string {
  const clean = version.replace(/[+*]$/, "");
  const parts = clean.split(".");
  return parts[0];
}

function getSchemaKey(doc: DocEntry): string {
  if (doc.name.startsWith("adr-") || doc.name.startsWith("adr/")) return "adr";
  if (doc.relativePath && doc.relativePath.includes("adr/")) return "adr";
  return "default";
}

function isADR(doc: DocEntry): boolean {
  return getSchemaKey(doc) === "adr";
}

function extractKeywords(text: string): string[] {
  // Extract meaningful tech/strategy terms from memory value
  const techTerms = text.match(
    /\b(?:React|Next\.js|NestJS|Node\.js|PostgreSQL|MySQL|Redis|TypeScript|JWT|session[- ]based|OAuth|GraphQL|REST|gRPC|Docker|Kubernetes|in[- ]memory|cache|queue|event[- ]driven|microservice|monolith)\b/gi
  );
  return techTerms ? [...new Set(techTerms)] : [];
}

function detectContradiction(
  memoryValue: string,
  docContent: string
): string | null {
  // Technology pairs that are contradictory strategies
  const contradictionPairs: [RegExp, RegExp, string][] = [
    [/\bjwt\b/i, /\bsession[- ]based\b/i, "JWT vs session-based auth"],
    [/\brest\b/i, /\bgraphql\b/i, "REST vs GraphQL API style"],
    [/\bmonolith\b/i, /\bmicroservice/i, "Monolith vs microservices"],
    [/\bin[- ]memory\s+cache\b/i, /\bredis\b/i, "In-memory cache vs Redis"],
    [/\bmysql\b/i, /\bpostgresql\b/i, "MySQL vs PostgreSQL"],
    [/\bmongodb\b/i, /\bpostgresql\b/i, "MongoDB vs PostgreSQL"],
  ];

  for (const [patternA, patternB, description] of contradictionPairs) {
    const memHasA = patternA.test(memoryValue);
    const memHasB = patternB.test(memoryValue);
    const docHasA = patternA.test(docContent);
    const docHasB = patternB.test(docContent);

    // Memory mentions A but not B, doc mentions B but not A → contradiction
    if (memHasA && !memHasB && docHasB && !docHasA) return description;
    // Memory mentions B but not A, doc mentions A but not B → contradiction
    if (memHasB && !memHasA && docHasA && !docHasB) return description;
  }

  return null;
}
