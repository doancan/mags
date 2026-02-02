import { describe, it, expect } from "vitest";
import { getStackRules, getArchitectureGuidance, STACK_RULES, ARCHITECTURE_GUIDANCE } from "./claude-md-rules.js";
import type { ArchitectureType, StackConfig } from "../types/index.js";

describe("claude-md-rules", () => {
  describe("getStackRules", () => {
    it("returns typescript rules for typescript stack", () => {
      const rules = getStackRules({ primaryLanguage: "typescript" });
      expect(rules.length).toBeGreaterThan(0);
      expect(rules).toEqual(STACK_RULES.typescript);
    });

    it("returns python rules for python stack", () => {
      const rules = getStackRules({ primaryLanguage: "python" });
      expect(rules.length).toBeGreaterThan(0);
      expect(rules).toEqual(STACK_RULES.python);
    });

    it("returns go rules for go stack", () => {
      const rules = getStackRules({ primaryLanguage: "go" });
      expect(rules.length).toBeGreaterThan(0);
      expect(rules).toEqual(STACK_RULES.go);
    });

    it("returns rust rules for rust stack", () => {
      const rules = getStackRules({ primaryLanguage: "rust" });
      expect(rules.length).toBeGreaterThan(0);
      expect(rules).toEqual(STACK_RULES.rust);
    });

    it("returns java rules for java stack", () => {
      const rules = getStackRules({ primaryLanguage: "java" });
      expect(rules.length).toBeGreaterThan(0);
      expect(rules).toEqual(STACK_RULES.java);
    });

    it("returns javascript rules for javascript stack", () => {
      const rules = getStackRules({ primaryLanguage: "javascript" });
      expect(rules.length).toBeGreaterThan(0);
      expect(rules).toEqual(STACK_RULES.javascript);
    });

    it("maps typescript/javascript to typescript rules", () => {
      const rules = getStackRules({ primaryLanguage: "typescript/javascript" });
      expect(rules).toEqual(STACK_RULES.typescript);
    });

    it("returns empty array for unknown language", () => {
      const rules = getStackRules({ primaryLanguage: "cobol" });
      expect(rules).toEqual([]);
    });

    it("returns empty array when no stack provided", () => {
      const rules = getStackRules(undefined);
      expect(rules).toEqual([]);
    });

    it("returns empty array when primaryLanguage is undefined", () => {
      const rules = getStackRules({});
      expect(rules).toEqual([]);
    });

    it("handles case-insensitive language names", () => {
      const rules = getStackRules({ primaryLanguage: "Python" });
      // The function lowercases, so this should work
      expect(rules.length).toBeGreaterThan(0);
    });

    it("typescript rules mention strict mode", () => {
      const rules = getStackRules({ primaryLanguage: "typescript" });
      const hasStrict = rules.some((r) => r.toLowerCase().includes("strict"));
      expect(hasStrict).toBe(true);
    });

    it("python rules mention PEP 8", () => {
      const rules = getStackRules({ primaryLanguage: "python" });
      const hasPep8 = rules.some((r) => r.includes("PEP 8"));
      expect(hasPep8).toBe(true);
    });

    it("go rules mention gofmt", () => {
      const rules = getStackRules({ primaryLanguage: "go" });
      const hasGofmt = rules.some((r) => r.includes("gofmt"));
      expect(hasGofmt).toBe(true);
    });

    it("rust rules mention clippy", () => {
      const rules = getStackRules({ primaryLanguage: "rust" });
      const hasClippy = rules.some((r) => r.includes("clippy"));
      expect(hasClippy).toBe(true);
    });

    it("java rules mention Optional", () => {
      const rules = getStackRules({ primaryLanguage: "java" });
      const hasOptional = rules.some((r) => r.includes("Optional"));
      expect(hasOptional).toBe(true);
    });
  });

  describe("getArchitectureGuidance", () => {
    const ALL_ARCHITECTURES: ArchitectureType[] = [
      "monolith",
      "microservices",
      "library",
      "cli",
      "mobile",
      "serverless",
    ];

    it.each(ALL_ARCHITECTURES)("returns non-empty guidance for %s", (arch) => {
      const guidance = getArchitectureGuidance(arch);
      expect(guidance.length).toBeGreaterThan(0);
      expect(guidance).toEqual(ARCHITECTURE_GUIDANCE[arch]);
    });

    it("returns empty array when architecture is undefined", () => {
      const guidance = getArchitectureGuidance(undefined);
      expect(guidance).toEqual([]);
    });

    it("returns empty array for unknown architecture", () => {
      const guidance = getArchitectureGuidance("quantum" as ArchitectureType);
      expect(guidance).toEqual([]);
    });

    it("monolith guidance mentions modules", () => {
      const guidance = getArchitectureGuidance("monolith");
      const hasModules = guidance.some((g) => g.toLowerCase().includes("module"));
      expect(hasModules).toBe(true);
    });

    it("microservices guidance mentions services", () => {
      const guidance = getArchitectureGuidance("microservices");
      const hasServices = guidance.some((g) => g.toLowerCase().includes("service"));
      expect(hasServices).toBe(true);
    });

    it("library guidance mentions API surface", () => {
      const guidance = getArchitectureGuidance("library");
      const hasApi = guidance.some((g) => g.toLowerCase().includes("api"));
      expect(hasApi).toBe(true);
    });

    it("cli guidance mentions help", () => {
      const guidance = getArchitectureGuidance("cli");
      const hasHelp = guidance.some((g) => g.includes("--help"));
      expect(hasHelp).toBe(true);
    });

    it("mobile guidance mentions offline", () => {
      const guidance = getArchitectureGuidance("mobile");
      const hasOffline = guidance.some((g) => g.toLowerCase().includes("offline"));
      expect(hasOffline).toBe(true);
    });

    it("serverless guidance mentions stateless", () => {
      const guidance = getArchitectureGuidance("serverless");
      const hasStateless = guidance.some((g) => g.toLowerCase().includes("stateless"));
      expect(hasStateless).toBe(true);
    });
  });
});
