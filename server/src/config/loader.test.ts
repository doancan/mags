import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { loadConfig, getDocsPath, getMagsPath } from "./loader.js";

function makeTmpDir(): string {
  const dir = join(tmpdir(), `mags-cfg-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("Config Loader", () => {
  let projectRoot: string;

  beforeEach(() => {
    projectRoot = makeTmpDir();
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  describe("varsayılan config", () => {
    it("config dosyası yokken varsayılanları döner", () => {
      const config = loadConfig(projectRoot);
      expect(config.docsDir).toBe("docs");
      expect(config.magsDir).toBe("docs/.mags");
      expect(config.templates).toBe("general");
      expect(config.embedding.provider).toBe("local");
      expect(config.docValidation).toBe(true);
    });

    it("default locale is en", () => {
      const config = loadConfig(projectRoot);
      expect(config.locale).toBe("en");
    });

    it("default architecture is undefined", () => {
      const config = loadConfig(projectRoot);
      expect(config.architecture).toBeUndefined();
    });

    it("default modules is undefined", () => {
      const config = loadConfig(projectRoot);
      expect(config.modules).toBeUndefined();
    });

    it("default stack is undefined", () => {
      const config = loadConfig(projectRoot);
      expect(config.stack).toBeUndefined();
    });
  });

  describe("config dosyası yükleme", () => {
    it(".mags.yaml okunur", () => {
      writeFileSync(
        join(projectRoot, ".mags.yaml"),
        `docsDir: documentation\nmagsDir: .mags-data\ntemplates: saas\n`,
        "utf-8"
      );
      const config = loadConfig(projectRoot);
      expect(config.docsDir).toBe("documentation");
      expect(config.magsDir).toBe(".mags-data");
      expect(config.templates).toBe("saas");
    });

    it(".mags.yml alternatif isim çalışır", () => {
      writeFileSync(join(projectRoot, ".mags.yml"), `docsDir: docs-custom\n`, "utf-8");
      const config = loadConfig(projectRoot);
      expect(config.docsDir).toBe("docs-custom");
    });

    it("docs/.mags/config.yaml alternatif yol çalışır", () => {
      mkdirSync(join(projectRoot, "docs", ".mags"), { recursive: true });
      writeFileSync(join(projectRoot, "docs", ".mags", "config.yaml"), `docsDir: nested-docs\n`, "utf-8");
      const config = loadConfig(projectRoot);
      expect(config.docsDir).toBe("nested-docs");
    });

    it("öncelik sırası: .mags.yaml > .mags.yml > docs/.mags/config.yaml", () => {
      writeFileSync(join(projectRoot, ".mags.yaml"), `docsDir: from-yaml\n`, "utf-8");
      writeFileSync(join(projectRoot, ".mags.yml"), `docsDir: from-yml\n`, "utf-8");
      const config = loadConfig(projectRoot);
      expect(config.docsDir).toBe("from-yaml");
    });
  });

  describe("kısmi config merge", () => {
    it("eksik alanlar varsayılandan tamamlanır", () => {
      writeFileSync(join(projectRoot, ".mags.yaml"), `docsDir: custom-docs\n`, "utf-8");
      const config = loadConfig(projectRoot);
      expect(config.docsDir).toBe("custom-docs");
      expect(config.magsDir).toBe("docs/.mags");
      expect(config.docValidation).toBe(true);
    });

    it("embedding nested config merge çalışır", () => {
      writeFileSync(
        join(projectRoot, ".mags.yaml"),
        `embedding:\n  provider: openai\n  openaiApiKey: sk-test\n`,
        "utf-8"
      );
      const config = loadConfig(projectRoot);
      expect(config.embedding.provider).toBe("openai");
      expect(config.embedding.openaiApiKey).toBe("sk-test");
    });
  });

  describe("corrupted config", () => {
    it("geçersiz YAML varsayılana döner", () => {
      writeFileSync(join(projectRoot, ".mags.yaml"), "{{{{INVALID YAML!!!!", "utf-8");
      const config = loadConfig(projectRoot);
      expect(config.docsDir).toBe("docs");
    });
  });

  describe("path helpers", () => {
    it("getDocsPath doğru hesaplar", () => {
      const config = loadConfig(projectRoot);
      expect(getDocsPath(projectRoot, config)).toBe(join(projectRoot, "docs"));
    });

    it("getMagsPath doğru hesaplar", () => {
      const config = loadConfig(projectRoot);
      expect(getMagsPath(projectRoot, config)).toBe(join(projectRoot, "docs", ".mags"));
    });
  });

  // New tests for locale, architecture, modules, stack
  describe("locale config", () => {
    it("loads locale from config", () => {
      writeFileSync(join(projectRoot, ".mags.yaml"), `locale: tr\n`, "utf-8");
      const config = loadConfig(projectRoot);
      expect(config.locale).toBe("tr");
    });

    it("defaults to en when locale not specified", () => {
      writeFileSync(join(projectRoot, ".mags.yaml"), `docsDir: docs\n`, "utf-8");
      const config = loadConfig(projectRoot);
      expect(config.locale).toBe("en");
    });
  });

  describe("architecture config", () => {
    it("loads architecture from config", () => {
      writeFileSync(join(projectRoot, ".mags.yaml"), `architecture: microservices\n`, "utf-8");
      const config = loadConfig(projectRoot);
      expect(config.architecture).toBe("microservices");
    });

    it("accepts all architecture types", () => {
      for (const arch of ["monolith", "microservices", "library", "cli", "mobile", "serverless"]) {
        writeFileSync(join(projectRoot, ".mags.yaml"), `architecture: ${arch}\n`, "utf-8");
        const config = loadConfig(projectRoot);
        expect(config.architecture).toBe(arch);
      }
    });
  });

  describe("custom modules config", () => {
    it("loads custom modules from config", () => {
      writeFileSync(
        join(projectRoot, ".mags.yaml"),
        `modules:\n  - name: payments\n    aliases: [payments, billing, stripe]\n  - name: analytics\n    aliases: [analytics, metrics]\n`,
        "utf-8"
      );
      const config = loadConfig(projectRoot);
      expect(config.modules).toHaveLength(2);
      expect(config.modules![0].name).toBe("payments");
      expect(config.modules![0].aliases).toContain("stripe");
    });

    it("defaults to undefined when no modules specified", () => {
      writeFileSync(join(projectRoot, ".mags.yaml"), `docsDir: docs\n`, "utf-8");
      const config = loadConfig(projectRoot);
      expect(config.modules).toBeUndefined();
    });
  });

  describe("stack config", () => {
    it("loads stack config", () => {
      writeFileSync(
        join(projectRoot, ".mags.yaml"),
        `stack:\n  primaryLanguage: python\n  frameworks: [FastAPI]\n  databases: [PostgreSQL]\n`,
        "utf-8"
      );
      const config = loadConfig(projectRoot);
      expect(config.stack?.primaryLanguage).toBe("python");
      expect(config.stack?.frameworks).toContain("FastAPI");
    });
  });

  describe("customTemplatePacks config", () => {
    it("loads custom template packs", () => {
      writeFileSync(
        join(projectRoot, ".mags.yaml"),
        `customTemplatePacks:\n  - ./my-templates\n  - ./other-pack\n`,
        "utf-8"
      );
      const config = loadConfig(projectRoot);
      expect(config.customTemplatePacks).toHaveLength(2);
      expect(config.customTemplatePacks![0]).toBe("./my-templates");
    });
  });
});
