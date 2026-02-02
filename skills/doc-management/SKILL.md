---
name: doc-management
description: Provides document management guidance for creating, updating, and maintaining project documentation. Use when writing or editing docs, structuring markdown files, managing document lifecycle, or applying formatting standards. Triggers on creating docs, updating docs, writing documentation, markdown formatting, frontmatter, document status, cross-references, naming conventions.
version: 1.0.0
user-invocable: false
---

# Document Management

## YAML Frontmatter Rules

Include YAML frontmatter at the top of every document. Use the following required fields:

```yaml
---
title: Clear, descriptive document title
description: One-line summary of the document purpose
status: draft | review | locked
created: YYYY-MM-DD
updated: YYYY-MM-DD
author: Name or identifier of the creator
tags: [relevant, topic, tags]
---
```

Add optional fields based on document type:

- `category:` for grouping documents (e.g., architecture, guide, reference, adr)
- `related:` list of paths to related documents
- `replaces:` path to the document this one supersedes
- `version:` semantic version for versioned specifications

Always update the `updated` field when making any content change. Never backdate the `created` field.

## Document Status Workflow

Follow the three-stage status lifecycle strictly:

**DRAFT** -- The document is being written or heavily modified. Content may be incomplete, structure may change. Any contributor can edit freely. Set status to `draft` when:
- Creating a new document
- Making significant structural changes to an existing document
- Rewriting more than 30% of the content

**REVIEW** -- The document is complete and awaiting feedback. Content should be coherent and full. Set status to `review` when:
- All sections are filled in
- The document is ready for others to read and comment on
- Technical accuracy needs verification

**LOCKED** -- The document is finalized and approved. Do not edit locked documents directly. Set status to `locked` when:
- Review feedback has been incorporated
- The content is considered stable and authoritative
- The document serves as a reference others depend on

To modify a locked document, change its status back to `draft` first, make changes, then move through `review` again. Never skip from `locked` directly back to `locked` after edits.

## Section Structure

Organize every document with a consistent heading hierarchy:

1. **H1 (`#`)** -- Document title. Use exactly one per file. Must match the frontmatter `title`.
2. **H2 (`##`)** -- Major sections. Use for primary topic divisions.
3. **H3 (`###`)** -- Subsections. Use for breakdowns within a major section.
4. **H4 (`####`)** -- Detail sections. Use sparingly for deeply nested topics.

Never skip heading levels (e.g., do not jump from H2 to H4). Start every document with an introductory paragraph immediately after the H1 before the first H2.

Apply these section patterns based on document type:

**Guide documents:** Overview, Prerequisites, Steps, Troubleshooting, Related Resources
**Reference documents:** Overview, API/Interface, Parameters, Examples, Notes
**ADR documents:** Context, Decision, Consequences, Status
**Changelog entries:** Summary, Added, Changed, Fixed, Removed

## Naming Conventions

Follow these file and directory naming rules:

- Use **kebab-case** for all file and directory names: `api-design-guide.md`, not `ApiDesignGuide.md`
- Prefix ADR files with a zero-padded number: `001-database-selection.md`
- Prefix changelog files with version or date: `v1.2.0.md` or `2024-03-15.md`
- Keep filenames under 50 characters
- Use descriptive names that indicate content, not generic names like `notes.md` or `misc.md`
- Place documents in the appropriate subdirectory by category: `docs/architecture/`, `docs/guides/`, `docs/adr/`, `docs/changelog/`

For directories:
- Use plural names for collections: `guides/`, `decisions/`, `templates/`
- Use singular names for specific topics: `architecture/`, `security/`, `testing/`

## Cross-Referencing Conventions

Link between documents using relative paths from the repository root:

```markdown
See [Database Selection ADR](../adr/001-database-selection.md) for context.
```

Follow these cross-referencing rules:

- Use relative paths, never absolute filesystem paths
- Link to the document file, not a heading, unless targeting a specific section
- When linking to a section, use the GitHub-compatible anchor format: `[link text](./file.md#section-heading)`
- Add cross-references in a "Related Documents" section at the bottom of the file when there are three or more related docs
- When a document references a decision, always link to the corresponding ADR
- When updating a document that others reference, check all incoming links still resolve

Maintain a `related` field in frontmatter for machine-readable cross-references alongside human-readable markdown links in the body.

## When to Update Which Document

Follow these rules to determine what to update and when:

**Architecture changes** (new service, changed data flow, new integration):
- Update `docs/architecture/` files
- Create a new ADR if the change is a significant decision
- Update module map in CLAUDE.md if applicable

**New feature or capability:**
- Add or update the relevant guide in `docs/guides/`
- Update changelog
- Update API reference if endpoints changed

**Bug fix:**
- Update changelog
- Add regression note to relevant test documentation if the bug was subtle

**Convention change** (coding style, naming, process):
- Update the relevant rules file in `docs/rules/`
- Update CLAUDE.md if it affects project-level conventions

**Dependency or tooling change:**
- Update setup/installation guides
- Update CLAUDE.md tech stack section

Never let code changes ship without corresponding documentation updates. If a document does not exist yet for the topic, create it following the section structure and naming conventions above. When in doubt about where a piece of information belongs, prefer the most specific document over a general one.

## Markdown Formatting Standards

Apply these formatting rules consistently:

- Use **bold** for emphasis on key terms, not ALL CAPS or italics
- Use `code` formatting for file names, commands, variables, and technical identifiers
- Use fenced code blocks with language identifiers for all code examples
- Use ordered lists only when sequence matters; use unordered lists otherwise
- Keep lines under 120 characters where practical for readability in editors
- Separate sections with a single blank line
- Do not use HTML tags in markdown unless absolutely necessary for tables or complex layouts
- Use pipe tables for tabular data, keeping column widths readable in source
