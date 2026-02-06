// ============================================
// MAGS — Document Tools
// MCP tool handlers for document operations
// ============================================

import { z } from "zod";
import { writeFileSync, existsSync, mkdirSync, copyFileSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DocIndexer } from "../services/doc-indexer.js";
import type { TemplateEngine } from "../services/template-engine.js";
import { DEFAULT_QUERY_LIMIT } from "../config/defaults.js";

export function registerDocTools(
  server: McpServer,
  docIndexer: DocIndexer,
  templateEngine: TemplateEngine,
  docsPath: string
) {
  // --- mags_list_docs ---
  server.tool(
    "mags_list_docs",
    "List all project documents with their status and metadata",
    { status: z.string().nullable().optional().describe("Filter by status: all, draft, locked, review") },
    async ({ status }: { status?: string | null }) => {
      const docs = docIndexer.listDocs(status ?? undefined);
      const list = docs.map((d) => ({
        name: d.name,
        path: d.relativePath,
        title: d.title,
        status: d.status ?? "—",
        lastUpdated: d.lastUpdated ?? "—",
        wordCount: d.wordCount,
        sections: d.sections.length,
      }));

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ docs: list, total: list.length }, null, 2),
          },
        ],
      };
    }
  );

  // --- mags_get_doc ---
  server.tool(
    "mags_get_doc",
    "Read a specific document. Optionally filter by section heading.",
    {
      name: z.string().describe("Document name (without extension) or relative path"),
      section: z.string().nullable().optional().describe("Section heading to extract"),
    },
    async ({ name, section }: { name: string; section?: string | null }) => {
      const doc = docIndexer.getDoc(name);
      if (!doc) {
        const available = docIndexer.listDocs().map((d) => d.name);
        return {
          content: [
            {
              type: "text" as const,
              text: `Document "${name}" not found. Available: ${available.join(", ")}`,
            },
          ],
          isError: true,
        };
      }

      const content = docIndexer.getDocContent(name, section ?? undefined);

      if (!content) {
        const availableSections = doc.sections;
        return {
          content: [
            {
              type: "text" as const,
              text: `Section "${section}" not found in "${name}". Available sections: ${availableSections.length > 0 ? availableSections.join(", ") : "(none)"}`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                name: doc.name,
                title: doc.title,
                status: doc.status,
                section: section ?? "full",
                content,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // --- mags_update_doc ---
  server.tool(
    "mags_update_doc",
    "Update a specific section of a document",
    {
      name: z.string().describe("Document name"),
      section: z.string().describe("Section heading to update"),
      content: z.string().describe("New content for the section"),
    },
    async ({
      name,
      section,
      content,
    }: {
      name: string;
      section: string;
      content: string;
    }) => {
      const doc = docIndexer.getDoc(name);
      if (!doc) {
        return {
          content: [{ type: "text" as const, text: `Document "${name}" not found` }],
          isError: true,
        };
      }

      // Read current content and replace section
      const { readFileSync } = await import("node:fs");
      const { default: matter } = await import("gray-matter");

      const raw = readFileSync(doc.path, "utf-8");
      const parsed = matter(raw);
      const docContent = parsed.content;

      // Find section in document
      const sectionPattern = new RegExp(
        `(^#{1,3}\\s+${escapeRegex(section)}\\s*$)`,
        "m"
      );
      const match = sectionPattern.exec(docContent);

      let newContent: string;
      let created = false;
      let contentChanged = true;

      if (!match) {
        created = true;
      } else {
        // Check if content actually changed before updating last_updated
        const rest = docContent.slice(match.index + match[0].length);
        const level = match[0].match(/^(#+)/)?.[1] ?? "##";
        const nextHeading = rest.match(
          new RegExp(`^#{1,${level.length}}\\s+`, "m")
        );
        const existingContent = nextHeading
          ? rest.slice(0, rest.indexOf(nextHeading[0])).trim()
          : rest.trim();

        if (existingContent === content.trim()) {
          contentChanged = false;
        }
      }

      // Only update last_updated when content actually changed
      const frontmatterData = { ...parsed.data };
      if (contentChanged) {
        frontmatterData.last_updated = new Date().toISOString().split("T")[0];
      }
      const frontmatter = matter.stringify("", frontmatterData);

      if (!match) {
        const trimmed = docContent.trimEnd();
        newContent = `${frontmatter.trim()}\n\n${trimmed}\n\n## ${section}\n\n${content}\n`;
      } else {
        const beforeSection = docContent.slice(0, match.index);
        const level = match[0].match(/^(#+)/)?.[1] ?? "##";

        const rest = docContent.slice(match.index + match[0].length);
        const nextHeading = rest.match(
          new RegExp(`^#{1,${level.length}}\\s+`, "m")
        );
        const afterSection = nextHeading
          ? rest.slice(rest.indexOf(nextHeading[0]))
          : "";

        newContent = `${frontmatter.trim()}\n\n${beforeSection}${level} ${section}\n\n${content}\n\n${afterSection}`.trim() + "\n";
      }

      const bakPath = doc.path + ".bak";
      try {
        copyFileSync(doc.path, bakPath);
      } catch (err) {
        console.warn(`[DocTools] Failed to create backup at ${bakPath}:`, err instanceof Error ? err.message : err);
      }

      try {
        writeFileSync(doc.path, newContent, "utf-8");
        // Success — remove backup
        try { unlinkSync(bakPath); } catch (err) { console.warn(`[DocTools] Failed to remove backup ${bakPath}:`, err instanceof Error ? err.message : err); }
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Failed to write "${doc.relativePath}": ${err instanceof Error ? err.message : String(err)}. Backup saved at ${bakPath}` }],
          isError: true,
        };
      }

      // Re-index
      docIndexer.index();

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              path: doc.relativePath,
              section,
              ...(created ? { created: true } : {}),
            }),
          },
        ],
      };
    }
  );

  // --- mags_search_docs ---
  server.tool(
    "mags_search_docs",
    "Search across all documents using full-text fuzzy search",
    {
      query: z.string().describe("Search query"),
      limit: z.number().nullable().optional().describe("Max results (default 10)"),
    },
    async ({ query, limit }: { query: string; limit?: number | null }) => {
      const results = docIndexer.search(query, limit ?? DEFAULT_QUERY_LIMIT);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ query, results, total: results.length }, null, 2),
          },
        ],
      };
    }
  );

  // --- mags_update_metadata ---
  server.tool(
    "mags_update_metadata",
    "Update frontmatter metadata fields of a document (e.g. status, title, tags) without changing content",
    {
      name: z.string().describe("Document name"),
      metadata: z
        .record(z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()]))
        .describe("Metadata fields to set. Use null to remove a field."),
    },
    async ({
      name,
      metadata,
    }: {
      name: string;
      metadata: Record<string, string | number | boolean | string[] | null>;
    }) => {
      const doc = docIndexer.getDoc(name);
      if (!doc) {
        return {
          content: [{ type: "text" as const, text: `Document "${name}" not found` }],
          isError: true,
        };
      }

      const { readFileSync: readFile } = await import("node:fs");
      const { default: matter } = await import("gray-matter");

      const raw = readFile(doc.path, "utf-8");
      const parsed = matter(raw);

      // Merge metadata: null values remove the field
      const newData = { ...parsed.data };
      for (const [key, value] of Object.entries(metadata)) {
        if (value === null) {
          delete newData[key];
        } else {
          newData[key] = value;
        }
      }

      // Only update last_updated if not explicitly provided
      if (!("last_updated" in metadata) && !("lastUpdated" in metadata)) {
        newData.last_updated = new Date().toISOString().split("T")[0];
      }

      const newContent = matter.stringify(parsed.content, newData);

      try {
        writeFileSync(doc.path, newContent, "utf-8");
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Failed to write "${doc.relativePath}": ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }

      docIndexer.index();

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              path: doc.relativePath,
              updatedFields: Object.keys(metadata),
            }),
          },
        ],
      };
    }
  );

  // --- mags_reindex ---
  server.tool(
    "mags_reindex",
    "Refresh the document index. Use after adding, removing, or modifying documents outside of MAGS tools.",
    {},
    async () => {
      const result = docIndexer.reindex();

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: true,
                changes: {
                  added: result.added,
                  removed: result.removed,
                  updated: result.updated,
                },
                summary: {
                  addedCount: result.added.length,
                  removedCount: result.removed.length,
                  updatedCount: result.updated.length,
                  totalDocs: result.total,
                  durationMs: result.duration,
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

  // --- mags_create_doc ---
  server.tool(
    "mags_create_doc",
    "Create a new document from a template",
    {
      template: z.string().describe("Template name (vision, prd, etc.)"),
      variables: z.record(z.string()).nullable().optional().describe("Template variables"),
      path: z.string().nullable().optional().describe("Custom output path relative to docs/"),
      overwrite: z.boolean().optional().default(false).describe("Allow overwriting existing file"),
      locale: z.string().nullable().optional().describe("Locale for template content (e.g. 'en', 'tr')"),
    },
    async ({
      template,
      variables,
      path: customPath,
      overwrite,
      locale,
    }: {
      template: string;
      variables?: Record<string, string> | null;
      path?: string | null;
      overwrite: boolean;
      locale?: string | null;
    }) => {
      const previousLocale = templateEngine.getLocale();
      if (locale) {
        templateEngine.setLocale(locale);
      }
      const rendered = templateEngine.render(template, variables ?? {});
      if (locale) {
        templateEngine.setLocale(previousLocale);
      }
      if (!rendered) {
        const available = templateEngine.listTemplates().map((t) => t.name);
        return {
          content: [
            {
              type: "text" as const,
              text: `Template "${template}" not found. Available: ${available.join(", ")}`,
            },
          ],
          isError: true,
        };
      }

      const outputPath = join(
        docsPath,
        customPath ?? `${template}.md`
      );

      // Overwrite guard
      if (existsSync(outputPath) && !overwrite) {
        return {
          content: [
            {
              type: "text" as const,
              text: `File already exists at "${outputPath}". Use overwrite: true to replace it.`,
            },
          ],
          isError: true,
        };
      }

      const dir = dirname(outputPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      try {
        writeFileSync(outputPath, rendered, "utf-8");
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Failed to create document at "${outputPath}": ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
      docIndexer.index();

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              path: outputPath,
              template,
            }),
          },
        ],
      };
    }
  );
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
