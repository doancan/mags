// ============================================
// MAGS — PRD Parser (Strict Schema)
// ============================================

import * as fs from "fs";
import matter from "gray-matter";
import type {
  ExtractedPlan,
  ExtractedModule,
  Feature,
  Phase,
  DependencyNode,
  Priority,
  PhaseNumber,
  PrdValidationError,
  PrdValidationResult,
} from "../../types/orchestrator.js";

// --- Regex Patterns ---

const MODULE_HEADER_REGEX = /^###\s+M(\d+):\s+(.+)$/;
const MODULE_DESC_REGEX = /^>\s+(.+)$/;
const FEATURE_TABLE_REGEX = /^\|\s*([A-Z0-9-]+)\s*\|\s*([^|]+)\s*\|\s*([^|]*)\s*\|\s*(P[012])\s*\|\s*([123])\s*\|$/;
const ACCEPTANCE_REGEX = /^-\s+\[[ x]\]\s+(.+)$/;
const DEPENDENCY_REQUIRES_REGEX = /^-\s+Requires:\s*\[([^\]]*)\]$/;
const DEPENDENCY_BLOCKS_REGEX = /^-\s+Blocks:\s*\[([^\]]*)\]$/;

// --- Parser Class ---

export class PrdParser {
  private errors: PrdValidationError[] = [];
  private warnings: PrdValidationError[] = [];

  /**
   * Parse PRD file and extract plan
   */
  async parse(prdPath: string): Promise<ExtractedPlan | null> {
    this.errors = [];
    this.warnings = [];

    // Read file
    if (!fs.existsSync(prdPath)) {
      this.errors.push({
        type: "missing",
        message: `PRD file not found: ${prdPath}`,
      });
      return null;
    }

    const content = fs.readFileSync(prdPath, "utf-8");

    // Parse frontmatter safely
    let frontmatter: Record<string, unknown> = {};
    let body: string = content;

    try {
      const parsed = matter(content);
      frontmatter = parsed.data;
      body = parsed.content;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown YAML error";
      this.errors.push({
        type: "format",
        message: `Invalid YAML frontmatter: ${errorMsg}`,
        suggestion: "Check YAML syntax in frontmatter section",
      });
      return null;
    }

    // Parse sections
    const lines = body.split("\n");
    const projectName = this.extractProjectName(lines, frontmatter);
    const overview = this.extractOverview(lines);
    const modules = this.extractModules(lines);
    const phases = this.extractPhases(lines, modules);

    // Validate
    this.validateModules(modules);
    this.validateDependencies(modules);

    if (this.errors.length > 0) {
      return null;
    }

    // Build dependency graph
    const dependencyGraph = this.buildDependencyGraph(modules);

    return {
      version: "1.0",
      extractedAt: new Date().toISOString(),
      source: prdPath,
      project: {
        name: projectName,
        overview,
      },
      phases,
      modules,
      totalFeatures: modules.reduce((sum, m) => sum + m.features.length, 0),
      dependencyGraph,
    };
  }

  /**
   * Validate PRD without full parse
   */
  validate(prdPath: string): PrdValidationResult {
    this.parse(prdPath);
    return {
      valid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
    };
  }

  /**
   * Get validation errors
   */
  getErrors(): PrdValidationError[] {
    return this.errors;
  }

  /**
   * Get validation warnings
   */
  getWarnings(): PrdValidationError[] {
    return this.warnings;
  }

  // --- Private Methods ---

  private extractProjectName(lines: string[], frontmatter: Record<string, unknown>): string {
    // Try frontmatter first
    if (frontmatter?.title && typeof frontmatter.title === "string") {
      return frontmatter.title.replace(/[—\-:].+$/, "").trim();
    }

    // Try H1 header
    const h1 = lines.find((l) => l.startsWith("# "));
    if (h1) {
      return h1.replace(/^#\s+/, "").replace(/[—-].+$/, "").trim();
    }

    this.warnings.push({
      type: "missing",
      message: "Project name not found, using default",
    });
    return "Unnamed Project";
  }

  private extractOverview(lines: string[]): string {
    const overviewIdx = lines.findIndex((l) => l.match(/^##\s+Overview/i));
    if (overviewIdx === -1) {
      this.warnings.push({
        type: "missing",
        message: "Overview section not found",
      });
      return "";
    }

    const content: string[] = [];
    for (let i = overviewIdx + 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith("##")) break;
      if (line.trim()) content.push(line.trim());
    }
    return content.join(" ");
  }

  private extractModules(lines: string[]): ExtractedModule[] {
    const modules: ExtractedModule[] = [];
    let currentModule: Partial<ExtractedModule> | null = null;
    let inFeatureTable = false;
    let inAcceptanceCriteria = false;
    let inDependencies = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Module header: ### M1: auth
      const moduleMatch = line.match(MODULE_HEADER_REGEX);
      if (moduleMatch) {
        // Save previous module
        if (currentModule && currentModule.id) {
          modules.push(this.finalizeModule(currentModule));
        }

        currentModule = {
          id: `M${moduleMatch[1]}`,
          name: moduleMatch[2].trim().toLowerCase(),
          description: "",
          features: [],
          acceptanceCriteria: [],
          dependencies: { requires: [], blocks: [] },
          phase: 1,
          priority: "P0",
        };
        inFeatureTable = false;
        inAcceptanceCriteria = false;
        inDependencies = false;
        continue;
      }

      if (!currentModule) continue;

      // Module description: > description
      const descMatch = line.match(MODULE_DESC_REGEX);
      if (descMatch && !currentModule.description) {
        currentModule.description = descMatch[1].trim();
        continue;
      }

      // Section headers
      if (line.match(/^####\s+Features/i)) {
        inFeatureTable = true;
        inAcceptanceCriteria = false;
        inDependencies = false;
        continue;
      }
      if (line.match(/^####\s+Acceptance\s+Criteria/i)) {
        inFeatureTable = false;
        inAcceptanceCriteria = true;
        inDependencies = false;
        continue;
      }
      if (line.match(/^####\s+Dependencies/i)) {
        inFeatureTable = false;
        inAcceptanceCriteria = false;
        inDependencies = true;
        continue;
      }
      if (line.match(/^#{1,4}\s+/)) {
        inFeatureTable = false;
        inAcceptanceCriteria = false;
        inDependencies = false;
      }

      // Feature table row
      if (inFeatureTable) {
        const featureMatch = line.match(FEATURE_TABLE_REGEX);
        if (featureMatch) {
          const feature: Feature = {
            id: featureMatch[1].trim(),
            name: featureMatch[2].trim(),
            description: featureMatch[3].trim(),
            priority: featureMatch[4].trim() as Priority,
            phase: parseInt(featureMatch[5]) as PhaseNumber,
            status: "pending",
          };

          // Validate feature ID format
          const expectedPrefix = currentModule.id || "";
          if (expectedPrefix && !feature.id.startsWith(expectedPrefix)) {
            this.errors.push({
              line: lineNum,
              type: "format",
              message: `Feature ID "${feature.id}" should start with "${expectedPrefix}"`,
              suggestion: `Use format: ${expectedPrefix}-001`,
            });
          }

          currentModule.features!.push(feature);
        }
      }

      // Acceptance criteria
      if (inAcceptanceCriteria) {
        const acMatch = line.match(ACCEPTANCE_REGEX);
        if (acMatch) {
          currentModule.acceptanceCriteria!.push(acMatch[1].trim());
        }
      }

      // Dependencies
      if (inDependencies) {
        const reqMatch = line.match(DEPENDENCY_REQUIRES_REGEX);
        if (reqMatch) {
          currentModule.dependencies!.requires = this.parseList(reqMatch[1]);
        }
        const blockMatch = line.match(DEPENDENCY_BLOCKS_REGEX);
        if (blockMatch) {
          currentModule.dependencies!.blocks = this.parseList(blockMatch[1]);
        }
      }
    }

    // Save last module
    if (currentModule && currentModule.id) {
      modules.push(this.finalizeModule(currentModule));
    }

    return modules;
  }

  private extractPhases(lines: string[], modules: ExtractedModule[]): Phase[] {
    const phases: Phase[] = [
      { phase: 1, name: "MVP", modules: [] },
      { phase: 2, name: "Growth", modules: [] },
      { phase: 3, name: "Scale", modules: [] },
    ];

    // Try to find Phase Summary table
    const phaseIdx = lines.findIndex((l) => l.match(/^##\s+Phase\s+Summary/i));
    if (phaseIdx !== -1) {
      for (let i = phaseIdx + 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith("##")) break;

        const match = line.match(/^\|\s*([123])\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|$/);
        if (match) {
          const phaseNum = parseInt(match[1]) as PhaseNumber;
          const phase = phases.find((p) => p.phase === phaseNum);
          if (phase) {
            phase.name = match[3].trim();
            phase.modules = this.parseList(match[2]);
          }
        }
      }
    }

    // Fill from modules based on their features' phases
    for (const module of modules) {
      // Get all unique phases from this module's features
      const featurePhases = new Set(module.features.map((f) => f.phase));

      for (const phaseNum of featurePhases) {
        const phase = phases.find((p) => p.phase === phaseNum);
        if (phase && !phase.modules.includes(module.name)) {
          phase.modules.push(module.name);
        }
      }
    }

    return phases.filter((p) => p.modules.length > 0);
  }

  private validateModules(modules: ExtractedModule[]): void {
    if (modules.length === 0) {
      this.errors.push({
        type: "missing",
        message: "No modules found in PRD",
        suggestion: "Add modules using format: ### M1: module_name",
      });
      return;
    }

    // Check for duplicate IDs
    const ids = new Set<string>();
    for (const module of modules) {
      if (ids.has(module.id)) {
        this.errors.push({
          type: "format",
          message: `Duplicate module ID: ${module.id}`,
        });
      }
      ids.add(module.id);

      // Check features
      if (module.features.length === 0) {
        this.warnings.push({
          type: "missing",
          message: `Module "${module.name}" has no features`,
        });
      }
    }
  }

  private validateDependencies(modules: ExtractedModule[]): void {
    const moduleNames = new Set(modules.map((m) => m.name));

    for (const module of modules) {
      // Check requires
      for (const req of module.dependencies.requires) {
        if (!moduleNames.has(req)) {
          this.errors.push({
            type: "reference",
            message: `Module "${module.name}" requires unknown module "${req}"`,
            suggestion: `Available modules: ${[...moduleNames].join(", ")}`,
          });
        }
      }

      // Check blocks
      for (const block of module.dependencies.blocks) {
        if (!moduleNames.has(block)) {
          this.warnings.push({
            type: "reference",
            message: `Module "${module.name}" blocks unknown module "${block}"`,
          });
        }
      }
    }

    // Check circular dependencies
    const circular = this.detectCircularDependencies(modules);
    if (circular) {
      this.errors.push({
        type: "dependency",
        message: `Circular dependency detected: ${circular.join(" → ")}`,
      });
    }
  }

  private detectCircularDependencies(modules: ExtractedModule[]): string[] | null {
    const visited = new Set<string>();
    const stack = new Set<string>();
    const path: string[] = [];

    const dfs = (name: string): boolean => {
      if (stack.has(name)) {
        path.push(name);
        return true;
      }
      if (visited.has(name)) return false;

      visited.add(name);
      stack.add(name);
      path.push(name);

      const module = modules.find((m) => m.name === name);
      if (module) {
        for (const dep of module.dependencies.requires) {
          if (dfs(dep)) return true;
        }
      }

      stack.delete(name);
      path.pop();
      return false;
    };

    for (const module of modules) {
      if (dfs(module.name)) {
        const cycleStart = path.indexOf(path[path.length - 1]);
        return path.slice(cycleStart);
      }
      visited.clear();
      stack.clear();
      path.length = 0;
    }

    return null;
  }

  private buildDependencyGraph(modules: ExtractedModule[]): DependencyNode[] {
    return modules.map((module) => ({
      module: module.name,
      dependsOn: module.dependencies.requires,
      blockedBy: modules
        .filter((m) => m.dependencies.blocks.includes(module.name))
        .map((m) => m.name),
    }));
  }

  private finalizeModule(partial: Partial<ExtractedModule>): ExtractedModule {
    // Determine priority from features
    const priorities = partial.features?.map((f) => f.priority) || [];
    const priority: Priority = priorities.includes("P0")
      ? "P0"
      : priorities.includes("P1")
      ? "P1"
      : "P2";

    // Determine phase from features
    const phases = partial.features?.map((f) => f.phase) || [];
    const phase: PhaseNumber = Math.min(...phases, 1) as PhaseNumber;

    return {
      id: partial.id!,
      name: partial.name!,
      description: partial.description || "",
      features: partial.features || [],
      acceptanceCriteria: partial.acceptanceCriteria || [],
      dependencies: partial.dependencies || { requires: [], blocks: [] },
      phase,
      priority,
    };
  }

  private parseList(str: string): string[] {
    return str
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0);
  }
}

// --- Factory Function ---

export function createPrdParser(): PrdParser {
  return new PrdParser();
}
