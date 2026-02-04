// ============================================
// MAGS — Changelog Tools Integration Tests
// Tests for git changelog generation
// ============================================

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerChangelogTools } from "./changelog-tools.js";

// Increase test timeout for git operations
const TEST_TIMEOUT = 30000;

// --- Test Helpers ---

function createTempGitRepo(): string {
  const tempDir = mkdtempSync(join(tmpdir(), "mags-changelog-test-"));
  execSync("git init", { cwd: tempDir, stdio: "ignore" });
  execSync('git config user.email "test@test.com"', { cwd: tempDir, stdio: "ignore" });
  execSync('git config user.name "Test User"', { cwd: tempDir, stdio: "ignore" });
  return tempDir;
}

function createCommit(dir: string, message: string, filename?: string): void {
  const file = filename || `file-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`;
  writeFileSync(join(dir, file), `content for ${message}`);
  execSync(`git add "${file}"`, { cwd: dir, stdio: "ignore" });
  execSync(`git commit -m "${message}"`, { cwd: dir, stdio: "ignore" });
}

function createTag(dir: string, tagName: string): void {
  execSync(`git tag ${tagName}`, { cwd: dir, stdio: "ignore" });
}

function cleanupDir(dir: string): void {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

// --- Mock MCP Server ---

interface ToolRegistration {
  name: string;
  description: string;
  schema: unknown;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

function createMockServer(): { server: McpServer; getTools: () => ToolRegistration[] } {
  const tools: ToolRegistration[] = [];

  const mockServer = {
    tool: (
      name: string,
      description: string,
      schema: unknown,
      handler: (args: Record<string, unknown>) => Promise<unknown>
    ) => {
      tools.push({ name, description, schema, handler });
    },
  } as unknown as McpServer;

  return {
    server: mockServer,
    getTools: () => tools,
  };
}

// --- Tests ---

describe("registerChangelogTools", () => {
  let tempDir: string;
  let mockServer: McpServer;
  let getTools: () => ToolRegistration[];

  beforeEach(() => {
    tempDir = createTempGitRepo();
    const mock = createMockServer();
    mockServer = mock.server;
    getTools = mock.getTools;
  });

  afterEach(() => {
    cleanupDir(tempDir);
  });

  describe("tool registration", () => {
    it("registers mags_generate_changelog tool", () => {
      registerChangelogTools(mockServer, tempDir);
      const tools = getTools();

      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe("mags_generate_changelog");
      expect(tools[0].description).toContain("changelog");
    });

    it("tool has correct schema parameters", () => {
      registerChangelogTools(mockServer, tempDir);
      const tools = getTools();
      const tool = tools[0];

      expect(tool.schema).toHaveProperty("from");
      expect(tool.schema).toHaveProperty("to");
      expect(tool.schema).toHaveProperty("format");
    });
  });

  describe("empty git history", () => {
    it("returns error for repo without commits (HEAD does not exist)", async () => {
      registerChangelogTools(mockServer, tempDir);
      const tools = getTools();
      const handler = tools[0].handler;

      const result = await handler({});

      // When there are no commits, git log HEAD fails because HEAD doesn't exist
      const response = result as { content: Array<{ text: string }>; isError?: boolean };
      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain("Error");
    }, TEST_TIMEOUT);
  });

  describe("conventional commit parsing", () => {
    it("parses feat commits correctly", async () => {
      createCommit(tempDir, "feat: add user authentication");
      registerChangelogTools(mockServer, tempDir);
      const tools = getTools();
      const handler = tools[0].handler;

      const result = await handler({ format: "conventional" });

      const content = (result as { content: Array<{ text: string }> }).content;
      const parsed = JSON.parse(content[0].text);

      expect(parsed.stats.features).toBe(1);
      expect(parsed.changelog).toContain("feat");
      expect(parsed.changelog).toContain("add user authentication");
    });

    it("parses fix commits correctly", async () => {
      createCommit(tempDir, "fix: resolve null pointer exception");
      registerChangelogTools(mockServer, tempDir);
      const tools = getTools();
      const handler = tools[0].handler;

      const result = await handler({ format: "conventional" });

      const content = (result as { content: Array<{ text: string }> }).content;
      const parsed = JSON.parse(content[0].text);

      expect(parsed.stats.fixes).toBe(1);
      expect(parsed.changelog).toContain("fix");
      expect(parsed.changelog).toContain("resolve null pointer exception");
    });

    it("parses commits with scope correctly", async () => {
      createCommit(tempDir, "feat(auth): implement JWT validation");
      registerChangelogTools(mockServer, tempDir);
      const tools = getTools();
      const handler = tools[0].handler;

      const result = await handler({ format: "conventional" });

      const content = (result as { content: Array<{ text: string }> }).content;
      const parsed = JSON.parse(content[0].text);

      expect(parsed.stats.features).toBe(1);
      expect(parsed.changelog).toContain("auth");
      expect(parsed.changelog).toContain("implement JWT validation");
    });

    it("parses breaking change commits correctly", async () => {
      createCommit(tempDir, "feat!: remove deprecated API endpoints");
      registerChangelogTools(mockServer, tempDir);
      const tools = getTools();
      const handler = tools[0].handler;

      const result = await handler({ format: "keep" });

      const content = (result as { content: Array<{ text: string }> }).content;
      const parsed = JSON.parse(content[0].text);

      // Breaking changes count as features=0 because they're categorized as "breaking"
      expect(parsed.stats.features).toBe(0);
      expect(parsed.changelog).toContain("Breaking Changes");
    });

    it("parses refactor commits correctly", async () => {
      createCommit(tempDir, "refactor(core): simplify error handling");
      registerChangelogTools(mockServer, tempDir);
      const tools = getTools();
      const handler = tools[0].handler;

      const result = await handler({ format: "keep" });

      const content = (result as { content: Array<{ text: string }> }).content;
      const parsed = JSON.parse(content[0].text);

      expect(parsed.changelog).toContain("Changed");
      expect(parsed.changelog).toContain("simplify error handling");
    });

    it("parses docs commits correctly", async () => {
      createCommit(tempDir, "docs: update README with installation guide");
      registerChangelogTools(mockServer, tempDir);
      const tools = getTools();
      const handler = tools[0].handler;

      const result = await handler({ format: "keep" });

      const content = (result as { content: Array<{ text: string }> }).content;
      const parsed = JSON.parse(content[0].text);

      expect(parsed.changelog).toContain("Documentation");
    });

    it("parses chore commits correctly", async () => {
      createCommit(tempDir, "chore: update dependencies");
      registerChangelogTools(mockServer, tempDir);
      const tools = getTools();
      const handler = tools[0].handler;

      const result = await handler({ format: "keep" });

      const content = (result as { content: Array<{ text: string }> }).content;
      const parsed = JSON.parse(content[0].text);

      expect(parsed.changelog).toContain("Maintenance");
    });
  });

  describe("grouping commits by type", () => {
    it("groups multiple commits by type", async () => {
      createCommit(tempDir, "feat: add login page", "file1.txt");
      createCommit(tempDir, "feat: add register page", "file2.txt");
      createCommit(tempDir, "fix: resolve login error", "file3.txt");
      createCommit(tempDir, "docs: update API docs", "file4.txt");
      createCommit(tempDir, "chore: update eslint config", "file5.txt");

      registerChangelogTools(mockServer, tempDir);
      const tools = getTools();
      const handler = tools[0].handler;

      const result = await handler({ format: "keep" });

      const content = (result as { content: Array<{ text: string }> }).content;
      const parsed = JSON.parse(content[0].text);

      expect(parsed.stats.total).toBe(5);
      expect(parsed.stats.features).toBe(2);
      expect(parsed.stats.fixes).toBe(1);
      expect(parsed.stats.other).toBe(2); // docs + chore
    });

    it("generates keep-a-changelog format correctly", async () => {
      createCommit(tempDir, "feat(ui): add dark mode", "file1.txt");
      createCommit(tempDir, "fix(api): fix rate limiting", "file2.txt");

      registerChangelogTools(mockServer, tempDir);
      const tools = getTools();
      const handler = tools[0].handler;

      const result = await handler({ format: "keep" });

      const content = (result as { content: Array<{ text: string }> }).content;
      const parsed = JSON.parse(content[0].text);

      expect(parsed.changelog).toContain("## [Unreleased]");
      expect(parsed.changelog).toContain("### Added");
      expect(parsed.changelog).toContain("### Fixed");
      expect(parsed.changelog).toContain("**ui:**");
      expect(parsed.changelog).toContain("**api:**");
    });

    it("generates conventional format correctly", async () => {
      createCommit(tempDir, "feat(ui): add dark mode", "file1.txt");
      createCommit(tempDir, "fix(api): fix rate limiting", "file2.txt");

      registerChangelogTools(mockServer, tempDir);
      const tools = getTools();
      const handler = tools[0].handler;

      const result = await handler({ format: "conventional" });

      const content = (result as { content: Array<{ text: string }> }).content;
      const parsed = JSON.parse(content[0].text);

      expect(parsed.changelog).toContain("### feat");
      expect(parsed.changelog).toContain("### fix");
      expect(parsed.changelog).toContain("(ui)");
      expect(parsed.changelog).toContain("(api)");
    });
  });

  describe("non-conventional commits", () => {
    it("treats non-conventional commits as chore", async () => {
      createCommit(tempDir, "Update readme file");
      registerChangelogTools(mockServer, tempDir);
      const tools = getTools();
      const handler = tools[0].handler;

      const result = await handler({ format: "keep" });

      const content = (result as { content: Array<{ text: string }> }).content;
      const parsed = JSON.parse(content[0].text);

      expect(parsed.stats.other).toBe(1);
      expect(parsed.changelog).toContain("Maintenance");
      expect(parsed.changelog).toContain("Update readme file");
    });

    it("handles mixed conventional and non-conventional commits", async () => {
      createCommit(tempDir, "feat: add new feature", "file1.txt");
      createCommit(tempDir, "Random commit message", "file2.txt");
      createCommit(tempDir, "fix: bug fix", "file3.txt");
      createCommit(tempDir, "Another random message", "file4.txt");

      registerChangelogTools(mockServer, tempDir);
      const tools = getTools();
      const handler = tools[0].handler;

      const result = await handler({ format: "keep" });

      const content = (result as { content: Array<{ text: string }> }).content;
      const parsed = JSON.parse(content[0].text);

      expect(parsed.stats.total).toBe(4);
      expect(parsed.stats.features).toBe(1);
      expect(parsed.stats.fixes).toBe(1);
      expect(parsed.stats.other).toBe(2);
    });
  });

  describe("range filtering", () => {
    it("filters commits by tag range", async () => {
      createCommit(tempDir, "feat: first feature", "file1.txt");
      createTag(tempDir, "v1.0.0");
      createCommit(tempDir, "feat: second feature", "file2.txt");
      createCommit(tempDir, "fix: bug fix after tag", "file3.txt");

      registerChangelogTools(mockServer, tempDir);
      const tools = getTools();
      const handler = tools[0].handler;

      const result = await handler({ from: "v1.0.0", format: "keep" });

      const content = (result as { content: Array<{ text: string }> }).content;
      const parsed = JSON.parse(content[0].text);

      expect(parsed.stats.total).toBe(2);
      expect(parsed.stats.features).toBe(1);
      expect(parsed.stats.fixes).toBe(1);
      expect(parsed.range).toBe("v1.0.0..HEAD");
    });

    it("uses last tag as default from when available", async () => {
      createCommit(tempDir, "feat: before tag", "file1.txt");
      createTag(tempDir, "v1.0.0");
      createCommit(tempDir, "feat: after tag", "file2.txt");

      registerChangelogTools(mockServer, tempDir);
      const tools = getTools();
      const handler = tools[0].handler;

      const result = await handler({ format: "keep" });

      const content = (result as { content: Array<{ text: string }> }).content;
      const parsed = JSON.parse(content[0].text);

      // Should only include commits after v1.0.0
      expect(parsed.stats.total).toBe(1);
      expect(parsed.range).toBe("v1.0.0..HEAD");
    });
  });

  describe("error handling", () => {
    it("handles non-git directory gracefully", async () => {
      const nonGitDir = mkdtempSync(join(tmpdir(), "mags-non-git-"));
      const mock = createMockServer();
      registerChangelogTools(mock.server, nonGitDir);
      const tools = mock.getTools();
      const handler = tools[0].handler;

      const result = await handler({});

      const response = result as { content: Array<{ text: string }>; isError?: boolean };
      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain("Error");

      cleanupDir(nonGitDir);
    });
  });

  describe("commit hash extraction", () => {
    it("includes shortened commit hashes in conventional format", async () => {
      createCommit(tempDir, "feat: add feature with hash");

      registerChangelogTools(mockServer, tempDir);
      const tools = getTools();
      const handler = tools[0].handler;

      const result = await handler({ format: "conventional" });

      const content = (result as { content: Array<{ text: string }> }).content;
      const parsed = JSON.parse(content[0].text);

      // Hash should be 7 characters
      const hashMatch = parsed.changelog.match(/- ([a-f0-9]{7})/);
      expect(hashMatch).toBeTruthy();
    });
  });

  describe("date extraction", () => {
    it("extracts commit date correctly", async () => {
      createCommit(tempDir, "feat: feature with date");

      registerChangelogTools(mockServer, tempDir);
      const tools = getTools();
      const handler = tools[0].handler;

      const result = await handler({ format: "keep" });

      const content = (result as { content: Array<{ text: string }> }).content;
      const parsed = JSON.parse(content[0].text);

      // Changelog header should contain today's date
      const today = new Date().toISOString().split("T")[0];
      expect(parsed.changelog).toContain(today);
    });
  });

  describe("additional commit types", () => {
    it("parses test commits correctly", async () => {
      createCommit(tempDir, "test: add unit tests for auth module");
      registerChangelogTools(mockServer, tempDir);
      const tools = getTools();
      const handler = tools[0].handler;

      const result = await handler({ format: "conventional" });

      const content = (result as { content: Array<{ text: string }> }).content;
      const parsed = JSON.parse(content[0].text);

      expect(parsed.changelog).toContain("test");
    });

    it("parses perf commits correctly", async () => {
      createCommit(tempDir, "perf: optimize database queries");
      registerChangelogTools(mockServer, tempDir);
      const tools = getTools();
      const handler = tools[0].handler;

      const result = await handler({ format: "conventional" });

      const content = (result as { content: Array<{ text: string }> }).content;
      const parsed = JSON.parse(content[0].text);

      expect(parsed.changelog).toContain("perf");
    });

    it("parses ci commits correctly", async () => {
      createCommit(tempDir, "ci: add GitHub Actions workflow");
      registerChangelogTools(mockServer, tempDir);
      const tools = getTools();
      const handler = tools[0].handler;

      const result = await handler({ format: "conventional" });

      const content = (result as { content: Array<{ text: string }> }).content;
      const parsed = JSON.parse(content[0].text);

      expect(parsed.changelog).toContain("ci");
    });

    it("parses build commits correctly", async () => {
      createCommit(tempDir, "build: update webpack configuration");
      registerChangelogTools(mockServer, tempDir);
      const tools = getTools();
      const handler = tools[0].handler;

      const result = await handler({ format: "conventional" });

      const content = (result as { content: Array<{ text: string }> }).content;
      const parsed = JSON.parse(content[0].text);

      expect(parsed.changelog).toContain("build");
    });

    it("parses style commits correctly", async () => {
      createCommit(tempDir, "style: format code with prettier");
      registerChangelogTools(mockServer, tempDir);
      const tools = getTools();
      const handler = tools[0].handler;

      const result = await handler({ format: "conventional" });

      const content = (result as { content: Array<{ text: string }> }).content;
      const parsed = JSON.parse(content[0].text);

      expect(parsed.changelog).toContain("style");
    }, TEST_TIMEOUT);
  });

  describe("default format", () => {
    it("defaults to keep-a-changelog format when format not specified", async () => {
      createCommit(tempDir, "feat: add feature");

      registerChangelogTools(mockServer, tempDir);
      const tools = getTools();
      const handler = tools[0].handler;

      const result = await handler({});

      const content = (result as { content: Array<{ text: string }> }).content;
      const parsed = JSON.parse(content[0].text);

      expect(parsed.changelog).toContain("## [Unreleased]");
      expect(parsed.changelog).toContain("### Added");
    }, TEST_TIMEOUT);

    it("handles null format as keep-a-changelog", async () => {
      createCommit(tempDir, "feat: add feature");

      registerChangelogTools(mockServer, tempDir);
      const tools = getTools();
      const handler = tools[0].handler;

      const result = await handler({ format: null });

      const content = (result as { content: Array<{ text: string }> }).content;
      const parsed = JSON.parse(content[0].text);

      expect(parsed.changelog).toContain("## [Unreleased]");
    }, TEST_TIMEOUT);
  });
});
