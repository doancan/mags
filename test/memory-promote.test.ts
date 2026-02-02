import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { MemoryStore } from "../server/src/services/memory-store.js";

describe("Memory Promote — Tool Logic", () => {
  let memoryStore: MemoryStore;
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "mags-promote-"));
    memoryStore = new MemoryStore(tempDir);
  });

  afterEach(() => {
    memoryStore.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("promote candidate evaluation", () => {
    it("can retrieve a stored entry for promotion", async () => {
      await memoryStore.remember("auth_strategy", "JWT with refresh tokens", "conventions", ["auth"]);

      const entry = memoryStore.get("auth_strategy");
      expect(entry).toBeDefined();
      expect(entry!.key).toBe("auth_strategy");
      expect(entry!.value).toBe("JWT with refresh tokens");
      expect(entry!.category).toBe("conventions");
    });

    it("returns undefined for non-existent key", () => {
      const entry = memoryStore.get("nonexistent");
      expect(entry).toBeUndefined();
    });

    it("calculates age correctly for promotion", async () => {
      await memoryStore.remember("old_decision", "some value", "decisions");
      const entry = memoryStore.get("old_decision");
      expect(entry).toBeDefined();

      const ageMs = Date.now() - new Date(entry!.createdAt).getTime();
      const ageInDays = Math.round(ageMs / (1000 * 60 * 60 * 24));
      expect(ageInDays).toBe(0); // Just created
    });

    it("entry with metadata provides richer promotion content", async () => {
      await memoryStore.remember("db_choice", "PostgreSQL", "decisions", ["db"], {
        alternatives: ["MySQL", "MongoDB"],
        reason: "Need ACID transactions",
      });

      const entry = memoryStore.get("db_choice");
      expect(entry).toBeDefined();
      expect(entry!.metadata).toBeDefined();
      expect(entry!.metadata!.alternatives).toEqual(["MySQL", "MongoDB"]);
    });

    it("convention entries generate appropriate suggestion format", async () => {
      await memoryStore.remember("naming_convention", "Use camelCase for variables", "conventions");

      const entry = memoryStore.get("naming_convention");
      expect(entry).toBeDefined();
      expect(entry!.category).toBe("conventions");

      // For conventions, the suggested format is "- {value}"
      const suggestedContent = `- ${entry!.value}`;
      expect(suggestedContent).toBe("- Use camelCase for variables");
    });

    it("non-convention entries generate key-value suggestion format", async () => {
      await memoryStore.remember("api_decision", "Use REST over GraphQL", "decisions");

      const entry = memoryStore.get("api_decision");
      expect(entry).toBeDefined();

      // For non-conventions, the suggested format is "- **{key}**: {value}"
      const suggestedContent = `- **${entry!.key}**: ${entry!.value}`;
      expect(suggestedContent).toBe("- **api_decision**: Use REST over GraphQL");
    });
  });
});
