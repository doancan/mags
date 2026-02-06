---
name: mags-status
description: Show project status dashboard with progress, docs health, and next steps
version: 1.0.0
user-invocable: true
allowed-tools:
  - mcp__mags_mags__mags_project_summary
  - mcp__mags_mags__mags_get_progress
  - mcp__mags_mags__mags_validate_docs
  - mcp__mags_mags__mags_get_next
  - mcp__mags_mags__mags_recall
---

# MAGS Status

Display a comprehensive project status dashboard.

## Steps

### 1. Gather data

Call all three in parallel:
- `mags_project_summary` — Get overall project summary
- `mags_get_progress` — Get module/task progress
- `mags_validate_docs` — Check documentation health

Then call `mags_get_next` to get recommended next steps.

Also call `mags_recall` with query "recent decisions and blockers" to surface anything relevant.

### 2. Format the dashboard

Present the output as a clean dashboard. Use this format:

```
== MAGS Project Status ==

PROJECT
  Name:     <project name>
  Stack:    <tech stack>
  State:    <project state>

PROGRESS
  <module name>    [========--]  80%   <status note>
  <module name>    [====------]  40%   <status note>
  <module name>    [----------]   0%   not started

  Overall: <X>% complete  |  <N> modules  |  <M> tasks pending

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

Use plain text block formatting. Represent progress bars using `=` for filled and `-` for empty inside brackets, 10 characters wide.

### 3. Offer actions

After displaying the dashboard, say:

"Run `/mags-docs validate` to fix doc issues, or `/mags-session save` to snapshot this state."

If no progress data is returned, show: "No modules defined yet. Run `/mags-init` to set up your project, or use `mags_init_progress` to define modules manually."

Do not take any further action unless the user asks.

---

**Related commands:**
| Command | Description |
|---------|-------------|
| `/mags-help` | See all available commands |
| `/mags-docs-validate` | Check documentation health in detail |
| `/mags-session` | View session status |
