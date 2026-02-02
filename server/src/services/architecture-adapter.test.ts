import { describe, it, expect } from "vitest";
import { ArchitectureAdapter } from "./architecture-adapter.js";
import type { ArchitectureType } from "../types/index.js";

const ALL_ARCHITECTURES: ArchitectureType[] = [
  "monolith",
  "microservices",
  "library",
  "cli",
  "mobile",
  "serverless",
];

describe("ArchitectureAdapter", () => {
  describe("getDefaults", () => {
    it.each(ALL_ARCHITECTURES)("returns non-empty defaults for %s", (arch) => {
      const adapter = new ArchitectureAdapter(arch);
      const defaults = adapter.getDefaults();

      expect(defaults.templates.length).toBeGreaterThan(0);
      expect(defaults.modules.length).toBeGreaterThan(0);
      expect(defaults.guidance.length).toBeGreaterThan(0);
    });

    it("falls back to monolith for unknown architecture", () => {
      const adapter = new ArchitectureAdapter("unknown" as ArchitectureType);
      const defaults = adapter.getDefaults();
      const monolithAdapter = new ArchitectureAdapter("monolith");
      const monolithDefaults = monolithAdapter.getDefaults();

      expect(defaults).toEqual(monolithDefaults);
    });
  });

  describe("getTemplates", () => {
    it.each(ALL_ARCHITECTURES)("returns non-empty templates for %s", (arch) => {
      const adapter = new ArchitectureAdapter(arch);
      const templates = adapter.getTemplates();
      expect(templates.length).toBeGreaterThan(0);
    });

    it("monolith includes common doc templates", () => {
      const adapter = new ArchitectureAdapter("monolith");
      const templates = adapter.getTemplates();
      expect(templates).toContain("vision");
      expect(templates).toContain("prd");
      expect(templates).toContain("tech-stack");
    });

    it("microservices includes service-specific templates", () => {
      const adapter = new ArchitectureAdapter("microservices");
      const templates = adapter.getTemplates();
      expect(templates).toContain("service-catalog");
      expect(templates).toContain("api-gateway");
      expect(templates).toContain("inter-service-comm");
    });

    it("library includes api-reference and versioning templates", () => {
      const adapter = new ArchitectureAdapter("library");
      const templates = adapter.getTemplates();
      expect(templates).toContain("api-reference");
      expect(templates).toContain("versioning");
      expect(templates).toContain("usage-guide");
    });

    it("cli includes cli-design and cli-reference templates", () => {
      const adapter = new ArchitectureAdapter("cli");
      const templates = adapter.getTemplates();
      expect(templates).toContain("cli-design");
      expect(templates).toContain("cli-reference");
    });

    it("mobile includes screens and platform-config templates", () => {
      const adapter = new ArchitectureAdapter("mobile");
      const templates = adapter.getTemplates();
      expect(templates).toContain("screens");
      expect(templates).toContain("platform-config");
    });

    it("serverless includes functions and event-triggers templates", () => {
      const adapter = new ArchitectureAdapter("serverless");
      const templates = adapter.getTemplates();
      expect(templates).toContain("functions");
      expect(templates).toContain("event-triggers");
    });
  });

  describe("getModules", () => {
    it.each(ALL_ARCHITECTURES)("returns non-empty modules for %s", (arch) => {
      const adapter = new ArchitectureAdapter(arch);
      const modules = adapter.getModules();
      expect(modules.length).toBeGreaterThan(0);
    });

    it("monolith includes auth and core modules", () => {
      const adapter = new ArchitectureAdapter("monolith");
      expect(adapter.getModules()).toContain("auth");
      expect(adapter.getModules()).toContain("core");
    });

    it("microservices includes api-gateway module", () => {
      const adapter = new ArchitectureAdapter("microservices");
      expect(adapter.getModules()).toContain("api-gateway");
    });

    it("cli includes commands module", () => {
      const adapter = new ArchitectureAdapter("cli");
      expect(adapter.getModules()).toContain("commands");
    });
  });

  describe("getGuidance", () => {
    it.each(ALL_ARCHITECTURES)("returns non-empty guidance for %s", (arch) => {
      const adapter = new ArchitectureAdapter(arch);
      const guidance = adapter.getGuidance();
      expect(guidance.length).toBeGreaterThan(0);
      guidance.forEach((g) => expect(typeof g).toBe("string"));
    });

    it("microservices guidance mentions service boundaries", () => {
      const adapter = new ArchitectureAdapter("microservices");
      const guidance = adapter.getGuidance();
      const hasServiceBoundary = guidance.some(
        (g) => g.toLowerCase().includes("service") || g.toLowerCase().includes("boundary")
      );
      expect(hasServiceBoundary).toBe(true);
    });

    it("serverless guidance mentions stateless", () => {
      const adapter = new ArchitectureAdapter("serverless");
      const guidance = adapter.getGuidance();
      const hasStateless = guidance.some((g) => g.toLowerCase().includes("stateless"));
      expect(hasStateless).toBe(true);
    });
  });
});
