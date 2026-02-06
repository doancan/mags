# MCP Tools Reference

MAGS provides 37 MCP tools. These tools are called automatically by Claude Code or can be triggered directly.

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

---

## Orchestration Tools (Advanced)

These tools provide advanced project orchestration capabilities for PRD-driven development.

### mags_parse_prd

Parses a PRD document and extracts a plan with modules, features, and dependencies.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prdPath` | string | Yes | Path to PRD markdown file |
| `validateOnly` | boolean | No | Only validate, don't extract plan |

**Returns (parse):**
```json
{
  "success": true,
  "project": "my-project",
  "totalModules": 5,
  "totalFeatures": 23,
  "phases": 3,
  "modules": [
    { "id": "auth", "name": "auth", "features": 5, "priority": 1, "phase": 1, "dependencies": [] }
  ],
  "dependencyGraph": { "auth": [], "api": ["auth"] }
}
```

**Returns (validateOnly):**
```json
{
  "valid": true,
  "errors": [],
  "warnings": ["Missing optional field: team"]
}
```

---

### mags_analyze_codebase

Deep analysis of existing codebase. Discovers modules, endpoints, tables, patterns, and tech debt.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectRoot` | string | No | Project root directory (default: current) |
| `generateReversePrd` | boolean | No | Also generate reverse PRD from code |

**Returns:**
```json
{
  "success": true,
  "projectName": "my-app",
  "stack": { "languages": ["typescript"], "frameworks": ["nestjs"] },
  "modules": [
    { "name": "auth", "confidence": 95, "endpoints": 8, "files": 12 }
  ],
  "totalEndpoints": 45,
  "totalTables": 12,
  "techDebtItems": 8,
  "testCoverage": { "lines": 78, "branches": 65 },
  "patterns": ["repository", "service-layer", "dto"]
}
```

---

### mags_generate_skill

Generates a development skill for a module based on PRD requirements.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `moduleName` | string | Yes | Module name to generate skill for |
| `prdPath` | string | Yes | Path to PRD file |

**Returns:**
```json
{
  "success": true,
  "skill": {
    "name": "auth-development",
    "path": "skills/auth-development/SKILL.md",
    "features": ["login", "logout", "register"],
    "contentPreview": "---\nname: auth-development\n..."
  },
  "fullContent": "..."
}
```

---

### mags_generate_agent

Generates a builder agent for a module based on PRD requirements.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `moduleName` | string | Yes | Module name to generate agent for |
| `prdPath` | string | Yes | Path to PRD file |

**Returns:**
```json
{
  "success": true,
  "agent": {
    "name": "auth-builder",
    "path": "agents/auth-builder.md",
    "type": "module-builder",
    "contentPreview": "---\nname: auth-builder\n..."
  },
  "fullContent": "..."
}
```

---

### mags_init_execution

Initializes plan execution from a PRD. Creates execution state and step sequence.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prdPath` | string | Yes | Path to PRD file |
| `moduleType` | enum | No | Type of modules: `backend` or `frontend` |

**Returns:**
```json
{
  "success": true,
  "initialized": true,
  "totalSteps": 45,
  "modules": ["auth", "api", "database"],
  "firstStep": {
    "step": 1,
    "title": "Create auth module structure",
    "description": "..."
  }
}
```

---

### mags_execute_step

Executes an action on the current step.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `action` | string | Yes | Action shortcut: `a` (approve), `s` (skip), `r` (retry), `q` (quit), `n` (next), `p` (previous) |

**Returns:**
```json
{
  "success": true,
  "message": "Step approved",
  "nextStep": { "step": 2, "title": "Implement login endpoint" },
  "status": { "progress": 5, "currentStep": 2, "totalSteps": 45 }
}
```

---

### mags_get_current_step

Gets the current execution step details and available actions.

**No parameters.**

**Returns:**
```json
{
  "hasStep": true,
  "step": 5,
  "totalSteps": 45,
  "title": "Implement JWT middleware",
  "description": "Create authentication middleware using JWT",
  "file": "src/middleware/auth.ts",
  "actions": ["approve", "skip", "retry", "quit"],
  "shortcuts": { "a": "approve", "s": "skip", "r": "retry", "q": "quit", "d": "details" },
  "progress": { "status": "in_progress", "progress": 11 }
}
```

---

### mags_get_execution_status

Gets current execution status and progress.

**No parameters.**

**Returns:**
```json
{
  "hasState": true,
  "status": "in_progress",
  "progress": "25%",
  "currentModule": "auth",
  "currentStep": 12,
  "totalSteps": 45,
  "completedModules": ["database"],
  "completedSteps": 11,
  "pendingSteps": 34,
  "errors": 0,
  "blockers": 0
}
```

---

### mags_resume_execution

Resumes execution from saved state.

**No parameters.**

**Returns:**
```json
{
  "success": true,
  "resumed": true,
  "status": "in_progress",
  "currentStep": 12,
  "currentModule": "auth",
  "nextPrompt": "Continue with: Implement JWT middleware"
}
```

---

### mags_verify_module

Runs TDD verification for a module. Checks tests, coverage, and acceptance criteria.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `moduleName` | string | Yes | Module name to verify |
| `prdPath` | string | No | Path to PRD file for acceptance criteria |

**Returns (quick verify):**
```json
{
  "success": true,
  "module": "auth",
  "passed": 25,
  "total": 28,
  "failed": 3,
  "errors": ["Test timeout in login.test.ts"]
}
```

**Returns (full verify with PRD):**
```json
{
  "success": true,
  "module": "auth",
  "status": "partial",
  "meetsRequirements": false,
  "reasons": ["Coverage below 80%", "2 acceptance criteria not met"],
  "coverage": 72,
  "tests": { "passed": 25, "failed": 3, "total": 28 },
  "acceptance": { "met": 8, "total": 10 },
  "formatted": "## Verification Report\n..."
}
