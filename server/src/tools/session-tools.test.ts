import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerSessionTools } from "./session-tools.js";
import { SessionManager } from "../services/session-manager.js";
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
  return mkdtempSync(join(tmpdir(), "mags-session-tools-test-"));
}

describe("session-tools", () => {
  let tmpDir: string;
  let magsDir: string;
  let mockServer: McpServer;
  let registeredTools: Map<string, RegisteredTool>;
  let sessionManager: SessionManager;
  let memoryStore: MemoryStore;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    magsDir = join(tmpDir, ".mags");
    mkdirSync(magsDir, { recursive: true });

    sessionManager = new SessionManager(magsDir);
    memoryStore = new MemoryStore(magsDir);

    const mock = createMockServer();
    mockServer = mock.server;
    registeredTools = mock.tools;

    registerSessionTools(mockServer, sessionManager, memoryStore);
  });

  afterEach(() => {
    try {
      memoryStore?.close();
    } catch {}
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // ═════════════════════════════════════════════
  // 1. TOOL REGISTRATION
  // ═════════════════════════════════════════════

  describe("tool registration", () => {
    it("registers mags_save_session tool", () => {
      expect(registeredTools.has("mags_save_session")).toBe(true);
      const tool = registeredTools.get("mags_save_session");
      expect(tool?.description).toContain("Save a session summary");
    });

    it("registers mags_get_last_session tool", () => {
      expect(registeredTools.has("mags_get_last_session")).toBe(true);
      const tool = registeredTools.get("mags_get_last_session");
      expect(tool?.description).toContain("Get the most recent session");
    });

    it("registers mags_list_sessions tool", () => {
      expect(registeredTools.has("mags_list_sessions")).toBe(true);
      const tool = registeredTools.get("mags_list_sessions");
      expect(tool?.description).toContain("List recent session summaries");
    });

    it("registers all three session tools", () => {
      expect(registeredTools.size).toBe(3);
    });
  });

  // ═════════════════════════════════════════════
  // 2. mags_save_session
  // ═════════════════════════════════════════════

  describe("mags_save_session", () => {
    it("creates session entry with all fields", async () => {
      const tool = registeredTools.get("mags_save_session")!;

      const result = await tool.handler({
        summary: "Completed auth module",
        decisions: ["Used JWT for authentication"],
        completed: ["Login page", "Logout endpoint"],
        nextSteps: ["Add password reset"],
        blockers: ["Waiting for design review"],
      });

      expect(result.isError).toBeFalsy();
      const response = JSON.parse(result.content[0].text);
      expect(response.saved).toBe(true);
      expect(response.sessionId).toMatch(/^\d{4}-\d{2}-\d{2}-\d{3}$/);
      expect(response.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("creates session entry with minimal fields", async () => {
      const tool = registeredTools.get("mags_save_session")!;

      const result = await tool.handler({
        summary: "Quick session",
      });

      expect(result.isError).toBeFalsy();
      const response = JSON.parse(result.content[0].text);
      expect(response.saved).toBe(true);
      expect(response.sessionId).toBeTruthy();
    });

    it("creates session entry with null fields", async () => {
      const tool = registeredTools.get("mags_save_session")!;

      const result = await tool.handler({
        summary: "Session with nulls",
        decisions: null,
        completed: null,
        nextSteps: null,
        blockers: null,
      });

      expect(result.isError).toBeFalsy();
      const response = JSON.parse(result.content[0].text);
      expect(response.saved).toBe(true);
    });

    it("saves session to sessionManager", async () => {
      const tool = registeredTools.get("mags_save_session")!;

      await tool.handler({
        summary: "Persisted session",
        decisions: ["Decision A"],
        completed: [],
        nextSteps: [],
        blockers: [],
      });

      const latest = sessionManager.getLatest();
      expect(latest).toBeTruthy();
      expect(latest?.summary).toBe("Persisted session");
      expect(latest?.decisions).toEqual(["Decision A"]);
    });

    it("auto-saves decisions to memory store", async () => {
      const tool = registeredTools.get("mags_save_session")!;

      const result = await tool.handler({
        summary: "Session with decisions",
        decisions: ["Use PostgreSQL", "Use Redis for cache"],
        completed: [],
        nextSteps: [],
        blockers: [],
      });

      expect(result.isError).toBeFalsy();
      const response = JSON.parse(result.content[0].text);
      expect(response.memoryUpdates).toBeDefined();
      expect(response.memoryUpdates).toHaveLength(2);

      // Verify decisions are in memory store
      const all = memoryStore.getAll();
      const decisionKeys = all.filter((m) => m.key.startsWith("session_decision_"));
      expect(decisionKeys).toHaveLength(2);
    });

    it("returns memoryUpdates with correct keys", async () => {
      const tool = registeredTools.get("mags_save_session")!;

      const result = await tool.handler({
        summary: "Test memory keys",
        decisions: ["Decision 1", "Decision 2"],
        completed: [],
        nextSteps: [],
        blockers: [],
      });

      expect(result.isError).toBeFalsy();
      const response = JSON.parse(result.content[0].text);
      expect(response.memoryUpdates[0]).toMatch(/^session_decision_.+_0$/);
      expect(response.memoryUpdates[1]).toMatch(/^session_decision_.+_1$/);
    });

    it("works without memoryStore (no auto-save)", async () => {
      // Create server without memoryStore
      const freshMagsDir = makeTmpDir();
      const freshSessionManager = new SessionManager(freshMagsDir);
      const freshMock = createMockServer();

      registerSessionTools(freshMock.server, freshSessionManager); // No memoryStore

      const tool = freshMock.tools.get("mags_save_session")!;

      const result = await tool.handler({
        summary: "Session without memory",
        decisions: ["Decision X"],
        completed: [],
        nextSteps: [],
        blockers: [],
      });

      expect(result.isError).toBeFalsy();
      const response = JSON.parse(result.content[0].text);
      expect(response.saved).toBe(true);
      expect(response.memoryUpdates).toBeUndefined();

      rmSync(freshMagsDir, { recursive: true, force: true });
    });
  });

  // ═════════════════════════════════════════════
  // 3. mags_get_last_session
  // ═════════════════════════════════════════════

  describe("mags_get_last_session", () => {
    it("returns most recent session", async () => {
      const saveTool = registeredTools.get("mags_save_session")!;
      const getLastTool = registeredTools.get("mags_get_last_session")!;

      // Save two sessions
      await saveTool.handler({
        summary: "First session",
        decisions: [],
        completed: [],
        nextSteps: [],
        blockers: [],
      });

      await saveTool.handler({
        summary: "Second session",
        decisions: ["Latest decision"],
        completed: ["Latest task"],
        nextSteps: [],
        blockers: [],
      });

      const result = await getLastTool.handler({});
      expect(result.isError).toBeFalsy();
      const session = JSON.parse(result.content[0].text);

      expect(session.summary).toBe("Second session");
      expect(session.decisions).toEqual(["Latest decision"]);
      expect(session.completed).toEqual(["Latest task"]);
    });

    it("returns null message when no sessions exist", async () => {
      const getLastTool = registeredTools.get("mags_get_last_session")!;

      const result = await getLastTool.handler({});

      expect(result.content[0].text).toBe("No previous sessions found.");
    });

    it("returns full session entry with all fields", async () => {
      const saveTool = registeredTools.get("mags_save_session")!;
      const getLastTool = registeredTools.get("mags_get_last_session")!;

      await saveTool.handler({
        summary: "Full session",
        decisions: ["A", "B"],
        completed: ["C", "D"],
        nextSteps: ["E", "F"],
        blockers: ["G"],
      });

      const result = await getLastTool.handler({});
      expect(result.isError).toBeFalsy();
      const session = JSON.parse(result.content[0].text);

      expect(session.sessionId).toBeTruthy();
      expect(session.date).toBeTruthy();
      expect(session.summary).toBe("Full session");
      expect(session.decisions).toEqual(["A", "B"]);
      expect(session.completed).toEqual(["C", "D"]);
      expect(session.nextSteps).toEqual(["E", "F"]);
      expect(session.blockers).toEqual(["G"]);
    });
  });

  // ═════════════════════════════════════════════
  // 4. mags_list_sessions
  // ═════════════════════════════════════════════

  describe("mags_list_sessions", () => {
    it("returns empty array when no sessions exist", async () => {
      const listTool = registeredTools.get("mags_list_sessions")!;

      const result = await listTool.handler({});
      expect(result.isError).toBeFalsy();
      const response = JSON.parse(result.content[0].text);

      expect(response.sessions).toEqual([]);
      expect(response.total).toBe(0);
    });

    it("returns sessions in reverse chronological order", async () => {
      const saveTool = registeredTools.get("mags_save_session")!;
      const listTool = registeredTools.get("mags_list_sessions")!;

      await saveTool.handler({
        summary: "First",
        decisions: [],
        completed: [],
        nextSteps: [],
        blockers: [],
      });

      await saveTool.handler({
        summary: "Second",
        decisions: [],
        completed: [],
        nextSteps: [],
        blockers: [],
      });

      await saveTool.handler({
        summary: "Third",
        decisions: [],
        completed: [],
        nextSteps: [],
        blockers: [],
      });

      const result = await listTool.handler({});
      expect(result.isError).toBeFalsy();
      const response = JSON.parse(result.content[0].text);

      expect(response.sessions).toHaveLength(3);
      expect(response.sessions[0].summary).toBe("Third");
      expect(response.sessions[1].summary).toBe("Second");
      expect(response.sessions[2].summary).toBe("First");
    });

    it("respects limit parameter", async () => {
      const saveTool = registeredTools.get("mags_save_session")!;
      const listTool = registeredTools.get("mags_list_sessions")!;

      for (let i = 0; i < 5; i++) {
        await saveTool.handler({
          summary: `Session ${i}`,
          decisions: [],
          completed: [],
          nextSteps: [],
          blockers: [],
        });
      }

      const result = await listTool.handler({ limit: 2 });
      expect(result.isError).toBeFalsy();
      const response = JSON.parse(result.content[0].text);

      expect(response.sessions).toHaveLength(2);
      expect(response.total).toBe(2);
    });

    it("uses default limit of 10 when not specified", async () => {
      const saveTool = registeredTools.get("mags_save_session")!;
      const listTool = registeredTools.get("mags_list_sessions")!;

      for (let i = 0; i < 15; i++) {
        await saveTool.handler({
          summary: `Session ${i}`,
          decisions: [],
          completed: [],
          nextSteps: [],
          blockers: [],
        });
      }

      const result = await listTool.handler({});
      expect(result.isError).toBeFalsy();
      const response = JSON.parse(result.content[0].text);

      expect(response.sessions).toHaveLength(10);
    });

    it("handles null limit parameter", async () => {
      const saveTool = registeredTools.get("mags_save_session")!;
      const listTool = registeredTools.get("mags_list_sessions")!;

      for (let i = 0; i < 15; i++) {
        await saveTool.handler({
          summary: `Session ${i}`,
          decisions: [],
          completed: [],
          nextSteps: [],
          blockers: [],
        });
      }

      const result = await listTool.handler({ limit: null });
      expect(result.isError).toBeFalsy();
      const response = JSON.parse(result.content[0].text);

      expect(response.sessions).toHaveLength(10); // defaults to 10
    });

    it("returns session summaries truncated to 150 characters", async () => {
      const saveTool = registeredTools.get("mags_save_session")!;
      const listTool = registeredTools.get("mags_list_sessions")!;

      const longSummary = "A".repeat(200);
      await saveTool.handler({
        summary: longSummary,
        decisions: [],
        completed: [],
        nextSteps: [],
        blockers: [],
      });

      const result = await listTool.handler({});
      expect(result.isError).toBeFalsy();
      const response = JSON.parse(result.content[0].text);

      expect(response.sessions[0].summary.length).toBe(150);
    });

    it("returns counts for decisions and completed items", async () => {
      const saveTool = registeredTools.get("mags_save_session")!;
      const listTool = registeredTools.get("mags_list_sessions")!;

      await saveTool.handler({
        summary: "Session with items",
        decisions: ["D1", "D2", "D3"],
        completed: ["C1", "C2"],
        nextSteps: [],
        blockers: [],
      });

      const result = await listTool.handler({});
      expect(result.isError).toBeFalsy();
      const response = JSON.parse(result.content[0].text);

      expect(response.sessions[0].decisions).toBe(3);
      expect(response.sessions[0].completed).toBe(2);
    });

    it("returns session id and date", async () => {
      const saveTool = registeredTools.get("mags_save_session")!;
      const listTool = registeredTools.get("mags_list_sessions")!;

      await saveTool.handler({
        summary: "Test",
        decisions: [],
        completed: [],
        nextSteps: [],
        blockers: [],
      });

      const result = await listTool.handler({});
      expect(result.isError).toBeFalsy();
      const response = JSON.parse(result.content[0].text);

      expect(response.sessions[0].id).toMatch(/^\d{4}-\d{2}-\d{2}-\d{3}$/);
      expect(response.sessions[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  // ═════════════════════════════════════════════
  // 5. INTEGRATION SCENARIOS
  // ═════════════════════════════════════════════

  describe("integration scenarios", () => {
    it("full workflow: save -> get_last -> list", async () => {
      const saveTool = registeredTools.get("mags_save_session")!;
      const getLastTool = registeredTools.get("mags_get_last_session")!;
      const listTool = registeredTools.get("mags_list_sessions")!;

      // Step 1: Save a session
      const saveResult = await saveTool.handler({
        summary: "Implemented user authentication",
        decisions: ["JWT with RS256", "Redis for session store"],
        completed: ["Login API", "Logout API"],
        nextSteps: ["Add password reset", "Add 2FA"],
        blockers: [],
      });

      expect(saveResult.isError).toBeFalsy();
      const saveResponse = JSON.parse(saveResult.content[0].text);
      expect(saveResponse.saved).toBe(true);

      // Step 2: Get last session
      const getLastResult = await getLastTool.handler({});
      expect(getLastResult.isError).toBeFalsy();
      const session = JSON.parse(getLastResult.content[0].text);
      expect(session.summary).toBe("Implemented user authentication");
      expect(session.decisions).toHaveLength(2);

      // Step 3: List sessions
      const listResult = await listTool.handler({});
      expect(listResult.isError).toBeFalsy();
      const listResponse = JSON.parse(listResult.content[0].text);
      expect(listResponse.sessions).toHaveLength(1);
      expect(listResponse.sessions[0].decisions).toBe(2);
      expect(listResponse.sessions[0].completed).toBe(2);
    });

    it("multiple sessions with memory updates", async () => {
      const saveTool = registeredTools.get("mags_save_session")!;
      const getLastTool = registeredTools.get("mags_get_last_session")!;

      // Session 1
      await saveTool.handler({
        summary: "Session 1",
        decisions: ["Decision A"],
        completed: [],
        nextSteps: [],
        blockers: [],
      });

      // Session 2
      await saveTool.handler({
        summary: "Session 2",
        decisions: ["Decision B", "Decision C"],
        completed: [],
        nextSteps: [],
        blockers: [],
      });

      // Last session should be Session 2
      const result = await getLastTool.handler({});
      expect(result.isError).toBeFalsy();
      const session = JSON.parse(result.content[0].text);
      expect(session.summary).toBe("Session 2");

      // Memory store should have 3 decision entries
      const all = memoryStore.getAll();
      const decisions = all.filter((m) => m.key.startsWith("session_decision_"));
      expect(decisions).toHaveLength(3);
    });
  });
});
