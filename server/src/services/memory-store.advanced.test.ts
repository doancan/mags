/**
 * MemoryStore — Gelişmiş / Zorlu Senaryolar
 *
 * Normal testlerin kapsamadığı karmaşık durumlar:
 *
 * 1. Sınır değer analizi (boundary conditions)
 *    - Tam 999 kayıt → 1 daha ekleme → limit'te 1 daha ekleme
 *    - Boş string key/value sınırları
 *    - Tekil karakter key
 *
 * 2. YAML migrasyon karmaşık senaryolar
 *    - Aynı key'e sahip birden fazla YAML dosyası (duplicate)
 *    - Metadata'lı legacy YAML dosyaları
 *    - YAML'da farklı tarih formatları
 *
 * 3. Çoklu instance ve process simülasyonu
 *    - Ard arda open/remember/close/open/remember/close
 *    - Farklı embedding provider'lar arası geçiş
 *
 * 4. Arama kalitesi ve sıralama doğruluğu
 *    - Çok benzer kayıtlar arasında doğru sıralama
 *    - Multi-word query relevance
 *    - Keyword + BM25 tutarlılık karşılaştırması
 *    - Tag + key + value combined boosting
 *
 * 5. Veri bozulma senaryoları
 *    - DB'deki tags/metadata sütununda geçersiz JSON
 *    - Schema uyumsuzluğu (ek sütun)
 *
 * 6. Büyük ölçek senaryoları
 *    - 999 kayıt + güncelleme + silme + tekrar ekleme döngüsü
 *    - 500 entry'lik batch recall performansı
 *
 * 7. Metadata ile karmaşık CRUD akışları
 *    - Metadata varken value güncelleme
 *    - Metadata'yı boşaltma
 *    - Metadata ile arama ilişkisi (metadata aranmaz)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdirSync,
  writeFileSync,
  rmSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import YAML from "yaml";
import { MemoryStore } from "./memory-store.js";
import { LocalEmbeddingProvider } from "./embedding/local.js";

function tmp(): string {
  const d = join(tmpdir(), `mags-adv-${randomUUID()}`);
  mkdirSync(d, { recursive: true });
  return d;
}

describe("MemoryStore — Gelişmiş Senaryolar", () => {
  let dir: string;
  let store: MemoryStore;

  afterEach(() => {
    try { store?.close(); } catch {}
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  // ═════════════════════════════════════════════
  // 1. SINIR DEĞER ANALİZİ (BOUNDARY CONDITIONS)
  // ═════════════════════════════════════════════

  describe("sınır değer analizi", () => {
    beforeEach(() => { dir = tmp(); });

    it("tam 999 → 1000. kayıt başarılı → 1001. kayıt hata verir", async () => {
      store = new MemoryStore(dir);

      for (let i = 0; i < 999; i++) {
        await store.remember(`k-${i}`, `v-${i}`);
      }
      expect(store.getAll()).toHaveLength(999);

      // 1000. kayıt — tam sınırda, başarılı olmalı
      await expect(store.remember("k-999", "v-999")).resolves.toBeTruthy();
      expect(store.getAll()).toHaveLength(1000);

      // 1001. kayıt — hata vermeli
      await expect(store.remember("k-1000", "v-1000")).rejects.toThrow("Memory limit reached");
      expect(store.getAll()).toHaveLength(1000);
    });

    it("1000. kayıtta güncelleme hala çalışır", async () => {
      store = new MemoryStore(dir);

      for (let i = 0; i < 1000; i++) {
        await store.remember(`k-${i}`, `v-${i}`);
      }

      // Mevcut key güncelleme → limit aşılmaz
      const updated = await store.remember("k-500", "updated-500");
      expect(updated.value).toBe("updated-500");
      expect(store.getAll()).toHaveLength(1000);
    });

    it("1000 kayıt → 1 sil → 1 yeni ekle → tekrar 1000", async () => {
      store = new MemoryStore(dir);

      for (let i = 0; i < 1000; i++) {
        await store.remember(`k-${i}`, `v-${i}`);
      }

      store.forget("k-0");
      expect(store.getAll()).toHaveLength(999);

      await expect(store.remember("k-new", "new-value")).resolves.toBeTruthy();
      expect(store.getAll()).toHaveLength(1000);

      // Tekrar hata
      await expect(store.remember("k-another", "v")).rejects.toThrow("Memory limit reached");
    });

    it("tek karakter key çalışır", async () => {
      store = new MemoryStore(dir);
      await store.remember("x", "single char key");
      expect(store.get("x")?.value).toBe("single char key");
    });

    it("çok uzun key (2000 char) persist & recall edilir", async () => {
      store = new MemoryStore(dir);
      const longKey = "k".repeat(2000);
      await store.remember(longKey, "long key value");

      store.close();
      store = new MemoryStore(dir);
      expect(store.get(longKey)?.value).toBe("long key value");
    });

    it("value sadece whitespace", async () => {
      store = new MemoryStore(dir);
      await store.remember("ws_key", "   \t\n  ");

      const entry = store.get("ws_key");
      expect(entry?.value).toBe("   \t\n  ");
    });
  });

  // ═════════════════════════════════════════════
  // 2. YAML MİGRASYON KARMAŞIK SENARYOLAR
  // ═════════════════════════════════════════════

  describe("YAML migrasyon — karmaşık senaryolar", () => {
    it("aynı key'e sahip birden fazla YAML dosyası (son yazan kazanır)", async () => {
      dir = tmp();
      const entriesDir = join(dir, "memory", "entries");
      mkdirSync(entriesDir, { recursive: true });

      // İki dosya, aynı key
      const id1 = randomUUID();
      const id2 = randomUUID();
      writeFileSync(
        join(entriesDir, `${id1}.yaml`),
        YAML.stringify({ id: id1, key: "dup_key", value: "first", tags: [], createdAt: "2025-01-01T00:00:00.000Z", updatedAt: "2025-01-01T00:00:00.000Z" }),
        "utf-8"
      );
      writeFileSync(
        join(entriesDir, `${id2}.yaml`),
        YAML.stringify({ id: id2, key: "dup_key", value: "second", tags: [], createdAt: "2025-01-02T00:00:00.000Z", updatedAt: "2025-01-02T00:00:00.000Z" }),
        "utf-8"
      );

      store = new MemoryStore(dir);
      // UPSERT davranışı — biri kazanır, crash yok
      const entry = store.get("dup_key");
      expect(entry).toBeTruthy();
      expect(["first", "second"]).toContain(entry!.value);
      expect(store.getAll()).toHaveLength(1);
    });

    it("metadata'lı legacy YAML dosyaları migre olur", async () => {
      dir = tmp();
      const entriesDir = join(dir, "memory", "entries");
      mkdirSync(entriesDir, { recursive: true });

      const id = randomUUID();
      const legacyWithMeta = {
        id,
        key: "legacy_with_meta",
        value: "has metadata",
        category: "decisions",
        tags: ["old"],
        metadata: { alternatives: ["a", "b"], reason: "test" },
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
      };
      writeFileSync(join(entriesDir, `${id}.yaml`), YAML.stringify(legacyWithMeta), "utf-8");

      store = new MemoryStore(dir);
      const entry = store.get("legacy_with_meta");
      expect(entry?.metadata?.alternatives).toEqual(["a", "b"]);
      expect(entry?.metadata?.reason).toBe("test");
    });

    it("YAML'da farklı/eksik tarih formatları", async () => {
      dir = tmp();
      const entriesDir = join(dir, "memory", "entries");
      mkdirSync(entriesDir, { recursive: true });

      // Tarih alanı eksik
      const id = randomUUID();
      writeFileSync(
        join(entriesDir, `${id}.yaml`),
        YAML.stringify({ id, key: "no_dates", value: "no dates set", tags: [] }),
        "utf-8"
      );

      store = new MemoryStore(dir);
      const entry = store.get("no_dates");
      expect(entry).toBeTruthy();
      // Tarih alanları otomatik doldurulmuş olmalı
      expect(entry!.createdAt).toBeTruthy();
      expect(entry!.updatedAt).toBeTruthy();
    });

    it("boş entries dizini → migrasyon yapılmaz", async () => {
      dir = tmp();
      const entriesDir = join(dir, "memory", "entries");
      mkdirSync(entriesDir, { recursive: true });
      // Hiç .yaml dosyası yok

      store = new MemoryStore(dir);
      expect(store.getAll()).toHaveLength(0);
      // entries dizini rename edilmemeli (dosya yoktu)
      expect(existsSync(entriesDir)).toBe(true);
      expect(existsSync(join(dir, "memory", "entries.bak"))).toBe(false);
    });

    it("100 YAML dosyalı büyük migrasyon — hepsi aktarılır", async () => {
      dir = tmp();
      const entriesDir = join(dir, "memory", "entries");
      mkdirSync(entriesDir, { recursive: true });

      for (let i = 0; i < 100; i++) {
        const id = randomUUID();
        writeFileSync(
          join(entriesDir, `${id}.yaml`),
          YAML.stringify({
            id,
            key: `bulk_${i}`,
            value: `bulk value ${i}`,
            category: i % 3 === 0 ? "decisions" : "notes",
            tags: [`t${i % 5}`],
            createdAt: "2025-01-01T00:00:00.000Z",
            updatedAt: "2025-06-01T00:00:00.000Z",
          }),
          "utf-8"
        );
      }

      store = new MemoryStore(dir);
      expect(store.getAll()).toHaveLength(100);
      expect(existsSync(join(dir, "memory", "entries.bak"))).toBe(true);

      // Arama çalışıyor mu?
      const results = await store.recall("bulk value 42");
      expect(results.length).toBeGreaterThan(0);
    });
  });

  // ═════════════════════════════════════════════
  // 3. ÇOKLU INSTANCE VE PROCESS SİMÜLASYONU
  // ═════════════════════════════════════════════

  describe("çoklu instance ve process simülasyonu", () => {
    it("20 ardışık open/write/close cycle — veri bütünlüğü", async () => {
      dir = tmp();
      const expected = new Map<string, string>();

      for (let i = 0; i < 20; i++) {
        store = new MemoryStore(dir);
        const key = `session-${i}-key`;
        const value = `session-${i}-value-${randomUUID()}`;
        await store.remember(key, value, "notes");
        expected.set(key, value);
        store.close();
      }

      // Son instance ile hepsini doğrula
      store = new MemoryStore(dir);
      expect(store.getAll()).toHaveLength(20);

      for (const [key, value] of expected) {
        const entry = store.get(key);
        expect(entry?.value).toBe(value);
      }
    });

    it("embedding provider değişimi arasında veri korunur", async () => {
      dir = tmp();

      // Session 1: provider yok
      store = new MemoryStore(dir);
      await store.remember("early", "no provider");
      store.close();

      // Session 2: LocalEmbeddingProvider
      store = new MemoryStore(dir);
      store.setEmbeddingProvider(new LocalEmbeddingProvider());
      await store.remember("mid", "with local provider");
      const results = await store.recall("provider");
      expect(results.length).toBe(2); // both entries match "provider"
      store.close();

      // Session 3: yine provider yok
      store = new MemoryStore(dir);
      await store.remember("late", "back to no provider");
      expect(store.getAll()).toHaveLength(3);

      // Keyword search fallback çalışıyor mu?
      const kResults = await store.recall("provider");
      expect(kResults.length).toBeGreaterThan(0);
    });

    it("close() sonrası tüm operasyonlar hata verir", () => {
      dir = tmp();
      store = new MemoryStore(dir);
      store.close();

      expect(() => store.getAll()).toThrow();
      expect(() => store.get("x")).toThrow();
      expect(() => store.forget("x")).toThrow();

      // Cleanup için yeniden aç
      store = new MemoryStore(dir);
    });
  });

  // ═════════════════════════════════════════════
  // 4. ARAMA KALİTESİ VE SIRALAMA DOĞRULUĞU
  // ═════════════════════════════════════════════

  describe("arama kalitesi ve sıralama doğruluğu", () => {
    beforeEach(async () => {
      dir = tmp();
      store = new MemoryStore(dir);
    });

    it("key match > value match — key boost doğru çalışır", async () => {
      await store.remember("database_migration", "Steps for data transfer");
      await store.remember("server_setup", "Database migration instructions included");

      const results = await store.recall("database");
      expect(results[0].key).toBe("database_migration"); // key'de "database" var → boost
    });

    it("tag match boost ile daha ilgili sonuç üste çıkar", async () => {
      await store.remember("generic_note", "General information about auth", "notes", []);
      await store.remember("tagged_note", "Some information about security", "notes", ["auth"]);

      const results = await store.recall("auth");
      // Her ikisi de "auth" içerir ama tagged_note'un tag'ında "auth" var
      const tagged = results.find((r) => r.key === "tagged_note");
      const generic = results.find((r) => r.key === "generic_note");
      expect(tagged).toBeTruthy();
      expect(generic).toBeTruthy();
      expect(tagged!.score).toBeGreaterThanOrEqual(generic!.score);
    });

    it("çoklu terim query — tüm terimlere uyan kayıt daha yüksek skor alır", async () => {
      await store.remember("partial_match", "JWT is used for authentication");
      await store.remember("full_match", "JWT authentication with refresh tokens");
      await store.remember("no_match", "PostgreSQL database setup");

      const results = await store.recall("JWT authentication refresh");
      // full_match tüm terimleri içerir
      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results[0].key).toBe("full_match");
      // no_match listede olmamalı
      expect(results.map((r) => r.key)).not.toContain("no_match");
    });

    it("BM25 ile keyword search sonuçları tutarlı yönde", async () => {
      // Aynı veri, iki farklı search yöntemi
      await store.remember("jwt_auth", "JWT token based authentication strategy", "decisions", ["auth"]);
      await store.remember("session_auth", "Server-side session authentication", "decisions", ["auth"]);
      await store.remember("api_key_auth", "API key authentication for external services", "decisions", ["api"]);

      // Keyword search
      const kwResults = await store.recall("JWT token authentication");
      expect(kwResults[0].key).toBe("jwt_auth");

      // BM25 search
      store.setEmbeddingProvider(new LocalEmbeddingProvider());
      const bm25Results = await store.recall("JWT token authentication");
      expect(bm25Results[0].key).toBe("jwt_auth");
    });

    it("case-insensitive arama", async () => {
      await store.remember("CaseSensitive", "PostgreSQL Database", "notes", ["DB"]);

      const r1 = await store.recall("postgresql");
      expect(r1.length).toBeGreaterThan(0);

      const r2 = await store.recall("POSTGRESQL");
      expect(r2.length).toBeGreaterThan(0);

      const r3 = await store.recall("PostgreSQL");
      expect(r3.length).toBeGreaterThan(0);
    });

    it("category filter + keyword search birlikte çalışır", async () => {
      await store.remember("auth_dec", "JWT for auth", "decisions", ["auth"]);
      await store.remember("auth_conv", "Use Bearer tokens", "conventions", ["auth"]);
      await store.remember("db_dec", "PostgreSQL", "decisions", ["db"]);

      // decisions + auth
      const results = await store.recall("auth", "decisions");
      expect(results).toHaveLength(1);
      expect(results[0].key).toBe("auth_dec");
    });
  });

  // ═════════════════════════════════════════════
  // 5. VERİ BOZULMA SENARYOLARI
  // ═════════════════════════════════════════════

  describe("veri bozulma senaryoları", () => {
    it("DB'deki tags sütununda geçersiz JSON — graceful fallback", async () => {
      dir = tmp();
      store = new MemoryStore(dir);
      await store.remember("good_entry", "good value", "notes", ["tag1"]);

      // DB'ye direkt geçersiz JSON yaz
      const dbPath = join(dir, "memory", "memories.db");
      store.close();

      const db = new Database(dbPath);
      db.prepare("UPDATE memories SET tags = 'NOT_JSON' WHERE key = 'good_entry'").run();
      db.close();

      // Yeniden aç — crash etmemeli
      store = new MemoryStore(dir);
      const entry = store.get("good_entry");
      expect(entry).toBeTruthy();
      expect(entry!.value).toBe("good value");
      expect(entry!.tags).toEqual([]); // fallback to empty array
    });

    it("DB'deki metadata sütununda geçersiz JSON — graceful fallback", async () => {
      dir = tmp();
      store = new MemoryStore(dir);
      await store.remember("meta_entry", "value", "notes", [], { key: "val" });
      store.close();

      const dbPath = join(dir, "memory", "memories.db");
      const db = new Database(dbPath);
      db.prepare("UPDATE memories SET metadata = '{broken' WHERE key = 'meta_entry'").run();
      db.close();

      store = new MemoryStore(dir);
      const entry = store.get("meta_entry");
      expect(entry).toBeTruthy();
      expect(entry!.metadata).toBeUndefined(); // fallback
    });

    it("DB'de ek sütun olsa bile çalışır (forward compatibility)", async () => {
      dir = tmp();
      store = new MemoryStore(dir);
      await store.remember("compat_entry", "value");
      store.close();

      // DB'ye ek sütun ekle
      const dbPath = join(dir, "memory", "memories.db");
      const db = new Database(dbPath);
      db.exec("ALTER TABLE memories ADD COLUMN extra_col TEXT DEFAULT 'x'");
      db.close();

      store = new MemoryStore(dir);
      const entry = store.get("compat_entry");
      expect(entry).toBeTruthy();
      expect(entry!.value).toBe("value");

      // Yeni kayıt ekleme de çalışmalı
      await store.remember("new_after_alter", "works");
      expect(store.get("new_after_alter")).toBeTruthy();
    });

    it("WAL dosyası silinse bile DB recovery yapar", async () => {
      dir = tmp();
      store = new MemoryStore(dir);
      await store.remember("wal_test", "before wal delete");
      store.close();

      // WAL dosyasını sil (varsa)
      const walPath = join(dir, "memory", "memories.db-wal");
      if (existsSync(walPath)) {
        rmSync(walPath);
      }

      // Yeniden aç
      store = new MemoryStore(dir);
      const entry = store.get("wal_test");
      expect(entry).toBeTruthy();
      expect(entry!.value).toBe("before wal delete");
    });
  });

  // ═════════════════════════════════════════════
  // 6. BÜYÜK ÖLÇEK SENARYOLARI
  // ═════════════════════════════════════════════

  describe("büyük ölçek senaryoları", () => {
    it("500 kayıt ekle → 200 sil → 200 ekle → tutarlılık", async () => {
      dir = tmp();
      store = new MemoryStore(dir);

      // 500 ekle
      for (let i = 0; i < 500; i++) {
        await store.remember(`batch-${i}`, `val-${i}`, i % 4 === 0 ? "decisions" : "notes");
      }
      expect(store.getAll()).toHaveLength(500);

      // İlk 200'ü sil
      for (let i = 0; i < 200; i++) {
        store.forget(`batch-${i}`);
      }
      expect(store.getAll()).toHaveLength(300);

      // 200 yeni ekle
      for (let i = 500; i < 700; i++) {
        await store.remember(`batch-${i}`, `val-${i}`);
      }
      expect(store.getAll()).toHaveLength(500);

      // Persistence doğrula
      store.close();
      store = new MemoryStore(dir);
      expect(store.getAll()).toHaveLength(500);

      // Silinen kayıtlar gerçekten yok
      expect(store.get("batch-0")).toBeUndefined();
      expect(store.get("batch-199")).toBeUndefined();

      // Kalan ve yeni kayıtlar var
      expect(store.get("batch-200")).toBeTruthy();
      expect(store.get("batch-500")).toBeTruthy();
      expect(store.get("batch-699")).toBeTruthy();
    });

    it("500 kayıt üzerinde recall performansı < 100ms", async () => {
      dir = tmp();
      store = new MemoryStore(dir);

      for (let i = 0; i < 500; i++) {
        await store.remember(`perf-${i}`, `Performance test entry ${i} with content word-${i}`, "notes", [`tag-${i % 20}`]);
      }

      const start = Date.now();
      const results = await store.recall("Performance content word-250");
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(100);
      expect(results.length).toBeGreaterThan(0);
    });

    it("500 kayıt + BM25 search performansı < 200ms", async () => {
      dir = tmp();
      store = new MemoryStore(dir);
      store.setEmbeddingProvider(new LocalEmbeddingProvider());

      for (let i = 0; i < 500; i++) {
        await store.remember(`bm25-${i}`, `BM25 performance test ${i} unique-marker-${i}`, "notes");
      }

      const start = Date.now();
      const results = await store.recall("BM25 performance unique-marker-250");
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(200);
      expect(results.length).toBeGreaterThan(0);
    });

    it("boş query + 500 kayıt + limit=5 → SQL LIMIT hızlı", async () => {
      dir = tmp();
      store = new MemoryStore(dir);

      for (let i = 0; i < 500; i++) {
        await store.remember(`lim-${i}`, `v-${i}`, "decisions");
      }

      const start = Date.now();
      const results = await store.recall("", "decisions", 5);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(10); // SQL LIMIT çok hızlı
      expect(results).toHaveLength(5);
    });
  });

  // ═════════════════════════════════════════════
  // 7. METADATA İLE KARMAŞIK CRUD AKIŞLARI
  // ═════════════════════════════════════════════

  describe("metadata ile karmaşık CRUD akışları", () => {
    beforeEach(() => { dir = tmp(); store = new MemoryStore(dir); });

    it("metadata varken value güncelle — metadata korunur", async () => {
      await store.remember("m1", "v1", "decisions", ["tag"], { priority: "high" });
      await store.remember("m1", "v2"); // sadece value güncelle

      const entry = store.get("m1");
      expect(entry?.value).toBe("v2");
      expect(entry?.metadata?.priority).toBe("high"); // korunmuş
      expect(entry?.category).toBe("decisions"); // korunmuş
      expect(entry?.tags).toEqual(["tag"]); // korunmuş
    });

    it("metadata'yı boşaltma — açıkça {} gönder", async () => {
      await store.remember("m2", "v1", "notes", [], { important: true });
      expect(store.get("m2")?.metadata?.important).toBe(true);

      await store.remember("m2", "v1", undefined, [], {});
      // Boş metadata → undefined olarak döner
      expect(store.get("m2")?.metadata).toBeUndefined();
    });

    it("metadata keyword search'e dahil değil", async () => {
      await store.remember("hidden_meta", "simple value", "notes", [], {
        secretKeyword: "findme_unique_xyz",
      });

      // "findme_unique_xyz" sadece metadata'da — keyword search bulmamalı
      const results = await store.recall("findme_unique_xyz");
      expect(results).toHaveLength(0);
    });

    it("metadata'da Array, null, boolean, number karışık tipler", async () => {
      await store.remember("mixed", "val", "notes", [], {
        arr: [1, "two", null, true],
        nested: { a: { b: { c: 42 } } },
        flag: false,
        count: 0,
        empty: null,
      });

      store.close();
      store = new MemoryStore(dir);

      const meta = store.get("mixed")?.metadata;
      expect(meta?.arr).toEqual([1, "two", null, true]);
      expect((meta?.nested as any)?.a?.b?.c).toBe(42);
      expect(meta?.flag).toBe(false);
      expect(meta?.count).toBe(0);
      expect(meta?.empty).toBeNull();
    });

    it("forget → aynı key ile yeni kayıt → yeni id alır", async () => {
      const first = await store.remember("reborn", "v1");
      const firstId = first.id;

      store.forget("reborn");
      const second = await store.remember("reborn", "v2");

      expect(second.id).not.toBe(firstId); // Yeni UUID
      expect(second.value).toBe("v2");
    });

    it("10 kez güncelle → createdAt hep aynı, updatedAt her seferinde farklı olabilir", async () => {
      const first = await store.remember("evolve", "v0");
      const originalCreatedAt = first.createdAt;

      for (let i = 1; i <= 10; i++) {
        await store.remember("evolve", `v${i}`);
      }

      const final = store.get("evolve");
      expect(final?.createdAt).toBe(originalCreatedAt);
      expect(final?.value).toBe("v10");
    });
  });

  // ═════════════════════════════════════════════
  // 8. CONCURRENT İLERİ DÜZEY SENARYOLAR
  // ═════════════════════════════════════════════

  describe("concurrent ileri düzey senaryolar", () => {
    it("100 concurrent remember + 50 concurrent forget — veri tutarlı", async () => {
      dir = tmp();
      store = new MemoryStore(dir);

      // Önce 50 kayıt ekle (silinecekler)
      for (let i = 0; i < 50; i++) {
        await store.remember(`to-delete-${i}`, `del-${i}`);
      }

      // Concurrent: 100 yeni ekleme + 50 silme
      const addOps = Array.from({ length: 100 }, (_, i) =>
        store.remember(`concurrent-add-${i}`, `val-${i}`)
      );
      const delOps = Array.from({ length: 50 }, (_, i) =>
        Promise.resolve(store.forget(`to-delete-${i}`))
      );

      await Promise.all([...addOps, ...delOps]);

      const all = store.getAll();
      expect(all).toHaveLength(100); // 50 silindi + 100 eklendi
    });

    it("aynı key'e concurrent remember + forget — son durum tutarlı", async () => {
      dir = tmp();
      store = new MemoryStore(dir);

      // Race: bazıları ekliyor, bazıları siliyor
      const ops: Promise<any>[] = [];
      for (let i = 0; i < 20; i++) {
        if (i % 3 === 0) {
          ops.push(Promise.resolve(store.forget("race_key")));
        } else {
          ops.push(store.remember("race_key", `v${i}`));
        }
      }
      await Promise.all(ops);

      // Crash yok — son durum tutarlı
      const entry = store.get("race_key");
      // Ya var ya yok ama hata vermemeli
      if (entry) {
        expect(entry.value).toMatch(/^v\d+$/);
      }
    });
  });

  // ═════════════════════════════════════════════
  // 9. RECALL EDGE CASES
  // ═════════════════════════════════════════════

  describe("recall edge cases", () => {
    beforeEach(async () => {
      dir = tmp();
      store = new MemoryStore(dir);
    });

    it("query tamamen özel karakter — crash yok", async () => {
      await store.remember("test", "value");
      const results = await store.recall("!@#$%^&*()");
      expect(Array.isArray(results)).toBe(true);
    });

    it("query çok uzun (10000 karakter) — crash yok", async () => {
      await store.remember("test", "value");
      const longQuery = "search ".repeat(1500);
      await expect(store.recall(longQuery)).resolves.toBeTruthy();
    });

    it("limit=0 → boş sonuç", async () => {
      await store.remember("test", "value");
      const results = await store.recall("value", undefined, 0);
      expect(results).toHaveLength(0);
    });

    it("limit çok büyük (999999) → tüm sonuçlar", async () => {
      for (let i = 0; i < 10; i++) {
        await store.remember(`k${i}`, `common value ${i}`);
      }
      const results = await store.recall("common", undefined, 999999);
      expect(results).toHaveLength(10);
    });

    it("boş query + limit=0 → boş sonuç", async () => {
      await store.remember("test", "value");
      const results = await store.recall("", undefined, 0);
      expect(results).toHaveLength(0);
    });

    it("unicode query çalışır", async () => {
      await store.remember("türkçe", "değer içeriği şöyle", "notlar", ["türkçe"]);
      const results = await store.recall("değer");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].key).toBe("türkçe");
    });
  });
});
