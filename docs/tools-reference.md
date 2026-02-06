# MCP Tools Reference

MAGS provides 20 MCP tools. These tools are called automatically by Claude Code or can be triggered directly.

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

### mags_update_metadata

Updates frontmatter metadata fields of a document without changing its content body.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Document name |
| `metadata` | object | Yes | Fields to set. Use `null` to remove a field. |

**Returns:** `{ success: true, path: "...", updatedFields: [...] }`

**Example:**
```json
{
  "name": "prd",
  "metadata": {
    "status": "review",
    "tags": ["backend", "api"],
    "version": "2.0"
  }
}
```

---

### mags_reindex

Refreshes the document index. Use after adding, removing, or modifying documents outside of MAGS tools.

**No parameters.**

**Returns:**
```json
{
  "success": true,
  "changes": {
    "added": ["new-doc"],
    "removed": ["deleted-doc"],
    "updated": ["modified-doc"]
  },
  "summary": {
    "totalDocs": 15,
    "addedCount": 1,
    "removedCount": 1,
    "updatedCount": 1,
    "durationMs": 42
  }
}
```

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

### mags_promote_memory

Suggests promoting a frequently accessed or high-value memory to CLAUDE.md or project docs for permanent reference.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `key` | string | Yes | Memory key to evaluate for promotion |
| `target` | enum | Yes | Promotion target: `claude_md` or `doc` |

**Returns:**
```json
{
  "key": "auth_strategy",
  "value": "Use JWT with refresh tokens",
  "category": "decisions",
  "ageInDays": 30,
  "target": "claude_md",
  "recommendation": "Add to CLAUDE.md under a relevant section",
  "suggestedContent": "- **auth_strategy**: Use JWT with refresh tokens",
  "action": "Review the suggestion above and manually add it to the target if appropriate."
}
```

---

## Context Tools

### mags_project_summary

Comprehensive project summary.

**No parameters.**

**Returns (text):**
- Project info (from vision document)
- Document statistics
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
