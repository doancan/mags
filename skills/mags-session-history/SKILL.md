---
name: mags-session-history
description: List all saved sessions
version: 1.0.0
user-invocable: true
allowed-tools:
  - mcp__mags_mags__mags_list_sessions
---

# MAGS Session History

List all saved sessions for the project.

## Usage

```
/mags-session-history
```

## Steps

1. Call `mags_list_sessions` to get all sessions.
2. If empty, say "No sessions recorded yet. Sessions are saved automatically by the Stop hook at the end of each conversation. You can also save manually with `/mags-session-save`."
3. Otherwise, display as a table:
   ```
   #   Date                 Summary
   1   2025-01-15 14:30     Added auth module, wrote tests
   2   2025-01-14 09:00     Initial project setup
   3   2025-01-13 16:45     Database schema design
   ```
4. Say: "Run `/mags-session-load` to restore the most recent session."
