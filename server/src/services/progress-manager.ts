// ============================================
// MAGS — Progress Manager
// Tracks module-level project progress
// ============================================

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";
import type {
  ProjectProgress,
  ModuleProgress,
  ModuleStatus,
} from "../types/index.js";

export class ProgressManager {
  private progress: ProjectProgress | null = null;
  private filePath: string;

  constructor(magsDir: string) {
    this.filePath = join(magsDir, "progress.yaml");
  }

  /**
   * Load progress from disk
   */
  load(): ProjectProgress | null {
    if (!existsSync(this.filePath)) {
      return null;
    }

    try {
      const raw = readFileSync(this.filePath, "utf-8");
      this.progress = YAML.parse(raw) as ProjectProgress;
      this.recalculateCompletions();
      return this.progress;
    } catch (err) {
      console.warn("[ProgressManager] Failed to load progress file:", err instanceof Error ? err.message : err);
      return null;
    }
  }

  /**
   * Initialize progress for a new project
   */
  initialize(project: string, modules: Omit<ModuleProgress, "completionPercent">[]): ProjectProgress & { warnings?: string[] } {
    this.progress = {
      project,
      phase: 1,
      startedAt: new Date().toISOString().split("T")[0],
      modules: modules.map((m) => ({
        ...m,
        completionPercent: 0,
      })),
    };
    for (const m of this.progress.modules) {
      if (m.items.length > 0) {
        this.recalculateModuleStatus(m);
      }
    }
    this.recalculateCompletions();

    // Validate dependencies
    const warnings = this.validateDependencies();

    this.save();
    if (warnings.length > 0) {
      return { ...this.progress, warnings };
    }
    return this.progress;
  }

  /**
   * Get current progress
   */
  getProgress(moduleName?: string): ProjectProgress | ModuleProgress | null {
    if (!this.progress) this.load();
    if (!this.progress) return null;

    if (moduleName) {
      return (
        this.progress.modules.find(
          (m) => m.name.toLowerCase() === moduleName.toLowerCase()
        ) ?? null
      );
    }

    return this.progress;
  }

  /**
   * Update module or item status
   */
  updateProgress(
    moduleName: string,
    itemName?: string,
    status?: ModuleStatus,
    notes?: string
  ): boolean {
    if (!this.progress) this.load();
    if (!this.progress) return false;

    const mod = this.progress.modules.find(
      (m) => m.name.toLowerCase() === moduleName.toLowerCase()
    );
    if (!mod) return false;

    if (itemName) {
      const item = mod.items.find(
        (i) => i.name.toLowerCase() === itemName.toLowerCase()
      );
      if (!item) {
        return false;
      }
      if (status) item.status = status;
      if (notes) item.notes = notes;
    }

    // Update module status based on items
    if (status && !itemName) {
      mod.status = status;
    } else {
      this.recalculateModuleStatus(mod);
    }

    this.recalculateCompletions();
    this.save();
    return true;
  }

  /**
   * Get next actionable items based on dependencies
   */
  getNext(): Array<{
    module: string;
    item: string;
    priority: number;
    dependsOn: string[];
  }> {
    if (!this.progress) this.load();
    if (!this.progress) return [];

    const completedModules = new Set(
      this.progress.modules
        .filter((m) => m.status === "completed")
        .map((m) => m.name.toLowerCase())
    );

    const actionable: Array<{
      module: string;
      item: string;
      priority: number;
      dependsOn: string[];
    }> = [];

    for (const mod of this.progress.modules) {
      if (mod.status === "completed") continue;

      // Check dependencies (case-insensitive)
      const moduleDeps = mod.dependsOn ?? [];
      const unmetDeps = moduleDeps.filter(
        (dep) => !completedModules.has(dep.toLowerCase())
      );
      if (unmetDeps.length > 0) continue;

      // Find pending items in this module
      const pendingItems = mod.items.filter(
        (i) => i.status === "not_started" || i.status === "in_progress"
      );

      if (mod.items.length === 0) {
        // Module with no sub-items is itself actionable
        actionable.push({
          module: mod.name,
          item: "(module)",
          priority: mod.priority,
          dependsOn: moduleDeps,
        });
      } else {
        for (const item of pendingItems) {
          actionable.push({
            module: mod.name,
            item: item.name,
            priority: mod.priority,
            dependsOn: moduleDeps,
          });
        }
      }
    }

    return actionable.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Add a new module to progress
   */
  addModule(module: Omit<ModuleProgress, "completionPercent">): void {
    if (!this.progress) return;

    this.progress.modules.push({
      ...module,
      completionPercent: 0,
    });

    this.save();
  }

  /**
   * Check unmet dependencies for a module
   */
  getUnmetDependencies(moduleName: string): string[] {
    if (!this.progress) this.load();
    if (!this.progress) return [];

    const mod = this.progress.modules.find(
      (m) => m.name.toLowerCase() === moduleName.toLowerCase()
    );
    if (!mod) return [];

    const completedModules = new Set(
      this.progress.modules
        .filter((m) => m.status === "completed")
        .map((m) => m.name.toLowerCase())
    );

    return (mod.dependsOn ?? []).filter((dep) => !completedModules.has(dep.toLowerCase()));
  }

  /**
   * Get item names for a module
   */
  getModuleItemNames(moduleName: string): string[] | null {
    if (!this.progress) this.load();
    if (!this.progress) return null;

    const mod = this.progress.modules.find(
      (m) => m.name.toLowerCase() === moduleName.toLowerCase()
    );
    if (!mod) return null;

    return mod.items.map((i) => i.name);
  }

  // --- Private ---

  private recalculateModuleStatus(mod: ModuleProgress): void {
    const total = mod.items.length;
    if (total === 0) return;

    const completed = mod.items.filter(
      (i) => i.status === "completed"
    ).length;
    const inProgress = mod.items.filter(
      (i) => i.status === "in_progress"
    ).length;
    const blocked = mod.items.filter((i) => i.status === "blocked").length;

    if (completed === total) {
      mod.status = "completed";
    } else if (blocked > 0 && blocked + completed === total) {
      mod.status = "blocked";
    } else if (inProgress > 0 || completed > 0) {
      mod.status = "in_progress";
    } else {
      mod.status = "not_started";
    }
  }

  private recalculateCompletions(): void {
    if (!this.progress) return;

    for (const mod of this.progress.modules) {
      const total = mod.items.length;
      if (total === 0) {
        mod.completionPercent = mod.status === "completed" ? 100 : 0;
        continue;
      }
      const completed = mod.items.filter(
        (i) => i.status === "completed"
      ).length;
      mod.completionPercent = Math.round((completed / total) * 100);
    }
  }

  private validateDependencies(): string[] {
    if (!this.progress) return [];

    const warnings: string[] = [];
    const moduleNames = new Set(this.progress.modules.map((m) => m.name));

    // Orphan dependency check
    for (const mod of this.progress.modules) {
      const deps = mod.dependsOn ?? [];
      for (const dep of deps) {
        if (!moduleNames.has(dep)) {
          warnings.push(`Module "${mod.name}" depends on "${dep}" which does not exist`);
        }
      }
    }

    // Cycle detection via DFS (global visited to avoid duplicate warnings)
    const visited = new Set<string>();
    const inStack = new Set<string>();
    const adjMap = new Map<string, string[]>();
    for (const mod of this.progress.modules) {
      adjMap.set(mod.name, mod.dependsOn ?? []);
    }

    const dfs = (node: string): boolean => {
      if (inStack.has(node)) return true; // cycle found
      if (visited.has(node)) return false;

      visited.add(node);
      inStack.add(node);

      for (const dep of adjMap.get(node) ?? []) {
        if (moduleNames.has(dep) && dfs(dep)) {
          return true;
        }
      }

      inStack.delete(node);
      return false;
    };

    for (const mod of this.progress.modules) {
      if (visited.has(mod.name)) continue;
      if (dfs(mod.name)) {
        warnings.push(`Circular dependency detected involving module "${mod.name}"`);
      }
    }

    return warnings;
  }

  private save(): void {
    if (!this.progress) return;

    const dir = join(this.filePath, "..");
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(this.filePath, YAML.stringify(this.progress), "utf-8");
  }
}
