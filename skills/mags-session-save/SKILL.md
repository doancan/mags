---
name: mags-session-save
description: Save current session state
version: 1.0.0
user-invocable: true
allowed-tools:
  - mcp__mags_mags__mags_save_session
  - mcp__mags_mags__mags_get_progress
  - mcp__mags_mags__mags_recall
  - mcp__mags_mags__mags_remember
---

# MAGS Session Save

Save the current session state including progress, decisions, and context.

## Usage

```
/mags-session-save
```

## Steps

1. Call `mags_get_progress` to capture current progress state.
2. Call `mags_recall` with query "current session work" to gather recent context.
3. Build a session summary from the gathered data. Include:
   - What was worked on (files changed, features touched)
   - Current progress state
   - Any open decisions or blockers
4. Call `mags_save_session` with the assembled session data (decisions will be automatically saved to memory).
5. If there are important conventions or context beyond decisions, call `mags_remember` to store them separately.
6. Print confirmation:
   ```
   Session saved.
     Time:     <timestamp>
     Summary:  <brief one-line summary>
     Progress: <N> modules tracked
   ```
