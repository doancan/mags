---
title: "{{project_name}}: Migration Plan"
version: "1.0"
status: draft
author: "{{author}}"
last_updated: "{{date}}"
tags: [legacy, migration, strategy]
---

# Migration Plan

## Executive Summary

Brief overview of the migration initiative, its business justification, and expected outcomes.

## Migration Strategy

### Strategy Selection

| Strategy | Description | Selected |
|----------|-------------|----------|
| Strangler Fig | Incrementally replace legacy components behind a facade | |
| Big Bang | Complete replacement deployed at once | |
| Hybrid | Combination of incremental and parallel approaches | |

### Strategy Comparison

| Criteria | Strangler Fig | Big Bang | Hybrid |
|----------|--------------|----------|--------|
| **Risk** | Low (incremental) | High (all at once) | Medium |
| **Duration** | Long (months-years) | Short (weeks-months) | Medium |
| **Complexity** | Medium (routing layer) | Low (clean cut) | High |
| **Rollback** | Easy (per component) | Hard (all or nothing) | Medium |
| **Dual maintenance** | Yes (during migration) | No | Partial |
| **User disruption** | Minimal | Significant (cutover) | Moderate |
| **Best for** | Large, complex systems | Small, well-understood systems | Mixed constraints |

### Pros and Cons of Selected Strategy

**Pros:**
- {{pro_1}}
- {{pro_2}}
- {{pro_3}}

**Cons:**
- {{con_1}}
- {{con_2}}
- {{con_3}}

## Migration Phases

| Phase | Name | Components | Duration | Dependencies | Status |
|-------|------|-----------|----------|-------------|--------|
| 1 | {{phase_1_name}} | {{components}} | {{duration}} | None | Not Started |
| 2 | {{phase_2_name}} | {{components}} | {{duration}} | Phase 1 | Not Started |
| 3 | {{phase_3_name}} | {{components}} | {{duration}} | Phase 2 | Not Started |
| 4 | {{phase_4_name}} | {{components}} | {{duration}} | Phase 3 | Not Started |

### Phase Details

#### Phase 1: {{phase_1_name}}

**Scope:**
- Component A
- Component B

**Approach:**
1. Step 1
2. Step 2
3. Step 3

**Acceptance Criteria:**
- [ ] Criterion 1
- [ ] Criterion 2

**Estimated Effort:** {{effort}}

---

#### Phase 2: {{phase_2_name}}

**Scope:**
- Component C
- Component D

**Approach:**
1. Step 1
2. Step 2

**Acceptance Criteria:**
- [ ] Criterion 1
- [ ] Criterion 2

**Estimated Effort:** {{effort}}

## Data Migration

| Data Set | Source | Target | Volume | Strategy | Downtime Required |
|----------|--------|--------|--------|----------|-------------------|
| {{data_set_1}} | {{source}} | {{target}} | {{volume}} | {{strategy}} | {{downtime}} |
| {{data_set_2}} | {{source}} | {{target}} | {{volume}} | {{strategy}} | {{downtime}} |

### Data Migration Steps

1. **Schema mapping** - Map source schema to target schema
2. **ETL development** - Build extraction, transformation, loading pipelines
3. **Dry run** - Test with production data copy
4. **Validation** - Compare source and target data integrity
5. **Cutover** - Execute final migration with minimal downtime

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation | Owner |
|------|-----------|--------|-----------|-------|
| Data loss during migration | Medium | Critical | Backup + validation checksums | {{owner}} |
| Extended downtime | Low | High | Blue-green deployment | {{owner}} |
| Performance degradation | Medium | Medium | Load testing before cutover | {{owner}} |
| Integration failures | High | Medium | Contract testing, feature flags | {{owner}} |
| Team knowledge gaps | Medium | Medium | Training, documentation, pairing | {{owner}} |

## Rollback Plan

### Rollback Triggers

- [ ] Error rate exceeds {{threshold}}% in production
- [ ] Data integrity check fails
- [ ] Performance degrades beyond SLA thresholds
- [ ] Critical business functionality is broken

### Rollback Procedure

| Step | Action | Responsible | Time Estimate |
|------|--------|------------|---------------|
| 1 | Activate rollback decision | Tech Lead | Immediate |
| 2 | Switch traffic back to legacy | DevOps | {{time}} |
| 3 | Reverse data sync (if applicable) | DBA | {{time}} |
| 4 | Verify legacy system health | QA | {{time}} |
| 5 | Communicate status to stakeholders | PM | {{time}} |

### Point of No Return

Define the point after which rollback is no longer feasible:
- {{point_of_no_return}}

## Success Criteria

| Criterion | Metric | Target | Measurement |
|-----------|--------|--------|-------------|
| Performance | Response time (p95) | < {{target}} ms | APM monitoring |
| Reliability | Error rate | < {{target}}% | Error tracking |
| Data integrity | Record count match | 100% | Validation script |
| Feature parity | User stories passing | 100% | Test suite |
| User adoption | Active users post-migration | >= pre-migration | Analytics |

## Timeline

```
Week 1-2:   Planning & setup
Week 3-4:   Phase 1 development
Week 5:     Phase 1 testing & validation
Week 6:     Phase 1 cutover
Week 7-8:   Phase 2 development
Week 9:     Phase 2 testing & validation
Week 10:    Phase 2 cutover
...
Week N:     Legacy decommission
```

## Communication Plan

| Audience | Channel | Frequency | Content |
|----------|---------|-----------|---------|
| Engineering | Slack / Stand-up | Daily | Progress, blockers |
| Stakeholders | Status report | Weekly | Summary, risks, timeline |
| Users | Email / In-app | Per phase cutover | What changed, action needed |
| Operations | Runbook | Per phase | Monitoring, rollback steps |
