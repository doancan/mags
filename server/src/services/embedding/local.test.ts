import { describe, it, expect } from "vitest";
import { LocalEmbeddingProvider } from "./local.js";
import type { MemoryEntry } from "../../types/index.js";

function makeEntry(key: string, value: string, tags: string[] = []): MemoryEntry {
  return {
    id: `id-${key}`,
    key,
    value,
    tags,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  };
}

describe("LocalEmbeddingProvider (BM25)", () => {
  const provider = new LocalEmbeddingProvider();

  // ── embed ────────────────────────────────────

  describe("embed", () => {
    it("boş dizi döner (local provider gerçek embedding üretmez)", async () => {
      const result = await provider.embed("test text");
      expect(result).toEqual([]);
    });
  });

  // ── search temel ─────────────────────────────

  describe("search temel", () => {
    const entries = [
      makeEntry("auth_strategy", "JWT tokens for user authentication and authorization", ["auth"]),
      makeEntry("db_choice", "PostgreSQL database with Prisma ORM for data persistence", ["database"]),
      makeEntry("cache_layer", "Redis cache for session storage and rate limiting", ["cache"]),
      makeEntry("ui_lib", "React 18 with TanStack Query for frontend development", ["frontend"]),
    ];

    it("ilgili sonuçları döner", async () => {
      const results = await provider.search("authentication", entries);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].key).toBe("auth_strategy");
    });

    it("PostgreSQL araması database sonucunu döner", async () => {
      const results = await provider.search("PostgreSQL database", entries);
      expect(results[0].key).toBe("db_choice");
    });

    it("score > 0 olan sonuçlar filtrelenir", async () => {
      const results = await provider.search("zzzznonexistent", entries);
      expect(results).toEqual([]);
    });

    it("limit çalışır", async () => {
      const results = await provider.search("for", entries, 2);
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it("exact key match 2x boost alır", async () => {
      const results = await provider.search("auth_strategy", entries);
      expect(results[0].key).toBe("auth_strategy");
      // Boost olduğu için skor yüksek
      if (results.length > 1) {
        expect(results[0].score).toBeGreaterThan(results[1].score);
      }
    });
  });

  // ── Edge case'ler ────────────────────────────

  describe("edge case'ler", () => {
    it("boş query boş döner", async () => {
      const entries = [makeEntry("test", "value")];
      const results = await provider.search("", entries);
      expect(results).toEqual([]);
    });

    it("boş entries boş döner", async () => {
      const results = await provider.search("test", []);
      expect(results).toEqual([]);
    });

    it("tek karakterli kelimeler tokenize'da filtrelenir", async () => {
      const entries = [makeEntry("test", "a b c d e f g")];
      // Tüm kelimeler 1 karakter, tokenize sonrası boş
      const results = await provider.search("a", entries);
      expect(results).toEqual([]);
    });

    it("Türkçe karakterler korunur", async () => {
      const entries = [
        makeEntry("turkce", "Türkçe içerik ile özellik geliştirme şifreli güncelleme"),
      ];

      const results = await provider.search("özellik", entries);
      expect(results.length).toBeGreaterThan(0);
    });

    it("özel karakterler temizlenir", async () => {
      const entries = [
        makeEntry("special", "auth-strategy: JWT (v2.0) [secure]"),
      ];

      const results = await provider.search("JWT", entries);
      expect(results.length).toBeGreaterThan(0);
    });
  });

  // ── BM25 skorlama doğruluğu ──────────────────

  describe("BM25 skorlama doğruluğu", () => {
    it("nadir kelime daha yüksek IDF alır", async () => {
      const entries = [
        makeEntry("common", "the the the the the"), // çok yaygın
        makeEntry("rare", "the unique"), // "unique" nadir
        makeEntry("filler", "the the"),
      ];

      const results = await provider.search("unique", entries);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].key).toBe("rare");
    });

    it("birden fazla eşleşen terim daha yüksek skor alır", async () => {
      const entries = [
        makeEntry("partial", "database optimization"),
        makeEntry("full", "database optimization queries performance"),
      ];

      const results = await provider.search("database optimization queries", entries);
      // "full" daha fazla terim eşleşir
      expect(results[0].key).toBe("full");
    });

    it("tag'lar da aranır", async () => {
      const entries = [
        makeEntry("no_tag", "general content", []),
        makeEntry("tagged", "general content", ["security", "auth"]),
      ];

      const results = await provider.search("security", entries);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].key).toBe("tagged");
    });
  });

  // ── Büyük veri seti ──────────────────────────

  describe("büyük veri seti", () => {
    it("500 entry ile performanslı çalışır", async () => {
      const entries = Array.from({ length: 500 }, (_, i) =>
        makeEntry(`key-${i}`, `Content for entry ${i} with keyword-${i} and module-${i % 10}`, [`tag-${i % 20}`])
      );

      const start = Date.now();
      const results = await provider.search("keyword-42", entries);
      const elapsed = Date.now() - start;

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].key).toBe("key-42");
      // 500 entry için 1 saniyenin altında olmalı
      expect(elapsed).toBeLessThan(1000);
    });
  });
});
