# Getting Started

MAGS (Memory And Guidance System) is a Claude Code plugin that preserves project context across sessions. It indexes your documents and remembers decisions.

## Installation

### 1. Install the Plugin

```bash
# Add the MAGS marketplace
claude plugin marketplace add https://github.com/doancan/mags

# Install the plugin
claude plugin install mags@mags-marketplace
```

### 2. Restart Claude Code

Restart Claude Code to load the plugin. The MCP server comes pre-bundled — no additional setup or build step needed.

### 3. Initialize in Your Project

In your project directory within Claude Code:

```
/mags-init
```

This command:
- Scans and indexes existing `docs/` if present
- Otherwise asks for project info and scaffolds documents from templates
- Sets up `docs/.mags/` directory (memory)
- Optionally generates CLAUDE.md

## Quick Win (2 minutes)

Get value from MAGS in three steps:

```
1. /mags-init
   → Project scanned, documents indexed

2. "We're using JWT for auth, remember this"
   → Claude auto-saves to memory

3. /mags-status
   → Project dashboard displayed
```

That's it. MAGS is now tracking your project.

## Verify Installation

Confirm the plugin is working correctly:

```bash
# Check plugin status
claude plugin list
# → mags@mags-marketplace  ✔ enabled

# Check MCP server connection
claude mcp list
# → plugin:mags:mags  ✓ Connected
```

## First Use Scenarios

### Scenario A: Project with Existing Docs

A project that already has a `docs/` directory with markdown files:

```
/mags-init
→ docs/ found, 18 documents indexed
→ .mags/ directory created

/mags-status
→ Project dashboard: document count, health score, suggestions
```

### Scenario B: Starting from Scratch

A new project with no documentation yet:

```
/mags-init
→ Project info requested (name, description, tech stack)
→ Document templates created (vision, PRD, tech-stack, etc.)
→ CLAUDE.md generated
```

You can fill in the templates with Claude's help:

```
"Let's fill in the PRD — user modules are: auth, tenant, dashboard"
→ Claude uses mags_get_doc and mags_update_doc to edit the document
```

### Scenario C: Existing Project, Adding MAGS Later

A project with code already written but disorganized documentation:

```
/mags-init
→ Existing documents are scanned and indexed

# Record decisions and conventions
"We use JWT + refresh tokens for auth, remember this"
→ mags_remember is called
```

### Scenario D: Legacy/Brownfield Project

An existing project that needs documentation, migration planning, and tech debt tracking:

```
/mags-legacy
→ Stack detected: TypeScript, Next.js, PostgreSQL
→ 8 modules discovered with confidence scores
→ Legacy context gathered (migration goals, pain points)
→ Documents created: current-architecture, migration-plan, tech-debt, target-architecture
→ Tech debt items documented
```

## Architecture Overview

MAGS has three layers:

```
You → Slash Commands (/mags-*) → MCP Tools (mags_*) → Services
      10 commands                 20 tools              15+ services
```

- **Slash commands** — what you use directly (e.g. `/mags-init`, `/mags-status`)
- **MCP tools** — what Claude uses automatically behind the scenes (e.g. `mags_remember`, `mags_recall`)
- **Services** — internal engines that power everything (you never interact with these directly)

For daily use, slash commands are all you need. Run `/mags-help` to see them all.

## Core Concepts

### Documents

Project documents are stored as files in `docs/`. MAGS indexes them and makes them searchable. Supported formats: `.md`, `.mdx`, `.rst`, `.adoc`. Each document can have YAML frontmatter:

```yaml
---
title: API Design
status: draft       # draft → review → locked
tags: [backend, api]
---
```

### Memory

Information stored as key-value pairs. Claude automatically saves them when you speak in natural language:

| Category | Purpose | Example |
|----------|---------|---------|
| `decisions` | Architectural and technical decisions | "We use Drizzle as our ORM" |
| `conventions` | Code standards | "Every endpoint must include tenant isolation" |
| `notes` | Observations and ideas | "Login page should be SSR" |
| `context` | Session context | "Currently working on auth module" |
| `bugs` | Bug observations | "Refresh token race condition exists" |

## Daily Usage Flow

A typical session looks like this:

```
Session starts
  → (automatic) project_summary + conventions loaded

Start working on a module
  → "Load the context for the auth module"
  → Claude calls mags_module_context("auth")
  → PRD section + data model + API endpoints displayed

Develop
  → Write code, make decisions
  → "We're using custom JWT middleware instead of Passport, remember this"
  → Claude automatically saves to memory
```

### Useful Commands

| What you want to do | What to do |
|---------------------|------------|
| See overall status | `/mags-status` |
| Create a new document | `/mags-docs create prd` |
| Check document quality | `/mags-docs validate` |
| Record a decision | Tell Claude in natural language |
| Get module context | "Load the auth module context" |
| Generate a changelog | `/mags-changelog` |
| Set up a legacy project | `/mags-legacy` |
| See all available commands | `/mags-help` |

## Next Steps

- [Commands Reference](./commands-reference.md) — All 10 slash commands in detail
- [Skills Reference](./skills-reference.md) — All 17 skills (10 commands + 7 guidance)
- [MCP Tools Reference](./tools-reference.md) — All 20 MCP tools with parameters
- [Workflows](./workflows.md) — Common usage scenarios and patterns
- [Configuration](./configuration.md) — Settings and customization
