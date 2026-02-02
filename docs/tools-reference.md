# MCP Tools Reference

MAGS provides 24 MCP tools. These tools are called automatically by Claude Code or can be triggered directly.

## Document Tools

### mags_list_docs

Lists all indexed documents.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | string | No | Filter: `all`, `draft`, `locked`, `review` |

**Returns:** `{ docs: [...], total: number }`

Each document includes: `name`, `path`, `title`, `status`, `lastUpdated`, `wordCount`, `sections`

---

### mags_get_doc

Reads a specific document.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Document name (without extension) or relative path |
| `section` | string | No | Specific section heading to extract |

**Returns:** Document metadata + content (full or section only)

---

### mags_update_doc

Updates a specific section of a document.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Document name |
| `section` | string | Yes | Section heading to update |
| `content` | string | Yes | New section content |

Frontmatter `last_updated` is automatically updated.

---

### mags_search_docs

Full-text fuzzy search across all documents.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Search query |
| `limit` | number | No | Max results (default 10) |

---

### mags_create_doc

Creates a new document from a template.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `template` | string | Yes | Template name (vision, prd, tech-stack, etc.) |
| `variables` | object | No | Handlebars template variables |
| `path` | string | No | Custom output path (relative to docs/) |

---

## Memory Tools

### mags_remember

Stores a key-value pair as a memory entry.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `key` | string | Yes | Unique key (e.g. `auth-strategy`) |
| `value` | string | Yes | Content to store |
| `category` | string | No | `decisions`, `conventions`, `notes`, `context`, `bugs` |
| `tags` | string[] | No | Filtering tags |

**Returns:** `{ stored: true, id, key, category }`

Calling with the same key updates the existing entry.

---

### mags_recall

Searches stored memory entries.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | No | Search query. If empty, returns all entries in the given category |
| `category` | string | No | Category filter |
| `limit` | number | No | Max results (default 10) |

**Search modes:**
- **With embedding provider:** Semantic similarity search
- **Without (default):** Keyword-based scoring across key, value, category, and tags
- **Empty query + category:** Returns all entries in that category

---

### mags_forget

Deletes a memory entry by key.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `key` | string | Yes | Key of the entry to delete |

---

## Progress Tools

### mags_init_progress

Initializes project modules for progress tracking.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project` | string | Yes | Project name |
| `phase` | number | No | Current phase (default 1) |
| `modules` | array | Yes | Module list (see structure below) |

**Module structure:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | string | — | Module name |
| `status` | enum | `not_started` | Status |
| `phase` | number | (parent phase) | Phase number |
| `priority` | number | 1 | Priority (lower = higher) |
| `dependsOn` | string[] | [] | Dependencies |
| `items` | array | [] | Sub-items: `{ name, status }` |

**Returns:** `{ initialized: true, project, phase, modules, totalItems }`

---

### mags_get_progress

Gets project progress.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `module` | string | No | Specific module name |

If no module is specified, returns all progress. If a module is specified, returns only that module.

Each module includes an automatically calculated `completionPercent` (completed items / total items).

---

### mags_update_progress

Updates module or item status.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `module` | string | Yes | Module name |
| `item` | string | No | Item name (if omitted, updates the module status) |
| `status` | enum | Yes | `not_started`, `in_progress`, `completed`, `blocked` |
| `notes` | string | No | Note |

**Automatic status calculation:**
- All items `completed` → module becomes `completed`
- Any item `in_progress` → module becomes `in_progress`
- All remaining items `blocked` → module becomes `blocked`

---

### mags_get_next

Recommends next actionable items based on dependencies.

**No parameters.**

Logic:
1. Filters out modules whose dependencies are not yet completed
2. Sorts remaining modules by priority
3. Returns `not_started` or `in_progress` items from each module

---

## Context Tools

### mags_project_summary

Comprehensive project summary for session start.

**No parameters.**

**Returns (text):**
- Project info (from vision document)
- Document statistics
- Progress status (phase, completed/active modules)
- Last session summary
- Recent decisions (max 5)

---

### mags_module_context

Gathers all context for a specific module.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `module` | string | Yes | Module name |

**Returns (text):**
- Relevant PRD section
- Data model tables
- API endpoints
- Project structure
- Progress status
- Related memory entries

**Alias support:** `auth` matches `authentication`, `login`, `register`, etc. See the [module aliases table](./configuration.md#module-aliases) for the full list.

---

## Stack & Discovery Tools

### mags_detect_stack

Detects the project's tech stack by scanning project files.

**No parameters.**

**Returns:**
```json
{
  "detected": true,
  "stack": {
    "languages": ["typescript", "javascript"],
    "frameworks": ["next.js", "nestjs"],
    "databases": ["postgresql", "redis"],
    "apiStyle": ["rest"],
    "packageManager": "pnpm"
  },
  "suggestion": "Add this to your .mags.yaml under the 'stack' key to persist the detection.",
  "yamlSnippet": "stack:\n  primaryLanguage: \"typescript\"\n  ..."
}
```

**Detection covers:**
- Languages: TypeScript/JavaScript, Python, Go, Rust, Java
- Frameworks: Next.js, React, Vue, Angular, NestJS, Express, Fastify, Django, FastAPI, Flask, Gin, Echo, Actix, Axum, Spring Boot, and more
- Databases: PostgreSQL, MySQL, SQLite, MongoDB, Redis
- API styles: REST, GraphQL, gRPC, Event-driven
- Package managers: npm, yarn, pnpm, bun, pip, poetry, go modules, cargo

---

### mags_discover_modules

Discovers modules in the project by scanning the directory structure.

**No parameters.**

**Returns:**
```json
{
  "discovered": true,
  "count": 5,
  "modules": [
    { "name": "auth", "path": "src/modules/auth", "confidence": 95 }
  ],
  "yamlSuggestion": "modules:\n  - name: auth\n    aliases: [auth]"
}
```

Scan patterns vary by architecture type:
- **Monolith:** `src/modules`, `src/features`, `src/domains`, `src/app`, `lib`
- **Microservices:** `services`, `apps`, `packages`, `microservices`
- **Library:** `lib`, `src`, `packages`
- **CLI:** `commands`, `cli`, `src/commands`

---

## Validation Tools

### mags_validate_docs

Validates all documents. Supports shallow (default) and deep validation modes.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `deep` | boolean | No | `false` | Enable deep cross-document consistency checks |

**Shallow checks (always run):**
- Frontmatter: presence of title, status, last_updated
- Content: empty sections, TODO/FIXME markers, short documents
- Cross-references: broken markdown links

**Deep checks (when `deep: true`):**
- **Version conflicts:** detects major version mismatches across documents and against package.json/pyproject.toml/go.mod
- **Memory-document consistency:** flags contradictions between stored decisions and documentation (e.g., memory says "JWT" but doc says "session-based")
- **Frontmatter schemas:** enforces required fields per document type (ADR requires title, status, last_updated)
- **ADR structure:** checks for required sections (Status, Context, Decision, Consequences — supports both EN and TR headings)
- **Module completeness:** verifies that tracked modules appear in PRD, data-model, and API design documents

**Returns:**
```json
{
  "issues": [{ "type": "...", "doc": "...", "detail": "...", "severity": "error|warning|info" }],
  "score": 85,
  "summary": { "errors": 0, "warnings": 3, "info": 2, "docsChecked": 18, "deepValidation": false }
}
```

**Issue types (shallow):** `missing_frontmatter`, `empty_section`, `placeholder`, `too_short`, `broken_link`

**Issue types (deep):** `version_conflict`, `version_drift`, `memory_doc_conflict`, `frontmatter_missing`, `invalid_status`, `adr_missing_section`, `adr_invalid_status`, `module_incomplete`

**Score formula:** `100 - (errors × 15 + warnings × 2 + info × 0.5) / docsChecked`

---

## Generation Tools

### mags_generate_claude_md

Generates a CLAUDE.md file from project documentation.

**No parameters.** Reads vision, tech-stack, project-structure, and ADR documents to generate the file. When stack configuration is present, generates stack-aware rules and conventions.

---

### mags_audit_claude_md

Audits the existing CLAUDE.md file.

**No parameters.**

**Returns:** `{ exists, wordCount, score, issues, suggestions }`

Checks: tech stack references, module map, document references, coding rules, length.

---

### mags_generate_changelog

Generates a changelog from git commit history.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `from` | string | No | Start commit/tag |
| `to` | string | No | End commit (default HEAD) |
| `format` | enum | No | `keep` or `conventional` |

---

### mags_scaffold_module

Generates documentation templates for a new module.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `module` | string | Yes | Module name |
| `description` | string | Yes | Brief description |
| `type` | enum | No | `backend`, `frontend`, `fullstack` (default) |

Generated templates: PRD section, data model tables, API endpoints, frontend structure.

---

## Session Tools

### mags_save_session

Saves the current session.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `summary` | string | Yes | Session summary |
| `decisions` | string[] | No | Decisions made |
| `completed` | string[] | No | Completed items |
| `nextSteps` | string[] | No | Next steps |
| `blockers` | string[] | No | Blockers |

**Returns:** `{ saved: true, sessionId, date }`

---

### mags_get_last_session

Gets the most recent session.

**No parameters.** Returns an info message if no session exists.

---

### mags_list_sessions

Lists session history.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | number | No | Max results (default 10) |
