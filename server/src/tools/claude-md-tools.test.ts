import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  mkdirSync,
  readFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerClaudeMdTools } from "./claude-md-tools.js";
import { DocIndexer } from "../services/doc-indexer.js";
import type { MagsConfig } from "../types/index.js";

// Mock MCP server - cast to McpServer for type compatibility
function createMockServer() {
  const tools: Map<string, { description: string; handler: () => Promise<unknown> }> = new Map();

  return {
    tool: (
      name: string,
      description: string,
      _schema: unknown,
      handler: () => Promise<unknown>
    ) => {
      tools.set(name, { description, handler });
    },
    getTools: () => tools,
    callTool: async (name: string) => {
      const tool = tools.get(name);
      if (!tool) throw new Error(`Tool ${name} not found`);
      return tool.handler();
    },
  } as unknown as McpServer & { getTools: () => Map<string, { description: string; handler: () => Promise<unknown> }>; callTool: (name: string) => Promise<unknown> };
}

function makeTmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "mags-claude-md-test-"));
  return dir;
}

function writeDoc(
  dir: string,
  name: string,
  content: string,
  sub?: string
): void {
  const target = sub ? join(dir, sub) : dir;
  mkdirSync(target, { recursive: true });
  writeFileSync(join(target, name), content, "utf-8");
}

describe("claude-md-tools", () => {
  let tmpDir: string;
  let docsDir: string;
  let projectRoot: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    docsDir = join(tmpDir, "docs");
    projectRoot = tmpDir;
    mkdirSync(docsDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── Tool Registration ──────────────────────────

  describe("tool registration", () => {
    it("registers mags_generate_claude_md tool", () => {
      const server = createMockServer();
      const docIndexer = new DocIndexer(docsDir);
      docIndexer.index();

      registerClaudeMdTools(server, docIndexer, projectRoot);

      const tools = server.getTools();
      expect(tools.has("mags_generate_claude_md")).toBe(true);
    });

    it("registers mags_audit_claude_md tool", () => {
      const server = createMockServer();
      const docIndexer = new DocIndexer(docsDir);
      docIndexer.index();

      registerClaudeMdTools(server, docIndexer, projectRoot);

      const tools = server.getTools();
      expect(tools.has("mags_audit_claude_md")).toBe(true);
    });

    it("registers both tools with correct descriptions", () => {
      const server = createMockServer();
      const docIndexer = new DocIndexer(docsDir);
      docIndexer.index();

      registerClaudeMdTools(server, docIndexer, projectRoot);

      const tools = server.getTools();
      const generateTool = tools.get("mags_generate_claude_md");
      const auditTool = tools.get("mags_audit_claude_md");

      expect(generateTool?.description).toContain("Generate a CLAUDE.md");
      expect(auditTool?.description).toContain("Audit the existing CLAUDE.md");
    });
  });

  // ── mags_generate_claude_md ────────────────────

  describe("mags_generate_claude_md", () => {
    it("generates CLAUDE.md content for empty docs", async () => {
      const server = createMockServer();
      const docIndexer = new DocIndexer(docsDir);
      docIndexer.index();

      registerClaudeMdTools(server, docIndexer, projectRoot);

      const result = (await server.callTool("mags_generate_claude_md")) as {
        content: Array<{ type: string; text: string }>;
      };

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe("text");

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.generated).toBeDefined();
      expect(parsed.path).toBe(join(projectRoot, "CLAUDE.md"));
      expect(parsed.note).toContain("Review and customize");
    });

    it("extracts project name from vision document", async () => {
      writeDoc(
        docsDir,
        "vision.md",
        `---
title: My Project Vision
---

# My Awesome Project — Vision Document

This is the project vision.
`
      );

      const server = createMockServer();
      const docIndexer = new DocIndexer(docsDir);
      docIndexer.index();

      registerClaudeMdTools(server, docIndexer, projectRoot);

      const result = (await server.callTool("mags_generate_claude_md")) as {
        content: Array<{ type: string; text: string }>;
      };

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.generated).toContain("# My Awesome Project");
    });

    it("includes tech stack section when tech-stack doc exists", async () => {
      writeDoc(
        docsDir,
        "tech-stack.md",
        `---
title: Tech Stack
---

# Tech Stack

## Backend
- **Node.js** v20 LTS
- **TypeScript** 5.x with strict mode
- **NestJS** for framework

## Frontend
- **React** 18.x
- **TailwindCSS** for styling
`
      );

      const server = createMockServer();
      const docIndexer = new DocIndexer(docsDir);
      docIndexer.index();

      registerClaudeMdTools(server, docIndexer, projectRoot);

      const result = (await server.callTool("mags_generate_claude_md")) as {
        content: Array<{ type: string; text: string }>;
      };

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.generated).toContain("## Tech Stack");
      expect(parsed.generated).toContain("**Node.js**");
    });

    it("includes module map from project-structure doc", async () => {
      writeDoc(
        docsDir,
        "project-structure.md",
        `---
title: Project Structure
---

# Project Structure

modules/
  auth/
    controllers/
    services/
  users/
    controllers/
    services/

Other content follows.
`
      );

      const server = createMockServer();
      const docIndexer = new DocIndexer(docsDir);
      docIndexer.index();

      registerClaudeMdTools(server, docIndexer, projectRoot);

      const result = (await server.callTool("mags_generate_claude_md")) as {
        content: Array<{ type: string; text: string }>;
      };

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.generated).toContain("## Module Map");
      expect(parsed.generated).toContain("modules/");
    });

    it("includes architectural decisions from ADR docs", async () => {
      mkdirSync(join(docsDir, "adr"), { recursive: true });
      writeDoc(
        docsDir,
        "adr-001.md",
        `---
title: Use PostgreSQL for Database
---

# ADR-001: Use PostgreSQL for Database

## Decision

We will use PostgreSQL as the primary database.

## Rationale

PostgreSQL provides excellent JSON support.
`,
        "adr"
      );

      const server = createMockServer();
      const docIndexer = new DocIndexer(docsDir);
      docIndexer.index();

      registerClaudeMdTools(server, docIndexer, projectRoot);

      const result = (await server.callTool("mags_generate_claude_md")) as {
        content: Array<{ type: string; text: string }>;
      };

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.generated).toContain("## Architectural Decisions");
      expect(parsed.generated).toContain("Use PostgreSQL for Database");
    });

    it("includes documentation reference section", async () => {
      writeDoc(docsDir, "prd.md", "# Product Requirements\n\nContent here.");
      writeDoc(docsDir, "api.md", "# API Documentation\n\nAPI content.");

      const server = createMockServer();
      const docIndexer = new DocIndexer(docsDir);
      docIndexer.index();

      registerClaudeMdTools(server, docIndexer, projectRoot);

      const result = (await server.callTool("mags_generate_claude_md")) as {
        content: Array<{ type: string; text: string }>;
      };

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.generated).toContain("## Documentation");
      expect(parsed.generated).toContain("docs/");
    });

    it("includes general rules section", async () => {
      const server = createMockServer();
      const docIndexer = new DocIndexer(docsDir);
      docIndexer.index();

      registerClaudeMdTools(server, docIndexer, projectRoot);

      const result = (await server.callTool("mags_generate_claude_md")) as {
        content: Array<{ type: string; text: string }>;
      };

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.generated).toContain("## Rules");
      expect(parsed.generated).toContain("### General");
      expect(parsed.generated).toContain(
        "Read relevant documentation before modifying code"
      );
    });

    it("includes stack-specific rules when config has stack", async () => {
      const server = createMockServer();
      const docIndexer = new DocIndexer(docsDir);
      docIndexer.index();

      const config: MagsConfig = {
        docsDir: "docs",
        magsDir: "docs/.mags",
        templates: "general",
        autoSessionSave: true,
        autoSessionLoad: true,
        docValidation: true,
        locale: "en",
        stack: {
          primaryLanguage: "typescript",
        },
        embedding: {
          provider: "local",
        },
      };

      registerClaudeMdTools(server, docIndexer, projectRoot, config);

      const result = (await server.callTool("mags_generate_claude_md")) as {
        content: Array<{ type: string; text: string }>;
      };

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.generated).toContain("### Coding Standards");
      expect(parsed.generated).toContain("No `any` types");
    });

    it("includes architecture guidance when config has architecture", async () => {
      const server = createMockServer();
      const docIndexer = new DocIndexer(docsDir);
      docIndexer.index();

      const config: MagsConfig = {
        docsDir: "docs",
        magsDir: "docs/.mags",
        templates: "general",
        autoSessionSave: true,
        autoSessionLoad: true,
        docValidation: true,
        locale: "en",
        architecture: "microservices",
        embedding: {
          provider: "local",
        },
      };

      registerClaudeMdTools(server, docIndexer, projectRoot, config);

      const result = (await server.callTool("mags_generate_claude_md")) as {
        content: Array<{ type: string; text: string }>;
      };

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.generated).toContain("### Architecture Guidelines");
      expect(parsed.generated).toContain("Each service owns its data");
    });

    it("adds generic TypeScript rules when no stack config provided", async () => {
      const server = createMockServer();
      const docIndexer = new DocIndexer(docsDir);
      docIndexer.index();

      registerClaudeMdTools(server, docIndexer, projectRoot);

      const result = (await server.callTool("mags_generate_claude_md")) as {
        content: Array<{ type: string; text: string }>;
      };

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.generated).toContain("No `any` types in TypeScript");
    });
  });

  // ── mags_audit_claude_md ───────────────────────

  describe("mags_audit_claude_md", () => {
    it("returns exists: false when CLAUDE.md does not exist", async () => {
      const server = createMockServer();
      const docIndexer = new DocIndexer(docsDir);
      docIndexer.index();

      registerClaudeMdTools(server, docIndexer, projectRoot);

      const result = (await server.callTool("mags_audit_claude_md")) as {
        content: Array<{ type: string; text: string }>;
      };

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.exists).toBe(false);
      expect(parsed.suggestion).toContain("mags_generate_claude_md");
    });

    it("audits existing CLAUDE.md and returns score", async () => {
      writeFileSync(
        join(projectRoot, "CLAUDE.md"),
        `# Project Rules

## Tech Stack

- Node.js
- TypeScript

## Module Structure

modules/
  auth/
  users/

## Rules

- Follow existing patterns
- Write tests for new functionality
- No \`any\` types

Read docs/ for more information.
`
      );

      const server = createMockServer();
      const docIndexer = new DocIndexer(docsDir);
      docIndexer.index();

      registerClaudeMdTools(server, docIndexer, projectRoot);

      const result = (await server.callTool("mags_audit_claude_md")) as {
        content: Array<{ type: string; text: string }>;
      };

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.exists).toBe(true);
      expect(parsed.score).toBeGreaterThanOrEqual(0);
      expect(parsed.score).toBeLessThanOrEqual(100);
      expect(parsed.wordCount).toBeGreaterThan(0);
    });

    it("detects missing tech stack reference", async () => {
      writeFileSync(
        join(projectRoot, "CLAUDE.md"),
        `# Project Rules

## Module Structure

Some content here.

## Rules

- Follow patterns
`
      );

      const server = createMockServer();
      const docIndexer = new DocIndexer(docsDir);
      docIndexer.index();

      registerClaudeMdTools(server, docIndexer, projectRoot);

      const result = (await server.callTool("mags_audit_claude_md")) as {
        content: Array<{ type: string; text: string }>;
      };

      const parsed = JSON.parse(result.content[0].text);
      const techIssue = parsed.issues.find(
        (i: { detail: string }) => i.detail === "No tech stack reference found"
      );
      expect(techIssue).toBeDefined();
      expect(techIssue.severity).toBe("warning");
    });

    it("detects missing module/structure reference", async () => {
      writeFileSync(
        join(projectRoot, "CLAUDE.md"),
        `# Project Rules

## Tech Stack

- Node.js

## Rules

- Follow patterns
`
      );

      const server = createMockServer();
      const docIndexer = new DocIndexer(docsDir);
      docIndexer.index();

      registerClaudeMdTools(server, docIndexer, projectRoot);

      const result = (await server.callTool("mags_audit_claude_md")) as {
        content: Array<{ type: string; text: string }>;
      };

      const parsed = JSON.parse(result.content[0].text);
      const moduleIssue = parsed.issues.find(
        (i: { detail: string }) =>
          i.detail === "No module/structure reference found"
      );
      expect(moduleIssue).toBeDefined();
    });

    it("detects missing docs directory reference", async () => {
      writeFileSync(
        join(projectRoot, "CLAUDE.md"),
        `# Project Rules

## Tech Stack

- Node.js

## Module Structure

modules/auth
`
      );

      const server = createMockServer();
      const docIndexer = new DocIndexer(docsDir);
      docIndexer.index();

      registerClaudeMdTools(server, docIndexer, projectRoot);

      const result = (await server.callTool("mags_audit_claude_md")) as {
        content: Array<{ type: string; text: string }>;
      };

      const parsed = JSON.parse(result.content[0].text);
      const docsIssue = parsed.issues.find(
        (i: { detail: string }) =>
          i.detail === "No documentation directory reference"
      );
      expect(docsIssue).toBeDefined();
      expect(docsIssue.severity).toBe("info");
    });

    it("detects missing rules section", async () => {
      writeFileSync(
        join(projectRoot, "CLAUDE.md"),
        `# Project

## Tech Stack

- Node.js

## Module Structure

modules/
`
      );

      const server = createMockServer();
      const docIndexer = new DocIndexer(docsDir);
      docIndexer.index();

      registerClaudeMdTools(server, docIndexer, projectRoot);

      const result = (await server.callTool("mags_audit_claude_md")) as {
        content: Array<{ type: string; text: string }>;
      };

      const parsed = JSON.parse(result.content[0].text);
      const rulesIssue = parsed.issues.find(
        (i: { detail: string }) =>
          i.detail === "No coding rules section or conventions found"
      );
      expect(rulesIssue).toBeDefined();
    });

    it("accepts inline rules without section header", async () => {
      writeFileSync(
        join(projectRoot, "CLAUDE.md"),
        `# Project

## Tech Stack

- Node.js

## Module Structure

modules/

Always follow the existing patterns.
You must write tests for all new code.
`
      );

      const server = createMockServer();
      const docIndexer = new DocIndexer(docsDir);
      docIndexer.index();

      registerClaudeMdTools(server, docIndexer, projectRoot);

      const result = (await server.callTool("mags_audit_claude_md")) as {
        content: Array<{ type: string; text: string }>;
      };

      const parsed = JSON.parse(result.content[0].text);
      const rulesIssue = parsed.issues.find(
        (i: { detail: string }) =>
          i.detail === "No coding rules section or conventions found"
      );
      expect(rulesIssue).toBeUndefined();
    });

    it("detects too short CLAUDE.md", async () => {
      writeFileSync(join(projectRoot, "CLAUDE.md"), `# Project\n\nShort.`);

      const server = createMockServer();
      const docIndexer = new DocIndexer(docsDir);
      docIndexer.index();

      registerClaudeMdTools(server, docIndexer, projectRoot);

      const result = (await server.callTool("mags_audit_claude_md")) as {
        content: Array<{ type: string; text: string }>;
      };

      const parsed = JSON.parse(result.content[0].text);
      const shortIssue = parsed.issues.find((i: { type: string }) =>
        i.type === "too_short"
      );
      expect(shortIssue).toBeDefined();
      expect(shortIssue.severity).toBe("warning");
    });

    it("detects too long CLAUDE.md", async () => {
      const longContent = "word ".repeat(2100);
      writeFileSync(
        join(projectRoot, "CLAUDE.md"),
        `# Project\n\n${longContent}`
      );

      const server = createMockServer();
      const docIndexer = new DocIndexer(docsDir);
      docIndexer.index();

      registerClaudeMdTools(server, docIndexer, projectRoot);

      const result = (await server.callTool("mags_audit_claude_md")) as {
        content: Array<{ type: string; text: string }>;
      };

      const parsed = JSON.parse(result.content[0].text);
      const longIssue = parsed.issues.find((i: { type: string }) =>
        i.type === "too_long"
      );
      expect(longIssue).toBeDefined();
      expect(longIssue.severity).toBe("info");
    });

    it("calculates score correctly based on issues", async () => {
      // CLAUDE.md with no warnings or errors (info issues don't affect score)
      // Need 50+ words to avoid "too_short" warning
      writeFileSync(
        join(projectRoot, "CLAUDE.md"),
        `# Project Rules

## Tech Stack

- Node.js LTS version for the backend
- TypeScript with strict mode enabled
- React for frontend development
- PostgreSQL for database storage
- Prisma ORM for database access

## Module Structure

The project follows a modular architecture:

modules/
  auth/ - authentication and authorization
  users/ - user management functionality
  products/ - product catalog and inventory

## Rules

- Follow existing patterns and conventions consistently
- Write tests for all new functionality added
- No \`any\` types allowed in TypeScript code
- Use descriptive variable and function names
- Document public APIs thoroughly

Read docs/ for more detailed information on each module.
`
      );

      const server = createMockServer();
      const docIndexer = new DocIndexer(docsDir);
      docIndexer.index();

      registerClaudeMdTools(server, docIndexer, projectRoot);

      const result = (await server.callTool("mags_audit_claude_md")) as {
        content: Array<{ type: string; text: string }>;
      };

      const parsed = JSON.parse(result.content[0].text);
      // Score should be 100 when there are no errors or warnings
      // (info level issues don't reduce score)
      expect(parsed.score).toBe(100);
      expect(parsed.wordCount).toBeGreaterThanOrEqual(50);
    });

    it("reduces score for warnings", async () => {
      // CLAUDE.md missing tech stack (1 warning = -10)
      writeFileSync(
        join(projectRoot, "CLAUDE.md"),
        `# Project Rules

## Module Structure

modules/
  auth/

## Rules

- Follow patterns

Read docs/ for more.
`
      );

      const server = createMockServer();
      const docIndexer = new DocIndexer(docsDir);
      docIndexer.index();

      registerClaudeMdTools(server, docIndexer, projectRoot);

      const result = (await server.callTool("mags_audit_claude_md")) as {
        content: Array<{ type: string; text: string }>;
      };

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.score).toBeLessThan(100);
    });

    it("provides suggestions for improvements", async () => {
      writeFileSync(
        join(projectRoot, "CLAUDE.md"),
        `# Project

## Module Structure

modules/
`
      );

      const server = createMockServer();
      const docIndexer = new DocIndexer(docsDir);
      docIndexer.index();

      registerClaudeMdTools(server, docIndexer, projectRoot);

      const result = (await server.callTool("mags_audit_claude_md")) as {
        content: Array<{ type: string; text: string }>;
      };

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.suggestions.length).toBeGreaterThan(0);
    });
  });

  // ── Edge Cases ─────────────────────────────────

  describe("edge cases", () => {
    it("handles CLAUDE.md with only whitespace content", async () => {
      writeFileSync(join(projectRoot, "CLAUDE.md"), "   \n\n   \t   \n");

      const server = createMockServer();
      const docIndexer = new DocIndexer(docsDir);
      docIndexer.index();

      registerClaudeMdTools(server, docIndexer, projectRoot);

      const result = (await server.callTool("mags_audit_claude_md")) as {
        content: Array<{ type: string; text: string }>;
      };

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.exists).toBe(true);
      expect(parsed.wordCount).toBeLessThan(10);
    });

    it("handles docs with special characters in paths", async () => {
      mkdirSync(join(docsDir, "api-v2.0"), { recursive: true });
      writeDoc(
        docsDir,
        "endpoints.md",
        "# API Endpoints\n\nContent",
        "api-v2.0"
      );

      const server = createMockServer();
      const docIndexer = new DocIndexer(docsDir);
      docIndexer.index();

      registerClaudeMdTools(server, docIndexer, projectRoot);

      const result = (await server.callTool("mags_generate_claude_md")) as {
        content: Array<{ type: string; text: string }>;
      };

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.generated).toContain("Documentation");
    });

    it("handles Turkish content in vision document", async () => {
      writeDoc(
        docsDir,
        "vision.md",
        `---
title: Proje Vizyonu
---

# Uygulama Yönetici — Vizyon

Bu proje hakkinda bilgiler.
`
      );

      const server = createMockServer();
      const docIndexer = new DocIndexer(docsDir);
      docIndexer.index();

      registerClaudeMdTools(server, docIndexer, projectRoot);

      const result = (await server.callTool("mags_generate_claude_md")) as {
        content: Array<{ type: string; text: string }>;
      };

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.generated).toContain("Uygulama Yönetici");
    });

    it("handles ADR docs with Turkish decision section", async () => {
      mkdirSync(join(docsDir, "adr"), { recursive: true });
      writeDoc(
        docsDir,
        "adr-001.md",
        `---
title: Veritabani Secimi
---

# ADR-001: Veritabani Secimi

## Karar

PostgreSQL kullanilacak.

## Gerekce

JSON destegi iyi.
`,
        "adr"
      );

      const server = createMockServer();
      const docIndexer = new DocIndexer(docsDir);
      docIndexer.index();

      registerClaudeMdTools(server, docIndexer, projectRoot);

      const result = (await server.callTool("mags_generate_claude_md")) as {
        content: Array<{ type: string; text: string }>;
      };

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.generated).toContain("## Architectural Decisions");
      expect(parsed.generated).toContain("Veritabani Secimi");
    });

    it("limits tech stack lines to 15", async () => {
      const manyTechLines = Array.from(
        { length: 25 },
        (_, i) => `- **Tech ${i}** description`
      ).join("\n");

      writeDoc(
        docsDir,
        "tech-stack.md",
        `---
title: Tech Stack
---

# Tech Stack

${manyTechLines}
`
      );

      const server = createMockServer();
      const docIndexer = new DocIndexer(docsDir);
      docIndexer.index();

      registerClaudeMdTools(server, docIndexer, projectRoot);

      const result = (await server.callTool("mags_generate_claude_md")) as {
        content: Array<{ type: string; text: string }>;
      };

      const parsed = JSON.parse(result.content[0].text);
      const techMatches = parsed.generated.match(/\*\*Tech \d+\*\*/g);
      expect(techMatches?.length).toBeLessThanOrEqual(15);
    });

    it("truncates long module map content", async () => {
      const longModuleMap =
        "modules/\n" + "  " + "a/".repeat(300) + "\n  b/\n  c/";

      writeDoc(
        docsDir,
        "project-structure.md",
        `---
title: Project Structure
---

# Project Structure

${longModuleMap}

Other content.
`
      );

      const server = createMockServer();
      const docIndexer = new DocIndexer(docsDir);
      docIndexer.index();

      registerClaudeMdTools(server, docIndexer, projectRoot);

      const result = (await server.callTool("mags_generate_claude_md")) as {
        content: Array<{ type: string; text: string }>;
      };

      const parsed = JSON.parse(result.content[0].text);
      // Module map content should be truncated to 500 chars
      const moduleMapSection = parsed.generated.match(
        /## Module Map\n\n```\n([\s\S]*?)```/
      );
      if (moduleMapSection) {
        expect(moduleMapSection[1].length).toBeLessThanOrEqual(510); // 500 + some slack
      }
    });
  });
});
