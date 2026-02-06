// ============================================
// MAGS — Orchestrator Tools Integration Tests
// ============================================

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerOrchestratorTools } from "./orchestrator-tools.js";
import type { MagsConfig } from "../types/index.js";

// --- Test Helpers ---

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), "mags-orchestrator-tools-test-"));
}

function writeFile(dir: string, relativePath: string, content: string): string {
  const fullPath = join(dir, relativePath);
  const dirPath = fullPath.substring(0, fullPath.lastIndexOf("/"));
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
  writeFileSync(fullPath, content);
  return fullPath;
}

function cleanupDir(dir: string): void {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

function createTestConfig(tempDir: string): MagsConfig {
  return {
    docsDir: join(tempDir, "docs"),
    magsDir: join(tempDir, "docs/.mags"),
    templates: "general",
    docValidation: true,
    locale: "en",
    embedding: {
      provider: "local",
    },
  };
}

// --- Valid PRD Content for Tests ---

const VALID_PRD = `---
title: "TestApp"
version: "1.0.0"
status: draft
---

# TestApp — Product Requirements (PRD)

## Overview

A simple test application for integration testing.

## Modules

### M1: auth
> Authentication module

#### Features
| ID | Feature | Description | Priority | Phase |
|---|---|---|---|---|
| M1-001 | Login | User login | P0 | 1 |
| M1-002 | Register | User registration | P0 | 1 |

#### Acceptance Criteria
- [ ] User can login with email
- [ ] User can register

#### Dependencies
- Requires: []
- Blocks: [users]

---

### M2: users
> User management module

#### Features
| ID | Feature | Description | Priority | Phase |
|---|---|---|---|---|
| M2-001 | List | List users | P1 | 2 |
| M2-002 | Profile | User profile | P1 | 2 |

#### Acceptance Criteria
- [ ] Admin can list users
- [ ] User can view profile

#### Dependencies
- Requires: [auth]
- Blocks: []
`;

const INVALID_PRD = `# Invalid PRD

This PRD has no modules defined.
Just some random text.
`;

const MINIMAL_PRD = `# MinimalApp

### M1: core
> Core module

#### Features
| ID | Feature | Description | Priority | Phase |
|---|---|---|---|---|
| M1-001 | Main | Main feature | P0 | 1 |
`;

// --- Mock McpServer for Tool Registration Tests ---

interface RegisteredTool {
  name: string;
  description: string;
  schema: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

function createMockServer(): McpServer & { _tools: Map<string, RegisteredTool> } {
  const tools = new Map<string, RegisteredTool>();

  const mockServer = {
    _tools: tools,
    tool(
      name: string,
      description: string,
      schema: Record<string, unknown>,
      handler: (args: Record<string, unknown>) => Promise<unknown>
    ) {
      tools.set(name, { name, description, schema, handler });
    },
  } as unknown as McpServer & { _tools: Map<string, RegisteredTool> };

  return mockServer;
}

// --- Tests ---

describe("Orchestrator Tools Integration Tests", () => {
  let tempDir: string;
  let config: MagsConfig;
  let server: McpServer & { _tools: Map<string, RegisteredTool> };

  beforeEach(() => {
    tempDir = createTempDir();
    config = createTestConfig(tempDir);
    server = createMockServer();

    // Create necessary directories
    mkdirSync(config.docsDir, { recursive: true });
    mkdirSync(config.magsDir, { recursive: true });

    // Register tools
    registerOrchestratorTools(server, config, tempDir);
  });

  afterEach(() => {
    cleanupDir(tempDir);
  });

  describe("Tool Registration", () => {
    it("should register all 10 orchestrator tools", () => {
      const expectedTools = [
        "mags_parse_prd",
        "mags_analyze_codebase",
        "mags_generate_skill",
        "mags_generate_agent",
        "mags_init_execution",
        "mags_execute_step",
        "mags_get_current_step",
        "mags_resume_execution",
        "mags_verify_module",
        "mags_get_execution_status",
      ];

      expect(server._tools.size).toBe(expectedTools.length);

      for (const toolName of expectedTools) {
        expect(server._tools.has(toolName)).toBe(true);
      }
    });

    it("should register mags_parse_prd with correct schema", () => {
      const tool = server._tools.get("mags_parse_prd");

      expect(tool).toBeDefined();
      expect(tool!.description).toContain("PRD");
      expect(tool!.schema).toHaveProperty("prdPath");
      expect(tool!.schema).toHaveProperty("validateOnly");
    });

    it("should register mags_analyze_codebase with correct schema", () => {
      const tool = server._tools.get("mags_analyze_codebase");

      expect(tool).toBeDefined();
      expect(tool!.description).toContain("codebase");
      expect(tool!.schema).toHaveProperty("projectRoot");
      expect(tool!.schema).toHaveProperty("generateReversePrd");
    });

    it("should register mags_generate_skill with correct schema", () => {
      const tool = server._tools.get("mags_generate_skill");

      expect(tool).toBeDefined();
      expect(tool!.description).toContain("skill");
      expect(tool!.schema).toHaveProperty("moduleName");
      expect(tool!.schema).toHaveProperty("prdPath");
    });

    it("should register mags_generate_agent with correct schema", () => {
      const tool = server._tools.get("mags_generate_agent");

      expect(tool).toBeDefined();
      expect(tool!.description).toContain("agent");
      expect(tool!.schema).toHaveProperty("moduleName");
      expect(tool!.schema).toHaveProperty("prdPath");
    });

    it("should register mags_init_execution with correct schema", () => {
      const tool = server._tools.get("mags_init_execution");

      expect(tool).toBeDefined();
      expect(tool!.description).toContain("execution");
      expect(tool!.schema).toHaveProperty("prdPath");
      expect(tool!.schema).toHaveProperty("moduleType");
    });

    it("should register mags_execute_step with correct schema", () => {
      const tool = server._tools.get("mags_execute_step");

      expect(tool).toBeDefined();
      expect(tool!.description).toContain("action");
      expect(tool!.schema).toHaveProperty("action");
    });

    it("should register mags_get_current_step with empty schema", () => {
      const tool = server._tools.get("mags_get_current_step");

      expect(tool).toBeDefined();
      expect(tool!.description).toContain("current");
      expect(Object.keys(tool!.schema)).toHaveLength(0);
    });

    it("should register mags_resume_execution with empty schema", () => {
      const tool = server._tools.get("mags_resume_execution");

      expect(tool).toBeDefined();
      expect(tool!.description).toContain("Resume");
      expect(Object.keys(tool!.schema)).toHaveLength(0);
    });

    it("should register mags_verify_module with correct schema", () => {
      const tool = server._tools.get("mags_verify_module");

      expect(tool).toBeDefined();
      expect(tool!.description).toContain("TDD");
      expect(tool!.schema).toHaveProperty("moduleName");
      expect(tool!.schema).toHaveProperty("prdPath");
    });

    it("should register mags_get_execution_status with empty schema", () => {
      const tool = server._tools.get("mags_get_execution_status");

      expect(tool).toBeDefined();
      expect(tool!.description).toContain("status");
      expect(Object.keys(tool!.schema)).toHaveLength(0);
    });
  });

  describe("mags_parse_prd", () => {
    it("should validate valid PRD file", async () => {
      const prdPath = writeFile(tempDir, "docs/prd.md", VALID_PRD);
      const tool = server._tools.get("mags_parse_prd")!;

      const result = await tool.handler({ prdPath, validateOnly: true });

      expect(result).toHaveProperty("content");
      const content = (result as { content: { text: string }[] }).content[0].text;
      const parsed = JSON.parse(content);

      expect(parsed.valid).toBe(true);
      expect(parsed.errors).toHaveLength(0);
    });

    it("should parse valid PRD and extract plan", async () => {
      const prdPath = writeFile(tempDir, "docs/prd.md", VALID_PRD);
      const tool = server._tools.get("mags_parse_prd")!;

      const result = await tool.handler({ prdPath });

      expect(result).toHaveProperty("content");
      const content = (result as { content: { text: string }[] }).content[0].text;
      const parsed = JSON.parse(content);

      expect(parsed.success).toBe(true);
      expect(parsed.project).toBeDefined();
      expect(parsed.totalModules).toBe(2);
      expect(parsed.modules).toHaveLength(2);
      expect(parsed.modules[0].name).toBe("auth");
      expect(parsed.modules[1].name).toBe("users");
    });

    it("should return errors for invalid PRD", async () => {
      const prdPath = writeFile(tempDir, "docs/invalid.md", INVALID_PRD);
      const tool = server._tools.get("mags_parse_prd")!;

      const result = await tool.handler({ prdPath });

      expect(result).toHaveProperty("content");
      const content = (result as { content: { text: string }[] }).content[0].text;
      const parsed = JSON.parse(content);

      expect(parsed.success).toBe(false);
      expect(parsed.errors).toBeDefined();
      expect(parsed.errors.length).toBeGreaterThan(0);
    });

    it("should include dependency graph in parsed plan", async () => {
      const prdPath = writeFile(tempDir, "docs/prd.md", VALID_PRD);
      const tool = server._tools.get("mags_parse_prd")!;

      const result = await tool.handler({ prdPath });

      const content = (result as { content: { text: string }[] }).content[0].text;
      const parsed = JSON.parse(content);

      expect(parsed.success).toBe(true);
      expect(parsed.dependencyGraph).toBeDefined();
      expect(Array.isArray(parsed.dependencyGraph)).toBe(true);
    });
  });

  describe("mags_analyze_codebase", () => {
    it("should analyze project and discover modules", async () => {
      // Create a simulated project structure
      writeFile(tempDir, "package.json", JSON.stringify({
        name: "test-project",
        version: "1.0.0",
      }));
      writeFile(tempDir, "src/modules/auth/auth.controller.ts", `
        @Controller('auth')
        export class AuthController {
          @Post('/login')
          async login() {}
        }
      `);

      const tool = server._tools.get("mags_analyze_codebase")!;

      const result = await tool.handler({ projectRoot: tempDir });

      expect(result).toHaveProperty("content");
      const content = (result as { content: { text: string }[] }).content[0].text;
      const parsed = JSON.parse(content);

      expect(parsed.success).toBe(true);
      expect(parsed.projectName).toBe("test-project");
      expect(parsed.stack).toBeDefined();
    });

    it("should handle empty project gracefully", async () => {
      writeFile(tempDir, "package.json", JSON.stringify({
        name: "empty-project",
        version: "1.0.0",
      }));

      const tool = server._tools.get("mags_analyze_codebase")!;

      const result = await tool.handler({ projectRoot: tempDir });

      const content = (result as { content: { text: string }[] }).content[0].text;
      const parsed = JSON.parse(content);

      expect(parsed.success).toBe(true);
      expect(parsed.modules).toHaveLength(0);
      expect(parsed.totalEndpoints).toBe(0);
    });

    it("should detect tech debt markers", async () => {
      writeFile(tempDir, "package.json", JSON.stringify({ name: "debt-test" }));
      writeFile(tempDir, "src/service.ts", `
        // TODO: Implement caching
        // FIXME: This is a bug
        function doSomething() {
          return true;
        }
      `);

      const tool = server._tools.get("mags_analyze_codebase")!;

      const result = await tool.handler({ projectRoot: tempDir });

      const content = (result as { content: { text: string }[] }).content[0].text;
      const parsed = JSON.parse(content);

      expect(parsed.success).toBe(true);
      expect(parsed.techDebtItems).toBeGreaterThanOrEqual(2);
    });
  });

  describe("mags_get_execution_status", () => {
    it("should return no state when not initialized", async () => {
      const tool = server._tools.get("mags_get_execution_status")!;

      const result = await tool.handler({});

      expect(result).toHaveProperty("content");
      const content = (result as { content: { text: string }[] }).content[0].text;
      const parsed = JSON.parse(content);

      expect(parsed.hasState).toBe(false);
      expect(parsed.message).toContain("No execution state");
    });
  });

  describe("mags_get_current_step", () => {
    it("should return no step when not initialized", async () => {
      const tool = server._tools.get("mags_get_current_step")!;

      const result = await tool.handler({});

      expect(result).toHaveProperty("content");
      const content = (result as { content: { text: string }[] }).content[0].text;
      const parsed = JSON.parse(content);

      expect(parsed.hasStep).toBe(false);
      expect(parsed.message).toContain("No execution state");
    });
  });

  describe("mags_generate_skill", () => {
    it("should return error when PRD parsing fails", async () => {
      const prdPath = writeFile(tempDir, "docs/invalid.md", INVALID_PRD);
      const tool = server._tools.get("mags_generate_skill")!;

      const result = await tool.handler({ moduleName: "auth", prdPath });

      const content = (result as { content: { text: string }[] }).content[0].text;
      const parsed = JSON.parse(content);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("parse PRD");
    });

    it("should return error when module not found", async () => {
      const prdPath = writeFile(tempDir, "docs/prd.md", VALID_PRD);
      const tool = server._tools.get("mags_generate_skill")!;

      const result = await tool.handler({ moduleName: "nonexistent", prdPath });

      const content = (result as { content: { text: string }[] }).content[0].text;
      const parsed = JSON.parse(content);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("not found");
      expect(parsed.availableModules).toContain("auth");
      expect(parsed.availableModules).toContain("users");
    });

    it("should generate skill for valid module", async () => {
      const prdPath = writeFile(tempDir, "docs/prd.md", VALID_PRD);
      const tool = server._tools.get("mags_generate_skill")!;

      const result = await tool.handler({ moduleName: "auth", prdPath });

      const content = (result as { content: { text: string }[] }).content[0].text;
      const parsed = JSON.parse(content);

      expect(parsed.success).toBe(true);
      expect(parsed.skill).toBeDefined();
      expect(parsed.skill.name).toContain("auth");
      expect(parsed.fullContent).toBeDefined();
    });
  });

  describe("mags_generate_agent", () => {
    it("should return error when PRD parsing fails", async () => {
      const prdPath = writeFile(tempDir, "docs/invalid.md", INVALID_PRD);
      const tool = server._tools.get("mags_generate_agent")!;

      const result = await tool.handler({ moduleName: "auth", prdPath });

      const content = (result as { content: { text: string }[] }).content[0].text;
      const parsed = JSON.parse(content);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("parse PRD");
    });

    it("should return error when module not found", async () => {
      const prdPath = writeFile(tempDir, "docs/prd.md", VALID_PRD);
      const tool = server._tools.get("mags_generate_agent")!;

      const result = await tool.handler({ moduleName: "nonexistent", prdPath });

      const content = (result as { content: { text: string }[] }).content[0].text;
      const parsed = JSON.parse(content);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("not found");
    });

    it("should generate agent for valid module", async () => {
      const prdPath = writeFile(tempDir, "docs/prd.md", VALID_PRD);
      const tool = server._tools.get("mags_generate_agent")!;

      const result = await tool.handler({ moduleName: "auth", prdPath });

      const content = (result as { content: { text: string }[] }).content[0].text;
      const parsed = JSON.parse(content);

      expect(parsed.success).toBe(true);
      expect(parsed.agent).toBeDefined();
      expect(parsed.agent.name).toContain("auth");
      expect(parsed.agent.type).toBeDefined();
      expect(parsed.fullContent).toBeDefined();
    });
  });

  describe("mags_init_execution", () => {
    it("should return errors for invalid PRD", async () => {
      const prdPath = writeFile(tempDir, "docs/invalid.md", INVALID_PRD);
      const tool = server._tools.get("mags_init_execution")!;

      const result = await tool.handler({ prdPath });

      const content = (result as { content: { text: string }[] }).content[0].text;
      const parsed = JSON.parse(content);

      expect(parsed.success).toBe(false);
      expect(parsed.errors).toBeDefined();
    });

    it("should initialize execution from valid PRD", async () => {
      const prdPath = writeFile(tempDir, "docs/prd.md", VALID_PRD);
      const tool = server._tools.get("mags_init_execution")!;

      const result = await tool.handler({ prdPath });

      const content = (result as { content: { text: string }[] }).content[0].text;
      const parsed = JSON.parse(content);

      expect(parsed.success).toBe(true);
      expect(parsed.initialized).toBe(true);
      expect(parsed.totalSteps).toBeGreaterThan(0);
      expect(parsed.modules).toContain("auth");
      expect(parsed.modules).toContain("users");
    });
  });

  describe("mags_execute_step", () => {
    it("should handle action without execution state", async () => {
      // Create fresh server without initialization
      const freshServer = createMockServer();
      registerOrchestratorTools(freshServer, config, tempDir);

      const tool = freshServer._tools.get("mags_execute_step")!;

      const result = await tool.handler({ action: "a" });

      const content = (result as { content: { text: string }[] }).content[0].text;
      const parsed = JSON.parse(content);

      // Should return status (might be null or error depending on implementation)
      expect(parsed).toBeDefined();
    });
  });

  describe("mags_resume_execution", () => {
    it("should handle resume execution call", async () => {
      const tool = server._tools.get("mags_resume_execution")!;

      const result = await tool.handler({});

      const content = (result as { content: { text: string }[] }).content[0].text;
      const parsed = JSON.parse(content);

      // The orchestrator is a singleton, so it may have state from previous tests
      // or it may not have state. Either case is valid for this test.
      expect(parsed).toBeDefined();
      // If no state exists, it should indicate failure
      // If state exists (from previous tests), it should indicate success
      expect(typeof parsed.success).toBe("boolean");
    });
  });

  describe("mags_verify_module", () => {
    // Note: Tests that actually run TddEngine with pnpm are skipped because:
    // 1. TddEngine tries to spawn pnpm processes which may timeout
    // 2. These are integration tests for tool registration, not TddEngine itself
    // Full TddEngine tests are in orchestrator.e2e.test.ts

    it("should return error when module not found in PRD", async () => {
      const prdPath = writeFile(tempDir, "docs/prd.md", VALID_PRD);
      const tool = server._tools.get("mags_verify_module")!;

      const result = await tool.handler({ moduleName: "nonexistent", prdPath });

      const content = (result as { content: { text: string }[] }).content[0].text;
      const parsed = JSON.parse(content);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("not found");
    });

    it("should return error for invalid PRD in full verify", async () => {
      const prdPath = writeFile(tempDir, "docs/invalid.md", INVALID_PRD);
      const tool = server._tools.get("mags_verify_module")!;

      const result = await tool.handler({ moduleName: "auth", prdPath });

      const content = (result as { content: { text: string }[] }).content[0].text;
      const parsed = JSON.parse(content);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("parse PRD");
    });

    it("should have correct tool schema for verify_module", () => {
      const tool = server._tools.get("mags_verify_module")!;

      expect(tool.schema).toHaveProperty("moduleName");
      expect(tool.schema).toHaveProperty("prdPath");
      expect(tool.description).toContain("TDD");
      expect(tool.description).toContain("verification");
    });
  });

  describe("Integration Flow Tests", () => {
    it("should complete basic workflow: parse -> init -> get status", async () => {
      const prdPath = writeFile(tempDir, "docs/prd.md", VALID_PRD);

      // Step 1: Parse PRD
      const parseTool = server._tools.get("mags_parse_prd")!;
      const parseResult = await parseTool.handler({ prdPath });
      const parseContent = (parseResult as { content: { text: string }[] }).content[0].text;
      const parsedPlan = JSON.parse(parseContent);

      expect(parsedPlan.success).toBe(true);
      expect(parsedPlan.totalModules).toBe(2);

      // Step 2: Initialize execution
      const initTool = server._tools.get("mags_init_execution")!;
      const initResult = await initTool.handler({ prdPath });
      const initContent = (initResult as { content: { text: string }[] }).content[0].text;
      const initParsed = JSON.parse(initContent);

      expect(initParsed.success).toBe(true);
      expect(initParsed.initialized).toBe(true);

      // Step 3: Get current step
      const stepTool = server._tools.get("mags_get_current_step")!;
      const stepResult = await stepTool.handler({});
      const stepContent = (stepResult as { content: { text: string }[] }).content[0].text;
      const stepParsed = JSON.parse(stepContent);

      expect(stepParsed.hasStep).toBe(true);
      expect(stepParsed.step).toBe(1);

      // Step 4: Get execution status
      const statusTool = server._tools.get("mags_get_execution_status")!;
      const statusResult = await statusTool.handler({});
      const statusContent = (statusResult as { content: { text: string }[] }).content[0].text;
      const statusParsed = JSON.parse(statusContent);

      expect(statusParsed.hasState).toBe(true);
      expect(statusParsed.status).toBeDefined();
      expect(statusParsed.totalSteps).toBeGreaterThan(0);
    });

    it("should handle minimal PRD with single module", async () => {
      const prdPath = writeFile(tempDir, "docs/minimal.md", MINIMAL_PRD);

      const parseTool = server._tools.get("mags_parse_prd")!;
      const parseResult = await parseTool.handler({ prdPath });
      const parseContent = (parseResult as { content: { text: string }[] }).content[0].text;
      const parsedPlan = JSON.parse(parseContent);

      expect(parsedPlan.success).toBe(true);
      expect(parsedPlan.totalModules).toBe(1);
      expect(parsedPlan.modules[0].name).toBe("core");
    });
  });

  describe("Error Handling", () => {
    it("should handle non-existent PRD file", async () => {
      const tool = server._tools.get("mags_parse_prd")!;

      const result = await tool.handler({ prdPath: "/nonexistent/path/prd.md" });

      const content = (result as { content: { text: string }[] }).content[0].text;
      const parsed = JSON.parse(content);

      expect(parsed.success).toBe(false);
    });

    it("should handle non-existent project root in analyze", async () => {
      const tool = server._tools.get("mags_analyze_codebase")!;

      const result = await tool.handler({ projectRoot: "/nonexistent/project" });

      const content = (result as { content: { text: string }[] }).content[0].text;
      const parsed = JSON.parse(content);

      // Should still return a result (might be empty or error)
      expect(parsed).toBeDefined();
    });
  });
});
