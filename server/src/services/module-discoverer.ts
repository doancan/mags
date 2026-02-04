// ============================================
// MAGS — Module Discoverer
// Detects modules from project directory structure
// with config override support
// ============================================

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { ArchitectureType, ModuleDefinition, MagsConfig } from "../types/index.js";
import { DEFAULT_MODULES } from "../config/defaults.js";

export interface DiscoveredModule {
  name: string;
  path: string;
  detectedFrom: string;
  confidence: number;
  aliases?: string[];
}

export class ModuleDiscoverer {
  private moduleDefinitions: ModuleDefinition[];

  constructor(config?: MagsConfig) {
    // Merge config modules with defaults, config takes precedence
    this.moduleDefinitions = this.mergeModuleDefinitions(config?.modules);
  }

  /**
   * Merge config modules with DEFAULT_MODULES.
   * Config modules override defaults with the same name.
   */
  private mergeModuleDefinitions(configModules?: ModuleDefinition[]): ModuleDefinition[] {
    if (!configModules || configModules.length === 0) {
      return [...DEFAULT_MODULES];
    }

    // Create a map from defaults
    const moduleMap = new Map<string, ModuleDefinition>(
      DEFAULT_MODULES.map((m) => [m.name.toLowerCase(), m])
    );

    // Override/add with config modules
    for (const configModule of configModules) {
      moduleMap.set(configModule.name.toLowerCase(), configModule);
    }

    return Array.from(moduleMap.values());
  }

  /**
   * Get all module definitions (for tool info)
   */
  getModuleDefinitions(): ModuleDefinition[] {
    return this.moduleDefinitions;
  }

  /**
   * Find a module definition by name or alias
   */
  findModuleDefinition(nameOrAlias: string): ModuleDefinition | undefined {
    const lower = nameOrAlias.toLowerCase();
    return this.moduleDefinitions.find(
      (m) => m.name.toLowerCase() === lower || m.aliases.some((a) => a.toLowerCase() === lower)
    );
  }

  discover(projectRoot: string, architecture?: ArchitectureType): DiscoveredModule[] {
    const arch = architecture ?? "monolith";
    const modules: DiscoveredModule[] = [];

    switch (arch) {
      case "microservices":
        modules.push(...this.scanMicroservices(projectRoot));
        break;
      case "library":
        modules.push(...this.scanLibrary(projectRoot));
        break;
      case "cli":
        modules.push(...this.scanCli(projectRoot));
        break;
      default:
        modules.push(...this.scanMonolith(projectRoot));
        break;
    }

    // Deduplicate by name and enrich with aliases
    const seen = new Set<string>();
    return modules
      .filter((m) => {
        if (seen.has(m.name)) return false;
        seen.add(m.name);
        return true;
      })
      .map((m) => {
        // Try to find matching module definition for aliases
        const def = this.findModuleDefinition(m.name);
        if (def) {
          return { ...m, aliases: def.aliases };
        }
        return m;
      });
  }

  private scanMonolith(root: string): DiscoveredModule[] {
    const modules: DiscoveredModule[] = [];
    const moduleDirs = [
      "src/modules",
      "src/features",
      "src/domains",
      "src/app",
      "lib",
      "app/modules",
      "app/domains",
    ];

    for (const dir of moduleDirs) {
      const fullPath = join(root, dir);
      if (!existsSync(fullPath)) continue;

      const entries = this.getDirectories(fullPath);
      for (const entry of entries) {
        modules.push({
          name: entry,
          path: join(dir, entry),
          detectedFrom: dir,
          confidence: this.calculateConfidence(join(fullPath, entry), "monolith"),
        });
      }
    }

    return modules;
  }

  private scanMicroservices(root: string): DiscoveredModule[] {
    const modules: DiscoveredModule[] = [];
    const serviceDirs = [
      "services",
      "apps",
      "packages",
      "microservices",
    ];

    for (const dir of serviceDirs) {
      const fullPath = join(root, dir);
      if (!existsSync(fullPath)) continue;

      const entries = this.getDirectories(fullPath);
      for (const entry of entries) {
        const entryPath = join(fullPath, entry);
        modules.push({
          name: entry,
          path: join(dir, entry),
          detectedFrom: dir,
          confidence: this.calculateConfidence(entryPath, "microservices"),
        });
      }
    }

    return modules;
  }

  private scanLibrary(root: string): DiscoveredModule[] {
    const modules: DiscoveredModule[] = [];
    const libDirs = ["src", "lib", "packages"];

    for (const dir of libDirs) {
      const fullPath = join(root, dir);
      if (!existsSync(fullPath)) continue;

      const entries = this.getDirectories(fullPath);
      for (const entry of entries) {
        // Skip common non-module directories
        if (["__tests__", "__mocks__", "test", "tests", "node_modules", ".git"].includes(entry)) continue;

        modules.push({
          name: entry,
          path: join(dir, entry),
          detectedFrom: dir,
          confidence: this.calculateConfidence(join(fullPath, entry), "library"),
        });
      }
    }

    return modules;
  }

  private scanCli(root: string): DiscoveredModule[] {
    const modules: DiscoveredModule[] = [];
    const cmdDirs = ["src/commands", "src/cmd", "cmd", "commands"];

    for (const dir of cmdDirs) {
      const fullPath = join(root, dir);
      if (!existsSync(fullPath)) continue;

      const entries = this.getDirectories(fullPath);
      for (const entry of entries) {
        modules.push({
          name: entry,
          path: join(dir, entry),
          detectedFrom: dir,
          confidence: 70,
        });
      }
    }

    return modules;
  }

  private getDirectories(dirPath: string): string[] {
    try {
      return readdirSync(dirPath, { withFileTypes: true })
        .filter((e) => e.isDirectory() && !e.name.startsWith("."))
        .map((e) => e.name);
    } catch (err) {
      console.warn(`[ModuleDiscoverer] Failed to read directory ${dirPath}:`, err instanceof Error ? err.message : err);
      return [];
    }
  }

  private calculateConfidence(modulePath: string, arch: string): number {
    let score = 40; // Base score for being a directory in expected location

    try {
      const files = readdirSync(modulePath);

      // Has source files
      if (files.some((f) => /\.(ts|js|py|go|rs|java)$/.test(f))) score += 20;

      // Has package.json or module manifest
      if (files.includes("package.json")) score += 15;
      if (files.includes("Cargo.toml")) score += 15;
      if (files.includes("go.mod")) score += 15;

      // Has Dockerfile (strong microservices signal)
      if (arch === "microservices" && files.includes("Dockerfile")) score += 20;

      // Has index/main entry point
      if (files.some((f) => /^(index|main|mod)\.(ts|js|py|go|rs)$/.test(f))) score += 10;

      // Has tests directory
      if (files.includes("tests") || files.includes("__tests__") || files.includes("test")) score += 5;

      // Has README
      if (files.some((f) => f.toLowerCase().startsWith("readme"))) score += 5;
    } catch (err) {
      console.warn(`[ModuleDiscoverer] Failed to calculate confidence for ${modulePath}:`, err instanceof Error ? err.message : err);
    }

    return Math.min(100, score);
  }
}
