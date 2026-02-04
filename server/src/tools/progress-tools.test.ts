import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerProgressTools } from "./progress-tools.js";
import { ProgressManager } from "../services/progress-manager.js";
import { MemoryStore } from "../services/memory-store.js";

// Mock MCP server that captures registered tools
interface RegisteredTool {
  name: string;
  description: string;
  schema: unknown;
  handler: (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;
}

function createMockServer(): { server: McpServer; tools: Map<string, RegisteredTool> } {
  const tools = new Map<string, RegisteredTool>();

  const server = {
    tool: (
      name: string,
      description: string,
      schema: unknown,
      handler: (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>
    ) => {
      tools.set(name, { name, description, schema, handler });
    },
  } as unknown as McpServer;

  return { server, tools };
}

function makeTmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "mags-progress-tools-"));
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("progress-tools", () => {
  let magsDir: string;
  let progressManager: ProgressManager;
  let memoryStore: MemoryStore;
  let mockServer: McpServer;
  let registeredTools: Map<string, RegisteredTool>;

  beforeEach(() => {
    magsDir = makeTmpDir();
    progressManager = new ProgressManager(magsDir);
    memoryStore = new MemoryStore(magsDir);

    const mock = createMockServer();
    mockServer = mock.server;
    registeredTools = mock.tools;

    registerProgressTools(mockServer, progressManager, memoryStore);
  });

  afterEach(() => {
    memoryStore.close();
    rmSync(magsDir, { recursive: true, force: true });
  });

  // ── Tool Registration ───────────────────────────

  describe("tool registration", () => {
    it("registers mags_init_progress tool", () => {
      expect(registeredTools.has("mags_init_progress")).toBe(true);
      const tool = registeredTools.get("mags_init_progress");
      expect(tool?.description).toContain("Initialize progress tracking");
    });

    it("registers mags_get_progress tool", () => {
      expect(registeredTools.has("mags_get_progress")).toBe(true);
      const tool = registeredTools.get("mags_get_progress");
      expect(tool?.description).toContain("Get project progress");
    });

    it("registers mags_update_progress tool", () => {
      expect(registeredTools.has("mags_update_progress")).toBe(true);
      const tool = registeredTools.get("mags_update_progress");
      expect(tool?.description).toContain("Update progress");
    });

    it("registers mags_get_next tool", () => {
      expect(registeredTools.has("mags_get_next")).toBe(true);
      const tool = registeredTools.get("mags_get_next");
      expect(tool?.description).toContain("next actionable items");
    });

    it("registers all four progress tools", () => {
      expect(registeredTools.size).toBe(4);
    });
  });

  // ── mags_init_progress ──────────────────────────

  describe("mags_init_progress", () => {
    it("creates progress tracking with modules", async () => {
      const tool = registeredTools.get("mags_init_progress")!;

      const result = await tool.handler({
        project: "test-project",
        phase: 1,
        force: false,
        modules: [
          { name: "auth", priority: 1, items: [] },
          { name: "api", priority: 2, dependsOn: ["auth"], items: [] },
        ],
      });

      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text);
      expect(data.initialized).toBe(true);
      expect(data.project).toBe("test-project");
      expect(data.modules).toBe(2);
    });

    it("creates progress with items", async () => {
      const tool = registeredTools.get("mags_init_progress")!;

      const result = await tool.handler({
        project: "test-project",
        phase: 1,
        force: false,
        modules: [
          {
            name: "auth",
            priority: 1,
            items: [
              { name: "login", status: "not_started" },
              { name: "register", status: "not_started" },
            ],
          },
        ],
      });

      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text);
      expect(data.totalItems).toBe(2);
    });

    it("returns error when progress already exists without force flag", async () => {
      const tool = registeredTools.get("mags_init_progress")!;

      // First init
      await tool.handler({
        project: "test-project",
        phase: 1,
        force: false,
        modules: [{ name: "auth", priority: 1, items: [] }],
      });

      // Second init without force
      const result = await tool.handler({
        project: "another-project",
        phase: 1,
        force: false,
        modules: [{ name: "api", priority: 1, items: [] }],
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("already initialized");
    });

    it("allows re-initialization with force flag", async () => {
      const tool = registeredTools.get("mags_init_progress")!;

      // First init
      await tool.handler({
        project: "test-project",
        phase: 1,
        force: false,
        modules: [{ name: "auth", priority: 1, items: [] }],
      });

      // Second init with force
      const result = await tool.handler({
        project: "new-project",
        phase: 2,
        force: true,
        modules: [{ name: "api", priority: 1, items: [] }],
      });

      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text);
      expect(data.project).toBe("new-project");
    });

    it("returns warnings for invalid dependencies", async () => {
      const tool = registeredTools.get("mags_init_progress")!;

      const result = await tool.handler({
        project: "test-project",
        phase: 1,
        force: false,
        modules: [{ name: "auth", dependsOn: ["nonexistent"], priority: 1, items: [] }],
      });

      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text);
      expect(data.warnings).toBeDefined();
      expect(data.warnings.length).toBeGreaterThan(0);
    });

    it("supports module categories", async () => {
      const tool = registeredTools.get("mags_init_progress")!;

      const result = await tool.handler({
        project: "test-project",
        phase: 1,
        force: false,
        modules: [
          { name: "auth", category: "feature", priority: 1, items: [] },
          { name: "refactor-db", category: "tech-debt", priority: 2, items: [] },
        ],
      });

      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text);
      expect(data.modules).toBe(2);
    });
  });

  // ── mags_get_progress ───────────────────────────

  describe("mags_get_progress", () => {
    beforeEach(async () => {
      const initTool = registeredTools.get("mags_init_progress")!;
      await initTool.handler({
        project: "test-project",
        phase: 1,
        force: false,
        modules: [
          {
            name: "auth",
            category: "feature",
            priority: 1,
            items: [
              { name: "login", status: "not_started" },
              { name: "register", status: "completed" },
            ],
          },
          {
            name: "api",
            category: "feature",
            priority: 2,
            dependsOn: ["auth"],
            items: [{ name: "endpoints", status: "not_started" }],
          },
          {
            name: "cleanup",
            category: "tech-debt",
            priority: 3,
            items: [{ name: "remove-legacy", status: "not_started" }],
          },
        ],
      });
    });

    it("returns full project progress", async () => {
      const tool = registeredTools.get("mags_get_progress")!;

      const result = await tool.handler({});

      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text);
      expect(data.project).toBe("test-project");
      expect(data.modules).toHaveLength(3);
    });

    it("returns specific module when filtered by name", async () => {
      const tool = registeredTools.get("mags_get_progress")!;

      const result = await tool.handler({ module: "auth" });

      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text);
      expect(data.name).toBe("auth");
      expect(data.items).toHaveLength(2);
    });

    it("filters by category", async () => {
      const tool = registeredTools.get("mags_get_progress")!;

      const result = await tool.handler({ category: "tech-debt" });

      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text);
      expect(data.modules).toHaveLength(1);
      expect(data.modules[0].name).toBe("cleanup");
    });

    it("returns message when no progress tracked", async () => {
      // Create fresh managers without init
      const freshMagsDir = makeTmpDir();
      const freshProgressManager = new ProgressManager(freshMagsDir);
      const freshMemoryStore = new MemoryStore(freshMagsDir);
      const freshMock = createMockServer();

      registerProgressTools(freshMock.server, freshProgressManager, freshMemoryStore);

      const tool = freshMock.tools.get("mags_get_progress")!;
      const result = await tool.handler({});

      expect(result.content[0].text).toContain("No progress tracked");

      freshMemoryStore.close();
      rmSync(freshMagsDir, { recursive: true, force: true });
    });

    it("handles case-insensitive module name", async () => {
      const tool = registeredTools.get("mags_get_progress")!;

      const result = await tool.handler({ module: "AUTH" });

      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text);
      expect(data.name).toBe("auth");
    });
  });

  // ── mags_update_progress ────────────────────────

  describe("mags_update_progress", () => {
    beforeEach(async () => {
      const initTool = registeredTools.get("mags_init_progress")!;
      await initTool.handler({
        project: "test-project",
        phase: 1,
        force: false,
        modules: [
          {
            name: "auth",
            priority: 1,
            items: [
              { name: "login", status: "not_started" },
              { name: "register", status: "not_started" },
            ],
          },
          {
            name: "api",
            priority: 2,
            dependsOn: ["auth"],
            items: [{ name: "endpoints", status: "not_started" }],
          },
        ],
      });
    });

    it("updates module status", async () => {
      const tool = registeredTools.get("mags_update_progress")!;

      const result = await tool.handler({
        module: "auth",
        status: "in_progress",
      });

      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text);
      expect(data.updated).toBe(true);
      expect(data.status).toBe("in_progress");
    });

    it("updates item status within module", async () => {
      const tool = registeredTools.get("mags_update_progress")!;

      const result = await tool.handler({
        module: "auth",
        item: "login",
        status: "completed",
      });

      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text);
      expect(data.updated).toBe(true);
      expect(data.item).toBe("login");
    });

    it("returns error for non-existent module", async () => {
      const tool = registeredTools.get("mags_update_progress")!;

      const result = await tool.handler({
        module: "nonexistent",
        status: "in_progress",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("not found");
    });

    it("returns error for non-existent item with available items list", async () => {
      const tool = registeredTools.get("mags_update_progress")!;

      const result = await tool.handler({
        module: "auth",
        item: "nonexistent",
        status: "in_progress",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("not found");
      expect(result.content[0].text).toContain("login");
      expect(result.content[0].text).toContain("register");
    });

    it("warns about unmet dependencies when setting in_progress", async () => {
      const tool = registeredTools.get("mags_update_progress")!;

      const result = await tool.handler({
        module: "api",
        status: "in_progress",
      });

      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text);
      expect(data.warning).toContain("unmet dependencies");
      expect(data.warning).toContain("auth");
    });

    it("stores completion in memory when module completed", async () => {
      const tool = registeredTools.get("mags_update_progress")!;

      await tool.handler({
        module: "auth",
        status: "completed",
      });

      // Check memory store for auto-saved completion
      const memory = memoryStore.get("module_completed_auth");
      expect(memory).toBeDefined();
      expect(memory?.value).toContain("completed");
    });

    it("handles case-insensitive item name", async () => {
      const tool = registeredTools.get("mags_update_progress")!;

      const result = await tool.handler({
        module: "auth",
        item: "LOGIN",
        status: "completed",
      });

      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text);
      expect(data.updated).toBe(true);
    });

    it("adds notes to item", async () => {
      const updateTool = registeredTools.get("mags_update_progress")!;
      const getTool = registeredTools.get("mags_get_progress")!;

      await updateTool.handler({
        module: "auth",
        item: "login",
        status: "in_progress",
        notes: "Working on form validation",
      });

      const result = await getTool.handler({ module: "auth" });
      const data = JSON.parse(result.content[0].text);
      const loginItem = data.items.find((i: { name: string }) => i.name === "login");
      expect(loginItem.notes).toBe("Working on form validation");
    });
  });

  // ── mags_get_next ───────────────────────────────

  describe("mags_get_next", () => {
    it("returns actionable items based on dependencies", async () => {
      const initTool = registeredTools.get("mags_init_progress")!;
      await initTool.handler({
        project: "test-project",
        phase: 1,
        force: false,
        modules: [
          {
            name: "auth",
            priority: 1,
            items: [{ name: "login", status: "not_started" }],
          },
          {
            name: "api",
            priority: 2,
            dependsOn: ["auth"],
            items: [{ name: "endpoints", status: "not_started" }],
          },
        ],
      });

      const tool = registeredTools.get("mags_get_next")!;
      const result = await tool.handler({});

      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text);
      expect(data.actionable).toHaveLength(1);
      expect(data.actionable[0].module).toBe("auth");
      expect(data.actionable[0].item).toBe("login");
    });

    it("unlocks dependent module after completion", async () => {
      const initTool = registeredTools.get("mags_init_progress")!;
      await initTool.handler({
        project: "test-project",
        phase: 1,
        force: false,
        modules: [
          {
            name: "auth",
            priority: 1,
            status: "completed",
            items: [{ name: "login", status: "completed" }],
          },
          {
            name: "api",
            priority: 2,
            dependsOn: ["auth"],
            items: [{ name: "endpoints", status: "not_started" }],
          },
        ],
      });

      const tool = registeredTools.get("mags_get_next")!;
      const result = await tool.handler({});

      const data = JSON.parse(result.content[0].text);
      expect(data.actionable).toHaveLength(1);
      expect(data.actionable[0].module).toBe("api");
    });

    it("returns message when all completed or blocked", async () => {
      const initTool = registeredTools.get("mags_init_progress")!;
      await initTool.handler({
        project: "test-project",
        phase: 1,
        force: false,
        modules: [
          {
            name: "auth",
            priority: 1,
            status: "completed",
            items: [{ name: "login", status: "completed" }],
          },
        ],
      });

      const tool = registeredTools.get("mags_get_next")!;
      const result = await tool.handler({});

      expect(result.content[0].text).toContain("No actionable items");
    });

    it("sorts actionable items by priority", async () => {
      const initTool = registeredTools.get("mags_init_progress")!;
      await initTool.handler({
        project: "test-project",
        phase: 1,
        force: false,
        modules: [
          {
            name: "low-priority",
            priority: 3,
            items: [{ name: "task", status: "not_started" }],
          },
          {
            name: "high-priority",
            priority: 1,
            items: [{ name: "task", status: "not_started" }],
          },
          {
            name: "mid-priority",
            priority: 2,
            items: [{ name: "task", status: "not_started" }],
          },
        ],
      });

      const tool = registeredTools.get("mags_get_next")!;
      const result = await tool.handler({});

      const data = JSON.parse(result.content[0].text);
      expect(data.actionable[0].module).toBe("high-priority");
      expect(data.actionable[1].module).toBe("mid-priority");
      expect(data.actionable[2].module).toBe("low-priority");
    });

    it("includes module without items as actionable", async () => {
      const initTool = registeredTools.get("mags_init_progress")!;
      await initTool.handler({
        project: "test-project",
        phase: 1,
        force: false,
        modules: [
          {
            name: "setup",
            priority: 1,
            items: [],
          },
        ],
      });

      const tool = registeredTools.get("mags_get_next")!;
      const result = await tool.handler({});

      const data = JSON.parse(result.content[0].text);
      expect(data.actionable).toHaveLength(1);
      expect(data.actionable[0].module).toBe("setup");
      expect(data.actionable[0].item).toBe("(module)");
    });

    it("returns empty when no progress initialized", async () => {
      // Create fresh managers without init
      const freshMagsDir = makeTmpDir();
      const freshProgressManager = new ProgressManager(freshMagsDir);
      const freshMemoryStore = new MemoryStore(freshMagsDir);
      const freshMock = createMockServer();

      registerProgressTools(freshMock.server, freshProgressManager, freshMemoryStore);

      const tool = freshMock.tools.get("mags_get_next")!;
      const result = await tool.handler({});

      expect(result.content[0].text).toContain("No actionable items");

      freshMemoryStore.close();
      rmSync(freshMagsDir, { recursive: true, force: true });
    });
  });

  // ── Integration scenarios ───────────────────────

  describe("integration scenarios", () => {
    it("complete workflow: init, update, get next", async () => {
      const initTool = registeredTools.get("mags_init_progress")!;
      const updateTool = registeredTools.get("mags_update_progress")!;
      const getNextTool = registeredTools.get("mags_get_next")!;
      const getProgressTool = registeredTools.get("mags_get_progress")!;

      // Initialize project
      await initTool.handler({
        project: "workflow-test",
        phase: 1,
        force: false,
        modules: [
          {
            name: "foundation",
            priority: 1,
            items: [
              { name: "setup", status: "not_started" },
              { name: "config", status: "not_started" },
            ],
          },
          {
            name: "features",
            priority: 2,
            dependsOn: ["foundation"],
            items: [{ name: "feature-a", status: "not_started" }],
          },
        ],
      });

      // Check initial next items
      let nextResult = await getNextTool.handler({});
      let nextData = JSON.parse(nextResult.content[0].text);
      expect(nextData.actionable[0].module).toBe("foundation");

      // Complete first item
      await updateTool.handler({
        module: "foundation",
        item: "setup",
        status: "completed",
      });

      // Check progress
      let progressResult = await getProgressTool.handler({ module: "foundation" });
      let progressData = JSON.parse(progressResult.content[0].text);
      expect(progressData.status).toBe("in_progress");
      expect(progressData.completionPercent).toBe(50);

      // Complete second item
      await updateTool.handler({
        module: "foundation",
        item: "config",
        status: "completed",
      });

      // Foundation should now be completed
      progressResult = await getProgressTool.handler({ module: "foundation" });
      progressData = JSON.parse(progressResult.content[0].text);
      expect(progressData.status).toBe("completed");
      expect(progressData.completionPercent).toBe(100);

      // Features should now be actionable
      nextResult = await getNextTool.handler({});
      nextData = JSON.parse(nextResult.content[0].text);
      expect(nextData.actionable[0].module).toBe("features");
    });

    it("handles blocked status correctly", async () => {
      const initTool = registeredTools.get("mags_init_progress")!;
      const updateTool = registeredTools.get("mags_update_progress")!;
      const getProgressTool = registeredTools.get("mags_get_progress")!;

      await initTool.handler({
        project: "blocked-test",
        phase: 1,
        force: false,
        modules: [
          {
            name: "blocked-module",
            priority: 1,
            items: [
              { name: "item-a", status: "completed" },
              { name: "item-b", status: "not_started" },
            ],
          },
        ],
      });

      // Block item-b
      await updateTool.handler({
        module: "blocked-module",
        item: "item-b",
        status: "blocked",
        notes: "Waiting for external API",
      });

      const progressResult = await getProgressTool.handler({ module: "blocked-module" });
      const progressData = JSON.parse(progressResult.content[0].text);

      // Module should be blocked (all remaining items are blocked)
      expect(progressData.status).toBe("blocked");
    });
  });

  // ── Works without MemoryStore ───────────────────

  describe("works without MemoryStore", () => {
    it("initializes and updates without memory store", async () => {
      const freshMagsDir = makeTmpDir();
      const freshProgressManager = new ProgressManager(freshMagsDir);
      const freshMock = createMockServer();

      // Register without MemoryStore
      registerProgressTools(freshMock.server, freshProgressManager, undefined);

      const initTool = freshMock.tools.get("mags_init_progress")!;
      const updateTool = freshMock.tools.get("mags_update_progress")!;

      await initTool.handler({
        project: "no-memory-test",
        phase: 1,
        force: false,
        modules: [{ name: "test", priority: 1, items: [] }],
      });

      // Should not throw when completing module without memory store
      const result = await updateTool.handler({
        module: "test",
        status: "completed",
      });

      expect(result.isError).toBeFalsy();

      rmSync(freshMagsDir, { recursive: true, force: true });
    });
  });
});
