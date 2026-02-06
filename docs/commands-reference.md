# Commands Reference

> **Note:** Commands have been migrated to the skill-based architecture. Each command now lives at `skills/<name>/SKILL.md` instead of the legacy `commands/` directory. For a complete reference of all 18 skills (11 slash commands + 7 auto-activating guidance skills), see [Skills Reference](./skills-reference.md).

MAGS provides 11 slash commands. Each command runs in Claude Code via `/command-name`.

## /mags-init

Initializes your project with MAGS.

**Usage:**
```
/mags-init
```

**What it does:**
1. Checks for `docs/` and `.mags/` directories
2. If existing docs are found, indexes them
3. If not, asks for project info and scaffolds documents from templates
4. Sets up `.mags/` directory (config, progress, memory)
5. Optionally offers to generate CLAUDE.md

**When to use:** When adding MAGS to a project for the first time. Only needs to run once.

---

## /mags-status

Shows a project status dashboard.

**Usage:**
```
/mags-status
```

**Displays:**
- Project name and tech stack
- Module progress bars (% completion)
- Document health (error and warning counts)
- Next step suggestions

**When to use:** At the start of a session or whenever you want to check progress.

---

## /mags-docs

List all project documents.

**Usage:**
```
/mags-docs
```

**Displays:**
- All documents in a tree structure grouped by directory
- Path and brief description for each document

**Related commands:**
| Command | Description |
|---------|-------------|
| `/mags-docs-create <template>` | Create a new document from template |
| `/mags-docs-validate` | Run document validation checks |
| `/mags-docs-search <query>` | Search across all documents |

---

## /mags-docs-create

Create a new document from a template.

**Usage:**
```
/mags-docs-create <template>
```

**Available Templates:**

| Template | What it creates |
|----------|----------------|
| `vision` | Project vision and goals |
| `discovery` | Research and competitive analysis |
| `prd` | Product requirements document |
| `tech-stack` | Technology stack decisions |
| `data-model` | Database schema document |
| `api-design` | API endpoint design |
| `project-structure` | Directory and architecture layout |
| `mvp-scope` | MVP scope definition |
| `adr` | Architecture decision record |
| `module` | New module document |
| `guide` | Usage guide |

---

## /mags-docs-validate

Run validation checks on all project documents.

**Usage:**
```
/mags-docs-validate
```

**What it checks:**
- YAML frontmatter validity
- Required sections
- Internal cross-references
- Document freshness

**Output:**
- Errors (must fix)
- Warnings (should fix)
- Health score

---

## /mags-docs-search

Search across all project documents.

**Usage:**
```
/mags-docs-search <query>
```

**Features:**
- Full-text fuzzy search
- Results ranked by relevance
- Matching excerpts with context

---

## /mags-changelog

Generates a changelog from git history.

**Usage:**
```
/mags-changelog
```

**What it does:**
1. Finds the last 30 commits and latest tag
2. Parses conventional commits
3. Groups by type (Features, Fixes, Other)
4. Asks: append to `docs/changelog/changes.md`, create release file, or skip

**Format support:**
- Keep a Changelog
- Conventional Commits

---

## /mags-setup

Analyzes your project and recommends Claude Code configuration.

**Usage:**
```
/mags-setup
```

**What it does:**
1. Detects project type (manifest files, frameworks)
2. Checks existing setup (CLAUDE.md, hooks, plugins)
3. Generates recommendations:
   - **Must Have** — Essential recommendations
   - **Recommended** — Suggested improvements
   - **Nice to Have** — Optional enhancements
4. Applies the selected recommendation

**When to use:** When first adding Claude Code to a project or optimizing your setup.

---

## /mags-legacy

Initializes MAGS for an existing (brownfield/legacy) project that already has code but lacks documentation.

**Usage:**
```
/mags-legacy
```

**What it does:**
1. **Scans the codebase** — uses `mags_detect_stack` to detect the tech stack and `mags_discover_modules` to find existing modules
2. **Gathers legacy context** — asks about migration goals, pain points, preserved areas, and target architecture
3. **Creates legacy documentation:**
   - `current-architecture` — documents the as-is architecture
   - `migration-plan` — migration plan based on goals
   - `tech-debt` — tech debt registry
   - `target-architecture` — target architecture document
   - `tech-stack` — based on detected stack
   - `project-structure` — based on discovered modules
4. **Sets up tech debt tracking** — initializes progress with discovered modules as features, pain points as tech-debt items, and migration steps

**When to use:** When adding MAGS to a project that already has a codebase but needs documentation and modernization tracking.

---

## /mags-help

Shows a quick reference of all available commands, skills, agents, and hooks.

**Usage:**
```
/mags-help
```

**Displays:**
- All 11 slash commands with brief descriptions
- 7 auto-activating skills and their triggers
- 2 agents and what they do
- 1 hook and when it fires
- Quick start steps (adapts to project state)
- Links to full documentation

**When to use:** When you want a quick overview of everything MAGS offers, or to discover a command you haven't used before.

---

## /mags-orchestrate

Orchestrates PRD-driven development: parse requirements, analyze your codebase, create execution plans, and run them step by step.

**Usage:**
```
/mags-orchestrate
```

**What it does:**
1. Asks what you want to do (PRD analysis, codebase analysis, create plan, or run plan)
2. Based on your choice:
   - **PRD Analysis** — Parses a PRD to extract features, modules, and requirements
   - **Codebase Analysis** — Scans for tech debt, endpoints, and schema
   - **Create Execution Plan** — Generates a step-by-step plan from your PRD
   - **Run / Resume Plan** — Executes or continues an existing plan
3. Shows results and suggests next steps

**When to use:** When you want to systematically implement features from a PRD, or analyze your codebase for tech debt and improvement opportunities.

**Related:** See [Orchestrator Guide](./orchestrator-guide.md) for detailed documentation.
