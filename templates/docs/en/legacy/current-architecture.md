---
title: "{{project_name}}: Current Architecture"
version: "1.0"
status: draft
author: "{{author}}"
last_updated: "{{date}}"
tags: [legacy, architecture, reverse-engineered]
---

# Current Architecture

> **Note:** This document has been reverse-engineered from the existing codebase. It represents our best understanding of the system as it exists today, not how it was originally designed. Some details may be incomplete or approximate.

## System Overview

High-level description of what the system does and its primary purpose.

### System Overview Diagram

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client     │────>│   Gateway   │────>│  Service A   │
│  (Browser)   │     │  / Proxy    │     │             │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                          ┌────────────────────┤
                          │                    │
                    ┌─────▼─────┐       ┌─────▼─────┐
                    │ Service B  │       │ Database   │
                    │            │       │            │
                    └─────┬─────┘       └────────────┘
                          │
                    ┌─────▼─────┐
                    │ Service C  │
                    │            │
                    └────────────┘
```

_Replace with actual system diagram._

## Component Inventory

| Component | Technology | Version | Purpose | Health | Owner |
|-----------|-----------|---------|---------|--------|-------|
| {{component_1}} | {{tech}} | {{version}} | {{purpose}} | {{health}} | {{owner}} |
| {{component_2}} | {{tech}} | {{version}} | {{purpose}} | {{health}} | {{owner}} |
| {{component_3}} | {{tech}} | {{version}} | {{purpose}} | {{health}} | {{owner}} |
| {{component_4}} | {{tech}} | {{version}} | {{purpose}} | {{health}} | {{owner}} |
| {{component_5}} | {{tech}} | {{version}} | {{purpose}} | {{health}} | {{owner}} |

### Health Rating

| Rating | Meaning |
|--------|---------|
| Good | Stable, maintained, no known issues |
| Fair | Works but showing age, minor issues |
| Poor | Frequent issues, difficult to maintain |
| Critical | Actively causing problems, needs immediate attention |

## Dependency Map

### Internal Dependencies

| Component | Depends On | Communication | Protocol |
|-----------|-----------|---------------|----------|
| {{component_1}} | {{component_2}} | {{sync/async}} | {{protocol}} |
| {{component_2}} | {{component_3}} | {{sync/async}} | {{protocol}} |
| {{component_3}} | {{component_4}} | {{sync/async}} | {{protocol}} |

### External Dependencies

| Dependency | Type | Version | Purpose | Risk |
|-----------|------|---------|---------|------|
| {{external_1}} | SaaS / Library / API | {{version}} | {{purpose}} | {{risk}} |
| {{external_2}} | SaaS / Library / API | {{version}} | {{purpose}} | {{risk}} |

### Dependency Diagram

```
Component A ──HTTP──> Component B ──SQL──> Database
     │                     │
     └──AMQP──> Queue ────┘
                   │
            Component C ──HTTP──> External API
```

_Replace with actual dependency diagram._

## Data Flow

### Primary Data Flows

| Flow Name | Source | Destination | Data Type | Volume | Frequency |
|-----------|--------|-------------|-----------|--------|-----------|
| {{flow_1}} | {{source}} | {{dest}} | {{type}} | {{volume}} | {{freq}} |
| {{flow_2}} | {{source}} | {{dest}} | {{type}} | {{volume}} | {{freq}} |

### Data Stores

| Store | Technology | Size | Backup | Retention |
|-------|-----------|------|--------|-----------|
| {{store_1}} | {{tech}} | {{size}} | {{backup}} | {{retention}} |
| {{store_2}} | {{tech}} | {{size}} | {{backup}} | {{retention}} |

## Pain Points

### Critical Issues

| ID | Issue | Impact | Component | Frequency |
|----|-------|--------|-----------|-----------|
| P-001 | {{issue}} | {{impact}} | {{component}} | {{frequency}} |
| P-002 | {{issue}} | {{impact}} | {{component}} | {{frequency}} |

### Development Friction

| Issue | Impact | Workaround |
|-------|--------|-----------|
| {{issue_1}} | {{impact}} | {{workaround}} |
| {{issue_2}} | {{impact}} | {{workaround}} |

### Operational Concerns

| Concern | Current State | Desired State |
|---------|--------------|---------------|
| Deployment | {{current}} | {{desired}} |
| Monitoring | {{current}} | {{desired}} |
| Scaling | {{current}} | {{desired}} |
| Recovery | {{current}} | {{desired}} |

## Constraints

### Technical Constraints

| Constraint | Description | Impact | Negotiable? |
|-----------|-------------|--------|-------------|
| {{constraint_1}} | {{description}} | {{impact}} | Yes / No |
| {{constraint_2}} | {{description}} | {{impact}} | Yes / No |

### Business Constraints

| Constraint | Description | Impact |
|-----------|-------------|--------|
| {{constraint_1}} | {{description}} | {{impact}} |
| {{constraint_2}} | {{description}} | {{impact}} |

### Regulatory / Compliance

| Requirement | Standard | Current Status | Gap |
|-------------|----------|---------------|-----|
| {{requirement}} | {{standard}} | {{status}} | {{gap}} |

## Knowledge Gaps

Areas where documentation or understanding is incomplete:

- [ ] {{gap_1}}
- [ ] {{gap_2}}
- [ ] {{gap_3}}

## Discovery Log

| Date | Finding | Source | Impact |
|------|---------|--------|--------|
| {{date}} | {{finding}} | Code review / Interview / Monitoring | {{impact}} |
