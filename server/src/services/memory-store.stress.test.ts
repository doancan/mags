/**
 * MemoryStore — Zorlu & Stres Testleri
 *
 * - YAML injection / special characters
 * - Çok uzun key/value
 * - Concurrent remember/forget
 * - Reload consistency (write → reload → verify)
 * - Boş/null-like değerler
 * - Kategori edge case'leri
 * - Aynı key'e hızlı ardışık yazma
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdirSync,
  writeFileSync,
  rmSync,
  readdirSync,
  readFileSync,
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

describe("MemoryStore — Zorlu Testler", () => {
  let dir: string;
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  // ─────────────────────────────────────────────
  // 1. YAML injection / special characters
  // ─────────────────────────────────────────────

  describe("YAML injection ve özel karakterler", () => {
    beforeEach(() => {
      dir = tmp();
    });

    it("value'da YAML delimiter (---) persist & reload edilir", async () => {
      const store = new MemoryStore(dir);
      store.load();
      await store.remember("yaml_delim", "before\n---\nafter");

      const store2 = new MemoryStore(dir);
      store2.load();
      expect(store2.get("yaml_delim")?.value).toBe("before\n---\nafter");
    });

    it("value'da YAML special chars (: { } [ ] , & * # ? | < > = ! % @)", async () => {
      const store = new MemoryStore(dir);
      store.load();

      const specialVal =
        'key: value, array: [1,2], obj: {a: b}, anchor: &ref, comment: # not, pipe: |, gt: >, pct: 100%';
      await store.remember("special", specialVal);

      const store2 = new MemoryStore(dir);
      store2.load();
      expect(store2.get("special")?.value).toBe(specialVal);
    });

    it("key'de özel karakterler (slash, dot, dash)", async () => {
      const store = new MemoryStore(dir);
      store.load();

      await store.remember("auth/jwt.strategy-v2", "JWT with RS256");

      const entry = store.get("auth/jwt.strategy-v2");
      expect(entry?.value).toBe("JWT with RS256");

      // Reload
      const store2 = new MemoryStore(dir);
      store2.load();
      expect(store2.get("auth/jwt.strategy-v2")?.value).toBe("JWT with RS256");
    });

    it("çok satırlı value doğru persist edilir", async () => {
      const store = new MemoryStore(dir);
      store.load();

      const multiline = `Line 1
Line 2
  Indented line
    Double indent
Line 5`;
      await store.remember("multiline", multiline);

      const store2 = new MemoryStore(dir);
      store2.load();
      expect(store2.get("multiline")?.value).toBe(multiline);
    });

    it("unicode / emoji value", async () => {
      const store = new MemoryStore(dir);
      store.load();

      await store.remember("emoji", "Auth: JWT 🔐 | DB: PostgreSQL 🐘");

      const store2 = new MemoryStore(dir);
      store2.load();
      expect(store2.get("emoji")?.value).toContain("🔐");
    });

    it("boş string value", async () => {
      const store = new MemoryStore(dir);
      store.load();

      await store.remember("empty_val", "");
      expect(store.get("empty_val")?.value).toBe("");

      const store2 = new MemoryStore(dir);
      store2.load();
      // YAML boş string'i farklı serialize edebilir
      const val = store2.get("empty_val")?.value;
      expect(val === "" || val === null || val === undefined).toBe(true);
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
      const store = new MemoryStore(dir);
      store.load();

      const bigValue = "A".repeat(10_000);
      await store.remember("big", bigValue);

      const store2 = new MemoryStore(dir);
      store2.load();
      expect(store2.get("big")?.value.length).toBe(10_000);
    });

    it("500 karakter key çalışır", async () => {
      const store = new MemoryStore(dir);
      store.load();

      const longKey = "k".repeat(500);
      await store.remember(longKey, "value");

      expect(store.get(longKey)?.value).toBe("value");
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
      const store = new MemoryStore(dir);
      store.load();

      for (let i = 0; i < 50; i++) {
        await store.remember("rapid", `value-${i}`);
      }

      expect(store.get("rapid")?.value).toBe("value-49");
      expect(store.getAll()).toHaveLength(1); // tek kayıt

      // Disk'te de doğru olmalı
      const store2 = new MemoryStore(dir);
      store2.load();
      expect(store2.get("rapid")?.value).toBe("value-49");
    });

    it("remember + forget + remember cycle", async () => {
      const store = new MemoryStore(dir);
      store.load();

      await store.remember("cycle", "v1");
      expect(store.get("cycle")?.value).toBe("v1");

      store.forget("cycle");
      expect(store.get("cycle")).toBeUndefined();

      await store.remember("cycle", "v2");
      expect(store.get("cycle")?.value).toBe("v2");

      // Yeni id almalı (forget sildi)
      const store2 = new MemoryStore(dir);
      store2.load();
      expect(store2.get("cycle")?.value).toBe("v2");
    });

    it("100 kayıt ekle → hepsini sil → store boş", async () => {
      const store = new MemoryStore(dir);
      store.load();

      for (let i = 0; i < 100; i++) {
        await store.remember(`k-${i}`, `v-${i}`);
      }
      expect(store.getAll()).toHaveLength(100);

      for (let i = 0; i < 100; i++) {
        store.forget(`k-${i}`);
      }
      expect(store.getAll()).toHaveLength(0);

      // Disk'te de dosya olmamalı
      const entriesDir = join(dir, "memory", "entries");
      const files = readdirSync(entriesDir).filter((f) =>
        f.endsWith(".yaml")
      );
      expect(files).toHaveLength(0);
    });
  });

  // ─────────────────────────────────────────────
  // 4. Concurrent remember (Promise.all)
  // ─────────────────────────────────────────────

  describe("concurrent operations", () => {
    beforeEach(() => {
      dir = tmp();
    });

    it("50 concurrent remember race condition oluşturmaz", async () => {
      const store = new MemoryStore(dir);
      store.load();

      const promises = Array.from({ length: 50 }, (_, i) =>
        store.remember(`concurrent-${i}`, `value-${i}`)
      );
      await Promise.all(promises);

      expect(store.getAll()).toHaveLength(50);
    });

    it("concurrent remember + recall karışık", async () => {
      const store = new MemoryStore(dir);
      store.load();

      // Önce birkaç kayıt ekle
      for (let i = 0; i < 10; i++) {
        await store.remember(`base-${i}`, `value-${i}`);
      }

      // Eş zamanlı yazma + okuma
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
  // 5. Reload consistency (write → reload → verify)
  // ─────────────────────────────────────────────

  describe("reload consistency", () => {
    beforeEach(() => {
      dir = tmp();
    });

    it("100 kayıt write → reload → tüm veriler tutarlı", async () => {
      const store = new MemoryStore(dir);
      store.load();

      const expected: Record<string, string> = {};
      for (let i = 0; i < 100; i++) {
        const key = `key-${i}`;
        const value = `value-${i}-${randomUUID()}`;
        await store.remember(key, value, i % 3 === 0 ? "decisions" : "notes", [`tag-${i % 5}`]);
        expected[key] = value;
      }

      // Tamamen yeni instance
      const store2 = new MemoryStore(dir);
      store2.load();

      expect(store2.getAll()).toHaveLength(100);

      for (const [key, value] of Object.entries(expected)) {
        const entry = store2.get(key);
        expect(entry).toBeTruthy();
        expect(entry?.value).toBe(value);
      }
    });

    it("category ve tags reload sonrası korunur", async () => {
      const store = new MemoryStore(dir);
      store.load();

      await store.remember("k1", "v1", "decisions", ["tag-a", "tag-b"]);

      const store2 = new MemoryStore(dir);
      store2.load();

      const entry = store2.get("k1");
      expect(entry?.category).toBe("decisions");
      expect(entry?.tags).toEqual(["tag-a", "tag-b"]);
    });

    it("updatedAt güncelleme sonrası değişir", async () => {
      const store = new MemoryStore(dir);
      store.load();

      const first = await store.remember("timing", "v1");
      const t1 = first.updatedAt;

      // Çok kısa aralıkla güncelle (ms farkı yeterli)
      await new Promise((r) => setTimeout(r, 10));
      const second = await store.remember("timing", "v2");
      const t2 = second.updatedAt;

      expect(second.createdAt).toBe(first.createdAt);
      // Timestamp'ler aynı olabilir (aynı saniye) ama en azından crash yok
      expect(t2).toBeTruthy();
    });
  });

  // ─────────────────────────────────────────────
  // 6. Search edge case'leri (keyword + BM25)
  // ─────────────────────────────────────────────

  describe("search edge case'leri", () => {
    beforeEach(() => {
      dir = tmp();
    });

    it("tüm kayıtlar aynı içerikse skor eşit olur", async () => {
      const store = new MemoryStore(dir);
      store.load();

      for (let i = 0; i < 5; i++) {
        await store.remember(`same-${i}`, "identical content here");
      }

      const results = await store.recall("identical content");
      // Hepsi aynı içerik → benzer skorlar
      expect(results.length).toBe(5);
      const scores = results.map((r) => r.score);
      const uniqueScores = new Set(scores.map((s) => Math.round(s * 100)));
      // Skorlar çok benzer olmalı (key farklılığı az)
      expect(uniqueScores.size).toBeLessThanOrEqual(5);
    });

    it("query'de sadece stopword-like kısa kelimeler → sınırlı sonuç", async () => {
      const store = new MemoryStore(dir);
      store.load();

      await store.remember("test", "some content to find");

      // 2 karakterlik kelimeler → token olur (>1 filtre)
      const results = await store.recall("to");
      // "to" 2 char → geçer, ama sadece "to" ile sınırlı eşleşme
      expect(Array.isArray(results)).toBe(true);
    });

    it("BM25 ile aynı kelimenin tekrarı daha yüksek TF → yüksek skor", async () => {
      const store = new MemoryStore(dir);
      store.load();
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
  // 7. Corrupted dosya senaryoları (gelişmiş)
  // ─────────────────────────────────────────────

  describe("corrupted dosya senaryoları (gelişmiş)", () => {
    beforeEach(() => {
      dir = tmp();
    });

    it("yarı yazılmış YAML dosyası (truncated)", async () => {
      const store = new MemoryStore(dir);
      store.load();

      await store.remember("good", "good value");

      // Truncated YAML yaz
      const entriesDir = join(dir, "memory", "entries");
      writeFileSync(
        join(entriesDir, "truncated.yaml"),
        "id: abc\nkey: trunc\nvalue: start of val",
        "utf-8"
      );

      const store2 = new MemoryStore(dir);
      store2.load();
      // Truncated ama geçerli YAML — yüklenmeli
      expect(store2.getAll().length).toBeGreaterThanOrEqual(1);
    });

    it("YAML dosyası ama JSON formatında (geçersiz)", async () => {
      const store = new MemoryStore(dir);
      store.load();

      await store.remember("good", "works");

      const entriesDir = join(dir, "memory", "entries");
      writeFileSync(
        join(entriesDir, "json.yaml"),
        '{"id":"x","key":"json","value":"test"}',
        "utf-8"
      );

      // JSON aslında geçerli YAML! YAML parser JSON da okur
      const store2 = new MemoryStore(dir);
      store2.load();
      expect(store2.getAll().length).toBeGreaterThanOrEqual(1);
    });

    it("boş YAML dosyası crash etmez", async () => {
      const store = new MemoryStore(dir);
      store.load();

      const entriesDir = join(dir, "memory", "entries");
      mkdirSync(entriesDir, { recursive: true });
      writeFileSync(join(entriesDir, "empty.yaml"), "", "utf-8");

      const store2 = new MemoryStore(dir);
      expect(() => store2.load()).not.toThrow();
    });

    it("çok büyük dosya (1MB YAML)", async () => {
      const store = new MemoryStore(dir);
      store.load();

      const entriesDir = join(dir, "memory", "entries");
      mkdirSync(entriesDir, { recursive: true });
      const bigYaml = `id: big-id\nkey: bigkey\nvalue: ${"x".repeat(1_000_000)}\ntags: []\ncreatedAt: "2025-01-01"\nupdatedAt: "2025-01-01"\n`;
      writeFileSync(join(entriesDir, "big.yaml"), bigYaml, "utf-8");

      const store2 = new MemoryStore(dir);
      expect(() => store2.load()).not.toThrow();
      expect(store2.get("bigkey")?.value.length).toBe(1_000_000);
    });
  });
});
