import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { TemplateEngine } from "./template-engine.js";

function makeTmpDir(): string {
  const dir = join(tmpdir(), `mags-tpl-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("TemplateEngine", () => {
  let pluginRoot: string;
  let templateDir: string;

  beforeEach(() => {
    pluginRoot = makeTmpDir();
    templateDir = join(pluginRoot, "templates", "docs");
    mkdirSync(templateDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(pluginRoot, { recursive: true, force: true });
  });

  // ── Empty / no templates ──────────────────────

  describe("template yok senaryosu", () => {
    it("templates dizini yokken boş liste döner", () => {
      const emptyRoot = makeTmpDir();
      const engine = new TemplateEngine(emptyRoot);

      expect(engine.listTemplates()).toEqual([]);

      rmSync(emptyRoot, { recursive: true, force: true });
    });

    it("varolmayan template için render null döner", () => {
      const engine = new TemplateEngine(pluginRoot);
      expect(engine.render("nonexistent", {})).toBeNull();
    });

    it("varolmayan template için getTemplate undefined döner", () => {
      const engine = new TemplateEngine(pluginRoot);
      expect(engine.getTemplate("ghost")).toBeUndefined();
    });
  });

  // ── Template loading ─────────────────────────

  describe("template yükleme", () => {
    it(".md template'i yükler", () => {
      writeFileSync(
        join(templateDir, "prd.md"),
        `<!-- Product Requirements Document -->
---
title: "{{title}}"
status: DRAFT
---

# {{title}}

## Overview

{{description}}
`,
        "utf-8"
      );

      const engine = new TemplateEngine(pluginRoot);
      const templates = engine.listTemplates();

      expect(templates).toHaveLength(1);
      expect(templates[0].name).toBe("prd");
      expect(templates[0].description).toBe("Product Requirements Document");
    });

    it(".hbs template'i de yükler", () => {
      writeFileSync(
        join(templateDir, "adr.hbs"),
        `# ADR: {{title}}

## Context

{{context}}
`,
        "utf-8"
      );

      const engine = new TemplateEngine(pluginRoot);
      expect(engine.getTemplate("adr")).toBeTruthy();
    });

    it("desteklenmeyen uzantıları yok sayar", () => {
      writeFileSync(join(templateDir, "notes.txt"), "not a template", "utf-8");
      writeFileSync(join(templateDir, "real.md"), "# Real\n\n{{content}}", "utf-8");

      const engine = new TemplateEngine(pluginRoot);
      expect(engine.listTemplates()).toHaveLength(1);
    });
  });

  // ── Variable extraction ──────────────────────

  describe("variable extraction", () => {
    it("template'den değişkenleri çıkarır", () => {
      writeFileSync(
        join(templateDir, "doc.md"),
        `# {{title}}

Author: {{author}}
Module: {{module}}
`,
        "utf-8"
      );

      const engine = new TemplateEngine(pluginRoot);
      const templates = engine.listTemplates();
      const vars = templates[0].variables;

      expect(vars.map((v) => v.name)).toContain("title");
      expect(vars.map((v) => v.name)).toContain("author");
      expect(vars.map((v) => v.name)).toContain("module");
    });

    it("built-in helper'ları filtreler (if, each, unless, with, date, year)", () => {
      writeFileSync(
        join(templateDir, "complex.md"),
        `# {{title}}

Date: {{date}}
Year: {{year}}

{{#if active}}Active{{/if}}
{{#each items}}{{this}}{{/each}}
`,
        "utf-8"
      );

      const engine = new TemplateEngine(pluginRoot);
      const vars = engine.listTemplates()[0].variables;
      const names = vars.map((v) => v.name);

      expect(names).toContain("title");
      expect(names).not.toContain("date");
      expect(names).not.toContain("year");
      expect(names).not.toContain("if");
      expect(names).not.toContain("each");
    });
  });

  // ── Render ───────────────────────────────────

  describe("render", () => {
    it("değişkenleri yerleştirir", () => {
      writeFileSync(
        join(templateDir, "simple.md"),
        `# {{title}}

Author: {{author}}
`,
        "utf-8"
      );

      const engine = new TemplateEngine(pluginRoot);
      const result = engine.render("simple", {
        title: "My Document",
        author: "Test User",
      });

      expect(result).toContain("# My Document");
      expect(result).toContain("Author: Test User");
    });

    it("date ve year otomatik eklenir", () => {
      writeFileSync(
        join(templateDir, "dated.md"),
        `Created: {{date}}\nYear: {{year}}`,
        "utf-8"
      );

      const engine = new TemplateEngine(pluginRoot);
      const result = engine.render("dated", {});

      expect(result).toMatch(/Created: \d{4}-\d{2}-\d{2}/);
      expect(result).toMatch(/Year: \d{4}/);
    });

    it("user variable date/year'ı override eder", () => {
      writeFileSync(
        join(templateDir, "override.md"),
        `Date: {{date}}`,
        "utf-8"
      );

      const engine = new TemplateEngine(pluginRoot);
      const result = engine.render("override", { date: "2020-01-01" });

      expect(result).toContain("Date: 2020-01-01");
    });

    it("varolmayan template null döner", () => {
      const engine = new TemplateEngine(pluginRoot);
      expect(engine.render("ghost", {})).toBeNull();
    });
  });

  // ── Description extraction ───────────────────

  describe("description extraction", () => {
    it("HTML comment'ten çıkarır", () => {
      writeFileSync(
        join(templateDir, "commented.md"),
        `<!-- This is the description -->\n# Title\n\nContent.`,
        "utf-8"
      );

      const engine = new TemplateEngine(pluginRoot);
      expect(engine.listTemplates()[0].description).toBe("This is the description");
    });

    it("comment yoksa ilk paragrafı kullanır", () => {
      writeFileSync(
        join(templateDir, "nocmt.md"),
        `# Title\n\nThis is the first paragraph.`,
        "utf-8"
      );

      const engine = new TemplateEngine(pluginRoot);
      expect(engine.listTemplates()[0].description).toBe("This is the first paragraph.");
    });

    it("frontmatter'ı atlar", () => {
      writeFileSync(
        join(templateDir, "fm.md"),
        `---\ntitle: test\n---\n# Heading\n\nReal description here.`,
        "utf-8"
      );

      const engine = new TemplateEngine(pluginRoot);
      expect(engine.listTemplates()[0].description).toBe("Real description here.");
    });

    it("sadece heading'ler varsa boş döner", () => {
      writeFileSync(
        join(templateDir, "headonly.md"),
        `# Title\n## Section\n### Sub`,
        "utf-8"
      );

      const engine = new TemplateEngine(pluginRoot);
      expect(engine.listTemplates()[0].description).toBe("");
    });
  });

  // ── Multiple templates ─────────────────

  describe("çoklu template", () => {
    it("birden fazla template sorunsuz yüklenir", () => {
      for (let i = 0; i < 10; i++) {
        writeFileSync(
          join(templateDir, `template-${i}.md`),
          `<!-- Template ${i} -->\n# {{title}}\n\n{{content}}`,
          "utf-8"
        );
      }

      const engine = new TemplateEngine(pluginRoot);
      expect(engine.listTemplates()).toHaveLength(10);
    });
  });

  // ── Locale-based loading ──────────────────────

  describe("locale-based loading", () => {
    it("loads templates from locale directory", () => {
      const enDir = join(templateDir, "en");
      mkdirSync(enDir, { recursive: true });
      writeFileSync(join(enDir, "vision.md"), "<!-- English Vision -->\n# Vision\n\n{{content}}", "utf-8");

      const engine = new TemplateEngine(pluginRoot, { locale: "en" });
      const templates = engine.listTemplates();

      expect(templates).toHaveLength(1);
      expect(templates[0].name).toBe("vision");
      expect(templates[0].description).toBe("English Vision");
    });

    it("loads tr templates when locale is tr", () => {
      const trDir = join(templateDir, "tr");
      mkdirSync(trDir, { recursive: true });
      writeFileSync(join(trDir, "vision.md"), "<!-- Türkçe Vizyon -->\n# Vizyon\n\n{{icerik}}", "utf-8");

      const engine = new TemplateEngine(pluginRoot, { locale: "tr" });
      const templates = engine.listTemplates();

      expect(templates).toHaveLength(1);
      expect(templates[0].description).toBe("Türkçe Vizyon");
    });

    it("falls back to en when locale does not exist", () => {
      const enDir = join(templateDir, "en");
      mkdirSync(enDir, { recursive: true });
      writeFileSync(join(enDir, "vision.md"), "<!-- English Vision -->\n# Vision", "utf-8");

      const engine = new TemplateEngine(pluginRoot, { locale: "fr" });
      const templates = engine.listTemplates();

      expect(templates).toHaveLength(1);
      expect(templates[0].description).toBe("English Vision");
    });

    it("locale templates override en fallback", () => {
      const enDir = join(templateDir, "en");
      const trDir = join(templateDir, "tr");
      mkdirSync(enDir, { recursive: true });
      mkdirSync(trDir, { recursive: true });
      writeFileSync(join(enDir, "vision.md"), "<!-- English -->\n# EN Vision", "utf-8");
      writeFileSync(join(trDir, "vision.md"), "<!-- Turkish -->\n# TR Vision", "utf-8");
      writeFileSync(join(enDir, "prd.md"), "<!-- English PRD -->\n# PRD", "utf-8");

      const engine = new TemplateEngine(pluginRoot, { locale: "tr" });
      const templates = engine.listTemplates();

      // Should have tr vision + en prd (fallback)
      expect(templates).toHaveLength(2);
      const vision = templates.find((t) => t.name === "vision");
      expect(vision?.description).toBe("Turkish");
      const prd = templates.find((t) => t.name === "prd");
      expect(prd?.description).toBe("English PRD");
    });

    it("defaults to en when no locale specified", () => {
      const enDir = join(templateDir, "en");
      mkdirSync(enDir, { recursive: true });
      writeFileSync(join(enDir, "test.md"), "<!-- Default EN -->\n# Test", "utf-8");

      const engine = new TemplateEngine(pluginRoot);
      expect(engine.listTemplates()).toHaveLength(1);
    });

    it("empty locale dir falls back to en", () => {
      const enDir = join(templateDir, "en");
      const deDir = join(templateDir, "de");
      mkdirSync(enDir, { recursive: true });
      mkdirSync(deDir, { recursive: true });
      writeFileSync(join(enDir, "test.md"), "<!-- EN -->\n# Test", "utf-8");

      const engine = new TemplateEngine(pluginRoot, { locale: "de" });
      expect(engine.listTemplates()).toHaveLength(1);
    });
  });

  // ── Architecture-specific templates ──────────

  describe("architecture-specific templates", () => {
    it("loads architecture templates alongside base", () => {
      const enDir = join(templateDir, "en");
      const archDir = join(templateDir, "en", "architectures", "microservices");
      mkdirSync(enDir, { recursive: true });
      mkdirSync(archDir, { recursive: true });
      writeFileSync(join(enDir, "vision.md"), "<!-- Vision -->\n# Vision", "utf-8");
      writeFileSync(join(archDir, "service-catalog.md"), "<!-- Service Catalog -->\n# Services", "utf-8");

      const engine = new TemplateEngine(pluginRoot, { locale: "en", architecture: "microservices" });
      const templates = engine.listTemplates();

      expect(templates).toHaveLength(2);
      expect(templates.map((t) => t.name)).toContain("vision");
      expect(templates.map((t) => t.name)).toContain("service-catalog");
    });

    it("no architecture loads only base templates", () => {
      const enDir = join(templateDir, "en");
      const archDir = join(templateDir, "en", "architectures", "microservices");
      mkdirSync(enDir, { recursive: true });
      mkdirSync(archDir, { recursive: true });
      writeFileSync(join(enDir, "vision.md"), "<!-- Vision -->\n# Vision", "utf-8");
      writeFileSync(join(archDir, "service-catalog.md"), "<!-- Service Catalog -->\n# Services", "utf-8");

      const engine = new TemplateEngine(pluginRoot, { locale: "en" });
      expect(engine.listTemplates()).toHaveLength(1);
    });
  });

  // ── Stack-specific templates ──────────────────

  describe("stack-specific templates", () => {
    it("loads stack templates (overrides base)", () => {
      const enDir = join(templateDir, "en");
      const stackDir = join(templateDir, "en", "stacks", "python");
      mkdirSync(enDir, { recursive: true });
      mkdirSync(stackDir, { recursive: true });
      writeFileSync(join(enDir, "tech-stack.md"), "<!-- Base TS -->\n# Tech Stack", "utf-8");
      writeFileSync(join(stackDir, "tech-stack.md"), "<!-- Python TS -->\n# Python Tech Stack", "utf-8");

      const engine = new TemplateEngine(pluginRoot, { locale: "en", stack: "python" });
      const templates = engine.listTemplates();

      expect(templates).toHaveLength(1);
      const ts = templates.find((t) => t.name === "tech-stack");
      expect(ts?.description).toBe("Python TS");
    });

    it("stack template priority: stack > architecture > base", () => {
      const enDir = join(templateDir, "en");
      const archDir = join(templateDir, "en", "architectures", "monolith");
      const stackDir = join(templateDir, "en", "stacks", "go");
      mkdirSync(enDir, { recursive: true });
      mkdirSync(archDir, { recursive: true });
      mkdirSync(stackDir, { recursive: true });
      writeFileSync(join(enDir, "api-design.md"), "<!-- Base API -->\n# API", "utf-8");
      writeFileSync(join(archDir, "api-design.md"), "<!-- Arch API -->\n# Arch API", "utf-8");
      writeFileSync(join(stackDir, "api-design.md"), "<!-- Go API -->\n# Go API", "utf-8");

      const engine = new TemplateEngine(pluginRoot, {
        locale: "en",
        architecture: "monolith",
        stack: "go",
      });
      const templates = engine.listTemplates();
      const api = templates.find((t) => t.name === "api-design");
      expect(api?.description).toBe("Go API");
    });

    it("no stack falls back to base", () => {
      const enDir = join(templateDir, "en");
      mkdirSync(enDir, { recursive: true });
      writeFileSync(join(enDir, "tech-stack.md"), "<!-- Base -->\n# TS", "utf-8");

      const engine = new TemplateEngine(pluginRoot, { locale: "en" });
      expect(engine.listTemplates()[0].description).toBe("Base");
    });
  });

  // ── Custom packs ──────────────────────────────

  describe("custom template packs", () => {
    it("loads templates from custom pack with manifest", () => {
      const packDir = join(pluginRoot, "my-pack");
      const packEnDir = join(packDir, "en");
      mkdirSync(packEnDir, { recursive: true });
      writeFileSync(
        join(packDir, "pack.yaml"),
        `id: test-pack\nname: Test Pack\nversion: 1.0.0\ndescription: Test\ntemplates: [custom-doc]`,
        "utf-8"
      );
      writeFileSync(join(packEnDir, "custom-doc.md"), "<!-- Custom Doc -->\n# Custom", "utf-8");

      // Also create a base template
      const enDir = join(templateDir, "en");
      mkdirSync(enDir, { recursive: true });
      writeFileSync(join(enDir, "vision.md"), "<!-- Vision -->\n# Vision", "utf-8");

      const engine = new TemplateEngine(pluginRoot, { locale: "en", customPacks: ["my-pack"] });
      const templates = engine.listTemplates();

      expect(templates.map((t) => t.name)).toContain("custom-doc");
      expect(templates.map((t) => t.name)).toContain("vision");
    });

    it("custom pack overrides built-in with same name", () => {
      const packDir = join(pluginRoot, "my-pack");
      const packEnDir = join(packDir, "en");
      mkdirSync(packEnDir, { recursive: true });
      writeFileSync(
        join(packDir, "pack.yaml"),
        `id: override-pack\nname: Override\nversion: 1.0.0\ndescription: Test\ntemplates: [vision]`,
        "utf-8"
      );
      writeFileSync(join(packEnDir, "vision.md"), "<!-- Custom Vision -->\n# Custom Vision", "utf-8");

      const enDir = join(templateDir, "en");
      mkdirSync(enDir, { recursive: true });
      writeFileSync(join(enDir, "vision.md"), "<!-- Base Vision -->\n# Base Vision", "utf-8");

      const engine = new TemplateEngine(pluginRoot, { locale: "en", customPacks: ["my-pack"] });
      const vision = engine.getTemplate("vision");
      expect(vision?.description).toBe("Custom Vision");
    });

    it("invalid pack path is silently ignored", () => {
      const enDir = join(templateDir, "en");
      mkdirSync(enDir, { recursive: true });
      writeFileSync(join(enDir, "test.md"), "<!-- Test -->\n# Test", "utf-8");

      const engine = new TemplateEngine(pluginRoot, { locale: "en", customPacks: ["nonexistent-pack"] });
      expect(engine.listTemplates()).toHaveLength(1);
    });

    it("pack without manifest is ignored", () => {
      const packDir = join(pluginRoot, "bad-pack");
      mkdirSync(packDir, { recursive: true });
      writeFileSync(join(packDir, "template.md"), "# No manifest", "utf-8");

      const enDir = join(templateDir, "en");
      mkdirSync(enDir, { recursive: true });
      writeFileSync(join(enDir, "test.md"), "<!-- Test -->\n# Test", "utf-8");

      const engine = new TemplateEngine(pluginRoot, { locale: "en", customPacks: ["bad-pack"] });
      expect(engine.listTemplates()).toHaveLength(1);
    });
  });
});
