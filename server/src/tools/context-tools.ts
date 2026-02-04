// ============================================
// MAGS — Context Tools
// MCP tool handlers for project context
// ============================================

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DocIndexer } from "../services/doc-indexer.js";
import type { ProgressManager } from "../services/progress-manager.js";
import type { SessionManager } from "../services/session-manager.js";
import type { MemoryStore } from "../services/memory-store.js";
import { MAX_MEMORY_ENTRIES } from "../config/defaults.js";
import type { MagsConfig, ModuleDefinition } from "../types/index.js";
import { DEFAULT_MODULES } from "../config/defaults.js";

export function registerContextTools(
  server: McpServer,
  docIndexer: DocIndexer,
  progressManager: ProgressManager,
  sessionManager: SessionManager,
  memoryStore: MemoryStore,
  config: MagsConfig
) {
  // --- mags_project_summary ---
  server.tool(
    "mags_project_summary",
    "Get a comprehensive project summary for session context. Includes: project overview, tech stack, current phase, last session, and next steps. Call this at the start of every session.",
    {},
    async () => {
      const docs = docIndexer.listDocs();
      const progress = progressManager.getProgress();
      const lastSession = sessionManager.getLatest();

      let memoryCapacity = { total: MAX_MEMORY_ENTRIES, used: 0, available: MAX_MEMORY_ENTRIES, usagePercent: 0 };
      let recentDecisions: Awaited<ReturnType<typeof memoryStore.recall>> = [];
      try {
        memoryCapacity = memoryStore.getCapacity();
        recentDecisions = await memoryStore.recall("", "decisions", 5);
      } catch (err) {
        console.error("MAGS: Failed to load memory context:", err);
      }

      const isFirstUse = memoryCapacity.used === 0 && !lastSession;

      // Build summary
      const sections: string[] = [];

      // Project info from docs
      const visionDoc = docIndexer.getDocContent("vision");

      if (visionDoc) {
        const firstParagraph = visionDoc
          .split("\n\n")
          .find((p) => p.trim().length > 20 && !p.startsWith("#"));
        if (firstParagraph) {
          sections.push(`## Project\n${firstParagraph.trim().slice(0, 300)}`);
        }
      }

      // Document stats
      sections.push(
        `## Documents\nTotal: ${docs.length} | ` +
          `Locked: ${docs.filter((d) => d.status === "LOCKED").length} | ` +
          `Draft: ${docs.filter((d) => d.status === "DRAFT").length}`
      );

      // Progress
      if (progress && "modules" in progress) {
        const completed = progress.modules.filter(
          (m) => m.status === "completed"
        ).length;
        const total = progress.modules.length;
        sections.push(
          `## Progress\nPhase: ${progress.phase} | Modules: ${completed}/${total} completed`
        );

        const inProgress = progress.modules.filter(
          (m) => m.status === "in_progress"
        );
        if (inProgress.length > 0) {
          sections.push(
            `Active: ${inProgress.map((m) => `${m.name} (${m.completionPercent}%)`).join(", ")}`
          );
        }
      }

      // Last session
      if (lastSession) {
        sections.push(
          `## Last Session (${lastSession.date})\n${lastSession.summary}`
        );
        if (lastSession.nextSteps.length > 0) {
          sections.push(
            `Next steps:\n${lastSession.nextSteps.map((s) => `- ${s}`).join("\n")}`
          );
        }
      }

      // Recent decisions
      if (recentDecisions.length > 0) {
        sections.push(
          `## Recent Decisions\n${recentDecisions.map((d) => `- ${d.key}: ${d.value}`).join("\n")}`
        );
      }

      // Memory stats
      sections.push(
        `## Memory\nEntries: ${memoryCapacity.used}/${memoryCapacity.total} (${memoryCapacity.usagePercent}%)`
      );

      // First use or returning user guidance
      if (isFirstUse) {
        sections.push(
          `## Getting Started\nThis is your first session with MAGS memory system.\n` +
          `- Use \`mags_remember\` to store decisions, conventions, and context\n` +
          `- Use \`mags_recall\` to search stored memories\n` +
          `- Memories persist across sessions and help maintain project continuity\n` +
          `- Run \`/mags-session save\` at the end of each session to auto-save decisions`
        );
      } else if (lastSession) {
        const decisionCount = recentDecisions.length;
        sections.push(
          `## Welcome Back\nLast session: ${lastSession.date} | Stored decisions: ${decisionCount} | Memory entries: ${memoryCapacity.used}`
        );
      }

      return {
        content: [
          {
            type: "text" as const,
            text: sections.join("\n\n"),
          },
        ],
      };
    }
  );

  // --- mags_module_context ---
  server.tool(
    "mags_module_context",
    "Get all relevant context for a specific module: PRD section, data model tables, API endpoints, project structure, and progress. Use this before working on a module.",
    {
      module: z.string().describe("Module name (e.g., 'auth', 'crm', 'pms', 'feedback')"),
    },
    async ({ module }: { module: string }) => {
      const sections: string[] = [];
      const moduleLower = module.toLowerCase();

      // Build module aliases from config or defaults
      const moduleDefinitions: ModuleDefinition[] = config.modules ?? DEFAULT_MODULES;
      const moduleAliases: Record<string, string[]> = {};
      for (const mod of moduleDefinitions) {
        moduleAliases[mod.name] = mod.aliases;
      }

      // PRD section
      const prdContent = docIndexer.getDocContent("prd");
      if (prdContent) {
        const moduleSection = extractModuleSection(prdContent, moduleLower, moduleAliases);
        if (moduleSection) {
          sections.push(`## PRD\n${moduleSection}`);
        }
      }

      // Data model
      const dataModel = docIndexer.getDocContent("data-model");
      if (dataModel) {
        const tables = extractModuleSection(dataModel, moduleLower, moduleAliases);
        if (tables) {
          sections.push(`## Data Model\n${tables}`);
        }
      }

      // API design
      const apiDesign = docIndexer.getDocContent("api-design");
      if (apiDesign) {
        const endpoints = extractModuleSection(apiDesign, moduleLower, moduleAliases);
        if (endpoints) {
          sections.push(`## API Endpoints\n${endpoints}`);
        }
      }

      // Project structure
      const structure = docIndexer.getDocContent("project-structure");
      if (structure) {
        const moduleStructure = extractModuleSection(structure, moduleLower, moduleAliases);
        if (moduleStructure) {
          sections.push(`## Project Structure\n${moduleStructure}`);
        }
      }

      // Progress
      const progress = progressManager.getProgress(module);
      if (progress) {
        sections.push(`## Progress\n${JSON.stringify(progress, null, 2)}`);
      }

      // Related memories
      let memories: Awaited<ReturnType<typeof memoryStore.recall>> = [];
      try {
        memories = await memoryStore.recall(module, undefined, 5);
      } catch (err) {
        console.warn(`[ContextTools] Failed to recall memories for module ${module}:`, err instanceof Error ? err.message : err);
      }
      if (memories.length > 0) {
        sections.push(
          `## Related Notes\n${memories.map((m) => `- **${m.key}**: ${m.value}`).join("\n")}`
        );
      }

      if (sections.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No context found for module "${module}". Available documents: ${docIndexer.listDocs().map((d) => d.name).join(", ")}`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `# Module Context: ${module}\n\n${sections.join("\n\n---\n\n")}`,
          },
        ],
      };
    }
  );
}

/**
 * Extract relevant section from a document based on module name
 */
function extractModuleSection(
  content: string,
  module: string,
  moduleAliases: Record<string, string[]>
): string | null {
  const lines = content.split("\n");
  const aliases = moduleAliases[module] ?? [module];

  // Find sections that match
  const matchingSections: string[] = [];
  let currentSection = "";
  let isRelevant = false;

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);

    if (headingMatch) {
      // Save previous section if relevant
      if (isRelevant && currentSection.trim()) {
        matchingSections.push(currentSection.trim());
      }

      const title = headingMatch[2].toLowerCase();

      const titleClean = title.replace(/[^a-z]/g, "");
      isRelevant = aliases.some(
        (alias) =>
          title.includes(alias) ||
          (titleClean.length > 2 && titleClean.includes(alias))
      );
      currentSection = line + "\n";
    } else {
      currentSection += line + "\n";
    }
  }

  // Don't forget the last section
  if (isRelevant && currentSection.trim()) {
    matchingSections.push(currentSection.trim());
  }

  return matchingSections.length > 0
    ? matchingSections.join("\n\n")
    : null;
}
