# Workflows

Common usage scenarios and workflows for MAGS.

## 1. New Project Setup

Full setup for a project starting from scratch.

```
1. /mags-init
   → Enter project info
   → Document templates created

2. Fill in documents
   → vision.md, prd.md, tech-stack.md, data-model.md, api-design.md
   → Have Claude write the content for you

3. Record decisions
   → mags_remember for architectural decisions
   → Record conventions

4. /mags-status
   → Verify everything is set up correctly
```

---

## 2. Adding MAGS to an Existing Project

Integrating MAGS into a project that already has documentation.

```
1. /mags-init
   → Existing docs/ is indexed

2. /mags-docs validate
   → Check document quality
   → Fix any gaps

3. Transfer decisions to memory
   → "We use Drizzle as our ORM, remember this"
   → "Backend uses a 3-layer architecture, remember this"

4. Create or update CLAUDE.md
   → /mags-setup for recommendations
```

---

## 3. Daily Development Flow

The recurring flow for each session. Hooks automate most of it.

```
Session starts
  ↓ (SessionStart hook)
  → project_summary loaded
  → conventions loaded

Focus on a module
  ↓
  → mags_module_context("auth")
  → PRD + data model + API displayed

Develop
  ↓
  → Write code
  → Save important decisions to memory
```

---

## 4. Module Development (Detailed)

End-to-end development of a single module.

```
1. Load context
   → mags_module_context("{module}")
   → Relevant PRD, data model, API

2. Check decisions and conventions
   → mags_recall("{module}")

3. Develop
   → Write code, make decisions

4. Record decisions
   → mags_remember(key, value, "decisions", tags)
```

---

## 5. Code Review & Doc Synchronization

Checking that code changes are reflected in documentation.

```
1. /mags-docs validate
   → Check document health

2. Invoke the doc-sync-validator agent
   → Checks code-documentation consistency
   → Reports missing endpoints, tables, modules

3. Fix findings
   → mags_update_doc to update documents
   → mags_scaffold_module for new modules
```

---

## 6. Release Preparation

Before releasing a new version.

```
1. /mags-status
   → Check all module statuses
   → Resolve blockers

2. /mags-docs validate
   → Document health should be 80+

3. /mags-changelog
   → Generate changelog from git history
   → Create release file

```

---

## 7. Memory Management

Keeping the project knowledge base healthy.

### Recording Decisions
```
"We used JWT + refresh token strategy, remember this"
→ mags_remember("auth-strategy", "JWT access + refresh token. Access 15min, refresh 7 days.", "decisions", ["auth", "security"])
```

### Recording Conventions
```
"Every endpoint must have tenant isolation, save this as a convention"
→ mags_remember("tenant-isolation", "Every DB query must include tenant_id filter...", "conventions", ["backend", "security"])
```

### Cleaning Up Old Entries
```
mags_recall("", "context")
→ List old context entries
→ Delete unnecessary ones with mags_forget
```

### Moving Mature Notes to Documents
```
mags_recall("", "notes")
→ Find notes that have matured
→ Add to the relevant document
→ Delete from memory
```

---

## 8. Multi-Session Project

Context continuity for long-running projects via memory.

```
Session 1: Planning
  → Documents created
  → Decisions saved to memory

Session 2: Auth module
  → Project summary auto-loaded
  → Auth context loaded
  → Development done
  → Decisions remembered

Session 3: Tenant module
  → Project summary auto-loaded
  → Switch to tenant
  → ...
```

Each session:
- **Loaded:** Project summary + conventions (automatic via hook)
- **Persisted:** Decisions and conventions via `mags_remember` (throughout session)

---

## 9. Microservices Project

Setting up and managing a microservices architecture.

```
1. Configure architecture
   → In .mags.yaml:
     architecture: "microservices"
     stack:
       primaryLanguage: "typescript"
       frameworks: ["nestjs"]
       apiStyle: ["rest", "grpc"]

2. /mags-init
   → Microservices-specific templates created
   → Additional templates: service-catalog, api-gateway, inter-service-comm

3. Per-service development
   → mags_module_context("{service-name}")
   → Each service gets its own PRD section, data model, API design

4. Cross-service concerns
   → Use memory for shared decisions ("Event bus uses RabbitMQ")
   → Document inter-service communication patterns
   → API gateway configuration tracked as a module
```

---

## 10. Legacy/Brownfield Project

Documenting and modernizing an existing codebase.

```
1. /mags-legacy
   → Automatic stack detection
   → Module discovery with confidence scores
   → Gather migration goals and pain points

2. Review generated documents
   → current-architecture.md — verify accuracy
   → tech-debt.md — prioritize items
   → migration-plan.md — adjust timeline

3. Plan modernization
   → target-architecture.md guides decisions
   → Decisions recorded in memory for consistency

4. Incremental migration
   → Work module by module
   → Update current-architecture.md as changes land
   → Record migration decisions in memory
```

---

## 11. Architecture-Specific Setup

MAGS tailors its behavior based on the configured architecture type.

| Architecture | Key Templates | Focus Areas |
|-------------|--------------|-------------|
| `monolith` | prd, data-model, api-design, mvp-scope | Modular boundaries, shared DB, clean interfaces |
| `microservices` | service-catalog, api-gateway, inter-service-comm | Service ownership, async messaging, circuit breakers |
| `library` | api-reference, usage-guide, versioning | Public API surface, semver, examples |
| `cli` | cli-design, cli-reference | Command patterns, interactive/CI modes, exit codes |
| `mobile` | screens, platform-config | Offline-first, platform conventions, deep linking |
| `serverless` | functions, event-triggers | Stateless design, cold starts, DLQ patterns |

To set up:

```yaml
# .mags.yaml
architecture: "library"   # or any of the 6 types
```

Then run `/mags-init` — MAGS will use the architecture-specific template set and guidance rules.

---

## Hooks

MAGS runs 1 automatic hook:

| Hook | Trigger | What it does |
|------|---------|-------------|
| **SessionStart** | Session start | Loads project_summary |

The hook runs silently — if it fails, it is skipped without error.

---

## Troubleshooting

### MCP Connection Issues

If tools are not available or return errors:

```bash
# Check MCP server status
claude mcp list
# → plugin:mags:mags  ✓ Connected

# If disconnected, restart Claude Code
# The MCP server is bundled — no manual start needed
```

### Validation Problems

If `mags_validate_docs` reports unexpected errors:

- **Missing frontmatter:** Add `title` and `status` fields to document frontmatter
- **Empty sections:** Fill in placeholder sections or remove them
- **Broken links:** Check that referenced documents exist and paths are correct
- **Low score:** Focus on fixing `error` severity issues first (each error costs 15 points)

### Performance

If tool responses are slow:

- Large `docs/` directories with many files can slow indexing — use `.magsignore` patterns if needed
- Memory store with many entries may slow search — clean up old `context` entries periodically
- Embedding with OpenAI adds network latency — use `local` provider for faster offline search

---

## Workflow: Doc-Sync Validator

The doc-sync-validator agent checks if documentation matches the actual code.

### When it triggers

- After completing a feature or module
- Before creating a pull request
- When running `/mags-docs validate` and wanting deeper code-documentation consistency checks

### How to invoke manually

The doc-sync-validator is an agent defined in `agents/doc-sync-validator.md`. It can be triggered by:

1. Mentioning documentation validation in conversation — Claude may activate it automatically
2. Explicitly asking: "Check if my documentation matches the code"
3. Running `/mags-docs validate` and then asking for a deeper code-level check

### Steps

```
1. Agent scans the codebase for:
   - API endpoints defined in code
   - Database tables/models
   - Module boundaries and exports
   - Configuration files

2. Agent reads documentation:
   - API design docs
   - Data model docs
   - Module documentation
   - Architecture overview

3. Agent compares code vs docs:
   - Missing endpoints (in code but not documented)
   - Stale endpoints (documented but removed from code)
   - Missing tables/models
   - Undocumented modules

4. Agent reports findings:
   == Doc-Sync Validation ==

   Missing from docs:
     - POST /api/v1/webhooks (found in src/api/webhooks.ts)
     - Table: audit_logs (found in prisma/schema.prisma)

   Stale in docs:
     - DELETE /api/v1/legacy/users (not found in code)

   Coverage: 85% (17/20 endpoints documented)
```

---

## Workflow: Setup Recommender

The setup-recommender agent analyzes a project and recommends optimal Claude Code configuration.

### When it triggers

- When setting up a new project with Claude Code
- When running `/mags-setup`
- When asking "What plugins and hooks should I use?"

### How to invoke manually

1. Run `/mags-setup` — this triggers the setup analysis workflow
2. Or explicitly ask: "Recommend the best Claude Code setup for this project"

### Steps

```
1. Agent detects project stack:
   - Scans manifest files (package.json, Cargo.toml, etc.)
   - Identifies frameworks, ORMs, testing tools
   - Checks for CI/CD configuration

2. Agent checks current setup:
   - Existing CLAUDE.md
   - Installed plugins and MCP servers
   - Configured hooks

3. Agent generates recommendations:
   == Setup Recommendations for my-project ==

   Detected: Next.js 14 + Prisma + PostgreSQL + Vitest

   MUST HAVE
     [x] MAGS plugin — Already installed
     [ ] Generate CLAUDE.md — Missing project configuration

   RECOMMENDED
     [ ] Pre-commit hook — Run lint + typecheck
     [ ] Testing skill — Vitest patterns for Next.js

   NICE TO HAVE
     [ ] Database MCP — PostgreSQL introspection

4. User selects which recommendations to apply
5. Agent applies selected configurations
```

---

## Workflow: Stack Detection

Use `mags_detect_stack` to automatically detect the project's technology stack.

### Steps

```
1. Call mags_detect_stack
   → Scans project root for manifest files
   → Detects languages, frameworks, databases, API style, package manager

2. Review the output:
   {
     "primaryLanguage": "typescript",
     "languages": ["typescript", "javascript"],
     "frameworks": ["next.js", "prisma"],
     "databases": ["postgresql"],
     "apiStyle": ["rest"],
     "packageManager": "pnpm"
   }

3. Persist to .mags.yaml:
   → Copy the stack section into your .mags.yaml config
   → This enables stack-aware CLAUDE.md generation and template selection

   stack:
     primaryLanguage: "typescript"
     languages: ["typescript", "javascript"]
     frameworks: ["next.js", "prisma"]
     databases: ["postgresql"]
     apiStyle: ["rest"]
     packageManager: "pnpm"

4. Verify by running /mags-setup
   → Should show the detected stack in the analysis output
```

### What gets detected

| Signal | Detection Method |
|--------|-----------------|
| Languages | Manifest files (package.json, Cargo.toml, go.mod, pyproject.toml) |
| Frameworks | Config files (next.config.*, nest-cli.json, prisma/schema.prisma) |
| Databases | Connection strings, ORM configs, docker-compose services |
| API Style | Route definitions, GraphQL schemas, gRPC proto files |
| Package Manager | Lock files (pnpm-lock.yaml, yarn.lock, package-lock.json) |

---

## Workflow: Module Discovery

Use `mags_discover_modules` to scan the project structure and find existing modules.

### Steps

```
1. Call mags_discover_modules
   → Scans src/, lib/, app/, packages/ directories
   → Identifies module boundaries by directory structure
   → Assigns confidence scores based on file patterns

2. Review discovered modules:
   Discovered Modules:
     - auth (confidence: 95%) — src/modules/auth/
     - users (confidence: 90%) — src/modules/users/
     - billing (confidence: 85%) — src/modules/billing/
     - notifications (confidence: 70%) — src/services/notifications/

3. Optional: Scaffold documentation
   → For each discovered module, run mags_scaffold_module
   → Creates PRD section, data model draft, API endpoint draft
```

### Confidence Scoring

| Score | Meaning |
|-------|---------|
| 90-100% | Clear module boundary with index file, dedicated directory, and standard patterns |
| 70-89% | Likely a module but may be a utility or shared code |
| 50-69% | Possibly a module, needs manual review |
| Below 50% | Probably not a standalone module |
