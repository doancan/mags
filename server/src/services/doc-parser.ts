// ============================================
// MAGS — Document Parser
// Multi-format document parsing (md, rst, adoc)
// ============================================

import { readFileSync } from "node:fs";
import { extname } from "node:path";
import matter from "gray-matter";

export interface ParsedDoc {
  metadata: Record<string, unknown>;
  content: string;
  sections: string[];
}

export class DocParser {
  parse(filePath: string): ParsedDoc {
    const ext = extname(filePath).toLowerCase();
    const raw = readFileSync(filePath, "utf-8");

    switch (ext) {
      case ".rst":
        return this.parseRst(raw);
      case ".adoc":
        return this.parseAsciiDoc(raw);
      case ".md":
      case ".mdx":
      default:
        return this.parseMarkdown(raw);
    }
  }

  parseFromString(content: string, format: "md" | "rst" | "adoc"): ParsedDoc {
    switch (format) {
      case "rst":
        return this.parseRst(content);
      case "adoc":
        return this.parseAsciiDoc(content);
      case "md":
      default:
        return this.parseMarkdown(content);
    }
  }

  private parseMarkdown(raw: string): ParsedDoc {
    const { data, content } = matter(raw);
    const sections = this.extractMarkdownSections(content);
    return { metadata: data, content, sections };
  }

  private parseRst(raw: string): ParsedDoc {
    const metadata = this.extractRstMetadata(raw);
    const content = this.stripRstMetadata(raw);
    const sections = this.extractRstSections(raw);
    return { metadata, content, sections };
  }

  private parseAsciiDoc(raw: string): ParsedDoc {
    const metadata = this.extractAsciiDocAttributes(raw);
    const content = this.stripAsciiDocHeader(raw);
    const sections = this.extractAsciiDocSections(raw);
    return { metadata, content, sections };
  }

  // --- Markdown helpers ---

  private extractMarkdownSections(content: string): string[] {
    const headingRegex = /^#{1,3}\s+(.+)$/gm;
    const sections: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = headingRegex.exec(content)) !== null) {
      sections.push(match[1].trim());
    }
    return sections;
  }

  // --- RST helpers ---

  private extractRstMetadata(raw: string): Record<string, unknown> {
    const metadata: Record<string, unknown> = {};

    // RST field list at the top: :field: value
    const fieldRegex = /^:(\w[\w-]*):\s+(.+)$/gm;
    let match: RegExpExecArray | null;
    while ((match = fieldRegex.exec(raw)) !== null) {
      metadata[match[1]] = match[2].trim();
    }

    // RST directive metadata (.. meta::)
    const metaMatch = raw.match(/\.\.\s+meta::\s*\n((?:\s+:.+\n)*)/);
    if (metaMatch) {
      const metaFields = metaMatch[1];
      const metaFieldRegex = /\s+:(\w[\w-]*):\s+(.+)/g;
      let mf: RegExpExecArray | null;
      while ((mf = metaFieldRegex.exec(metaFields)) !== null) {
        metadata[mf[1]] = mf[2].trim();
      }
    }

    // Extract title from RST underline pattern
    const lines = raw.split("\n");
    for (let i = 0; i < lines.length - 1; i++) {
      const nextLine = lines[i + 1];
      if (nextLine && /^[=]{3,}$/.test(nextLine.trim()) && lines[i].trim().length > 0) {
        metadata.title = lines[i].trim();
        break;
      }
    }

    return metadata;
  }

  private stripRstMetadata(raw: string): string {
    // Remove field list at top
    return raw.replace(/^:[\w-]+:\s+.+\n/gm, "").trim();
  }

  private extractRstSections(raw: string): string[] {
    const sections: string[] = [];
    const lines = raw.split("\n");
    const underlineChars = /^[=\-~^"+]{3,}$/;

    for (let i = 0; i < lines.length - 1; i++) {
      const currentLine = lines[i].trim();
      const nextLine = lines[i + 1]?.trim();

      if (
        currentLine.length > 0 &&
        nextLine &&
        underlineChars.test(nextLine) &&
        nextLine.length >= currentLine.length
      ) {
        sections.push(currentLine);
      }
    }

    return sections;
  }

  // --- AsciiDoc helpers ---

  private extractAsciiDocAttributes(raw: string): Record<string, unknown> {
    const metadata: Record<string, unknown> = {};

    // AsciiDoc attributes: :attribute-name: value
    const attrRegex = /^:([a-zA-Z][\w-]*):\s*(.*)$/gm;
    let match: RegExpExecArray | null;
    while ((match = attrRegex.exec(raw)) !== null) {
      metadata[match[1]] = match[2].trim() || true;
    }

    // Title from = Title line
    const titleMatch = raw.match(/^=\s+(.+)$/m);
    if (titleMatch) {
      metadata.title = titleMatch[1].trim();
    }

    return metadata;
  }

  private stripAsciiDocHeader(raw: string): string {
    // Remove attribute lines from top
    const lines = raw.split("\n");
    let startIdx = 0;
    for (let i = 0; i < lines.length; i++) {
      if (/^:[a-zA-Z][\w-]*:/.test(lines[i]) || lines[i].trim() === "") {
        startIdx = i + 1;
      } else {
        break;
      }
    }
    return lines.slice(startIdx).join("\n").trim();
  }

  private extractAsciiDocSections(raw: string): string[] {
    const sections: string[] = [];

    // AsciiDoc sections: == Title, === Title, etc.
    const sectionRegex = /^={2,5}\s+(.+)$/gm;
    let match: RegExpExecArray | null;
    while ((match = sectionRegex.exec(raw)) !== null) {
      sections.push(match[1].trim());
    }

    return sections;
  }
}
