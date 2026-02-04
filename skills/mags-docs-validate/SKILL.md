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
3. If there are errors, ask: "Would you like me to fix the errors?"
4. If yes, read each problematic doc with `mags_get_doc`, fix the issues, and call `mags_update_doc`.
