import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { TemplatePackLoader } from "./template-pack-loader.js";

function makeTmpDir(): string {
  const dir = join(tmpdir(), `mags-tpl-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("TemplatePackLoader", () => {
  let packDir: string;
  let loader: TemplatePackLoader;

  beforeEach(() => {
    packDir = makeTmpDir();
    loader = new TemplatePackLoader();
  });

  afterEach(() => {
    rmSync(packDir, { recursive: true, force: true });
  });

  describe("loadPack", () => {
    it("loads a valid pack manifest", () => {
      writeFileSync(
        join(packDir, "pack.yaml"),
        "id: my-pack\nname: My Pack\nversion: 1.0.0\ndescription: A custom pack\ntemplates: [vision, prd]\n",
        "utf-8"
      );

      const manifest = loader.loadPack(packDir);
      expect(manifest).not.toBeNull();
      expect(manifest!.id).toBe("my-pack");
      expect(manifest!.name).toBe("My Pack");
      expect(manifest!.version).toBe("1.0.0");
    });

    it("returns null when pack.yaml is missing", () => {
      const manifest = loader.loadPack(packDir);
      expect(manifest).toBeNull();
    });

    it("returns null when pack.yaml has no id", () => {
      writeFileSync(
        join(packDir, "pack.yaml"),
        "name: Missing ID Pack\nversion: 1.0.0\n",
        "utf-8"
      );

      const manifest = loader.loadPack(packDir);
      expect(manifest).toBeNull();
    });

    it("returns null when pack.yaml has no name", () => {
      writeFileSync(
        join(packDir, "pack.yaml"),
        "id: no-name\nversion: 1.0.0\n",
        "utf-8"
      );

      const manifest = loader.loadPack(packDir);
      expect(manifest).toBeNull();
    });

    it("returns null for invalid YAML", () => {
      writeFileSync(join(packDir, "pack.yaml"), "{{{{INVALID", "utf-8");

      const manifest = loader.loadPack(packDir);
      expect(manifest).toBeNull();
    });

    it("returns null for non-existent directory", () => {
      const manifest = loader.loadPack(join(packDir, "non-existent"));
      expect(manifest).toBeNull();
    });
  });

  describe("validatePack", () => {
    it("validates a complete pack successfully", () => {
      writeFileSync(
        join(packDir, "pack.yaml"),
        "id: valid-pack\nname: Valid Pack\nversion: 1.0.0\ndescription: Test\ntemplates: []\n",
        "utf-8"
      );
      writeFileSync(join(packDir, "vision.md"), "# Vision\n\nContent.\n", "utf-8");

      const result = loader.validatePack(packDir);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("reports error for non-existent path", () => {
      const result = loader.validatePack(join(packDir, "does-not-exist"));
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("does not exist");
    });

    it("reports error for missing pack.yaml", () => {
      const result = loader.validatePack(packDir);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Missing pack.yaml manifest");
    });

    it("reports error for missing id in manifest", () => {
      writeFileSync(
        join(packDir, "pack.yaml"),
        "name: No ID Pack\nversion: 1.0.0\n",
        "utf-8"
      );
      writeFileSync(join(packDir, "template.md"), "# Template\n", "utf-8");

      const result = loader.validatePack(packDir);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("id"))).toBe(true);
    });

    it("reports error for missing name in manifest", () => {
      writeFileSync(
        join(packDir, "pack.yaml"),
        "id: no-name\nversion: 1.0.0\n",
        "utf-8"
      );
      writeFileSync(join(packDir, "template.md"), "# Template\n", "utf-8");

      const result = loader.validatePack(packDir);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("name"))).toBe(true);
    });

    it("reports error for missing version in manifest", () => {
      writeFileSync(
        join(packDir, "pack.yaml"),
        "id: no-version\nname: No Version\n",
        "utf-8"
      );
      writeFileSync(join(packDir, "template.md"), "# Template\n", "utf-8");

      const result = loader.validatePack(packDir);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("version"))).toBe(true);
    });

    it("reports error when no template files found", () => {
      writeFileSync(
        join(packDir, "pack.yaml"),
        "id: empty-pack\nname: Empty Pack\nversion: 1.0.0\n",
        "utf-8"
      );

      const result = loader.validatePack(packDir);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("No template files"))).toBe(true);
    });

    it("reports multiple errors at once", () => {
      writeFileSync(join(packDir, "pack.yaml"), "description: only description\n", "utf-8");

      const result = loader.validatePack(packDir);
      expect(result.valid).toBe(false);
      // Should have errors for id, name, version, and no templates
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("getPackTemplates", () => {
    it("loads templates from root directory", () => {
      writeFileSync(
        join(packDir, "pack.yaml"),
        "id: test\nname: Test\nversion: 1.0.0\n",
        "utf-8"
      );
      writeFileSync(join(packDir, "vision.md"), "# Vision\n\nProject vision content.\n", "utf-8");
      writeFileSync(join(packDir, "prd.md"), "# PRD\n\nProduct requirements.\n", "utf-8");

      const templates = loader.getPackTemplates(packDir);
      expect(templates).toHaveLength(2);
      expect(templates.map((t) => t.name)).toContain("vision");
      expect(templates.map((t) => t.name)).toContain("prd");
    });

    it("template has correct structure", () => {
      writeFileSync(
        join(packDir, "pack.yaml"),
        "id: test\nname: Test\nversion: 1.0.0\n",
        "utf-8"
      );
      writeFileSync(join(packDir, "vision.md"), "# {{projectName}} Vision\n\nContent for {{projectName}}.\n", "utf-8");

      const templates = loader.getPackTemplates(packDir);
      expect(templates).toHaveLength(1);
      expect(templates[0].name).toBe("vision");
      expect(templates[0].filename).toBe("vision.md");
      expect(templates[0].content).toContain("{{projectName}}");
      expect(templates[0].variables.some((v) => v.name === "projectName")).toBe(true);
    });

    it("loads .hbs template files", () => {
      writeFileSync(join(packDir, "api.hbs"), "# API Reference\n\n{{endpoint}} docs.\n", "utf-8");

      const templates = loader.getPackTemplates(packDir);
      expect(templates).toHaveLength(1);
      expect(templates[0].name).toBe("api");
    });

    it("prefers locale-specific directory", () => {
      mkdirSync(join(packDir, "tr"), { recursive: true });
      writeFileSync(join(packDir, "vision.md"), "# English Vision\n", "utf-8");
      writeFileSync(join(packDir, "tr", "vision.md"), "# Turkish Vision\n", "utf-8");

      const templates = loader.getPackTemplates(packDir, "tr");
      expect(templates).toHaveLength(1);
      expect(templates[0].content).toContain("Turkish Vision");
    });

    it("falls back to en directory when locale dir missing", () => {
      mkdirSync(join(packDir, "en"), { recursive: true });
      writeFileSync(join(packDir, "en", "vision.md"), "# EN Vision\n", "utf-8");

      const templates = loader.getPackTemplates(packDir, "fr");
      expect(templates).toHaveLength(1);
      expect(templates[0].content).toContain("EN Vision");
    });

    it("falls back to root when no locale dirs exist", () => {
      writeFileSync(join(packDir, "vision.md"), "# Root Vision\n", "utf-8");

      const templates = loader.getPackTemplates(packDir, "ja");
      expect(templates).toHaveLength(1);
      expect(templates[0].content).toContain("Root Vision");
    });

    it("does not duplicate templates across fallback dirs", () => {
      mkdirSync(join(packDir, "en"), { recursive: true });
      writeFileSync(join(packDir, "en", "vision.md"), "# EN Vision\n", "utf-8");
      writeFileSync(join(packDir, "vision.md"), "# Root Vision\n", "utf-8");

      // When requesting "en", it should find templates in en/ and stop
      const templates = loader.getPackTemplates(packDir, "en");
      expect(templates).toHaveLength(1);
    });

    it("returns empty array for empty directory", () => {
      const templates = loader.getPackTemplates(packDir);
      expect(templates).toEqual([]);
    });

    it("extracts description from HTML comment", () => {
      writeFileSync(
        join(packDir, "vision.md"),
        "<!-- This is the project vision template -->\n# Vision\n\nContent.\n",
        "utf-8"
      );

      const templates = loader.getPackTemplates(packDir);
      expect(templates[0].description).toBe("This is the project vision template");
    });

    it("excludes built-in variables from extracted variables", () => {
      writeFileSync(
        join(packDir, "template.md"),
        "# {{projectName}}\n\n{{#if feature}}Feature enabled{{/if}}\n{{#each items}}{{this}}{{/each}}\n",
        "utf-8"
      );

      const templates = loader.getPackTemplates(packDir);
      const varNames = templates[0].variables.map((v) => v.name);
      expect(varNames).toContain("projectName");
      expect(varNames).not.toContain("if");
      expect(varNames).not.toContain("each");
    });
  });
});
