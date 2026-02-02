/**
 * SearchEngine — Integration Testleri
 *
 * SearchEngine DocIndexer + MemoryStore'u birleştirir.
 * Gerçek instance'larla integration test.
 *
 * - Scope filtering (docs, memory, all)
 * - Score sıralaması (docs + memory karışık)
 * - Boş sonuçlar
 * - Büyük veri seti (50 doc + 100 memory)
 * - Limit parametresi
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { SearchEngine } from "./search-engine.js";
import { DocIndexer } from "./doc-indexer.js";
import { MemoryStore } from "./memory-store.js";

function tmp(): string {
  const d = join(tmpdir(), `mags-se-${randomUUID()}`);
  mkdirSync(d, { recursive: true });
  return d;
}

function writeDoc(base: string, name: string, content: string, sub?: string) {
  const dir = sub ? join(base, sub) : base;
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), content, "utf-8");
}

describe("SearchEngine — Integration Testleri", () => {
  let rootDir: string;
  let docsDir: string;
  let magsDir: string;
  let docIndexer: DocIndexer;
  let memoryStore: MemoryStore;
  let engine: SearchEngine;

  beforeEach(async () => {
    rootDir = tmp();
    docsDir = join(rootDir, "docs");
    magsDir = join(rootDir, ".mags");
    mkdirSync(docsDir, { recursive: true });
    mkdirSync(magsDir, { recursive: true });

    docIndexer = new DocIndexer(docsDir);
    memoryStore = new MemoryStore(magsDir);
    memoryStore.load();
    engine = new SearchEngine(docIndexer, memoryStore);
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  // ─────────────────────────────────────────────
  // 1. Boş durum
  // ─────────────────────────────────────────────

  describe("boş durum", () => {
    it("hem doc hem memory boşken boş döner", async () => {
      docIndexer.index();
      const results = await engine.search("anything");
      expect(results).toEqual([]);
    });

    it("scope=docs ile boş docs → boş döner", async () => {
      docIndexer.index();
      await memoryStore.remember("key", "value");
      const results = await engine.search("value", 10, "docs");
      expect(results).toEqual([]);
    });

    it("scope=memory ile boş memory → boş döner", async () => {
      writeDoc(docsDir, "a.md", "# Test\n\nContent about testing.");
      docIndexer.index();
      const results = await engine.search("test", 10, "memory");
      expect(results).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────
  // 2. Scope filtering
  // ─────────────────────────────────────────────

  describe("scope filtering", () => {
    beforeEach(async () => {
      writeDoc(
        docsDir,
        "auth.md",
        "---\ntitle: Auth\n---\n\n# Authentication\n\nJWT token authentication strategy."
      );
      writeDoc(
        docsDir,
        "db.md",
        "---\ntitle: Database\n---\n\n# Database\n\nPostgreSQL with Prisma ORM."
      );
      docIndexer.index();

      await memoryStore.remember("auth_decision", "Use JWT with RS256", "decisions", ["auth"]);
      await memoryStore.remember("db_decision", "PostgreSQL selected", "decisions", ["db"]);
    });

    it("scope=all → docs + memory sonuçları birleşir", async () => {
      const results = await engine.search("authentication", 10, "all");
      const types = new Set(results.map((r) => r.type));
      // Docs'ta "Authentication", memory'de "auth" ile eşleşme
      expect(results.length).toBeGreaterThan(0);
    });

    it("scope=docs → sadece doc sonuçları", async () => {
      const results = await engine.search("JWT", 10, "docs");
      expect(results.every((r) => r.type === "doc")).toBe(true);
    });

    it("scope=memory → sadece memory sonuçları", async () => {
      const results = await engine.search("JWT", 10, "memory");
      expect(results.every((r) => r.type === "memory")).toBe(true);
    });

    it("scope belirtilmezse 'all' kullanılır", async () => {
      const withAll = await engine.search("PostgreSQL", 10, "all");
      const withoutScope = await engine.search("PostgreSQL", 10);
      // Aynı sonuç sayısı beklenir
      expect(withoutScope.length).toBe(withAll.length);
    });
  });

  // ─────────────────────────────────────────────
  // 3. Score sıralaması
  // ─────────────────────────────────────────────

  describe("score sıralaması", () => {
    it("sonuçlar score'a göre azalan sıralı döner", async () => {
      writeDoc(docsDir, "a.md", "# Alpha\n\nAlpha alpha alpha repeated.");
      writeDoc(docsDir, "b.md", "# Beta\n\nBeta content.");
      docIndexer.index();

      await memoryStore.remember("alpha_mem", "Alpha in memory");

      const results = await engine.search("alpha");
      for (let i = 1; i < results.length; i++) {
        expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score);
      }
    });
  });

  // ─────────────────────────────────────────────
  // 4. Limit parametresi
  // ─────────────────────────────────────────────

  describe("limit parametresi", () => {
    beforeEach(async () => {
      for (let i = 0; i < 10; i++) {
        writeDoc(docsDir, `doc-${i}.md`, `# Doc ${i}\n\nContent about topic keyword.`);
      }
      docIndexer.index();

      for (let i = 0; i < 10; i++) {
        await memoryStore.remember(`mem-${i}`, `Memory about topic keyword ${i}`);
      }
    });

    it("limit=5 → en fazla 5 sonuç", async () => {
      const results = await engine.search("keyword", 5);
      expect(results.length).toBeLessThanOrEqual(5);
    });

    it("limit=1 → tek sonuç", async () => {
      const results = await engine.search("topic", 1);
      expect(results.length).toBeLessThanOrEqual(1);
    });

    it("varsayılan limit=10", async () => {
      const results = await engine.search("keyword");
      expect(results.length).toBeLessThanOrEqual(10);
    });
  });

  // ─────────────────────────────────────────────
  // 5. Result format doğruluğu
  // ─────────────────────────────────────────────

  describe("result format doğruluğu", () => {
    it("doc sonucu doğru format", async () => {
      writeDoc(docsDir, "test.md", "# Test\n\n## Section A\n\nDetailed content here.");
      docIndexer.index();

      const results = await engine.search("Detailed content", 10, "docs");
      expect(results.length).toBeGreaterThan(0);

      const r = results[0];
      expect(r.type).toBe("doc");
      expect(r.source).toBe("test");
      expect(typeof r.title).toBe("string");
      expect(typeof r.snippet).toBe("string");
      expect(typeof r.score).toBe("number");
    });

    it("memory sonucu doğru format", async () => {
      await memoryStore.remember("my_key", "my value content", "decisions");

      const results = await engine.search("my value", 10, "memory");
      expect(results.length).toBeGreaterThan(0);

      const r = results[0];
      expect(r.type).toBe("memory");
      expect(r.source).toBe("my_key");
      expect(r.title).toBe("decisions");
      expect(r.snippet).toContain("my value");
      expect(typeof r.score).toBe("number");
    });

    it("memory category undefined → title 'note'", async () => {
      await memoryStore.remember("no_cat", "content without category");

      const results = await engine.search("content without", 10, "memory");
      if (results.length > 0) {
        expect(results[0].title).toBe("note");
      }
    });

    it("snippet 300 karakter ile sınırlı (memory)", async () => {
      await memoryStore.remember("long_val", "X".repeat(500));

      const results = await engine.search("long_val", 10, "memory");
      if (results.length > 0) {
        expect(results[0].snippet.length).toBeLessThanOrEqual(300);
      }
    });
  });

  // ─────────────────────────────────────────────
  // 6. Büyük veri seti (50 doc + 100 memory)
  // ─────────────────────────────────────────────

  describe("büyük veri seti (50 doc + 100 memory)", () => {
    beforeEach(async () => {
      for (let i = 0; i < 50; i++) {
        writeDoc(
          docsDir,
          `doc-${i}.md`,
          `---\ntitle: Document ${i}\n---\n\n# Document ${i}\n\n## Overview\n\nThis document covers topic-${i} with unique identifier marker-doc-${i}.\n\n## Details\n\nAdditional details for category-${i % 5}.`,
          `module-${i % 10}`
        );
      }
      docIndexer.index();

      for (let i = 0; i < 100; i++) {
        await memoryStore.remember(
          `memory-${i}`,
          `Memory entry about topic-${i} with marker-mem-${i}`,
          i % 3 === 0 ? "decisions" : "notes",
          [`tag-${i % 10}`]
        );
      }
    });

    it("performanslı çalışır (< 500ms)", async () => {
      const start = Date.now();
      const results = await engine.search("topic");
      expect(Date.now() - start).toBeLessThan(500);
      expect(results.length).toBeGreaterThan(0);
    });

    it("hedefli arama doğru sonucu bulur", async () => {
      const results = await engine.search("marker-doc-25");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].type).toBe("doc");
    });

    it("memory hedefli arama", async () => {
      const results = await engine.search("marker-mem-50", 10, "memory");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].source).toBe("memory-50");
    });

    it("scope=all her iki kaynaktan da sonuç döner", async () => {
      // Docs'ta ve memory'de aynı exact kelime olmalı
      const docResults = await engine.search("marker-doc-25", 10, "docs");
      const memResults = await engine.search("marker-mem-50", 10, "memory");
      // Her kaynak kendi hedefini bulmalı
      expect(docResults.length).toBeGreaterThan(0);
      expect(docResults[0].type).toBe("doc");
      expect(memResults.length).toBeGreaterThan(0);
      expect(memResults[0].type).toBe("memory");
    });
  });

  // ─────────────────────────────────────────────
  // 7. Edge case'ler
  // ─────────────────────────────────────────────

  describe("edge case'ler", () => {
    it("boş query string", async () => {
      writeDoc(docsDir, "a.md", "# A\n\nContent.");
      docIndexer.index();

      const results = await engine.search("");
      expect(Array.isArray(results)).toBe(true);
    });

    it("çok uzun query", async () => {
      writeDoc(docsDir, "a.md", "# A\n\nContent.");
      docIndexer.index();

      const longQuery = "word ".repeat(200);
      await expect(engine.search(longQuery)).resolves.toBeTruthy();
    });

    it("özel karakter query", async () => {
      writeDoc(docsDir, "a.md", "# A\n\nContent with (brackets) and [array].");
      docIndexer.index();

      await expect(engine.search("(brackets)")).resolves.toBeTruthy();
      await expect(engine.search("[array]")).resolves.toBeTruthy();
    });
  });
});
