// ============================================
// MAGS — Changelog Tools
// MCP tool handlers for changelog generation
// ============================================

import { z } from "zod";
import { execSync } from "node:child_process";
import type { ChangelogEntry } from "../types/index.js";

export function registerChangelogTools(server: any, projectRoot: string) {
  // --- mags_generate_changelog ---
  server.tool(
    "mags_generate_changelog",
    "Generate a changelog from git commit history. Parses conventional commits and groups by type.",
    {
      from: z.string().nullable().optional().describe("Start commit/tag (default: last tag or first commit)"),
      to: z.string().nullable().optional().describe("End commit (default: HEAD)"),
      format: z.enum(["keep", "conventional"]).nullable().optional().describe("Output format"),
    },
    async ({
      from,
      to,
      format,
    }: {
      from?: string | null;
      to?: string | null;
      format?: "keep" | "conventional" | null;
    }) => {
      try {
        // Get git log
        const fromRef = from || getLastTag(projectRoot) || "";
        const toRef = to || "HEAD";

        const range = fromRef ? `${fromRef}..${toRef}` : toRef;
        const log = execSync(
          `git log ${range} --pretty=format:"%H|%s|%aI" --no-merges`,
          { cwd: projectRoot, encoding: "utf-8" }
        ).trim();

        if (!log) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No commits found in the specified range.",
              },
            ],
          };
        }

        const entries: ChangelogEntry[] = log
          .split("\n")
          .map((line) => {
            const [hash, message, date] = line.split("|");
            return parseCommit(hash, message, date);
          })
          .filter((e): e is ChangelogEntry => e !== null);

        // Group by type
        const grouped: Record<string, ChangelogEntry[]> = {};
        for (const entry of entries) {
          if (!grouped[entry.type]) grouped[entry.type] = [];
          grouped[entry.type].push(entry);
        }

        // Generate output
        const outputFormat = format || "keep";
        const output =
          outputFormat === "keep"
            ? generateKeepAChangelog(grouped)
            : generateConventional(grouped);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  changelog: output,
                  stats: {
                    total: entries.length,
                    features: grouped["feat"]?.length ?? 0,
                    fixes: grouped["fix"]?.length ?? 0,
                    other:
                      entries.length -
                      (grouped["feat"]?.length ?? 0) -
                      (grouped["fix"]?.length ?? 0),
                  },
                  range: `${fromRef || "initial"}..${toRef}`,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error generating changelog: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

function getLastTag(cwd: string): string | null {
  try {
    return execSync("git describe --tags --abbrev=0 2>/dev/null", {
      cwd,
      encoding: "utf-8",
    }).trim();
  } catch {
    return null;
  }
}

function parseCommit(
  hash: string,
  message: string,
  date: string
): ChangelogEntry | null {
  // Parse conventional commit: type(scope): message
  const match = message.match(
    /^(feat|fix|refactor|docs|chore|test|perf|ci|build|style)(?:\((.+?)\))?(!)?:\s*(.+)/
  );

  if (match) {
    return {
      type: match[3] ? "breaking" : (match[1] as ChangelogEntry["type"]),
      scope: match[2],
      message: match[4],
      hash: hash.slice(0, 7),
      date: date.split("T")[0],
    };
  }

  // Non-conventional commit
  return {
    type: "chore",
    message,
    hash: hash.slice(0, 7),
    date: date.split("T")[0],
  };
}

function generateKeepAChangelog(
  grouped: Record<string, ChangelogEntry[]>
): string {
  const sections: string[] = [];
  const date = new Date().toISOString().split("T")[0];

  sections.push(`## [Unreleased] - ${date}\n`);

  const typeMap: Record<string, string> = {
    breaking: "Breaking Changes",
    feat: "Added",
    fix: "Fixed",
    refactor: "Changed",
    docs: "Documentation",
    chore: "Maintenance",
  };

  for (const [type, label] of Object.entries(typeMap)) {
    const entries = grouped[type];
    if (!entries || entries.length === 0) continue;

    sections.push(`### ${label}\n`);
    for (const entry of entries) {
      const scope = entry.scope ? `**${entry.scope}:** ` : "";
      sections.push(`- ${scope}${entry.message}`);
    }
    sections.push("");
  }

  return sections.join("\n");
}

function generateConventional(
  grouped: Record<string, ChangelogEntry[]>
): string {
  const sections: string[] = [];

  for (const [type, entries] of Object.entries(grouped)) {
    sections.push(`### ${type}\n`);
    for (const entry of entries) {
      const scope = entry.scope ? `(${entry.scope})` : "";
      sections.push(
        `- ${entry.hash} ${type}${scope}: ${entry.message}`
      );
    }
    sections.push("");
  }

  return sections.join("\n");
}
