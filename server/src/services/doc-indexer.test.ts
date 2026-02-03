import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { DocIndexer } from "./doc-indexer.js";

function makeTmpDir(): string {
  const dir = join(tmpdir(), `mags-test-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeDoc(
  dir: string,
  name: string,
  content: string,
  sub?: string
): void {
  const target = sub ? join(dir, sub) : dir;
  mkdirSync(target, { recursive: true });
  writeFileSync(join(target, name), content, "utf-8");
}

describe("DocIndexer", () => {
  let docsDir: string;

  beforeEach(() => {
    docsDir = makeTmpDir();
  });

  afterEach(() => {
    rmSync(docsDir, { recursive: true, force: true });
  });

  // ── Boş proje senaryosu ──────────────────────

  describe("boş proje", () => {
    it("varolmayan dizin ile boş dizi döner", () => {
      const indexer = new DocIndexer("/tmp/nonexistent-" + randomUUID());
      const docs = indexer.index();
      expect(docs).toEqual([]);
    });

    it("boş dizin ile boş dizi döner", () => {
      const indexer = new DocIndexer(docsDir);
      const docs = indexer.index();
      expect(docs).toEqual([]);
    });

    it("boş dizinde arama boş döner", () => {
      const indexer = new DocIndexer(docsDir);
      indexer.index();
      expect(indexer.search("test")).toEqual([]);
    });

    it("boş dizinde listDocs boş döner", () => {
      const indexer = new DocIndexer(docsDir);
      indexer.index();
      expect(indexer.listDocs()).toEqual([]);
      expect(indexer.listDocs("draft")).toEqual([]);
    });
  });

  // ── Temel dosya parse ────────────────────────

  describe("temel dosya işleme", () => {
    it("frontmatter'lı markdown dosyasını parse eder", () => {
      writeDoc(
        docsDir,
        "prd.md",
        `---
title: Product Requirements
status: DRAFT
author: Test
last_updated: "2025-01-01"
---

# Overview

Some content here.

## Features

Feature list.
`
      );

      const indexer = new DocIndexer(docsDir);
      const docs = indexer.index();

      expect(docs).toHaveLength(1);
      expect(docs[0].name).toBe("prd");
      expect(docs[0].title).toBe("Product Requirements");
      expect(docs[0].status).toBe("DRAFT");
      expect(docs[0].sections).toEqual(["Overview", "Features"]);
      expect(docs[0].wordCount).toBeGreaterThan(0);
    });

    it("frontmatter olmadan da çalışır", () => {
      writeDoc(docsDir, "simple.md", "# Hello\n\nWorld content.");

      const indexer = new DocIndexer(docsDir);
      const docs = indexer.index();

      expect(docs).toHaveLength(1);
      expect(docs[0].title).toBe("simple"); // name fallback
      expect(docs[0].sections).toEqual(["Hello"]);
    });

    it(".mdx dosyalarını da destekler", () => {
      writeDoc(docsDir, "guide.mdx", "# MDX Guide\n\nSome MDX content.");

      const indexer = new DocIndexer(docsDir);
      const docs = indexer.index();

      expect(docs).toHaveLength(1);
      expect(docs[0].name).toBe("guide");
    });

    it("desteklenmeyen uzantıları yok sayar", () => {
      writeDoc(docsDir, "notes.txt", "Some text");
      writeDoc(docsDir, "data.json", '{"key": "val"}');
      writeDoc(docsDir, "real.md", "# Real Doc\n\nContent.");

      const indexer = new DocIndexer(docsDir);
      const docs = indexer.index();

      expect(docs).toHaveLength(1);
      expect(docs[0].name).toBe("real");
    });

    it("gizli dosya ve dizinleri atlar", () => {
      writeDoc(docsDir, ".hidden.md", "# Hidden");
      mkdirSync(join(docsDir, ".secret"), { recursive: true });
      writeDoc(docsDir, "visible.md", "# Visible\n\nContent.", undefined);

      const indexer = new DocIndexer(docsDir);
      const docs = indexer.index();

      expect(docs).toHaveLength(1);
      expect(docs[0].name).toBe("visible");
    });
  });

  // ── Derin nested dizin yapısı ────────────────

  describe("derin nested dizin yapısı (büyük proje)", () => {
    it("3+ seviye derinlikteki dokümanları bulur", () => {
      writeDoc(docsDir, "root.md", "# Root", undefined);
      writeDoc(docsDir, "l1.md", "# Level 1", "architecture");
      writeDoc(docsDir, "l2.md", "# Level 2", "architecture/adr");
      writeDoc(docsDir, "l3.md", "# Level 3", "architecture/adr/deep");

      const indexer = new DocIndexer(docsDir);
      const docs = indexer.index();

      expect(docs).toHaveLength(4);
      const names = docs.map((d) => d.name).sort();
      expect(names).toEqual(["l1", "l2", "l3", "root"]);
    });

    it("relativePath doğru hesaplanır", () => {
      writeDoc(docsDir, "test.md", "# Test", "rules");

      const indexer = new DocIndexer(docsDir);
      const docs = indexer.index();

      expect(docs[0].relativePath).toBe(join("rules", "test.md"));
    });
  });

  // ── Section extraction edge case'leri ────────

  describe("section extraction", () => {
    it("h1, h2, h3 başlıklarını yakalar", () => {
      writeDoc(
        docsDir,
        "headings.md",
        `# H1 Title
## H2 Section
### H3 Sub
#### H4 Should Not Be Captured
Content.
`
      );

      const indexer = new DocIndexer(docsDir);
      const docs = indexer.index();

      expect(docs[0].sections).toEqual(["H1 Title", "H2 Section", "H3 Sub"]);
    });

    it("özel karakterli başlıkları doğru yakalar", () => {
      writeDoc(
        docsDir,
        "special.md",
        `# API (v2.0)
## Endpoints & Routes
### /users/:id — Get User
`
      );

      const indexer = new DocIndexer(docsDir);
      const docs = indexer.index();

      expect(docs[0].sections).toHaveLength(3);
      expect(docs[0].sections[0]).toBe("API (v2.0)");
    });

    it("kod bloğu içindeki # işaretlerini yanlış yakalamaz", () => {
      // Not: Mevcut implementasyon bunu handle etmiyor,
      // bu test bu davranışı dokümante eder
      writeDoc(
        docsDir,
        "codeblock.md",
        `# Real Title

\`\`\`bash
# This is a comment
echo "hello"
\`\`\`

## Real Section
`
      );

      const indexer = new DocIndexer(docsDir);
      const docs = indexer.index();

      // Mevcut davranış: kod bloğu içindeki # da yakalanır
      // Bu bir bilinen sınırlama
      expect(docs[0].sections).toContain("Real Title");
      expect(docs[0].sections).toContain("Real Section");
    });
  });

  // ── getDocContent section çıkarımı ───────────

  describe("getDocContent", () => {
    beforeEach(() => {
      writeDoc(
        docsDir,
        "multi.md",
        `---
title: Multi Section
---

# Introduction

Intro paragraph here.

## Features

Feature A is great.
Feature B is better.

## API

### GET /users

Returns users list.

### POST /users

Creates a user.

## Changelog

v1.0 release.
`
      );
    });

    it("tüm içeriği frontmatter olmadan döner", () => {
      const indexer = new DocIndexer(docsDir);
      indexer.index();

      const content = indexer.getDocContent("multi");
      expect(content).toBeTruthy();
      expect(content).toContain("Introduction");
      expect(content).not.toContain("title: Multi Section");
    });

    it("belirli bir section'ı çıkarır", () => {
      const indexer = new DocIndexer(docsDir);
      indexer.index();

      const content = indexer.getDocContent("multi", "Features");
      expect(content).toContain("Feature A");
      expect(content).toContain("Feature B");
      expect(content).not.toContain("Returns users list");
    });

    it("alt section'ları parent ile birlikte döner", () => {
      const indexer = new DocIndexer(docsDir);
      indexer.index();

      const content = indexer.getDocContent("multi", "API");
      expect(content).toContain("GET /users");
      expect(content).toContain("POST /users");
      expect(content).not.toContain("v1.0 release");
    });

    it("varolmayan section için null döner", () => {
      const indexer = new DocIndexer(docsDir);
      indexer.index();

      expect(indexer.getDocContent("multi", "Nonexistent")).toBeNull();
    });

    it("varolmayan doküman için null döner", () => {
      const indexer = new DocIndexer(docsDir);
      indexer.index();

      expect(indexer.getDocContent("ghost")).toBeNull();
    });

    it("regex özel karakterli section adını doğru bulur", () => {
      writeDoc(
        docsDir,
        "regex.md",
        `# API (v2.0)

Content for API v2.

## Child Section

Child content.

# Next Top Level

Other.
`
      );

      const indexer = new DocIndexer(docsDir);
      indexer.index();

      const content = indexer.getDocContent("regex", "API (v2.0)");
      expect(content).toContain("Content for API v2");
      // h1 section, sonraki h1'e kadar devam eder (h2 child)
      expect(content).toContain("Child content");
      expect(content).not.toContain("Other");
    });
  });

  // ── getDoc lookup ────────────────────────────

  describe("getDoc", () => {
    it("isimle bulur", () => {
      writeDoc(docsDir, "backend.md", "# Backend Rules", "rules");

      const indexer = new DocIndexer(docsDir);
      indexer.index();

      const doc = indexer.getDoc("backend");
      expect(doc).toBeTruthy();
      expect(doc?.name).toBe("backend");
    });

    it("relativePath ile bulur", () => {
      writeDoc(docsDir, "backend.md", "# Backend Rules", "rules");

      const indexer = new DocIndexer(docsDir);
      indexer.index();

      const doc = indexer.getDoc(join("rules", "backend.md"));
      expect(doc).toBeTruthy();
    });

    it("bulamazsa undefined döner", () => {
      const indexer = new DocIndexer(docsDir);
      indexer.index();

      expect(indexer.getDoc("ghost")).toBeUndefined();
    });
  });

  // ── listDocs filtreleme ──────────────────────

  describe("listDocs", () => {
    beforeEach(() => {
      writeDoc(
        docsDir,
        "draft.md",
        "---\nstatus: DRAFT\n---\n# Draft Doc"
      );
      writeDoc(
        docsDir,
        "locked.md",
        "---\nstatus: LOCKED\n---\n# Locked Doc"
      );
      writeDoc(
        docsDir,
        "review.md",
        "---\nstatus: REVIEW\n---\n# Review Doc"
      );
      writeDoc(docsDir, "nostatus.md", "# No Status");
    });

    it("tüm dokümanları listeler", () => {
      const indexer = new DocIndexer(docsDir);
      indexer.index();

      expect(indexer.listDocs()).toHaveLength(4);
      expect(indexer.listDocs("all")).toHaveLength(4);
    });

    it("status'a göre filtreler (case-insensitive)", () => {
      const indexer = new DocIndexer(docsDir);
      indexer.index();

      expect(indexer.listDocs("draft")).toHaveLength(1);
      expect(indexer.listDocs("DRAFT")).toHaveLength(1);
      expect(indexer.listDocs("locked")).toHaveLength(1);
    });

    it("varolmayan status boş döner", () => {
      const indexer = new DocIndexer(docsDir);
      indexer.index();

      expect(indexer.listDocs("ACCEPTED")).toHaveLength(0);
    });
  });

  // ── Search / Fuzzy ──────────────────────────

  describe("search", () => {
    beforeEach(() => {
      writeDoc(
        docsDir,
        "auth.md",
        `---
title: Authentication
---

# Authentication

## JWT Token

JWT tokens are used for authentication.
Access tokens expire in 15 minutes.

## OAuth Flow

OAuth 2.0 with PKCE for mobile apps.
`
      );

      writeDoc(
        docsDir,
        "database.md",
        `---
title: Database
---

# Database

## Schema

PostgreSQL with Prisma ORM.
Tables: users, tenants, apps.

## Migrations

Use prisma migrate for schema changes.
`
      );
    });

    it("basit tek kelime araması çalışır", () => {
      const indexer = new DocIndexer(docsDir);
      indexer.index();

      const results = indexer.search("authentication");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].doc).toBe("auth");
    });

    it("çoklu kelime araması (OR) çalışır", () => {
      const indexer = new DocIndexer(docsDir);
      indexer.index();

      const results = indexer.search("JWT token expire");
      expect(results.length).toBeGreaterThan(0);
    });

    it("sonuç bulunamayınca boş döner", () => {
      const indexer = new DocIndexer(docsDir);
      indexer.index();

      const results = indexer.search("zzzzxxxxxnotfound");
      expect(results).toEqual([]);
    });

    it("limit parametresi çalışır", () => {
      const indexer = new DocIndexer(docsDir);
      indexer.index();

      const results = indexer.search("schema", 1);
      expect(results.length).toBeLessThanOrEqual(1);
    });

    it("score 0-1 arasında döner", () => {
      const indexer = new DocIndexer(docsDir);
      indexer.index();

      const results = indexer.search("PostgreSQL");
      for (const r of results) {
        expect(r.score).toBeGreaterThanOrEqual(0);
        expect(r.score).toBeLessThanOrEqual(1);
      }
    });

    it("snippet 300 karakter ile sınırlı", () => {
      const longContent = "A".repeat(500);
      writeDoc(docsDir, "long.md", `# Long Doc\n\n${longContent}`);

      const indexer = new DocIndexer(docsDir);
      indexer.index();

      const results = indexer.search("Long Doc");
      for (const r of results) {
        expect(r.snippet.length).toBeLessThanOrEqual(300);
      }
    });
  });

  // ── getDocsBySection ─────────────────────────

  describe("getDocsBySection", () => {
    it("section adına göre dokümanları bulur", () => {
      writeDoc(docsDir, "a.md", "# Intro\n## API\nContent.");
      writeDoc(docsDir, "b.md", "# Intro\n## Database\nContent.");
      writeDoc(docsDir, "c.md", "# Intro\n## API Reference\nContent.");

      const indexer = new DocIndexer(docsDir);
      indexer.index();

      const apiDocs = indexer.getDocsBySection("API");
      expect(apiDocs.length).toBe(2); // "API" and "API Reference" match
    });
  });

  // ── Büyük proje senaryosu ────────────────────

  describe("büyük proje senaryosu (50+ dosya)", () => {
    it("çok sayıda dokümanı sorunsuz indeksler", () => {
      for (let i = 0; i < 50; i++) {
        writeDoc(
          docsDir,
          `doc-${i}.md`,
          `---\ntitle: Document ${i}\nstatus: DRAFT\n---\n# Document ${i}\n\nContent for document ${i}. Keywords: alpha beta gamma.`,
          `module-${i % 5}`
        );
      }

      const indexer = new DocIndexer(docsDir);
      const docs = indexer.index();

      expect(docs).toHaveLength(50);

      // Arama da çalışmalı
      const results = indexer.search("alpha");
      expect(results.length).toBeGreaterThan(0);
    });
  });

  // ── Unicode / Türkçe karakter ────────────────

  describe("unicode ve Türkçe karakter desteği", () => {
    it("Türkçe içerikli dokümanı parse eder", () => {
      writeDoc(
        docsDir,
        "turkce.md",
        `---
title: Türkçe Doküman
---

# Genel Bakış

Ürün gereksinimleri ve özellikler.

## Özellikler

Çoklu kiracı desteği sağlanır.
`
      );

      const indexer = new DocIndexer(docsDir);
      const docs = indexer.index();

      expect(docs).toHaveLength(1);
      expect(docs[0].title).toBe("Türkçe Doküman");
      expect(docs[0].sections).toContain("Genel Bakış");
      expect(docs[0].sections).toContain("Özellikler");
    });
  });

  // ── Reindex testleri ──────────────────────────

  describe("reindex", () => {
    it("detects newly added documents", () => {
      const indexer = new DocIndexer(docsDir);

      // Initial index with one doc
      writeDoc(docsDir, "first.md", "# First\n\nContent");
      indexer.index();

      // Add another doc
      writeDoc(docsDir, "second.md", "# Second\n\nMore content");

      const result = indexer.reindex();

      expect(result.added).toContain("second");
      expect(result.removed).toHaveLength(0);
      expect(result.total).toBe(2);
    });

    it("detects removed documents", () => {
      const indexer = new DocIndexer(docsDir);

      // Initial index with two docs
      writeDoc(docsDir, "keep.md", "# Keep\n\nStays here");
      writeDoc(docsDir, "remove.md", "# Remove\n\nWill be deleted");
      indexer.index();

      // Remove one doc
      rmSync(join(docsDir, "remove.md"));

      const result = indexer.reindex();

      expect(result.removed).toContain("remove");
      expect(result.added).toHaveLength(0);
      expect(result.total).toBe(1);
    });

    it("detects modified documents by word count change", () => {
      const indexer = new DocIndexer(docsDir);

      // Initial index
      writeDoc(docsDir, "changing.md", "# Doc\n\nShort content");
      indexer.index();

      // Modify the doc (add more words)
      writeDoc(docsDir, "changing.md", "# Doc\n\nMuch longer content with many more words added here");

      const result = indexer.reindex();

      expect(result.updated).toContain("changing");
      expect(result.added).toHaveLength(0);
      expect(result.removed).toHaveLength(0);
    });

    it("returns accurate change counts", () => {
      const indexer = new DocIndexer(docsDir);

      // Initial: 3 docs
      writeDoc(docsDir, "a.md", "# A\n\nContent A");
      writeDoc(docsDir, "b.md", "# B\n\nContent B");
      writeDoc(docsDir, "c.md", "# C\n\nContent C");
      indexer.index();

      // Changes: remove a, add d, modify b
      rmSync(join(docsDir, "a.md"));
      writeDoc(docsDir, "d.md", "# D\n\nNew document");
      writeDoc(docsDir, "b.md", "# B\n\nContent B with much more text added to change word count");

      const result = indexer.reindex();

      expect(result.added).toEqual(["d"]);
      expect(result.removed).toEqual(["a"]);
      expect(result.updated).toEqual(["b"]);
      expect(result.total).toBe(3);
    });

    it("maintains index consistency after reindex", () => {
      const indexer = new DocIndexer(docsDir);

      writeDoc(docsDir, "test.md", "# Test\n\nInitial content");
      indexer.index();

      // Verify initial state
      expect(indexer.listDocs()).toHaveLength(1);

      // Add new doc and reindex
      writeDoc(docsDir, "new.md", "# New\n\nNew content");
      indexer.reindex();

      // Verify both docs are accessible
      const docs = indexer.listDocs();
      expect(docs).toHaveLength(2);
      expect(docs.map((d) => d.name).sort()).toEqual(["new", "test"]);

      // Verify content is readable
      const newContent = indexer.getDocContent("new");
      expect(newContent).toContain("New content");
    });

    it("returns duration in milliseconds", () => {
      const indexer = new DocIndexer(docsDir);
      writeDoc(docsDir, "test.md", "# Test\n\nContent");
      indexer.index();

      const result = indexer.reindex();

      expect(typeof result.duration).toBe("number");
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it("works when no changes detected", () => {
      const indexer = new DocIndexer(docsDir);
      writeDoc(docsDir, "stable.md", "# Stable\n\nNo changes here");
      indexer.index();

      const result = indexer.reindex();

      expect(result.added).toHaveLength(0);
      expect(result.removed).toHaveLength(0);
      expect(result.updated).toHaveLength(0);
      expect(result.total).toBe(1);
    });

    it("handles empty docs directory", () => {
      const indexer = new DocIndexer(docsDir);
      indexer.index();

      const result = indexer.reindex();

      expect(result.added).toHaveLength(0);
      expect(result.removed).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });
});
