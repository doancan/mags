// ============================================
// MAGS — Template Engine
// Document template loading and rendering
// ============================================

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, basename, extname } from "node:path";
import Handlebars from "handlebars";
import YAML from "yaml";
import type { DocTemplate, TemplateVariable, TemplatePackManifest } from "../types/index.js";
import { DEFAULT_LOCALE } from "../config/defaults.js";

export class TemplateEngine {
  private templates: Map<string, DocTemplate> = new Map();
  private templateDir: string;
  private locale: string;
  private architecture?: string;
  private stack?: string;
  private apiStyle?: string;
  private customPacks?: string[];
  private pluginRoot: string;

  constructor(
    pluginRoot: string,
    options?: {
      locale?: string;
      architecture?: string;
      stack?: string;
      apiStyle?: string;
      customPacks?: string[];
    }
  ) {
    this.pluginRoot = pluginRoot;
    this.templateDir = join(pluginRoot, "templates", "docs");
    this.locale = options?.locale || DEFAULT_LOCALE;
    this.architecture = options?.architecture;
    this.stack = options?.stack;
    this.apiStyle = options?.apiStyle;
    this.customPacks = options?.customPacks;
    this.loadTemplates();
  }

  private loadTemplates(): void {
    // 1. Load base templates from locale dir (with fallback to en)
    this.loadFromDir(join(this.templateDir, this.locale));
    if (this.locale !== DEFAULT_LOCALE) {
      // Fallback: load en templates for any not yet loaded
      this.loadFromDir(join(this.templateDir, DEFAULT_LOCALE), true);
    }

    // Legacy: load from root templates/docs/ if locale dirs don't exist
    if (this.templates.size === 0) {
      this.loadFromDir(this.templateDir);
    }

    // 2. Load architecture-specific templates
    if (this.architecture) {
      const archDir = join(this.templateDir, this.locale, "architectures", this.architecture);
      this.loadFromDir(archDir);
      if (this.locale !== DEFAULT_LOCALE) {
        this.loadFromDir(join(this.templateDir, DEFAULT_LOCALE, "architectures", this.architecture), true);
      }
    }

    // 3. Load stack-specific templates (higher priority than architecture)
    if (this.stack) {
      const stackDir = join(this.templateDir, this.locale, "stacks", this.stack);
      this.loadFromDir(stackDir);
      if (this.locale !== DEFAULT_LOCALE) {
        this.loadFromDir(join(this.templateDir, DEFAULT_LOCALE, "stacks", this.stack), true);
      }
    }

    // 4. Load API style templates
    if (this.apiStyle && this.apiStyle !== "rest") {
      const apiDir = join(this.templateDir, this.locale, "api-styles", this.apiStyle);
      this.loadFromDir(apiDir);
      if (this.locale !== DEFAULT_LOCALE) {
        this.loadFromDir(join(this.templateDir, DEFAULT_LOCALE, "api-styles", this.apiStyle), true);
      }
    }

    // 5. Load legacy templates
    const legacyDir = join(this.templateDir, this.locale, "legacy");
    this.loadFromDir(legacyDir);
    if (this.locale !== DEFAULT_LOCALE) {
      this.loadFromDir(join(this.templateDir, DEFAULT_LOCALE, "legacy"), true);
    }

    // 6. Load custom template packs
    if (this.customPacks) {
      this.loadCustomPacks();
    }
  }

  private loadFromDir(dir: string, fallbackOnly = false): void {
    if (!existsSync(dir)) return;

    const files = readdirSync(dir).filter(
      (f) => f.endsWith(".md") || f.endsWith(".hbs")
    );

    for (const file of files) {
      const filePath = join(dir, file);
      const content = readFileSync(filePath, "utf-8");
      const name = basename(file, extname(file));

      // In fallback mode, only add if not already loaded
      if (fallbackOnly && this.templates.has(name)) continue;

      const variables = this.extractVariables(content);

      this.templates.set(name, {
        name,
        description: this.extractDescription(content),
        filename: `${name}.md`,
        variables,
        content,
      });
    }
  }

  private loadCustomPacks(): void {
    if (!this.customPacks) return;

    for (const packPath of this.customPacks) {
      const resolvedPath = join(this.pluginRoot, packPath);
      const manifestPath = join(resolvedPath, "pack.yaml");

      if (!existsSync(manifestPath)) continue;

      try {
        const raw = readFileSync(manifestPath, "utf-8");
        const manifest = YAML.parse(raw) as TemplatePackManifest;
        if (!manifest || !manifest.id) continue;

        // Load templates from the pack's locale dir
        const packLocaleDir = join(resolvedPath, this.locale);
        const packEnDir = join(resolvedPath, DEFAULT_LOCALE);

        if (existsSync(packLocaleDir)) {
          this.loadFromDir(packLocaleDir);
        } else if (existsSync(packEnDir)) {
          this.loadFromDir(packEnDir);
        } else {
          // Try root of pack
          this.loadFromDir(resolvedPath);
        }
      } catch {
        // Skip invalid packs
      }
    }
  }

  /**
   * List available templates
   */
  listTemplates(): Array<{ name: string; description: string; variables: TemplateVariable[] }> {
    return Array.from(this.templates.values()).map((t) => ({
      name: t.name,
      description: t.description,
      variables: t.variables,
    }));
  }

  /**
   * Render a template with variables
   */
  render(
    templateName: string,
    variables: Record<string, string>
  ): string | null {
    const template = this.templates.get(templateName);
    if (!template) return null;

    // Add default variables
    const allVars: Record<string, string> = {
      date: new Date().toISOString().split("T")[0],
      year: new Date().getFullYear().toString(),
      ...variables,
    };

    const compiled = Handlebars.compile(template.content);
    return compiled(allVars);
  }

  /**
   * Get a specific template
   */
  getTemplate(name: string): DocTemplate | undefined {
    return this.templates.get(name);
  }

  // --- Private ---

  private extractVariables(content: string): TemplateVariable[] {
    const varRegex = /\{\{(\w+)\}\}/g;
    const vars = new Set<string>();
    let match: RegExpExecArray | null;

    while ((match = varRegex.exec(content)) !== null) {
      vars.add(match[1]);
    }

    // Remove built-in helpers
    const builtins = new Set(["date", "year", "if", "each", "unless", "with"]);

    return Array.from(vars)
      .filter((v) => !builtins.has(v))
      .map((v) => ({
        name: v,
        description: `Value for ${v}`,
        required: true,
      }));
  }

  private extractDescription(content: string): string {
    // Try to extract from first comment or first paragraph
    const commentMatch = content.match(/<!--\s*(.+?)\s*-->/);
    if (commentMatch) return commentMatch[1];

    const lines = content.split("\n").filter((l) => l.trim().length > 0);
    // Skip frontmatter
    let i = 0;
    if (lines[0]?.trim() === "---") {
      i = lines.findIndex((l, idx) => idx > 0 && l.trim() === "---") + 1;
    }

    // Return first non-heading line
    for (; i < lines.length; i++) {
      if (!lines[i].startsWith("#") && !lines[i].startsWith("---")) {
        return lines[i].trim().slice(0, 100);
      }
    }

    return "";
  }
}
