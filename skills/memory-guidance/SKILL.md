---
name: memory-guidance
description: Provides guidance on using the memory system for storing decisions, context, and quick notes across sessions. Use when deciding what to remember, categorizing stored information, or managing session context. Triggers on remembering things, storing decisions, session context, memory management, save context, load context, quick notes, decision log, conventions tracking.
version: 1.0.0
user-invocable: false
---

# Memory System Usage

## Memory vs Documents

Distinguish between memory entries and documentation files based on the nature and lifespan of the information:

**Use memory for:**
- Quick decisions made during a session ("chose Zustand over Redux for state management")
- Session context that needs to persist ("user prefers verbose commit messages")
- Temporary notes that may become docs later ("need to revisit auth flow")
- Bug observations not yet formalized ("intermittent timeout on /api/users under load")
- Convention reminders ("this project uses single quotes in TypeScript")
- User preferences and working style notes
- Short-lived context that expires after a few sessions

**Use documents for:**
- Structured knowledge that others will reference
- Architecture decisions that affect the whole project (ADRs)
- Guides, tutorials, and how-to content
- API references and specifications
- Anything that needs review, versioning, or a status workflow
- Content longer than a few paragraphs

Apply this rule of thumb: if the information needs a heading structure, frontmatter, or will be read by someone other than the current session context, it belongs in a document. If it is a concise fact, preference, or observation, store it in memory.

## Memory Categories

Organize every memory entry into one of these categories. Always assign a category -- never store uncategorized entries.

### decisions

Store choices and their reasoning. Include what was decided, why, and what alternatives were rejected.

```
Category: decisions
Content: Selected PostgreSQL over MongoDB for the billing service. Reason: need ACID transactions for financial data. MongoDB considered but rejected due to eventual consistency model.
Tags: database, billing, architecture
```

Use `decisions` when: a technical choice was made, a trade-off was evaluated, a direction was set for implementation.

### conventions

Store agreed-upon patterns, coding standards, and project norms that are not yet in formal documentation.

```
Category: conventions
Content: All API error responses use the format { error: string, code: string, details?: object }. Established during auth module development.
Tags: api, error-handling, format
```

Use `conventions` when: a pattern is established that future code should follow, a naming rule is agreed on, a workflow step is standardized.

### notes

Store observations, ideas, and informal findings that may or may not lead to action.

```
Category: notes
Content: The user mentioned wanting to explore GraphQL subscriptions for real-time features in Q2. Not a decision yet, just a direction of interest.
Tags: graphql, real-time, future
```

Use `notes` when: something is worth remembering but is not a decision or convention, an idea surfaces that needs further thought, a side observation is made during other work.

### context

Store session-specific and project-specific state information that helps maintain continuity.

```
Category: context
Content: Currently refactoring the notification module. Completed email service extraction, still need to extract push notification logic and add queue-based processing.
Tags: notifications, refactor, in-progress
```

Use `context` when: tracking progress on multi-session work, recording the current state of an ongoing task, saving what was done and what remains.

### bugs

Store bug observations, reproduction steps, and investigation notes before they become formal issues.

```
Category: bugs
Content: Login fails silently when email contains a plus sign (e.g., user+test@example.com). The validation regex strips the plus. Found in auth/validators.ts line 42.
Tags: auth, validation, email, regression
```

Use `bugs` when: a bug is discovered during development, reproduction steps are identified, a root cause is found but not yet fixed.

## Tagging Strategy

Apply tags to every memory entry to enable retrieval and filtering. Follow these rules:

**Required tags:**
- At least one **module tag** identifying the part of the system (e.g., `auth`, `billing`, `ui`, `api`)
- At least one **topic tag** describing the subject matter (e.g., `database`, `testing`, `performance`)

**Optional but recommended tags:**
- **Status tags** for ongoing items: `in-progress`, `blocked`, `resolved`, `deferred`
- **Priority tags** for urgency: `critical`, `important`, `low-priority`
- **Session tags** for time-based grouping: `session-2024-03-15`, `sprint-12`

**Tagging rules:**
- Use lowercase, hyphenated tags: `error-handling`, not `ErrorHandling`
- Keep tags short and reusable: `auth` not `authentication-module-v2`
- Limit to 3-5 tags per entry to maintain signal quality
- Reuse existing tags before creating new ones; check what tags are already in use
- Never use overly generic tags alone (`code`, `stuff`, `misc`); always pair with a specific tag

## Session Workflow

Follow this three-phase pattern for every working session:

### Phase 1: Session Start -- Load Context

At the beginning of a session, retrieve relevant memory to establish context:

1. Load recent entries from the `context` category to understand where work left off
2. Load `decisions` and `conventions` related to the current module or feature being worked on
3. Check `bugs` for any unresolved issues in the area of focus
4. Review `notes` tagged with `in-progress` or `deferred`

This step prevents duplicate work, forgotten decisions, and inconsistent approaches. Never start significant work without loading relevant memory first.

### Phase 2: During Work -- Update Memory

As work progresses, store new information in real time:

- When a decision is made, immediately store it in `decisions` with reasoning
- When a new pattern is established, store it in `conventions`
- When a bug is found, store reproduction details in `bugs`
- When stopping mid-task, store the current state in `context`
- When an interesting idea surfaces, capture it in `notes`

Do not wait until the end of a session to store information. Context is lost as the session progresses. Capture entries as they happen.

### Phase 3: Session End -- Save State

Before ending a session, ensure continuity for the next session:

1. Update or create a `context` entry summarizing what was accomplished
2. List any unfinished work with clear next steps
3. Mark resolved `bugs` entries with a `resolved` status tag
4. Promote any `notes` that became decisions to the `decisions` category
5. Flag any memory entries that should be converted to formal documentation

Write the end-of-session context entry as if briefing someone who has no memory of the current session. Be specific about file paths, function names, and remaining tasks.

## Memory Hygiene

Maintain memory quality with these practices:

- **Review periodically:** Every few sessions, scan memory for stale entries. Remove or archive entries that are no longer relevant.
- **Promote to docs:** When a `decisions` or `conventions` entry becomes important enough for the team, convert it into a formal document and remove the memory entry.
- **Consolidate duplicates:** If multiple entries cover the same topic, merge them into a single clear entry.
- **Expire temporary context:** Remove `context` entries from completed work. Do not accumulate finished task states.
- **Keep entries atomic:** Each memory entry should cover one topic. Do not combine unrelated information in a single entry.

The goal is to keep memory lean and high-signal. A memory system with hundreds of stale entries is worse than no memory system at all.
