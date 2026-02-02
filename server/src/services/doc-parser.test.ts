import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { DocParser } from "./doc-parser.js";

function makeTmpDir(): string {
  const dir = join(tmpdir(), `mags-parser-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("DocParser", () => {
  let tmpDir: string;
  let parser: DocParser;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    parser = new DocParser();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("markdown parsing", () => {
    it("parses frontmatter metadata", () => {
      const filePath = join(tmpDir, "test.md");
      writeFileSync(
        filePath,
        "---\ntitle: My Doc\nstatus: DRAFT\nauthor: Test\n---\n\n# Introduction\n\nHello world.\n",
        "utf-8"
      );

      const result = parser.parse(filePath);
      expect(result.metadata.title).toBe("My Doc");
      expect(result.metadata.status).toBe("DRAFT");
      expect(result.metadata.author).toBe("Test");
    });

    it("extracts markdown sections from headings", () => {
      const filePath = join(tmpDir, "test.md");
      writeFileSync(
        filePath,
        "---\ntitle: Test\n---\n\n# Introduction\n\nText.\n\n## Overview\n\nMore text.\n\n### Details\n\nEven more.\n",
        "utf-8"
      );

      const result = parser.parse(filePath);
      expect(result.sections).toContain("Introduction");
      expect(result.sections).toContain("Overview");
      expect(result.sections).toContain("Details");
    });

    it("returns empty metadata when no frontmatter", () => {
      const filePath = join(tmpDir, "test.md");
      writeFileSync(filePath, "# Just a heading\n\nSome content.\n", "utf-8");

      const result = parser.parse(filePath);
      expect(result.metadata).toEqual({});
    });

    it("returns content without frontmatter", () => {
      const filePath = join(tmpDir, "test.md");
      writeFileSync(filePath, "---\ntitle: Test\n---\n\n# Hello\n\nWorld.\n", "utf-8");

      const result = parser.parse(filePath);
      expect(result.content).toContain("# Hello");
      expect(result.content).toContain("World.");
      expect(result.content).not.toContain("title: Test");
    });

    it("handles mdx extension", () => {
      const filePath = join(tmpDir, "test.mdx");
      writeFileSync(filePath, "---\ntitle: MDX Doc\n---\n\n# Hello MDX\n", "utf-8");

      const result = parser.parse(filePath);
      expect(result.metadata.title).toBe("MDX Doc");
      expect(result.sections).toContain("Hello MDX");
    });

    it("handles empty markdown file", () => {
      const filePath = join(tmpDir, "empty.md");
      writeFileSync(filePath, "", "utf-8");

      const result = parser.parse(filePath);
      expect(result.metadata).toEqual({});
      expect(result.sections).toEqual([]);
      expect(result.content).toBe("");
    });
  });

  describe("markdown parseFromString", () => {
    it("parses markdown from string", () => {
      const result = parser.parseFromString(
        "---\ntitle: String Test\n---\n\n# Section One\n\nContent.\n",
        "md"
      );
      expect(result.metadata.title).toBe("String Test");
      expect(result.sections).toContain("Section One");
    });
  });

  describe("RST parsing", () => {
    it("extracts RST title from underline pattern", () => {
      const filePath = join(tmpDir, "test.rst");
      writeFileSync(
        filePath,
        "My Document Title\n==================\n\nSome content here.\n",
        "utf-8"
      );

      const result = parser.parse(filePath);
      expect(result.metadata.title).toBe("My Document Title");
    });

    it("extracts RST field list metadata", () => {
      const filePath = join(tmpDir, "test.rst");
      writeFileSync(
        filePath,
        ":author: John Doe\n:version: 1.0\n\nMy Title\n========\n\nContent.\n",
        "utf-8"
      );

      const result = parser.parse(filePath);
      expect(result.metadata.author).toBe("John Doe");
      expect(result.metadata.version).toBe("1.0");
    });

    it("extracts RST sections from underline chars", () => {
      const filePath = join(tmpDir, "test.rst");
      writeFileSync(
        filePath,
        "Main Title\n==========\n\nIntro text.\n\nSubsection\n----------\n\nMore text.\n\nAnother\n~~~~~~~\n\nEnd.\n",
        "utf-8"
      );

      const result = parser.parse(filePath);
      expect(result.sections).toContain("Main Title");
      expect(result.sections).toContain("Subsection");
      expect(result.sections).toContain("Another");
    });

    it("strips field list metadata from content", () => {
      const filePath = join(tmpDir, "test.rst");
      writeFileSync(
        filePath,
        ":author: John\n\nMain Title\n==========\n\nContent.\n",
        "utf-8"
      );

      const result = parser.parse(filePath);
      expect(result.content).not.toContain(":author: John");
    });
  });

  describe("RST parseFromString", () => {
    it("parses RST from string", () => {
      const result = parser.parseFromString(
        ":status: draft\n\nDocument\n========\n\nContent here.\n",
        "rst"
      );
      expect(result.metadata.status).toBe("draft");
      expect(result.sections).toContain("Document");
    });
  });

  describe("AsciiDoc parsing", () => {
    it("extracts AsciiDoc attributes as metadata", () => {
      const filePath = join(tmpDir, "test.adoc");
      writeFileSync(
        filePath,
        ":author: Jane Doe\n:version: 2.0\n\n= My AsciiDoc Title\n\n== First Section\n\nContent.\n",
        "utf-8"
      );

      const result = parser.parse(filePath);
      expect(result.metadata.author).toBe("Jane Doe");
      expect(result.metadata.version).toBe("2.0");
    });

    it("handles empty-value AsciiDoc attributes", () => {
      const filePath = join(tmpDir, "test.adoc");
      writeFileSync(
        filePath,
        ":toc:\n\n= Title\n\nContent.\n",
        "utf-8"
      );

      const result = parser.parse(filePath);
      // :toc: with no value — parser stores it as truthy (true or empty-like)
      expect(result.metadata).toHaveProperty("toc");
    });

    it("extracts AsciiDoc title from = heading", () => {
      const filePath = join(tmpDir, "test.adoc");
      writeFileSync(filePath, "= My Document Title\n\n== Section One\n\nText.\n", "utf-8");

      const result = parser.parse(filePath);
      expect(result.metadata.title).toBe("My Document Title");
    });

    it("extracts AsciiDoc sections from == headings", () => {
      const filePath = join(tmpDir, "test.adoc");
      writeFileSync(
        filePath,
        "= Title\n\n== Introduction\n\nText.\n\n== Overview\n\nMore text.\n\n=== Details\n\nDeep.\n",
        "utf-8"
      );

      const result = parser.parse(filePath);
      expect(result.sections).toContain("Introduction");
      expect(result.sections).toContain("Overview");
      expect(result.sections).toContain("Details");
    });

    it("strips attribute header from content", () => {
      const filePath = join(tmpDir, "test.adoc");
      writeFileSync(
        filePath,
        ":author: Jane\n:version: 1.0\n\n= Title\n\n== Content Section\n\nHello.\n",
        "utf-8"
      );

      const result = parser.parse(filePath);
      expect(result.content).not.toContain(":author: Jane");
      expect(result.content).toContain("Content Section");
    });
  });

  describe("AsciiDoc parseFromString", () => {
    it("parses AsciiDoc from string", () => {
      const result = parser.parseFromString(
        ":status: review\n\n= Title\n\n== Section A\n\nContent.\n",
        "adoc"
      );
      expect(result.metadata.status).toBe("review");
      expect(result.sections).toContain("Section A");
    });
  });

  describe("unsupported format handling", () => {
    it("falls back to markdown parsing for unknown extensions", () => {
      const filePath = join(tmpDir, "test.txt");
      writeFileSync(filePath, "---\ntitle: Text File\n---\n\n# Heading\n\nContent.\n", "utf-8");

      const result = parser.parse(filePath);
      expect(result.metadata.title).toBe("Text File");
      expect(result.sections).toContain("Heading");
    });
  });
});
