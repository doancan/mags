// ============================================
// MAGS — Memory Tools
// MCP tool handlers for memory operations
// ============================================

import { z } from "zod";
import type { MemoryStore } from "../services/memory-store.js";

export function registerMemoryTools(server: any, memoryStore: MemoryStore) {
  // --- mags_remember ---
  server.tool(
    "mags_remember",
    "Store a memory note (key-value pair with optional category and tags). Use for decisions, conventions, quick notes, or context that should persist across sessions.",
    {
      key: z.string().min(1, "Key cannot be empty").describe("Unique key for the memory (e.g., 'auth_strategy', 'db_choice')"),
      value: z.string().min(1, "Value cannot be empty").describe("Content to remember"),
      category: z.string().nullable().optional().describe("Category: decisions, conventions, notes, context, bugs"),
      tags: z.array(z.string()).nullable().optional().describe("Tags for filtering"),
    },
    async ({
      key,
      value,
      category,
      tags,
    }: {
      key: string;
      value: string;
      category?: string | null;
      tags?: string[] | null;
    }) => {
      const entry = await memoryStore.remember(key, value, category ?? undefined, tags ?? undefined);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              stored: true,
              id: entry.id,
              key: entry.key,
              category: entry.category,
            }),
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
      const results = await memoryStore.recall(query ?? "", category ?? undefined, limit ?? 10);
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
}
