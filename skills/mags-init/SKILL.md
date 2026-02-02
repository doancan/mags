---
name: mags-init
description: Initialize MAGS for the current project
version: 1.0.0
user-invocable: true
allowed-tools:
  - mcp__mags_mags__mags_list_docs
  - mcp__mags_mags__mags_create_doc
  - mcp__mags_mags__mags_update_doc
  - mcp__mags_mags__mags_search_docs
  - mcp__mags_mags__mags_init_progress
  - mcp__mags_mags__mags_update_progress
  - mcp__mags_mags__mags_detect_stack
  - mcp__mags_mags__mags_generate_claude_md
  - mcp__mags_mags__mags_project_summary
  - mcp__mags_mags__mags_remember
  - Bash
  - Read
  - Glob
  - Write
---

# MAGS Init

Initialize the Memory And Guidance System for this project.

## Steps

### 1. Check existing state

Check if a `docs/` directory already exists in the project root. Also check for `.mags/` directory and any existing `CLAUDE.md`.

Use `Glob` to scan for `docs/**/*.md` and check for `.mags/config.yaml`.

### 2A. If docs/ exists — Index existing documentation

Report what was found:
- Number of documents in docs/
- List the top-level structure

Call `mags_list_docs` to see if MAGS already has indexed documents. If not, read each markdown file in docs/ and call `mags_create_doc` to index them into MAGS.

Tell the user: "Found existing docs/ directory with N documents. Indexed into MAGS."

### 2B. If docs/ does not exist — Gather project info

Ask the user these questions (all at once, not one by one):
1. What is this project? (brief description)
2. What is the tech stack?
3. What is the current state? (new, in progress, mature)
4. What is the architecture type? (monolith, microservices, library, cli, mobile, serverless)
5. What language should documentation be in? (en, tr, or other locale)

Then create the docs/ directory structure using `mags_create_doc` with these templates. **Pass the user's chosen locale (from question 5) as the `locale` parameter to each `mags_create_doc` call:**
- `docs/architecture/overview.md` — Project overview from user answers
- `docs/architecture/tech-stack.md` — Tech stack details
- `docs/rules/coding-standards.md` — Basic coding standards for the stack
- `docs/changelog/changes.md` — Empty changelog

Stop here and wait for user answers before creating docs.

### 3. Create .mags/ directory

Create the following structure:

```
.mags/
  config.yaml    — MAGS configuration
  progress.yaml  — Task/module progress tracking
```

**config.yaml** content:
```yaml
version: 1
project_root: .
docs_path: docs/
locale: <user's chosen locale from question 5, e.g. "en" or "tr">
initialized_at: <current ISO date>
```

Use the locale code the user selected in question 5 (en, tr, etc.) as the `locale` value.

**progress.yaml** content:
```yaml
modules: []
tasks: []
last_updated: <current ISO date>
```

Call `mags_update_progress` to initialize the progress tracker.

### 4. Offer CLAUDE.md generation

Ask the user: "Would you like me to generate a CLAUDE.md file based on your project docs?"

If yes, call `mags_generate_claude_md` and write the result to the project root.

### 5. Save initial memory

Call `mags_remember` with:
- key: `project_initialized`
- value: Brief description of what was set up (e.g., "Project X initialized with N docs, tech stack: ...")
- category: `context`
- tags: `["init"]`

This ensures the memory system has at least one entry from the start.

### 6. Summary

Print a summary:
```
MAGS initialized successfully.

  Project:    <name>
  Docs:       <N> documents indexed
  Progress:   Tracking enabled
  CLAUDE.md:  <generated / skipped>

Run /mags-status to see your project dashboard.
```
