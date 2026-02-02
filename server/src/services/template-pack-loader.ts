// ============================================
// MAGS — Template Pack Loader
// Loads and validates custom template packs
// ============================================

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, basename, extname } from "node:path";
import YAML from "yaml";
import type { TemplatePackManifest, DocTemplate } from "../types/index.js";
import { DEFAULT_LOCALE } from "../config/defaults.js";

export class TemplatePackLoader {
  loadPack(packPath: string): TemplatePackManifest | null {
    const manifestPath = join(packPath, "pack.yaml");
    if (!existsSync(manifestPath)) return null;

    try {
      const raw = readFileSync(manifestPath, "utf-8");
      const manifest = YAML.parse(raw) as TemplatePackManifest;
      if (!manifest?.id || !manifest?.name) return null;
      return manifest;
    } catch {
      return null;
    }
  }

  validatePack(packPath: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!existsSync(packPath)) {
      errors.push(`Pack path does not exist: ${packPath}`);
      return { valid: false, errors };
    }

    const manifestPath = join(packPath, "pack.yaml");
    if (!existsSync(manifestPath)) {
      errors.push("Missing pack.yaml manifest");
      return { valid: false, errors };
    }

    try {
      const raw = readFileSync(manifestPath, "utf-8");
      const manifest = YAML.parse(raw) as TemplatePackManifest;

      if (!manifest?.id) errors.push("Missing 'id' in pack.yaml");
      if (!manifest?.name) errors.push("Missing 'name' in pack.yaml");
      if (!manifest?.version) errors.push("Missing 'version' in pack.yaml");

      // Check for template files
      const templateFiles = this.findTemplateFiles(packPath);
      if (templateFiles.length === 0) {
        errors.push("No template files found in pack");
      }
    } catch (e) {
      errors.push(`Invalid pack.yaml: ${e}`);
    }

    return { valid: errors.length === 0, errors };
  }

  getPackTemplates(packPath: string, locale: string = DEFAULT_LOCALE): DocTemplate[] {
    const templates: DocTemplate[] = [];

    // Try locale-specific dir first, then en, then root
    const dirs = [
      join(packPath, locale),
      join(packPath, DEFAULT_LOCALE),
      packPath,
    ];

    for (const dir of dirs) {
      if (!existsSync(dir)) continue;

      const files = readdirSync(dir).filter(
        (f) => f.endsWith(".md") || f.endsWith(".hbs")
      );

      for (const file of files) {
        if (file === "pack.yaml") continue;
        const filePath = join(dir, file);
        const name = basename(file, extname(file));

        // Don't add duplicates
        if (templates.some((t) => t.name === name)) continue;

        try {
          const content = readFileSync(filePath, "utf-8");
          templates.push({
            name,
            description: this.extractDescription(content),
            filename: `${name}.md`,
            variables: this.extractVariables(content),
            content,
          });
        } catch {
          // Skip unreadable files
        }
      }

      // If we found templates, don't fall through to next dir
      if (templates.length > 0) break;
    }

    return templates;
  }

  private findTemplateFiles(packPath: string): string[] {
    const files: string[] = [];
    const scanDir = (dir: string) => {
      if (!existsSync(dir)) return;
      try {
        const entries = readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isFile() && (entry.name.endsWith(".md") || entry.name.endsWith(".hbs")) && entry.name !== "pack.yaml") {
            files.push(join(dir, entry.name));
          } else if (entry.isDirectory()) {
            scanDir(join(dir, entry.name));
          }
        }
      } catch {
        // ignore
      }
    };
    scanDir(packPath);
    return files;
  }

  private extractVariables(content: string): Array<{ name: string; description: string; required: boolean }> {
    const varRegex = /\{\{(\w+)\}\}/g;
    const vars = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = varRegex.exec(content)) !== null) {
      vars.add(match[1]);
    }
    const builtins = new Set(["date", "year", "if", "each", "unless", "with"]);
    return Array.from(vars)
      .filter((v) => !builtins.has(v))
      .map((v) => ({ name: v, description: `Value for ${v}`, required: true }));
  }

  private extractDescription(content: string): string {
    const commentMatch = content.match(/<!--\s*(.+?)\s*-->/);
    if (commentMatch) return commentMatch[1];
    const lines = content.split("\n").filter((l) => l.trim().length > 0);
    let i = 0;
    if (lines[0]?.trim() === "---") {
      i = lines.findIndex((l, idx) => idx > 0 && l.trim() === "---") + 1;
    }
    for (; i < lines.length; i++) {
      if (!lines[i].startsWith("#") && !lines[i].startsWith("---")) {
        return lines[i].trim().slice(0, 100);
      }
    }
    return "";
  }
}
