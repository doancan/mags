# Contributing to MAGS

## SSOT (Single Source of Truth) Rules

MAGS follows strict SSOT principles to avoid drift between components:

- **Templates are canonical.** The `templates/` directory is the source of truth for all document templates. Never duplicate template content into skills, docs, or other locations.
- **`hooks.json` is the hook SSOT.** All hook definitions live in `hooks/hooks.json`. README and docs describe hooks but the JSON file is authoritative.
- **`plugin.json` is the plugin manifest SSOT.** Located at `.claude-plugin/plugin.json`, it defines the plugin name, version, MCP server config, and skill/agent/hook paths.
- **Skills define their own metadata.** Each skill's frontmatter (name, description, version, user-invocable, allowed-tools) is the SSOT for that skill's configuration.

## Service Architecture

The MCP server (`server/src/`) contains 15+ core services organized in layers:

### Core Services

| Service | File | Responsibility |
|---------|------|----------------|
| Doc Indexer | `doc-indexer.ts` | Indexes markdown files from `docs/` directory |
| Doc Parser | `doc-parser.ts` | Parses YAML frontmatter, sections, and content from documents |
| Memory Store | `memory-store.ts` | Key-value memory storage with categories and tags |
| Progress Manager | `progress-manager.ts` | Module and item progress tracking with dependencies |
| Search Engine | `search-engine.ts` | TF-IDF / BM25 full-text search across docs and memory |
| Template Engine | `template-engine.ts` | Handlebars template rendering with variable substitution |
| Template Pack Loader | `template-pack-loader.ts` | Loads custom template packs from `pack.yaml` manifests |
| Stack Detector | `stack-detector.ts` | Detects project tech stack by scanning manifest files |
| Module Discoverer | `module-discoverer.ts` | Discovers project modules by scanning directory structure |
| Architecture Adapter | `architecture-adapter.ts` | Provides architecture-specific templates and guidance rules |
| Claude MD Rules | `claude-md-rules.ts` | Generates stack-aware rules for CLAUDE.md |
| Consistency Checker | `consistency-checker.ts` | Validates code-documentation drift and deep consistency |

### Embedding Providers

| Provider | File | Responsibility |
|----------|------|----------------|
| Local Embedding | `embedding/local.ts` | TF-IDF based offline semantic search |
| OpenAI Embedding | `embedding/openai.ts` | OpenAI API-based semantic embeddings |

### Orchestrator Subsystem

The orchestrator (`services/orchestrator/`) provides advanced project management:

| Service | File | Responsibility |
|---------|------|----------------|
| Project Orchestrator | `index.ts` | Coordinates PRD parsing, skill generation, and execution |
| PRD Parser | `prd-parser.ts` | Extracts features, modules, and requirements from PRD |
| Skill Generator | `skill-generator.ts` | Auto-generates skills from PRD requirements |
| Agent Generator | `agent-generator.ts` | Generates agent definitions from PRD |
| Plan Executor | `plan-executor.ts` | Executes implementation plans step-by-step |
| Code Analyzer | `code-analyzer.ts` | Analyzes codebase for tech debt, endpoints, schema |
| TDD Engine | `tdd-engine.ts` | Runs test suites and verifies coverage |

Tools are registered in `server/src/tools/` (34 MCP tools total). Each tool file maps to one or more services.

## Adding a New MCP Tool

1. Create a new file in `server/src/tools/` (or add to an existing file if the tool belongs to an existing group).
2. Register the tool with `server.tool()` providing name, description, input schema (Zod), and handler function.
3. Import and use the relevant service(s) in the handler.
4. Add tests in `server/src/__tests__/`.
5. Run `cd server && npm run build` to rebuild the bundle.
6. Update `docs/tools-reference.md` with the new tool's name, description, and parameters.
7. Update README.md tool count and table if applicable.

## Adding a New Skill

Skills live in `skills/<name>/SKILL.md`. There are two types:

### Slash Command (user-invocable)

1. Create `skills/<name>/SKILL.md`.
2. Add frontmatter with required fields:
   ```yaml
   ---
   name: <name>
   description: <one-line description>
   version: 1.0.0
   user-invocable: true
   allowed-tools:
     - <tool1>
     - <tool2>
   ---
   ```
3. Optionally add `argument-hint: "[subcommand|args]"` for commands with arguments.
4. Write the skill body with clear step-by-step instructions.
5. Update `docs/skills-reference.md` with the new skill.
6. Update `docs/commands-reference.md` if it is a slash command.

### Auto-Activating Skill (guidance)

1. Create `skills/<name>/SKILL.md`.
2. Add frontmatter:
   ```yaml
   ---
   name: <name>
   description: <description including trigger keywords>
   version: 1.0.0
   user-invocable: false
   ---
   ```
3. Write comprehensive guidance in the body. Include rules, patterns, examples, and anti-patterns.
4. Update `docs/skills-reference.md` with triggers and guidance summary.

## Adding Templates

### Document Templates

Document templates live in `templates/docs/`. The locale fallback chain is:

```
templates/docs/{locale}/{template}.md → templates/docs/en/{template}.md → templates/docs/{template}.md
```

1. Create the template file with Handlebars `{{variable}}` placeholders.
2. Add YAML frontmatter with `title`, `version`, `status`, `author`, `last_updated`, `tags`.
3. Follow the structure of existing templates in the same category.

### Stack Templates

Stack-specific templates live in `templates/docs/en/stacks/<stack>/`:

```
templates/docs/en/stacks/
├── python/
│   ├── tech-stack.md
│   ├── project-structure.md
│   └── api-design.md
├── typescript/
│   ├── tech-stack.md
│   ├── project-structure.md
│   └── api-design.md
└── ...
```

Each stack should have at minimum: `tech-stack.md`, `project-structure.md`, and `api-design.md`.

### Custom Template Packs

External template packs require a `pack.yaml` manifest:

```yaml
id: my-pack
name: My Template Pack
version: "1.0.0"
description: Custom templates
templates:
  - template-name-1
  - template-name-2
```

## Development Environment Setup

```bash
# Clone the repository
git clone https://github.com/doancan/mags.git
cd mags

# Install server dependencies
cd server
npm install

# Development mode (watch + auto-restart)
npm run dev

# Type checking
npm run typecheck

# Run tests
npm test

# Build production bundle
npm run build
```

### Prerequisites

- Node.js 18+
- npm 9+

## Build Process

### When to Rebuild

The MCP server ships as a pre-built bundle at `server/dist/mags-server.bundle.mjs`. You need to rebuild when:

- **Server source code changes** — any change in `server/src/**/*.ts`
- **Adding or modifying MCP tools** — changes to `server/src/tools/`
- **Service logic changes** — changes to `server/src/services/`
- **Type definition changes** — changes to `server/src/types/`

### When NOT to Rebuild

These changes do NOT require a rebuild:

- **Skill changes** — `skills/**/*.md` are read at runtime by Claude Code
- **Hook changes** — `hooks/hooks.json` is read at runtime
- **Template changes** — `templates/**` are read at runtime by the MCP server
- **Agent changes** — `agents/*.md` are read at runtime
- **Documentation changes** — `docs/**` are read at runtime
- **Plugin manifest changes** — `.claude-plugin/plugin.json` is read at startup

### Build Command

```bash
cd server && npm run build
```

This runs TypeScript compilation and bundles everything into a single `.mjs` file.

## Testing

```bash
cd server

# Run all tests
npm test

# Run tests in watch mode
npm run test -- --watch

# Run specific test file
npm test -- --grep "stack-detector"
```

All tests must pass before submitting changes. The test suite covers services, tools, and edge cases.
