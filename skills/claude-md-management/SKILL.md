---
name: claude-md-management
description: Provides guidance on creating and maintaining CLAUDE.md project configuration files for Claude Code. Use when setting up a new project, configuring Claude Code behavior, or updating project rules and conventions. Triggers on creating CLAUDE.md, project setup, Claude Code configuration, project rules, project conventions, module map, tech stack definition.
version: 1.0.0
user-invocable: false
---

# CLAUDE.md Management

## Purpose of CLAUDE.md

Treat CLAUDE.md as the entry point for Claude Code to understand a project. It is the first file read when Claude Code enters a repository. Write it as a concise project brief that enables Claude Code to work effectively without reading every file in the codebase.

CLAUDE.md is not documentation for humans. It is a configuration and context file for Claude Code. Optimize for machine comprehension, fast orientation, and actionable instructions.

## File Placement

Place CLAUDE.md files at the appropriate scope:

- **Repository root (`./CLAUDE.md`):** Project-wide rules, tech stack, conventions, and documentation pointers. This is the primary file and is always read first.
- **Subdirectory (`./packages/api/CLAUDE.md`):** Module-specific rules that apply only when working within that directory. Use for monorepos or projects with distinct subsystems.
- **User home (`~/.claude/CLAUDE.md`):** Personal preferences and global rules that apply across all projects. Use for universal coding style preferences, commit conventions, or agent configurations.

When multiple CLAUDE.md files exist, Claude Code merges them with this priority: user home (lowest) < repository root < subdirectory (highest). Subdirectory rules override root rules when working in that directory.

## What to Include

Structure every CLAUDE.md with these sections. Include only sections that are relevant to the project.

### Project Overview

Provide a brief description of what the project is and does. Keep it to 2-3 sentences. Include the primary purpose, the target users or audience, and the deployment model.

```markdown
## Project Overview

Multi-tenant SaaS platform for managing mobile application deployments. Serves enterprise customers with role-based access, audit logging, and automated build pipelines. Deployed on AWS with Kubernetes.
```

### Tech Stack

List the core technologies with their roles. Be specific about versions only when the version matters for compatibility or behavior.

```markdown
## Tech Stack

- **Runtime:** Node.js 20 LTS
- **Backend:** NestJS 10, Prisma ORM, PostgreSQL 15
- **Frontend:** React 18, TanStack Query, Tailwind CSS, Radix UI
- **Testing:** Vitest, Playwright, Testing Library
- **Infrastructure:** Docker, AWS ECS, Terraform
```

### Module Map

Describe the project structure so Claude Code knows where to find things. Focus on the directories that contain source code and configuration. Do not list every file.

```markdown
## Module Map

- `src/api/` -- NestJS backend (controllers, services, modules)
- `src/web/` -- React frontend (pages, components, hooks)
- `src/shared/` -- Shared types and utilities used by both
- `prisma/` -- Database schema and migrations
- `infra/` -- Terraform and Docker configuration
- `docs/` -- Project documentation and ADRs
```

### Conventions and Rules

List the non-obvious rules that Claude Code must follow. Focus on rules that differ from common defaults or that are easy to get wrong.

```markdown
## Conventions

- TypeScript strict mode is enforced; never use `any`
- All list endpoints must support pagination
- Use TanStack Query for data fetching; never use useEffect for API calls
- Every database table must include `tenant_id` for multi-tenant isolation
- Commit messages follow Conventional Commits format
- No AI attribution in commit messages
```

Keep rules as concrete instructions. Avoid vague guidance like "write clean code" or "follow best practices." Every rule should be verifiable.

### Documentation References

Point Claude Code to the relevant documentation files instead of duplicating their content in CLAUDE.md.

```markdown
## Documentation

- Backend rules: `docs/rules/backend.md`
- Frontend rules: `docs/rules/frontend.md`
- Git workflow: `docs/rules/git.md`
- Testing strategy: `docs/testing/strategy.md`
- Architecture decisions: `docs/adr/`
```

### Common Commands

List the commands Claude Code will need to run frequently. Include lint, test, build, and any project-specific scripts.

```markdown
## Commands

- `pnpm dev` -- Start development server
- `pnpm lint` -- Run ESLint
- `pnpm typecheck` -- Run TypeScript compiler check
- `pnpm test` -- Run unit tests
- `pnpm test:e2e` -- Run end-to-end tests
- `pnpm db:migrate` -- Apply database migrations
- `pnpm db:generate` -- Regenerate Prisma client
```

## What NOT to Include

Avoid these common mistakes that degrade CLAUDE.md effectiveness:

**Do not duplicate documentation.** If a rule is fully explained in `docs/rules/backend.md`, reference that file instead of copying its content into CLAUDE.md. Duplication leads to drift and contradictions.

**Do not include implementation details.** CLAUDE.md should describe what the rules are, not how every module works internally. Claude Code can read source files when it needs implementation details.

**Do not write tutorials or guides.** CLAUDE.md is a reference sheet, not a learning document. Keep entries concise and direct.

**Do not list every file or directory.** The module map should cover the top-level structure. Claude Code can explore subdirectories on its own.

**Do not include sensitive information.** Never put API keys, passwords, tokens, or internal URLs in CLAUDE.md. It is a repository file and will be committed to version control.

**Do not add aspirational rules.** Only include rules that are actively enforced. If the team does not actually run linting before every commit, do not write "always run lint before commit." CLAUDE.md should reflect reality.

**Do not exceed 200 lines.** A CLAUDE.md that is too long defeats its purpose. If the file grows beyond 200 lines, move detailed rules into dedicated docs files and reference them.

## Maintenance Rules

Keep CLAUDE.md accurate with these maintenance triggers:

### Update When Architecture Changes

When adding a new module, service, or major directory, update the Module Map section. When removing or renaming modules, remove stale entries immediately.

### Update When Tech Stack Changes

When adding, removing, or upgrading a core dependency, update the Tech Stack section. Include version changes only if the version is pinned for a reason.

### Update When Conventions Change

When the team adopts a new coding convention or abandons an old one, update the Conventions section. Remove outdated rules that no longer apply. Never leave contradictory rules in the file.

### Update When Commands Change

When build scripts, test commands, or development workflows change, update the Commands section. Stale commands cause Claude Code to run incorrect operations.

### Review Periodically

Review CLAUDE.md at least once per release cycle or major milestone. Check every entry against the current state of the project. Remove anything that no longer applies. Add anything new that Claude Code should know.

### Validate References

When updating CLAUDE.md, verify that all documentation file references still point to existing files. Broken references send Claude Code to files that do not exist, wasting time and causing errors.

## CLAUDE.md Anti-Patterns

Recognize and avoid these patterns:

- **The novel:** A CLAUDE.md that reads like a project history book. Keep it current state only.
- **The wishlist:** Rules that describe how the project should work someday, not how it works now.
- **The copy-paste:** Entire sections duplicated from docs files. Reference instead.
- **The stale snapshot:** A CLAUDE.md written once and never updated. Treat it as a living file.
- **The catch-all:** Using CLAUDE.md for information that belongs in README, CONTRIBUTING, or docs. Each file has its own purpose.
