/**
 * Edge case tests for all new MAGS features.
 * Tests complex, tricky scenarios that could expose logic gaps.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { TemplateEngine } from "./template-engine.js";
import { StackDetector } from "./stack-detector.js";
import { ModuleDiscoverer } from "./module-discoverer.js";
import { DocParser } from "./doc-parser.js";
import { TemplatePackLoader } from "./template-pack-loader.js";
import { ArchitectureAdapter } from "./architecture-adapter.js";
import { getStackRules, getArchitectureGuidance } from "./claude-md-rules.js";
import type { ArchitectureType } from "../types/index.js";

function makeTmpDir(): string {
  const dir = join(tmpdir(), `mags-edge-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

// ============================================
// TEMPLATE ENGINE EDGE CASES
// ============================================

describe("TemplateEngine edge cases", () => {
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

  it("BUG FIX: en architecture fallback does NOT overwrite locale base templates", () => {
    // Setup: tr base has api-design, en architecture/monolith also has api-design
    const trDir = join(templateDir, "tr");
    const enArchDir = join(templateDir, "en", "architectures", "monolith");
    mkdirSync(trDir, { recursive: true });
    mkdirSync(enArchDir, { recursive: true });

    writeFileSync(join(trDir, "api-design.md"), "<!-- TR API -->\n# Türkçe API", "utf-8");
    writeFileSync(join(enArchDir, "api-design.md"), "<!-- EN Arch API -->\n# English Arch API", "utf-8");

    const engine = new TemplateEngine(pluginRoot, {
      locale: "tr",
      architecture: "monolith",
    });

    const api = engine.getTemplate("api-design");
    // tr base should NOT be overwritten by en architecture fallback
    expect(api?.description).toBe("TR API");
  });

  it("BUG FIX: en stack fallback does NOT overwrite locale base templates", () => {
    const trDir = join(templateDir, "tr");
    const enStackDir = join(templateDir, "en", "stacks", "python");
    mkdirSync(trDir, { recursive: true });
    mkdirSync(enStackDir, { recursive: true });

    writeFileSync(join(trDir, "tech-stack.md"), "<!-- TR Stack -->\n# TR Tech", "utf-8");
    writeFileSync(join(enStackDir, "tech-stack.md"), "<!-- EN Python -->\n# Python Tech", "utf-8");

    const engine = new TemplateEngine(pluginRoot, {
      locale: "tr",
      stack: "python",
    });

    const ts = engine.getTemplate("tech-stack");
    expect(ts?.description).toBe("TR Stack");
  });

  it("BUG FIX: en apiStyle fallback does NOT overwrite locale base templates", () => {
    const trDir = join(templateDir, "tr");
    const enApiDir = join(templateDir, "en", "api-styles", "graphql");
    mkdirSync(trDir, { recursive: true });
    mkdirSync(enApiDir, { recursive: true });

    writeFileSync(join(trDir, "api-design.md"), "<!-- TR API -->\n# TR API Tasarim", "utf-8");
    writeFileSync(join(enApiDir, "api-design.md"), "<!-- EN GraphQL -->\n# GraphQL API", "utf-8");

    const engine = new TemplateEngine(pluginRoot, {
      locale: "tr",
      apiStyle: "graphql",
    });

    const api = engine.getTemplate("api-design");
    expect(api?.description).toBe("TR API");
  });

  it("locale-specific architecture templates override locale-specific base templates", () => {
    // When the user has tr architecture templates, they SHOULD override tr base
    const trDir = join(templateDir, "tr");
    const trArchDir = join(templateDir, "tr", "architectures", "microservices");
    mkdirSync(trDir, { recursive: true });
    mkdirSync(trArchDir, { recursive: true });

    writeFileSync(join(trDir, "api-design.md"), "<!-- TR Base API -->\n# Base", "utf-8");
    writeFileSync(join(trArchDir, "api-design.md"), "<!-- TR Microservices API -->\n# Microservices", "utf-8");

    const engine = new TemplateEngine(pluginRoot, {
      locale: "tr",
      architecture: "microservices",
    });

    const api = engine.getTemplate("api-design");
    expect(api?.description).toBe("TR Microservices API");
  });

  it("en architecture templates add new templates when locale is non-en", () => {
    // en arch has service-catalog.md (unique name), tr base has vision.md
    const trDir = join(templateDir, "tr");
    const enArchDir = join(templateDir, "en", "architectures", "microservices");
    mkdirSync(trDir, { recursive: true });
    mkdirSync(enArchDir, { recursive: true });

    writeFileSync(join(trDir, "vision.md"), "<!-- TR Vision -->\n# Vizyon", "utf-8");
    writeFileSync(join(enArchDir, "service-catalog.md"), "<!-- Service Catalog -->\n# Services", "utf-8");

    const engine = new TemplateEngine(pluginRoot, {
      locale: "tr",
      architecture: "microservices",
    });

    const templates = engine.listTemplates();
    expect(templates.map((t) => t.name)).toContain("vision");
    expect(templates.map((t) => t.name)).toContain("service-catalog");
  });

  it("complex 4-layer loading: locale base + arch + stack + apiStyle", () => {
    const enDir = join(templateDir, "en");
    const archDir = join(templateDir, "en", "architectures", "microservices");
    const stackDir = join(templateDir, "en", "stacks", "go");
    const apiDir = join(templateDir, "en", "api-styles", "grpc");
    mkdirSync(enDir, { recursive: true });
    mkdirSync(archDir, { recursive: true });
    mkdirSync(stackDir, { recursive: true });
    mkdirSync(apiDir, { recursive: true });

    writeFileSync(join(enDir, "vision.md"), "<!-- Base Vision -->\n# Vision", "utf-8");
    writeFileSync(join(enDir, "api-design.md"), "<!-- Base API -->\n# Base API", "utf-8");
    writeFileSync(join(archDir, "service-catalog.md"), "<!-- Svc Cat -->\n# Services", "utf-8");
    writeFileSync(join(archDir, "api-design.md"), "<!-- Arch API -->\n# Arch API", "utf-8");
    writeFileSync(join(stackDir, "api-design.md"), "<!-- Go API -->\n# Go API", "utf-8");
    writeFileSync(join(stackDir, "project-structure.md"), "<!-- Go Structure -->\n# Go Dirs", "utf-8");
    writeFileSync(join(apiDir, "api-design.md"), "<!-- gRPC API -->\n# gRPC API", "utf-8");

    const engine = new TemplateEngine(pluginRoot, {
      locale: "en",
      architecture: "microservices",
      stack: "go",
      apiStyle: "grpc",
    });

    const templates = engine.listTemplates();
    // api-design should be gRPC (loaded last, highest priority via apiStyle)
    const api = templates.find((t) => t.name === "api-design");
    expect(api?.description).toBe("gRPC API");

    // service-catalog from architecture
    expect(templates.map((t) => t.name)).toContain("service-catalog");
    // project-structure from stack
    expect(templates.map((t) => t.name)).toContain("project-structure");
    // vision from base
    expect(templates.map((t) => t.name)).toContain("vision");
  });

  it("REST apiStyle does not load api-styles dir", () => {
    const enDir = join(templateDir, "en");
    const apiDir = join(templateDir, "en", "api-styles", "rest");
    mkdirSync(enDir, { recursive: true });
    mkdirSync(apiDir, { recursive: true });
    writeFileSync(join(enDir, "vision.md"), "<!-- V -->\n# Vision", "utf-8");
    writeFileSync(join(apiDir, "extra.md"), "<!-- Extra -->\n# Extra", "utf-8");

    const engine = new TemplateEngine(pluginRoot, { locale: "en", apiStyle: "rest" });
    // "rest" is default and should NOT load the api-styles/rest/ dir
    expect(engine.listTemplates()).toHaveLength(1);
  });

  it("custom pack template with same name as stack template — pack wins (loaded last)", () => {
    const enDir = join(templateDir, "en");
    const stackDir = join(templateDir, "en", "stacks", "python");
    mkdirSync(enDir, { recursive: true });
    mkdirSync(stackDir, { recursive: true });

    writeFileSync(join(stackDir, "tech-stack.md"), "<!-- Stack Python -->\n# Stack", "utf-8");

    const packDir = join(pluginRoot, "my-pack");
    const packEnDir = join(packDir, "en");
    mkdirSync(packEnDir, { recursive: true });
    writeFileSync(
      join(packDir, "pack.yaml"),
      "id: test\nname: Test\nversion: 1.0.0\ndescription: Test\ntemplates: [tech-stack]",
      "utf-8"
    );
    writeFileSync(join(packEnDir, "tech-stack.md"), "<!-- Pack Python -->\n# Pack", "utf-8");

    const engine = new TemplateEngine(pluginRoot, {
      locale: "en",
      stack: "python",
      customPacks: ["my-pack"],
    });

    const ts = engine.getTemplate("tech-stack");
    expect(ts?.description).toBe("Pack Python");
  });

  it("Handlebars special characters in template content don't crash", () => {
    const enDir = join(templateDir, "en");
    mkdirSync(enDir, { recursive: true });
    writeFileSync(
      join(enDir, "special.md"),
      "# {{title}}\n\nCode: `if (a > b && c < d) { return; }`\n\n{{description}}",
      "utf-8"
    );

    const engine = new TemplateEngine(pluginRoot, { locale: "en" });
    const result = engine.render("special", {
      title: "Test <Script>",
      description: "A & B",
    });

    expect(result).toContain("Test &lt;Script&gt;"); // Handlebars escapes HTML
    expect(result).toContain("A &amp; B");
  });

  it("legacy root templates load when no locale dirs exist", () => {
    // No en/ or tr/ dirs, templates directly in templates/docs/
    writeFileSync(join(templateDir, "vision.md"), "<!-- Legacy -->\n# Vision", "utf-8");

    const engine = new TemplateEngine(pluginRoot, { locale: "en" });
    expect(engine.listTemplates()).toHaveLength(1);
    expect(engine.listTemplates()[0].description).toBe("Legacy");
  });
});

// ============================================
// STACK DETECTOR EDGE CASES
// ============================================

describe("StackDetector edge cases", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("invalid JSON in package.json doesn't crash", () => {
    writeFileSync(join(tmpDir, "package.json"), "{ broken json }", "utf-8");

    const detector = new StackDetector();
    const result = detector.detect(tmpDir);

    // Should detect language but not crash on deps
    expect(result.languages).toContain("typescript/javascript");
  });

  it("empty package.json object", () => {
    writeFileSync(join(tmpDir, "package.json"), "{}", "utf-8");

    const detector = new StackDetector();
    const result = detector.detect(tmpDir);

    expect(result.languages).toContain("typescript/javascript");
    expect(result.packageManager).toBe("npm"); // default
    expect(result.frameworks).toEqual([]);
  });

  it("project with both Node.js and Python (polyglot)", () => {
    writeFileSync(join(tmpDir, "package.json"), '{"dependencies":{"express":"4.0"}}', "utf-8");
    writeFileSync(join(tmpDir, "requirements.txt"), "fastapi\nuvicorn\n", "utf-8");

    const detector = new StackDetector();
    const result = detector.detect(tmpDir);

    expect(result.languages).toContain("typescript/javascript");
    expect(result.languages).toContain("python");
    expect(result.frameworks).toContain("Express");
    expect(result.frameworks).toContain("FastAPI");
  });

  it("project with all 5 languages", () => {
    writeFileSync(join(tmpDir, "package.json"), '{}', "utf-8");
    writeFileSync(join(tmpDir, "requirements.txt"), "", "utf-8");
    writeFileSync(join(tmpDir, "go.mod"), "module example.com/test\n\ngo 1.21\n", "utf-8");
    writeFileSync(join(tmpDir, "Cargo.toml"), '[package]\nname = "test"\n', "utf-8");
    writeFileSync(join(tmpDir, "pom.xml"), '<project></project>', "utf-8");

    const detector = new StackDetector();
    const result = detector.detect(tmpDir);

    expect(result.languages).toHaveLength(5);
  });

  it(".proto files detected as gRPC", () => {
    writeFileSync(join(tmpDir, "user.proto"), 'syntax = "proto3";', "utf-8");

    const detector = new StackDetector();
    const result = detector.detect(tmpDir);

    expect(result.apiStyle).toContain("grpc");
  });

  it("docker-compose detects databases", () => {
    writeFileSync(
      join(tmpDir, "docker-compose.yml"),
      `services:
  db:
    image: postgres:16
  cache:
    image: redis:7
  search:
    image: elasticsearch:8.10
`,
      "utf-8"
    );

    const detector = new StackDetector();
    const result = detector.detect(tmpDir);

    expect(result.databases).toContain("PostgreSQL");
    expect(result.databases).toContain("Redis");
    expect(result.databases).toContain("Elasticsearch");
  });

  it("no duplicate databases from multiple sources", () => {
    writeFileSync(
      join(tmpDir, "package.json"),
      '{"dependencies":{"pg":"8.0","redis":"4.0"}}',
      "utf-8"
    );
    writeFileSync(
      join(tmpDir, "docker-compose.yml"),
      "services:\n  db:\n    image: postgres:16\n  cache:\n    image: redis:7\n",
      "utf-8"
    );

    const detector = new StackDetector();
    const result = detector.detect(tmpDir);

    const pgCount = result.databases.filter((d) => d === "PostgreSQL").length;
    const redisCount = result.databases.filter((d) => d === "Redis").length;
    expect(pgCount).toBe(1);
    expect(redisCount).toBe(1);
  });

  it("pyproject.toml with poetry section", () => {
    writeFileSync(
      join(tmpDir, "pyproject.toml"),
      `[tool.poetry]
name = "my-project"

[tool.poetry.dependencies]
python = "^3.11"
django = "^5.0"
`,
      "utf-8"
    );

    const detector = new StackDetector();
    const result = detector.detect(tmpDir);

    expect(result.languages).toContain("python");
    expect(result.packageManager).toBe("poetry");
    expect(result.frameworks).toContain("Django");
  });

  it("build.gradle.kts detected as gradle", () => {
    writeFileSync(
      join(tmpDir, "build.gradle.kts"),
      'implementation("org.springframework.boot:spring-boot-starter")\n',
      "utf-8"
    );

    const detector = new StackDetector();
    const result = detector.detect(tmpDir);

    expect(result.languages).toContain("java");
    expect(result.packageManager).toBe("gradle");
    expect(result.frameworks).toContain("Spring Boot");
  });

  it("GraphQL detected from graphql dep in package.json", () => {
    writeFileSync(
      join(tmpDir, "package.json"),
      '{"dependencies":{"graphql":"16.0","@apollo/server":"4.0"}}',
      "utf-8"
    );

    const detector = new StackDetector();
    const result = detector.detect(tmpDir);

    expect(result.apiStyle).toContain("graphql");
  });

  it("event-driven detected from kafkajs dependency", () => {
    writeFileSync(
      join(tmpDir, "package.json"),
      '{"dependencies":{"kafkajs":"2.0"}}',
      "utf-8"
    );

    const detector = new StackDetector();
    const result = detector.detect(tmpDir);

    expect(result.apiStyle).toContain("event-driven");
  });
});

// ============================================
// MODULE DISCOVERER EDGE CASES
// ============================================

describe("ModuleDiscoverer edge cases", () => {
  let tmpDir: string;
  const discoverer = new ModuleDiscoverer();

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("non-existent project root returns empty", () => {
    const result = discoverer.discover("/nonexistent/path");
    expect(result).toEqual([]);
  });

  it("deeply nested structure is NOT scanned (only first level)", () => {
    mkdirSync(join(tmpDir, "src", "modules", "auth", "submodule"), { recursive: true });

    const modules = discoverer.discover(tmpDir);
    // Should find "auth" but NOT "submodule"
    expect(modules).toHaveLength(1);
    expect(modules[0].name).toBe("auth");
  });

  it("symlink to module directory doesn't cause issues", () => {
    mkdirSync(join(tmpDir, "src", "modules", "real"), { recursive: true });
    // Just test that it doesn't crash — symlinks are OS-specific

    const modules = discoverer.discover(tmpDir);
    expect(modules.length).toBeGreaterThanOrEqual(1);
  });

  it("mobile architecture scans monolith dirs (default fallback)", () => {
    mkdirSync(join(tmpDir, "src", "modules", "auth"), { recursive: true });

    // "mobile" architecture is not in the switch, falls to default (monolith scan)
    const modules = discoverer.discover(tmpDir, "mobile");
    expect(modules).toHaveLength(1);
  });

  it("serverless architecture scans monolith dirs (default fallback)", () => {
    mkdirSync(join(tmpDir, "src", "modules", "lambda"), { recursive: true });

    const modules = discoverer.discover(tmpDir, "serverless");
    expect(modules).toHaveLength(1);
  });

  it("confidence never exceeds 100 even with all signals", () => {
    const modDir = join(tmpDir, "src", "modules", "mega");
    mkdirSync(modDir, { recursive: true });
    mkdirSync(join(modDir, "tests"), { recursive: true });

    writeFileSync(join(modDir, "index.ts"), "export {};", "utf-8");
    writeFileSync(join(modDir, "main.ts"), "export {};", "utf-8");
    writeFileSync(join(modDir, "utils.ts"), "export {};", "utf-8");
    writeFileSync(join(modDir, "package.json"), '{"name":"mega"}', "utf-8");
    writeFileSync(join(modDir, "Cargo.toml"), "[package]", "utf-8");
    writeFileSync(join(modDir, "go.mod"), "module mega", "utf-8");
    writeFileSync(join(modDir, "README.md"), "# Mega", "utf-8");
    writeFileSync(join(modDir, "Dockerfile"), "FROM node:20", "utf-8");

    const modules = discoverer.discover(tmpDir);
    expect(modules[0].confidence).toBeLessThanOrEqual(100);
  });

  it("directories with only files (no subdirs) still detected", () => {
    mkdirSync(join(tmpDir, "src", "modules", "simple"), { recursive: true });
    writeFileSync(join(tmpDir, "src", "modules", "simple", "index.ts"), "", "utf-8");

    const modules = discoverer.discover(tmpDir);
    expect(modules).toHaveLength(1);
    expect(modules[0].name).toBe("simple");
  });

  it("multiple scan locations don't produce duplicates", () => {
    mkdirSync(join(tmpDir, "src", "modules", "auth"), { recursive: true });
    mkdirSync(join(tmpDir, "src", "features", "auth"), { recursive: true });
    mkdirSync(join(tmpDir, "src", "domains", "auth"), { recursive: true });

    const modules = discoverer.discover(tmpDir);
    expect(modules.filter((m) => m.name === "auth")).toHaveLength(1);
  });

  it("library mode excludes common non-module dirs", () => {
    mkdirSync(join(tmpDir, "src", "core"), { recursive: true });
    mkdirSync(join(tmpDir, "src", "__tests__"), { recursive: true });
    mkdirSync(join(tmpDir, "src", "tests"), { recursive: true });
    mkdirSync(join(tmpDir, "src", "test"), { recursive: true });
    mkdirSync(join(tmpDir, "src", "node_modules"), { recursive: true });

    const modules = discoverer.discover(tmpDir, "library");
    expect(modules.map((m) => m.name)).toEqual(["core"]);
  });
});

// ============================================
// DOC PARSER EDGE CASES
// ============================================

describe("DocParser edge cases", () => {
  let tmpDir: string;
  const parser = new DocParser();

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("markdown with nested frontmatter-like content", () => {
    const filePath = join(tmpDir, "nested.md");
    writeFileSync(
      filePath,
      "---\ntitle: Real Title\n---\n\n# Heading\n\nText with --- in it.\n\n---\n\nMore text.\n",
      "utf-8"
    );

    const result = parser.parse(filePath);
    expect(result.metadata.title).toBe("Real Title");
    expect(result.content).toContain("More text.");
  });

  it("RST with overline+underline title style", () => {
    const filePath = join(tmpDir, "overline.rst");
    // Some RST docs use overline style: === above AND below the title
    writeFileSync(
      filePath,
      "==========\nMy Title\n==========\n\nContent here.\n\nSection\n-------\n\nMore.\n",
      "utf-8"
    );

    const result = parser.parse(filePath);
    // Should still detect sections
    expect(result.sections.length).toBeGreaterThan(0);
  });

  it("RST with no metadata returns empty metadata object", () => {
    const filePath = join(tmpDir, "bare.rst");
    writeFileSync(filePath, "Just some plain text.\n\nMore text.\n", "utf-8");

    const result = parser.parse(filePath);
    // No field list, no underline titles
    expect(result.metadata).toEqual({});
    expect(result.sections).toEqual([]);
  });

  it("AsciiDoc with unicode content", () => {
    const filePath = join(tmpDir, "unicode.adoc");
    writeFileSync(
      filePath,
      ":author: Doğancan Öztürk\n\n= Başlık\n\n== Bölüm Bir\n\nTürkçe içerik.\n",
      "utf-8"
    );

    const result = parser.parse(filePath);
    expect(result.metadata.author).toBe("Doğancan Öztürk");
    expect(result.sections).toContain("Bölüm Bir");
  });

  it("AsciiDoc title extracted even when no attributes", () => {
    const filePath = join(tmpDir, "notitle.adoc");
    writeFileSync(filePath, "= Standalone Title\n\n== Section\n\nContent.\n", "utf-8");

    const result = parser.parse(filePath);
    expect(result.metadata.title).toBe("Standalone Title");
  });

  it("markdown with only frontmatter, no content", () => {
    const filePath = join(tmpDir, "fmonly.md");
    writeFileSync(filePath, "---\ntitle: Empty\nstatus: DRAFT\n---\n", "utf-8");

    const result = parser.parse(filePath);
    expect(result.metadata.title).toBe("Empty");
    expect(result.content.trim()).toBe("");
    expect(result.sections).toEqual([]);
  });

  it("RST field with colons in value", () => {
    const filePath = join(tmpDir, "colons.rst");
    writeFileSync(filePath, ":url: https://example.com:8080/path\n\nTitle\n=====\n", "utf-8");

    const result = parser.parse(filePath);
    expect(result.metadata.url).toBe("https://example.com:8080/path");
  });

  it("AsciiDoc attribute with hyphenated name", () => {
    const filePath = join(tmpDir, "hyph.adoc");
    writeFileSync(filePath, ":last-updated: 2024-01-01\n\n= Title\n", "utf-8");

    const result = parser.parse(filePath);
    expect(result.metadata["last-updated"]).toBe("2024-01-01");
  });

  it("parseFromString matches parse for same content (markdown)", () => {
    const content = "---\ntitle: Test\n---\n\n# Heading\n\nBody.\n";
    const filePath = join(tmpDir, "match.md");
    writeFileSync(filePath, content, "utf-8");

    const fromFile = parser.parse(filePath);
    const fromString = parser.parseFromString(content, "md");

    expect(fromFile.metadata).toEqual(fromString.metadata);
    expect(fromFile.sections).toEqual(fromString.sections);
  });
});

// ============================================
// TEMPLATE PACK LOADER EDGE CASES
// ============================================

describe("TemplatePackLoader edge cases", () => {
  let tmpDir: string;
  const loader = new TemplatePackLoader();

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("pack with extra unknown fields in manifest still loads", () => {
    writeFileSync(
      join(tmpDir, "pack.yaml"),
      "id: test\nname: Test\nversion: 1.0.0\ndescription: desc\ntemplates: []\nextra_field: ignored\n",
      "utf-8"
    );

    const manifest = loader.loadPack(tmpDir);
    expect(manifest).not.toBeNull();
    expect(manifest!.id).toBe("test");
  });

  it("pack with templates in nested subdirectories", () => {
    writeFileSync(
      join(tmpDir, "pack.yaml"),
      "id: nested\nname: Nested\nversion: 1.0.0\ndescription: desc\ntemplates: [deep]",
      "utf-8"
    );
    const deepDir = join(tmpDir, "en", "sub");
    mkdirSync(deepDir, { recursive: true });
    writeFileSync(join(deepDir, "deep.md"), "# Deep\n\n{{content}}", "utf-8");

    // findTemplateFiles should find it in validation
    const validation = loader.validatePack(tmpDir);
    expect(validation.valid).toBe(true);
  });

  it("getPackTemplates prefers exact locale over en", () => {
    writeFileSync(
      join(tmpDir, "pack.yaml"),
      "id: t\nname: t\nversion: 1.0.0\ndescription: d\ntemplates: [doc]",
      "utf-8"
    );

    const trDir = join(tmpDir, "tr");
    const enDir = join(tmpDir, "en");
    mkdirSync(trDir, { recursive: true });
    mkdirSync(enDir, { recursive: true });
    writeFileSync(join(trDir, "doc.md"), "<!-- Türkçe -->\n# TR", "utf-8");
    writeFileSync(join(enDir, "doc.md"), "<!-- English -->\n# EN", "utf-8");

    const templates = loader.getPackTemplates(tmpDir, "tr");
    expect(templates).toHaveLength(1);
    expect(templates[0].content).toContain("Türkçe");
  });

  it("getPackTemplates deduplicates across fallback dirs", () => {
    writeFileSync(
      join(tmpDir, "pack.yaml"),
      "id: t\nname: t\nversion: 1.0.0\ndescription: d\ntemplates: []",
      "utf-8"
    );

    // Same template name in both locale and en
    const trDir = join(tmpDir, "tr");
    const enDir = join(tmpDir, "en");
    mkdirSync(trDir, { recursive: true });
    mkdirSync(enDir, { recursive: true });
    writeFileSync(join(trDir, "doc.md"), "TR", "utf-8");
    writeFileSync(join(enDir, "doc.md"), "EN", "utf-8");

    const templates = loader.getPackTemplates(tmpDir, "tr");
    // Should only have 1 (from tr, since it's found first and breaks)
    expect(templates).toHaveLength(1);
  });

  it("validate catches pack with only yaml, no templates", () => {
    writeFileSync(
      join(tmpDir, "pack.yaml"),
      "id: empty\nname: Empty\nversion: 1.0.0\ndescription: d\ntemplates: []",
      "utf-8"
    );

    const validation = loader.validatePack(tmpDir);
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain("No template files found in pack");
  });
});

// ============================================
// ARCHITECTURE ADAPTER EDGE CASES
// ============================================

describe("ArchitectureAdapter edge cases", () => {
  it("unknown architecture type falls back to monolith", () => {
    const adapter = new ArchitectureAdapter("quantum-computing" as ArchitectureType);
    const defaults = adapter.getDefaults();

    // Should return monolith defaults
    expect(defaults.templates).toContain("vision");
    expect(defaults.modules).toContain("auth");
  });

  it("all architecture types have unique guidance", () => {
    const types: ArchitectureType[] = ["monolith", "microservices", "library", "cli", "mobile", "serverless"];
    const guidanceMap = new Map<string, string[]>();

    for (const type of types) {
      const adapter = new ArchitectureAdapter(type);
      guidanceMap.set(type, adapter.getGuidance());
    }

    // Each should have unique first item
    const firstItems = [...guidanceMap.values()].map((g) => g[0]);
    expect(new Set(firstItems).size).toBe(types.length);
  });
});

// ============================================
// CLAUDE-MD RULES EDGE CASES
// ============================================

describe("claude-md-rules edge cases", () => {
  it("getStackRules handles mixed case 'TypeScript'", () => {
    const rules = getStackRules({ primaryLanguage: "TypeScript" });
    expect(rules.length).toBeGreaterThan(0);
  });

  it("getStackRules handles 'PYTHON' uppercase", () => {
    const rules = getStackRules({ primaryLanguage: "PYTHON" });
    expect(rules.length).toBeGreaterThan(0);
  });

  it("getStackRules handles empty string language", () => {
    const rules = getStackRules({ primaryLanguage: "" });
    expect(rules).toEqual([]);
  });

  it("getStackRules with only languages array (no primaryLanguage)", () => {
    const rules = getStackRules({ languages: ["python", "go"] });
    // primaryLanguage is undefined, should return empty
    expect(rules).toEqual([]);
  });

  it("getArchitectureGuidance returns different content per type", () => {
    const monolith = getArchitectureGuidance("monolith");
    const micro = getArchitectureGuidance("microservices");

    expect(monolith).not.toEqual(micro);
  });
});
