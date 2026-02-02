// ============================================
// MAGS — Progress Tools
// MCP tool handlers for progress tracking
// ============================================

import { z } from "zod";
import type { ProgressManager } from "../services/progress-manager.js";
import type { MemoryStore } from "../services/memory-store.js";

export function registerProgressTools(
  server: any,
  progressManager: ProgressManager,
  memoryStore?: MemoryStore
) {
  // --- mags_init_progress ---
  server.tool(
    "mags_init_progress",
    "Initialize progress tracking for a project with modules, items, dependencies and priorities. Use this to set up all modules at once.",
    {
      project: z.string().describe("Project name"),
      phase: z.number().optional().default(1).describe("Current phase number"),
      force: z.boolean().optional().default(false).describe("Force re-initialization if progress already exists"),
      modules: z
        .array(
          z.object({
            name: z.string().describe("Module name"),
            status: z
              .enum(["not_started", "in_progress", "completed", "blocked"])
              .optional()
              .default("not_started")
              .describe("Module status"),
            phase: z.number().optional().default(1).describe("Phase number"),
            priority: z.number().optional().default(1).describe("Priority (lower = higher)"),
            dependsOn: z
              .array(z.string())
              .optional()
              .default([])
              .describe("Module dependencies"),
            category: z
              .enum(["feature", "tech-debt", "migration"])
              .nullable()
              .optional()
              .describe("Module category for filtering"),
            items: z
              .array(
                z.object({
                  name: z.string().describe("Item name"),
                  status: z
                    .enum(["not_started", "in_progress", "completed", "blocked"])
                    .optional()
                    .default("not_started")
                    .describe("Item status"),
                })
              )
              .optional()
              .default([])
              .describe("Items within the module"),
          })
        )
        .describe("Modules to track"),
    },
    async ({
      project,
      phase,
      modules,
      force,
    }: {
      project: string;
      phase: number;
      force: boolean;
      modules: Array<{
        name: string;
        status?: "not_started" | "in_progress" | "completed" | "blocked";
        phase?: number;
        priority?: number;
        dependsOn?: string[];
        category?: "feature" | "tech-debt" | "migration" | null;
        items?: Array<{
          name: string;
          status?: "not_started" | "in_progress" | "completed" | "blocked";
        }>;
      }>;
    }) => {
      // Re-init guard
      const existing = progressManager.getProgress();
      if (existing && !force) {
        const proj = "project" in existing ? (existing as any).project : "unknown";
        return {
          content: [
            {
              type: "text" as const,
              text: `Progress already initialized for project "${proj}". Use force: true to re-initialize.`,
            },
          ],
          isError: true,
        };
      }

      const mapped = modules.map((m) => ({
        name: m.name,
        status: m.status ?? ("not_started" as const),
        phase: m.phase ?? phase,
        priority: m.priority ?? 1,
        dependsOn: m.dependsOn ?? [],
        category: m.category ?? undefined,
        items: (m.items ?? []).map((i) => ({
          name: i.name,
          status: i.status ?? ("not_started" as const),
        })),
      }));

      const progress = progressManager.initialize(project, mapped);

      const totalItems = progress.modules.reduce(
        (sum, mod) => sum + mod.items.length,
        0
      );

      const warnings = "warnings" in progress ? (progress as any).warnings as string[] : undefined;

      const result: Record<string, unknown> = {
        initialized: true,
        project,
        phase,
        modules: progress.modules.length,
        totalItems,
      };

      if (warnings && warnings.length > 0) {
        result.warnings = warnings;
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result),
          },
        ],
      };
    }
  );

  // --- mags_get_progress ---
  server.tool(
    "mags_get_progress",
    "Get project progress. Optionally filter by module name.",
    {
      module: z.string().nullable().optional().describe("Module name to filter"),
      category: z.enum(["feature", "tech-debt", "migration"]).nullable().optional().describe("Filter by module category"),
    },
    async ({ module, category }: { module?: string | null; category?: string | null }) => {
      let progress = progressManager.getProgress(module ?? undefined);

      // Filter by category if specified
      if (progress && category && "modules" in progress) {
        const filtered = {
          ...progress,
          modules: progress.modules.filter(
            (m) => (m as any).category === category
          ),
        };
        progress = filtered;
      }

      if (!progress) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No progress tracked yet. Use /mags-init to initialize project tracking.",
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(progress, null, 2),
          },
        ],
      };
    }
  );

  // --- mags_update_progress ---
  server.tool(
    "mags_update_progress",
    "Update progress for a module or specific item within a module",
    {
      module: z.string().describe("Module name"),
      item: z.string().nullable().optional().describe("Item name within the module"),
      status: z.enum(["not_started", "in_progress", "completed", "blocked"]).describe("New status"),
      notes: z.string().nullable().optional().describe("Optional notes"),
    },
    async ({
      module,
      item,
      status,
      notes,
    }: {
      module: string;
      item?: string | null;
      status: "not_started" | "in_progress" | "completed" | "blocked";
      notes?: string | null;
    }) => {
      // BUG 1: Better error for item not found
      if (item) {
        const itemNames = progressManager.getModuleItemNames(module);
        if (itemNames === null) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Module "${module}" not found in progress tracker.`,
              },
            ],
            isError: true,
          };
        }
        const found = itemNames.find(
          (n) => n.toLowerCase() === item.toLowerCase()
        );
        if (!found) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Item "${item}" not found in module "${module}". Available items: ${itemNames.length > 0 ? itemNames.join(", ") : "(none)"}`,
              },
            ],
            isError: true,
          };
        }
      }

      const updated = progressManager.updateProgress(
        module,
        item ?? undefined,
        status,
        notes ?? undefined
      );

      if (!updated) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Module "${module}" not found in progress tracker.`,
            },
          ],
          isError: true,
        };
      }

      // Auto-save to memory when module is completed
      if (memoryStore && status === "completed" && !item) {
        try {
          await memoryStore.remember(
            `module_completed_${module}`,
            `Module "${module}" completed`,
            "context",
            ["auto-progress", module],
          );
        } catch (err) {
          console.error(`MAGS: Failed to auto-save module completion for "${module}":`, err);
        }
      }

      // BUG 3: Dependency warning on update
      const result: Record<string, unknown> = {
        updated: true,
        module,
        item,
        status,
      };

      if (status === "in_progress" || status === "completed") {
        const unmetDeps = progressManager.getUnmetDependencies(module);
        if (unmetDeps.length > 0) {
          result.warning = `Module "${module}" has unmet dependencies: ${unmetDeps.join(", ")}`;
        }
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result),
          },
        ],
      };
    }
  );

  // --- mags_get_next ---
  server.tool(
    "mags_get_next",
    "Get next actionable items based on module dependencies and priorities",
    {},
    async () => {
      const next = progressManager.getNext();

      if (next.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No actionable items. All modules are either completed or blocked.",
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ actionable: next, total: next.length }, null, 2),
          },
        ],
      };
    }
  );
}
