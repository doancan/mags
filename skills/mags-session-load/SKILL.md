---
name: mags-session-load
description: Load and restore last session context
version: 1.0.0
user-invocable: true
allowed-tools:
  - mcp__mags_mags__mags_get_last_session
  - mcp__mags_mags__mags_remember
---

# MAGS Session Load

Load and restore the most recent session context.

## Usage

```
/mags-session-load
```

## Steps

1. Call `mags_get_last_session` to retrieve the most recent session.
2. If no session exists, say "No saved sessions found. Run `/mags-session-save` after doing some work."
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
