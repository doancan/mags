---
title: "ADR: {{title}}"
version: "1.0"
status: draft
author: "{{author}}"
last_updated: "{{date}}"
tags: [adr, legacy, reverse-engineered]
---

# ADR: {{title}}

> **Note:** This ADR has been reverse-engineered from the existing codebase. It documents a decision that was made in the past, reconstructed from code analysis, commit history, and team interviews. The original rationale may be approximate.

## Status

**{{adr_status}}**

Options: Accepted | Superseded | Deprecated

| Field | Value |
|-------|-------|
| Date (estimated) | {{decision_date}} |
| Discovered | {{discovery_date}} |
| Deciders (if known) | {{deciders}} |
| Superseded by | {{superseded_by}} (if applicable) |

## Context

Describe the situation and forces at play when this decision was made. Include:

- What problem was being solved?
- What constraints existed at the time?
- What was the state of the system?

{{context}}

### Evidence Sources

| Source | Details |
|--------|---------|
| Code artifacts | {{code_references}} |
| Commit history | {{commit_references}} |
| Configuration | {{config_references}} |
| Team interviews | {{interview_notes}} |

## Decision

Describe the decision that was made:

{{decision}}

### Alternatives Considered (if known)

| Alternative | Pros | Cons | Why Not Chosen |
|------------|------|------|---------------|
| {{alt_1}} | {{pros}} | {{cons}} | {{reason}} |
| {{alt_2}} | {{pros}} | {{cons}} | {{reason}} |

## Consequences

### Positive

- {{positive_1}}
- {{positive_2}}
- {{positive_3}}

### Negative

- {{negative_1}}
- {{negative_2}}
- {{negative_3}}

### Tech Debt Introduced

| Debt Item | Description | Impact | Registry ID |
|-----------|-------------|--------|-------------|
| {{debt_1}} | {{description}} | {{impact}} | TD-XXX |
| {{debt_2}} | {{description}} | {{impact}} | TD-XXX |

## Current Assessment

### Still Valid?

Is this decision still appropriate given the current context?

| Aspect | Assessment |
|--------|-----------|
| Original problem still exists? | Yes / No / Partially |
| Constraints still apply? | Yes / No / Changed |
| Better alternatives now available? | Yes / No |
| Overall validity | **Valid / Questionable / Invalid** |

{{validity_notes}}

### Should Revisit?

| Factor | Details |
|--------|---------|
| Reason to revisit | {{revisit_reason}} |
| Trigger condition | {{trigger}} |
| Recommended timeline | {{timeline}} |

### Migration Priority

**{{migration_priority}}**

| Priority | Meaning | Action |
|----------|---------|--------|
| **High** | Decision is actively harmful; address in current quarter | Immediate planning |
| **Medium** | Decision is suboptimal; address when touching this area | Opportunistic improvement |
| **Low** | Decision is acceptable; revisit during major refactoring | Track only |

### Recommended Action

{{recommended_action}}

## Related

- Related ADRs: {{related_adrs}}
- Related tech debt items: {{related_debt}}
- Related migration plan phases: {{related_phases}}
