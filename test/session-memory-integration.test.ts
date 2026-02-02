import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { MemoryStore } from "../server/src/services/memory-store.js";

describe("Session → Memory Integration", () => {
  let memoryStore: MemoryStore;
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "mags-integration-"));
    memoryStore = new MemoryStore(tempDir);
  });

  afterEach(() => {
    memoryStore.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("auto-store decisions pattern", () => {
    it("stores session decisions as memories", async () => {
      const decisions = ["Use JWT for auth", "PostgreSQL as database"];
      const timestamp = Date.now();

      for (let i = 0; i < decisions.length; i++) {
        const key = `session_decision_${timestamp}_${i}`;
        await memoryStore.remember(key, decisions[i], "decisions", ["auto-session"]);
      }

      const recalled = await memoryStore.recall("", "decisions", 10);
      expect(recalled.length).toBe(2);
      expect(recalled.some((r) => r.value === "Use JWT for auth")).toBe(true);
      expect(recalled.some((r) => r.value === "PostgreSQL as database")).toBe(true);
    });

    it("auto-session tagged memories are searchable", async () => {
      await memoryStore.remember(
        "session_decision_123_0",
        "GraphQL over REST for API",
        "decisions",
        ["auto-session"]
      );

      const results = await memoryStore.recall("GraphQL");
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].tags).toContain("auto-session");
    });
  });

  describe("progress → memory pattern", () => {
    it("stores module completion as memory", async () => {
      const moduleName = "auth";
      await memoryStore.remember(
        `module_completed_${moduleName}`,
        `Module "${moduleName}" completed`,
        "context",
        ["auto-progress", moduleName]
      );

      const entry = memoryStore.get(`module_completed_${moduleName}`);
      expect(entry).toBeDefined();
      expect(entry!.category).toBe("context");
      expect(entry!.tags).toContain("auto-progress");
      expect(entry!.tags).toContain("auth");
    });

    it("recall finds completed modules", async () => {
      await memoryStore.remember("module_completed_auth", "Module auth completed", "context", ["auto-progress", "auth"]);
      await memoryStore.remember("module_completed_crm", "Module crm completed", "context", ["auto-progress", "crm"]);

      const results = await memoryStore.recall("completed", "context");
      expect(results.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("duplicate detection", () => {
    it("detects similar keys in same category", async () => {
      await memoryStore.remember("auth_strategy", "JWT", "decisions");
      await memoryStore.remember("auth_provider", "Firebase", "decisions");

      const result = await memoryStore.remember("auth_method", "OAuth2", "decisions");
      expect(result.similarKeys).toBeDefined();
      expect(result.similarKeys!).toContain("auth_strategy");
    });

    it("no similar keys for unrelated entries", async () => {
      await memoryStore.remember("db_choice", "postgres", "decisions");
      const result = await memoryStore.remember("cache_strategy", "redis", "decisions");
      // cache_ prefix won't match db_ prefix
      expect(result.similarKeys).toBeUndefined();
    });
  });
});
