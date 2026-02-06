---
name: mags-docs
description: List all project documents
version: 1.0.0
user-invocable: true
allowed-tools:
  - mcp__mags_mags__mags_list_docs
  - mcp__mags_mags__mags_get_doc
---

# MAGS Docs

List all indexed project documents.

## Usage

```
/mags-docs
```

## Related Commands

| Command | Purpose |
|---------|---------|
| `/mags-docs-create <template>` | Create a new document from template |
| `/mags-docs-validate` | Run document validation checks |
| `/mags-docs-search <query>` | Search across all documents |

## Steps

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
4. If no documents are found, say: "No indexed documents found. Run `/mags-init` to scan your docs/ directory or scaffold new documents from templates."
