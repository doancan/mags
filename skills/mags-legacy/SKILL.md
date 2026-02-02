---
name: mags-legacy
description: Initialize MAGS for an existing (brownfield/legacy) project
version: 1.0.0
user-invocable: true
allowed-tools:
  - mcp__mags_mags__mags_list_docs
  - mcp__mags_mags__mags_create_doc
  - mcp__mags_mags__mags_detect_stack
  - mcp__mags_mags__mags_discover_modules
  - mcp__mags_mags__mags_init_progress
  - mcp__mags_mags__mags_update_progress
  - mcp__mags_mags__mags_remember
  - mcp__mags_mags__mags_generate_claude_md
  - Bash
  - Read
  - Glob
  - Write
---

# MAGS Legacy Init

Initialize MAGS for an existing (brownfield/legacy) project that already has code but lacks documentation.

## Steps

### 1. Scan existing codebase

Use `mags_detect_stack` to detect the project's tech stack automatically.
Use `mags_discover_modules` to find existing modules in the code.

Report findings:
```
Detected Stack:
  Languages:    <detected>
  Frameworks:   <detected>
  Databases:    <detected>
  API Style:    <detected>

Discovered Modules:
  - <module> (confidence: <score>%)
  - ...
```

### 2. Gather legacy context from user

Ask the user these questions (all at once):
1. What is the migration goal? (modernize, rewrite, extend, maintain)
2. What are the main pain points in the current codebase?
3. Are there parts of the system that must be preserved as-is?
4. What is the target architecture? (keep current, monolith, microservices, serverless)

### 3. Create legacy documentation

Using `mags_create_doc`, create these documents from the legacy templates:
- `current-architecture` — Document the current architecture based on scan results
- `migration-plan` — Create a migration plan based on user goals
- `tech-debt` — Start a tech debt registry
- `target-architecture` — Document the target architecture

Also create standard docs:
- `tech-stack` — Based on detected stack
- `project-structure` — Based on discovered modules

### 4. Set up tech debt tracking

Use `mags_init_progress` to create progress tracking with:
- Discovered modules as `feature` category items
- Known pain points as `tech-debt` category items
- Migration steps as `migration` category items

### 5. Show summary

```
MAGS Legacy Init Complete

  Stack:         <detected stack summary>
  Modules:       <N> modules discovered
  Tech Debt:     <N> items tracked
  Migration:     <strategy> planned

  Documents Created:
    - current-architecture.md
    - migration-plan.md
    - tech-debt.md
    - target-architecture.md
    - tech-stack.md
    - project-structure.md

Run /mags-status to see your project dashboard.
Run mags_get_progress with category "tech-debt" to see debt items.
```
