import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerStackTools } from "./stack-tools.js";
import type { MagsConfig } from "../types/index.js";

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), "mags-stack-tools-test-"));
}

function createMockServer(): McpServer & {
  registeredTools: Map<string, { description: string; schema: object; handler: Function }>;
} {
  const tools = new Map<string, { description: string; schema: object; handler: Function }>();

  return {
    registeredTools: tools,
    tool: (name: string, description: string, schema: object, handler: Function) => {
      tools.set(name, { description, schema, handler });
    },
  } as McpServer & {
    registeredTools: Map<string, { description: string; schema: object; handler: Function }>;
  };
}

function createDefaultConfig(overrides?: Partial<MagsConfig>): MagsConfig {
  return {
    docsDir: "docs",
    magsDir: "docs/.mags",
    templates: "general" as const,
    autoSessionSave: true,
    autoSessionLoad: true,
    docValidation: true,
    locale: "en",
    embedding: { provider: "local" as const },
    ...overrides,
  };
}

describe("stack-tools", () => {
  let projectRoot: string;
  let server: ReturnType<typeof createMockServer>;

  beforeEach(() => {
    projectRoot = createTempDir();
    server = createMockServer();
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  describe("tool registration", () => {
    it("registers mags_detect_stack tool", () => {
      registerStackTools(server, projectRoot);

      expect(server.registeredTools.has("mags_detect_stack")).toBe(true);
    });

    it("registers tool with correct description", () => {
      registerStackTools(server, projectRoot);

      const tool = server.registeredTools.get("mags_detect_stack");
      expect(tool?.description).toContain("Detect the project's tech stack");
      expect(tool?.description).toContain("languages");
      expect(tool?.description).toContain("frameworks");
      expect(tool?.description).toContain("databases");
    });

    it("registers tool with empty parameters schema", () => {
      registerStackTools(server, projectRoot);

      const tool = server.registeredTools.get("mags_detect_stack");
      expect(tool?.schema).toEqual({});
    });
  });

  describe("detects Node.js project from package.json", () => {
    it("detects typescript/javascript from package.json", async () => {
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify({ name: "test-app", dependencies: {} }),
        "utf-8"
      );

      registerStackTools(server, projectRoot);
      const tool = server.registeredTools.get("mags_detect_stack");
      const result = await tool?.handler();

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe("text");

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.detected).toBe(true);
      expect(parsed.source).toBe("filesystem");
      expect(parsed.stack.languages).toContain("typescript/javascript");
    });

    it("detects npm as default package manager", async () => {
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify({ name: "test" }),
        "utf-8"
      );

      registerStackTools(server, projectRoot);
      const tool = server.registeredTools.get("mags_detect_stack");
      const result = await tool?.handler();

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.stack.packageManager).toBe("npm");
    });

    it("detects pnpm from pnpm-lock.yaml", async () => {
      writeFileSync(join(projectRoot, "package.json"), JSON.stringify({ name: "test" }), "utf-8");
      writeFileSync(join(projectRoot, "pnpm-lock.yaml"), "", "utf-8");

      registerStackTools(server, projectRoot);
      const tool = server.registeredTools.get("mags_detect_stack");
      const result = await tool?.handler();

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.stack.packageManager).toBe("pnpm");
    });

    it("detects React framework from dependencies", async () => {
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify({ dependencies: { react: "^18.0.0" } }),
        "utf-8"
      );

      registerStackTools(server, projectRoot);
      const tool = server.registeredTools.get("mags_detect_stack");
      const result = await tool?.handler();

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.stack.frameworks).toContain("React");
    });

    it("detects NestJS from @nestjs/core", async () => {
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify({ dependencies: { "@nestjs/core": "^10.0.0" } }),
        "utf-8"
      );

      registerStackTools(server, projectRoot);
      const tool = server.registeredTools.get("mags_detect_stack");
      const result = await tool?.handler();

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.stack.frameworks).toContain("NestJS");
    });

    it("detects database dependencies (pg, redis)", async () => {
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify({ dependencies: { pg: "^8.0.0", redis: "^4.0.0" } }),
        "utf-8"
      );

      registerStackTools(server, projectRoot);
      const tool = server.registeredTools.get("mags_detect_stack");
      const result = await tool?.handler();

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.stack.databases).toContain("PostgreSQL");
      expect(parsed.stack.databases).toContain("Redis");
    });

    it("includes yamlSnippet in response", async () => {
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify({ dependencies: { react: "^18.0.0" } }),
        "utf-8"
      );

      registerStackTools(server, projectRoot);
      const tool = server.registeredTools.get("mags_detect_stack");
      const result = await tool?.handler();

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.yamlSnippet).toContain("stack:");
      expect(parsed.yamlSnippet).toContain("frameworks:");
    });
  });

  describe("returns config stack if provided in config", () => {
    it("returns stack from config.stack when provided", async () => {
      const config = createDefaultConfig({
        stack: {
          primaryLanguage: "typescript",
          languages: ["typescript", "python"],
          frameworks: ["NestJS", "React"],
          databases: ["PostgreSQL", "Redis"],
          apiStyle: ["rest", "graphql"],
          packageManager: "pnpm",
        },
      });

      registerStackTools(server, projectRoot, config);
      const tool = server.registeredTools.get("mags_detect_stack");
      const result = await tool?.handler();

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.detected).toBe(false);
      expect(parsed.source).toBe("config");
      expect(parsed.stack.languages).toContain("typescript");
      expect(parsed.stack.frameworks).toContain("NestJS");
      expect(parsed.stack.frameworks).toContain("React");
      expect(parsed.stack.databases).toContain("PostgreSQL");
      expect(parsed.stack.databases).toContain("Redis");
      expect(parsed.stack.apiStyle).toContain("rest");
      expect(parsed.stack.apiStyle).toContain("graphql");
      expect(parsed.stack.packageManager).toBe("pnpm");
      expect(parsed.note).toContain(".mags.yaml");
    });

    it("prioritizes config.stack over file system detection", async () => {
      // Create a package.json with React
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify({ dependencies: { react: "^18.0.0" } }),
        "utf-8"
      );

      // But config says Vue
      const config = createDefaultConfig({
        stack: {
          frameworks: ["Vue"],
          packageManager: "yarn",
        },
      });

      registerStackTools(server, projectRoot, config);
      const tool = server.registeredTools.get("mags_detect_stack");
      const result = await tool?.handler();

      const parsed = JSON.parse(result.content[0].text);
      // Config takes precedence
      expect(parsed.detected).toBe(false);
      expect(parsed.source).toBe("config");
      expect(parsed.stack.frameworks).toContain("Vue");
      expect(parsed.stack.frameworks).not.toContain("React");
    });

    it("uses primaryLanguage when languages array is not provided", async () => {
      const config = createDefaultConfig({
        stack: {
          primaryLanguage: "python",
          frameworks: ["Django"],
        },
      });

      registerStackTools(server, projectRoot, config);
      const tool = server.registeredTools.get("mags_detect_stack");
      const result = await tool?.handler();

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.stack.languages).toContain("python");
    });

    it("handles empty stack config (falls back to detection)", async () => {
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify({ dependencies: { express: "^4.18.0" } }),
        "utf-8"
      );

      const config = createDefaultConfig({
        stack: {}, // Empty stack config
      });

      registerStackTools(server, projectRoot, config);
      const tool = server.registeredTools.get("mags_detect_stack");
      const result = await tool?.handler();

      const parsed = JSON.parse(result.content[0].text);
      // Should fall back to detection
      expect(parsed.detected).toBe(true);
      expect(parsed.source).toBe("filesystem");
      expect(parsed.stack.frameworks).toContain("Express");
    });

    it("handles undefined stack config (falls back to detection)", async () => {
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify({ dependencies: { fastify: "^4.0.0" } }),
        "utf-8"
      );

      const config = createDefaultConfig(); // No stack config

      registerStackTools(server, projectRoot, config);
      const tool = server.registeredTools.get("mags_detect_stack");
      const result = await tool?.handler();

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.detected).toBe(true);
      expect(parsed.source).toBe("filesystem");
      expect(parsed.stack.frameworks).toContain("Fastify");
    });
  });

  describe("returns empty result for empty project", () => {
    it("returns empty arrays for empty directory", async () => {
      registerStackTools(server, projectRoot);
      const tool = server.registeredTools.get("mags_detect_stack");
      const result = await tool?.handler();

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.detected).toBe(true);
      expect(parsed.source).toBe("filesystem");
      expect(parsed.stack.languages).toEqual([]);
      expect(parsed.stack.frameworks).toEqual([]);
      expect(parsed.stack.databases).toEqual([]);
      expect(parsed.stack.packageManager).toBe("");
    });

    it("defaults to rest API style for empty project", async () => {
      registerStackTools(server, projectRoot);
      const tool = server.registeredTools.get("mags_detect_stack");
      const result = await tool?.handler();

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.stack.apiStyle).toContain("rest");
    });

    it("still provides suggestion for empty project", async () => {
      registerStackTools(server, projectRoot);
      const tool = server.registeredTools.get("mags_detect_stack");
      const result = await tool?.handler();

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.suggestion).toContain(".mags.yaml");
    });
  });

  describe("fallback chain integration", () => {
    it("uses CLAUDE.md when no package files exist", async () => {
      const claudeMd = `# Project

## Tech Stack
- **Backend:** NestJS
- **Frontend:** React
- **Database:** PostgreSQL
- **Package Manager:** pnpm
`;
      writeFileSync(join(projectRoot, "CLAUDE.md"), claudeMd, "utf-8");

      registerStackTools(server, projectRoot);
      const tool = server.registeredTools.get("mags_detect_stack");
      const result = await tool?.handler();

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.stack.frameworks).toContain("NestJS");
      expect(parsed.stack.frameworks).toContain("React");
      expect(parsed.stack.databases).toContain("PostgreSQL");
      expect(parsed.stack.packageManager).toBe("pnpm");
    });

    it("uses docs/tech-stack.md as last fallback", async () => {
      mkdirSync(join(projectRoot, "docs"), { recursive: true });
      const techDoc = `# Tech Stack

## Stack
- TypeScript
- FastAPI
- MongoDB
`;
      writeFileSync(join(projectRoot, "docs", "tech-stack.md"), techDoc, "utf-8");

      registerStackTools(server, projectRoot);
      const tool = server.registeredTools.get("mags_detect_stack");
      const result = await tool?.handler();

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.stack.languages.map((l: string) => l.toLowerCase())).toContain("typescript");
      expect(parsed.stack.frameworks).toContain("FastAPI");
      expect(parsed.stack.databases).toContain("MongoDB");
    });
  });

  describe("multi-language project detection", () => {
    it("detects multiple languages and frameworks", async () => {
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify({
          dependencies: { express: "^4.18.0", react: "^18.0.0" },
          devDependencies: { typescript: "^5.0.0" },
        }),
        "utf-8"
      );
      writeFileSync(join(projectRoot, "requirements.txt"), "fastapi==0.100.0\n", "utf-8");
      writeFileSync(join(projectRoot, "go.mod"), "module example.com/app\n\ngo 1.21\n", "utf-8");

      registerStackTools(server, projectRoot);
      const tool = server.registeredTools.get("mags_detect_stack");
      const result = await tool?.handler();

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.stack.languages).toContain("typescript");
      expect(parsed.stack.languages).toContain("python");
      expect(parsed.stack.languages).toContain("go");
      expect(parsed.stack.frameworks).toContain("Express");
      expect(parsed.stack.frameworks).toContain("React");
      expect(parsed.stack.frameworks).toContain("FastAPI");
    });
  });

  describe("GraphQL detection", () => {
    it("detects GraphQL from schema file", async () => {
      writeFileSync(join(projectRoot, "schema.graphql"), "type Query { hello: String }\n", "utf-8");

      registerStackTools(server, projectRoot);
      const tool = server.registeredTools.get("mags_detect_stack");
      const result = await tool?.handler();

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.stack.apiStyle).toContain("graphql");
    });

    it("detects GraphQL from package.json dependencies", async () => {
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify({ dependencies: { graphql: "^16.0.0", "@apollo/server": "^4.0.0" } }),
        "utf-8"
      );

      registerStackTools(server, projectRoot);
      const tool = server.registeredTools.get("mags_detect_stack");
      const result = await tool?.handler();

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.stack.apiStyle).toContain("graphql");
    });
  });

  describe("database detection from docker-compose", () => {
    it("detects databases from docker-compose.yml", async () => {
      writeFileSync(
        join(projectRoot, "docker-compose.yml"),
        "services:\n  db:\n    image: postgres:15\n  cache:\n    image: redis:7\n",
        "utf-8"
      );

      registerStackTools(server, projectRoot);
      const tool = server.registeredTools.get("mags_detect_stack");
      const result = await tool?.handler();

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.stack.databases).toContain("PostgreSQL");
      expect(parsed.stack.databases).toContain("Redis");
    });
  });

  describe("response format", () => {
    it("returns proper MCP content format", async () => {
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify({ dependencies: { react: "^18.0.0" } }),
        "utf-8"
      );

      registerStackTools(server, projectRoot);
      const tool = server.registeredTools.get("mags_detect_stack");
      const result = await tool?.handler();

      expect(result).toHaveProperty("content");
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0]).toHaveProperty("type", "text");
      expect(result.content[0]).toHaveProperty("text");

      // Text should be valid JSON
      expect(() => JSON.parse(result.content[0].text)).not.toThrow();
    });

    it("includes all expected fields in detected response", async () => {
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify({ dependencies: { react: "^18.0.0" } }),
        "utf-8"
      );

      registerStackTools(server, projectRoot);
      const tool = server.registeredTools.get("mags_detect_stack");
      const result = await tool?.handler();

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toHaveProperty("detected");
      expect(parsed).toHaveProperty("source");
      expect(parsed).toHaveProperty("stack");
      expect(parsed).toHaveProperty("suggestion");
      expect(parsed).toHaveProperty("yamlSnippet");

      expect(parsed.stack).toHaveProperty("languages");
      expect(parsed.stack).toHaveProperty("frameworks");
      expect(parsed.stack).toHaveProperty("databases");
      expect(parsed.stack).toHaveProperty("apiStyle");
      expect(parsed.stack).toHaveProperty("packageManager");
    });

    it("includes all expected fields in config response", async () => {
      const config = createDefaultConfig({
        stack: {
          primaryLanguage: "typescript",
          frameworks: ["NestJS"],
        },
      });

      registerStackTools(server, projectRoot, config);
      const tool = server.registeredTools.get("mags_detect_stack");
      const result = await tool?.handler();

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toHaveProperty("detected", false);
      expect(parsed).toHaveProperty("source", "config");
      expect(parsed).toHaveProperty("stack");
      expect(parsed).toHaveProperty("note");

      expect(parsed.stack).toHaveProperty("languages");
      expect(parsed.stack).toHaveProperty("frameworks");
      expect(parsed.stack).toHaveProperty("databases");
      expect(parsed.stack).toHaveProperty("apiStyle");
      expect(parsed.stack).toHaveProperty("packageManager");
    });
  });
});
