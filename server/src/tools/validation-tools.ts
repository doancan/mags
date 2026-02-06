// ============================================
// MAGS — Validation Tools
// MCP tool handlers for document validation
// ============================================

import { z } from "zod";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DocIndexer } from "../services/doc-indexer.js";
import type { MemoryStore } from "../services/memory-store.js";
import type { ProgressManager } from "../services/progress-manager.js";
import type { StackDetector } from "../services/stack-detector.js";
import { ConsistencyChecker } from "../services/consistency-checker.js";
import type { ValidationIssue, ValidationResult } from "../types/index.js";

export function registerValidationTools(
  server: McpServer,
  docIndexer: DocIndexer,
  memoryStore: MemoryStore,
  progressManager: ProgressManager,
  stackDetector: StackDetector,
  projectRoot: string
) {
  // --- mags_validate_docs ---
  server.tool(
    "mags_validate_docs",
    "Validate document consistency: check frontmatter, cross-references, empty sections, and structural issues",
    { deep: z.boolean().optional().default(false) },
    async ({ deep }: { deep: boolean }) => {
      // Re-index before validation to ensure fresh data (fixes stale index after Edit tool changes)
      docIndexer.reindex();
      const docs = docIndexer.listDocs();
      const issues: ValidationIssue[] = [];

      for (const doc of docs) {
        // Check frontmatter
        if (!doc.metadata.title) {
          issues.push({
            type: "missing_frontmatter",
            doc: doc.name,
            detail: "Missing 'title' in frontmatter",
            severity: "warning",
          });
        }

        if (!doc.metadata.status) {
          issues.push({
            type: "missing_frontmatter",
            doc: doc.name,
            detail: "Missing 'status' in frontmatter",
            severity: "info",
          });
        }

        if (!doc.metadata.last_updated && !doc.metadata.lastUpdated) {
          issues.push({
            type: "missing_frontmatter",
            doc: doc.name,
            detail: "Missing 'last_updated' in frontmatter",
            severity: "info",
          });
        }

        // Check for empty sections
        const content = docIndexer.getDocContent(doc.name);
        if (content) {
          const emptySections = findEmptySections(content);
          for (const section of emptySections) {
            issues.push({
              type: "empty_section",
              doc: doc.name,
              detail: `Empty section: "${section}"`,
              severity: "warning",
            });
          }

          // Check for structural placeholders (context-aware)
          const placeholderMatches = detectPlaceholders(content);
          if (placeholderMatches.length > 0) {
            const examples = placeholderMatches
              .slice(0, 3)
              .map((p) => `L${p.line}: ${p.text.slice(0, 40)}${p.text.length > 40 ? "..." : ""}`)
              .join("; ");
            issues.push({
              type: "placeholder",
              doc: doc.name,
              detail: `Found ${placeholderMatches.length} placeholder(s): ${examples}`,
              severity: "warning",
            });
          }
        }

        // Check word count (too short docs might be incomplete)
        if (doc.wordCount < 50 && doc.name !== "index") {
          issues.push({
            type: "too_short",
            doc: doc.name,
            detail: `Document has only ${doc.wordCount} words — may be incomplete`,
            severity: "info",
          });
        }
      }

      // Cross-reference checks
      for (const doc of docs) {
        const content = docIndexer.getDocContent(doc.name);
        if (!content) continue;

        // Check markdown links to other docs
        const linkRegex = /\[.*?\]\(\.\/(.+?\.md)\)/g;
        let match: RegExpExecArray | null;
        while ((match = linkRegex.exec(content)) !== null) {
          const linkedPath = match[1];
          const fullPath = join(dirname(doc.path), linkedPath);

          // Always verify file exists on filesystem (index may be stale)
          if (!existsSync(fullPath)) {
            issues.push({
              type: "broken_link",
              doc: doc.name,
              detail: `Broken link to "${linkedPath}"`,
              severity: "error",
            });
          }
        }
      }

      // Deep validation
      if (deep) {
        const checker = new ConsistencyChecker(
          docIndexer,
          memoryStore,
          progressManager,
          stackDetector,
          projectRoot
        );
        const deepIssues = await checker.runDeepValidation();
        issues.push(...deepIssues);
      }

      // Calculate score (0-100), weighted per document
      const errorCount = issues.filter((i) => i.severity === "error").length;
      const warningCount = issues.filter(
        (i) => i.severity === "warning"
      ).length;
      const infoCount = issues.filter((i) => i.severity === "info").length;

      const docCount = Math.max(docs.length, 1);
      const penalty =
        (errorCount * 15 + warningCount * 2 + infoCount * 0.5) / docCount;
      const rawScore = Math.max(0, Math.round(100 - penalty));
      // Cap at 99 when any issues exist — a perfect 100 means zero issues
      const score = rawScore === 100 && (errorCount + warningCount + infoCount) > 0
        ? 99
        : rawScore;

      const result: ValidationResult = {
        issues,
        score,
        checkedAt: new Date().toISOString(),
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                ...result,
                summary: {
                  errors: errorCount,
                  warnings: warningCount,
                  info: infoCount,
                  docsChecked: docs.length,
                  deepValidation: deep,
                },
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

function findEmptySections(content: string): string[] {
  const lines = content.split("\n");
  const emptySections: string[] = [];
  let inCodeFence = false;

  for (let i = 0; i < lines.length; i++) {
    // Toggle code fence state
    if (lines[i].trimStart().startsWith("```")) {
      inCodeFence = !inCodeFence;
      continue;
    }

    // Skip heading detection inside code fences
    if (inCodeFence) continue;

    const headingMatch = lines[i].match(/^(#{1,3})\s+(.+)/);
    if (!headingMatch) continue;

    const level = headingMatch[1].length;
    const sectionName = headingMatch[2].trim();

    // Check if next non-empty, non-decorative line is content or a sub-heading
    let hasContent = false;
    let hasSubHeading = false;
    let lookaheadInFence = false;
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j].trim();

      // Track code fences in lookahead
      if (line.startsWith("```")) {
        lookaheadInFence = !lookaheadInFence;
        hasContent = true;
        break;
      }

      if (lookaheadInFence) continue;

      if (line === "" || line === "---") continue;

      const subMatch = line.match(/^(#{1,3})\s+/);
      if (subMatch) {
        const subLevel = subMatch[1].length;
        // Same or higher level heading = section ended without content
        // Sub-heading (deeper level) = this is a container heading, not empty
        if (subLevel > level) {
          hasSubHeading = true;
        }
        break;
      }
      hasContent = true;
      break;
    }

    // Only report as empty if no content AND no sub-headings
    if (!hasContent && !hasSubHeading) {
      emptySections.push(sectionName);
    }
  }

  return emptySections;
}

/**
 * Placeholder match result
 */
export interface PlaceholderMatch {
  line: number;
  text: string;
  type: "heading" | "checklist" | "blockquote" | "standalone" | "comment";
}

/**
 * Context-aware placeholder detection.
 * Only detects structural placeholders, not contextual mentions.
 *
 * Detects:
 * - TODO/TBD/FIXME in headings: "## TODO: Complete this"
 * - TODO/TBD in checklists: "- [ ] TODO: implement"
 * - PLACEHOLDER in blockquotes: "> PLACEHOLDER"
 * - Standalone markers: "TODO:" on its own line
 * - HTML comments: "<!-- TODO -->"
 *
 * Does NOT detect:
 * - Contextual mentions: "placeholder for Phase 2"
 * - Code examples: "// TODO pattern example"
 * - Inside code fences
 */
export function detectPlaceholders(content: string): PlaceholderMatch[] {
  const placeholders: PlaceholderMatch[] = [];
  const lines = content.split("\n");
  let inCodeFence = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Track code fences - skip detection inside them
    if (trimmed.startsWith("```")) {
      inCodeFence = !inCodeFence;
      continue;
    }
    if (inCodeFence) continue;

    // 1. Heading with placeholder: "## TODO: Complete this" or "## TBD"
    const headingMatch = trimmed.match(/^(#{1,6})\s+(TODO|TBD|FIXME|PLACEHOLDER|XXX)[\s:]/i);
    if (headingMatch) {
      placeholders.push({
        line: i + 1,
        text: trimmed,
        type: "heading",
      });
      continue;
    }

    // 2. Checklist item with placeholder: "- [ ] TODO" or "- [x] TBD: done"
    const checklistMatch = trimmed.match(/^-\s*\[[\sx]\]\s*(TODO|TBD|FIXME|PLACEHOLDER|XXX)[\s:]/i);
    if (checklistMatch) {
      placeholders.push({
        line: i + 1,
        text: trimmed,
        type: "checklist",
      });
      continue;
    }

    // 3. Blockquote with placeholder: "> TODO" or "> PLACEHOLDER"
    const blockquoteMatch = trimmed.match(/^>\s*(TODO|TBD|FIXME|PLACEHOLDER|XXX)[\s:]/i);
    if (blockquoteMatch) {
      placeholders.push({
        line: i + 1,
        text: trimmed,
        type: "blockquote",
      });
      continue;
    }

    // 4. Standalone marker (entire line or line starts with marker)
    // Matches: "TODO:", "TODO: fix this", "TBD", but NOT "This is a TODO task"
    const standaloneMatch = trimmed.match(/^(TODO|TBD|FIXME|PLACEHOLDER|XXX)([\s:]|$)/i);
    if (standaloneMatch) {
      placeholders.push({
        line: i + 1,
        text: trimmed,
        type: "standalone",
      });
      continue;
    }

    // 5. HTML comment placeholder: "<!-- TODO -->" or "<!-- FIXME: something -->"
    const commentMatch = trimmed.match(/<!--\s*(TODO|TBD|FIXME|PLACEHOLDER|XXX)[\s:]/i);
    if (commentMatch) {
      placeholders.push({
        line: i + 1,
        text: trimmed,
        type: "comment",
      });
      continue;
    }
  }

  return placeholders;
}
