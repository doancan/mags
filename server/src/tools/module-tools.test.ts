// ============================================
// MAGS — Module Tools Integration Tests
// Tests MCP tool handlers for module discovery
// ============================================

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerModuleTools } from "./module-tools.js";
import type { MagsConfig } from "../types/index.js";

// --- Test Helpers ---

function makeTmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "mags-module-tools-"));
  return dir;
}

function createDefaultConfig(overrides?: Partial<MagsConfig>): MagsConfig {
  return {
    docsDir: "docs",
    magsDir: "docs/.mags",
    templates: "general",
    autoSessionSave: true,
    autoSessionLoad: true,
    docValidation: true,
    locale: "en",
    embedding: { provider: "local" },
    ...overrides,
  };
}

// Mock MCP server for testing tool registration
interface MockTool {
  name: string;
  description: string;
  schema: Record<string, unknown>;
  handler: () => Promise<{ content: Array<{ type: string; text: string }> }>;
}

function createMockServer(): { server: McpServer; tools: Map<string, MockTool> } {
  const tools = new Map<string, MockTool>();

  const mockServer = {
    tool(
      name: string,
      description: string,
      schema: Record<string, unknown>,
      handler: () => Promise<{ content: Array<{ type: string; text: string }> }>
    ) {
      tools.set(name, { name, description, schema, handler });
    },
  } as unknown as McpServer;

  return { server: mockServer, tools };
}

describe("module-tools", () => {
  let projectRoot: string;

  beforeEach(() => {
    projectRoot = makeTmpDir();
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  describe("tool registration", () => {
    it("registers mags_discover_modules tool", () => {
      const { server, tools } = createMockServer();
      const config = createDefaultConfig();

      registerModuleTools(server, projectRoot, config);

      expect(tools.has("mags_discover_modules")).toBe(true);
    });

    it("registers tool with correct description", () => {
      const { server, tools } = createMockServer();
      const config = createDefaultConfig();

      registerModuleTools(server, projectRoot, config);

      const tool = tools.get("mags_discover_modules");
      expect(tool?.description).toContain("Discover modules");
      expect(tool?.description).toContain("confidence scores");
    });

    it("registers tool with empty schema (no parameters)", () => {
      const { server, tools } = createMockServer();
      const config = createDefaultConfig();

      registerModuleTools(server, projectRoot, config);

      const tool = tools.get("mags_discover_modules");
      expect(tool?.schema).toEqual({});
    });
  });

  describe("discovers modules from src/modules directory", () => {
    it("discovers modules with correct structure", async () => {
      // Create module directories
      mkdirSync(join(projectRoot, "src", "modules", "auth"), { recursive: true });
      mkdirSync(join(projectRoot, "src", "modules", "users"), { recursive: true });

      const { server, tools } = createMockServer();
      const config = createDefaultConfig();

      registerModuleTools(server, projectRoot, config);

      const tool = tools.get("mags_discover_modules");
      const result = await tool!.handler();

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe("text");

      const data = JSON.parse(result.content[0].text);
      expect(data.discovered).toBe(true);
      expect(data.count).toBe(2);
      expect(data.modules.map((m: { name: string }) => m.name)).toContain("auth");
      expect(data.modules.map((m: { name: string }) => m.name)).toContain("users");
    });

    it("includes path and detectedFrom fields", async () => {
      mkdirSync(join(projectRoot, "src", "modules", "auth"), { recursive: true });

      const { server, tools } = createMockServer();
      const config = createDefaultConfig();

      registerModuleTools(server, projectRoot, config);

      const tool = tools.get("mags_discover_modules");
      const result = await tool!.handler();
      const data = JSON.parse(result.content[0].text);

      const authModule = data.modules.find((m: { name: string }) => m.name === "auth");
      expect(authModule.path).toBe(join("src/modules", "auth"));
      expect(authModule.detectedFrom).toBe("src/modules");
    });

    it("includes confidence score for modules", async () => {
      mkdirSync(join(projectRoot, "src", "modules", "auth"), { recursive: true });
      // Add source file to increase confidence
      writeFileSync(
        join(projectRoot, "src", "modules", "auth", "index.ts"),
        "export {};"
      );

      const { server, tools } = createMockServer();
      const config = createDefaultConfig();

      registerModuleTools(server, projectRoot, config);

      const tool = tools.get("mags_discover_modules");
      const result = await tool!.handler();
      const data = JSON.parse(result.content[0].text);

      const authModule = data.modules.find((m: { name: string }) => m.name === "auth");
      expect(authModule.confidence).toBeGreaterThanOrEqual(40);
      expect(authModule.confidence).toBeLessThanOrEqual(100);
    });

    it("includes aliases for known modules", async () => {
      mkdirSync(join(projectRoot, "src", "modules", "auth"), { recursive: true });

      const { server, tools } = createMockServer();
      const config = createDefaultConfig();

      registerModuleTools(server, projectRoot, config);

      const tool = tools.get("mags_discover_modules");
      const result = await tool!.handler();
      const data = JSON.parse(result.content[0].text);

      const authModule = data.modules.find((m: { name: string }) => m.name === "auth");
      expect(authModule.aliases).toContain("auth");
      expect(authModule.aliases).toContain("login");
    });

    it("provides yamlSuggestion for discovered modules", async () => {
      mkdirSync(join(projectRoot, "src", "modules", "auth"), { recursive: true });

      const { server, tools } = createMockServer();
      const config = createDefaultConfig();

      registerModuleTools(server, projectRoot, config);

      const tool = tools.get("mags_discover_modules");
      const result = await tool!.handler();
      const data = JSON.parse(result.content[0].text);

      expect(data.yamlSuggestion).toContain("modules:");
      expect(data.yamlSuggestion).toContain("name: auth");
      expect(data.yamlSuggestion).toContain("aliases:");
    });
  });

  describe("returns empty for project without modules", () => {
    it("returns discovered: false for empty project", async () => {
      const { server, tools } = createMockServer();
      const config = createDefaultConfig();

      registerModuleTools(server, projectRoot, config);

      const tool = tools.get("mags_discover_modules");
      const result = await tool!.handler();
      const data = JSON.parse(result.content[0].text);

      expect(data.discovered).toBe(false);
      expect(data.modules).toEqual([]);
    });

    it("returns helpful message when no modules found", async () => {
      const { server, tools } = createMockServer();
      const config = createDefaultConfig();

      registerModuleTools(server, projectRoot, config);

      const tool = tools.get("mags_discover_modules");
      const result = await tool!.handler();
      const data = JSON.parse(result.content[0].text);

      expect(data.message).toContain("No modules detected");
    });

    it("returns empty for project with only random directories", async () => {
      mkdirSync(join(projectRoot, "random-folder"), { recursive: true });
      mkdirSync(join(projectRoot, "another-folder"), { recursive: true });

      const { server, tools } = createMockServer();
      const config = createDefaultConfig();

      registerModuleTools(server, projectRoot, config);

      const tool = tools.get("mags_discover_modules");
      const result = await tool!.handler();
      const data = JSON.parse(result.content[0].text);

      expect(data.discovered).toBe(false);
      expect(data.modules).toEqual([]);
    });
  });

  describe("respects architecture type parameter", () => {
    it("uses monolith architecture by default", async () => {
      mkdirSync(join(projectRoot, "src", "modules", "auth"), { recursive: true });

      const { server, tools } = createMockServer();
      const config = createDefaultConfig(); // No architecture specified

      registerModuleTools(server, projectRoot, config);

      const tool = tools.get("mags_discover_modules");
      const result = await tool!.handler();
      const data = JSON.parse(result.content[0].text);

      expect(data.discovered).toBe(true);
      expect(data.modules.some((m: { name: string }) => m.name === "auth")).toBe(true);
    });

    it("discovers services with microservices architecture", async () => {
      mkdirSync(join(projectRoot, "services", "user-service"), { recursive: true });
      mkdirSync(join(projectRoot, "services", "order-service"), { recursive: true });

      const { server, tools } = createMockServer();
      const config = createDefaultConfig({ architecture: "microservices" });

      registerModuleTools(server, projectRoot, config);

      const tool = tools.get("mags_discover_modules");
      const result = await tool!.handler();
      const data = JSON.parse(result.content[0].text);

      expect(data.discovered).toBe(true);
      expect(data.count).toBe(2);
      expect(data.modules.map((m: { name: string }) => m.name)).toContain("user-service");
      expect(data.modules.map((m: { name: string }) => m.name)).toContain("order-service");
    });

    it("discovers packages with microservices architecture", async () => {
      mkdirSync(join(projectRoot, "packages", "shared"), { recursive: true });
      mkdirSync(join(projectRoot, "apps", "api"), { recursive: true });

      const { server, tools } = createMockServer();
      const config = createDefaultConfig({ architecture: "microservices" });

      registerModuleTools(server, projectRoot, config);

      const tool = tools.get("mags_discover_modules");
      const result = await tool!.handler();
      const data = JSON.parse(result.content[0].text);

      expect(data.discovered).toBe(true);
      expect(data.modules.map((m: { name: string }) => m.name)).toContain("shared");
      expect(data.modules.map((m: { name: string }) => m.name)).toContain("api");
    });

    it("discovers library modules with library architecture", async () => {
      mkdirSync(join(projectRoot, "src", "core"), { recursive: true });
      mkdirSync(join(projectRoot, "src", "utils"), { recursive: true });

      const { server, tools } = createMockServer();
      const config = createDefaultConfig({ architecture: "library" });

      registerModuleTools(server, projectRoot, config);

      const tool = tools.get("mags_discover_modules");
      const result = await tool!.handler();
      const data = JSON.parse(result.content[0].text);

      expect(data.discovered).toBe(true);
      expect(data.modules.map((m: { name: string }) => m.name)).toContain("core");
      expect(data.modules.map((m: { name: string }) => m.name)).toContain("utils");
    });

    it("skips test directories for library architecture", async () => {
      mkdirSync(join(projectRoot, "src", "core"), { recursive: true });
      mkdirSync(join(projectRoot, "src", "__tests__"), { recursive: true });
      mkdirSync(join(projectRoot, "src", "tests"), { recursive: true });

      const { server, tools } = createMockServer();
      const config = createDefaultConfig({ architecture: "library" });

      registerModuleTools(server, projectRoot, config);

      const tool = tools.get("mags_discover_modules");
      const result = await tool!.handler();
      const data = JSON.parse(result.content[0].text);

      const moduleNames = data.modules.map((m: { name: string }) => m.name);
      expect(moduleNames).toContain("core");
      expect(moduleNames).not.toContain("__tests__");
      expect(moduleNames).not.toContain("tests");
    });

    it("discovers commands with cli architecture", async () => {
      mkdirSync(join(projectRoot, "src", "commands", "init"), { recursive: true });
      mkdirSync(join(projectRoot, "src", "commands", "build"), { recursive: true });

      const { server, tools } = createMockServer();
      const config = createDefaultConfig({ architecture: "cli" });

      registerModuleTools(server, projectRoot, config);

      const tool = tools.get("mags_discover_modules");
      const result = await tool!.handler();
      const data = JSON.parse(result.content[0].text);

      expect(data.discovered).toBe(true);
      expect(data.modules.map((m: { name: string }) => m.name)).toContain("init");
      expect(data.modules.map((m: { name: string }) => m.name)).toContain("build");
    });
  });

  describe("config module override", () => {
    it("uses custom module definitions from config", async () => {
      mkdirSync(join(projectRoot, "src", "modules", "custom-module"), { recursive: true });

      const { server, tools } = createMockServer();
      const config = createDefaultConfig({
        modules: [
          { name: "custom-module", aliases: ["custom", "my-module"] },
        ],
      });

      registerModuleTools(server, projectRoot, config);

      const tool = tools.get("mags_discover_modules");
      const result = await tool!.handler();
      const data = JSON.parse(result.content[0].text);

      const customModule = data.modules.find(
        (m: { name: string }) => m.name === "custom-module"
      );
      expect(customModule).toBeDefined();
      expect(customModule.aliases).toContain("custom");
      expect(customModule.aliases).toContain("my-module");
    });

    it("merges config modules with default modules", async () => {
      mkdirSync(join(projectRoot, "src", "modules", "auth"), { recursive: true });

      const { server, tools } = createMockServer();
      const config = createDefaultConfig({
        modules: [
          { name: "auth", aliases: ["auth", "identity", "sso", "oauth"] },
        ],
      });

      registerModuleTools(server, projectRoot, config);

      const tool = tools.get("mags_discover_modules");
      const result = await tool!.handler();
      const data = JSON.parse(result.content[0].text);

      const authModule = data.modules.find((m: { name: string }) => m.name === "auth");
      expect(authModule.aliases).toContain("sso");
      expect(authModule.aliases).toContain("oauth");
      expect(authModule.aliases).toContain("identity");
    });
  });

  describe("deduplication", () => {
    it("deduplicates modules found in multiple locations", async () => {
      // Create same module name in multiple standard locations
      mkdirSync(join(projectRoot, "src", "modules", "auth"), { recursive: true });
      mkdirSync(join(projectRoot, "src", "features", "auth"), { recursive: true });

      const { server, tools } = createMockServer();
      const config = createDefaultConfig();

      registerModuleTools(server, projectRoot, config);

      const tool = tools.get("mags_discover_modules");
      const result = await tool!.handler();
      const data = JSON.parse(result.content[0].text);

      const authModules = data.modules.filter(
        (m: { name: string }) => m.name === "auth"
      );
      expect(authModules).toHaveLength(1);
    });
  });

  describe("hidden directories", () => {
    it("ignores hidden directories", async () => {
      mkdirSync(join(projectRoot, "src", "modules", ".hidden"), { recursive: true });
      mkdirSync(join(projectRoot, "src", "modules", "visible"), { recursive: true });

      const { server, tools } = createMockServer();
      const config = createDefaultConfig();

      registerModuleTools(server, projectRoot, config);

      const tool = tools.get("mags_discover_modules");
      const result = await tool!.handler();
      const data = JSON.parse(result.content[0].text);

      const moduleNames = data.modules.map((m: { name: string }) => m.name);
      expect(moduleNames).toContain("visible");
      expect(moduleNames).not.toContain(".hidden");
    });
  });

  describe("confidence scoring via tool", () => {
    it("reports higher confidence for modules with source files", async () => {
      mkdirSync(join(projectRoot, "src", "modules", "with-src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "src", "modules", "with-src", "index.ts"),
        "export {};"
      );

      mkdirSync(join(projectRoot, "src", "modules", "empty"), { recursive: true });

      const { server, tools } = createMockServer();
      const config = createDefaultConfig();

      registerModuleTools(server, projectRoot, config);

      const tool = tools.get("mags_discover_modules");
      const result = await tool!.handler();
      const data = JSON.parse(result.content[0].text);

      const withSrc = data.modules.find(
        (m: { name: string }) => m.name === "with-src"
      );
      const empty = data.modules.find((m: { name: string }) => m.name === "empty");

      expect(withSrc.confidence).toBeGreaterThan(empty.confidence);
    });

    it("reports higher confidence for modules with package.json", async () => {
      mkdirSync(join(projectRoot, "src", "modules", "with-pkg"), { recursive: true });
      writeFileSync(
        join(projectRoot, "src", "modules", "with-pkg", "package.json"),
        JSON.stringify({ name: "with-pkg" })
      );

      mkdirSync(join(projectRoot, "src", "modules", "no-pkg"), { recursive: true });

      const { server, tools } = createMockServer();
      const config = createDefaultConfig();

      registerModuleTools(server, projectRoot, config);

      const tool = tools.get("mags_discover_modules");
      const result = await tool!.handler();
      const data = JSON.parse(result.content[0].text);

      const withPkg = data.modules.find(
        (m: { name: string }) => m.name === "with-pkg"
      );
      const noPkg = data.modules.find((m: { name: string }) => m.name === "no-pkg");

      expect(withPkg.confidence).toBeGreaterThan(noPkg.confidence);
    });
  });
});
