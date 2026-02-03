// ============================================
// MAGS — Validation Tools
// MCP tool handlers for document validation
// ============================================

import { z } from "zod";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import type { DocIndexer } from "../services/doc-indexer.js";
import type { MemoryStore } from "../services/memory-store.js";
import type { ProgressManager } from "../services/progress-manager.js";
import type { StackDetector } from "../services/stack-detector.js";
import { ConsistencyChecker } from "../services/consistency-checker.js";
import type { ValidationIssue, ValidationResult } from "../types/index.js";

export function registerValidationTools(
  server: any,
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

          // Check for TODO/FIXME/placeholder markers
          const todoMatches = content.match(
            /(?:TODO|FIXME|PLACEHOLDER|TBD|XXX)[\s:]/gi
          );
          if (todoMatches) {
            issues.push({
              type: "placeholder",
              doc: doc.name,
              detail: `Found ${todoMatches.length} placeholder(s): ${todoMatches.slice(0, 3).join(", ")}`,
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
      const docNames = new Set(docs.map((d) => d.name));
      for (const doc of docs) {
        const content = docIndexer.getDocContent(doc.name);
        if (!content) continue;

        // Check markdown links to other docs
        const linkRegex = /\[.*?\]\(\.\/(.+?\.md)\)/g;
        let match: RegExpExecArray | null;
        while ((match = linkRegex.exec(content)) !== null) {
          const linkedPath = match[1];
          const linkedFile = linkedPath.replace(".md", "").split("/").pop();

          // First check if document is indexed
          if (linkedFile && docNames.has(linkedFile)) continue;

          // Fallback: check if file exists on filesystem
          const fullPath = join(dirname(doc.path), linkedPath);
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
      const score = Math.max(0, Math.round(100 - penalty));

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
