import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConsistencyChecker } from "./consistency-checker.js";
import type { DocEntry, MemoryEntry } from "../types/index.js";

// --- Mock factories ---

function createMockDocIndexer(docs: Array<{ name: string; content: string; metadata?: Record<string, any>; relativePath?: string }>) {
  const entries: DocEntry[] = docs.map((d) => ({
    name: d.name,
    path: `/docs/${d.name}.md`,
    relativePath: d.relativePath || `${d.name}.md`,
    title: d.metadata?.title || d.name,
    status: d.metadata?.status,
    lastUpdated: d.metadata?.last_updated,
    wordCount: d.content.split(/\s+/).length,
    sections: [],
    metadata: { title: d.metadata?.title || "", ...d.metadata } as any,
  }));

  return {
    listDocs: vi.fn(() => entries),
    getDocContent: vi.fn((name: string, section?: string) => {
      const doc = docs.find((d) => d.name === name);
      if (!doc) return null;
      if (!section) return doc.content;
      // Simple section extraction
      const regex = new RegExp(`^#{1,3}\\s+${section}\\s*\\n([\\s\\S]*?)(?=^#{1,3}\\s|$)`, "m");
      const match = doc.content.match(regex);
      return match ? match[1].trim() : null;
    }),
    search: vi.fn(() => []),
    getDoc: vi.fn(),
    index: vi.fn(),
    indexAsync: vi.fn(),
    getDocsBySection: vi.fn(() => []),
  };
}

function createMockMemoryStore(memories: MemoryEntry[] = []) {
  return {
    getAll: vi.fn(() => memories),
    recall: vi.fn(async () => []),
    remember: vi.fn(),
    forget: vi.fn(),
    get: vi.fn(),
    close: vi.fn(),
    load: vi.fn(),
    setEmbeddingProvider: vi.fn(),
    getCapacity: vi.fn(),
  };
}

function createMockStackDetector(versions: Record<string, string> = {}) {
  return {
    detect: vi.fn(() => ({
      languages: [],
      frameworks: [],
      databases: [],
      apiStyle: [],
      packageManager: "",
      versions,
    })),
    extractVersions: vi.fn(() => versions),
  };
}

function createMemoryEntry(overrides: Partial<MemoryEntry>): MemoryEntry {
  return {
    id: "1",
    key: "test",
    value: "test value",
    category: "notes",
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// --- Tests ---

describe("ConsistencyChecker", () => {
  describe("extractTechTerms", () => {
    it("extracts versioned tech terms", () => {
      const checker = new ConsistencyChecker(
        createMockDocIndexer([]) as any,
        createMockMemoryStore() as any,
        createMockStackDetector() as any,
        "/tmp"
      );

      const terms = checker.extractTechTerms("We use React 19 and Node.js 20+", "test-doc");
      const versioned = terms.filter((t) => t.version);
      expect(versioned).toContainEqual(
        expect.objectContaining({ name: "React", version: "19" })
      );
      expect(versioned).toContainEqual(
        expect.objectContaining({ name: "Node.js", version: "20+" })
      );
    });

    it("extracts tech name without version", () => {
      const checker = new ConsistencyChecker(
        createMockDocIndexer([]) as any,
        createMockMemoryStore() as any,
        createMockStackDetector() as any,
        "/tmp"
      );

      const terms = checker.extractTechTerms("PostgreSQL is our database", "test-doc");
      expect(terms).toContainEqual(
        expect.objectContaining({ name: "PostgreSQL", doc: "test-doc" })
      );
    });

    it("returns empty for empty content", () => {
      const checker = new ConsistencyChecker(
        createMockDocIndexer([]) as any,
        createMockMemoryStore() as any,
        createMockStackDetector() as any,
        "/tmp"
      );

      const terms = checker.extractTechTerms("", "test-doc");
      expect(terms).toEqual([]);
    });

    it("extracts NestJS version", () => {
      const checker = new ConsistencyChecker(
        createMockDocIndexer([]) as any,
        createMockMemoryStore() as any,
        createMockStackDetector() as any,
        "/tmp"
      );

      const terms = checker.extractTechTerms("NestJS 11 is the backend framework", "test-doc");
      const versioned = terms.filter((t) => t.version);
      expect(versioned).toContainEqual(
        expect.objectContaining({ name: "NestJS", version: "11" })
      );
    });
  });

  describe("checkVersionConflicts", () => {
    it("detects cross-document major version conflict", () => {
      const docIndexer = createMockDocIndexer([
        { name: "tech-stack", content: "We use React 19 for frontend" },
        { name: "claude-md", content: "React 18 is the current version" },
      ]);

      const checker = new ConsistencyChecker(
        docIndexer as any,
        createMockMemoryStore() as any,
        createMockStackDetector() as any,
        "/tmp"
      );

      const issues = checker.checkVersionConflicts();
      expect(issues.some((i) => i.type === "version_conflict")).toBe(true);
    });

    it("passes when doc and package.json agree on major version", () => {
      const docIndexer = createMockDocIndexer([
        { name: "tech-stack", content: "We use React 19" },
      ]);

      const checker = new ConsistencyChecker(
        docIndexer as any,
        createMockMemoryStore() as any,
        createMockStackDetector({ React: "19.0.0" }) as any,
        "/tmp"
      );

      const issues = checker.checkVersionConflicts();
      const errors = issues.filter((i) => i.severity === "error");
      expect(errors).toHaveLength(0);
    });

    it("detects doc vs package.json major version mismatch", () => {
      const docIndexer = createMockDocIndexer([
        { name: "tech-stack", content: "We use React 19" },
      ]);

      const checker = new ConsistencyChecker(
        docIndexer as any,
        createMockMemoryStore() as any,
        createMockStackDetector({ React: "18.2.0" }) as any,
        "/tmp"
      );

      const issues = checker.checkVersionConflicts();
      expect(issues.some((i) => i.type === "version_conflict" && i.severity === "error")).toBe(true);
    });
  });

  describe("checkMemoryDocConsistency", () => {
    it("detects JWT vs session-based contradiction", () => {
      const docIndexer = createMockDocIndexer([
        { name: "auth-design", content: "Authentication uses session-based approach with cookies" },
      ]);

      const memoryStore = createMockMemoryStore([
        createMemoryEntry({ key: "auth_strategy", value: "Use JWT for authentication", category: "decisions" }),
      ]);

      const checker = new ConsistencyChecker(
        docIndexer as any,
        memoryStore as any,
        createMockStackDetector() as any,
        "/tmp"
      );

      const issues = checker.checkMemoryDocConsistency();
      expect(issues.some((i) => i.type === "memory_doc_conflict")).toBe(true);
    });

    it("passes when memory and doc agree", () => {
      const docIndexer = createMockDocIndexer([
        { name: "tech-stack", content: "We use PostgreSQL as our primary database" },
      ]);

      const memoryStore = createMockMemoryStore([
        createMemoryEntry({ key: "db_choice", value: "Use PostgreSQL", category: "decisions" }),
      ]);

      const checker = new ConsistencyChecker(
        docIndexer as any,
        memoryStore as any,
        createMockStackDetector() as any,
        "/tmp"
      );

      const issues = checker.checkMemoryDocConsistency();
      expect(issues.filter((i) => i.type === "memory_doc_conflict")).toHaveLength(0);
    });
  });

  describe("validateFrontmatterSchemas", () => {
    it("reports missing status for ADR", () => {
      const docIndexer = createMockDocIndexer([
        {
          name: "adr-001-auth",
          content: "# ADR 001",
          metadata: { title: "Auth Decision" },
          relativePath: "adr/adr-001-auth.md",
        },
      ]);

      const checker = new ConsistencyChecker(
        docIndexer as any,
        createMockMemoryStore() as any,
        createMockStackDetector() as any,
        "/tmp"
      );

      const issues = checker.validateFrontmatterSchemas();
      expect(issues.some((i) => i.type === "frontmatter_missing" && i.detail.includes("status"))).toBe(true);
    });

    it("reports missing title for default doc", () => {
      const docIndexer = createMockDocIndexer([
        {
          name: "notes",
          content: "Some notes",
          metadata: {},
        },
      ]);

      const checker = new ConsistencyChecker(
        docIndexer as any,
        createMockMemoryStore() as any,
        createMockStackDetector() as any,
        "/tmp"
      );

      const issues = checker.validateFrontmatterSchemas();
      expect(issues.some((i) => i.type === "frontmatter_missing" && i.detail.includes("title"))).toBe(true);
    });

    it("reports invalid ADR status value", () => {
      const docIndexer = createMockDocIndexer([
        {
          name: "adr-002-db",
          content: "# ADR 002",
          metadata: { title: "DB Choice", status: "INVALID", last_updated: "2025-01-01" },
          relativePath: "adr/adr-002-db.md",
        },
      ]);

      const checker = new ConsistencyChecker(
        docIndexer as any,
        createMockMemoryStore() as any,
        createMockStackDetector() as any,
        "/tmp"
      );

      const issues = checker.validateFrontmatterSchemas();
      expect(issues.some((i) => i.type === "invalid_status")).toBe(true);
    });
  });

  describe("validateADRStructure", () => {
    it("detects missing Decision section", () => {
      const docIndexer = createMockDocIndexer([
        {
          name: "adr-001",
          content: "# ADR 001\n\n## Status\nAccepted\n\n## Context\nSome context\n\n## Consequences\nSome consequences",
          metadata: { title: "ADR 001" },
          relativePath: "adr/adr-001.md",
        },
      ]);

      const checker = new ConsistencyChecker(
        docIndexer as any,
        createMockMemoryStore() as any,
        createMockStackDetector() as any,
        "/tmp"
      );

      const issues = checker.validateADRStructure();
      expect(issues.some((i) => i.type === "adr_missing_section" && i.detail.includes("Decision"))).toBe(true);
    });

    it("passes for complete ADR", () => {
      const docIndexer = createMockDocIndexer([
        {
          name: "adr-001",
          content: "# ADR 001\n\n## Status\nAccepted\n\n## Context\nSome context\n\n## Decision\nWe decided X\n\n## Consequences\nSome consequences",
          metadata: { title: "ADR 001" },
          relativePath: "adr/adr-001.md",
        },
      ]);

      const checker = new ConsistencyChecker(
        docIndexer as any,
        createMockMemoryStore() as any,
        createMockStackDetector() as any,
        "/tmp"
      );

      const issues = checker.validateADRStructure();
      expect(issues.filter((i) => i.type === "adr_missing_section")).toHaveLength(0);
    });
  });

  describe("runDeepValidation", () => {
    it("aggregates issues from all checkers", async () => {
      const docIndexer = createMockDocIndexer([
        {
          name: "adr-001",
          content: "# ADR\n\n## Context\nContext",
          metadata: { title: "ADR" },
          relativePath: "adr/adr-001.md",
        },
      ]);

      const checker = new ConsistencyChecker(
        docIndexer as any,
        createMockMemoryStore() as any,
        createMockStackDetector() as any,
        "/tmp"
      );

      const issues = await checker.runDeepValidation();
      // Should have at least ADR structure issues and frontmatter issues
      expect(issues.length).toBeGreaterThan(0);
    });
  });
});
