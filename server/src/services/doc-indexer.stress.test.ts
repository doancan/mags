/**
 * DocIndexer — Zorlu & Stres Testleri
 *
 * Gerçek dünya senaryoları:
 * - Dev bir monorepo (200+ dosya, derin hiyerarşi)
 * - Bozuk / garip dosyalar (binary, boş, çok büyük)
 * - Section extraction karmaşık kenar durumları
 * - Re-index tutarlılığı
 * - Aynı isimli dosyalar farklı dizinlerde
 * - Frontmatter edge case'leri
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdirSync,
  writeFileSync,
  rmSync,
  symlinkSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { DocIndexer } from "./doc-indexer.js";

function tmp(): string {
  const d = join(tmpdir(), `mags-di-stress-${randomUUID()}`);
  mkdirSync(d, { recursive: true });
  return d;
}

function writeDoc(base: string, name: string, content: string, sub?: string) {
  const dir = sub ? join(base, sub) : base;
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), content, "utf-8");
}

describe("DocIndexer — Zorlu Testler", () => {
  let dir: string;
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  // ─────────────────────────────────────────────
  // 1. Dev monorepo senaryosu
  // ─────────────────────────────────────────────

  describe("dev monorepo (200 dosya, 10 seviye derinlik)", () => {
    beforeEach(() => {
      dir = tmp();
      // 200 dosya, 10 modül × 4 alt dizin × 5 dosya
      for (let mod = 0; mod < 10; mod++) {
        for (let sub = 0; sub < 4; sub++) {
          for (let f = 0; f < 5; f++) {
            const path = `mod-${mod}/sub-${sub}`;
            writeDoc(
              dir,
              `doc-${f}.md`,
              `---\ntitle: M${mod} S${sub} D${f}\nstatus: ${
                f % 2 === 0 ? "DRAFT" : "LOCKED"
              }\ntags:\n  - mod${mod}\n  - sub${sub}\n---\n\n# Module ${mod} Sub ${sub} Doc ${f}\n\n## Overview\n\nContent for module ${mod}, sub ${sub}, document ${f}. Keyword alpha-${mod}-${sub}-${f}.\n\n## Details\n\nMore detailed content here with specific term beta-${mod}.\n\n### Sub Details\n\nDeep content gamma-${f}.\n`,
              path
            );
          }
        }
      }
    });

    it("200 dosyayı sorunsuz indeksler", () => {
      const ix = new DocIndexer(dir);
      const docs = ix.index();
      expect(docs).toHaveLength(200);
    });

    it("status filtreleme 200 dosya üzerinde doğru çalışır", () => {
      const ix = new DocIndexer(dir);
      ix.index();
      const drafts = ix.listDocs("DRAFT");
      const locked = ix.listDocs("LOCKED");
      expect(drafts.length + locked.length).toBe(200);
      // f=0,2,4 → DRAFT (3/5 = 120), f=1,3 → LOCKED (2/5 = 80)
      expect(drafts).toHaveLength(120);
      expect(locked).toHaveLength(80);
    });

    it("hedefli arama 200 dosya içinden doğru sonucu bulur", () => {
      const ix = new DocIndexer(dir);
      ix.index();
      const results = ix.search("alpha-7-2-3");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].snippet).toContain("alpha-7-2-3");
    });

    it("genel arama tüm modüllerde sonuç döner", () => {
      const ix = new DocIndexer(dir);
      ix.index();
      const results = ix.search("Overview", 20);
      expect(results.length).toBe(20); // limit çalışır
    });

    it("getDocsBySection 200 dosyada performanslı çalışır", () => {
      const ix = new DocIndexer(dir);
      ix.index();
      const start = Date.now();
      const results = ix.getDocsBySection("Details");
      expect(Date.now() - start).toBeLessThan(200);
      expect(results.length).toBe(200); // hepsinde "Details" var
    });
  });

  // ─────────────────────────────────────────────
  // 2. Bozuk / garip dosyalar
  // ─────────────────────────────────────────────

  describe("bozuk ve garip dosyalar", () => {
    beforeEach(() => {
      dir = tmp();
    });

    it("binary içerik sessizce atlanır veya parse edilir", () => {
      const buf = Buffer.alloc(512, 0xff);
      writeFileSync(join(dir, "binary.md"), buf);
      writeDoc(dir, "good.md", "# Good\n\nContent.");

      const ix = new DocIndexer(dir);
      const docs = ix.index();
      // binary dosya ya atlanır ya parse edilir (hata vermemeli)
      expect(docs.length).toBeGreaterThanOrEqual(1);
      expect(docs.some((d) => d.name === "good")).toBe(true);
    });

    it("tamamen boş dosya crash etmez", () => {
      writeFileSync(join(dir, "empty.md"), "");
      writeDoc(dir, "ok.md", "# OK\n\nFine.");

      const ix = new DocIndexer(dir);
      const docs = ix.index();
      expect(docs.length).toBeGreaterThanOrEqual(1);
    });

    it("sadece frontmatter, içerik yok", () => {
      writeDoc(
        dir,
        "frontonly.md",
        "---\ntitle: Only Front\nstatus: DRAFT\n---\n"
      );

      const ix = new DocIndexer(dir);
      const docs = ix.index();
      expect(docs).toHaveLength(1);
      expect(docs[0].title).toBe("Only Front");
      expect(docs[0].sections).toEqual([]);
      expect(docs[0].wordCount).toBe(0);
    });

    it("frontmatter delimiter eksik (açık ama kapanmamış)", () => {
      writeDoc(dir, "broken-fm.md", "---\ntitle: Broken\n# Content\n\nText.");

      const ix = new DocIndexer(dir);
      const docs = ix.index();
      // gray-matter bu durumu handle eder
      expect(docs.length).toBeGreaterThanOrEqual(0); // crash olmamalı
    });

    it("çok büyük tek dosya (100KB+)", () => {
      const bigContent =
        "---\ntitle: Big\n---\n\n# Big Doc\n\n" +
        "Lorem ipsum dolor sit amet. ".repeat(5000);
      writeDoc(dir, "big.md", bigContent);

      const ix = new DocIndexer(dir);
      const docs = ix.index();
      expect(docs).toHaveLength(1);
      expect(docs[0].wordCount).toBeGreaterThan(10000);
    });

    it("sadece newline'lardan oluşan dosya", () => {
      writeDoc(dir, "newlines.md", "\n\n\n\n\n");

      const ix = new DocIndexer(dir);
      const docs = ix.index();
      // Hata vermemeli
      expect(docs).toHaveLength(1);
      expect(docs[0].wordCount).toBe(0);
    });

    it("unicode BOM ile başlayan dosya", () => {
      writeDoc(dir, "bom.md", "\uFEFF# BOM Doc\n\nContent after BOM.");

      const ix = new DocIndexer(dir);
      const docs = ix.index();
      expect(docs).toHaveLength(1);
    });
  });

  // ─────────────────────────────────────────────
  // 3. Section extraction karmaşık senaryolar
  // ─────────────────────────────────────────────

  describe("section extraction — karmaşık senaryolar", () => {
    beforeEach(() => {
      dir = tmp();
    });

    it("aynı isimli section birden fazla kez geçerse ilkini döner", () => {
      writeDoc(
        dir,
        "dupsec.md",
        `# Doc

## Overview

First overview content.

## Details

Some details.

## Overview

Second overview — should NOT be returned.
`
      );

      const ix = new DocIndexer(dir);
      ix.index();
      const content = ix.getDocContent("dupsec", "Overview");
      expect(content).toContain("First overview");
      expect(content).not.toContain("Second overview");
    });

    it("deeply nested section hierarchy (h1 > h2 > h3)", () => {
      writeDoc(
        dir,
        "deep.md",
        `# Root

## Chapter 1

### Section 1.1

Content 1.1

### Section 1.2

Content 1.2

## Chapter 2

### Section 2.1

Content 2.1

# Another Root
`
      );

      const ix = new DocIndexer(dir);
      ix.index();

      // h2 "Chapter 1" → h2 "Chapter 2"'ye kadar alır
      const ch1 = ix.getDocContent("deep", "Chapter 1");
      expect(ch1).toContain("Section 1.1");
      expect(ch1).toContain("Section 1.2");
      expect(ch1).not.toContain("Content 2.1");

      // h3 "Section 1.1" → sonraki h3 "Section 1.2"'ye kadar
      const s11 = ix.getDocContent("deep", "Section 1.1");
      expect(s11).toContain("Content 1.1");
      expect(s11).not.toContain("Content 1.2");
    });

    it("son section doküman sonuna kadar alınır", () => {
      writeDoc(
        dir,
        "lastsec.md",
        `# Title

## First

First content.

## Last

Last content that goes to EOF.
No more headings after this.
Really, no more.
`
      );

      const ix = new DocIndexer(dir);
      ix.index();
      const content = ix.getDocContent("lastsec", "Last");
      expect(content).toContain("goes to EOF");
      expect(content).toContain("Really, no more");
    });

    it("heading ile aynı satırda başka metin yok", () => {
      writeDoc(
        dir,
        "inline.md",
        `# Title With **Bold** and \`code\`

## Section (v2)

Content.
`
      );

      const ix = new DocIndexer(dir);
      ix.index();
      expect(ix.getDocContent("inline", "Section (v2)")).toContain("Content");
    });

    it("100+ section'lı dev doküman", () => {
      let content = "---\ntitle: Mega\n---\n\n";
      for (let i = 0; i < 100; i++) {
        content += `## Section ${i}\n\nContent for section ${i}.\n\n`;
      }
      writeDoc(dir, "mega.md", content);

      const ix = new DocIndexer(dir);
      const docs = ix.index();
      expect(docs[0].sections).toHaveLength(100);

      // Ortadaki section'a erişim
      const s50 = ix.getDocContent("mega", "Section 50");
      expect(s50).toContain("Content for section 50");
      expect(s50).not.toContain("Content for section 51");
    });

    it("heading'den hemen sonra heading (boş section)", () => {
      writeDoc(
        dir,
        "emptysec.md",
        `# Title

## Empty Section
## Non-Empty Section

Content here.
`
      );

      const ix = new DocIndexer(dir);
      ix.index();

      const empty = ix.getDocContent("emptysec", "Empty Section");
      expect(empty).toBeTruthy();
      expect(empty).not.toContain("Content here");
    });
  });

  // ─────────────────────────────────────────────
  // 4. Re-index tutarlılığı
  // ─────────────────────────────────────────────

  describe("re-index tutarlılığı", () => {
    beforeEach(() => {
      dir = tmp();
    });

    it("art arda index() çağrıları dosyaları çoğaltmaz", () => {
      writeDoc(dir, "a.md", "# A\n\nContent.");

      const ix = new DocIndexer(dir);
      ix.index();
      ix.index();
      ix.index();

      expect(ix.listDocs()).toHaveLength(1);
    });

    it("dosya eklenince re-index yeni dosyayı algılar", () => {
      writeDoc(dir, "a.md", "# A\n\nContent.");

      const ix = new DocIndexer(dir);
      ix.index();
      expect(ix.listDocs()).toHaveLength(1);

      writeDoc(dir, "b.md", "# B\n\nNew content.");
      ix.index();
      expect(ix.listDocs()).toHaveLength(2);
    });

    it("dosya silinince re-index eski dosyayı çıkarır", () => {
      writeDoc(dir, "a.md", "# A\n\nContent.");
      writeDoc(dir, "b.md", "# B\n\nContent.");

      const ix = new DocIndexer(dir);
      ix.index();
      expect(ix.listDocs()).toHaveLength(2);

      rmSync(join(dir, "b.md"));
      ix.index();
      expect(ix.listDocs()).toHaveLength(1);
      expect(ix.listDocs()[0].name).toBe("a");
    });

    it("dosya içeriği değişince re-index yeni içeriği yansıtır", () => {
      writeDoc(dir, "mutable.md", "# V1\n\n## Old Section\n\nOld text.");

      const ix = new DocIndexer(dir);
      ix.index();
      expect(ix.listDocs()[0].sections).toContain("Old Section");

      writeFileSync(
        join(dir, "mutable.md"),
        "# V2\n\n## New Section\n\nNew text.",
        "utf-8"
      );
      ix.index();
      expect(ix.listDocs()[0].sections).toContain("New Section");
      expect(ix.listDocs()[0].sections).not.toContain("Old Section");
    });
  });

  // ─────────────────────────────────────────────
  // 5. Aynı isimli dosyalar farklı dizinlerde
  // ─────────────────────────────────────────────

  describe("aynı isimli dosyalar farklı dizinlerde", () => {
    beforeEach(() => {
      dir = tmp();
    });

    it("farklı dizinlerdeki aynı isimli dosyalar ayrı ayrı indekslenir", () => {
      writeDoc(dir, "readme.md", "# Frontend Readme", "frontend");
      writeDoc(dir, "readme.md", "# Backend Readme", "backend");
      writeDoc(dir, "readme.md", "# Root Readme");

      const ix = new DocIndexer(dir);
      const docs = ix.index();

      expect(docs).toHaveLength(3);
      // Hepsi "readme" adında ama farklı path
      const paths = docs.map((d) => d.relativePath);
      expect(new Set(paths).size).toBe(3);
    });

    it("getDoc aynı isimli dosyalarda ilk eşleşeni döner", () => {
      writeDoc(dir, "config.md", "# Config A", "a");
      writeDoc(dir, "config.md", "# Config B", "b");

      const ix = new DocIndexer(dir);
      ix.index();

      // name ile arama ilk eşleşeni bulur
      const doc = ix.getDoc("config");
      expect(doc).toBeTruthy();
    });

    it("relativePath ile tam yol araması benzersiz sonuç döner", () => {
      writeDoc(dir, "config.md", "---\ntitle: Config A\n---\n# Config A\n\nContent A.", "a");
      writeDoc(dir, "config.md", "---\ntitle: Config B\n---\n# Config B\n\nContent B.", "b");

      const ix = new DocIndexer(dir);
      ix.index();

      const docA = ix.getDoc(join("a", "config.md"));
      const docB = ix.getDoc(join("b", "config.md"));
      expect(docA?.title).toBe("Config A");
      expect(docB?.title).toBe("Config B");
    });
  });

  // ─────────────────────────────────────────────
  // 6. Frontmatter edge case'leri
  // ─────────────────────────────────────────────

  describe("frontmatter edge case'leri", () => {
    beforeEach(() => {
      dir = tmp();
    });

    it("boş frontmatter (sadece ---)", () => {
      writeDoc(dir, "empty-fm.md", "---\n---\n\n# Title\n\nContent.");

      const ix = new DocIndexer(dir);
      const docs = ix.index();
      expect(docs).toHaveLength(1);
      expect(docs[0].title).toBe("empty-fm"); // fallback to name
    });

    it("last_updated ve lastUpdated her ikisi de çalışır", () => {
      writeDoc(
        dir,
        "snake.md",
        '---\ntitle: Snake\nlast_updated: "2025-01-01"\n---\n\n# S'
      );
      writeDoc(
        dir,
        "camel.md",
        '---\ntitle: Camel\nlastUpdated: "2025-06-15"\n---\n\n# C'
      );

      const ix = new DocIndexer(dir);
      const docs = ix.index();

      const snake = docs.find((d) => d.name === "snake");
      const camel = docs.find((d) => d.name === "camel");
      expect(snake?.lastUpdated).toBe("2025-01-01");
      expect(camel?.lastUpdated).toBe("2025-06-15");
    });

    it("ekstra metadata alanları korunur", () => {
      writeDoc(
        dir,
        "extra.md",
        "---\ntitle: Extra\ncustom_field: hello\npriority: 5\n---\n\n# E"
      );

      const ix = new DocIndexer(dir);
      const docs = ix.index();
      expect((docs[0].metadata as any).custom_field).toBe("hello");
      expect((docs[0].metadata as any).priority).toBe(5);
    });

    it("YAML array tags doğru parse edilir", () => {
      writeDoc(
        dir,
        "tags.md",
        "---\ntitle: Tagged\ntags:\n  - auth\n  - security\n  - jwt\n---\n\n# T"
      );

      const ix = new DocIndexer(dir);
      const docs = ix.index();
      expect(docs[0].metadata.tags).toEqual(["auth", "security", "jwt"]);
    });

    it("çok satırlı frontmatter value", () => {
      writeDoc(
        dir,
        "multiline.md",
        '---\ntitle: "Multi\\nLine\\nTitle"\nauthor: >\n  John\n  Doe\n---\n\n# Content'
      );

      const ix = new DocIndexer(dir);
      const docs = ix.index();
      expect(docs).toHaveLength(1);
    });
  });

  // ─────────────────────────────────────────────
  // 7. Search — karmaşık senaryolar
  // ─────────────────────────────────────────────

  describe("search — karmaşık senaryolar", () => {
    beforeEach(() => {
      dir = tmp();
    });

    it("index öncesi search çağrılırsa otomatik buildSearchIndex çalışır", () => {
      writeDoc(dir, "a.md", "# Alpha\n\nAlpha content.");

      const ix = new DocIndexer(dir);
      ix.index();
      // fuse zaten build edildi, ama tekrar çağrılsa da sorun olmamalı
      const r = ix.search("Alpha");
      expect(r.length).toBeGreaterThan(0);
    });

    it("boş string araması boş döner veya tümünü döner (crash yok)", () => {
      writeDoc(dir, "a.md", "# A\n\nContent.");

      const ix = new DocIndexer(dir);
      ix.index();

      // Fuse.js boş string davranışı
      const r = ix.search("");
      // crash etmemeli
      expect(Array.isArray(r)).toBe(true);
    });

    it("sadece boşluklar (whitespace-only) araması", () => {
      writeDoc(dir, "a.md", "# A\n\nContent.");

      const ix = new DocIndexer(dir);
      ix.index();

      const r = ix.search("   ");
      expect(Array.isArray(r)).toBe(true);
    });

    it("özel regex karakterleri arama sorgusunda hata vermez", () => {
      writeDoc(dir, "a.md", "# Test\n\nSome (content) with [brackets].");

      const ix = new DocIndexer(dir);
      ix.index();

      // Bu karakterler Fuse.js extended search'te sorun çıkarabilir
      expect(() => ix.search("(content)")).not.toThrow();
      expect(() => ix.search("[brackets]")).not.toThrow();
      expect(() => ix.search("a.*b")).not.toThrow();
    });

    it("Türkçe arama terimleri çalışır", () => {
      writeDoc(
        dir,
        "tr.md",
        "# Türkçe\n\nÖzellik geliştirme ve şifreleme altyapısı."
      );

      const ix = new DocIndexer(dir);
      ix.index();

      const r = ix.search("şifreleme");
      expect(r.length).toBeGreaterThan(0);
    });

    it("çok uzun arama sorgusu crash etmez", () => {
      writeDoc(dir, "a.md", "# A\n\nContent.");

      const ix = new DocIndexer(dir);
      ix.index();

      const longQuery = "word ".repeat(100);
      expect(() => ix.search(longQuery)).not.toThrow();
    });
  });

  // ─────────────────────────────────────────────
  // 8. Symlink senaryosu
  // ─────────────────────────────────────────────

  describe("symlink", () => {
    beforeEach(() => {
      dir = tmp();
    });

    it("symlink'li dosya okunabilir", () => {
      writeDoc(dir, "real.md", "# Real\n\nReal content.");
      const linkDir = join(dir, "linked");
      mkdirSync(linkDir, { recursive: true });

      try {
        symlinkSync(join(dir, "real.md"), join(linkDir, "alias.md"));
      } catch {
        // Symlink desteklenmiyorsa testi atla
        return;
      }

      const ix = new DocIndexer(dir);
      const docs = ix.index();
      expect(docs.length).toBeGreaterThanOrEqual(1);
    });
  });
});
