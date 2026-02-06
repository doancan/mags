import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerContextTools } from "./context-tools.js";
import { DocIndexer } from "../services/doc-indexer.js";
import { ProgressManager } from "../services/progress-manager.js";
import { MemoryStore } from "../services/memory-store.js";
import type { MagsConfig } from "../types/index.js";

function makeTmpDir(): string {
  return mkdtempSync(join(tmpdir(), "mags-context-tools-"));
}

function writeDoc(dir: string, name: string, content: string, sub?: string): void {
  const target = sub ? join(dir, sub) : dir;
  mkdirSync(target, { recursive: true });
  writeFileSync(join(target, name), content, "utf-8");
}

describe("Context Tools", () => {
  let tmpDir: string;
  let docsDir: string;
  let magsDir: string;
  let server: McpServer;
  let docIndexer: DocIndexer;
  let progressManager: ProgressManager;
  let memoryStore: MemoryStore;
  let config: MagsConfig;
  let registeredTools: Map<string, { handler: (args: Record<string, unknown>) => Promise<unknown> }>;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    docsDir = join(tmpDir, "docs");
    magsDir = join(tmpDir, ".mags");
    mkdirSync(docsDir, { recursive: true });
    mkdirSync(magsDir, { recursive: true });

    // Mock server to capture registered tools
    registeredTools = new Map();
    server = {
      tool: (name: string, _description: string, _schema: unknown, handler: (args: Record<string, unknown>) => Promise<unknown>) => {
        registeredTools.set(name, { handler });
      },
    } as unknown as McpServer;

    docIndexer = new DocIndexer(docsDir);
    progressManager = new ProgressManager(magsDir);
    memoryStore = new MemoryStore(magsDir);

    config = {
      docsDir,
      magsDir,
      templates: "general",
      docValidation: true,
      locale: "en",
      embedding: { provider: "local" },
    };
  });

  afterEach(() => {
    try {
      memoryStore?.close();
    } catch {
      // Ignore close errors
    }
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── Tool registration ──────────────────────────

  describe("tool registration", () => {
    it("registers mags_project_summary tool", () => {
      registerContextTools(server, docIndexer, progressManager, memoryStore, config);
      expect(registeredTools.has("mags_project_summary")).toBe(true);
    });

    it("registers mags_module_context tool", () => {
      registerContextTools(server, docIndexer, progressManager, memoryStore, config);
      expect(registeredTools.has("mags_module_context")).toBe(true);
    });

    it("registers both tools at once", () => {
      registerContextTools(server, docIndexer, progressManager, memoryStore, config);
      expect(registeredTools.size).toBe(2);
    });
  });

  // ── mags_project_summary ───────────────────────

  describe("mags_project_summary", () => {
    it("returns summary sections", async () => {
      // Set up some documents
      writeDoc(docsDir, "vision.md", `---
title: Project Vision
---

# Vision

This is the project vision document. It describes the overall goals and objectives of the project.

## Goals

1. Build something great
2. Make users happy
`);
      writeDoc(docsDir, "prd.md", `---
title: PRD
status: DRAFT
---

# Product Requirements
`);
      docIndexer.index();

      registerContextTools(server, docIndexer, progressManager, memoryStore, config);
      const tool = registeredTools.get("mags_project_summary");
      const result = await tool!.handler({}) as { content: { type: string; text: string }[] };

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe("text");
      expect(result.content[0].text).toContain("## Documents");
      expect(result.content[0].text).toContain("Total: 2");
      expect(result.content[0].text).toContain("## Memory");
    });

    it("includes project info from vision document", async () => {
      writeDoc(docsDir, "vision.md", `---
title: Vision
---

# Project Vision

This is a revolutionary new product that will change the world.
`);
      docIndexer.index();

      registerContextTools(server, docIndexer, progressManager, memoryStore, config);
      const tool = registeredTools.get("mags_project_summary");
      const result = await tool!.handler({}) as { content: { type: string; text: string }[] };

      expect(result.content[0].text).toContain("## Project");
      expect(result.content[0].text).toContain("revolutionary");
    });

    it("includes progress information when available", async () => {
      progressManager.initialize("test-project", [
        { name: "auth", status: "completed", phase: 1, priority: 1, dependsOn: [], items: [] },
        { name: "api", status: "in_progress", phase: 1, priority: 2, dependsOn: [], items: [
          { name: "endpoints", status: "completed" },
          { name: "validation", status: "not_started" },
        ] },
      ]);

      registerContextTools(server, docIndexer, progressManager, memoryStore, config);
      const tool = registeredTools.get("mags_project_summary");
      const result = await tool!.handler({}) as { content: { type: string; text: string }[] };

      expect(result.content[0].text).toContain("## Progress");
      expect(result.content[0].text).toContain("1/2 completed");
      expect(result.content[0].text).toContain("Active:");
    });

    it("includes recent decisions from memory", async () => {
      await memoryStore.remember("auth_strategy", "Use JWT with refresh tokens", "decisions", ["auth"]);
      await memoryStore.remember("db_choice", "PostgreSQL with Prisma", "decisions", ["database"]);

      registerContextTools(server, docIndexer, progressManager, memoryStore, config);
      const tool = registeredTools.get("mags_project_summary");
      const result = await tool!.handler({}) as { content: { type: string; text: string }[] };

      expect(result.content[0].text).toContain("## Recent Decisions");
      expect(result.content[0].text).toContain("auth_strategy");
      expect(result.content[0].text).toContain("JWT");
    });

    it("includes first-use guidance when empty", async () => {
      // No documents, no sessions, no memories — first use scenario
      docIndexer.index();

      registerContextTools(server, docIndexer, progressManager, memoryStore, config);
      const tool = registeredTools.get("mags_project_summary");
      const result = await tool!.handler({}) as { content: { type: string; text: string }[] };

      expect(result.content[0].text).toContain("## Getting Started");
      expect(result.content[0].text).toContain("first session");
      expect(result.content[0].text).toContain("mags_remember");
      expect(result.content[0].text).toContain("mags_recall");
    });

    it("includes welcome back message for returning users", async () => {
      await memoryStore.remember("some_key", "some_value", "decisions");

      registerContextTools(server, docIndexer, progressManager, memoryStore, config);
      const tool = registeredTools.get("mags_project_summary");
      const result = await tool!.handler({}) as { content: { type: string; text: string }[] };

      expect(result.content[0].text).toContain("## Welcome Back");
      expect(result.content[0].text).toContain("Memory entries: 1");
    });

    it("shows document status counts", async () => {
      writeDoc(docsDir, "draft1.md", "---\nstatus: DRAFT\n---\n# Draft 1");
      writeDoc(docsDir, "draft2.md", "---\nstatus: DRAFT\n---\n# Draft 2");
      writeDoc(docsDir, "locked.md", "---\nstatus: LOCKED\n---\n# Locked");
      docIndexer.index();

      registerContextTools(server, docIndexer, progressManager, memoryStore, config);
      const tool = registeredTools.get("mags_project_summary");
      const result = await tool!.handler({}) as { content: { type: string; text: string }[] };

      expect(result.content[0].text).toContain("Total: 3");
      expect(result.content[0].text).toContain("Locked: 1");
      expect(result.content[0].text).toContain("Draft: 2");
    });

    it("shows memory capacity stats", async () => {
      await memoryStore.remember("key1", "value1");
      await memoryStore.remember("key2", "value2");

      registerContextTools(server, docIndexer, progressManager, memoryStore, config);
      const tool = registeredTools.get("mags_project_summary");
      const result = await tool!.handler({}) as { content: { type: string; text: string }[] };

      expect(result.content[0].text).toContain("## Memory");
      expect(result.content[0].text).toContain("Entries: 2/1000");
    });
  });

  // ── mags_module_context ────────────────────────

  describe("mags_module_context", () => {
    it("returns module-specific context", async () => {
      writeDoc(docsDir, "prd.md", `---
title: PRD
---

# Product Requirements

## Auth Module

Authentication handles user login and registration.

### Login

Login uses JWT tokens.

## Database

PostgreSQL setup.
`);
      writeDoc(docsDir, "data-model.md", `---
title: Data Model
---

# Data Model

## Auth Tables

- users
- sessions

## Other Tables

- products
`);
      docIndexer.index();

      registerContextTools(server, docIndexer, progressManager, memoryStore, config);
      const tool = registeredTools.get("mags_module_context");
      const result = await tool!.handler({ module: "auth" }) as { content: { type: string; text: string }[] };

      expect(result.content[0].text).toContain("# Module Context: auth");
      expect(result.content[0].text).toContain("## PRD");
      expect(result.content[0].text).toContain("Authentication");
      expect(result.content[0].text).toContain("## Data Model");
      expect(result.content[0].text).toContain("users");
    });

    it("returns error for unknown module", async () => {
      docIndexer.index();

      registerContextTools(server, docIndexer, progressManager, memoryStore, config);
      const tool = registeredTools.get("mags_module_context");
      const result = await tool!.handler({ module: "nonexistent" }) as { content: { type: string; text: string }[] };

      expect(result.content[0].text).toContain("No context found for module");
      expect(result.content[0].text).toContain("nonexistent");
    });

    it("includes progress for module", async () => {
      progressManager.initialize("test-project", [
        {
          name: "auth",
          status: "in_progress",
          phase: 1,
          priority: 1,
          dependsOn: [],
          items: [
            { name: "login", status: "completed" },
            { name: "register", status: "not_started" },
          ],
        },
      ]);

      registerContextTools(server, docIndexer, progressManager, memoryStore, config);
      const tool = registeredTools.get("mags_module_context");
      const result = await tool!.handler({ module: "auth" }) as { content: { type: string; text: string }[] };

      expect(result.content[0].text).toContain("## Progress");
      expect(result.content[0].text).toContain("in_progress");
      expect(result.content[0].text).toContain("login");
    });

    it("includes related memories", async () => {
      await memoryStore.remember("auth_jwt_strategy", "Use JWT with 15min expiry", "decisions", ["auth"]);

      registerContextTools(server, docIndexer, progressManager, memoryStore, config);
      const tool = registeredTools.get("mags_module_context");
      const result = await tool!.handler({ module: "auth" }) as { content: { type: string; text: string }[] };

      expect(result.content[0].text).toContain("## Related Notes");
      expect(result.content[0].text).toContain("auth_jwt_strategy");
      expect(result.content[0].text).toContain("JWT");
    });

    it("uses module aliases for section matching", async () => {
      writeDoc(docsDir, "prd.md", `---
title: PRD
---

# PRD

## Authentication

This section covers login and JWT handling.

## Other Section

Not related.
`);
      docIndexer.index();

      registerContextTools(server, docIndexer, progressManager, memoryStore, config);
      const tool = registeredTools.get("mags_module_context");
      const result = await tool!.handler({ module: "auth" }) as { content: { type: string; text: string }[] };

      // "auth" module has "authentication" as an alias
      expect(result.content[0].text).toContain("## PRD");
      expect(result.content[0].text).toContain("login");
      expect(result.content[0].text).not.toContain("Not related");
    });

    it("includes api-design content", async () => {
      writeDoc(docsDir, "api-design.md", `---
title: API Design
---

# API Design

## Auth Endpoints

POST /auth/login
POST /auth/register

## User Endpoints

GET /users
`);
      docIndexer.index();

      registerContextTools(server, docIndexer, progressManager, memoryStore, config);
      const tool = registeredTools.get("mags_module_context");
      const result = await tool!.handler({ module: "auth" }) as { content: { type: string; text: string }[] };

      expect(result.content[0].text).toContain("## API Endpoints");
      expect(result.content[0].text).toContain("POST /auth/login");
    });

    it("includes project-structure content", async () => {
      writeDoc(docsDir, "project-structure.md", `---
title: Project Structure
---

# Project Structure

## Auth Structure

src/auth/
  - auth.controller.ts
  - auth.service.ts

## DB Structure

src/db/
`);
      docIndexer.index();

      registerContextTools(server, docIndexer, progressManager, memoryStore, config);
      const tool = registeredTools.get("mags_module_context");
      const result = await tool!.handler({ module: "auth" }) as { content: { type: string; text: string }[] };

      expect(result.content[0].text).toContain("## Project Structure");
      expect(result.content[0].text).toContain("auth.controller.ts");
    });

    it("handles case-insensitive module names", async () => {
      writeDoc(docsDir, "prd.md", `---
title: PRD
---

## Auth Module

Content for auth.
`);
      docIndexer.index();

      registerContextTools(server, docIndexer, progressManager, memoryStore, config);
      const tool = registeredTools.get("mags_module_context");
      const result = await tool!.handler({ module: "AUTH" }) as { content: { type: string; text: string }[] };

      expect(result.content[0].text).toContain("# Module Context: AUTH");
      expect(result.content[0].text).toContain("Content for auth");
    });

    it("uses custom module definitions from config", async () => {
      config.modules = [
        { name: "custom", aliases: ["custom", "mymodule", "special"] },
      ];

      writeDoc(docsDir, "prd.md", `---
title: PRD
---

## Special Feature

This is for the custom module.
`);
      docIndexer.index();

      registerContextTools(server, docIndexer, progressManager, memoryStore, config);
      const tool = registeredTools.get("mags_module_context");
      const result = await tool!.handler({ module: "custom" }) as { content: { type: string; text: string }[] };

      expect(result.content[0].text).toContain("## PRD");
      expect(result.content[0].text).toContain("custom module");
    });

    it("lists available documents when no context found", async () => {
      writeDoc(docsDir, "readme.md", "# README");
      writeDoc(docsDir, "guide.md", "# Guide");
      docIndexer.index();

      registerContextTools(server, docIndexer, progressManager, memoryStore, config);
      const tool = registeredTools.get("mags_module_context");
      const result = await tool!.handler({ module: "unknown" }) as { content: { type: string; text: string }[] };

      expect(result.content[0].text).toContain("Available documents:");
      expect(result.content[0].text).toContain("readme");
      expect(result.content[0].text).toContain("guide");
    });
  });
});
