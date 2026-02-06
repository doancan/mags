---
name: mags-docs-validate
description: Validate project documentation
version: 1.0.0
user-invocable: true
allowed-tools:
  - mcp__mags_mags__mags_validate_docs
  - mcp__mags_mags__mags_get_doc
  - mcp__mags_mags__mags_update_doc
---

# MAGS Docs Validate

Run validation checks on all project documents.

## Usage

```
/mags-docs-validate
```

## Steps

1. Ask the user: "Standard validation or deep validation?"
   - **Standard** — checks frontmatter, required sections, cross-references, freshness
   - **Deep** — all standard checks plus: version conflict detection, memory-doc consistency, ADR structure validation, and module completeness checks

   If deep: call `mags_validate_docs` with `deep: true`.
   If standard (or no preference): call `mags_validate_docs` with default parameters.
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
3. If there are errors, ask: "Would you like me to fix the errors?"
4. If yes, read each problematic doc with `mags_get_doc`, fix the issues, and call `mags_update_doc`.

---

**Related commands:**
| Command | Description |
|---------|-------------|
| `/mags-docs` | List all project documents |
| `/mags-docs-search <query>` | Search across all documents |
