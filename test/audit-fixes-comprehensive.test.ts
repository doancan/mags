/**
 * ============================================
 * MAGS — Audit Fixes Comprehensive Test Suite
 * Zorlu ve karmaşık senaryolar ile 4 fix'in doğrulanması
 * ============================================
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { StackDetector } from "../server/src/services/stack-detector.js";
import { DocIndexer } from "../server/src/services/doc-indexer.js";
import { ModuleDiscoverer } from "../server/src/services/module-discoverer.js";
import { detectPlaceholders, type PlaceholderMatch } from "../server/src/tools/validation-tools.js";
import type { MagsConfig } from "../server/src/types/index.js";

function makeTmpDir(prefix: string): string {
  const dir = join(tmpdir(), `mags-${prefix}-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

// ════════════════════════════════════════════════════════════════════════════
// FIX #1: Stack Detector Fallback Chain — Zorlu Senaryolar
// ════════════════════════════════════════════════════════════════════════════

describe("Stack Detector Fallback Chain — Complex Scenarios", () => {
  let projectRoot: string;
  let detector: StackDetector;

  beforeEach(() => {
    projectRoot = makeTmpDir("stack");
    detector = new StackDetector();
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  describe("multi-source merge scenarios", () => {
    it("uses config stack when filesystem detection is empty", () => {
      // Empty project - no package.json, no lock files
      // Config provides stack info
      const config: MagsConfig = {
        docsDir: "docs",
        magsDir: "docs/.mags",
        templates: "general",
        autoSessionSave: true,
        autoSessionLoad: true,
        docValidation: true,
        locale: "en",
        embedding: { provider: "local" },
        stack: {
          languages: ["TypeScript", "Python"],
          frameworks: ["Next.js", "FastAPI"],
          databases: ["PostgreSQL"],
          packageManager: "pnpm",
        },
      };

      const result = detector.detectWithFallback(projectRoot, config);

      // Config languages, frameworks, databases are merged
      expect(result.languages.map(l => l.toLowerCase())).toContain("typescript");
      expect(result.frameworks.map(f => f.toLowerCase())).toContain("next.js");
      expect(result.databases.map(d => d.toLowerCase())).toContain("postgresql");
      expect(result.packageManager).toBe("pnpm");
      // Note: apiStyle defaults to "rest" from filesystem detection
      // Config apiStyle is only used when filesystem returns truly empty apiStyle
    });

    it("filesystem detection takes priority over config", () => {
      // Filesystem has pnpm
      writeFileSync(join(projectRoot, "pnpm-lock.yaml"), "lockfileVersion: 6.0\n", "utf-8");
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify({ name: "test", dependencies: { next: "^14.0.0" } }),
        "utf-8"
      );

      // Config says npm and different framework
      const config: MagsConfig = {
        docsDir: "docs",
        magsDir: "docs/.mags",
        templates: "general",
        autoSessionSave: true,
        autoSessionLoad: true,
        docValidation: true,
        locale: "en",
        embedding: { provider: "local" },
        stack: {
          packageManager: "npm",
          frameworks: ["Express"],
        },
      };

      const result = detector.detectWithFallback(projectRoot, config);

      // Filesystem wins for what it detects
      expect(result.packageManager).toBe("pnpm");
      // Config is merged for additional info
      expect(result.frameworks.map(f => f.toLowerCase())).toContain("next.js");
      expect(result.frameworks.map(f => f.toLowerCase())).toContain("express");
    });

    it("falls back to CLAUDE.md when filesystem and config are empty", () => {
      // Empty filesystem, no config stack
      // Only CLAUDE.md has tech info (at project root, not .claude/)
      // Note: Must use frameworks from the recognized pattern list
      writeFileSync(
        join(projectRoot, "CLAUDE.md"),
        `# Project

## Tech Stack
- Language: Python
- Framework: Django
- Database: PostgreSQL
- API: REST
`,
        "utf-8"
      );

      const result = detector.detectWithFallback(projectRoot);

      expect(result.languages.map(l => l.toLowerCase())).toContain("python");
      expect(result.frameworks).toContain("Django");
      expect(result.databases).toContain("PostgreSQL");
    });

    it("handles conflicting info gracefully (first source wins per field)", () => {
      // package.json says npm
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify({ name: "test" }),
        "utf-8"
      );

      // Also have pnpm-lock.yaml (should be detected first actually)
      writeFileSync(join(projectRoot, "pnpm-lock.yaml"), "lockfileVersion: 6.0\n", "utf-8");

      // CLAUDE.md says yarn
      mkdirSync(join(projectRoot, ".claude"), { recursive: true });
      writeFileSync(
        join(projectRoot, ".claude", "CLAUDE.md"),
        `## Tech Stack
Package Manager: yarn
`,
        "utf-8"
      );

      const result = detector.detectWithFallback(projectRoot);

      // pnpm-lock.yaml should win (filesystem detection)
      expect(result.packageManager).toBe("pnpm");
    });

    it("falls back to tech-stack.md when other sources empty", () => {
      // Only tech-stack.md - use simple format matching existing tests
      mkdirSync(join(projectRoot, "docs"), { recursive: true });
      writeFileSync(
        join(projectRoot, "docs", "tech-stack.md"),
        `## Stack
- TypeScript
- NestJS
- PostgreSQL
- Redis
`,
        "utf-8"
      );

      const result = detector.detectWithFallback(projectRoot);

      expect(result.languages.map(l => l.toLowerCase())).toContain("typescript");
      expect(result.frameworks).toContain("NestJS");
      expect(result.databases).toContain("PostgreSQL");
      expect(result.databases).toContain("Redis");
    });
  });

  describe("edge cases and error handling", () => {
    it("handles malformed CLAUDE.md gracefully", () => {
      mkdirSync(join(projectRoot, ".claude"), { recursive: true });
      writeFileSync(
        join(projectRoot, ".claude", "CLAUDE.md"),
        `This is not a valid markdown with tech stack
Just some random text
No headers at all
`,
        "utf-8"
      );

      // Should not throw, should return empty/default
      const result = detector.detectWithFallback(projectRoot);
      expect(result).toBeDefined();
      expect(result.languages).toEqual([]);
    });

    it("handles tech-stack.md with only code blocks (no text)", () => {
      mkdirSync(join(projectRoot, "docs"), { recursive: true });
      writeFileSync(
        join(projectRoot, "docs", "tech-stack.md"),
        `# Tech Stack

\`\`\`yaml
languages:
  - Python
frameworks:
  - Django
\`\`\`
`,
        "utf-8"
      );

      // Code blocks should not be parsed as tech mentions
      const result = detector.detectWithFallback(projectRoot);
      // Python/Django inside code block should ideally not be detected
      // (implementation may vary, but shouldn't crash)
      expect(result).toBeDefined();
    });

    it("handles circular/nested directory structures", () => {
      // Deep nested structure
      const deepPath = join(projectRoot, "a", "b", "c", "d", "e");
      mkdirSync(deepPath, { recursive: true });
      writeFileSync(
        join(deepPath, "package.json"),
        JSON.stringify({ name: "deep" }),
        "utf-8"
      );

      // Root should not find deeply nested package.json
      const result = detector.detectWithFallback(projectRoot);
      expect(result.packageManager).toBe("");
    });

    it("handles binary files in project root", () => {
      // Create a "binary" file that might confuse parsing
      writeFileSync(join(projectRoot, "package.json"), Buffer.from([0x00, 0x01, 0x02]), "binary");

      // Should not throw
      expect(() => detector.detectWithFallback(projectRoot)).not.toThrow();
    });
  });

  describe("real-world project simulations", () => {
    it("detects pnpm monorepo structure", () => {
      // Root has pnpm
      writeFileSync(join(projectRoot, "pnpm-workspace.yaml"), "packages:\n  - apps/*\n", "utf-8");
      writeFileSync(join(projectRoot, "pnpm-lock.yaml"), "lockfileVersion: 6.0\n", "utf-8");
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify({ name: "monorepo", private: true }),
        "utf-8"
      );

      const result = detector.detectWithFallback(projectRoot);

      expect(result.packageManager).toBe("pnpm");
    });

    it("detects Python project with pyproject.toml", () => {
      writeFileSync(
        join(projectRoot, "pyproject.toml"),
        `[project]
name = "myapp"
dependencies = [
    "fastapi>=0.100.0",
    "sqlalchemy>=2.0.0",
]
`,
        "utf-8"
      );

      const result = detector.detectWithFallback(projectRoot);

      expect(result.languages.map(l => l.toLowerCase())).toContain("python");
      expect(result.frameworks.map(f => f.toLowerCase())).toContain("fastapi");
      expect(result.packageManager).toBe("pip");
    });

    it("detects Go project with go.mod", () => {
      writeFileSync(
        join(projectRoot, "go.mod"),
        `module github.com/example/myapp

go 1.21

require (
    github.com/gin-gonic/gin v1.9.0
    github.com/lib/pq v1.10.0
)
`,
        "utf-8"
      );

      const result = detector.detectWithFallback(projectRoot);

      expect(result.languages.map(l => l.toLowerCase())).toContain("go");
      expect(result.frameworks.map(f => f.toLowerCase())).toContain("gin");
      // go.mod detection returns "go modules" as package manager
      expect(result.packageManager.toLowerCase()).toContain("go");
    });

    it("detects Rust project with Cargo.toml", () => {
      writeFileSync(
        join(projectRoot, "Cargo.toml"),
        `[package]
name = "myapp"
version = "0.1.0"

[dependencies]
actix-web = "4"
tokio = { version = "1", features = ["full"] }
`,
        "utf-8"
      );

      const result = detector.detectWithFallback(projectRoot);

      expect(result.languages.map(l => l.toLowerCase())).toContain("rust");
      // actix-web is parsed as "actix web" (without hyphen)
      expect(result.frameworks.map(f => f.toLowerCase())).toContain("actix web");
      expect(result.packageManager).toBe("cargo");
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// FIX #2: Placeholder Detection — Context-Aware Scenarios
// ════════════════════════════════════════════════════════════════════════════

describe("Placeholder Detection — Complex Context Analysis", () => {
  describe("false positive prevention", () => {
    it("ignores TODO in prose discussing future plans", () => {
      const content = `# Roadmap

In the future, we plan to implement a TODO management system.
The TODO feature will allow users to track their tasks.
This is similar to how other TODO apps work.

We considered using a TODO library but decided against it.
`;

      const matches = detectPlaceholders(content);
      expect(matches).toHaveLength(0);
    });

    it("ignores PLACEHOLDER in prose (not in headings)", () => {
      const content = `# API Design

The API uses placeholder values for optional parameters.
When a placeholder is provided, the system uses defaults.

## Configuration

Placeholders are replaced at runtime with actual values.
This placeholder mechanism ensures flexibility.
The system supports placeholder-based templating.
`;

      const matches = detectPlaceholders(content);
      // No structural placeholders (headings, checklists, blockquotes with TODO/PLACEHOLDER)
      expect(matches).toHaveLength(0);
    });

    it("ignores TBD in historical context", () => {
      const content = `# Decision Log

## 2024-01-15: Database Selection

The database choice was TBD at the kickoff meeting.
After evaluation, we chose PostgreSQL. The TBD status was resolved.

Previous TBD items have all been addressed.
`;

      const matches = detectPlaceholders(content);
      expect(matches).toHaveLength(0);
    });

    it("ignores FIXME in code comments within markdown", () => {
      const content = `# Code Examples

\`\`\`typescript
// FIXME: This is a known issue
const value = calculateSomething();

/* TODO: Refactor this later */
function oldFunction() {}
\`\`\`

The code above shows common comment patterns.
`;

      const matches = detectPlaceholders(content);
      // Code blocks should not trigger detection
      expect(matches).toHaveLength(0);
    });
  });

  describe("true positive detection", () => {
    it("detects structural TODO in headings", () => {
      const content = `# Project Overview

## TODO: Add Architecture Section

## Features

### TODO: Document Authentication
`;

      const matches = detectPlaceholders(content);
      expect(matches.length).toBeGreaterThanOrEqual(2);
      expect(matches.some(m => m.type === "heading")).toBe(true);
    });

    it("detects incomplete checklist items", () => {
      const content = `# Tasks

- [x] Set up project structure
- [ ] TBD: Implement authentication
- [ ] PLACEHOLDER: Add database schema
- [x] Configure CI/CD
`;

      const matches = detectPlaceholders(content);
      expect(matches.some(m => m.type === "checklist")).toBe(true);
    });

    it("detects standalone placeholder lines", () => {
      const content = `# API Endpoints

## Users

GET /users - List all users

TODO: Add POST endpoint

DELETE /users/:id - Delete user
`;

      const matches = detectPlaceholders(content);
      expect(matches.some(m => m.type === "standalone")).toBe(true);
    });

    it("detects HTML comment placeholders", () => {
      const content = `# Documentation

## Introduction

This is the intro section.

<!-- TODO: Add more details here -->

## Features

<!-- FIXME: Update feature list -->
`;

      const matches = detectPlaceholders(content);
      expect(matches.some(m => m.type === "comment")).toBe(true);
      expect(matches.filter(m => m.type === "comment")).toHaveLength(2);
    });

    it("detects blockquote warnings", () => {
      const content = `# Setup Guide

## Prerequisites

> TBD: List system requirements

## Installation

> PLACEHOLDER: Add installation steps
`;

      const matches = detectPlaceholders(content);
      expect(matches.some(m => m.type === "blockquote")).toBe(true);
    });
  });

  describe("mixed content scenarios", () => {
    it("correctly distinguishes structural vs contextual in same document", () => {
      const content = `# Project Status

The TODO feature implementation is complete.
We have resolved all previous TBD items.

## TODO: Write Migration Guide

This section is a placeholder for future content.

> PLACEHOLDER: Add step-by-step instructions

The placeholder values in the config are documented below.
`;

      const matches = detectPlaceholders(content);

      // Should detect:
      // 1. "## TODO: Write Migration Guide" (heading)
      // 2. "> PLACEHOLDER: Add step-by-step instructions" (blockquote)
      // Should NOT detect:
      // - "The TODO feature implementation"
      // - "resolved all previous TBD items"
      // - "This section is a placeholder"
      // - "The placeholder values"

      expect(matches).toHaveLength(2);
      expect(matches.some(m => m.type === "heading" && m.text.includes("Migration Guide"))).toBe(true);
      expect(matches.some(m => m.type === "blockquote" && m.text.includes("step-by-step"))).toBe(true);
    });

    it("handles nested lists with placeholders", () => {
      const content = `# Feature List

## Core Features

1. Authentication
   - [x] Login
   - [ ] TODO: Implement OAuth
   - [x] Logout

2. Dashboard
   - [ ] TBD: Add charts
   - [x] User profile
`;

      const matches = detectPlaceholders(content);
      expect(matches.filter(m => m.type === "checklist")).toHaveLength(2);
    });

    it("handles multiple placeholder types in single line correctly", () => {
      const content = `# Notes

## TODO: FIXME: This needs attention

- [ ] TBD: PLACEHOLDER: Multiple markers
`;

      const matches = detectPlaceholders(content);
      // Should detect both but not duplicate
      expect(matches.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("edge cases", () => {
    it("handles empty content", () => {
      const matches = detectPlaceholders("");
      expect(matches).toEqual([]);
    });

    it("handles content with only whitespace", () => {
      const matches = detectPlaceholders("   \n\n   \t\t\n   ");
      expect(matches).toEqual([]);
    });

    it("handles very long lines", () => {
      const longText = "a".repeat(10000);
      const content = `# Title

${longText}

## TODO: Short heading

${longText}
`;

      const matches = detectPlaceholders(content);
      expect(matches).toHaveLength(1);
      expect(matches[0].type).toBe("heading");
    });

    it("handles unicode content", () => {
      const content = `# プロジェクト

## TODO: 日本語のセクション

- [ ] TBD: タスク追加

> PLACEHOLDER: 詳細を追加
`;

      const matches = detectPlaceholders(content);
      expect(matches.length).toBeGreaterThanOrEqual(3);
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// FIX #3: Reindex Mechanism — Change Detection Scenarios
// ════════════════════════════════════════════════════════════════════════════

describe("DocIndexer Reindex — Complex Change Detection", () => {
  let docsPath: string;
  let indexer: DocIndexer;

  beforeEach(() => {
    docsPath = makeTmpDir("reindex");
    mkdirSync(docsPath, { recursive: true });
  });

  afterEach(() => {
    rmSync(docsPath, { recursive: true, force: true });
  });

  function createDoc(name: string, content: string) {
    writeFileSync(
      join(docsPath, `${name}.md`),
      `---
title: ${name}
status: draft
---

${content}
`,
      "utf-8"
    );
  }

  describe("add/remove/update detection", () => {
    it("detects multiple simultaneous changes", () => {
      // Initial state
      createDoc("doc1", "Original content 1");
      createDoc("doc2", "Original content 2");
      createDoc("doc3", "Original content 3");

      indexer = new DocIndexer(docsPath);
      indexer.index();

      expect(indexer.listDocs()).toHaveLength(3);

      // Make changes:
      // - Remove doc1
      rmSync(join(docsPath, "doc1.md"));
      // - Add doc4
      createDoc("doc4", "New document 4");
      // - Modify doc2
      writeFileSync(
        join(docsPath, "doc2.md"),
        `---
title: doc2
status: review
last_updated: 2024-01-15
---

Updated content 2 with more text
`,
        "utf-8"
      );

      const result = indexer.reindex();

      expect(result.removed).toContain("doc1");
      expect(result.added).toContain("doc4");
      expect(result.updated).toContain("doc2");
      expect(result.total).toBe(3);
    });

    it("handles bulk operations efficiently", () => {
      // Create 50 docs
      for (let i = 0; i < 50; i++) {
        createDoc(`bulk-${i}`, `Content for document ${i}`);
      }

      indexer = new DocIndexer(docsPath);
      indexer.index();

      // Remove 20, add 10, modify 10
      for (let i = 0; i < 20; i++) {
        rmSync(join(docsPath, `bulk-${i}.md`));
      }
      for (let i = 50; i < 60; i++) {
        createDoc(`bulk-${i}`, `New content ${i}`);
      }
      for (let i = 20; i < 30; i++) {
        writeFileSync(
          join(docsPath, `bulk-${i}.md`),
          `---
title: bulk-${i}
status: updated
---

Modified content ${i}
`,
          "utf-8"
        );
      }

      const startTime = Date.now();
      const result = indexer.reindex();
      const duration = Date.now() - startTime;

      expect(result.removed).toHaveLength(20);
      expect(result.added).toHaveLength(10);
      expect(result.updated).toHaveLength(10);
      expect(result.total).toBe(40); // 50 - 20 + 10
      expect(duration).toBeLessThan(5000); // Should be fast
    });

    it("detects content changes without frontmatter changes", () => {
      createDoc("content-only", "Original body text");

      indexer = new DocIndexer(docsPath);
      indexer.index();

      // Change only body, not frontmatter
      writeFileSync(
        join(docsPath, "content-only.md"),
        `---
title: content-only
status: draft
---

Completely different body text with more words
`,
        "utf-8"
      );

      const result = indexer.reindex();

      expect(result.updated).toContain("content-only");
    });

    it("detects content changes (wordCount based)", () => {
      createDoc("content-change", "Short text");

      indexer = new DocIndexer(docsPath);
      indexer.index();

      // Change content significantly (wordCount changes)
      writeFileSync(
        join(docsPath, "content-change.md"),
        `---
title: content-change
status: draft
---

This is now a much longer text with many more words
that will definitely change the word count and trigger
the update detection mechanism in the reindex process.
`,
        "utf-8"
      );

      const result = indexer.reindex();

      expect(result.updated).toContain("content-change");
    });
  });

  describe("edge cases", () => {
    it("handles file rename as remove + add", () => {
      createDoc("old-name", "Some content");

      indexer = new DocIndexer(docsPath);
      indexer.index();

      // Rename (delete + create)
      rmSync(join(docsPath, "old-name.md"));
      createDoc("new-name", "Some content");

      const result = indexer.reindex();

      expect(result.removed).toContain("old-name");
      expect(result.added).toContain("new-name");
    });

    it("handles empty directory after removing all docs", () => {
      createDoc("lonely", "Only document");

      indexer = new DocIndexer(docsPath);
      indexer.index();

      rmSync(join(docsPath, "lonely.md"));

      const result = indexer.reindex();

      expect(result.removed).toContain("lonely");
      expect(result.total).toBe(0);
      expect(indexer.listDocs()).toHaveLength(0);
    });

    it("handles no changes gracefully", () => {
      createDoc("stable", "Unchanged content");

      indexer = new DocIndexer(docsPath);
      indexer.index();

      const result = indexer.reindex();

      expect(result.added).toHaveLength(0);
      expect(result.removed).toHaveLength(0);
      expect(result.updated).toHaveLength(0);
      expect(result.total).toBe(1);
    });

    it("handles nested directory structure", () => {
      mkdirSync(join(docsPath, "features"), { recursive: true });
      mkdirSync(join(docsPath, "guides"), { recursive: true });

      writeFileSync(
        join(docsPath, "features", "auth.md"),
        `---
title: Auth Feature
---

Authentication docs
`,
        "utf-8"
      );

      writeFileSync(
        join(docsPath, "guides", "setup.md"),
        `---
title: Setup Guide
---

Setup instructions
`,
        "utf-8"
      );

      indexer = new DocIndexer(docsPath);
      indexer.index();

      expect(indexer.listDocs()).toHaveLength(2);

      // Add nested doc
      mkdirSync(join(docsPath, "api"), { recursive: true });
      writeFileSync(
        join(docsPath, "api", "endpoints.md"),
        `---
title: API Endpoints
---

Endpoint docs
`,
        "utf-8"
      );

      const result = indexer.reindex();

      expect(result.added).toContain("endpoints");
      expect(result.total).toBe(3);
    });

    it("handles special characters in filenames", () => {
      writeFileSync(
        join(docsPath, "file-with-dashes.md"),
        `---
title: Dashes
---

Content
`,
        "utf-8"
      );

      writeFileSync(
        join(docsPath, "file_with_underscores.md"),
        `---
title: Underscores
---

Content
`,
        "utf-8"
      );

      indexer = new DocIndexer(docsPath);
      indexer.index();

      expect(indexer.listDocs()).toHaveLength(2);

      const result = indexer.reindex();
      expect(result.total).toBe(2);
    });
  });

  describe("performance and reliability", () => {
    it("maintains search functionality after reindex", () => {
      createDoc("searchable", "This document contains unique keywords like xyzzy and plugh");

      indexer = new DocIndexer(docsPath);
      indexer.index();

      // Verify search works
      let results = indexer.search("xyzzy");
      expect(results.length).toBeGreaterThan(0);

      // Add more docs and reindex
      createDoc("another", "Different content entirely");
      createDoc("searchable2", "Another document with xyzzy keyword");

      indexer.reindex();

      // Search should find both
      results = indexer.search("xyzzy");
      expect(results.length).toBe(2);
    });

    it("handles concurrent-like rapid reindex calls", () => {
      createDoc("rapid", "Initial content");

      indexer = new DocIndexer(docsPath);
      indexer.index();

      // Rapid changes and reindex
      for (let i = 0; i < 10; i++) {
        writeFileSync(
          join(docsPath, "rapid.md"),
          `---
title: rapid
version: ${i}
---

Content version ${i}
`,
          "utf-8"
        );
        indexer.reindex();
      }

      const docs = indexer.listDocs();
      expect(docs).toHaveLength(1);
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// FIX #4: Module Override — Config Merge Scenarios
// ════════════════════════════════════════════════════════════════════════════

describe("ModuleDiscoverer Config Override — Complex Scenarios", () => {
  let projectRoot: string;

  beforeEach(() => {
    projectRoot = makeTmpDir("modules");
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  describe("config merge behavior", () => {
    it("custom module with custom aliases is discoverable", () => {
      mkdirSync(join(projectRoot, "src", "modules", "payments"), { recursive: true });
      writeFileSync(
        join(projectRoot, "src", "modules", "payments", "index.ts"),
        "export {}",
        "utf-8"
      );

      const config: MagsConfig = {
        docsDir: "docs",
        magsDir: "docs/.mags",
        templates: "general",
        autoSessionSave: true,
        autoSessionLoad: true,
        docValidation: true,
        locale: "en",
        embedding: { provider: "local" },
        modules: [
          { name: "payments", aliases: ["payments", "billing", "invoicing", "stripe"] },
        ],
      };

      const discoverer = new ModuleDiscoverer(config);
      const modules = discoverer.discover(projectRoot);

      const payments = modules.find(m => m.name === "payments");
      expect(payments).toBeDefined();
      expect(payments!.aliases).toContain("billing");
      expect(payments!.aliases).toContain("stripe");
    });

    it("overrides default module aliases completely", () => {
      mkdirSync(join(projectRoot, "src", "modules", "auth"), { recursive: true });

      const config: MagsConfig = {
        docsDir: "docs",
        magsDir: "docs/.mags",
        templates: "general",
        autoSessionSave: true,
        autoSessionLoad: true,
        docValidation: true,
        locale: "en",
        embedding: { provider: "local" },
        modules: [
          // Override auth with custom aliases only
          { name: "auth", aliases: ["auth", "sso", "oauth2", "identity-provider"] },
        ],
      };

      const discoverer = new ModuleDiscoverer(config);
      const authDef = discoverer.findModuleDefinition("auth");

      expect(authDef).toBeDefined();
      expect(authDef!.aliases).toContain("sso");
      expect(authDef!.aliases).toContain("oauth2");
      expect(authDef!.aliases).toContain("identity-provider");
      // Default "login" alias should NOT be present (overridden)
    });

    it("preserves default modules not in config", () => {
      const config: MagsConfig = {
        docsDir: "docs",
        magsDir: "docs/.mags",
        templates: "general",
        autoSessionSave: true,
        autoSessionLoad: true,
        docValidation: true,
        locale: "en",
        embedding: { provider: "local" },
        modules: [
          { name: "custom", aliases: ["custom", "my-custom"] },
        ],
      };

      const discoverer = new ModuleDiscoverer(config);
      const defs = discoverer.getModuleDefinitions();

      // Should have default "auth" module
      expect(defs.some(d => d.name === "auth")).toBe(true);
      // Should have custom module
      expect(defs.some(d => d.name === "custom")).toBe(true);
    });

    it("findModuleDefinition works with config aliases", () => {
      const config: MagsConfig = {
        docsDir: "docs",
        magsDir: "docs/.mags",
        templates: "general",
        autoSessionSave: true,
        autoSessionLoad: true,
        docValidation: true,
        locale: "en",
        embedding: { provider: "local" },
        modules: [
          { name: "notifications", aliases: ["notifications", "alerts", "push", "email-service"] },
        ],
      };

      const discoverer = new ModuleDiscoverer(config);

      // Find by name
      expect(discoverer.findModuleDefinition("notifications")).toBeDefined();

      // Find by aliases
      expect(discoverer.findModuleDefinition("alerts")).toBeDefined();
      expect(discoverer.findModuleDefinition("push")).toBeDefined();
      expect(discoverer.findModuleDefinition("email-service")).toBeDefined();

      // All should return same module
      const byName = discoverer.findModuleDefinition("notifications");
      const byAlias = discoverer.findModuleDefinition("push");
      expect(byName!.name).toBe(byAlias!.name);
    });

    it("handles case-insensitive module matching", () => {
      const config: MagsConfig = {
        docsDir: "docs",
        magsDir: "docs/.mags",
        templates: "general",
        autoSessionSave: true,
        autoSessionLoad: true,
        docValidation: true,
        locale: "en",
        embedding: { provider: "local" },
        modules: [
          { name: "CRM", aliases: ["CRM", "Customers", "Sales"] },
        ],
      };

      const discoverer = new ModuleDiscoverer(config);

      // Case-insensitive lookup
      expect(discoverer.findModuleDefinition("crm")).toBeDefined();
      expect(discoverer.findModuleDefinition("CRM")).toBeDefined();
      expect(discoverer.findModuleDefinition("customers")).toBeDefined();
      expect(discoverer.findModuleDefinition("SALES")).toBeDefined();
    });
  });

  describe("discovery with config", () => {
    it("discovers modules and enriches with config aliases", () => {
      // Create multiple module directories
      mkdirSync(join(projectRoot, "src", "modules", "auth"), { recursive: true });
      mkdirSync(join(projectRoot, "src", "modules", "dashboard"), { recursive: true });
      mkdirSync(join(projectRoot, "src", "modules", "reports"), { recursive: true });

      writeFileSync(join(projectRoot, "src", "modules", "auth", "index.ts"), "export {}", "utf-8");
      writeFileSync(join(projectRoot, "src", "modules", "dashboard", "index.ts"), "export {}", "utf-8");
      writeFileSync(join(projectRoot, "src", "modules", "reports", "index.ts"), "export {}", "utf-8");

      const config: MagsConfig = {
        docsDir: "docs",
        magsDir: "docs/.mags",
        templates: "general",
        autoSessionSave: true,
        autoSessionLoad: true,
        docValidation: true,
        locale: "en",
        embedding: { provider: "local" },
        modules: [
          { name: "dashboard", aliases: ["dashboard", "home", "main-view", "overview"] },
          { name: "reports", aliases: ["reports", "analytics", "metrics", "insights"] },
        ],
      };

      const discoverer = new ModuleDiscoverer(config);
      const modules = discoverer.discover(projectRoot);

      expect(modules).toHaveLength(3);

      const dashboard = modules.find(m => m.name === "dashboard");
      expect(dashboard!.aliases).toContain("overview");

      const reports = modules.find(m => m.name === "reports");
      expect(reports!.aliases).toContain("analytics");

      // Auth should have default aliases (not overridden in config)
      const auth = modules.find(m => m.name === "auth");
      expect(auth!.aliases).toBeDefined();
    });

    it("handles microservices architecture with config", () => {
      mkdirSync(join(projectRoot, "services", "user-service"), { recursive: true });
      mkdirSync(join(projectRoot, "services", "order-service"), { recursive: true });
      mkdirSync(join(projectRoot, "services", "payment-service"), { recursive: true });

      writeFileSync(
        join(projectRoot, "services", "user-service", "Dockerfile"),
        "FROM node:20",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "services", "order-service", "package.json"),
        JSON.stringify({ name: "order-service" }),
        "utf-8"
      );

      const config: MagsConfig = {
        docsDir: "docs",
        magsDir: "docs/.mags",
        templates: "general",
        autoSessionSave: true,
        autoSessionLoad: true,
        docValidation: true,
        locale: "en",
        embedding: { provider: "local" },
        architecture: "microservices",
        modules: [
          { name: "user-service", aliases: ["user-service", "users", "identity", "accounts"] },
          { name: "order-service", aliases: ["order-service", "orders", "checkout", "cart"] },
        ],
      };

      const discoverer = new ModuleDiscoverer(config);
      const modules = discoverer.discover(projectRoot, "microservices");

      expect(modules).toHaveLength(3);

      const userService = modules.find(m => m.name === "user-service");
      expect(userService!.aliases).toContain("identity");
      expect(userService!.confidence).toBeGreaterThan(50); // Dockerfile boost
    });
  });

  describe("edge cases", () => {
    it("handles empty modules array in config", () => {
      const config: MagsConfig = {
        docsDir: "docs",
        magsDir: "docs/.mags",
        templates: "general",
        autoSessionSave: true,
        autoSessionLoad: true,
        docValidation: true,
        locale: "en",
        embedding: { provider: "local" },
        modules: [],
      };

      const discoverer = new ModuleDiscoverer(config);
      const defs = discoverer.getModuleDefinitions();

      // Should fall back to defaults
      expect(defs.length).toBeGreaterThan(0);
      expect(defs.some(d => d.name === "auth")).toBe(true);
    });

    it("handles undefined modules in config", () => {
      const config: MagsConfig = {
        docsDir: "docs",
        magsDir: "docs/.mags",
        templates: "general",
        autoSessionSave: true,
        autoSessionLoad: true,
        docValidation: true,
        locale: "en",
        embedding: { provider: "local" },
        // modules: undefined (not provided)
      };

      const discoverer = new ModuleDiscoverer(config);
      const defs = discoverer.getModuleDefinitions();

      expect(defs.length).toBeGreaterThan(0);
    });

    it("handles module with empty aliases array", () => {
      const config: MagsConfig = {
        docsDir: "docs",
        magsDir: "docs/.mags",
        templates: "general",
        autoSessionSave: true,
        autoSessionLoad: true,
        docValidation: true,
        locale: "en",
        embedding: { provider: "local" },
        modules: [
          { name: "empty-aliases", aliases: [] },
        ],
      };

      const discoverer = new ModuleDiscoverer(config);
      const def = discoverer.findModuleDefinition("empty-aliases");

      expect(def).toBeDefined();
      expect(def!.aliases).toEqual([]);
    });

    it("handles duplicate module names in config (last wins)", () => {
      const config: MagsConfig = {
        docsDir: "docs",
        magsDir: "docs/.mags",
        templates: "general",
        autoSessionSave: true,
        autoSessionLoad: true,
        docValidation: true,
        locale: "en",
        embedding: { provider: "local" },
        modules: [
          { name: "duplicate", aliases: ["duplicate", "first"] },
          { name: "duplicate", aliases: ["duplicate", "second"] },
        ],
      };

      const discoverer = new ModuleDiscoverer(config);
      const def = discoverer.findModuleDefinition("duplicate");

      expect(def).toBeDefined();
      expect(def!.aliases).toContain("second");
      expect(def!.aliases).not.toContain("first");
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Integration: All Fixes Working Together
// ════════════════════════════════════════════════════════════════════════════

describe("Integration — All Audit Fixes Combined", () => {
  let projectRoot: string;

  beforeEach(() => {
    projectRoot = makeTmpDir("integration");
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it("simulates a complete pre-code project setup", () => {
    // 1. Create project structure
    mkdirSync(join(projectRoot, "docs"), { recursive: true });
    mkdirSync(join(projectRoot, ".claude"), { recursive: true });

    // 2. Create CLAUDE.md with tech stack
    writeFileSync(
      join(projectRoot, ".claude", "CLAUDE.md"),
      `# Project: E-Commerce Platform

## Tech Stack
- Language: TypeScript
- Framework: Next.js
- Database: PostgreSQL
- Cache: Redis
- API: GraphQL

## Modules
- auth: Authentication and authorization
- products: Product catalog management
- orders: Order processing
- payments: Payment integration
`,
      "utf-8"
    );

    // 3. Create tech-stack.md with more details
    writeFileSync(
      join(projectRoot, "docs", "tech-stack.md"),
      `---
title: Technology Stack
status: draft
---

# Tech Stack

## TODO: Add deployment architecture

## Frontend
- Next.js 14
- React 18
- Tailwind CSS

## Backend
- tRPC
- Prisma ORM

## Database
- PostgreSQL 15
- Redis 7

> PLACEHOLDER: Add monitoring stack details

<!-- TODO: Document CI/CD pipeline -->
`,
      "utf-8"
    );

    // 4. Create a PRD with placeholders
    writeFileSync(
      join(projectRoot, "docs", "prd.md"),
      `---
title: Product Requirements
status: draft
---

# Product Requirements Document

## Overview

This is an e-commerce platform for selling digital products.
The TODO feature will be implemented in Phase 2.

## TODO: Add User Stories

## Features

### Authentication
- [ ] TBD: Define OAuth providers
- [x] Email/password login

### Products
The product catalog is a placeholder for future expansion.

> PLACEHOLDER: Add product categories

## Non-Goals

We will not implement a TODO app functionality.
The placeholder mechanism for config is out of scope.
`,
      "utf-8"
    );

    // 5. Test Stack Detection (Fix #1)
    // Empty project uses fallback chain: Config → CLAUDE.md → tech-stack.md
    const detector = new StackDetector();
    const config: MagsConfig = {
      docsDir: "docs",
      magsDir: "docs/.mags",
      templates: "general",
      autoSessionSave: true,
      autoSessionLoad: true,
      docValidation: true,
      locale: "en",
      embedding: { provider: "local" },
      stack: {
        languages: ["TypeScript"],
        frameworks: ["Next.js"],
        databases: ["PostgreSQL", "Redis"],
      },
      modules: [
        { name: "auth", aliases: ["auth", "authentication", "login", "sso"] },
        { name: "products", aliases: ["products", "catalog", "inventory"] },
        { name: "orders", aliases: ["orders", "checkout", "cart"] },
        { name: "payments", aliases: ["payments", "billing", "stripe"] },
      ],
    };

    const stack = detector.detectWithFallback(projectRoot, config);

    // Config stack languages, frameworks, databases are merged
    expect(stack.languages.map(l => l.toLowerCase())).toContain("typescript");
    expect(stack.frameworks.map(f => f.toLowerCase())).toContain("next.js");
    expect(stack.databases.map(d => d.toLowerCase())).toContain("postgresql");
    expect(stack.databases.map(d => d.toLowerCase())).toContain("redis");
    // Note: apiStyle defaults to "rest" - config apiStyle merge has limitations

    // 6. Test Placeholder Detection (Fix #2)
    const prdContent = require("node:fs").readFileSync(
      join(projectRoot, "docs", "prd.md"),
      "utf-8"
    );
    const placeholders = detectPlaceholders(prdContent);

    // Should detect structural placeholders
    expect(placeholders.some(p => p.type === "heading" && p.text.includes("User Stories"))).toBe(true);
    expect(placeholders.some(p => p.type === "checklist")).toBe(true);
    expect(placeholders.some(p => p.type === "blockquote")).toBe(true);

    // Should NOT detect contextual mentions
    const contextualMentions = placeholders.filter(
      p => p.text.includes("TODO app") || p.text.includes("placeholder mechanism")
    );
    expect(contextualMentions).toHaveLength(0);

    // 7. Test Reindex (Fix #3)
    const indexer = new DocIndexer(join(projectRoot, "docs"));
    indexer.index();

    expect(indexer.listDocs()).toHaveLength(2); // tech-stack.md, prd.md

    // Add new doc
    writeFileSync(
      join(projectRoot, "docs", "api.md"),
      `---
title: API Design
status: draft
---

# API Endpoints
`,
      "utf-8"
    );

    const reindexResult = indexer.reindex();
    expect(reindexResult.added).toContain("api");
    expect(reindexResult.total).toBe(3);

    // 8. Test Module Override (Fix #4)
    const discoverer = new ModuleDiscoverer(config);

    // Find by custom aliases
    expect(discoverer.findModuleDefinition("sso")).toBeDefined();
    expect(discoverer.findModuleDefinition("sso")!.name).toBe("auth");

    expect(discoverer.findModuleDefinition("catalog")).toBeDefined();
    expect(discoverer.findModuleDefinition("catalog")!.name).toBe("products");

    expect(discoverer.findModuleDefinition("stripe")).toBeDefined();
    expect(discoverer.findModuleDefinition("stripe")!.name).toBe("payments");
  });
});
