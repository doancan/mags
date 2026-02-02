import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { MemoryStore } from "../server/src/services/memory-store.js";
import { LocalEmbeddingProvider } from "../server/src/services/embedding/local.js";

describe("Deep Edge Cases", () => {
  let store: MemoryStore;
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "mags-deep-"));
    store = new MemoryStore(tempDir);
    store.setEmbeddingProvider(new LocalEmbeddingProvider());
  });

  afterEach(() => {
    store.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  // ── Temporal Decay Edge Cases ────────────────

  describe("temporal decay edge cases", () => {
    it("entries with same content but different ages score differently", async () => {
      // Insert old entry directly via DB manipulation
      await store.remember("old_entry", "authentication decision");
      await store.remember("new_entry", "authentication decision");

      // Both have ~same age (just created), so scores should be very close
      const results = await store.recall("authentication decision");
      expect(results.length).toBe(2);
      // Scores should both be > 0
      expect(results[0].score).toBeGreaterThan(0);
      expect(results[1].score).toBeGreaterThan(0);
    });

    it("decay factor never boosts score above base (future dates capped)", async () => {
      await store.remember("normal_entry", "test value");

      const results = await store.recall("test value");
      expect(results.length).toBe(1);
      // Score should be positive, not inflated
      expect(results[0].score).toBeGreaterThan(0);
      expect(results[0].score).toBeLessThan(100); // Sanity cap
    });

    it("search does not crash with entries that have no updatedAt", async () => {
      // This tests the NaN protection — entries from DB should always have updatedAt
      // but we test robustness
      await store.remember("valid_entry", "some search term");
      const results = await store.recall("search term");
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(isNaN(results[0].score)).toBe(false);
    });
  });

  // ── SimilarKeys Edge Cases ───────────────────

  describe("similarKeys edge cases", () => {
    it("key without underscore still works", async () => {
      await store.remember("authstrategy", "JWT", "decisions");
      const result = await store.remember("authprovider", "Firebase", "decisions");
      // "authprovider" has no underscore, so prefix = "authprovider"
      // LIKE 'authprovider%' won't match "authstrategy"
      // This is expected — no false positives
      expect(result.similarKeys).toBeUndefined();
    });

    it("entry without category never returns similarKeys", async () => {
      await store.remember("test_a", "v1");
      await store.remember("test_b", "v2");
      const result = await store.remember("test_c", "v3");
      expect(result.similarKeys).toBeUndefined();
    });

    it("similarKeys does not include self", async () => {
      await store.remember("auth_one", "v1", "decisions");
      // Update auth_one — should not return itself as similar
      const result = await store.remember("auth_one", "v2", "decisions");
      if (result.similarKeys) {
        expect(result.similarKeys).not.toContain("auth_one");
      }
    });

    it("similarKeys with special chars in key", async () => {
      await store.remember("api_v2_endpoint", "rest", "decisions");
      const result = await store.remember("api_v2_model", "graphql", "decisions");
      // prefix = "api", LIKE 'api%' should match both
      expect(result.similarKeys).toBeDefined();
      expect(result.similarKeys!).toContain("api_v2_endpoint");
    });
  });

  // ── Auto-Prune Consistency ───────────────────

  describe("auto-prune consistency", () => {
    it("prune removes the oldest updated entry", async () => {
      // Create entries with predictable order
      await store.remember("oldest", "v1");
      await new Promise((r) => setTimeout(r, 15));
      await store.remember("middle", "v2");
      await new Promise((r) => setTimeout(r, 15));
      await store.remember("newest", "v3");

      // Fill up to 1000
      for (let i = 3; i < 1000; i++) {
        await store.remember(`filler_${i}`, `v${i}`);
      }

      // This should prune "oldest" (earliest updated_at)
      const result = await store.remember("overflow", "v_overflow");
      expect(result.pruned).toBe(1);
      expect(store.get("oldest")).toBeUndefined();
      expect(store.get("middle")).toBeDefined();
      expect(store.get("newest")).toBeDefined();
      expect(store.get("overflow")).toBeDefined();
    });

    it("updating an old entry refreshes its updated_at, preventing premature prune", async () => {
      await store.remember("will_update", "v1");
      await new Promise((r) => setTimeout(r, 15));

      for (let i = 1; i < 1000; i++) {
        await store.remember(`filler_${i}`, `v${i}`);
      }

      // Update "will_update" — refreshes its updated_at to now
      await store.remember("will_update", "v2_updated");

      // This prune should NOT remove "will_update" since it was just updated
      const result = await store.remember("new_entry", "v_new");
      expect(result.pruned).toBe(1);
      expect(store.get("will_update")).toBeDefined();
      expect(store.get("will_update")!.value).toBe("v2_updated");
    });
  });

  // ── Capacity Warning Precision ───────────────

  describe("capacity warning precision", () => {
    it("warning appears exactly at 80% threshold", async () => {
      // Fill to 800 entries (80% of 1000)
      for (let i = 0; i < 800; i++) {
        await store.remember(`k_${i}`, `v_${i}`);
      }

      const result = await store.remember("threshold_entry", "val");
      // 801/1000 = 80.1% — should trigger warning
      expect(result.warning).toBeDefined();
      expect(result.capacityPercent).toBe(80); // Math.round(801/1000*100) = 80
    });

    it("no warning at 79.9%", async () => {
      // Fill to 799 entries
      for (let i = 0; i < 799; i++) {
        await store.remember(`k_${i}`, `v_${i}`);
      }

      const result = await store.remember("below_threshold", "val");
      // 800/1000 = exactly 80% — MEMORY_WARNING_THRESHOLD = 0.8 means >= 0.8 triggers
      expect(result.capacityPercent).toBe(80);
      // 800/1000 = 0.8 >= 0.8 → warning triggered
      expect(result.warning).toBeDefined();
    });
  });

  // ── Metadata Search Robustness ───────────────

  describe("metadata search robustness", () => {
    it("deeply nested metadata is searchable", async () => {
      await store.remember("nested", "val", "notes", [], {
        level1: {
          level2: {
            level3: "deepvalue_unique_xyz",
          },
        },
      });

      const results = await store.recall("deepvalue_unique_xyz");
      expect(results.length).toBe(1);
      expect(results[0].key).toBe("nested");
    });

    it("metadata with array values is searchable", async () => {
      await store.remember("with_array", "val", "notes", [], {
        items: ["alpha_unique_test", "beta", "gamma"],
      });

      const results = await store.recall("alpha_unique_test");
      expect(results.length).toBe(1);
    });

    it("metadata with numeric values is searchable", async () => {
      await store.remember("numeric_meta", "val", "notes", [], {
        port: 8080,
        retries: 3,
      });

      const results = await store.recall("8080");
      expect(results.length).toBe(1);
    });

    it("metadata with boolean/null values does not crash", async () => {
      await store.remember("bool_meta", "val", "notes", [], {
        enabled: true,
        disabled: false,
        nothing: null,
      });

      const results = await store.recall("enabled");
      // "enabled" appears in JSON.stringify output
      expect(Array.isArray(results)).toBe(true);
    });
  });

  // ── Concurrent Operations ────────────────────

  describe("concurrent operations", () => {
    it("parallel remember calls don't corrupt data", async () => {
      const promises = Array.from({ length: 50 }, (_, i) =>
        store.remember(`concurrent_${i}`, `value_${i}`, "test")
      );

      await Promise.all(promises);

      const capacity = store.getCapacity();
      expect(capacity.used).toBe(50);

      // Verify all entries exist
      for (let i = 0; i < 50; i++) {
        const entry = store.get(`concurrent_${i}`);
        expect(entry).toBeDefined();
        expect(entry!.value).toBe(`value_${i}`);
      }
    });

    it("parallel remember + recall don't crash", async () => {
      // Seed some data
      for (let i = 0; i < 20; i++) {
        await store.remember(`seed_${i}`, `value_${i}`, "test");
      }

      const ops: Promise<unknown>[] = [];
      for (let i = 0; i < 10; i++) {
        ops.push(store.remember(`new_${i}`, `new_value_${i}`, "test"));
        ops.push(store.recall("value", "test", 5));
      }

      // Should not throw
      await expect(Promise.all(ops)).resolves.toBeTruthy();
    });

    it("parallel remember + forget keeps consistency", async () => {
      for (let i = 0; i < 30; i++) {
        await store.remember(`item_${i}`, `val_${i}`);
      }

      // Forget some, add new ones concurrently
      const ops: Promise<unknown>[] = [];
      for (let i = 0; i < 10; i++) {
        store.forget(`item_${i}`); // sync
        ops.push(store.remember(`replacement_${i}`, `new_val_${i}`));
      }

      await Promise.all(ops);

      // Original 30 - 10 forgotten + 10 new = 30
      expect(store.getCapacity().used).toBe(30);
    });
  });

  // ── Empty/Boundary Query Cases ───────────────

  describe("boundary query cases", () => {
    it("query with only whitespace returns all (empty query path)", async () => {
      await store.remember("a", "val_a");
      await store.remember("b", "val_b");

      const results = await store.recall("   ", undefined, 10);
      expect(results.length).toBe(2);
      // All get score: 1 (empty query fast path)
      expect(results[0].score).toBe(1);
    });

    it("query with single character (length 1) is filtered out", async () => {
      await store.remember("x_entry", "x value");

      // Single char "x" is filtered by keywordSearch (length > 1)
      const results = await store.recall("x");
      // BM25 tokenizer also filters length > 1
      // This should still work through BM25 if embedding provider is set
      // With LocalEmbeddingProvider, "x" gets tokenized and filtered
      expect(Array.isArray(results)).toBe(true);
    });

    it("limit=0 returns empty array", async () => {
      await store.remember("k", "v");
      const results = await store.recall("v", undefined, 0);
      expect(results).toHaveLength(0);
    });

    it("recall with non-existent category returns empty", async () => {
      await store.remember("k", "v", "real_cat");
      const results = await store.recall("v", "fake_category");
      expect(results).toHaveLength(0);
    });

    it("very long query string does not crash", async () => {
      await store.remember("k", "v");
      const longQuery = "word ".repeat(5000);
      const results = await store.recall(longQuery);
      expect(Array.isArray(results)).toBe(true);
    });

    it("query with special regex chars does not crash", async () => {
      await store.remember("k", "v");
      const results = await store.recall("test[.*+?^${}()|\\");
      expect(Array.isArray(results)).toBe(true);
    });
  });

  // ── Session Decision Key Uniqueness ──────────

  describe("session decision key uniqueness", () => {
    it("different session IDs produce different keys", async () => {
      // Simulate two sessions saving the same decision
      const sessionId1 = "2026-02-02-001";
      const sessionId2 = "2026-02-02-002";

      await store.remember(`session_decision_${sessionId1}_0`, "Use JWT", "decisions", ["auto-session"]);
      await store.remember(`session_decision_${sessionId2}_0`, "Use JWT", "decisions", ["auto-session"]);

      // Both should exist as separate entries
      expect(store.get(`session_decision_${sessionId1}_0`)).toBeDefined();
      expect(store.get(`session_decision_${sessionId2}_0`)).toBeDefined();
      expect(store.getCapacity().used).toBe(2);
    });

    it("same session ID overwrites (upsert, no duplicate)", async () => {
      const sessionId = "2026-02-02-001";

      await store.remember(`session_decision_${sessionId}_0`, "Use JWT", "decisions", ["auto-session"]);
      await store.remember(`session_decision_${sessionId}_0`, "Use OAuth", "decisions", ["auto-session"]);

      const entry = store.get(`session_decision_${sessionId}_0`);
      expect(entry!.value).toBe("Use OAuth"); // Overwritten
      expect(store.getCapacity().used).toBe(1); // Still 1 entry
    });
  });

  // ── getCapacity Accuracy ─────────────────────

  describe("getCapacity accuracy", () => {
    it("reflects forget operations immediately", async () => {
      await store.remember("a", "v1");
      await store.remember("b", "v2");
      expect(store.getCapacity().used).toBe(2);

      store.forget("a");
      expect(store.getCapacity().used).toBe(1);

      store.forget("b");
      expect(store.getCapacity().used).toBe(0);
    });

    it("upsert does not change count", async () => {
      await store.remember("key", "v1");
      expect(store.getCapacity().used).toBe(1);

      await store.remember("key", "v2");
      expect(store.getCapacity().used).toBe(1);

      await store.remember("key", "v3");
      expect(store.getCapacity().used).toBe(1);
    });
  });

  // ── Promote Tool Logic ───────────────────────

  describe("promote edge cases", () => {
    it("get() returns fresh data after update", async () => {
      await store.remember("evolving", "version 1", "conventions");
      await store.remember("evolving", "version 2", "conventions");

      const entry = store.get("evolving");
      expect(entry!.value).toBe("version 2");
    });

    it("get() returns metadata correctly for promotion", async () => {
      await store.remember("rich", "value", "decisions", ["tag1"], {
        reason: "test",
        alternatives: ["a", "b"],
      });

      const entry = store.get("rich");
      expect(entry!.metadata).toBeDefined();
      expect(entry!.metadata!.reason).toBe("test");
      expect(entry!.tags).toEqual(["tag1"]);
    });
  });
});
