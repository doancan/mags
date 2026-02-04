import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerDocTools } from "./doc-tools.js";
import { DocIndexer } from "../services/doc-indexer.js";
import { TemplateEngine } from "../services/template-engine.js";

// Helper to create temporary directories
function makeTmpDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), `mags-test-${prefix}-`));
}

// Helper to write a document
function writeDoc(dir: string, name: string, content: string, sub?: string): void {
  const target = sub ? join(dir, sub) : dir;
  mkdirSync(target, { recursive: true });
  writeFileSync(join(target, name), content, "utf-8");
}

// Mock McpServer that captures registered tools
class MockMcpServer {
  tools: Map<string, { description: string; schema: unknown; handler: Function }> = new Map();

  tool(name: string, description: string, schema: unknown, handler: Function): void {
    this.tools.set(name, { description, schema, handler });
  }

  async callTool(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Tool ${name} not registered`);
    return tool.handler(args);
  }

  getTool(name: string) {
    return this.tools.get(name);
  }
}

describe("doc-tools", () => {
  let docsDir: string;
  let pluginRoot: string;
  let server: MockMcpServer;
  let docIndexer: DocIndexer;
  let templateEngine: TemplateEngine;

  beforeEach(() => {
    docsDir = makeTmpDir("docs");
    pluginRoot = makeTmpDir("plugin");

    // Create template directory structure
    const templateDir = join(pluginRoot, "templates", "docs", "en");
    mkdirSync(templateDir, { recursive: true });
    writeFileSync(
      join(templateDir, "vision.md"),
      `---
title: "{{projectName}}"
status: DRAFT
---

# {{projectName}} Vision

## Overview

{{description}}
`,
      "utf-8"
    );

    server = new MockMcpServer();
    docIndexer = new DocIndexer(docsDir);
    templateEngine = new TemplateEngine(pluginRoot, { locale: "en" });

    registerDocTools(server as unknown as McpServer, docIndexer, templateEngine, docsDir);
  });

  afterEach(() => {
    rmSync(docsDir, { recursive: true, force: true });
    rmSync(pluginRoot, { recursive: true, force: true });
  });

  // ── Tool Registration ──────────────────────────

  describe("tool registration", () => {
    it("registers mags_list_docs tool", () => {
      expect(server.getTool("mags_list_docs")).toBeDefined();
    });

    it("registers mags_get_doc tool", () => {
      expect(server.getTool("mags_get_doc")).toBeDefined();
    });

    it("registers mags_update_doc tool", () => {
      expect(server.getTool("mags_update_doc")).toBeDefined();
    });

    it("registers mags_search_docs tool", () => {
      expect(server.getTool("mags_search_docs")).toBeDefined();
    });

    it("registers mags_create_doc tool", () => {
      expect(server.getTool("mags_create_doc")).toBeDefined();
    });

    it("registers mags_reindex tool", () => {
      expect(server.getTool("mags_reindex")).toBeDefined();
    });

    it("registers all 6 expected tools", () => {
      const expectedTools = [
        "mags_list_docs",
        "mags_get_doc",
        "mags_update_doc",
        "mags_search_docs",
        "mags_create_doc",
        "mags_reindex",
      ];
      for (const toolName of expectedTools) {
        expect(server.getTool(toolName)).toBeDefined();
      }
      expect(server.tools.size).toBe(6);
    });
  });

  // ── mags_list_docs ─────────────────────────────

  describe("mags_list_docs", () => {
    it("returns indexed documents", async () => {
      writeDoc(
        docsDir,
        "prd.md",
        `---
title: Product Requirements
status: DRAFT
last_updated: "2025-01-15"
---

# Overview

Product overview content.

## Features

Feature list here.
`
      );

      writeDoc(
        docsDir,
        "api-design.md",
        `---
title: API Design
status: REVIEW
---

# API Endpoints

## Users

GET /users
`
      );

      docIndexer.index();

      const result = await server.callTool("mags_list_docs");
      const response = result as { content: Array<{ type: string; text: string }> };
      const data = JSON.parse(response.content[0].text);

      expect(data.total).toBe(2);
      expect(data.docs).toHaveLength(2);

      const prd = data.docs.find((d: { name: string }) => d.name === "prd");
      expect(prd).toBeDefined();
      expect(prd.title).toBe("Product Requirements");
      expect(prd.status).toBe("DRAFT");
    });

    it("returns empty array when no documents exist", async () => {
      docIndexer.index();

      const result = await server.callTool("mags_list_docs");
      const response = result as { content: Array<{ type: string; text: string }> };
      const data = JSON.parse(response.content[0].text);

      expect(data.total).toBe(0);
      expect(data.docs).toEqual([]);
    });

    it("filters documents by status", async () => {
      writeDoc(docsDir, "draft.md", "---\nstatus: DRAFT\n---\n# Draft");
      writeDoc(docsDir, "locked.md", "---\nstatus: LOCKED\n---\n# Locked");
      writeDoc(docsDir, "review.md", "---\nstatus: REVIEW\n---\n# Review");

      docIndexer.index();

      const result = await server.callTool("mags_list_docs", { status: "DRAFT" });
      const response = result as { content: Array<{ type: string; text: string }> };
      const data = JSON.parse(response.content[0].text);

      expect(data.total).toBe(1);
      expect(data.docs[0].name).toBe("draft");
    });

    it("returns all documents when status is 'all'", async () => {
      writeDoc(docsDir, "draft.md", "---\nstatus: DRAFT\n---\n# Draft");
      writeDoc(docsDir, "locked.md", "---\nstatus: LOCKED\n---\n# Locked");

      docIndexer.index();

      const result = await server.callTool("mags_list_docs", { status: "all" });
      const response = result as { content: Array<{ type: string; text: string }> };
      const data = JSON.parse(response.content[0].text);

      expect(data.total).toBe(2);
    });

    it("returns document metadata correctly", async () => {
      writeDoc(
        docsDir,
        "test.md",
        `---
title: Test Document
status: DRAFT
last_updated: "2025-01-20"
---

# Introduction

Content here.

## Section One

More content.

## Section Two

Even more content.
`
      );

      docIndexer.index();

      const result = await server.callTool("mags_list_docs");
      const response = result as { content: Array<{ type: string; text: string }> };
      const data = JSON.parse(response.content[0].text);

      const doc = data.docs[0];
      expect(doc.name).toBe("test");
      expect(doc.title).toBe("Test Document");
      expect(doc.status).toBe("DRAFT");
      expect(doc.lastUpdated).toBe("2025-01-20");
      expect(doc.sections).toBe(3); // Introduction, Section One, Section Two
      expect(doc.wordCount).toBeGreaterThan(0);
    });
  });

  // ── mags_get_doc ───────────────────────────────

  describe("mags_get_doc", () => {
    beforeEach(() => {
      writeDoc(
        docsDir,
        "multi.md",
        `---
title: Multi Section Doc
status: DRAFT
---

# Introduction

Intro paragraph here.

## Features

Feature A is great.
Feature B is better.

## API

### GET /users

Returns users list.

### POST /users

Creates a user.

## Changelog

v1.0 release.
`
      );
      docIndexer.index();
    });

    it("returns document content", async () => {
      const result = await server.callTool("mags_get_doc", { name: "multi" });
      const response = result as { content: Array<{ type: string; text: string }> };
      const data = JSON.parse(response.content[0].text);

      expect(data.name).toBe("multi");
      expect(data.title).toBe("Multi Section Doc");
      expect(data.status).toBe("DRAFT");
      expect(data.section).toBe("full");
      expect(data.content).toContain("Introduction");
      expect(data.content).toContain("Feature A");
      expect(data.content).toContain("GET /users");
    });

    it("returns filtered content with section parameter", async () => {
      const result = await server.callTool("mags_get_doc", {
        name: "multi",
        section: "Features",
      });
      const response = result as { content: Array<{ type: string; text: string }> };
      const data = JSON.parse(response.content[0].text);

      expect(data.section).toBe("Features");
      expect(data.content).toContain("Feature A");
      expect(data.content).toContain("Feature B");
      expect(data.content).not.toContain("GET /users");
      expect(data.content).not.toContain("v1.0 release");
    });

    it("returns nested sections within parent section", async () => {
      const result = await server.callTool("mags_get_doc", {
        name: "multi",
        section: "API",
      });
      const response = result as { content: Array<{ type: string; text: string }> };
      const data = JSON.parse(response.content[0].text);

      expect(data.content).toContain("GET /users");
      expect(data.content).toContain("POST /users");
      expect(data.content).not.toContain("v1.0 release");
    });

    it("returns error for non-existent document", async () => {
      const result = await server.callTool("mags_get_doc", { name: "ghost" });
      const response = result as {
        content: Array<{ type: string; text: string }>;
        isError?: boolean;
      };

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain("not found");
      expect(response.content[0].text).toContain("Available:");
    });

    it("returns error for non-existent section", async () => {
      const result = await server.callTool("mags_get_doc", {
        name: "multi",
        section: "Nonexistent Section",
      });
      const response = result as {
        content: Array<{ type: string; text: string }>;
        isError?: boolean;
      };

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain("Section");
      expect(response.content[0].text).toContain("not found");
    });

    it("finds document by relative path", async () => {
      writeDoc(docsDir, "backend.md", "---\ntitle: Backend\n---\n# Backend Rules", "rules");
      docIndexer.index();

      const result = await server.callTool("mags_get_doc", {
        name: join("rules", "backend.md"),
      });
      const response = result as { content: Array<{ type: string; text: string }> };
      const data = JSON.parse(response.content[0].text);

      expect(data.name).toBe("backend");
      expect(data.title).toBe("Backend");
    });
  });

  // ── mags_search_docs ───────────────────────────

  describe("mags_search_docs", () => {
    beforeEach(() => {
      writeDoc(
        docsDir,
        "auth.md",
        `---
title: Authentication
---

# Authentication

## JWT Token

JWT tokens are used for authentication.
Access tokens expire in 15 minutes.

## OAuth Flow

OAuth 2.0 with PKCE for mobile apps.
`
      );

      writeDoc(
        docsDir,
        "database.md",
        `---
title: Database
---

# Database

## Schema

PostgreSQL with Prisma ORM.
Tables: users, tenants, apps.

## Migrations

Use prisma migrate for schema changes.
`
      );

      docIndexer.index();
    });

    it("returns matching results for search query", async () => {
      const result = await server.callTool("mags_search_docs", { query: "authentication" });
      const response = result as { content: Array<{ type: string; text: string }> };
      const data = JSON.parse(response.content[0].text);

      expect(data.query).toBe("authentication");
      expect(data.results.length).toBeGreaterThan(0);
      expect(data.results[0].doc).toBe("auth");
    });

    it("returns empty results for non-matching query", async () => {
      const result = await server.callTool("mags_search_docs", {
        query: "zzzznonexistentzzzz",
      });
      const response = result as { content: Array<{ type: string; text: string }> };
      const data = JSON.parse(response.content[0].text);

      expect(data.results).toEqual([]);
      expect(data.total).toBe(0);
    });

    it("respects limit parameter", async () => {
      const result = await server.callTool("mags_search_docs", {
        query: "schema",
        limit: 1,
      });
      const response = result as { content: Array<{ type: string; text: string }> };
      const data = JSON.parse(response.content[0].text);

      expect(data.results.length).toBeLessThanOrEqual(1);
    });

    it("handles multi-word queries", async () => {
      const result = await server.callTool("mags_search_docs", {
        query: "JWT token expire",
      });
      const response = result as { content: Array<{ type: string; text: string }> };
      const data = JSON.parse(response.content[0].text);

      expect(data.results.length).toBeGreaterThan(0);
    });

    it("returns score and snippet for results", async () => {
      const result = await server.callTool("mags_search_docs", { query: "PostgreSQL" });
      const response = result as { content: Array<{ type: string; text: string }> };
      const data = JSON.parse(response.content[0].text);

      if (data.results.length > 0) {
        expect(data.results[0]).toHaveProperty("score");
        expect(data.results[0]).toHaveProperty("snippet");
        expect(data.results[0]).toHaveProperty("doc");
        expect(data.results[0]).toHaveProperty("section");
      }
    });
  });

  // ── mags_reindex ───────────────────────────────

  describe("mags_reindex", () => {
    it("refreshes the index and returns change summary", async () => {
      // Initial index with one document
      writeDoc(docsDir, "first.md", "# First\n\nContent here.");
      docIndexer.index();

      // Add another document
      writeDoc(docsDir, "second.md", "# Second\n\nMore content.");

      const result = await server.callTool("mags_reindex");
      const response = result as { content: Array<{ type: string; text: string }> };
      const data = JSON.parse(response.content[0].text);

      expect(data.success).toBe(true);
      expect(data.changes.added).toContain("second");
      expect(data.summary.addedCount).toBe(1);
      expect(data.summary.totalDocs).toBe(2);
    });

    it("detects removed documents", async () => {
      writeDoc(docsDir, "keep.md", "# Keep\n\nStays");
      writeDoc(docsDir, "remove.md", "# Remove\n\nGone");
      docIndexer.index();

      rmSync(join(docsDir, "remove.md"));

      const result = await server.callTool("mags_reindex");
      const response = result as { content: Array<{ type: string; text: string }> };
      const data = JSON.parse(response.content[0].text);

      expect(data.changes.removed).toContain("remove");
      expect(data.summary.removedCount).toBe(1);
      expect(data.summary.totalDocs).toBe(1);
    });

    it("detects modified documents", async () => {
      writeDoc(docsDir, "changing.md", "# Doc\n\nShort content");
      docIndexer.index();

      writeDoc(
        docsDir,
        "changing.md",
        "# Doc\n\nMuch longer content with many more words added here to change word count"
      );

      const result = await server.callTool("mags_reindex");
      const response = result as { content: Array<{ type: string; text: string }> };
      const data = JSON.parse(response.content[0].text);

      expect(data.changes.updated).toContain("changing");
      expect(data.summary.updatedCount).toBe(1);
    });

    it("returns duration in milliseconds", async () => {
      writeDoc(docsDir, "test.md", "# Test\n\nContent");
      docIndexer.index();

      const result = await server.callTool("mags_reindex");
      const response = result as { content: Array<{ type: string; text: string }> };
      const data = JSON.parse(response.content[0].text);

      expect(typeof data.summary.durationMs).toBe("number");
      expect(data.summary.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("handles empty docs directory", async () => {
      docIndexer.index();

      const result = await server.callTool("mags_reindex");
      const response = result as { content: Array<{ type: string; text: string }> };
      const data = JSON.parse(response.content[0].text);

      expect(data.success).toBe(true);
      expect(data.summary.totalDocs).toBe(0);
    });
  });

  // ── mags_update_doc ────────────────────────────

  describe("mags_update_doc", () => {
    beforeEach(() => {
      writeDoc(
        docsDir,
        "editable.md",
        `---
title: Editable Doc
status: DRAFT
---

# Overview

Existing overview content.

## Features

Existing features.

## API

Existing API docs.
`
      );
      docIndexer.index();
    });

    it("updates an existing section", async () => {
      const result = await server.callTool("mags_update_doc", {
        name: "editable",
        section: "Features",
        content: "Updated features content here.",
      });
      const response = result as { content: Array<{ type: string; text: string }> };
      const data = JSON.parse(response.content[0].text);

      expect(data.success).toBe(true);
      expect(data.section).toBe("Features");

      // Verify the file was updated
      const updatedContent = readFileSync(join(docsDir, "editable.md"), "utf-8");
      expect(updatedContent).toContain("Updated features content");
      expect(updatedContent).toContain("# Overview"); // Other sections preserved
      expect(updatedContent).toContain("## API");
    });

    it("creates new section if it does not exist", async () => {
      const result = await server.callTool("mags_update_doc", {
        name: "editable",
        section: "New Section",
        content: "Brand new section content.",
      });
      const response = result as { content: Array<{ type: string; text: string }> };
      const data = JSON.parse(response.content[0].text);

      expect(data.success).toBe(true);
      expect(data.created).toBe(true);

      const updatedContent = readFileSync(join(docsDir, "editable.md"), "utf-8");
      expect(updatedContent).toContain("## New Section");
      expect(updatedContent).toContain("Brand new section content");
    });

    it("returns error for non-existent document", async () => {
      const result = await server.callTool("mags_update_doc", {
        name: "ghost",
        section: "Test",
        content: "Some content",
      });
      const response = result as {
        content: Array<{ type: string; text: string }>;
        isError?: boolean;
      };

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain("not found");
    });

    it("updates last_updated in frontmatter", async () => {
      await server.callTool("mags_update_doc", {
        name: "editable",
        section: "Features",
        content: "Updated content",
      });

      const updatedContent = readFileSync(join(docsDir, "editable.md"), "utf-8");
      // last_updated can be with or without quotes depending on YAML serialization
      expect(updatedContent).toMatch(/last_updated: '?\d{4}-\d{2}-\d{2}'?/);
    });

    it("re-indexes after update", async () => {
      await server.callTool("mags_update_doc", {
        name: "editable",
        section: "Features",
        content:
          "Completely new content with many more words to change the word count significantly",
      });

      // Verify the indexer has the updated doc
      const doc = docIndexer.getDoc("editable");
      expect(doc).toBeDefined();
    });
  });

  // ── mags_create_doc ────────────────────────────

  describe("mags_create_doc", () => {
    it("creates document from template", async () => {
      const result = await server.callTool("mags_create_doc", {
        template: "vision",
        variables: {
          projectName: "My Project",
          description: "A great project description.",
        },
        overwrite: false,
      });
      const response = result as { content: Array<{ type: string; text: string }> };
      const data = JSON.parse(response.content[0].text);

      expect(data.success).toBe(true);
      expect(data.template).toBe("vision");

      const createdContent = readFileSync(join(docsDir, "vision.md"), "utf-8");
      expect(createdContent).toContain("My Project");
      expect(createdContent).toContain("A great project description.");
    });

    it("creates document at custom path", async () => {
      const result = await server.callTool("mags_create_doc", {
        template: "vision",
        variables: { projectName: "Test" },
        path: "planning/project-vision.md",
        overwrite: false,
      });
      const response = result as { content: Array<{ type: string; text: string }> };
      const data = JSON.parse(response.content[0].text);

      expect(data.success).toBe(true);
      expect(data.path).toContain("planning");
      expect(data.path).toContain("project-vision.md");
    });

    it("returns error for non-existent template", async () => {
      const result = await server.callTool("mags_create_doc", {
        template: "nonexistent-template",
        variables: {},
        overwrite: false,
      });
      const response = result as {
        content: Array<{ type: string; text: string }>;
        isError?: boolean;
      };

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain("not found");
      expect(response.content[0].text).toContain("Available:");
    });

    it("returns error when file exists and overwrite is false", async () => {
      writeDoc(docsDir, "vision.md", "# Existing content");

      const result = await server.callTool("mags_create_doc", {
        template: "vision",
        variables: { projectName: "Test" },
        overwrite: false,
      });
      const response = result as {
        content: Array<{ type: string; text: string }>;
        isError?: boolean;
      };

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain("already exists");
    });

    it("overwrites file when overwrite is true", async () => {
      writeDoc(docsDir, "vision.md", "# Old content");

      const result = await server.callTool("mags_create_doc", {
        template: "vision",
        variables: { projectName: "New Project" },
        overwrite: true,
      });
      const response = result as { content: Array<{ type: string; text: string }> };
      const data = JSON.parse(response.content[0].text);

      expect(data.success).toBe(true);

      const content = readFileSync(join(docsDir, "vision.md"), "utf-8");
      expect(content).toContain("New Project");
      expect(content).not.toContain("Old content");
    });

    it("re-indexes after creation", async () => {
      await server.callTool("mags_create_doc", {
        template: "vision",
        variables: { projectName: "Indexed Project" },
        overwrite: false,
      });

      const doc = docIndexer.getDoc("vision");
      expect(doc).toBeDefined();
    });

    it("handles locale parameter", async () => {
      // Create Turkish template
      const trDir = join(pluginRoot, "templates", "docs", "tr");
      mkdirSync(trDir, { recursive: true });
      writeFileSync(
        join(trDir, "vision.md"),
        `---
title: "{{projectName}}"
status: DRAFT
---

# {{projectName}} Vizyon

## Genel Bakis

{{description}}
`,
        "utf-8"
      );

      const result = await server.callTool("mags_create_doc", {
        template: "vision",
        variables: { projectName: "Turkce Proje" },
        locale: "tr",
        path: "turkce-vision.md",
        overwrite: false,
      });
      const response = result as { content: Array<{ type: string; text: string }> };
      const data = JSON.parse(response.content[0].text);

      expect(data.success).toBe(true);

      const content = readFileSync(join(docsDir, "turkce-vision.md"), "utf-8");
      expect(content).toContain("Vizyon");
      expect(content).toContain("Genel Bakis");
    });
  });

  // ── Edge Cases ─────────────────────────────────

  describe("edge cases", () => {
    it("handles documents with special characters in names", async () => {
      writeDoc(docsDir, "api-v2.0-design.md", "---\ntitle: API v2.0\n---\n# API");
      docIndexer.index();

      const result = await server.callTool("mags_get_doc", { name: "api-v2.0-design" });
      const response = result as { content: Array<{ type: string; text: string }> };
      const data = JSON.parse(response.content[0].text);

      expect(data.name).toBe("api-v2.0-design");
    });

    it("handles documents without frontmatter", async () => {
      writeDoc(docsDir, "simple.md", "# Simple Document\n\nNo frontmatter here.");
      docIndexer.index();

      const result = await server.callTool("mags_get_doc", { name: "simple" });
      const response = result as { content: Array<{ type: string; text: string }> };
      const data = JSON.parse(response.content[0].text);

      expect(data.name).toBe("simple");
      expect(data.content).toContain("Simple Document");
    });

    it("handles deeply nested documents", async () => {
      writeDoc(
        docsDir,
        "deep.md",
        "---\ntitle: Deep Doc\n---\n# Deep",
        "level1/level2/level3"
      );
      docIndexer.index();

      const result = await server.callTool("mags_list_docs");
      const response = result as { content: Array<{ type: string; text: string }> };
      const data = JSON.parse(response.content[0].text);

      expect(data.total).toBe(1);
      const doc = data.docs[0];
      expect(doc.path).toContain("level1");
      expect(doc.path).toContain("level2");
      expect(doc.path).toContain("level3");
    });

    it("handles Unicode content correctly", async () => {
      writeDoc(
        docsDir,
        "unicode.md",
        `---
title: Türkçe Doküman
status: DRAFT
---

# Genel Bakış

Ürün gereksinimleri ve özellikler.

## Özellikler

Çoklu kiracı desteği sağlanır.
`
      );
      docIndexer.index();

      const result = await server.callTool("mags_get_doc", { name: "unicode" });
      const response = result as { content: Array<{ type: string; text: string }> };
      const data = JSON.parse(response.content[0].text);

      expect(data.title).toBe("Türkçe Doküman");
      expect(data.content).toContain("Genel Bakış");
      expect(data.content).toContain("Özellikler");
    });

    it("handles section names with regex special characters", async () => {
      writeDoc(
        docsDir,
        "regex.md",
        `---
title: Regex Test
---

## API (v2.0)

API content here.

## Next Section

Other content.
`
      );
      docIndexer.index();

      const result = await server.callTool("mags_get_doc", {
        name: "regex",
        section: "API (v2.0)",
      });
      const response = result as { content: Array<{ type: string; text: string }> };
      const data = JSON.parse(response.content[0].text);

      expect(data.content).toContain("API content here");
      // h2 section ends at next h2
      expect(data.content).not.toContain("Other content");
    });
  });
});
