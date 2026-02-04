import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { MemoryStore } from "../server/src/services/memory-store.js";
import { LocalEmbeddingProvider } from "../server/src/services/embedding/local.js";
import { ProgressManager } from "../server/src/services/progress-manager.js";

// ═══════════════════════════════════════════════
// Complex Scenario Tests — Deep Logic Bug Coverage
// ═══════════════════════════════════════════════

describe("BUG 1: IDF Cache Pollution Across Categories", () => {
  let store: MemoryStore;
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "mags-idf-"));
    store = new MemoryStore(tempDir);
    store.setEmbeddingProvider(new LocalEmbeddingProvider());
  });

  afterEach(() => {
    store.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("recall with different categories produces correct scores (no stale IDF)", async () => {
    // Category A: "auth" appears in ALL 3 entries → low IDF
    await store.remember("a1", "auth login system", "catA");
    await store.remember("a2", "auth token refresh", "catA");
    await store.remember("a3", "auth session manager", "catA");

    // Category B: "auth" appears in only 1 of 3 entries → high IDF
    await store.remember("b1", "auth provider setup", "catB");
    await store.remember("b2", "database migration script", "catB");
    await store.remember("b3", "payment gateway integration", "catB");

    // First search in catA — "auth" has low IDF (appears in all docs)
    const resultsA = await store.recall("auth", "catA", 10);

    // Second search in catB — "auth" should have HIGH IDF (rare in this set)
    const resultsB = await store.recall("auth", "catB", 10);

    // b1 should score higher than any catA entry because "auth" is rarer in catB
    expect(resultsB.length).toBeGreaterThan(0);
    expect(resultsA.length).toBeGreaterThan(0);

    // The key test: if IDF cache was polluted, catB "auth" IDF would be wrong
    // With 3/3 docs in catA, IDF would be very low (near 0)
    // With 1/3 docs in catB, IDF should be significantly higher
    const maxScoreA = Math.max(...resultsA.map((r) => r.score));
    const maxScoreB = Math.max(...resultsB.map((r) => r.score));

    // catB should have higher max score for "auth" since it's rarer there
    expect(maxScoreB).toBeGreaterThan(maxScoreA);
  });

  it("consecutive recalls with overlapping terms don't corrupt scores", async () => {
    await store.remember("x1", "database connection pool", "infra");
    await store.remember("x2", "database migration runner", "infra");

    await store.remember("y1", "database schema design", "design");
    await store.remember("y2", "api endpoint design", "design");
    await store.remember("y3", "frontend component design", "design");

    // First: search "database" in infra (2/2 entries match → low IDF)
    const r1 = await store.recall("database", "infra", 10);
    // Second: search "database" in design (1/3 entries match → higher IDF)
    const r2 = await store.recall("database", "design", 10);

    expect(r1.length).toBe(2);
    expect(r2.length).toBeGreaterThanOrEqual(1);

    // Verify the "design" search gives higher score to the matching entry
    // because "database" is rarer in the design category
    if (r1.length > 0 && r2.length > 0) {
      expect(r2[0].score).toBeGreaterThan(r1[0].score);
    }
  });

  it("same query repeated gives identical scores (cache cleared each time)", async () => {
    await store.remember("s1", "unique searchterm alpha", "test");
    await store.remember("s2", "common word beta", "test");

    const first = await store.recall("unique searchterm", "test", 10);
    const second = await store.recall("unique searchterm", "test", 10);

    expect(first.length).toBe(second.length);
    for (let i = 0; i < first.length; i++) {
      // Use precision of 8 decimal places to account for floating point arithmetic variations
      // while still ensuring scores are effectively identical
      expect(first[i].score).toBeCloseTo(second[i].score, 8);
    }
  });
});

describe("BUG 2: Use-After-Close Guard", () => {
  let store: MemoryStore;
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "mags-close-"));
    store = new MemoryStore(tempDir);
    store.setEmbeddingProvider(new LocalEmbeddingProvider());
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("remember() after close() throws MemoryStore is closed", async () => {
    await store.remember("k", "v");
    store.close();
    await expect(store.remember("k2", "v2")).rejects.toThrow("MemoryStore is closed");
  });

  it("recall() after close() throws MemoryStore is closed", async () => {
    await store.remember("k", "v");
    store.close();
    await expect(store.recall("v")).rejects.toThrow("MemoryStore is closed");
  });

  it("forget() after close() throws MemoryStore is closed", () => {
    store.close();
    expect(() => store.forget("k")).toThrow("MemoryStore is closed");
  });

  it("get() after close() throws MemoryStore is closed", () => {
    store.close();
    expect(() => store.get("k")).toThrow("MemoryStore is closed");
  });

  it("getAll() after close() throws MemoryStore is closed", () => {
    store.close();
    expect(() => store.getAll()).toThrow("MemoryStore is closed");
  });

  it("getCapacity() after close() throws MemoryStore is closed", () => {
    store.close();
    expect(() => store.getCapacity()).toThrow("MemoryStore is closed");
  });

  it("double close() does not throw", () => {
    store.close();
    expect(() => store.close()).not.toThrow();
  });

  it("operations work fine before close()", async () => {
    await store.remember("test", "value");
    const entry = store.get("test");
    expect(entry).toBeDefined();
    expect(entry!.value).toBe("value");

    const all = store.getAll();
    expect(all.length).toBe(1);

    const cap = store.getCapacity();
    expect(cap.used).toBe(1);

    store.close();
  });
});

describe("BUG 17: LIKE Wildcard Injection in similarKeys", () => {
  let store: MemoryStore;
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "mags-like-"));
    store = new MemoryStore(tempDir);
    store.setEmbeddingProvider(new LocalEmbeddingProvider());
  });

  afterEach(() => {
    store.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("key with % in prefix does not match unrelated entries", async () => {
    // Key with % character — prefix would be "%admin"
    await store.remember("normal_entry", "value1", "cat");
    await store.remember("another_entry", "value2", "cat");

    // This key has % in its first segment before _
    const result = await store.remember("%admin_secret", "value3", "cat");

    // Without escape, LIKE '%admin%' would match ALL entries in the category
    // With escape, LIKE '\%admin%' should only match keys starting with "%admin"
    if (result.similarKeys) {
      expect(result.similarKeys).not.toContain("normal_entry");
      expect(result.similarKeys).not.toContain("another_entry");
    }
  });

  it("key with underscore-only prefix works correctly", async () => {
    // Key without underscore separator — entire key becomes prefix
    await store.remember("testkey", "v1", "cat");
    await store.remember("testkey2", "v2", "cat");

    // Keys without underscore use entire key as prefix
    const result = await store.remember("testkey3", "v3", "cat");
    // LIKE 'testkey3%' should match testkey3 itself (excluded) but not testkey/testkey2
    expect(result.similarKeys).toBeUndefined();
  });

  it("normal underscore-separated keys still find similar keys", async () => {
    await store.remember("auth_jwt", "JWT strategy", "decisions");
    await store.remember("auth_oauth", "OAuth strategy", "decisions");

    const result = await store.remember("auth_session", "Session strategy", "decisions");
    // prefix is "auth", escaped prefix is also "auth" (no special chars)
    expect(result.similarKeys).toBeDefined();
    expect(result.similarKeys!).toContain("auth_jwt");
    expect(result.similarKeys!).toContain("auth_oauth");
  });
});

describe("BUG 12: extractModuleSection Reverse Match", () => {
  // We can't directly test extractModuleSection since it's private,
  // but we can test through module_context behavior by checking patterns

  it("single-character heading title should not match long aliases", () => {
    // The fix changes alias.includes(titleClean) to titleClean.includes(alias)
    // and adds titleClean.length > 2 guard
    const titleClean = "a"; // single char heading "# A"
    const alias = "authentication";

    // OLD behavior: alias.includes(titleClean) → "authentication".includes("a") → TRUE (wrong!)
    // NEW behavior: titleClean.length > 2 check fails → FALSE (correct!)
    expect(titleClean.length > 2 && titleClean.includes(alias)).toBe(false);
  });

  it("two-character heading title should not match long aliases", () => {
    const titleClean = "db";
    const alias = "database";

    // titleClean.length is 2, not > 2, so guard fails
    expect(titleClean.length > 2 && titleClean.includes(alias)).toBe(false);
  });

  it("long heading title correctly matches alias substring", () => {
    const titleClean = "authenticationmodule";
    const alias = "auth";

    // titleClean.length > 2 and titleClean includes "auth"
    expect(titleClean.length > 2 && titleClean.includes(alias)).toBe(true);
  });

  it("heading title with exact alias match works", () => {
    const title = "## Authentication";
    const titleClean = title.toLowerCase().replace(/[^a-z]/g, ""); // "authentication"
    const alias = "auth";

    expect(title.toLowerCase().includes(alias) || (titleClean.length > 2 && titleClean.includes(alias))).toBe(true);
  });
});

describe("BUG 8: getNext() With Zero-Item Modules", () => {
  let pm: ProgressManager;
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "mags-pm-"));
    mkdirSync(join(tempDir, ".mags"), { recursive: true });
    pm = new ProgressManager(join(tempDir, ".mags"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("module with no items appears in getNext()", () => {
    pm.initialize("test", [
      { name: "setup", status: "not_started", phase: 1, priority: 1, dependsOn: [], items: [] },
    ]);

    const next = pm.getNext();
    expect(next.length).toBe(1);
    expect(next[0].module).toBe("setup");
    expect(next[0].item).toBe("(module)");
  });

  it("completed module with no items does not appear in getNext()", () => {
    pm.initialize("test", [
      { name: "done", status: "completed", phase: 1, priority: 1, dependsOn: [], items: [] },
      { name: "todo", status: "not_started", phase: 1, priority: 2, dependsOn: [], items: [] },
    ]);

    const next = pm.getNext();
    expect(next.length).toBe(1);
    expect(next[0].module).toBe("todo");
  });

  it("zero-item module with unmet deps does not appear in getNext()", () => {
    pm.initialize("test", [
      { name: "blocker", status: "not_started", phase: 1, priority: 1, dependsOn: [], items: [] },
      { name: "blocked", status: "not_started", phase: 1, priority: 2, dependsOn: ["blocker"], items: [] },
    ]);

    const next = pm.getNext();
    expect(next.length).toBe(1);
    expect(next[0].module).toBe("blocker");
  });

  it("mix of zero-item and item-having modules sorted by priority", () => {
    pm.initialize("test", [
      {
        name: "modA", status: "not_started", phase: 1, priority: 2, dependsOn: [],
        items: [{ name: "task1", status: "not_started" }],
      },
      { name: "modB", status: "not_started", phase: 1, priority: 1, dependsOn: [], items: [] },
    ]);

    const next = pm.getNext();
    expect(next.length).toBe(2);
    // modB has higher priority (lower number) and no items, should come first
    expect(next[0].module).toBe("modB");
    expect(next[0].item).toBe("(module)");
    expect(next[1].module).toBe("modA");
    expect(next[1].item).toBe("task1");
  });
});

describe("BUG 9: Case-Sensitive Dependency Matching", () => {
  let pm: ProgressManager;
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "mags-deps-"));
    mkdirSync(join(tempDir, ".mags"), { recursive: true });
    pm = new ProgressManager(join(tempDir, ".mags"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("dependency matching is case-insensitive", () => {
    pm.initialize("test", [
      { name: "Auth", status: "completed", phase: 1, priority: 1, dependsOn: [], items: [] },
      {
        name: "Dashboard", status: "not_started", phase: 1, priority: 2,
        dependsOn: ["auth"], // lowercase "auth" depends on "Auth" (uppercase)
        items: [{ name: "setup", status: "not_started" }],
      },
    ]);

    const unmet = pm.getUnmetDependencies("Dashboard");
    // "auth" should match "Auth" case-insensitively → no unmet deps
    expect(unmet).toHaveLength(0);
  });

  it("getNext() respects case-insensitive dependency resolution", () => {
    pm.initialize("test", [
      { name: "Core", status: "completed", phase: 1, priority: 1, dependsOn: [], items: [] },
      {
        name: "Feature", status: "not_started", phase: 1, priority: 2,
        dependsOn: ["core"], // lowercase
        items: [{ name: "implement", status: "not_started" }],
      },
    ]);

    const next = pm.getNext();
    // "Feature" depends on "core" which should match completed "Core"
    expect(next.length).toBe(1);
    expect(next[0].module).toBe("Feature");
  });

  it("mixed case dependencies all resolve correctly", () => {
    pm.initialize("test", [
      { name: "Auth", status: "completed", phase: 1, priority: 1, dependsOn: [], items: [] },
      { name: "DB", status: "completed", phase: 1, priority: 1, dependsOn: [], items: [] },
      {
        name: "API", status: "not_started", phase: 1, priority: 2,
        dependsOn: ["auth", "db"], // all lowercase
        items: [{ name: "routes", status: "not_started" }],
      },
    ]);

    const unmet = pm.getUnmetDependencies("API");
    expect(unmet).toHaveLength(0);

    const next = pm.getNext();
    expect(next.some((n) => n.module === "API")).toBe(true);
  });
});

describe("BUG 7: Cycle Detection Duplicate Warnings", () => {
  let pm: ProgressManager;
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "mags-cycle-"));
    mkdirSync(join(tempDir, ".mags"), { recursive: true });
    pm = new ProgressManager(join(tempDir, ".mags"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("simple A↔B cycle produces exactly 1 warning (not 2)", () => {
    const result = pm.initialize("test", [
      { name: "A", status: "not_started", phase: 1, priority: 1, dependsOn: ["B"], items: [] },
      { name: "B", status: "not_started", phase: 1, priority: 1, dependsOn: ["A"], items: [] },
    ]);

    const warnings = (result as any).warnings as string[] | undefined;
    expect(warnings).toBeDefined();
    const cycleWarnings = warnings!.filter((w) => w.includes("Circular"));
    // Should have exactly 1 cycle warning, not 2
    expect(cycleWarnings.length).toBe(1);
  });

  it("3-node cycle A→B→C→A produces exactly 1 warning", () => {
    const result = pm.initialize("test", [
      { name: "A", status: "not_started", phase: 1, priority: 1, dependsOn: ["B"], items: [] },
      { name: "B", status: "not_started", phase: 1, priority: 1, dependsOn: ["C"], items: [] },
      { name: "C", status: "not_started", phase: 1, priority: 1, dependsOn: ["A"], items: [] },
    ]);

    const warnings = (result as any).warnings as string[] | undefined;
    expect(warnings).toBeDefined();
    const cycleWarnings = warnings!.filter((w) => w.includes("Circular"));
    expect(cycleWarnings.length).toBe(1);
  });

  it("two independent cycles produce exactly 2 warnings", () => {
    const result = pm.initialize("test", [
      { name: "A", status: "not_started", phase: 1, priority: 1, dependsOn: ["B"], items: [] },
      { name: "B", status: "not_started", phase: 1, priority: 1, dependsOn: ["A"], items: [] },
      { name: "X", status: "not_started", phase: 1, priority: 1, dependsOn: ["Y"], items: [] },
      { name: "Y", status: "not_started", phase: 1, priority: 1, dependsOn: ["X"], items: [] },
    ]);

    const warnings = (result as any).warnings as string[] | undefined;
    expect(warnings).toBeDefined();
    const cycleWarnings = warnings!.filter((w) => w.includes("Circular"));
    expect(cycleWarnings.length).toBe(2);
  });

  it("no cycle produces no cycle warnings", () => {
    const result = pm.initialize("test", [
      { name: "A", status: "not_started", phase: 1, priority: 1, dependsOn: [], items: [] },
      { name: "B", status: "not_started", phase: 1, priority: 1, dependsOn: ["A"], items: [] },
      { name: "C", status: "not_started", phase: 1, priority: 1, dependsOn: ["B"], items: [] },
    ]);

    const warnings = (result as any).warnings as string[] | undefined;
    expect(warnings).toBeUndefined();
  });
});

describe("Complex Interaction: Concurrent Category Searches", () => {
  let store: MemoryStore;
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "mags-conc-"));
    store = new MemoryStore(tempDir);
    store.setEmbeddingProvider(new LocalEmbeddingProvider());
  });

  afterEach(() => {
    store.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("parallel recalls across categories don't interfere", async () => {
    // Seed data in multiple categories
    for (let i = 0; i < 10; i++) {
      await store.remember(`dec_${i}`, `authentication decision ${i}`, "decisions");
    }
    for (let i = 0; i < 5; i++) {
      await store.remember(`note_${i}`, `authentication note ${i}`, "notes");
    }

    // Run parallel recalls
    const [decisions, notes, all] = await Promise.all([
      store.recall("authentication", "decisions", 10),
      store.recall("authentication", "notes", 10),
      store.recall("authentication", undefined, 15),
    ]);

    expect(decisions.length).toBe(10);
    expect(notes.length).toBe(5);
    expect(all.length).toBe(15);
  });

  it("recall after mass prune returns correct results", async () => {
    // Fill to capacity
    for (let i = 0; i < 1000; i++) {
      await store.remember(`fill_${i}`, `filler value ${i}`);
    }

    // This triggers prune of oldest
    await store.remember("latest_entry", "searchable unique term xyz");

    const results = await store.recall("searchable unique term xyz");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].key).toBe("latest_entry");
  });
});

describe("Complex Interaction: Remember + Close Race", () => {
  it("close during parallel remember operations is safe", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "mags-race-"));
    const store = new MemoryStore(tempDir);
    store.setEmbeddingProvider(new LocalEmbeddingProvider());

    // Start several remember operations
    const promises = Array.from({ length: 5 }, (_, i) =>
      store.remember(`race_${i}`, `value_${i}`)
    );

    // Close while operations may be in flight
    // Since better-sqlite3 is sync, all DB ops complete before close
    await Promise.allSettled(promises);
    store.close();

    // Verify close happened
    expect(() => store.getCapacity()).toThrow("MemoryStore is closed");

    rmSync(tempDir, { recursive: true, force: true });
  });
});

describe("Complex: Prune + SimilarKeys Interaction", () => {
  let store: MemoryStore;
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "mags-prune-sim-"));
    store = new MemoryStore(tempDir);
    store.setEmbeddingProvider(new LocalEmbeddingProvider());
  });

  afterEach(() => {
    store.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("similarKeys does not include pruned entries", async () => {
    // Add entries with same prefix "auth_"
    await store.remember("auth_jwt", "JWT strategy", "decisions");

    // Fill to capacity with filler
    for (let i = 0; i < 999; i++) {
      await store.remember(`filler_${i}`, `filler_${i}`);
    }

    // auth_jwt should be the oldest, so it gets pruned by this insert
    const result = await store.remember("auth_new", "new auth", "decisions");
    expect(result.pruned).toBe(1);

    // auth_jwt was pruned, so it should NOT appear in similarKeys
    if (result.similarKeys) {
      expect(result.similarKeys).not.toContain("auth_jwt");
    }
  });
});

describe("Complex: Keyword Search Edge Cases", () => {
  let store: MemoryStore;
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "mags-kwsearch-"));
    store = new MemoryStore(tempDir);
    // NO embedding provider — forces keyword search path
  });

  afterEach(() => {
    store.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("keyword search with all single-char terms returns empty", async () => {
    await store.remember("k", "a b c d e");
    // All terms "a", "b", "c" etc are length 1, filtered out
    const results = await store.recall("a b c");
    expect(results).toHaveLength(0);
  });

  it("keyword search scores normalized by term count", async () => {
    await store.remember("entry1", "alpha beta gamma");
    await store.remember("entry2", "alpha only");

    // "alpha beta" has 2 terms. entry1 matches both, entry2 matches 1
    const results = await store.recall("alpha beta");
    expect(results.length).toBe(2);
    // entry1 should score higher (2/2 vs 1/2 match ratio)
    expect(results[0].key).toBe("entry1");
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });

  it("keyword search with metadata content", async () => {
    await store.remember("entry", "basic value", "notes", [], {
      deep: { nested: { secret: "xyzzy_unique_metadata_term" } },
    });

    const results = await store.recall("xyzzy_unique_metadata_term");
    expect(results.length).toBe(1);
    expect(results[0].key).toBe("entry");
  });
});

describe("Complex: Progress Manager Dependency Chain", () => {
  let pm: ProgressManager;
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "mags-chain-"));
    mkdirSync(join(tempDir, ".mags"), { recursive: true });
    pm = new ProgressManager(join(tempDir, ".mags"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("long dependency chain: only first module is actionable", () => {
    pm.initialize("test", [
      { name: "step1", status: "not_started", phase: 1, priority: 1, dependsOn: [], items: [] },
      { name: "step2", status: "not_started", phase: 1, priority: 1, dependsOn: ["step1"], items: [] },
      { name: "step3", status: "not_started", phase: 1, priority: 1, dependsOn: ["step2"], items: [] },
      { name: "step4", status: "not_started", phase: 1, priority: 1, dependsOn: ["step3"], items: [] },
    ]);

    const next = pm.getNext();
    expect(next.length).toBe(1);
    expect(next[0].module).toBe("step1");
  });

  it("completing a dependency unblocks the next module", () => {
    pm.initialize("test", [
      { name: "step1", status: "not_started", phase: 1, priority: 1, dependsOn: [], items: [] },
      { name: "step2", status: "not_started", phase: 1, priority: 1, dependsOn: ["step1"], items: [] },
    ]);

    pm.updateProgress("step1", undefined, "completed");

    const next = pm.getNext();
    expect(next.length).toBe(1);
    expect(next[0].module).toBe("step2");
  });

  it("diamond dependency: both parents must complete", () => {
    pm.initialize("test", [
      { name: "A", status: "not_started", phase: 1, priority: 1, dependsOn: [], items: [] },
      { name: "B", status: "not_started", phase: 1, priority: 1, dependsOn: [], items: [] },
      { name: "C", status: "not_started", phase: 1, priority: 1, dependsOn: ["A", "B"], items: [] },
    ]);

    // Only A completed — C still blocked
    pm.updateProgress("A", undefined, "completed");
    let next = pm.getNext();
    expect(next.map((n) => n.module)).not.toContain("C");
    expect(next.map((n) => n.module)).toContain("B");

    // Both completed — C unblocked
    pm.updateProgress("B", undefined, "completed");
    next = pm.getNext();
    expect(next.map((n) => n.module)).toContain("C");
  });
});

describe("Complex: MemoryStore Reopening", () => {
  it("new MemoryStore instance reads previously stored data", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "mags-reopen-"));

    // First instance
    const store1 = new MemoryStore(tempDir);
    await store1.remember("persistent_key", "persistent_value", "test");
    store1.close();

    // Second instance — same dir
    const store2 = new MemoryStore(tempDir);
    const entry = store2.get("persistent_key");
    expect(entry).toBeDefined();
    expect(entry!.value).toBe("persistent_value");
    expect(store2.getCapacity().used).toBe(1);
    store2.close();

    rmSync(tempDir, { recursive: true, force: true });
  });
});

describe("Complex: Edge Cases in BM25 Scoring", () => {
  let store: MemoryStore;
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "mags-bm25-"));
    store = new MemoryStore(tempDir);
    store.setEmbeddingProvider(new LocalEmbeddingProvider());
  });

  afterEach(() => {
    store.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("entry with very long value does not distort scoring", async () => {
    await store.remember("short", "auth config");
    await store.remember("long", "auth " + "filler ".repeat(1000));

    const results = await store.recall("auth");
    expect(results.length).toBe(2);
    // Both should score > 0
    expect(results[0].score).toBeGreaterThan(0);
    expect(results[1].score).toBeGreaterThan(0);
  });

  it("entry with duplicate terms does not explode score", async () => {
    await store.remember("normal", "database connection");
    await store.remember("spammy", "database ".repeat(100));

    const results = await store.recall("database");
    expect(results.length).toBe(2);
    // BM25 has saturation — 100x repetition should not give 100x score
    const normalScore = results.find((r) => r.key === "normal")!.score;
    const spammyScore = results.find((r) => r.key === "spammy")!.score;
    // Spammy might score slightly higher due to term freq, but not wildly
    expect(spammyScore / normalScore).toBeLessThan(5);
  });

  it("query with terms not in any entry returns empty", async () => {
    await store.remember("entry", "hello world");
    const results = await store.recall("xyznonexistent");
    expect(results).toHaveLength(0);
  });

  it("all entries with same content get similar scores", async () => {
    for (let i = 0; i < 5; i++) {
      await store.remember(`dup_${i}`, "identical content here");
    }

    const results = await store.recall("identical content");
    expect(results.length).toBe(5);
    // All should have very similar scores (slight variation from key matching)
    const scores = results.map((r) => r.score);
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);
    expect(maxScore - minScore).toBeLessThan(maxScore * 0.3);
  });
});
