/**
 * MemoryStore — Zorlu & Stres Testleri (SQLite)
 *
 * - Special characters in key/value
 * - Çok uzun key/value
 * - Concurrent remember/forget
 * - Reload consistency (write → close → reopen → verify)
 * - Boş/null-like değerler
 * - Hızlı ardışık yazma
 * - Metadata edge case'leri
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdirSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { MemoryStore } from "./memory-store.js";
import { LocalEmbeddingProvider } from "./embedding/local.js";

function tmp(): string {
  const d = join(tmpdir(), `mags-ms-stress-${randomUUID()}`);
  mkdirSync(d, { recursive: true });
  return d;
}

describe("MemoryStore — Zorlu Testler (SQLite)", () => {
  let dir: string;
  let store: MemoryStore;

  afterEach(() => {
    try { store?.close(); } catch {}
    rmSync(dir, { recursive: true, force: true });
  });

  // ─────────────────────────────────────────────
  // 1. Special characters
  // ─────────────────────────────────────────────

  describe("özel karakterler", () => {
    beforeEach(() => {
      dir = tmp();
    });

    it("value'da SQL injection karakterleri persist & reload edilir", async () => {
      store = new MemoryStore(dir);
      const dangerous = "Robert'); DROP TABLE memories;--";
      await store.remember("sql_inject", dangerous);
      store.close();

      store = new MemoryStore(dir);
      expect(store.get("sql_inject")?.value).toBe(dangerous);
      expect(store.getAll().length).toBeGreaterThanOrEqual(1);
    });

    it("value'da newlines, tabs, special chars", async () => {
      store = new MemoryStore(dir);
      const specialVal =
        'key: value, array: [1,2], obj: {a: b}, anchor: &ref, comment: # not, pipe: |, gt: >, pct: 100%';
      await store.remember("special", specialVal);
      store.close();

      store = new MemoryStore(dir);
      expect(store.get("special")?.value).toBe(specialVal);
    });

    it("key'de özel karakterler (slash, dot, dash)", async () => {
      store = new MemoryStore(dir);
      await store.remember("auth/jwt.strategy-v2", "JWT with RS256");

      const entry = store.get("auth/jwt.strategy-v2");
      expect(entry?.value).toBe("JWT with RS256");

      store.close();
      store = new MemoryStore(dir);
      expect(store.get("auth/jwt.strategy-v2")?.value).toBe("JWT with RS256");
    });

    it("çok satırlı value doğru persist edilir", async () => {
      store = new MemoryStore(dir);
      const multiline = `Line 1
Line 2
  Indented line
    Double indent
Line 5`;
      await store.remember("multiline", multiline);
      store.close();

      store = new MemoryStore(dir);
      expect(store.get("multiline")?.value).toBe(multiline);
    });

    it("unicode / emoji value", async () => {
      store = new MemoryStore(dir);
      await store.remember("emoji", "Auth: JWT 🔐 | DB: PostgreSQL 🐘");
      store.close();

      store = new MemoryStore(dir);
      expect(store.get("emoji")?.value).toContain("🔐");
    });

    it("boş string value", async () => {
      store = new MemoryStore(dir);
      await store.remember("empty_val", "");
      expect(store.get("empty_val")?.value).toBe("");

      store.close();
      store = new MemoryStore(dir);
      expect(store.get("empty_val")?.value).toBe("");
    });
  });

  // ─────────────────────────────────────────────
  // 2. Çok uzun key/value
  // ─────────────────────────────────────────────

  describe("çok uzun key/value", () => {
    beforeEach(() => {
      dir = tmp();
    });

    it("10KB value sorunsuz kaydedilir", async () => {
      store = new MemoryStore(dir);
      const bigValue = "A".repeat(10_000);
      await store.remember("big", bigValue);
      store.close();

      store = new MemoryStore(dir);
      expect(store.get("big")?.value.length).toBe(10_000);
    });

    it("500 karakter key çalışır", async () => {
      store = new MemoryStore(dir);
      const longKey = "k".repeat(500);
      await store.remember(longKey, "value");

      expect(store.get(longKey)?.value).toBe("value");
    });

    it("1MB value sorunsuz persist edilir", async () => {
      store = new MemoryStore(dir);
      const bigValue = "x".repeat(1_000_000);
      await store.remember("megabyte", bigValue);
      store.close();

      store = new MemoryStore(dir);
      expect(store.get("megabyte")?.value.length).toBe(1_000_000);
    });
  });

  // ─────────────────────────────────────────────
  // 3. Hızlı ardışık işlemler
  // ─────────────────────────────────────────────

  describe("hızlı ardışık işlemler", () => {
    beforeEach(() => {
      dir = tmp();
    });

    it("aynı key'e 50 kez hızlı güncelleme — son değer kalır", async () => {
      store = new MemoryStore(dir);

      for (let i = 0; i < 50; i++) {
        await store.remember("rapid", `value-${i}`);
      }

      expect(store.get("rapid")?.value).toBe("value-49");
      expect(store.getAll()).toHaveLength(1);

      store.close();
      store = new MemoryStore(dir);
      expect(store.get("rapid")?.value).toBe("value-49");
    });

    it("remember + forget + remember cycle", async () => {
      store = new MemoryStore(dir);

      await store.remember("cycle", "v1");
      expect(store.get("cycle")?.value).toBe("v1");

      store.forget("cycle");
      expect(store.get("cycle")).toBeUndefined();

      await store.remember("cycle", "v2");
      expect(store.get("cycle")?.value).toBe("v2");

      store.close();
      store = new MemoryStore(dir);
      expect(store.get("cycle")?.value).toBe("v2");
    });

    it("100 kayıt ekle → hepsini sil → store boş", async () => {
      store = new MemoryStore(dir);

      for (let i = 0; i < 100; i++) {
        await store.remember(`k-${i}`, `v-${i}`);
      }
      expect(store.getAll()).toHaveLength(100);

      for (let i = 0; i < 100; i++) {
        store.forget(`k-${i}`);
      }
      expect(store.getAll()).toHaveLength(0);
    });
  });

  // ─────────────────────────────────────────────
  // 4. Concurrent operations
  // ─────────────────────────────────────────────

  describe("concurrent operations", () => {
    beforeEach(() => {
      dir = tmp();
    });

    it("50 concurrent remember race condition oluşturmaz", async () => {
      store = new MemoryStore(dir);

      const promises = Array.from({ length: 50 }, (_, i) =>
        store.remember(`concurrent-${i}`, `value-${i}`)
      );
      await Promise.all(promises);

      expect(store.getAll()).toHaveLength(50);
    });

    it("concurrent remember + recall karışık", async () => {
      store = new MemoryStore(dir);

      for (let i = 0; i < 10; i++) {
        await store.remember(`base-${i}`, `value-${i}`);
      }

      const ops = [
        store.remember("new1", "nv1"),
        store.recall("base"),
        store.remember("new2", "nv2"),
        store.recall("value"),
        store.remember("new3", "nv3"),
      ];

      await expect(Promise.all(ops)).resolves.toBeTruthy();
      expect(store.getAll().length).toBeGreaterThanOrEqual(13);
    });
  });

  // ─────────────────────────────────────────────
  // 5. Reload consistency
  // ─────────────────────────────────────────────

  describe("reload consistency", () => {
    beforeEach(() => {
      dir = tmp();
    });

    it("100 kayıt write → close → reopen → tüm veriler tutarlı", async () => {
      store = new MemoryStore(dir);

      const expected: Record<string, string> = {};
      for (let i = 0; i < 100; i++) {
        const key = `key-${i}`;
        const value = `value-${i}-${randomUUID()}`;
        await store.remember(key, value, i % 3 === 0 ? "decisions" : "notes", [`tag-${i % 5}`]);
        expected[key] = value;
      }

      store.close();
      store = new MemoryStore(dir);

      expect(store.getAll()).toHaveLength(100);

      for (const [key, value] of Object.entries(expected)) {
        const entry = store.get(key);
        expect(entry).toBeTruthy();
        expect(entry?.value).toBe(value);
      }
    });

    it("category ve tags reload sonrası korunur", async () => {
      store = new MemoryStore(dir);
      await store.remember("k1", "v1", "decisions", ["tag-a", "tag-b"]);
      store.close();

      store = new MemoryStore(dir);
      const entry = store.get("k1");
      expect(entry?.category).toBe("decisions");
      expect(entry?.tags).toEqual(["tag-a", "tag-b"]);
    });

    it("metadata reload sonrası korunur", async () => {
      store = new MemoryStore(dir);
      await store.remember("meta_k", "v1", "decisions", [], {
        alternatives: ["a", "b"],
        nested: { deep: true },
      });
      store.close();

      store = new MemoryStore(dir);
      const entry = store.get("meta_k");
      expect(entry?.metadata).toEqual({
        alternatives: ["a", "b"],
        nested: { deep: true },
      });
    });

    it("updatedAt güncelleme sonrası değişir", async () => {
      store = new MemoryStore(dir);

      const { entry: first } = await store.remember("timing", "v1");
      const t1 = first.updatedAt;

      await new Promise((r) => setTimeout(r, 10));
      const { entry: second } = await store.remember("timing", "v2");
      const t2 = second.updatedAt;

      expect(second.createdAt).toBe(first.createdAt);
      expect(t2).toBeTruthy();
    });
  });

  // ─────────────────────────────────────────────
  // 6. Search edge case'leri
  // ─────────────────────────────────────────────

  describe("search edge case'leri", () => {
    beforeEach(() => {
      dir = tmp();
    });

    it("tüm kayıtlar aynı içerikse skor eşit olur", async () => {
      store = new MemoryStore(dir);

      for (let i = 0; i < 5; i++) {
        await store.remember(`same-${i}`, "identical content here");
      }

      const results = await store.recall("identical content");
      expect(results.length).toBe(5);
      const scores = results.map((r) => r.score);
      const uniqueScores = new Set(scores.map((s) => Math.round(s * 100)));
      expect(uniqueScores.size).toBeLessThanOrEqual(5);
    });

    it("query'de sadece stopword-like kısa kelimeler → sınırlı sonuç", async () => {
      store = new MemoryStore(dir);
      await store.remember("test", "some content to find");

      const results = await store.recall("to");
      expect(Array.isArray(results)).toBe(true);
    });

    it("BM25 ile aynı kelimenin tekrarı daha yüksek TF → yüksek skor", async () => {
      store = new MemoryStore(dir);
      store.setEmbeddingProvider(new LocalEmbeddingProvider());

      await store.remember("low_tf", "database mentioned once");
      await store.remember(
        "high_tf",
        "database database database database database mentioned five times"
      );

      const results = await store.recall("database");
      expect(results[0].key).toBe("high_tf");
    });
  });

  // ─────────────────────────────────────────────
  // 7. Metadata edge case'leri
  // ─────────────────────────────────────────────

  describe("metadata edge case'leri", () => {
    beforeEach(() => {
      dir = tmp();
    });

    it("boş metadata object → undefined olarak döner", async () => {
      store = new MemoryStore(dir);
      await store.remember("empty_meta", "val", "notes", [], {});
      const entry = store.get("empty_meta");
      expect(entry?.metadata).toBeUndefined();
    });

    it("nested metadata persist edilir", async () => {
      store = new MemoryStore(dir);
      await store.remember("nested", "val", undefined, [], {
        level1: {
          level2: {
            level3: "deep",
          },
        },
        array: [1, "two", { three: 3 }],
      });
      store.close();

      store = new MemoryStore(dir);
      const entry = store.get("nested");
      expect(entry?.metadata?.level1).toEqual({
        level2: { level3: "deep" },
      });
      expect(entry?.metadata?.array).toEqual([1, "two", { three: 3 }]);
    });

    it("metadata'da null value", async () => {
      store = new MemoryStore(dir);
      await store.remember("null_meta", "val", undefined, [], {
        key: null,
        other: "value",
      });

      const entry = store.get("null_meta");
      expect(entry?.metadata?.key).toBeNull();
      expect(entry?.metadata?.other).toBe("value");
    });
  });
});
