// ============================================
// MAGS — CLAUDE.md Tools
// MCP tool handlers for CLAUDE.md management
// ============================================

import { z } from "zod";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { DocIndexer } from "../services/doc-indexer.js";
import type { MagsConfig } from "../types/index.js";
import { getStackRules, getArchitectureGuidance } from "../services/claude-md-rules.js";

export function registerClaudeMdTools(
  server: any,
  docIndexer: DocIndexer,
  projectRoot: string,
  config?: MagsConfig
) {
  // --- mags_generate_claude_md ---
  server.tool(
    "mags_generate_claude_md",
    "Generate a CLAUDE.md file for the project based on existing documentation. Extracts conventions, tech stack, module structure, and rules from docs.",
    {},
    async () => {
      const docs = docIndexer.listDocs();
      const sections: string[] = [];

      // Project header
      const visionDoc = docIndexer.getDocContent("vision");
      let projectName = "Project";
      if (visionDoc) {
        const titleMatch = visionDoc.match(/^#\s+(.+)/m);
        if (titleMatch) projectName = titleMatch[1].replace(/[—\-].*/, "").trim();
      }

      sections.push(`# ${projectName} — Claude Code Rules\n`);

      // Tech stack summary
      const techDoc = docIndexer.getDocContent("tech-stack");
      if (techDoc) {
        sections.push("## Tech Stack\n");
        const techLines = techDoc
          .split("\n")
          .filter(
            (l) =>
              l.includes("**") &&
              !l.startsWith("#") &&
              l.trim().length > 5
          )
          .slice(0, 15);
        if (techLines.length > 0) {
          sections.push(techLines.join("\n"));
        }
      }

      // Module map
      const structureDoc = docIndexer.getDocContent("project-structure");
      if (structureDoc) {
        sections.push("\n## Module Map\n");
        const moduleMatch = structureDoc.match(
          /modules\/[\s\S]*?(?=\n\n|\n##)/
        );
        if (moduleMatch) {
          sections.push("```\n" + moduleMatch[0].slice(0, 500) + "\n```");
        }
      }

      // Conventions from ADRs
      const adrs = docs.filter(
        (d) =>
          d.name.startsWith("adr-") ||
          d.relativePath.includes("adr/")
      );
      if (adrs.length > 0) {
        sections.push("\n## Architectural Decisions\n");
        for (const adr of adrs) {
          const content = docIndexer.getDocContent(adr.name);
          const decisionMatch = content?.match(
            /##\s*(Karar|Decision)[\s\S]*?\n\n(.+?)(?:\n\n|$)/
          );
          sections.push(
            `- **${adr.title}**: ${decisionMatch?.[2]?.slice(0, 100) ?? adr.name}`
          );
        }
      }

      // Document reference
      sections.push("\n## Documentation\n");
      sections.push("Read relevant docs before making changes:\n");
      sections.push("```");
      sections.push(`docs/`);
      const docsByDir = new Map<string, string[]>();
      for (const doc of docs) {
        const dir = doc.relativePath.includes("/")
          ? doc.relativePath.split("/")[0]
          : ".";
        if (!docsByDir.has(dir)) docsByDir.set(dir, []);
        docsByDir.get(dir)!.push(`  ${doc.name}.md → ${doc.title}`);
      }
      for (const [dir, files] of docsByDir) {
        sections.push(`├── ${dir}/`);
        for (const file of files) {
          sections.push(`│  ${file}`);
        }
      }
      sections.push("```");

      // Rules section — stack-specific if available
      sections.push("\n## Rules\n");

      const stackRules = config?.stack ? getStackRules(config.stack) : [];
      const archGuidance = config?.architecture ? getArchitectureGuidance(config.architecture) : [];

      if (stackRules.length > 0) {
        sections.push("### Coding Standards\n");
        for (const rule of stackRules) {
          sections.push(`- ${rule}`);
        }
      }

      if (archGuidance.length > 0) {
        sections.push("\n### Architecture Guidelines\n");
        for (const guide of archGuidance) {
          sections.push(`- ${guide}`);
        }
      }

      // Always include generic rules
      sections.push("\n### General\n");
      sections.push("- Read relevant documentation before modifying code");
      sections.push("- Follow existing patterns and conventions");
      sections.push("- Write tests for new functionality");
      sections.push(
        "- Update documentation when code changes affect documented behavior"
      );

      // If no stack-specific rules, add generic coding rules
      if (stackRules.length === 0) {
        sections.push("- No `any` types in TypeScript");
      }

      const generated = sections.join("\n");

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              generated,
              path: join(projectRoot, "CLAUDE.md"),
              note: "Review and customize before saving. Use Write tool to save.",
            }, null, 2),
          },
        ],
      };
    }
  );

  // --- mags_audit_claude_md ---
  server.tool(
    "mags_audit_claude_md",
    "Audit the existing CLAUDE.md file. Check for completeness, accuracy against docs, and suggest improvements.",
    {},
    async () => {
      const claudeMdPath = join(projectRoot, "CLAUDE.md");
      const issues: Array<{
        type: string;
        detail: string;
        severity: string;
      }> = [];
      const suggestions: string[] = [];

      if (!existsSync(claudeMdPath)) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                exists: false,
                suggestion:
                  "No CLAUDE.md found. Use mags_generate_claude_md to create one.",
              }),
            },
          ],
        };
      }

      const claudeMd = readFileSync(claudeMdPath, "utf-8");
      const docs = docIndexer.listDocs();

      // Check for tech stack reference
      if (
        !claudeMd.toLowerCase().includes("tech") &&
        !claudeMd.toLowerCase().includes("stack")
      ) {
        issues.push({
          type: "missing_section",
          detail: "No tech stack reference found",
          severity: "warning",
        });
        suggestions.push("Add tech stack summary from docs/architecture/tech-stack.md");
      }

      // Check for module/structure reference
      if (
        !claudeMd.toLowerCase().includes("module") &&
        !claudeMd.toLowerCase().includes("structure")
      ) {
        issues.push({
          type: "missing_section",
          detail: "No module/structure reference found",
          severity: "warning",
        });
      }

      // Check for documentation reference
      if (!claudeMd.includes("docs/") && !claudeMd.includes("docs\\")) {
        issues.push({
          type: "missing_section",
          detail: "No documentation directory reference",
          severity: "info",
        });
        suggestions.push("Add docs/ reference so Claude knows where to find documentation");
      }

      // Check for coding rules
      const hasRules =
        claudeMd.includes("rule") ||
        claudeMd.includes("convention") ||
        claudeMd.includes("standard");
      if (!hasRules) {
        issues.push({
          type: "missing_section",
          detail: "No coding rules or conventions found",
          severity: "warning",
        });
      }

      // Check word count
      const wordCount = claudeMd.split(/\s+/).length;
      if (wordCount < 50) {
        issues.push({
          type: "too_short",
          detail: `CLAUDE.md has only ${wordCount} words — likely incomplete`,
          severity: "warning",
        });
      }

      if (wordCount > 2000) {
        issues.push({
          type: "too_long",
          detail: `CLAUDE.md has ${wordCount} words — may overwhelm context. Consider trimming.`,
          severity: "info",
        });
      }

      // Score
      const errorCount = issues.filter((i) => i.severity === "error").length;
      const warningCount = issues.filter(
        (i) => i.severity === "warning"
      ).length;
      const score = Math.max(
        0,
        100 - errorCount * 20 - warningCount * 10
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                exists: true,
                wordCount,
                score,
                issues,
                suggestions,
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
