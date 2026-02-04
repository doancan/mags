---
name: mags-docs-create
description: Create a new document from template
argument-hint: "<template>"
version: 1.0.0
user-invocable: true
allowed-tools:
  - mcp__mags_mags__mags_create_doc
---

# MAGS Docs Create

Create a new document from a predefined template.

## Usage

```
/mags-docs-create <template>
```

## Available Templates

| Template | File | Purpose |
|----------|------|---------|
| `adr` | `docs/adr/NNN-<title>.md` | Architecture Decision Record |
| `module` | `docs/modules/<name>.md` | Module documentation |
| `rule` | `docs/rules/<name>.md` | Coding/process rule |
| `guide` | `docs/guides/<name>.md` | How-to guide |
| `api` | `docs/api/<name>.md` | API endpoint documentation |

## Steps

1. Parse the template name from the argument.
2. If the template name is not recognized, list the available templates and stop.
3. Ask the user for the document title/name.
4. Call `mags_create_doc` with the appropriate path and template content.
5. Confirm: "Created `<path>`. Edit it to fill in the details, or describe what it should contain and I will draft it."
