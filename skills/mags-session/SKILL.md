---
name: mags-session
description: Show session status overview
version: 1.0.0
user-invocable: true
allowed-tools:
  - mcp__mags_mags__mags_get_last_session
  - mcp__mags_mags__mags_get_progress
---

# MAGS Session

Show session status overview with last session summary and current progress.

## Usage

```
/mags-session
```

## Related Commands

| Command | Purpose |
|---------|---------|
| `/mags-session-save` | Save current session state |
| `/mags-session-load` | Load and restore last session |
| `/mags-session-history` | List all saved sessions |

## Steps

1. Call `mags_get_last_session` and `mags_get_progress` in parallel.
2. Display last session summary (brief) and current progress side by side:
   ```
   == Session Overview ==

   LAST SESSION
     <timestamp> — <summary>

   CURRENT STATE
     <progress overview>
     <N> tasks pending

   Tip: Use `/mags-session-save` to snapshot, `/mags-session-load` to restore context.
   ```
