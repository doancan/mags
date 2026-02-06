import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DocIndexer } from "../server/src/services/doc-indexer.js";
import { MemoryStore } from "../server/src/services/memory-store.js";
import { ProgressManager } from "../server/src/services/progress-manager.js";
import { StackDetector } from "../server/src/services/stack-detector.js";
import { ConsistencyChecker } from "../server/src/services/consistency-checker.js";
import { LocalEmbeddingProvider } from "../server/src/services/embedding/local.js";

describe("Deep Validation Integration", () => {
  let tmpDir: string;
  let docsDir: string;
  let magsDir: string;
  let docIndexer: DocIndexer;
  let memoryStore: MemoryStore;
  let progressManager: ProgressManager;
  let stackDetector: StackDetector;

  beforeAll(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), "mags-deep-test-"));
    docsDir = join(tmpDir, "docs");
    magsDir = join(tmpDir, "docs", ".mags");
    mkdirSync(docsDir, { recursive: true });
    mkdirSync(magsDir, { recursive: true });
    mkdirSync(join(docsDir, "adr"), { recursive: true });

    // Create test documents
    writeFileSync(
      join(docsDir, "tech-stack.md"),
      `---
title: Tech Stack
status: draft
last_updated: "2025-01-01"
---

# Tech Stack

## Frontend
React 19 with Next.js 15

## Backend
NestJS 11 with TypeScript 5.5

## Database
PostgreSQL 16
`
    );

    writeFileSync(
      join(docsDir, "prd.md"),
      `---
title: Product Requirements
status: draft
last_updated: "2025-01-01"
---

# PRD

## Auth Module
Authentication and authorization features.

## CRM Module
Customer relationship management.
`
    );

    writeFileSync(
      join(docsDir, "data-model.md"),
      `---
title: Data Model
status: draft
last_updated: "2025-01-01"
---

# Data Model

## Auth Tables
Users, roles, permissions.

## CRM Tables
Customers, contacts.
`
    );

    writeFileSync(
      join(docsDir, "api-design.md"),
      `---
title: API Design
status: draft
last_updated: "2025-01-01"
---

# API Design

## Auth Endpoints
POST /api/auth/login

## CRM Endpoints
GET /api/crm/customers
`
    );

    // ADR with missing section
    writeFileSync(
      join(docsDir, "adr", "adr-001-auth.md"),
      `---
title: Auth Strategy
status: accepted
last_updated: "2025-01-01"
---

# ADR 001: Auth Strategy

## Status
Accepted

## Context
We need authentication.

## Decision
Use JWT tokens.
`
    );

    // ADR with frontmatter status only (no ## Status heading)
    writeFileSync(
      join(docsDir, "adr", "adr-003-frontmatter-status.md"),
      `---
title: Caching Strategy
status: proposed
last_updated: "2025-01-01"
---

# ADR 003: Caching Strategy

## Context
We need caching for performance.

## Decision
Use Redis for caching.

## Consequences
Adds an external dependency.
`
    );

    // ADR with invalid status
    writeFileSync(
      join(docsDir, "adr", "adr-002-db.md"),
      `---
title: DB Choice
status: INVALID_STATUS
last_updated: "2025-01-01"
---

# ADR 002: DB Choice

## Status
Active

## Context
We need a database.

## Decision
Use PostgreSQL.

## Consequences
Need to manage migrations.
`
    );

    // Create package.json with version info
    writeFileSync(
      join(tmpDir, "package.json"),
      JSON.stringify({
        dependencies: {
          react: "^19.0.0",
          next: "^15.0.0",
          "@nestjs/core": "^11.0.0",
          pg: "^8.12.0",
        },
        devDependencies: {
          typescript: "^5.5.0",
        },
      })
    );

    // Initialize services
    docIndexer = new DocIndexer(docsDir);
    await docIndexer.indexAsync();

    memoryStore = new MemoryStore(magsDir);
    memoryStore.setEmbeddingProvider(new LocalEmbeddingProvider());

    // Add a decision memory
    await memoryStore.remember(
      "auth_strategy",
      "Use JWT for authentication",
      "decisions",
      ["auth"]
    );

    progressManager = new ProgressManager(magsDir);
    progressManager.initialize("test-project", [
      {
        name: "auth",
        status: "not_started",
        phase: 1,
        priority: 1,
        dependsOn: [],
        items: [],
      },
      {
        name: "payments",
        status: "not_started",
        phase: 2,
        priority: 2,
        dependsOn: ["auth"],
        items: [],
      },
    ]);

    stackDetector = new StackDetector();
  });

  afterAll(() => {
    try {
      memoryStore.close();
    } catch {
      // ignore
    }
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("runs deep validation and returns issues", async () => {
    const checker = new ConsistencyChecker(
      docIndexer,
      memoryStore,
      progressManager,
      stackDetector,
      tmpDir
    );

    const issues = await checker.runDeepValidation();
    expect(issues.length).toBeGreaterThan(0);

    // Should detect ADR with missing Consequences section (adr-001)
    const adrIssues = issues.filter((i) => i.type === "adr_missing_section");
    expect(adrIssues.length).toBeGreaterThan(0);

    // adr-003 uses frontmatter status only (no ## Status heading)
    // — should NOT produce a missing Status section warning
    const adr003StatusIssues = adrIssues.filter(
      (i) => i.doc.includes("adr-003") && i.detail.includes("Status")
    );
    expect(adr003StatusIssues).toHaveLength(0);

    // Should detect invalid ADR status
    const statusIssues = issues.filter((i) => i.type === "invalid_status");
    expect(statusIssues.length).toBeGreaterThan(0);

    // Should detect payments module missing from PRD
    const moduleIssues = issues.filter(
      (i) => i.type === "module_incomplete" && i.detail.includes("payments")
    );
    expect(moduleIssues.length).toBeGreaterThan(0);
  });

  it("extractTechTerms finds versioned terms in tech-stack doc", () => {
    const checker = new ConsistencyChecker(
      docIndexer,
      memoryStore,
      progressManager,
      stackDetector,
      tmpDir
    );

    const content = docIndexer.getDocContent("tech-stack");
    expect(content).not.toBeNull();

    const terms = checker.extractTechTerms(content!, "tech-stack");
    const versioned = terms.filter((t) => t.version);

    expect(versioned.some((t) => t.name === "React" && t.version === "19")).toBe(true);
    expect(versioned.some((t) => t.name === "NestJS" && t.version === "11")).toBe(true);
    expect(versioned.some((t) => t.name === "PostgreSQL" && t.version === "16")).toBe(true);
  });

  it("version check passes when doc and package.json agree", () => {
    const checker = new ConsistencyChecker(
      docIndexer,
      memoryStore,
      progressManager,
      stackDetector,
      tmpDir
    );

    const issues = checker.checkVersionConflicts();
    // React 19 in docs, react@^19.0.0 in package.json — should agree
    const reactConflicts = issues.filter(
      (i) => i.type === "version_conflict" && i.detail.includes("React")
    );
    expect(reactConflicts).toHaveLength(0);
  });
});
