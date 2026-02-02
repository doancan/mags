// ============================================
// MAGS — Document Indexer
// Scans, parses, and indexes markdown documents
// ============================================

import { readFile, readdir, lstat } from "node:fs/promises";
import { existsSync, readFileSync, readdirSync, lstatSync, realpathSync } from "node:fs";
import { join, relative, basename, extname, resolve } from "node:path";
import matter from "gray-matter";
import Fuse from "fuse.js";
import { SUPPORTED_DOC_EXTENSIONS } from "../config/defaults.js";
import { DocParser } from "./doc-parser.js";
import type {
  DocEntry,
  DocMetadata,
  DocSearchResult,
} from "../types/index.js";

export class DocIndexer {
  private docs: DocEntry[] = [];
  private fuse: Fuse<{ doc: string; section: string; content: string }> | null =
    null;
  private docsPath: string;

  constructor(docsPath: string) {
    this.docsPath = docsPath;
  }

  /**
   * Scan and index all documents in the docs directory (sync)
   */
  index(): DocEntry[] {
    this.docs = [];
    if (!existsSync(this.docsPath)) {
      return this.docs;
    }
    this.scanDirectorySync(this.docsPath, new Set());
    this.buildSearchIndex();
    return this.docs;
  }

  /**
   * Async version of index for non-blocking startup
   */
  async indexAsync(): Promise<DocEntry[]> {
    this.docs = [];
    if (!existsSync(this.docsPath)) {
      return this.docs;
    }
    await this.scanDirectory(this.docsPath, new Set());
    this.buildSearchIndex();
    return this.docs;
  }

  private async scanDirectory(dirPath: string, visited: Set<string>): Promise<void> {
    // Resolve real path to detect symlink cycles
    const realPath = resolve(dirPath);
    if (visited.has(realPath)) return;
    visited.add(realPath);

    let entries;
    try {
      entries = await readdir(dirPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);

      // Skip hidden directories and .mags
      if (entry.name.startsWith(".")) continue;

      // Check for symlinks and resolve them safely
      try {
        const stats = await lstat(fullPath);
        if (stats.isSymbolicLink()) {
          const realTarget = resolve(fullPath);
          if (visited.has(realTarget)) continue;
        }
      } catch {
        continue;
      }

      if (entry.isDirectory()) {
        await this.scanDirectory(fullPath, visited);
      } else if (
        entry.isFile() &&
        SUPPORTED_DOC_EXTENSIONS.includes(
          extname(entry.name) as (typeof SUPPORTED_DOC_EXTENSIONS)[number]
        )
      ) {
        const doc = await this.parseDocumentAsync(fullPath);
        if (doc) this.docs.push(doc);
      }
    }
  }

  private scanDirectorySync(dirPath: string, visited: Set<string>): void {
    const realPath = resolve(dirPath);
    if (visited.has(realPath)) return;
    visited.add(realPath);

    let entries;
    try {
      entries = readdirSync(dirPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);

      if (entry.name.startsWith(".")) continue;

      // Symlink cycle protection
      try {
        const stats = lstatSync(fullPath);
        if (stats.isSymbolicLink()) {
          const realTarget = realpathSync(fullPath);
          if (visited.has(realTarget)) continue;
        }
      } catch {
        continue;
      }

      if (entry.isDirectory()) {
        this.scanDirectorySync(fullPath, visited);
      } else if (
        entry.isFile() &&
        SUPPORTED_DOC_EXTENSIONS.includes(
          extname(entry.name) as (typeof SUPPORTED_DOC_EXTENSIONS)[number]
        )
      ) {
        const doc = this.parseDocument(fullPath);
        if (doc) this.docs.push(doc);
      }
    }
  }

  private async parseDocumentAsync(filePath: string): Promise<DocEntry | null> {
    try {
      const raw = await readFile(filePath, "utf-8");
      return this.parseRaw(filePath, raw);
    } catch {
      return null;
    }
  }

  private parseDocument(filePath: string): DocEntry | null {
    try {
      const raw = readFileSync(filePath, "utf-8");
      return this.parseRaw(filePath, raw);
    } catch {
      return null;
    }
  }

  private parseRaw(filePath: string, raw: string): DocEntry | null {
    const ext = extname(filePath).toLowerCase();

    // Use DocParser for non-markdown formats
    if (ext === ".rst" || ext === ".adoc") {
      try {
        const parser = new DocParser();
        const parsed = parser.parseFromString(
          raw,
          ext === ".rst" ? "rst" : "adoc"
        );
        const metadata = parsed.metadata as DocMetadata;
        const name = basename(filePath, extname(filePath));
        const wordCount = parsed.content.split(/\s+/).filter((w) => w.length > 0).length;

        return {
          name,
          path: filePath,
          relativePath: relative(this.docsPath, filePath),
          title: (metadata.title as string) || name,
          status: metadata.status,
          lastUpdated: (metadata.last_updated as string | undefined) ?? (metadata.lastUpdated as string | undefined),
          wordCount,
          sections: parsed.sections,
          metadata,
        };
      } catch {
        return null;
      }
    }

    // Default: markdown/mdx with gray-matter
    const { data, content } = matter(raw);
    const metadata = data as DocMetadata;

    const sections = this.extractSections(content);
    const wordCount = content
      .split(/\s+/)
      .filter((w) => w.length > 0).length;

    const name = basename(filePath, extname(filePath));

    return {
      name,
      path: filePath,
      relativePath: relative(this.docsPath, filePath),
      title: metadata.title || name,
      status: metadata.status,
      lastUpdated: (metadata.last_updated as string | undefined) ?? (metadata.lastUpdated as string | undefined),
      wordCount,
      sections,
      metadata,
    };
  }

  private extractSections(content: string): string[] {
    const headingRegex = /^#{1,3}\s+(.+)$/gm;
    const sections: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = headingRegex.exec(content)) !== null) {
      sections.push(match[1].trim());
    }
    return sections;
  }

  private buildSearchIndex(): void {
    const searchDocs: Array<{
      doc: string;
      section: string;
      content: string;
    }> = [];

    for (const doc of this.docs) {
      try {
        const raw = readFileSync(doc.path, "utf-8");
        const { content } = matter(raw);

        // Split by sections for granular search
        const sectionBlocks = content.split(/^(?=#{1,3}\s)/m);

        for (const block of sectionBlocks) {
          const firstLine = block.split("\n")[0];
          const sectionName = firstLine.replace(/^#+\s*/, "").trim() || "Intro";

          searchDocs.push({
            doc: doc.name,
            section: sectionName,
            content: block.trim(),
          });
        }
      } catch {
        // Skip files that can't be read
      }
    }

    this.fuse = new Fuse(searchDocs, {
      keys: [
        { name: "content", weight: 0.7 },
        { name: "section", weight: 0.2 },
        { name: "doc", weight: 0.1 },
      ],
      threshold: 0.5,
      includeScore: true,
      ignoreLocation: true,
      minMatchCharLength: 2,
      useExtendedSearch: true,
    });
  }

  // --- Public API ---

  listDocs(status?: string): DocEntry[] {
    if (!status || status === "all") return this.docs;
    return this.docs.filter(
      (d) => d.status?.toLowerCase() === status.toLowerCase()
    );
  }

  getDoc(name: string): DocEntry | undefined {
    return this.docs.find(
      (d) => d.name === name || d.relativePath === name
    );
  }

  getDocContent(name: string, section?: string): string | null {
    const doc = this.getDoc(name);
    if (!doc) return null;

    const raw = readFileSync(doc.path, "utf-8");
    const { content } = matter(raw);

    if (!section) return content;

    // Extract specific section
    const sectionRegex = new RegExp(
      `^(#{1,3})\\s+${escapeRegex(section)}\\s*$`,
      "m"
    );
    const match = sectionRegex.exec(content);
    if (!match) return null;

    const level = match[1].length;
    const startIndex = match.index;
    const rest = content.slice(startIndex);

    // Find next heading of same or higher level
    const nextHeadingRegex = new RegExp(
      `^#{1,${level}}\\s+`,
      "m"
    );
    const lines = rest.split("\n");
    let endIndex = rest.length;

    for (let i = 1; i < lines.length; i++) {
      if (nextHeadingRegex.test(lines[i])) {
        endIndex = lines.slice(0, i).join("\n").length;
        break;
      }
    }

    return rest.slice(0, endIndex).trim();
  }

  search(query: string, limit = 10): DocSearchResult[] {
    if (!this.fuse) this.buildSearchIndex();
    if (!this.fuse) return [];

    // Multi-word queries: split into OR terms for extended search
    const words = query.trim().split(/\s+/);
    const searchQuery =
      words.length > 1
        ? { $or: words.map((w) => ({ content: w })) }
        : query;

    const results = this.fuse.search(searchQuery, { limit });

    return results.map((r) => ({
      doc: r.item.doc,
      section: r.item.section,
      snippet: r.item.content.slice(0, 300),
      score: 1 - (r.score ?? 1),
    }));
  }

  getDocsBySection(sectionName: string): DocEntry[] {
    return this.docs.filter((d) =>
      d.sections.some((s) =>
        s.toLowerCase().includes(sectionName.toLowerCase())
      )
    );
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
