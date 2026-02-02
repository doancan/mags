import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  readdirSync,
  chmodSync,
  cpSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync, execFileSync } from "node:child_process";
import { MemoryStore } from "../server/src/services/memory-store.js";
import { LocalEmbeddingProvider } from "../server/src/services/embedding/local.js";

// ═══════════════════════════════════════════════════
// Plugin Installation & Upgrade Tests
// Ensures users have a smooth first-install and
// version upgrade experience.
// ═══════════════════════════════════════════════════

const PROJECT_ROOT = join(import.meta.dirname, "..");
const SERVER_DIR = join(PROJECT_ROOT, "server");
const START_SCRIPT = join(SERVER_DIR, "start.sh");
const BUNDLE_PATH = join(SERVER_DIR, "dist", "mags-server.bundle.mjs");
const PLUGIN_JSON = join(PROJECT_ROOT, ".claude-plugin", "plugin.json");
const MARKETPLACE_JSON = join(PROJECT_ROOT, ".claude-plugin", "marketplace.json");

// ── Plugin Manifest Integrity ──────────────────────

describe("plugin manifest integrity", () => {
  it("plugin.json is valid JSON", () => {
    const raw = readFileSync(PLUGIN_JSON, "utf-8");
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it("marketplace.json is valid JSON", () => {
    const raw = readFileSync(MARKETPLACE_JSON, "utf-8");
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it("plugin.json and marketplace.json have matching versions", () => {
    const plugin = JSON.parse(readFileSync(PLUGIN_JSON, "utf-8"));
    const marketplace = JSON.parse(readFileSync(MARKETPLACE_JSON, "utf-8"));
    expect(plugin.version).toBe(marketplace.plugins[0].version);
  });

  it("plugin.json version matches server/package.json version", () => {
    const plugin = JSON.parse(readFileSync(PLUGIN_JSON, "utf-8"));
    const serverPkg = JSON.parse(readFileSync(join(SERVER_DIR, "package.json"), "utf-8"));
    expect(plugin.version).toBe(serverPkg.version);
  });

  it("plugin.json version matches root package.json version", () => {
    const plugin = JSON.parse(readFileSync(PLUGIN_JSON, "utf-8"));
    const rootPkg = JSON.parse(readFileSync(join(PROJECT_ROOT, "package.json"), "utf-8"));
    expect(plugin.version).toBe(rootPkg.version);
  });

  it("plugin.json mcpServers command points to start.sh", () => {
    const plugin = JSON.parse(readFileSync(PLUGIN_JSON, "utf-8"));
    const cmd = plugin.mcpServers?.mags?.command;
    expect(cmd).toBe("${CLAUDE_PLUGIN_ROOT}/server/start.sh");
  });

  it("start.sh exists and is executable", () => {
    expect(existsSync(START_SCRIPT)).toBe(true);
    // Check executable bit
    const stat = execSync(`stat -f %Lp "${START_SCRIPT}" 2>/dev/null || stat -c %a "${START_SCRIPT}" 2>/dev/null`, {
      encoding: "utf-8",
    }).trim();
    // Should have at least user execute (1xx or x7x or xx5)
    const mode = parseInt(stat, 8);
    expect(mode & 0o111).toBeGreaterThan(0);
  });

  it("bundle file exists", () => {
    expect(existsSync(BUNDLE_PATH)).toBe(true);
  });

  it("marketplace.json has required fields", () => {
    const marketplace = JSON.parse(readFileSync(MARKETPLACE_JSON, "utf-8"));
    expect(marketplace.name).toBeDefined();
    expect(marketplace.plugins).toBeInstanceOf(Array);
    expect(marketplace.plugins.length).toBeGreaterThan(0);

    const plugin = marketplace.plugins[0];
    expect(plugin.name).toBe("mags");
    expect(plugin.version).toBeDefined();
    expect(plugin.source).toBeDefined();
    expect(plugin.source.url).toContain("github.com");
  });
});

// ── start.sh Behavior ──────────────────────────────

describe("start.sh behavior", () => {
  let cacheDir: string;

  function createFakeCache() {
    cacheDir = mkdtempSync(join(tmpdir(), "mags-cache-"));
    // Copy essential files that start.sh needs
    cpSync(join(SERVER_DIR, "dist"), join(cacheDir, "dist"), { recursive: true });
    cpSync(join(SERVER_DIR, "package.json"), join(cacheDir, "package.json"));
    cpSync(join(SERVER_DIR, "package-lock.json"), join(cacheDir, "package-lock.json"));
    cpSync(START_SCRIPT, join(cacheDir, "start.sh"));
    chmodSync(join(cacheDir, "start.sh"), 0o755);
    return cacheDir;
  }

  afterEach(() => {
    if (cacheDir && existsSync(cacheDir)) {
      rmSync(cacheDir, { recursive: true, force: true });
    }
  });

  it("fresh install: auto-installs better-sqlite3 when node_modules missing", () => {
    createFakeCache();

    // No node_modules — should auto-install
    expect(existsSync(join(cacheDir, "node_modules"))).toBe(false);

    // Run start.sh with a timeout (it starts an MCP server, so we kill it)
    try {
      execFileSync("bash", ["-c", `
        "${cacheDir}/start.sh" &
        PID=$!
        sleep 5
        kill $PID 2>/dev/null
        wait $PID 2>/dev/null
        exit 0
      `], { timeout: 30000, stdio: "pipe" });
    } catch {
      // Process killed — expected
    }

    // Verify better-sqlite3 was installed
    expect(existsSync(join(cacheDir, "node_modules", "better-sqlite3"))).toBe(true);
  }, 30000);

  it("second run: skips install when node_modules already present", () => {
    createFakeCache();

    // Pre-install dependencies
    execSync("npm install --production --no-audit --no-fund --loglevel=error", {
      cwd: cacheDir,
      stdio: "pipe",
      timeout: 30000,
    });

    expect(existsSync(join(cacheDir, "node_modules", "better-sqlite3"))).toBe(true);

    // Place a marker file inside node_modules — if npm install runs, it would
    // wipe/recreate the directory and our marker would disappear.
    const markerPath = join(cacheDir, "node_modules", ".mags-test-marker");
    writeFileSync(markerPath, "skip-test");

    // Run start.sh again
    let stderr = "";
    try {
      const result = execFileSync("bash", ["-c", `
        "${cacheDir}/start.sh" &
        PID=$!
        sleep 2
        kill $PID 2>/dev/null
        wait $PID 2>/dev/null
        exit 0
      `], { timeout: 15000, stdio: "pipe" });
      stderr = result.toString();
    } catch (e: any) {
      stderr = e.stderr?.toString() ?? "";
    }

    // Marker file should still exist (npm install was NOT triggered)
    expect(existsSync(markerPath)).toBe(true);
    // The marker content should be intact (not overwritten)
    expect(readFileSync(markerPath, "utf-8")).toBe("skip-test");
  }, 45000);

  it("corrupted install: recovers when better-sqlite3 dir exists but binary missing", () => {
    createFakeCache();

    // Create a fake corrupted better-sqlite3 (dir exists but no binary)
    mkdirSync(join(cacheDir, "node_modules", "better-sqlite3"), { recursive: true });
    writeFileSync(join(cacheDir, "node_modules", "better-sqlite3", "package.json"), "{}");

    // Run start.sh — should detect corruption and reinstall
    try {
      execFileSync("bash", ["-c", `
        "${cacheDir}/start.sh" &
        PID=$!
        sleep 5
        kill $PID 2>/dev/null
        wait $PID 2>/dev/null
        exit 0
      `], { timeout: 30000, stdio: "pipe" });
    } catch {
      // Process killed — expected
    }

    // Should have recovered — real binary now exists
    const hasNative = existsSync(join(cacheDir, "node_modules", "better-sqlite3", "build")) ||
      existsSync(join(cacheDir, "node_modules", "better-sqlite3", "prebuilds"));
    expect(hasNative).toBe(true);
  }, 30000);
});

// ── YAML → SQLite Migration (v0.1.0 → v0.2.0) ────

describe("YAML to SQLite migration", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "mags-migrate-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("migrates v0.1.0 YAML entries to SQLite on first open", () => {
    // Simulate v0.1.0 memory layout
    const memoryDir = join(tempDir, "memory");
    const entriesDir = join(memoryDir, "entries");
    mkdirSync(entriesDir, { recursive: true });

    // Create fake v0.1.0 YAML entries
    writeFileSync(join(entriesDir, "auth_strategy.yaml"), `
id: "uuid-001"
key: "auth_strategy"
value: "Use JWT tokens"
category: "decisions"
tags:
  - "auth"
createdAt: "2026-01-15T10:00:00.000Z"
updatedAt: "2026-01-15T10:00:00.000Z"
`);

    writeFileSync(join(entriesDir, "db_choice.yaml"), `
id: "uuid-002"
key: "db_choice"
value: "PostgreSQL"
category: "decisions"
tags:
  - "database"
createdAt: "2026-01-16T10:00:00.000Z"
updatedAt: "2026-01-16T10:00:00.000Z"
`);

    // Open MemoryStore (v0.2.0) — should auto-migrate
    const store = new MemoryStore(tempDir);

    // Verify migration
    const auth = store.get("auth_strategy");
    expect(auth).toBeDefined();
    expect(auth!.value).toBe("Use JWT tokens");
    expect(auth!.category).toBe("decisions");
    expect(auth!.tags).toContain("auth");

    const db = store.get("db_choice");
    expect(db).toBeDefined();
    expect(db!.value).toBe("PostgreSQL");

    expect(store.getCapacity().used).toBe(2);

    // Original YAML dir should be renamed to .bak
    expect(existsSync(entriesDir)).toBe(false);
    expect(existsSync(join(memoryDir, "entries.bak"))).toBe(true);

    store.close();
  });

  it("skips migration if SQLite already has data", () => {
    const memoryDir = join(tempDir, "memory");
    const entriesDir = join(memoryDir, "entries");
    mkdirSync(entriesDir, { recursive: true });

    // Create a YAML entry
    writeFileSync(join(entriesDir, "old_entry.yaml"), `
id: "uuid-old"
key: "old_entry"
value: "from yaml"
createdAt: "2026-01-01T00:00:00.000Z"
updatedAt: "2026-01-01T00:00:00.000Z"
`);

    // First open — migrates
    const store1 = new MemoryStore(tempDir);
    expect(store1.getCapacity().used).toBe(1);
    store1.close();

    // Simulate someone putting YAML back (shouldn't happen but test robustness)
    const entriesDir2 = join(memoryDir, "entries");
    if (!existsSync(entriesDir2)) {
      mkdirSync(entriesDir2, { recursive: true });
    }
    writeFileSync(join(entriesDir2, "new_entry.yaml"), `
id: "uuid-new"
key: "new_entry"
value: "should not migrate"
createdAt: "2026-02-01T00:00:00.000Z"
updatedAt: "2026-02-01T00:00:00.000Z"
`);

    // Second open — DB not empty, should skip YAML migration
    const store2 = new MemoryStore(tempDir);
    expect(store2.get("old_entry")).toBeDefined();
    expect(store2.get("new_entry")).toBeUndefined(); // NOT migrated
    expect(store2.getCapacity().used).toBe(1);
    store2.close();
  });

  it("handles corrupted YAML files gracefully during migration", () => {
    const memoryDir = join(tempDir, "memory");
    const entriesDir = join(memoryDir, "entries");
    mkdirSync(entriesDir, { recursive: true });

    // Valid entry
    writeFileSync(join(entriesDir, "good.yaml"), `
id: "uuid-good"
key: "good_entry"
value: "valid"
createdAt: "2026-01-01T00:00:00.000Z"
updatedAt: "2026-01-01T00:00:00.000Z"
`);

    // Corrupted YAML
    writeFileSync(join(entriesDir, "bad.yaml"), `
{{{not valid yaml at all!!!
`);

    // Missing required fields
    writeFileSync(join(entriesDir, "incomplete.yaml"), `
value: "no id or key"
`);

    const store = new MemoryStore(tempDir);
    // Only the valid entry should be migrated
    expect(store.getCapacity().used).toBe(1);
    expect(store.get("good_entry")).toBeDefined();
    store.close();
  });

  it("preserves metadata and tags during migration", () => {
    const memoryDir = join(tempDir, "memory");
    const entriesDir = join(memoryDir, "entries");
    mkdirSync(entriesDir, { recursive: true });

    writeFileSync(join(entriesDir, "rich.yaml"), `
id: "uuid-rich"
key: "rich_entry"
value: "complex value"
category: "conventions"
tags:
  - "frontend"
  - "react"
  - "typescript"
metadata:
  reason: "team consensus"
  alternatives:
    - "Vue"
    - "Svelte"
createdAt: "2026-01-20T10:00:00.000Z"
updatedAt: "2026-01-25T10:00:00.000Z"
`);

    const store = new MemoryStore(tempDir);
    const entry = store.get("rich_entry");
    expect(entry).toBeDefined();
    expect(entry!.category).toBe("conventions");
    expect(entry!.tags).toEqual(["frontend", "react", "typescript"]);
    expect(entry!.metadata).toBeDefined();
    expect(entry!.metadata!.reason).toBe("team consensus");
    expect((entry!.metadata!.alternatives as string[])).toContain("Vue");
    expect(entry!.createdAt).toBe("2026-01-20T10:00:00.000Z");
    expect(entry!.updatedAt).toBe("2026-01-25T10:00:00.000Z");
    store.close();
  });
});

// ── Data Persistence Across Reopens ────────────────

describe("data persistence across reopens (simulates upgrade)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "mags-persist-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("data survives close and reopen", async () => {
    const store1 = new MemoryStore(tempDir);
    store1.setEmbeddingProvider(new LocalEmbeddingProvider());

    await store1.remember("key1", "value1", "decisions", ["tag1"]);
    await store1.remember("key2", "value2", "notes");
    store1.close();

    const store2 = new MemoryStore(tempDir);
    store2.setEmbeddingProvider(new LocalEmbeddingProvider());

    expect(store2.get("key1")!.value).toBe("value1");
    expect(store2.get("key1")!.category).toBe("decisions");
    expect(store2.get("key1")!.tags).toEqual(["tag1"]);
    expect(store2.get("key2")!.value).toBe("value2");
    expect(store2.getCapacity().used).toBe(2);

    // Search still works
    const results = await store2.recall("value1", "decisions");
    expect(results.length).toBe(1);
    expect(results[0].key).toBe("key1");

    store2.close();
  });

  it("updates from session 1 visible in session 2", async () => {
    // Session 1: create and update
    const s1 = new MemoryStore(tempDir);
    await s1.remember("evolving", "v1", "decisions");
    await s1.remember("evolving", "v2", "decisions");
    s1.close();

    // Session 2: see the update
    const s2 = new MemoryStore(tempDir);
    const entry = s2.get("evolving");
    expect(entry!.value).toBe("v2");
    expect(s2.getCapacity().used).toBe(1); // upsert, not duplicate
    s2.close();
  });

  it("forget from session 1 reflected in session 2", async () => {
    const s1 = new MemoryStore(tempDir);
    await s1.remember("temp", "temporary data");
    await s1.remember("keep", "permanent data");
    s1.forget("temp");
    s1.close();

    const s2 = new MemoryStore(tempDir);
    expect(s2.get("temp")).toBeUndefined();
    expect(s2.get("keep")).toBeDefined();
    expect(s2.getCapacity().used).toBe(1);
    s2.close();
  });

  it("capacity near-limit state persists correctly", async () => {
    const s1 = new MemoryStore(tempDir);
    for (let i = 0; i < 100; i++) {
      await s1.remember(`entry_${i}`, `value_${i}`);
    }
    expect(s1.getCapacity().used).toBe(100);
    s1.close();

    const s2 = new MemoryStore(tempDir);
    expect(s2.getCapacity().used).toBe(100);
    // Can still add more
    await s2.remember("entry_100", "value_100");
    expect(s2.getCapacity().used).toBe(101);
    s2.close();
  });

  it("WAL mode survives reopen (no data loss from journal)", async () => {
    // Write a batch, close immediately
    const s1 = new MemoryStore(tempDir);
    for (let i = 0; i < 50; i++) {
      await s1.remember(`wal_${i}`, `data_${i}`);
    }
    s1.close();

    // Reopen and verify all entries
    const s2 = new MemoryStore(tempDir);
    for (let i = 0; i < 50; i++) {
      const entry = s2.get(`wal_${i}`);
      expect(entry).toBeDefined();
      expect(entry!.value).toBe(`data_${i}`);
    }
    expect(s2.getCapacity().used).toBe(50);
    s2.close();
  });
});

// ── Bundle Integrity ───────────────────────────────

describe("bundle integrity", () => {
  it("bundle file is non-empty", () => {
    const stat = readFileSync(BUNDLE_PATH);
    expect(stat.length).toBeGreaterThan(10000); // Bundle should be substantial
  });

  it("bundle starts with ESM createRequire shim", () => {
    const head = readFileSync(BUNDLE_PATH, "utf-8").slice(0, 200);
    expect(head).toContain("createRequire");
  });

  it("bundle references better-sqlite3 as external require", () => {
    const content = readFileSync(BUNDLE_PATH, "utf-8");
    expect(content).toContain("better-sqlite3");
  });

  it("bundle does NOT contain node_modules paths", () => {
    const content = readFileSync(BUNDLE_PATH, "utf-8");
    // Should not have hardcoded absolute paths
    expect(content).not.toContain("/Users/");
    expect(content).not.toContain("\\Users\\");
  });
});

// ── Plugin Directory Structure ─────────────────────

describe("plugin directory structure", () => {
  it("has required .claude-plugin directory", () => {
    expect(existsSync(join(PROJECT_ROOT, ".claude-plugin"))).toBe(true);
  });

  it("has skills directory at root level (not inside .claude-plugin)", () => {
    expect(existsSync(join(PROJECT_ROOT, "skills"))).toBe(true);
    // Verify skills are NOT inside .claude-plugin
    expect(existsSync(join(PROJECT_ROOT, ".claude-plugin", "skills"))).toBe(false);
  });

  it("has hooks directory at root level", () => {
    expect(existsSync(join(PROJECT_ROOT, "hooks"))).toBe(true);
  });

  it("hooks.json is valid JSON", () => {
    const hooksPath = join(PROJECT_ROOT, "hooks", "hooks.json");
    if (existsSync(hooksPath)) {
      const raw = readFileSync(hooksPath, "utf-8");
      expect(() => JSON.parse(raw)).not.toThrow();
    }
  });

  it("all skill directories have SKILL.md", () => {
    const skillsDir = join(PROJECT_ROOT, "skills");
    if (existsSync(skillsDir)) {
      const skills = readdirSync(skillsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory());

      for (const skill of skills) {
        const skillMd = join(skillsDir, skill.name, "SKILL.md");
        expect(existsSync(skillMd), `Missing SKILL.md in skills/${skill.name}`).toBe(true);
      }
    }
  });

  it("server/dist exists with bundle", () => {
    expect(existsSync(join(SERVER_DIR, "dist", "mags-server.bundle.mjs"))).toBe(true);
  });

  it("package-lock.json exists for reproducible installs", () => {
    expect(existsSync(join(SERVER_DIR, "package-lock.json"))).toBe(true);
  });
});

// ── Version Consistency ────────────────────────────

describe("version consistency across all files", () => {
  let version: string;

  it("all version sources agree", () => {
    const pluginVersion = JSON.parse(readFileSync(PLUGIN_JSON, "utf-8")).version;
    const marketplaceVersion = JSON.parse(readFileSync(MARKETPLACE_JSON, "utf-8")).plugins[0].version;
    const serverVersion = JSON.parse(readFileSync(join(SERVER_DIR, "package.json"), "utf-8")).version;
    const rootVersion = JSON.parse(readFileSync(join(PROJECT_ROOT, "package.json"), "utf-8")).version;

    version = pluginVersion;

    expect(marketplaceVersion).toBe(version);
    expect(serverVersion).toBe(version);
    expect(rootVersion).toBe(version);
  });

  it("version follows semver format", () => {
    const v = JSON.parse(readFileSync(PLUGIN_JSON, "utf-8")).version;
    expect(v).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
