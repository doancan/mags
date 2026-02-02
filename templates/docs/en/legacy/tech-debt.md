---
title: "{{project_name}}: Tech Debt Registry"
version: "1.0"
status: draft
author: "{{author}}"
last_updated: "{{date}}"
tags: [legacy, tech-debt, maintenance]
---

# Tech Debt Registry

## Overview

This document tracks known technical debt across the project. Each item is assessed for its ongoing cost ("interest"), remediation effort, and priority.

## Tech Debt Inventory

| ID | Component | Description | Interest/Cost | Effort | Priority | Status |
|----|-----------|-------------|---------------|--------|----------|--------|
| TD-001 | {{component}} | {{description}} | {{interest}} | {{effort}} | {{priority}} | Open |
| TD-002 | {{component}} | {{description}} | {{interest}} | {{effort}} | {{priority}} | Open |
| TD-003 | {{component}} | {{description}} | {{interest}} | {{effort}} | {{priority}} | Open |
| TD-004 | {{component}} | {{description}} | {{interest}} | {{effort}} | {{priority}} | Open |
| TD-005 | {{component}} | {{description}} | {{interest}} | {{effort}} | {{priority}} | Open |

## Categories

### Code Quality

| ID | Issue | Location | Impact |
|----|-------|----------|--------|
| | | | |

### Architecture

| ID | Issue | Location | Impact |
|----|-------|----------|--------|
| | | | |

### Dependencies

| ID | Issue | Current Version | Latest Version | Risk |
|----|-------|----------------|----------------|------|
| | | | | |

### Testing

| ID | Issue | Coverage Gap | Risk |
|----|-------|-------------|------|
| | | | |

### Infrastructure

| ID | Issue | Component | Impact |
|----|-------|-----------|--------|
| | | | |

### Security

| ID | Issue | Severity | Compliance Impact |
|----|-------|----------|-------------------|
| | | | |

## Prioritization Criteria

### Interest/Cost Rating

| Rating | Description | Examples |
|--------|-------------|---------|
| **Critical** | Actively causing incidents or blocking development | Production outages, security vulnerabilities |
| **High** | Significant slowdown to development velocity | Every feature takes 2x longer due to workarounds |
| **Medium** | Noticeable friction but manageable | Manual processes that could be automated |
| **Low** | Minor inconvenience | Code style inconsistencies, minor duplication |

### Effort Rating

| Rating | Description | Time Estimate |
|--------|-------------|--------------|
| **XS** | Trivial fix | < 1 day |
| **S** | Small, well-scoped change | 1-3 days |
| **M** | Moderate refactoring | 1-2 weeks |
| **L** | Significant rework | 2-4 weeks |
| **XL** | Major architectural change | 1+ months |

### Priority Matrix

| | Low Interest | Medium Interest | High Interest | Critical Interest |
|--|-------------|----------------|--------------|-------------------|
| **XS Effort** | P4 | P3 | P2 | P1 |
| **S Effort** | P4 | P3 | P2 | P1 |
| **M Effort** | P5 | P4 | P3 | P2 |
| **L Effort** | P5 | P4 | P3 | P2 |
| **XL Effort** | P5 | P5 | P4 | P3 |

### Priority Definitions

| Priority | Action | Timeline |
|----------|--------|----------|
| **P1** | Fix immediately | This sprint |
| **P2** | Schedule soon | Next 1-2 sprints |
| **P3** | Plan for quarter | This quarter |
| **P4** | Backlog | When convenient |
| **P5** | Track only | Revisit periodically |

## Debt Reduction Plan

### Current Sprint Targets

- [ ] TD-XXX: {{description}}
- [ ] TD-XXX: {{description}}

### This Quarter Goals

- [ ] Reduce critical debt items to zero
- [ ] Address all P2 items in {{component}}
- [ ] Improve test coverage from {{current}}% to {{target}}%

### Metrics

| Metric | Current | Target | Measured By |
|--------|---------|--------|-------------|
| Total debt items | {{count}} | {{target}} | This registry |
| Critical items | {{count}} | 0 | This registry |
| Test coverage | {{current}}% | {{target}}% | CI pipeline |
| Build time | {{current}} | {{target}} | CI pipeline |
| Dependency age (avg) | {{current}} | < 6 months | Dependency scanner |

## Process

### Adding New Debt

When knowingly introducing tech debt:

1. Create entry in this registry
2. Add `// TODO(tech-debt): TD-XXX - description` comment in code
3. Set priority using the matrix above
4. Assign an owner

### Reviewing Debt

- **Weekly**: Review P1 and P2 items in sprint planning
- **Monthly**: Review full registry, update priorities
- **Quarterly**: Assess trends, adjust reduction targets

### Resolving Debt

1. Move status to "In Progress"
2. Implement fix with tests
3. Remove `TODO` comments from code
4. Move status to "Resolved" with resolution date
5. Document lessons learned if applicable
