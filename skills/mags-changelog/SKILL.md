---
name: mags-changelog
description: Generate changelog from git history and project docs
version: 1.0.0
user-invocable: true
allowed-tools:
  - mcp__mags_mags__mags_generate_changelog
  - mcp__mags_mags__mags_get_doc
  - mcp__mags_mags__mags_update_doc
  - mcp__mags_mags__mags_create_doc
  - Bash
  - Read
  - Write
---

# MAGS Changelog

Generate a changelog from git history, optionally saving it to the project.

## Steps

### 1. Gather git context

Run `git log --oneline -30` via Bash to get the recent commit history. Note the latest tag if any (`git describe --tags --abbrev=0 2>/dev/null`).

### 2. Generate changelog

Call `mags_generate_changelog` to produce a structured changelog from the project state and git history.

### 3. Display output

Present the changelog with stats:

```
== Changelog ==

Generated from <N> commits since <last tag or "initial commit">

## [Unreleased]

### Added
- <feature description>
- <feature description>

### Changed
- <change description>

### Fixed
- <fix description>

### Removed
- <removal description>

---
Stats:  <N> features  |  <N> changes  |  <N> fixes  |  <N> removals
```

Use the Keep a Changelog format (Added, Changed, Fixed, Deprecated, Removed, Security). Omit empty sections.

### 4. Ask to save

Ask the user: "Save this changelog? Options:"
- **Append** to `docs/changelog/changes.md`
- **Create release** as `docs/changelog/v<version>.md` (ask for version number)
- **Skip** and just display

If the user chooses to save:
1. Check if the target file exists with `mags_get_doc`.
2. If it exists, prepend the new entry at the top using `mags_update_doc`.
3. If it does not exist, create it with `mags_create_doc`.
4. Confirm: "Changelog saved to `<path>`."

---

**Related commands:**
| Command | Description |
|---------|-------------|
| `/mags-status` | View project progress dashboard |
| `/mags-docs` | List all project documents |
