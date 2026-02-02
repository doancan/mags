import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { ModuleDiscoverer } from "./module-discoverer.js";

function makeTmpDir(): string {
  const dir = join(tmpdir(), `mags-mod-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("ModuleDiscoverer", () => {
  let projectRoot: string;
  let discoverer: ModuleDiscoverer;

  beforeEach(() => {
    projectRoot = makeTmpDir();
    discoverer = new ModuleDiscoverer();
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  describe("empty directory", () => {
    it("returns empty array for bare directory", () => {
      const modules = discoverer.discover(projectRoot);
      expect(modules).toEqual([]);
    });

    it("returns empty array for directory with no matching structure", () => {
      mkdirSync(join(projectRoot, "random-dir"), { recursive: true });
      const modules = discoverer.discover(projectRoot);
      expect(modules).toEqual([]);
    });
  });

  describe("monolith detection (default)", () => {
    it("discovers modules from src/modules/", () => {
      mkdirSync(join(projectRoot, "src", "modules", "auth"), { recursive: true });
      mkdirSync(join(projectRoot, "src", "modules", "users"), { recursive: true });

      const modules = discoverer.discover(projectRoot);
      expect(modules).toHaveLength(2);
      expect(modules.map((m) => m.name)).toContain("auth");
      expect(modules.map((m) => m.name)).toContain("users");
    });

    it("discovers modules from src/features/", () => {
      mkdirSync(join(projectRoot, "src", "features", "dashboard"), { recursive: true });

      const modules = discoverer.discover(projectRoot);
      expect(modules).toHaveLength(1);
      expect(modules[0].name).toBe("dashboard");
    });

    it("discovers modules from src/domains/", () => {
      mkdirSync(join(projectRoot, "src", "domains", "billing"), { recursive: true });

      const modules = discoverer.discover(projectRoot);
      expect(modules).toHaveLength(1);
      expect(modules[0].name).toBe("billing");
    });

    it("discovers modules from lib/", () => {
      mkdirSync(join(projectRoot, "lib", "core"), { recursive: true });

      const modules = discoverer.discover(projectRoot);
      expect(modules).toHaveLength(1);
      expect(modules[0].name).toBe("core");
    });

    it("includes detectedFrom field", () => {
      mkdirSync(join(projectRoot, "src", "modules", "auth"), { recursive: true });

      const modules = discoverer.discover(projectRoot);
      expect(modules[0].detectedFrom).toBe("src/modules");
    });

    it("includes path field", () => {
      mkdirSync(join(projectRoot, "src", "modules", "auth"), { recursive: true });

      const modules = discoverer.discover(projectRoot);
      expect(modules[0].path).toBe(join("src/modules", "auth"));
    });

    it("deduplicates modules by name", () => {
      mkdirSync(join(projectRoot, "src", "modules", "auth"), { recursive: true });
      mkdirSync(join(projectRoot, "src", "features", "auth"), { recursive: true });

      const modules = discoverer.discover(projectRoot);
      const authModules = modules.filter((m) => m.name === "auth");
      expect(authModules).toHaveLength(1);
    });

    it("ignores hidden directories", () => {
      mkdirSync(join(projectRoot, "src", "modules", ".hidden"), { recursive: true });
      mkdirSync(join(projectRoot, "src", "modules", "visible"), { recursive: true });

      const modules = discoverer.discover(projectRoot);
      expect(modules).toHaveLength(1);
      expect(modules[0].name).toBe("visible");
    });
  });

  describe("microservices detection", () => {
    it("discovers services from services/", () => {
      mkdirSync(join(projectRoot, "services", "user-service"), { recursive: true });
      mkdirSync(join(projectRoot, "services", "order-service"), { recursive: true });

      const modules = discoverer.discover(projectRoot, "microservices");
      expect(modules).toHaveLength(2);
      expect(modules.map((m) => m.name)).toContain("user-service");
      expect(modules.map((m) => m.name)).toContain("order-service");
    });

    it("discovers services from apps/", () => {
      mkdirSync(join(projectRoot, "apps", "api"), { recursive: true });
      mkdirSync(join(projectRoot, "apps", "web"), { recursive: true });

      const modules = discoverer.discover(projectRoot, "microservices");
      expect(modules).toHaveLength(2);
    });

    it("discovers services from packages/", () => {
      mkdirSync(join(projectRoot, "packages", "shared"), { recursive: true });

      const modules = discoverer.discover(projectRoot, "microservices");
      expect(modules).toHaveLength(1);
      expect(modules[0].name).toBe("shared");
    });
  });

  describe("library detection", () => {
    it("discovers modules from src/", () => {
      mkdirSync(join(projectRoot, "src", "core"), { recursive: true });
      mkdirSync(join(projectRoot, "src", "utils"), { recursive: true });

      const modules = discoverer.discover(projectRoot, "library");
      expect(modules.map((m) => m.name)).toContain("core");
      expect(modules.map((m) => m.name)).toContain("utils");
    });

    it("skips test directories", () => {
      mkdirSync(join(projectRoot, "src", "core"), { recursive: true });
      mkdirSync(join(projectRoot, "src", "__tests__"), { recursive: true });
      mkdirSync(join(projectRoot, "src", "tests"), { recursive: true });
      mkdirSync(join(projectRoot, "src", "test"), { recursive: true });

      const modules = discoverer.discover(projectRoot, "library");
      const names = modules.map((m) => m.name);
      expect(names).toContain("core");
      expect(names).not.toContain("__tests__");
      expect(names).not.toContain("tests");
      expect(names).not.toContain("test");
    });

    it("skips node_modules and .git", () => {
      mkdirSync(join(projectRoot, "src", "core"), { recursive: true });
      mkdirSync(join(projectRoot, "src", "node_modules"), { recursive: true });

      const modules = discoverer.discover(projectRoot, "library");
      const names = modules.map((m) => m.name);
      expect(names).not.toContain("node_modules");
    });
  });

  describe("cli detection", () => {
    it("discovers commands from src/commands/", () => {
      mkdirSync(join(projectRoot, "src", "commands", "init"), { recursive: true });
      mkdirSync(join(projectRoot, "src", "commands", "build"), { recursive: true });

      const modules = discoverer.discover(projectRoot, "cli");
      expect(modules).toHaveLength(2);
      expect(modules.map((m) => m.name)).toContain("init");
      expect(modules.map((m) => m.name)).toContain("build");
    });

    it("discovers commands from cmd/", () => {
      mkdirSync(join(projectRoot, "cmd", "serve"), { recursive: true });

      const modules = discoverer.discover(projectRoot, "cli");
      expect(modules).toHaveLength(1);
      expect(modules[0].name).toBe("serve");
    });
  });

  describe("confidence scoring", () => {
    it("base score is at least 40 for directory in expected location", () => {
      mkdirSync(join(projectRoot, "src", "modules", "empty-module"), { recursive: true });

      const modules = discoverer.discover(projectRoot);
      expect(modules[0].confidence).toBeGreaterThanOrEqual(40);
    });

    it("higher confidence for modules with source files", () => {
      mkdirSync(join(projectRoot, "src", "modules", "with-src"), { recursive: true });
      writeFileSync(join(projectRoot, "src", "modules", "with-src", "index.ts"), "export {};", "utf-8");

      mkdirSync(join(projectRoot, "src", "modules", "empty"), { recursive: true });

      const modules = discoverer.discover(projectRoot);
      const withSrc = modules.find((m) => m.name === "with-src")!;
      const empty = modules.find((m) => m.name === "empty")!;
      expect(withSrc.confidence).toBeGreaterThan(empty.confidence);
    });

    it("higher confidence for modules with package.json", () => {
      mkdirSync(join(projectRoot, "src", "modules", "with-pkg"), { recursive: true });
      writeFileSync(
        join(projectRoot, "src", "modules", "with-pkg", "package.json"),
        JSON.stringify({ name: "with-pkg" }),
        "utf-8"
      );

      mkdirSync(join(projectRoot, "src", "modules", "no-pkg"), { recursive: true });

      const modules = discoverer.discover(projectRoot);
      const withPkg = modules.find((m) => m.name === "with-pkg")!;
      const noPkg = modules.find((m) => m.name === "no-pkg")!;
      expect(withPkg.confidence).toBeGreaterThan(noPkg.confidence);
    });

    it("Dockerfile boosts microservices confidence", () => {
      mkdirSync(join(projectRoot, "services", "api"), { recursive: true });
      writeFileSync(join(projectRoot, "services", "api", "Dockerfile"), "FROM node:20\n", "utf-8");

      mkdirSync(join(projectRoot, "services", "worker"), { recursive: true });

      const modules = discoverer.discover(projectRoot, "microservices");
      const api = modules.find((m) => m.name === "api")!;
      const worker = modules.find((m) => m.name === "worker")!;
      expect(api.confidence).toBeGreaterThan(worker.confidence);
    });

    it("confidence is capped at 100", () => {
      mkdirSync(join(projectRoot, "src", "modules", "full"), { recursive: true });
      writeFileSync(join(projectRoot, "src", "modules", "full", "index.ts"), "export {};", "utf-8");
      writeFileSync(join(projectRoot, "src", "modules", "full", "main.ts"), "export {};", "utf-8");
      writeFileSync(
        join(projectRoot, "src", "modules", "full", "package.json"),
        JSON.stringify({ name: "full" }),
        "utf-8"
      );
      writeFileSync(join(projectRoot, "src", "modules", "full", "README.md"), "# Full", "utf-8");
      mkdirSync(join(projectRoot, "src", "modules", "full", "tests"), { recursive: true });

      const modules = discoverer.discover(projectRoot);
      expect(modules[0].confidence).toBeLessThanOrEqual(100);
    });
  });
});
