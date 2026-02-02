import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import YAML from "yaml";
import { MemoryStore } from "./memory-store.js";
import { LocalEmbeddingProvider } from "./embedding/local.js";
import type { MemoryEntry } from "../types/index.js";

function makeTmpDir(): string {
  const dir = join(tmpdir(), `mags-mem-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("MemoryStore", () => {
  let magsDir: string;
  let store: MemoryStore;

  beforeEach(() => {
    magsDir = makeTmpDir();
  });

  afterEach(() => {
    try { store?.close(); } catch {}
    rmSync(magsDir, { recursive: true, force: true });
  });

  // ── Boş store ────────────────────────────────

  describe("boş store / ilk kullanım", () => {
    it("varolmayan dizinde constructor çalışır ve dizini oluşturur", () => {
      store = new MemoryStore(join(magsDir, "new"));
      expect(store.getAll()).toEqual([]);
      expect(existsSync(join(magsDir, "new", "memory", "memories.db"))).toBe(true);
    });

    it("boş store'da recall boş döner", async () => {
      store = new MemoryStore(magsDir);
      const results = await store.recall("anything");
      expect(results).toEqual([]);
    });

    it("boş store'da forget false döner", () => {
      store = new MemoryStore(magsDir);
      expect(store.forget("nonexistent")).toBe(false);
    });

    it("boş store'da get undefined döner", () => {
      store = new MemoryStore(magsDir);
      expect(store.get("nonexistent")).toBeUndefined();
    });
  });

  // ── CRUD işlemleri ───────────────────────────

  describe("CRUD işlemleri", () => {
    it("remember ile kayıt oluşturur", async () => {
      store = new MemoryStore(magsDir);
      const entry = await store.remember("auth_strategy", "JWT with refresh tokens", "decisions", ["auth", "security"]);

      expect(entry.key).toBe("auth_strategy");
      expect(entry.value).toBe("JWT with refresh tokens");
      expect(entry.category).toBe("decisions");
      expect(entry.tags).toEqual(["auth", "security"]);
      expect(entry.id).toBeTruthy();
      expect(entry.createdAt).toBeTruthy();
    });

    it("aynı key ile günceller, id korur", async () => {
      store = new MemoryStore(magsDir);

      const first = await store.remember("db_choice", "PostgreSQL");
      const firstId = first.id;
      const firstCreated = first.createdAt;

      const second = await store.remember("db_choice", "PostgreSQL with PgBouncer");

      expect(second.id).toBe(firstId);
      expect(second.createdAt).toBe(firstCreated);
      expect(second.value).toBe("PostgreSQL with PgBouncer");
    });

    it("get ile kayıt getirir", async () => {
      store = new MemoryStore(magsDir);

      await store.remember("test_key", "test_value");
      const entry = store.get("test_key");

      expect(entry).toBeTruthy();
      expect(entry?.value).toBe("test_value");
    });

    it("forget ile siler", async () => {
      store = new MemoryStore(magsDir);

      await store.remember("to_delete", "will be deleted");

      const result = store.forget("to_delete");
      expect(result).toBe(true);
      expect(store.get("to_delete")).toBeUndefined();
    });

    it("getAll tüm kayıtları döner", async () => {
      store = new MemoryStore(magsDir);

      await store.remember("key1", "val1");
      await store.remember("key2", "val2");
      await store.remember("key3", "val3");

      expect(store.getAll()).toHaveLength(3);
    });
  });

  // ── Metadata ─────────────────────────────────

  describe("metadata desteği", () => {
    it("metadata ile kayıt oluşturur", async () => {
      store = new MemoryStore(magsDir);

      const entry = await store.remember(
        "auth_decision",
        "JWT chosen",
        "decisions",
        ["auth"],
        { alternatives: ["session", "oauth"], reason: "SPA uyumlu" }
      );

      expect(entry.metadata).toEqual({
        alternatives: ["session", "oauth"],
        reason: "SPA uyumlu",
      });
    });

    it("metadata persist edilir", async () => {
      store = new MemoryStore(magsDir);

      await store.remember("meta_test", "val", "notes", [], {
        source: "meeting",
        priority: 1,
      });
      store.close();

      const store2 = new MemoryStore(magsDir);
      store = store2; // for cleanup
      const entry = store2.get("meta_test");
      expect(entry?.metadata).toEqual({ source: "meeting", priority: 1 });
    });

    it("metadata olmadan kayıt → metadata undefined", async () => {
      store = new MemoryStore(magsDir);

      const entry = await store.remember("no_meta", "val");
      expect(entry.metadata).toBeUndefined();
    });

    it("metadata güncelleme", async () => {
      store = new MemoryStore(magsDir);

      await store.remember("updatable", "v1", "notes", [], { version: 1 });
      await store.remember("updatable", "v2", undefined, [], { version: 2, extra: "new" });

      const entry = store.get("updatable");
      expect(entry?.metadata).toEqual({ version: 2, extra: "new" });
      expect(entry?.value).toBe("v2");
    });
  });

  // ── Persistence (SQLite) ─────────────────────

  describe("persistence", () => {
    it("kayıtlar SQLite'da persist edilir", async () => {
      store = new MemoryStore(magsDir);
      await store.remember("persist_test", "should survive reload");
      store.close();

      const store2 = new MemoryStore(magsDir);
      store = store2;
      const entry = store2.get("persist_test");
      expect(entry).toBeTruthy();
      expect(entry?.value).toBe("should survive reload");
    });

    it("embedding persist edilmez (runtime only)", async () => {
      store = new MemoryStore(magsDir);
      store.setEmbeddingProvider(new LocalEmbeddingProvider());

      await store.remember("with_embed", "has embedding");
      store.close();

      const store2 = new MemoryStore(magsDir);
      store = store2;
      const entry = store2.get("with_embed");
      expect(entry?.embedding).toBeUndefined();
    });
  });

  // ── YAML Migration ──────────────────────────

  describe("YAML migrasyon", () => {
    it("YAML dosyalarından SQLite'a migre eder", async () => {
      // YAML entries dizini oluştur
      const entriesDir = join(magsDir, "memory", "entries");
      mkdirSync(entriesDir, { recursive: true });

      const yamlEntry = {
        id: randomUUID(),
        key: "legacy_key",
        value: "legacy_value",
        category: "decisions",
        tags: ["old"],
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
      };
      writeFileSync(
        join(entriesDir, `${yamlEntry.id}.yaml`),
        YAML.stringify(yamlEntry),
        "utf-8"
      );

      // Store oluştur — migrasyon constructor'da olacak
      store = new MemoryStore(magsDir);

      const entry = store.get("legacy_key");
      expect(entry).toBeTruthy();
      expect(entry?.value).toBe("legacy_value");
      expect(entry?.category).toBe("decisions");
      expect(entry?.tags).toEqual(["old"]);

      // entries dizini entries.bak olarak rename edilmeli
      expect(existsSync(join(magsDir, "memory", "entries.bak"))).toBe(true);
    });

    it("corrupted YAML dosyalarını migrasyon sırasında atlar", async () => {
      const entriesDir = join(magsDir, "memory", "entries");
      mkdirSync(entriesDir, { recursive: true });

      // Geçerli entry
      const good = { id: randomUUID(), key: "good", value: "works", tags: [], createdAt: "2025-01-01T00:00:00.000Z", updatedAt: "2025-01-01T00:00:00.000Z" };
      writeFileSync(join(entriesDir, `${good.id}.yaml`), YAML.stringify(good), "utf-8");

      // Corrupted entry
      writeFileSync(join(entriesDir, "bad.yaml"), "{{INVALID}}", "utf-8");

      store = new MemoryStore(magsDir);
      expect(store.get("good")).toBeTruthy();
      expect(store.getAll()).toHaveLength(1);
    });
  });

  // ── Memory limit ─────────────────────────────

  describe("memory limit", () => {
    it("1000 kayıt limitine ulaşınca hata verir", async () => {
      store = new MemoryStore(magsDir);

      // Bulk insert ile 1000 kayıt ekle
      for (let i = 0; i < 1000; i++) {
        await store.remember(`key-${i}`, `value-${i}`);
      }

      await expect(
        store.remember("overflow_key", "should fail")
      ).rejects.toThrow("Memory limit reached");
    });

    it("mevcut key güncelleme limit'i aşmaz", async () => {
      store = new MemoryStore(magsDir);

      for (let i = 0; i < 1000; i++) {
        await store.remember(`key-${i}`, `value-${i}`);
      }

      await expect(
        store.remember("key-0", "updated value")
      ).resolves.toBeTruthy();
    });
  });

  // ── Keyword search ───────────────────────────

  describe("keyword search", () => {
    beforeEach(async () => {
      store = new MemoryStore(magsDir);

      await store.remember("auth_strategy", "JWT tokens for authentication", "decisions", ["auth", "jwt"]);
      await store.remember("db_choice", "PostgreSQL with Prisma ORM", "decisions", ["database", "orm"]);
      await store.remember("ui_framework", "React with TanStack Query", "conventions", ["frontend", "react"]);
      await store.remember("api_pattern", "REST with OpenAPI spec", "conventions", ["api", "rest"]);
    });

    it("anahtar kelime ile arama yapar", async () => {
      const results = await store.recall("authentication");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].key).toBe("auth_strategy");
    });

    it("key match boost çalışır", async () => {
      const results = await store.recall("auth");
      expect(results[0].key).toBe("auth_strategy");
    });

    it("tag match boost çalışır", async () => {
      const results = await store.recall("jwt");
      expect(results[0].key).toBe("auth_strategy");
    });

    it("category ile filtreler", async () => {
      const results = await store.recall("auth", "conventions");
      const keys = results.map((r) => r.key);
      expect(keys).not.toContain("auth_strategy");
    });

    it("limit parametresi çalışır", async () => {
      const results = await store.recall("with", undefined, 2);
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it("eşleşme yoksa boş döner", async () => {
      const results = await store.recall("zzzznonexistent");
      expect(results).toEqual([]);
    });

    it("tek karakterli terimler filtrelenir", async () => {
      const results = await store.recall("a");
      expect(results).toEqual([]);
    });
  });

  // ── BM25 / LocalEmbeddingProvider ile search ─

  describe("BM25 search (LocalEmbeddingProvider)", () => {
    beforeEach(async () => {
      store = new MemoryStore(magsDir);
      store.setEmbeddingProvider(new LocalEmbeddingProvider());

      await store.remember("auth_strategy", "JWT tokens for user authentication and authorization", "decisions", ["auth"]);
      await store.remember("db_choice", "PostgreSQL database with Prisma ORM for data layer", "decisions", ["database"]);
      await store.remember("cache_strategy", "Redis for session cache and rate limiting", "decisions", ["cache"]);
    });

    it("BM25 ile ilgili sonuçlar döner", async () => {
      const results = await store.recall("authentication");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].key).toBe("auth_strategy");
    });

    it("exact key match 2x boost alır", async () => {
      const results = await store.recall("auth_strategy");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].key).toBe("auth_strategy");
      if (results.length > 1) {
        expect(results[0].score).toBeGreaterThan(results[1].score);
      }
    });

    it("boş query veya boş entries boş döner", async () => {
      const provider = new LocalEmbeddingProvider();
      const results = await provider.search("", [], 10);
      expect(results).toEqual([]);
    });
  });

  // ── Serbest kategori ─────────────────────────

  describe("serbest kategori", () => {
    it("özel kategori kullanılabilir", async () => {
      store = new MemoryStore(magsDir);

      await store.remember("k1", "v1", "my-custom-category");
      const entry = store.get("k1");
      expect(entry?.category).toBe("my-custom-category");
    });

    it("özel kategori ile filtreleme çalışır", async () => {
      store = new MemoryStore(magsDir);

      await store.remember("k1", "v1", "infra");
      await store.remember("k2", "v2", "design");

      const results = await store.recall("", "infra");
      expect(results).toHaveLength(1);
      expect(results[0].key).toBe("k1");
    });
  });

  // ── Çok kayıt senaryosu ──────────────────────

  describe("çok kayıt senaryosu", () => {
    it("100 kayıt ile sorunsuz çalışır", async () => {
      store = new MemoryStore(magsDir);

      for (let i = 0; i < 100; i++) {
        await store.remember(
          `key-${i}`,
          `Value for entry ${i} with unique content word-${i}`,
          i % 2 === 0 ? "decisions" : "notes",
          [`tag-${i % 10}`]
        );
      }

      expect(store.getAll()).toHaveLength(100);

      const results = await store.recall("word-42");
      expect(results.length).toBeGreaterThan(0);

      const decisions = await store.recall("entry", "decisions");
      for (const r of decisions) {
        expect(r.category).toBe("decisions");
      }
    });
  });

  // ── load() backward compat ───────────────────

  describe("load() backward compatibility", () => {
    it("load() no-op olarak çalışır, hata vermez", () => {
      store = new MemoryStore(magsDir);
      expect(() => store.load()).not.toThrow();
    });
  });

  // ── close() ──────────────────────────────────

  describe("close()", () => {
    it("close() sonrası DB operasyonları hata verir", () => {
      store = new MemoryStore(magsDir);
      store.close();
      expect(() => store.getAll()).toThrow();
      // Re-open for cleanup
      store = new MemoryStore(magsDir);
    });
  });
});
