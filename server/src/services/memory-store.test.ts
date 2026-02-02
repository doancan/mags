import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { MemoryStore } from "./memory-store.js";
import { LocalEmbeddingProvider } from "./embedding/local.js";
import type { EmbeddingProvider, MemoryEntry, ScoredMemory } from "../types/index.js";

function makeTmpDir(): string {
  const dir = join(tmpdir(), `mags-mem-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("MemoryStore", () => {
  let magsDir: string;

  beforeEach(() => {
    magsDir = makeTmpDir();
  });

  afterEach(() => {
    rmSync(magsDir, { recursive: true, force: true });
  });

  // ── Boş store ────────────────────────────────

  describe("boş store / ilk kullanım", () => {
    it("varolmayan dizinde load çalışır ve dizini oluşturur", () => {
      const store = new MemoryStore(join(magsDir, "new"));
      store.load();

      expect(store.getAll()).toEqual([]);
      expect(existsSync(join(magsDir, "new", "memory", "entries"))).toBe(true);
    });

    it("boş store'da recall boş döner", async () => {
      const store = new MemoryStore(magsDir);
      store.load();

      const results = await store.recall("anything");
      expect(results).toEqual([]);
    });

    it("boş store'da forget false döner", () => {
      const store = new MemoryStore(magsDir);
      store.load();

      expect(store.forget("nonexistent")).toBe(false);
    });

    it("boş store'da get undefined döner", () => {
      const store = new MemoryStore(magsDir);
      store.load();

      expect(store.get("nonexistent")).toBeUndefined();
    });
  });

  // ── CRUD işlemleri ───────────────────────────

  describe("CRUD işlemleri", () => {
    it("remember ile kayıt oluşturur", async () => {
      const store = new MemoryStore(magsDir);
      store.load();

      const entry = await store.remember("auth_strategy", "JWT with refresh tokens", "decisions", ["auth", "security"]);

      expect(entry.key).toBe("auth_strategy");
      expect(entry.value).toBe("JWT with refresh tokens");
      expect(entry.category).toBe("decisions");
      expect(entry.tags).toEqual(["auth", "security"]);
      expect(entry.id).toBeTruthy();
      expect(entry.createdAt).toBeTruthy();
    });

    it("aynı key ile günceller, id korur", async () => {
      const store = new MemoryStore(magsDir);
      store.load();

      const first = await store.remember("db_choice", "PostgreSQL");
      const firstId = first.id;
      const firstCreated = first.createdAt;

      const second = await store.remember("db_choice", "PostgreSQL with PgBouncer");

      expect(second.id).toBe(firstId);
      expect(second.createdAt).toBe(firstCreated);
      expect(second.value).toBe("PostgreSQL with PgBouncer");
    });

    it("get ile kayıt getirir", async () => {
      const store = new MemoryStore(magsDir);
      store.load();

      await store.remember("test_key", "test_value");
      const entry = store.get("test_key");

      expect(entry).toBeTruthy();
      expect(entry?.value).toBe("test_value");
    });

    it("forget ile siler ve dosyayı da temizler", async () => {
      const store = new MemoryStore(magsDir);
      store.load();

      const entry = await store.remember("to_delete", "will be deleted");
      const filePath = join(magsDir, "memory", "entries", `${entry.id}.yaml`);

      expect(existsSync(filePath)).toBe(true);

      const result = store.forget("to_delete");
      expect(result).toBe(true);
      expect(store.get("to_delete")).toBeUndefined();
      expect(existsSync(filePath)).toBe(false);
    });

    it("getAll tüm kayıtları döner", async () => {
      const store = new MemoryStore(magsDir);
      store.load();

      await store.remember("key1", "val1");
      await store.remember("key2", "val2");
      await store.remember("key3", "val3");

      expect(store.getAll()).toHaveLength(3);
    });
  });

  // ── Persistence (disk'e yazma/okuma) ─────────

  describe("persistence", () => {
    it("kayıtlar YAML dosyası olarak persist edilir", async () => {
      const store = new MemoryStore(magsDir);
      store.load();

      await store.remember("persist_test", "should survive reload");

      // Yeni store instance ile yükle
      const store2 = new MemoryStore(magsDir);
      store2.load();

      const entry = store2.get("persist_test");
      expect(entry).toBeTruthy();
      expect(entry?.value).toBe("should survive reload");
    });

    it("embedding persist edilmez (dosya boyutu)", async () => {
      const store = new MemoryStore(magsDir);
      store.load();
      store.setEmbeddingProvider(new LocalEmbeddingProvider());

      await store.remember("with_embed", "has embedding");

      // Yeni store instance — embedding yok
      const store2 = new MemoryStore(magsDir);
      store2.load();

      const entry = store2.get("with_embed");
      expect(entry?.embedding).toBeUndefined();
    });

    it("corrupted YAML dosyasını sessizce atlar", async () => {
      const store = new MemoryStore(magsDir);
      store.load();

      await store.remember("good_entry", "this is fine");

      // Corrupted dosya yaz
      const entriesDir = join(magsDir, "memory", "entries");
      writeFileSync(join(entriesDir, "corrupted.yaml"), "{{{{INVALID YAML", "utf-8");

      // Yeni load — crash etmemeli
      const store2 = new MemoryStore(magsDir);
      store2.load();

      expect(store2.getAll().length).toBeGreaterThanOrEqual(1);
      expect(store2.get("good_entry")).toBeTruthy();
    });

    it("id ve key olmayan dosyaları atlar", async () => {
      const store = new MemoryStore(magsDir);
      store.load();

      const entriesDir = join(magsDir, "memory", "entries");
      writeFileSync(
        join(entriesDir, "nokey.yaml"),
        "value: something\ncategory: notes\n",
        "utf-8"
      );

      store.load();
      expect(store.getAll()).toEqual([]);
    });
  });

  // ── Memory limit ─────────────────────────────

  describe("memory limit", () => {
    it("1000 kayıt limitine ulaşınca hata verir", async () => {
      const store = new MemoryStore(magsDir);
      store.load();

      // 1000 kayıt ekle (gerçek dosya yazmadan mock ile)
      // Entries map'ini doldurmak için direkt remember kullanılır
      // Ama 1000 dosya yazmak yavaş olur, Map'i dolduralım
      const entriesMap = (store as any).entries as Map<string, MemoryEntry>;
      for (let i = 0; i < 1000; i++) {
        entriesMap.set(`key-${i}`, {
          id: randomUUID(),
          key: `key-${i}`,
          value: `value-${i}`,
          tags: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      await expect(
        store.remember("overflow_key", "should fail")
      ).rejects.toThrow("Memory limit reached");
    });

    it("mevcut key güncelleme limit'i aşmaz", async () => {
      const store = new MemoryStore(magsDir);
      store.load();

      const entriesMap = (store as any).entries as Map<string, MemoryEntry>;
      for (let i = 0; i < 1000; i++) {
        entriesMap.set(`key-${i}`, {
          id: randomUUID(),
          key: `key-${i}`,
          value: `value-${i}`,
          tags: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      // Mevcut key güncelleme çalışmalı
      await expect(
        store.remember("key-0", "updated value")
      ).resolves.toBeTruthy();
    });
  });

  // ── Keyword search ───────────────────────────

  describe("keyword search", () => {
    let store: MemoryStore;

    beforeEach(async () => {
      store = new MemoryStore(magsDir);
      store.load();
      // Embedding provider KOYMUYORUZ → keyword search kullanılacak

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
      // auth_strategy key'inde "auth" geçiyor → boost almalı
      expect(results[0].key).toBe("auth_strategy");
    });

    it("tag match boost çalışır", async () => {
      const results = await store.recall("jwt");
      expect(results[0].key).toBe("auth_strategy");
    });

    it("category ile filtreler", async () => {
      const results = await store.recall("auth", "conventions");
      // decisions kategorisindeki auth_strategy filtrelenmeli
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
      // "a" 1 karakter → filtre uygulanır, queryTerms boş olur
      // Bölme sonucu 0 — tüm skorlar 0/0 = NaN olabilir
      // Bu davranışı test edelim
      expect(results).toEqual([]);
    });
  });

  // ── BM25 / LocalEmbeddingProvider ile search ─

  describe("BM25 search (LocalEmbeddingProvider)", () => {
    let store: MemoryStore;

    beforeEach(async () => {
      store = new MemoryStore(magsDir);
      store.load();
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
      // Skor diğerlerinden yüksek olmalı
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

  // ── Çok kayıt senaryosu ──────────────────────

  describe("çok kayıt senaryosu", () => {
    it("100 kayıt ile sorunsuz çalışır", async () => {
      const store = new MemoryStore(magsDir);
      store.load();

      for (let i = 0; i < 100; i++) {
        await store.remember(
          `key-${i}`,
          `Value for entry ${i} with unique content word-${i}`,
          i % 2 === 0 ? "decisions" : "notes",
          [`tag-${i % 10}`]
        );
      }

      expect(store.getAll()).toHaveLength(100);

      // Arama çalışmalı
      const results = await store.recall("word-42");
      expect(results.length).toBeGreaterThan(0);

      // Kategori filtresi çalışmalı
      const decisions = await store.recall("entry", "decisions");
      for (const r of decisions) {
        expect(r.category).toBe("decisions");
      }
    });
  });
});
