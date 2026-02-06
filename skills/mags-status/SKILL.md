---
name: mags-status
description: Show project status dashboard with progress, docs health, and next steps
version: 1.0.0
user-invocable: true
allowed-tools:
  - mcp__mags_mags__mags_project_summary
  - mcp__mags_mags__mags_validate_docs
  - mcp__mags_mags__mags_recall
---

# MAGS Status

Display a comprehensive project status dashboard.

## Steps

### 1. Gather data

Call these in parallel:
- `mags_project_summary` — Get overall project summary
- `mags_validate_docs` — Check documentation health
- `mags_recall` with query "recent decisions and blockers" — Surface relevant memories

### 2. Format the dashboard

Present the output as a clean dashboard. Use this format:

```
== MAGS Project Status ==

PROJECT
  Name:     <project name>
  Stack:    <tech stack>
  State:    <project state>

DOCUMENTATION HEALTH
  Total docs:      <N>
  Valid:           <N> ok
  Warnings:        <N> (list brief reasons)
  Errors:          <N> (list brief reasons)

RECENT MEMORY
  - <any recalled decisions or notes>

NEXT STEPS
  1. <recommended action>
  2. <recommended action>
  3. <recommended action>
```

### 3. Offer actions

After displaying the dashboard, say:

"Run `/mags-docs-validate` to fix doc issues, or use `mags_remember` to save important decisions."

Do not take any further action unless the user asks.

---

**Related commands:**
| Command | Description |
|---------|-------------|
| `/mags-help` | See all available commands |
| `/mags-docs-validate` | Check documentation health in detail |
