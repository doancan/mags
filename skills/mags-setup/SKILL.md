---
name: mags-setup
description: Analyze project and recommend setup (skills, hooks, CLAUDE.md)
version: 1.0.0
user-invocable: true
allowed-tools:
  - mcp__mags_mags__mags_project_summary
  - mcp__mags_mags__mags_module_context
  - mcp__mags_mags__mags_search_docs
  - mcp__mags_mags__mags_generate_claude_md
  - mcp__mags_mags__mags_audit_claude_md
  - mcp__mags_mags__mags_scaffold_module
  - Bash
  - Read
  - Glob
  - Write
---

# MAGS Setup

Analyze the current project and recommend an optimal setup for Claude Code workflows.

## Steps

### 1. Analyze project

Gather project signals in parallel:
- Read `.mags/config.yaml` to check for a `locale` field. If present, use this locale value when calling `mags_create_doc` and `mags_scaffold_module` throughout this flow.
- Call `mags_project_summary` for overall context.
- Use `Glob` to detect project type:
  - `package.json` — Node/JS project
  - `Cargo.toml` — Rust project
  - `go.mod` — Go project
  - `pyproject.toml` or `requirements.txt` — Python project
  - `pom.xml` or `build.gradle` — Java project
  - `*.sln` or `*.csproj` — .NET project
- Use `Glob` to detect frameworks and tools:
  - `next.config.*` — Next.js
  - `nest-cli.json` or `src/main.ts` with NestJS imports — NestJS
  - `prisma/schema.prisma` — Prisma ORM
  - `docker-compose.*` — Docker
  - `.github/workflows/` — GitHub Actions CI
  - `tailwind.config.*` — Tailwind CSS
- Read `package.json` or equivalent manifest for dependencies.

### 2. Recommend skills and agents

Based on the detected stack, recommend Claude Code slash commands and workflows. Present as a checklist:

```
== Recommended Setup for <project name> ==

Detected: <framework> + <language> + <key tools>

SKILLS (slash commands to install)
  [x] /commit        — You have this (from MAGS)
  [ ] /review-pr     — PR review automation
  [ ] /test          — Test generation for <framework>
  [ ] /deploy        — Deploy workflow for <detected CI>

HOOKS (automation triggers)
  [ ] pre-commit     — Lint + typecheck before commit
  [ ] post-save      — Auto-format on save
  [ ] pre-push       — Run tests before push

MCP SERVERS
  [ ] mags           — Already active
  [ ] <db tool>      — Database introspection for <detected DB>
  [ ] <api tool>     — API testing for <detected framework>
```

Mark items already present with `[x]`. Only recommend what makes sense for the detected stack.

### 3. Audit CLAUDE.md

Call `mags_audit_claude_md` to check the current CLAUDE.md (if it exists) against the project's actual state.

Display findings:
```
CLAUDE.md AUDIT
  Status:    <exists / missing / outdated>
  Coverage:  <what's covered vs what's missing>
  Issues:
    - <specific issue>
    - <specific issue>
```

### 4. Offer actions

Present actionable next steps:

"I can help with any of these:"
1. **Generate/update CLAUDE.md** -- Create or refresh based on current project state
2. **Scaffold a module** -- Set up a new module with docs, tests, and structure
3. **Install recommended hooks** -- Set up git hooks for the project

Wait for user to pick an action. Do not proceed automatically.

If the user picks option 1, call `mags_generate_claude_md` and write the result to the project root.
If the user picks option 2, ask for the module name, then call `mags_scaffold_module` (pass the `locale` from config.yaml if available).
If the user picks option 3, create the appropriate hook scripts in `.githooks/` or configure via the project's tooling (husky for Node, pre-commit for Python, etc.).

---

**Related commands:**
| Command | Description |
|---------|-------------|
| `/mags-init` | Initialize MAGS for a new project |
| `/mags-legacy` | Initialize MAGS for a legacy project |
| `/mags-help` | See all available commands |
