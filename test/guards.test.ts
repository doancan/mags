import { describe, it, expect } from "vitest";
import {
  readFileSync,
  existsSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join } from "node:path";

// ═══════════════════════════════════════════════════
// Regression Prevention Guards
// Ensures SSOT invariants, template consistency,
// skill integrity, and plugin structure.
// ═══════════════════════════════════════════════════

const PROJECT_ROOT = join(import.meta.dirname, "..");
const SERVER_DIR = join(PROJECT_ROOT, "server");
const PLUGIN_JSON = join(PROJECT_ROOT, ".claude-plugin", "plugin.json");
const MARKETPLACE_JSON = join(PROJECT_ROOT, ".claude-plugin", "marketplace.json");
const ROOT_PKG = join(PROJECT_ROOT, "package.json");
const SERVER_PKG = join(SERVER_DIR, "package.json");
const BUNDLE_PATH = join(SERVER_DIR, "dist", "mags-server.bundle.mjs");
const DEFAULTS_PATH = join(SERVER_DIR, "src", "config", "defaults.ts");
const INDEX_PATH = join(SERVER_DIR, "src", "index.ts");
const TEMPLATES_ROOT = join(PROJECT_ROOT, "templates", "docs");
const SKILLS_DIR = join(PROJECT_ROOT, "skills");

// ── Helpers ────────────────────────────────────────

function readJSON(path: string): any {
  return JSON.parse(readFileSync(path, "utf-8"));
}

function extractMarkdownHeadings(content: string): string[] {
  return content
    .split("\n")
    .filter((line) => /^#{1,6}\s/.test(line))
    .map((line) => line.replace(/^#+\s*/, "").trim());
}

function extractFrontmatter(content: string): Record<string, string> | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const fm: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const kv = line.match(/^(\w[\w_]*)\s*:\s*(.+)/);
    if (kv) fm[kv[1]] = kv[2].trim();
  }
  return fm;
}

// ── 1.1 Version SSOT Guard ─────────────────────────

describe("Version SSOT Guard", () => {
  const rootVersion = readJSON(ROOT_PKG).version;
  const serverVersion = readJSON(SERVER_PKG).version;
  const pluginVersion = readJSON(PLUGIN_JSON).version;
  const marketplaceVersion = readJSON(MARKETPLACE_JSON).plugins[0].version;

  it("all 4 version sources agree", () => {
    expect(serverVersion).toBe(rootVersion);
    expect(pluginVersion).toBe(rootVersion);
    expect(marketplaceVersion).toBe(rootVersion);
  });

  it("version follows semver format", () => {
    expect(rootVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("server/src/index.ts reads version from package.json (no hardcoded version)", () => {
    const indexSrc = readFileSync(INDEX_PATH, "utf-8");
    // Must contain the dynamic require pattern
    expect(indexSrc).toContain('require("../package.json")');
    // Must NOT contain a hardcoded version string like version: "0.2.0"
    expect(indexSrc).not.toMatch(/version\s*[:=]\s*["']\d+\.\d+\.\d+["']/);
  });
});

// ── 1.2 Constants SSOT Guard ───────────────────────

describe("Constants SSOT Guard", () => {
  const defaultsSrc = readFileSync(DEFAULTS_PATH, "utf-8");

  it("memory-store.ts imports MAX_MEMORY_ENTRIES from defaults", () => {
    const memStoreSrc = readFileSync(
      join(SERVER_DIR, "src", "services", "memory-store.ts"),
      "utf-8"
    );
    expect(memStoreSrc).toContain("MAX_MEMORY_ENTRIES");
    expect(memStoreSrc).toMatch(
      /import\s*\{[^}]*MAX_MEMORY_ENTRIES[^}]*\}\s*from\s*["'].*defaults/
    );
  });

  it("no hardcoded ?? 10 in tool files (must use DEFAULT_QUERY_LIMIT)", () => {
    const toolsDir = join(SERVER_DIR, "src", "tools");
    const toolFiles = readdirSync(toolsDir).filter((f) => f.endsWith(".ts"));

    for (const file of toolFiles) {
      const src = readFileSync(join(toolsDir, file), "utf-8");
      // If the file uses a ?? pattern with literal 10, it should be DEFAULT_QUERY_LIMIT
      const hardcoded = src.match(/\?\?\s*10\b/g);
      expect(
        hardcoded,
        `${file} has hardcoded ?? 10 — use DEFAULT_QUERY_LIMIT`
      ).toBeNull();
    }
  });

  it("every exported constant in defaults.ts is imported somewhere", () => {
    const exportNames = [
      ...defaultsSrc.matchAll(/export\s+const\s+(\w+)/g),
    ].map((m) => m[1]);

    // Collect all .ts files from server/src and test/
    function collectTsFiles(dir: string): string[] {
      const results: string[] = [];
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== "node_modules") {
          results.push(...collectTsFiles(full));
        } else if (entry.name.endsWith(".ts")) {
          results.push(full);
        }
      }
      return results;
    }

    const tsFiles = [
      ...collectTsFiles(join(SERVER_DIR, "src")),
      ...collectTsFiles(join(PROJECT_ROOT, "test")),
    ].filter((f) => !f.endsWith("defaults.ts"));

    for (const name of exportNames) {
      const found = tsFiles.some((f) =>
        readFileSync(f, "utf-8").includes(name)
      );
      expect(found, `Orphan export: ${name} is never used outside defaults.ts`).toBe(true);
    }
  });
});

// ── 1.3 Template Consistency Guard ─────────────────

describe("Template Consistency Guard", () => {
  const rootTemplates = readdirSync(TEMPLATES_ROOT).filter(
    (f) => f.endsWith(".md") && statSync(join(TEMPLATES_ROOT, f)).isFile()
  );
  const enDir = join(TEMPLATES_ROOT, "en");

  it("every root template has an en/ counterpart with matching headings", () => {
    for (const tmpl of rootTemplates) {
      const rootPath = join(TEMPLATES_ROOT, tmpl);
      const enPath = join(enDir, tmpl);

      expect(existsSync(enPath), `Missing en/ counterpart for ${tmpl}`).toBe(true);

      const rootHeadings = extractMarkdownHeadings(readFileSync(rootPath, "utf-8"));
      const enHeadings = extractMarkdownHeadings(readFileSync(enPath, "utf-8"));

      expect(rootHeadings, `Heading mismatch: ${tmpl} vs en/${tmpl}`).toEqual(enHeadings);
    }
  });

  it("all template frontmatter status fields are lowercase", () => {
    const allTemplates: string[] = [];

    function collectTemplates(dir: string) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) collectTemplates(full);
        else if (entry.name.endsWith(".md")) allTemplates.push(full);
      }
    }
    collectTemplates(TEMPLATES_ROOT);

    for (const tmplPath of allTemplates) {
      const content = readFileSync(tmplPath, "utf-8");
      const fm = extractFrontmatter(content);
      if (fm?.status) {
        expect(
          fm.status,
          `Uppercase status in ${tmplPath.replace(PROJECT_ROOT + "/", "")}`
        ).toBe(fm.status.toLowerCase());
      }
    }
  });

  it("all template frontmatter version fields are quoted strings", () => {
    const allTemplates: string[] = [];

    function collectTemplates(dir: string) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) collectTemplates(full);
        else if (entry.name.endsWith(".md")) allTemplates.push(full);
      }
    }
    collectTemplates(TEMPLATES_ROOT);

    for (const tmplPath of allTemplates) {
      const raw = readFileSync(tmplPath, "utf-8");
      const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
      if (!fmMatch) continue;
      const fmBlock = fmMatch[1];
      const versionLine = fmBlock.split("\n").find((l) => /^version\s*:/.test(l));
      if (!versionLine) continue;
      const value = versionLine.replace(/^version\s*:\s*/, "").trim();
      // Must be quoted (single or double quotes)
      expect(
        /^["'].*["']$/.test(value),
        `Unquoted version in ${tmplPath.replace(PROJECT_ROOT + "/", "")}: ${value}`
      ).toBe(true);
    }
  });

  it("all stack-specific tech-stack templates have ## Summary section", () => {
    const stacksDir = join(TEMPLATES_ROOT, "en", "stacks");
    if (!existsSync(stacksDir)) return;

    const stackDirs = readdirSync(stacksDir, { withFileTypes: true }).filter(
      (d) => d.isDirectory()
    );

    for (const stackDir of stackDirs) {
      const techStackPath = join(stacksDir, stackDir.name, "tech-stack.md");
      if (!existsSync(techStackPath)) continue;

      const content = readFileSync(techStackPath, "utf-8");
      const headings = extractMarkdownHeadings(content);
      expect(
        headings.some((h) => h === "Summary"),
        `Missing ## Summary in stacks/${stackDir.name}/tech-stack.md`
      ).toBe(true);
    }
  });
});

// ── 1.4 Skill Integrity Guard ──────────────────────

describe("Skill Integrity Guard", () => {
  // All MCP tool names registered in the server
  const REGISTERED_TOOLS = [
    "mags_list_docs",
    "mags_get_doc",
    "mags_update_doc",
    "mags_search_docs",
    "mags_create_doc",
    "mags_remember",
    "mags_recall",
    "mags_forget",
    "mags_promote_memory",
    "mags_init_progress",
    "mags_get_progress",
    "mags_update_progress",
    "mags_get_next",
    "mags_project_summary",
    "mags_module_context",
    "mags_validate_docs",
    "mags_generate_claude_md",
    "mags_audit_claude_md",
    "mags_generate_changelog",
    "mags_scaffold_module",
    "mags_detect_stack",
    "mags_discover_modules",
    "mags_reindex",
    "mags_update_metadata",
    "mags_parse_prd",
    "mags_analyze_codebase",
    "mags_generate_skill",
    "mags_generate_agent",
    "mags_init_execution",
    "mags_execute_step",
    "mags_get_current_step",
    "mags_resume_execution",
    "mags_verify_module",
    "mags_get_execution_status",
  ];

  // Claude Code built-in tools that skills can reference
  const BUILTIN_TOOLS = [
    "Bash",
    "Read",
    "Write",
    "Edit",
    "Glob",
    "Grep",
    "WebFetch",
    "WebSearch",
    "Task",
    "AskUserQuestion",
    "NotebookEdit",
  ];

  const MCP_PREFIX = "mcp__mags_mags__";

  const skillDirs = existsSync(SKILLS_DIR)
    ? readdirSync(SKILLS_DIR, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
    : [];

  it("every skill directory has a SKILL.md", () => {
    for (const skill of skillDirs) {
      const skillMd = join(SKILLS_DIR, skill, "SKILL.md");
      expect(existsSync(skillMd), `Missing SKILL.md in skills/${skill}`).toBe(true);
    }
  });

  it("all allowed-tools reference valid tools", () => {
    for (const skill of skillDirs) {
      const skillMd = join(SKILLS_DIR, skill, "SKILL.md");
      if (!existsSync(skillMd)) continue;

      const content = readFileSync(skillMd, "utf-8");
      const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (!fmMatch) continue;

      const toolLines = fmMatch[1]
        .split("\n")
        .filter((l) => /^\s+-\s+/.test(l))
        .map((l) => l.replace(/^\s+-\s+/, "").trim());

      // Only check lines after "allowed-tools:"
      const fmBlock = fmMatch[1];
      const atIndex = fmBlock.indexOf("allowed-tools:");
      if (atIndex === -1) continue;

      const afterAT = fmBlock.slice(atIndex);
      const atTools = afterAT
        .split("\n")
        .slice(1)
        .filter((l) => /^\s+-\s+/.test(l))
        .map((l) => l.replace(/^\s+-\s+/, "").trim());

      for (const tool of atTools) {
        if (tool.startsWith(MCP_PREFIX)) {
          const toolName = tool.replace(MCP_PREFIX, "");
          expect(
            REGISTERED_TOOLS.includes(toolName),
            `skills/${skill}: unknown MCP tool "${tool}"`
          ).toBe(true);
        } else {
          expect(
            BUILTIN_TOOLS.includes(tool),
            `skills/${skill}: unknown built-in tool "${tool}"`
          ).toBe(true);
        }
      }
    }
  });

  it("mags-init has mags_init_progress in allowed-tools", () => {
    const skillMd = join(SKILLS_DIR, "mags-init", "SKILL.md");
    expect(existsSync(skillMd)).toBe(true);
    const content = readFileSync(skillMd, "utf-8");
    expect(content).toContain(`${MCP_PREFIX}mags_init_progress`);
  });
});

// ── 1.5 Deep Validation Guard ───────────────────────

describe("Deep Validation Guard", () => {
  it("mags_validate_docs accepts deep parameter", () => {
    const validationToolsSrc = readFileSync(
      join(SERVER_DIR, "src", "tools", "validation-tools.ts"),
      "utf-8"
    );
    // Must have deep parameter in the tool definition
    expect(validationToolsSrc).toContain("z.boolean()");
    expect(validationToolsSrc).toMatch(/deep/);
  });

  it("ConsistencyChecker service exists", () => {
    const checkerPath = join(SERVER_DIR, "src", "services", "consistency-checker.ts");
    expect(existsSync(checkerPath)).toBe(true);
  });

  it("FRONTMATTER_SCHEMAS is defined in defaults.ts", () => {
    const defaultsSrc = readFileSync(DEFAULTS_PATH, "utf-8");
    expect(defaultsSrc).toContain("FRONTMATTER_SCHEMAS");
  });

  it("validation-tools imports ConsistencyChecker", () => {
    const validationToolsSrc = readFileSync(
      join(SERVER_DIR, "src", "tools", "validation-tools.ts"),
      "utf-8"
    );
    expect(validationToolsSrc).toContain("ConsistencyChecker");
  });
});

// ── 1.6 Plugin Structure Guard ──────────────────────

describe("Plugin Structure Guard", () => {
  it('plugin.json command is "node" (cross-platform)', () => {
    const plugin = readJSON(PLUGIN_JSON);
    expect(plugin.mcpServers.mags.command).toBe("node");
  });

  it("start.js exists", () => {
    expect(existsSync(join(SERVER_DIR, "start.js"))).toBe(true);
  });

  it("bundle file exists and is non-empty", () => {
    expect(existsSync(BUNDLE_PATH)).toBe(true);
    const stat = statSync(BUNDLE_PATH);
    expect(stat.size).toBeGreaterThan(10000);
  });

  it(".gitignore contains **/.mags/ pattern", () => {
    const gitignore = readFileSync(join(PROJECT_ROOT, ".gitignore"), "utf-8");
    expect(gitignore).toContain("**/.mags/");
  });

  it(".gitignore contains memories.db pattern", () => {
    const gitignore = readFileSync(join(PROJECT_ROOT, ".gitignore"), "utf-8");
    expect(gitignore).toContain("memories.db");
  });
});

// ── 1.7 Bundle Freshness Guard ─────────────────────

describe("Bundle Freshness Guard", () => {
  const bundleContent = readFileSync(BUNDLE_PATH, "utf-8");

  it('bundle contains require("../package.json") pattern for version SSOT', () => {
    // In minified bundle, the pattern might vary slightly
    expect(bundleContent).toContain("package.json");
  });

  it("bundle has no absolute /Users/ paths", () => {
    expect(bundleContent).not.toContain("/Users/");
  });

  it("bundle has no absolute \\Users\\ paths", () => {
    expect(bundleContent).not.toContain("\\Users\\");
  });

  it("bundle references better-sqlite3 as external", () => {
    expect(bundleContent).toContain("better-sqlite3");
  });
});
