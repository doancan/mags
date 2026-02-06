---
name: mags-help
description: Show all available MAGS commands, skills, agents, and hooks at a glance
version: 1.0.0
user-invocable: true
allowed-tools:
  - mcp__mags_mags__mags_list_docs
---

# MAGS Help

Display a complete quick-reference of everything MAGS offers.

## Steps

### 1. Display the reference

Present the following reference card directly (no tool calls needed for this step):

```
== MAGS Quick Reference ==

SLASH COMMANDS (10)
  /mags-help              Show this reference card
  /mags-init              Initialize MAGS for your project
  /mags-status            Project dashboard (docs health, memory, next steps)
  /mags-docs              List all project documents
  /mags-docs-create <t>   Create document from template
  /mags-docs-validate     Run document validation checks
  /mags-docs-search <q>   Search across all documents
  /mags-changelog         Generate changelog from git history
  /mags-setup             Recommend Claude Code configuration
  /mags-legacy            Initialize MAGS for a legacy/brownfield project

AUTO-ACTIVATING SKILLS (7)
  These activate automatically when Claude detects a relevant context:
  - doc-management        Creating or editing project documentation
  - memory-guidance       Storing decisions, conventions, or session context
  - claude-md-management  Working with CLAUDE.md configuration
  - testing-strategy      Planning tests, coverage targets, test pyramid
  - security-review       Security audits, OWASP, threat modeling
  - infrastructure        DevOps, CI/CD, containers, monitoring
  - api-lifecycle         API design, versioning, deprecation

AGENTS (2)
  - doc-sync-validator    Checks if documentation matches actual code
  - setup-recommender     Recommends plugins, skills, and hooks for your stack

HOOKS (1 — automatic, no action needed)
  - SessionStart          Loads project summary on startup
```

### 2. Show quick start

Call `mags_list_docs` to check if any documents exist.

If no documents exist, show:

```
QUICK START
  1. /mags-init           → Scan docs or scaffold from templates
  2. Tell Claude a decision → "We use JWT for auth" — auto-saved to memory
  3. /mags-status         → See your project dashboard
```

If documents exist, show:

```
QUICK START
  You're all set! Try:
  → /mags-status          See project dashboard
  → /mags-docs-validate   Check documentation health
  → "What's next?"        Get recommended next steps
```

### 3. Link to full documentation

End with:

```
DOCUMENTATION
  → Getting Started:      docs/getting-started.md
  → Commands Reference:   docs/commands-reference.md
  → Skills Reference:     docs/skills-reference.md
  → MCP Tools Reference:  docs/tools-reference.md
  → Configuration:        docs/configuration.md
```

Do not take any further action unless the user asks.
