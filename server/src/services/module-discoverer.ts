// ============================================
// MAGS — Module Discoverer
// Detects modules from project directory structure
// ============================================

import { existsSync, readdirSync, lstatSync } from "node:fs";
import { join, basename } from "node:path";
import type { ArchitectureType } from "../types/index.js";

export interface DiscoveredModule {
  name: string;
  path: string;
  detectedFrom: string;
  confidence: number;
}

export class ModuleDiscoverer {
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

    // Deduplicate by name
    const seen = new Set<string>();
    return modules.filter((m) => {
      if (seen.has(m.name)) return false;
      seen.add(m.name);
      return true;
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
    } catch {
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
    } catch {
      // Can't read directory
    }

    return Math.min(100, score);
  }
}
