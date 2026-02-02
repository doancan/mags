# Skills Reference

MAGS provides 14 skills organized in two categories: **slash commands** (user-invocable) and **auto-activating skills** (guidance that Claude applies automatically when relevant).

All skills are located under `skills/<name>/SKILL.md`.

## Skill Types

| Type | Count | Trigger | Example |
|------|-------|---------|---------|
| Slash Command | 7 | User types `/mags-<name>` | `/mags-init` |
| Auto-Activating | 7 | Claude detects a relevant context | Working on documentation triggers `doc-management` |

---

## Slash Commands

### /mags-init

- **Description:** Initialize MAGS for the current project
- **Location:** `skills/mags-init/SKILL.md`
- **Tools Used:** `mags_list_docs`, `mags_create_doc`, `mags_search_docs`, `mags_update_progress`, `mags_generate_claude_md`, `mags_project_summary`, Bash, Read, Glob, Write
- **Example Scenario:** You have a new project and want to set up MAGS. Run `/mags-init` — it scans for existing docs, scaffolds templates if needed, creates the `.mags/` directory, and optionally generates `CLAUDE.md`.

---

### /mags-docs

- **Description:** List, create, validate, or search project documents
- **Arguments:** `[list|create <template>|validate|search <query>]`
- **Location:** `skills/mags-docs/SKILL.md`
- **Tools Used:** `mags_list_docs`, `mags_get_doc`, `mags_create_doc`, `mags_search_docs`, `mags_validate_docs`, `mags_update_doc`
- **Example Scenario:** Run `/mags-docs validate` before a PR to check document health. Run `/mags-docs create adr` to create a new Architecture Decision Record. Run `/mags-docs search auth` to find all documentation related to authentication.

---

### /mags-status

- **Description:** Show project status dashboard with progress, docs health, and next steps
- **Location:** `skills/mags-status/SKILL.md`
- **Tools Used:** `mags_project_summary`, `mags_get_progress`, `mags_validate_docs`, `mags_get_next`, `mags_recall`
- **Example Scenario:** Start a new session and run `/mags-status` to see module progress bars, documentation health score, recent decisions, and recommended next steps.

---

### /mags-session

- **Description:** Save, load, or review sessions
- **Arguments:** `[save|load|history]`
- **Location:** `skills/mags-session/SKILL.md`
- **Tools Used:** `mags_save_session`, `mags_get_last_session`, `mags_list_sessions`, `mags_get_progress`, `mags_recall`, `mags_remember`
- **Example Scenario:** Before ending your work, run `/mags-session save` to snapshot progress. Next time, run `/mags-session load` to restore context. Use `/mags-session history` to see all past sessions.

---

### /mags-changelog

- **Description:** Generate changelog from git history and project docs
- **Location:** `skills/mags-changelog/SKILL.md`
- **Tools Used:** `mags_generate_changelog`, `mags_get_doc`, `mags_update_doc`, `mags_create_doc`, Bash, Read, Write
- **Example Scenario:** Before a release, run `/mags-changelog` to generate a changelog from the last 30 commits in Keep a Changelog format. Choose to append to `docs/changelog/changes.md` or create a versioned release file.

---

### /mags-setup

- **Description:** Analyze project and recommend setup (skills, hooks, CLAUDE.md)
- **Location:** `skills/mags-setup/SKILL.md`
- **Tools Used:** `mags_project_summary`, `mags_module_context`, `mags_search_docs`, `mags_generate_claude_md`, `mags_audit_claude_md`, `mags_scaffold_module`, Bash, Read, Glob, Write
- **Example Scenario:** First time using Claude Code on a project. Run `/mags-setup` — it detects your framework (e.g., Next.js + Prisma), recommends skills and hooks, audits your CLAUDE.md, and offers to generate or update configuration.

---

### /mags-legacy

- **Description:** Initialize MAGS for an existing (brownfield/legacy) project
- **Location:** `skills/mags-legacy/SKILL.md`
- **Tools Used:** `mags_list_docs`, `mags_create_doc`, `mags_detect_stack`, `mags_discover_modules`, `mags_init_progress`, `mags_update_progress`, `mags_remember`, `mags_generate_claude_md`, Bash, Read, Glob, Write
- **Example Scenario:** You have a large codebase without documentation. Run `/mags-legacy` — it detects the tech stack, discovers existing modules with confidence scores, asks about migration goals, creates architecture docs, and sets up tech debt tracking.

---

## Auto-Activating Skills

These skills activate automatically when Claude detects a relevant context. They provide structured guidance without requiring user invocation.

### doc-management

- **Description:** Document management guidance for creating, updating, and maintaining project documentation
- **Location:** `skills/doc-management/SKILL.md`
- **Triggers:** Creating docs, updating docs, writing documentation, markdown formatting, frontmatter management, document status changes, cross-references, naming conventions
- **Guidance Provided:** YAML frontmatter rules, document status workflow (draft → review → locked), section structure patterns, naming conventions (kebab-case), cross-referencing standards, markdown formatting rules
- **Tool Interactions:** Works alongside `mags_create_doc`, `mags_update_doc`, `mags_validate_docs`

---

### memory-guidance

- **Description:** Guidance on using the memory system for storing decisions, context, and quick notes
- **Location:** `skills/memory-guidance/SKILL.md`
- **Triggers:** Remembering things, storing decisions, session context management, memory management, saving/loading context, quick notes, decision logging, conventions tracking
- **Guidance Provided:** Memory vs document distinction, 5 category definitions (decisions, conventions, notes, context, bugs), tagging strategy, session workflow (load → update → save), memory hygiene practices
- **Tool Interactions:** Works alongside `mags_remember`, `mags_recall`, `mags_forget`

---

### claude-md-management

- **Description:** Guidance on creating and maintaining CLAUDE.md project configuration files
- **Location:** `skills/claude-md-management/SKILL.md`
- **Triggers:** Creating CLAUDE.md, project setup, Claude Code configuration, project rules and conventions, module map updates, tech stack definition
- **Guidance Provided:** File placement rules (root, subdirectory, user home), required sections (overview, tech stack, module map, conventions, commands), what NOT to include, maintenance triggers, anti-patterns
- **Tool Interactions:** Works alongside `mags_generate_claude_md`, `mags_audit_claude_md`

---

### testing-strategy

- **Description:** Testing strategy guidance including test pyramid, coverage targets, and stack-specific tooling
- **Location:** `skills/testing-strategy/SKILL.md`
- **Triggers:** Testing, test strategy, test coverage, unit/integration/e2e tests, TDD, test pyramid, test plan, test architecture
- **Guidance Provided:** Test pyramid distribution (70/20/10), coverage targets by module criticality, AAA pattern, stack-specific tool recommendations, test organization patterns, mock strategies, CI integration rules, anti-patterns
- **Tool Interactions:** Provides context when generating tests or reviewing test coverage

---

### security-review

- **Description:** Security review guidance including OWASP Top 10, threat modeling, and secure coding
- **Location:** `skills/security-review/SKILL.md`
- **Triggers:** Security, threat model, vulnerability, OWASP, authentication, authorization, encryption, secrets management, security review, penetration testing
- **Guidance Provided:** OWASP Top 10 checklist, threat modeling framework, secure coding practices, input validation rules, authentication/authorization patterns, secrets management, security headers
- **Tool Interactions:** Provides context during code review and security-sensitive development

---

### infrastructure

- **Description:** Infrastructure and DevOps guidance including deployment, CI/CD, monitoring, and containerization
- **Location:** `skills/infrastructure/SKILL.md`
- **Triggers:** Infrastructure, DevOps, deployment, Docker, Kubernetes, CI/CD, monitoring, observability, cloud architecture, scaling, load balancing
- **Guidance Provided:** Deployment checklist, containerization best practices, CI/CD pipeline patterns, monitoring and observability setup, cloud architecture recommendations, scaling strategies
- **Tool Interactions:** Provides context when working on infrastructure configuration and deployment

---

### api-lifecycle

- **Description:** API design and lifecycle management guidance
- **Location:** `skills/api-lifecycle/SKILL.md`
- **Triggers:** API design, REST API, GraphQL, API versioning, deprecation, breaking changes, rate limiting, API lifecycle, API documentation, OpenAPI
- **Guidance Provided:** API design principles, versioning strategies, deprecation workflows, rate limiting patterns, documentation standards (OpenAPI/GraphQL), backward compatibility rules, error response formats
- **Tool Interactions:** Provides context when designing or modifying API endpoints
