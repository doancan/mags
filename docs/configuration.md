# Configuration

MAGS configuration file and customization options.

## .mags.yaml

Create a `.mags.yaml` file in your project root:

```yaml
docs_dir: "docs"              # Document directory (default: docs)
mags_dir: "docs/.mags"        # MAGS data directory (default: docs/.mags)
templates: "general"           # Template set (default: general)

auto_session_save: true        # Auto-save sessions (default: true)
auto_session_load: true        # Auto-load last session (default: true)

doc_validation: true           # Enable doc validation (default: true)

locale: "en"                   # Locale for templates (default: en)

architecture: "monolith"       # Project architecture type (default: monolith)

stack:                         # Tech stack (auto-detected or manual)
  primaryLanguage: "typescript"
  languages: ["typescript", "javascript"]
  frameworks: ["next.js", "nestjs"]
  databases: ["postgresql", "redis"]
  apiStyle: ["rest"]
  packageManager: "pnpm"

modules:                       # Module definitions with aliases
  - name: auth
    aliases: [auth, authentication, login, register, jwt]
  - name: crm
    aliases: [crm, customer, proposal]

customTemplatePacks:           # Additional template pack directories
  - ./my-templates
  - ./shared-templates

embedding:
  provider: "local"            # "local" (TF-IDF, offline) or "openai" (semantic)
  # openai_api_key: ""         # Required for OpenAI provider
  # openai_model: "text-embedding-3-small"
```

## Embedding Providers

### Local (Default)

Works offline, no API key required.

- **Algorithm:** TF-IDF + BM25 scoring
- **Search:** Keyword-based, across key/value/category/tags
- **Pros:** Fast, no dependencies, free
- **Cons:** Cannot capture semantic meaning

### OpenAI

For semantic similarity search.

```yaml
embedding:
  provider: "openai"
  openai_api_key: "sk-..."
  openai_model: "text-embedding-3-small"
```

- **Algorithm:** Cosine similarity on embedding vectors
- **Search:** Semantic — meaning-based similarity
- **Pros:** Searching "authentication" also finds "login" and "JWT"
- **Cons:** Requires API key and internet connection

## Architecture Types

MAGS supports 6 architecture types, each with tailored templates, default modules, and guidance rules:

| Type | Templates | Default Modules | Key Guidance |
|------|-----------|----------------|--------------|
| `monolith` | vision, discovery, prd, tech-stack, data-model, api-design, project-structure, mvp-scope, index | auth, core, api, database, frontend | Modular monolith patterns, schema-per-module, clean interfaces |
| `microservices` | Above + service-catalog, api-gateway, inter-service-comm | api-gateway, service-discovery, auth-service, messaging | Service-owned data, async communication, circuit breakers |
| `library` | vision, discovery, tech-stack, project-structure, index, api-reference, usage-guide, versioning | core, api, types, utils | Minimal public API, semver, comprehensive docs |
| `cli` | vision, discovery, tech-stack, project-structure, index, cli-design, cli-reference | commands, config, output, utils | Verb-noun pattern, interactive + CI modes, exit codes |
| `mobile` | vision, discovery, prd, tech-stack, project-structure, mvp-scope, index, screens, platform-config | navigation, auth, networking, storage, ui-components | Offline-first, platform conventions, deep linking |
| `serverless` | vision, discovery, prd, tech-stack, data-model, api-design, project-structure, index, functions, event-triggers | functions, triggers, storage, auth | Stateless & idempotent, cold start optimization, DLQs |

Set in `.mags.yaml`:

```yaml
architecture: "microservices"
```

The architecture type influences `mags_discover_modules` scan patterns, `mags_generate_claude_md` guidance rules, and `mags_scaffold_module` template selection.

## Locale / i18n

MAGS uses a locale fallback chain for template resolution:

```
locale → en → root
```

For example, with `locale: "tr"`, the template engine looks for:
1. `templates/docs/tr/vision.md`
2. `templates/docs/en/vision.md`
3. `templates/docs/vision.md`

Set in `.mags.yaml`:

```yaml
locale: "tr"   # Turkish templates
```

Default locale is `en`.

### Available Locales

| Locale | Language |
|--------|----------|
| `en` | English (default, full coverage) |
| `tr` | Turkish (full coverage) |

Other locales fall back to `en` for missing templates.

## Custom Template Packs

You can add custom template packs beyond the built-in templates. Each pack must contain a `pack.yaml` manifest:

```yaml
# pack.yaml
id: my-company-templates
name: My Company Templates
version: "1.0.0"
description: Custom templates for internal projects
templates:
  - design-review
  - security-checklist
  - onboarding
```

Template files can be `.md` or `.hbs` (Handlebars) and are organized either flat or by locale:

```
my-templates/
├── pack.yaml
├── en/
│   ├── design-review.md
│   └── security-checklist.md
└── tr/
    ├── design-review.md
    └── security-checklist.md
```

Register packs in `.mags.yaml`:

```yaml
customTemplatePacks:
  - ./my-templates
  - /absolute/path/to/pack
```

### Override Rules

Custom templates take priority over built-in templates with the same name. Resolution order:

1. Custom pack (locale-specific, e.g. `my-templates/tr/prd.md`)
2. Custom pack (default, e.g. `my-templates/prd.md`)
3. Built-in (locale-specific, e.g. `templates/docs/tr/prd.md`)
4. Built-in (english, e.g. `templates/docs/en/prd.md`)
5. Built-in (root, e.g. `templates/docs/prd.md`)

### Creating a Custom Template Pack

1. Create a directory with a `pack.yaml` manifest:
   ```yaml
   id: my-pack
   name: My Custom Templates
   version: "1.0.0"
   description: Templates for our team
   templates:
     - sprint-review
     - design-spec
   ```

2. Add template files (`.md` or `.hbs`):
   ```
   my-pack/
   ├── pack.yaml
   ├── sprint-review.md
   └── design-spec.md
   ```

3. Optionally add locale directories for multi-language support:
   ```
   my-pack/
   ├── pack.yaml
   ├── en/
   │   ├── sprint-review.md
   │   └── design-spec.md
   └── tr/
       ├── sprint-review.md
       └── design-spec.md
   ```

4. Register in `.mags.yaml`:
   ```yaml
   customTemplatePacks:
     - ./my-pack
   ```

5. Use via `/mags-docs-create sprint-review`

## Stack Configuration

The `stack` key lets you persist your detected tech stack or define it manually:

```yaml
stack:
  primaryLanguage: "typescript"
  languages: ["typescript", "javascript"]
  frameworks: ["next.js", "nestjs"]
  databases: ["postgresql", "redis"]
  apiStyle: ["rest", "graphql"]
  packageManager: "pnpm"
```

You can auto-detect your stack using the `mags_detect_stack` tool, which scans your project files and returns a YAML snippet you can paste into your config.

The stack configuration is used by:
- `mags_generate_claude_md` — generates stack-aware rules and conventions
- `mags_scaffold_module` — selects appropriate patterns for your stack
- Skills (testing-strategy, security-review, etc.) — provides stack-specific guidance

## Directory Structure

MAGS creates the following directory structure:

```
docs/
├── .mags/
│   ├── progress.yaml          # Module progress file
│   ├── memory/
│   │   └── entries/           # Memory entries (individual YAML files)
│   │       ├── {uuid}.yaml
│   │       └── ...
│   └── sessions/
│       ├── latest.yaml        # Latest session (symlink)
│       ├── 2026-01-31-001.yaml
│       └── ...
├── product/                   # Product documents
├── architecture/              # Architecture documents
└── ...                        # Project-specific documents
```

## Memory Categories

| Category | Usage | Example |
|----------|-------|---------|
| `decisions` | Architectural and technical decisions | ORM choice, auth strategy |
| `conventions` | Code standards and rules | Layered architecture, test requirements |
| `notes` | Observations and ideas | Performance notes, refactoring ideas |
| `context` | Session context | Active module, ongoing work |
| `bugs` | Bug observations | Root cause, reproduction steps |

## Module Aliases

When calling `mags_module_context`, module names are matched using aliases:

| Module | Aliases |
|--------|---------|
| auth | authentication, login, register, jwt, session |
| tenant | tenant, organization, team, invite |
| rbac | rbac, role, permission, access, guard |
| workspace | workspace |
| crm | crm, customer, proposal |
| pms | pms, project, task |
| feedback | feedback, comment, annotation |
| notification | notification |
| dashboard | dashboard, panel, widget |
| infrastructure | infrastructure, infra, turborepo, monorepo, docker |
| platform | platform, i18n, responsive, multi-tenant |
| report | report |
| storage | storage, upload, file |

Aliases are case-insensitive. You can override or extend aliases in `.mags.yaml` under the `modules` key.

## Document Frontmatter

Every markdown document should include YAML frontmatter:

```yaml
---
title: Document Title
description: One-line summary
status: draft | review | locked
created: 2025-01-30
updated: 2025-01-30
author: Name
tags: [tag1, tag2]
---
```

### Status Flow

```
draft → review → locked
  ↑       ↓
  └───────┘  (revert)
```

- **draft:** Being written, structure may change
- **review:** Complete, awaiting feedback
- **locked:** Approved, stable. Must revert to draft before editing

## Supported Document Formats

| Format | Extension | Notes |
|--------|-----------|-------|
| Markdown | `.md` | Full support, primary format |
| MDX | `.mdx` | Markdown with JSX, parsed as Markdown |
| reStructuredText | `.rst` | Parsed with dedicated parser |
| AsciiDoc | `.adoc` | Parsed with dedicated parser |

## Hooks

MAGS uses 3 automatic hooks defined in `hooks/hooks.json`. Hooks run silently in the background — if a tool call fails, the hook still returns `{"ok": true}` and the error is ignored.

### SessionStart

- **Trigger:** When a new Claude Code session begins
- **Action:** Loads project context by calling `mags_project_summary`, `mags_get_last_session`, `mags_get_progress`, and `mags_recall` (for conventions)
- **Timeout:** 30 seconds
- **Purpose:** Restores full project context so every new session picks up where the last one left off

### PreCompact

- **Trigger:** Before Claude Code compacts the context window (when the conversation gets long)
- **Action:** Calls `mags_save_session` with a brief summary of the current state
- **Timeout:** 30 seconds
- **Purpose:** Preserves session state before context is compressed, preventing loss of decisions and progress

### Stop

- **Trigger:** When Claude Code attempts to stop (session end)
- **Action:** Calls `mags_save_session` with a brief summary of what was accomplished
- **Timeout:** 30 seconds
- **Purpose:** Persists the session summary with decisions, completed items, and next steps for the following session

### Response Format

All hooks use an agent-type hook that must respond with `{"ok": true}`. This is enforced in the prompt to guarantee the hook completes without blocking the session. The tool calls are executed silently before the response is generated, and any failures are ignored to prevent hooks from disrupting the user's workflow.

### Configuration

Hooks are defined in `hooks/hooks.json` and referenced from `plugin.json` via the `"hooks"` field. The file follows the Claude Code hooks schema:

```json
{
  "hooks": {
    "<EventName>": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "agent",
            "prompt": "...",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

An empty `"matcher"` means the hook runs for all events of that type.

## Limits

| Limit | Value |
|-------|-------|
| Max memory entries | 1000 |
| Max session history | Unlimited (file-based) |
| Max document size | Unlimited (file-based) |
| Search result limit | Default 10, configurable |
| Session save parameters | `summary` required, others optional |
