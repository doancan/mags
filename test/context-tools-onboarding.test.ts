import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { MemoryStore } from "../server/src/services/memory-store.js";
import { LocalEmbeddingProvider } from "../server/src/services/embedding/local.js";

describe("Context Tools — Onboarding & Metadata Search", () => {
  let memoryStore: MemoryStore;
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "mags-context-"));
    memoryStore = new MemoryStore(tempDir);
    memoryStore.setEmbeddingProvider(new LocalEmbeddingProvider());
  });

  afterEach(() => {
    memoryStore.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("first-use detection", () => {
    it("empty store indicates first use", () => {
      const capacity = memoryStore.getCapacity();
      expect(capacity.used).toBe(0);
      // First use = capacity.used === 0
    });

    it("store with entries indicates returning user", async () => {
      await memoryStore.remember("test", "value");
      const capacity = memoryStore.getCapacity();
      expect(capacity.used).toBeGreaterThan(0);
    });
  });

  describe("metadata searchability", () => {
    it("BM25 search includes metadata in text", async () => {
      await memoryStore.remember("db_choice", "PostgreSQL", "decisions", [], {
        alternatives: ["MySQL", "MongoDB"],
        reason: "ACID compliance needed",
      });

      // Search by metadata content (alternatives list)
      const results = await memoryStore.recall("MySQL");
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].key).toBe("db_choice");
    });

    it("keyword search includes metadata in text", async () => {
      // Create a store without embedding provider to force keyword search
      const bareTempDir = mkdtempSync(join(tmpdir(), "mags-bare-"));
      const bareStore = new MemoryStore(bareTempDir);

      try {
        await bareStore.remember("api_style", "REST", "decisions", [], {
          considered: ["GraphQL", "gRPC"],
        });

        const results = await bareStore.recall("GraphQL");
        expect(results.length).toBeGreaterThanOrEqual(1);
        expect(results[0].key).toBe("api_style");
      } finally {
        bareStore.close();
        rmSync(bareTempDir, { recursive: true, force: true });
      }
    });

    it("metadata search does not break when metadata is empty", async () => {
      await memoryStore.remember("simple", "no metadata here");
      const results = await memoryStore.recall("metadata");
      // Should not crash, may return 0 results
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe("capacity info", () => {
    it("getCapacity returns correct percentages", async () => {
      for (let i = 0; i < 10; i++) {
        await memoryStore.remember(`key_${i}`, `value_${i}`);
      }
      const cap = memoryStore.getCapacity();
      expect(cap.used).toBe(10);
      expect(cap.usagePercent).toBe(1); // 10/1000 = 1%
      expect(cap.available).toBe(990);
    });
  });
});
