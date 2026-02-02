// ============================================
// MAGS — Memory Tools
// MCP tool handlers for memory operations
// ============================================

import { z } from "zod";
import type { MemoryStore } from "../services/memory-store.js";
import { DEFAULT_QUERY_LIMIT } from "../config/defaults.js";

export function registerMemoryTools(server: any, memoryStore: MemoryStore) {
  // --- mags_remember ---
  server.tool(
    "mags_remember",
    "Store a memory note (key-value pair with optional category and tags). Use for decisions, conventions, quick notes, or context that should persist across sessions.",
    {
      key: z.string().min(1, "Key cannot be empty").describe("Unique key for the memory (e.g., 'auth_strategy', 'db_choice')"),
      value: z.string().min(1, "Value cannot be empty").describe("Content to remember"),
      category: z.string().nullable().optional().describe("Category for organizing memories (e.g., decisions, conventions, notes, context, bugs, or any custom category)"),
      tags: z.array(z.string()).nullable().optional().describe("Tags for filtering"),
      metadata: z.record(z.unknown()).nullable().optional().describe("Optional structured metadata (e.g., { alternatives: ['a','b'], reason: '...' })"),
    },
    async ({
      key,
      value,
      category,
      tags,
      metadata,
    }: {
      key: string;
      value: string;
      category?: string | null;
      tags?: string[] | null;
      metadata?: Record<string, unknown> | null;
    }) => {
      const result = await memoryStore.remember(key, value, category ?? undefined, tags ?? undefined, metadata ?? undefined);
      const response: Record<string, unknown> = {
        stored: true,
        id: result.entry.id,
        key: result.entry.key,
        category: result.entry.category,
        isUpdate: result.isUpdate,
        totalEntries: result.totalEntries,
        capacityPercent: result.capacityPercent,
      };
      if (result.warning) response.warning = result.warning;
      if (result.pruned) response.pruned = result.pruned;
      if (result.similarKeys && result.similarKeys.length > 0) response.similarKeys = result.similarKeys;
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(response),
          },
        ],
      };
    }
  );

  // --- mags_recall ---
  server.tool(
    "mags_recall",
    "Search and retrieve stored memories. Uses semantic search (if configured) or keyword matching.",
    {
      query: z.string().optional().default("").describe("Search query (natural language or keywords). Leave empty to list all entries in a category."),
      category: z.string().nullable().optional().describe("Filter by category"),
      limit: z.number().nullable().optional().describe("Max results (default 10)"),
    },
    async ({
      query,
      category,
      limit,
    }: {
      query?: string;
      category?: string | null;
      limit?: number | null;
    }) => {
      const results = await memoryStore.recall(query ?? "", category ?? undefined, limit ?? DEFAULT_QUERY_LIMIT);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                query,
                results: results.map((r) => ({
                  key: r.key,
                  value: r.value,
                  category: r.category,
                  tags: r.tags,
                  metadata: r.metadata,
                  score: Math.round(r.score * 100) / 100,
                })),
                total: results.length,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // --- mags_forget ---
  server.tool(
    "mags_forget",
    "Delete a stored memory by key",
    {
      key: z.string().describe("Key of the memory to delete"),
    },
    async ({ key }: { key: string }) => {
      const deleted = memoryStore.forget(key);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ deleted, key }),
          },
        ],
      };
    }
  );

  // --- mags_promote_memory ---
  server.tool(
    "mags_promote_memory",
    "Suggest promoting a frequently accessed or high-value memory to CLAUDE.md or project docs for permanent reference.",
    {
      key: z.string().describe("Memory key to evaluate for promotion"),
      target: z.enum(["claude_md", "doc"]).describe("Promotion target: 'claude_md' for CLAUDE.md, 'doc' for project docs"),
    },
    async ({ key, target }: { key: string; target: "claude_md" | "doc" }) => {
      const entry = memoryStore.get(key);
      if (!entry) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ error: `Memory "${key}" not found.` }),
            },
          ],
          isError: true,
        };
      }

      // Calculate age and provide promotion suggestion
      const ageInDays = Math.round(
        (Date.now() - new Date(entry.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      );

      const suggestion: Record<string, unknown> = {
        key: entry.key,
        value: entry.value,
        category: entry.category,
        tags: entry.tags,
        ageInDays,
        target,
      };

      if (target === "claude_md") {
        suggestion.recommendation = `Add to CLAUDE.md under a relevant section (e.g., "## Conventions" or "## Decisions")`;
        suggestion.suggestedContent = entry.category === "conventions"
          ? `- ${entry.value}`
          : `- **${entry.key}**: ${entry.value}`;
      } else {
        suggestion.recommendation = `Add to project docs under the appropriate document`;
        suggestion.suggestedContent = `### ${entry.key}\n${entry.value}`;
        if (entry.metadata) {
          suggestion.suggestedContent += `\n\nMetadata: ${JSON.stringify(entry.metadata)}`;
        }
      }

      suggestion.action = "Review the suggestion above and manually add it to the target if appropriate. This tool does not auto-write.";

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(suggestion, null, 2),
          },
        ],
      };
    }
  );
}
