// ============================================
// MAGS — Session Tools
// MCP tool handlers for session management
// ============================================

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SessionManager } from "../services/session-manager.js";
import type { MemoryStore } from "../services/memory-store.js";
import { DEFAULT_QUERY_LIMIT } from "../config/defaults.js";

export function registerSessionTools(
  server: McpServer,
  sessionManager: SessionManager,
  memoryStore?: MemoryStore
) {
  // --- mags_save_session ---
  server.tool(
    "mags_save_session",
    "Save a session summary with decisions, completed items, and next steps. Call at end of each session.",
    {
      summary: z.string().describe("Brief summary of what was done in this session"),
      decisions: z.array(z.string()).nullable().optional().describe("Decisions made during session"),
      completed: z.array(z.string()).nullable().optional().describe("Items completed"),
      nextSteps: z.array(z.string()).nullable().optional().describe("Next steps for following session"),
      blockers: z.array(z.string()).nullable().optional().describe("Current blockers"),
    },
    async ({
      summary,
      decisions,
      completed,
      nextSteps,
      blockers,
    }: {
      summary: string;
      decisions?: string[] | null;
      completed?: string[] | null;
      nextSteps?: string[] | null;
      blockers?: string[] | null;
    }) => {
      const session = sessionManager.save({
        summary,
        decisions: decisions ?? [],
        completed: completed ?? [],
        nextSteps: nextSteps ?? [],
        blockers: blockers ?? [],
      });

      // Auto-save decisions to memory (using sessionId to prevent duplicates)
      const memoryUpdates: string[] = [];
      if (memoryStore && decisions && decisions.length > 0) {
        for (let i = 0; i < decisions.length; i++) {
          try {
            const key = `session_decision_${session.sessionId}_${i}`;
            await memoryStore.remember(
              key,
              decisions[i],
              "decisions",
              ["auto-session"],
            );
            memoryUpdates.push(key);
          } catch (err) {
            console.error(`MAGS: Failed to auto-save decision ${i}:`, err);
          }
        }
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              saved: true,
              sessionId: session.sessionId,
              date: session.date,
              memoryUpdates: memoryUpdates.length > 0 ? memoryUpdates : undefined,
            }),
          },
        ],
      };
    }
  );

  // --- mags_get_last_session ---
  server.tool(
    "mags_get_last_session",
    "Get the most recent session summary. Use at session start to restore context.",
    {},
    async () => {
      const session = sessionManager.getLatest();

      if (!session) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No previous sessions found.",
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(session, null, 2),
          },
        ],
      };
    }
  );

  // --- mags_list_sessions ---
  server.tool(
    "mags_list_sessions",
    "List recent session summaries",
    {
      limit: z.number().nullable().optional().describe("Number of sessions to return (default 10)"),
    },
    async ({ limit }: { limit?: number | null }) => {
      const sessions = sessionManager.listSessions(limit ?? DEFAULT_QUERY_LIMIT);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                sessions: sessions.map((s) => ({
                  id: s.sessionId,
                  date: s.date,
                  summary: s.summary.slice(0, 150),
                  decisions: s.decisions.length,
                  completed: s.completed.length,
                })),
                total: sessions.length,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
