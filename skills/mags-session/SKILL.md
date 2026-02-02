---
name: mags-session
description: Save, load, or review sessions
argument-hint: "[save|load|history]"
version: 1.0.0
user-invocable: true
allowed-tools:
  - mcp__mags_mags__mags_save_session
  - mcp__mags_mags__mags_get_last_session
  - mcp__mags_mags__mags_list_sessions
  - mcp__mags_mags__mags_get_progress
  - mcp__mags_mags__mags_recall
  - mcp__mags_mags__mags_remember
---

# MAGS Session

Manage work sessions. Parse the argument to determine subcommand.

## Subcommand routing

Read the argument passed after the command name. Route as follows:

| Argument | Action |
|----------|--------|
| `save`   | Save current session |
| `load`   | Load and restore last session |
| `history`| List all saved sessions |
| _(none)_ | Show last session summary + current status |

---

## Subcommand: save

1. Call `mags_get_progress` to capture current progress state.
2. Call `mags_recall` with query "current session work" to gather recent context.
3. Build a session summary from the gathered data. Include:
   - What was worked on (files changed, features touched)
   - Current progress state
   - Any open decisions or blockers
4. Call `mags_save_session` with the assembled session data.
5. Print confirmation:
   ```
   Session saved.
     Time:     <timestamp>
     Summary:  <brief one-line summary>
     Progress: <N> modules tracked
   ```

---

## Subcommand: load

1. Call `mags_get_last_session` to retrieve the most recent session.
2. If no session exists, say "No saved sessions found. Run `/mags-session save` after doing some work."
3. If a session exists, display:
   ```
   == Last Session ==
     Saved:    <timestamp>
     Summary:  <session summary>
     Progress: <progress snapshot>
     Context:  <key decisions/notes>
   ```
4. Call `mags_remember` to store key context from the loaded session as active memory, so it is available during the current conversation.
5. Say: "Session context restored. I have the previous session's context loaded."

---

## Subcommand: history

1. Call `mags_list_sessions` to get all sessions.
2. If empty, say "No sessions recorded yet."
3. Otherwise, display as a table:
   ```
   #   Date                 Summary
   1   2025-01-15 14:30     Added auth module, wrote tests
   2   2025-01-14 09:00     Initial project setup
   3   2025-01-13 16:45     Database schema design
   ```
4. Say: "Run `/mags-session load` to restore the most recent session."

---

## Default (no argument)

1. Call `mags_get_last_session` and `mags_get_progress` in parallel.
2. Display last session summary (brief) and current progress side by side:
   ```
   == Session Overview ==

   LAST SESSION
     <timestamp> — <summary>

   CURRENT STATE
     <progress overview>
     <N> tasks pending

   Tip: Use "save" to snapshot, "load" to restore context.
   ```
