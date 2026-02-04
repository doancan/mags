# MAGS — Memory And Guidance System

A Claude Code plugin that keeps your project context alive across sessions.

MAGS indexes your documentation, remembers decisions, tracks development progress, and persists session state — so every new conversation picks up exactly where the last one left off.

## Why MAGS?

Claude Code sessions are stateless. Every time you start a new conversation, you lose context: what was decided, what was built, what's next. MAGS solves this by giving Claude a persistent memory layer tied to your project.

- **No more repeating yourself** — decisions, conventions, and context carry over
- **No more lost progress** — module-level tracking with dependencies
- **No more stale docs** — validation catches drift between code and documentation
- **Zero config** — works offline with local TF-IDF, no API keys needed

## Key Features

- **Stack Detection** — automatically detects languages, frameworks, databases, API style, and package manager
- **Module Discovery** — scans your project structure to find modules with confidence scores
- **Architecture Support** — 6 architecture types (monolith, microservices, library, CLI, mobile, serverless) with tailored templates and guidance
- **Legacy/Brownfield Support** — `/mags-legacy` command for existing codebases: generates architecture docs, migration plans, and tech debt tracking
- **i18n / Locale** — template fallback chain (locale → en → root) for multi-language doc templates
- **Custom Template Packs** — add your own template packs with `pack.yaml` manifests
- **Stack-Aware CLAUDE.md** — generates project rules that reflect your actual tech stack
- **Extended Skills** — testing strategy, security review, infrastructure, and API lifecycle guidance

## Quick Start

```bash
# Add the marketplace source
claude plugin marketplace add https://github.com/doancan/mags

# Install the plugin
claude plugin install mags@mags-marketplace
```

Restart Claude Code, then inside any project:

```
/mags-init
```

That's it. MAGS will scan your `docs/` directory (or help you create one from templates), set up session persistence, and start tracking your project.

## What You Get

### Slash Commands

| Command | What it does |
|---------|-------------|
| `/mags-init` | Set up MAGS for your project — scan docs or scaffold from templates |
| `/mags-status` | Dashboard — progress bars, doc health score, next steps |
| `/mags-docs` | List, create, validate, or search your documentation |
| `/mags-session` | Save, load, or review session history |
| `/mags-changelog` | Generate a changelog from git history |
| `/mags-setup` | Analyze your project and recommend Claude Code configuration |
| `/mags-legacy` | Initialize MAGS for a legacy/brownfield project with stack detection and tech debt tracking |

### Automatic Hooks

These run silently in the background — no action needed from you:

| Event | What happens |
|-------|-------------|
| **SessionStart** | Loads project summary, last session, progress, and conventions |
| **PreCompact** | Saves session state before context window compaction |
| **Stop** | Persists a session summary with decisions and next steps |

### Skills (auto-activated)

Claude automatically uses these when relevant:

| Skill | Activates when |
|-------|---------------|
| `doc-management` | Creating or editing project documentation |
| `memory-guidance` | Storing decisions, conventions, or session context |
| `claude-md-management` | Working with CLAUDE.md project configuration |
| `testing-strategy` | Planning tests, test pyramid, coverage targets, mocking strategies |
| `security-review` | Security audits, OWASP Top 10, threat modeling, secure coding |
| `infrastructure` | DevOps, CI/CD pipelines, containerization, monitoring, deployment |
| `api-lifecycle` | API design, versioning, deprecation, rate limiting, OpenAPI/GraphQL |

### Agents

| Agent | Purpose |
|-------|---------|
| `doc-sync-validator` | Checks if documentation matches the actual code |
| `setup-recommender` | Recommends plugins, skills, and hooks for your stack |

## How It Works

```
Session starts
  → Hook loads: project summary + last session + progress + conventions

You work normally
  → Claude uses MAGS tools as needed (memory, docs, progress)

Session ends
  → Hook saves: summary, decisions, completed items, next steps

Next session starts
  → Everything is restored automatically
```

### Memory

Store decisions, conventions, and notes as key-value pairs. MAGS searches them using TF-IDF scoring (offline) or OpenAI embeddings (optional).

```
"We're using JWT with refresh tokens for auth, remember this"
→ mags_remember is called automatically
```

Categories: `decisions`, `conventions`, `notes`, `context`, `bugs`

### Documents

MAGS indexes your `docs/` directory — parses YAML frontmatter, extracts section headings, and builds a fuzzy search index. Supports `.md`, `.mdx`, `.rst`, and `.adoc`.

### Progress Tracking

Module-based progress with items, dependencies, and priorities. Status flows: `not_started` → `in_progress` → `completed` (or `blocked`).

When all items in a module are completed, the module auto-completes. `mags_get_next` recommends what to work on based on dependencies.

## MCP Tools (36 tools)

### Documents
| Tool | Description |
|------|-------------|
| `mags_list_docs` | List all indexed documents with metadata |
| `mags_get_doc` | Read a document, optionally a specific section |
| `mags_update_doc` | Update a document section |
| `mags_search_docs` | Full-text fuzzy search across all docs |
| `mags_create_doc` | Create a new document from a template |
| `mags_reindex` | Reindex all documents (useful after external changes) |

### Memory
| Tool | Description |
|------|-------------|
| `mags_remember` | Store a key-value memory entry with category and tags |
| `mags_recall` | Search memories by keyword or semantically |
| `mags_forget` | Delete a memory entry |
| `mags_promote_memory` | Suggest promoting frequently used memory to CLAUDE.md |

### Progress
| Tool | Description |
|------|-------------|
| `mags_init_progress` | Initialize modules with items, dependencies, and priorities |
| `mags_get_progress` | Get overall or per-module progress |
| `mags_update_progress` | Update module/item status |
| `mags_get_next` | Get next recommended work items |

### Context
| Tool | Description |
|------|-------------|
| `mags_project_summary` | Full project context for session start |
| `mags_module_context` | Deep context for a module (PRD + data model + API + progress) |

### Stack & Discovery
| Tool | Description |
|------|-------------|
| `mags_detect_stack` | Detect project tech stack (languages, frameworks, databases, API style) |
| `mags_discover_modules` | Discover modules by scanning directory structure |

### Validation & Generation
| Tool | Description |
|------|-------------|
| `mags_validate_docs` | Check frontmatter, sections, cross-refs, quality score; `deep` mode adds version, memory, ADR, and module consistency checks |
| `mags_generate_claude_md` | Generate CLAUDE.md from project docs (stack-aware) |
| `mags_audit_claude_md` | Audit existing CLAUDE.md for completeness |
| `mags_generate_changelog` | Generate changelog from conventional commits |
| `mags_scaffold_module` | Generate doc templates for a new module |

### Sessions
| Tool | Description |
|------|-------------|
| `mags_save_session` | Save session with summary, decisions, next steps |
| `mags_get_last_session` | Load the most recent session |
| `mags_list_sessions` | List session history |

### Orchestration (Advanced)
| Tool | Description |
|------|-------------|
| `mags_parse_prd` | Parse PRD document to extract features, modules, and requirements |
| `mags_generate_skill` | Generate a skill definition from PRD content |
| `mags_generate_agent` | Generate an agent definition from PRD content |
| `mags_analyze_codebase` | Analyze codebase for tech debt, endpoints, and schema |
| `mags_init_execution` | Initialize execution plan from parsed PRD |
| `mags_execute_step` | Execute the next step in the execution plan |
| `mags_get_current_step` | Get the current step in execution |
| `mags_get_execution_status` | Get overall execution status and progress |
| `mags_resume_execution` | Resume paused or failed execution |
| `mags_verify_module` | Verify module implementation against requirements |

## Document Templates

Create project docs from built-in templates:

| Template | Purpose |
|----------|---------|
| `vision` | Project vision and goals |
| `discovery` | Research and competitive analysis |
| `prd` | Product requirements document |
| `tech-stack` | Technology stack decisions |
| `data-model` | Database schema and relationships |
| `api-design` | API endpoints and contracts |
| `project-structure` | Directory and architecture layout |
| `mvp-scope` | MVP feature scope and priorities |
| `adr` | Architecture decision record |
| `module` | New module documentation |
| `guide` | Usage guide |
| `current-architecture` | As-is architecture (legacy projects) |
| `migration-plan` | Migration plan (legacy projects) |
| `tech-debt` | Tech debt registry (legacy projects) |
| `target-architecture` | Target architecture (legacy projects) |

Architecture-specific templates are also available (e.g. `service-catalog`, `api-gateway`, `cli-design`, `screens`). See [Configuration — Architecture Types](./docs/configuration.md#architecture-types).

```
/mags-docs create prd
```

## Configuration

MAGS works with zero configuration. Optionally create `.mags.yaml` in your project root:

```yaml
docs_dir: "docs"
mags_dir: "docs/.mags"
templates: "general"

auto_session_save: true
auto_session_load: true
doc_validation: true

locale: "en"                  # Template locale (fallback: en → root)
architecture: "monolith"      # monolith | microservices | library | cli | mobile | serverless

stack:                        # Auto-detected or manual
  primaryLanguage: "typescript"
  languages: ["typescript", "javascript"]
  frameworks: ["next.js", "nestjs"]
  databases: ["postgresql"]
  apiStyle: ["rest"]
  packageManager: "pnpm"

modules:                      # Module aliases for context lookups
  - name: auth
    aliases: [auth, authentication, login]

customTemplatePacks:          # Custom template pack directories
  - ./my-templates

embedding:
  provider: "local"           # "local" (TF-IDF, offline) or "openai" (semantic)
  # openai_api_key: ""        # Required if provider is "openai"
  # openai_model: "text-embedding-3-small"
```

## Project Structure

```
mags/
├── .claude-plugin/
│   └── plugin.json           # Plugin manifest (includes MCP server config)
├── server/                   # MCP server (TypeScript)
│   ├── src/
│   │   ├── index.ts          # Entry point
│   │   ├── config/           # Configuration loading
│   │   ├── services/         # Core services (15+)
│   │   │   ├── doc-indexer.ts
│   │   │   ├── doc-parser.ts
│   │   │   ├── memory-store.ts
│   │   │   ├── progress-manager.ts
│   │   │   ├── session-manager.ts
│   │   │   ├── search-engine.ts
│   │   │   ├── template-engine.ts
│   │   │   ├── template-pack-loader.ts
│   │   │   ├── stack-detector.ts
│   │   │   ├── module-discoverer.ts
│   │   │   ├── architecture-adapter.ts
│   │   │   ├── claude-md-rules.ts
│   │   │   ├── consistency-checker.ts
│   │   │   └── embedding/    # Pluggable embedding providers
│   │   ├── tools/            # MCP tool registrations (36 tools)
│   │   └── types/            # TypeScript type definitions
│   └── dist/
│       └── mags-server.bundle.mjs  # Pre-built bundle (no build step needed)
├── skills/                   # 14 skills (7 guidance + 7 slash commands)
├── agents/                   # 2 specialized agents
├── hooks/                    # 3 event-driven hooks
└── templates/                # Document and project templates
```

## Documentation

- [Getting Started](./docs/getting-started.md) — Installation, first use, core concepts
- [Skills Reference](./docs/skills-reference.md) — All 14 skills (7 slash commands + 7 guidance)
- [Commands Reference](./docs/commands-reference.md) — All 7 slash commands in detail
- [MCP Tools Reference](./docs/tools-reference.md) — All 36 MCP tools with parameters
- [Orchestrator Guide](./docs/orchestrator-guide.md) — PRD-driven development and code analysis
- [Workflows](./docs/workflows.md) — Common usage scenarios and patterns
- [Configuration](./docs/configuration.md) — Settings, embedding providers, customization

## Requirements

- Node.js 18+
- Claude Code with plugin support

## Development

```bash
cd server
npm install
npm run dev        # Watch mode with tsx
npm run build      # TypeScript compilation
npm run bundle     # Create single-file bundle
npm run typecheck  # Type check without emitting
npm test           # Run all tests
npm run test:cov   # Run tests with coverage
```

## License

MIT
