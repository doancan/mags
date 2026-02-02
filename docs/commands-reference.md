# Commands Reference

> **Note:** Commands have been migrated to the skill-based architecture. Each command now lives at `skills/<name>/SKILL.md` instead of the legacy `commands/` directory. For a complete reference of all 14 skills (7 slash commands + 7 auto-activating guidance skills), see [Skills Reference](./skills-reference.md).

MAGS provides 7 slash commands. Each command runs in Claude Code via `/command-name`.

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
4. Sets up `.mags/` directory (config, progress, memory, sessions)
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
- Last session summary
- Next step suggestions

**When to use:** At the start of a session or whenever you want to check progress.

---

## /mags-docs

Document management.

**Usage:**
```
/mags-docs              # List documents
/mags-docs list         # List documents
/mags-docs create prd   # Create a new document from template
/mags-docs validate     # Validate documents
/mags-docs search xyz   # Search across documents
```

### Subcommands

| Subcommand | Description |
|------------|-------------|
| `list` | Lists all documents in a tree structure |
| `create <template>` | Creates a new document from a template |
| `validate` | Runs frontmatter, section, and cross-ref checks |
| `search <query>` | Full-text fuzzy search |

### Available Templates

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

## /mags-session

Session management.

**Usage:**
```
/mags-session           # Show last session + current status
/mags-session save      # Save current session
/mags-session load      # Load last session
/mags-session history   # List all session history
```

### Subcommands

| Subcommand | Description |
|------------|-------------|
| _(empty)_ | Shows last session + current progress side by side |
| `save` | Gathers progress and memory, saves the session |
| `load` | Loads the last session and restores context |
| `history` | Lists all sessions with dates, summaries, and counts |

**Note:** Sessions are typically managed automatically by hooks. Manual save is only needed in special cases.

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
