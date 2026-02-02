---
name: mags-docs
description: List, create, validate, or search project documents
argument-hint: "[list|create <template>|validate|search <query>]"
version: 1.0.0
user-invocable: true
allowed-tools:
  - mcp__mags_mags__mags_list_docs
  - mcp__mags_mags__mags_get_doc
  - mcp__mags_mags__mags_create_doc
  - mcp__mags_mags__mags_search_docs
  - mcp__mags_mags__mags_validate_docs
  - mcp__mags_mags__mags_update_doc
---

# MAGS Docs

Document operations for the project knowledge base. Parse the argument to determine subcommand.

## Subcommand routing

| Argument | Action |
|----------|--------|
| `list` | List all indexed documents |
| `create <template>` | Create a new doc from template |
| `validate` | Run doc validation checks |
| `search <query>` | Search across all docs |
| _(none)_ | Same as `list` |

---

## Subcommand: list

1. Call `mags_list_docs` to get all documents.
2. Display as a grouped tree:
   ```
   == Project Documents ==

   architecture/
     overview.md          Project architecture overview
     tech-stack.md        Technology stack details

   rules/
     coding-standards.md  Coding conventions and rules
     backend.md           Backend development rules

   changelog/
     changes.md           Running changelog

   Total: <N> documents
   ```
3. Show the path and a brief description (first line or title) for each doc.

---

## Subcommand: create

Parse the template name from the argument (everything after "create ").

Available templates and their content:

| Template | File | Purpose |
|----------|------|---------|
| `adr` | `docs/adr/NNN-<title>.md` | Architecture Decision Record |
| `module` | `docs/modules/<name>.md` | Module documentation |
| `rule` | `docs/rules/<name>.md` | Coding/process rule |
| `guide` | `docs/guides/<name>.md` | How-to guide |
| `api` | `docs/api/<name>.md` | API endpoint documentation |

Steps:
1. If the template name is not recognized, list the available templates and stop.
2. Ask the user for the document title/name.
3. Call `mags_create_doc` with the appropriate path and template content.
4. Confirm: "Created `<path>`. Edit it to fill in the details, or describe what it should contain and I will draft it."

---

## Subcommand: validate

1. Call `mags_validate_docs` to run all validation checks.
2. Display results grouped by severity:
   ```
   == Document Validation ==

   Errors (must fix):
     - docs/architecture/overview.md: Missing required section "Tech Stack"
     - docs/rules/backend.md: Broken internal link to ../api/auth.md

   Warnings (should fix):
     - docs/modules/auth.md: No code examples found
     - docs/changelog/changes.md: Last updated over 30 days ago

   Passed: <N>/<total> documents are healthy
   ```
3. If there are errors, ask: "Would you like me to fix the errors?" If yes, read each problematic doc with `mags_get_doc`, fix the issues, and call `mags_update_doc`.

---

## Subcommand: search

Parse the query from the argument (everything after "search ").

1. Call `mags_search_docs` with the query string.
2. Display results ranked by relevance:
   ```
   == Search: "<query>" ==

   1. docs/architecture/overview.md
      ...matching excerpt with context...

   2. docs/rules/backend.md
      ...matching excerpt with context...

   Found <N> results.
   ```
3. If no results, suggest: "No matches. Try broader terms or run `/mags-docs list` to browse."
