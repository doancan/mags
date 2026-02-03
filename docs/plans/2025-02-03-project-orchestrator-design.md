---
title: "MAGS Project Orchestrator - Design Document"
version: "1.0"
status: draft
author: "Claude + User"
created: "2025-02-03"
---

# MAGS Project Orchestrator

Sıfırdan veya mevcut projelerden başlayarak PRD'den otomatik plan çıkaran, projeye uygun skill/agent üreten, her koşula adapte olabilen tam entegre proje yönetim sistemi.

## Design Decisions

| Karar | Seçim |
|-------|-------|
| Hedef Kullanıcı | Scalable (Solo → Ekip) |
| PRD Parsing | Strict Schema |
| Skill/Agent Üretimi | Fully Dynamic (LLM) |
| Plan Execution | Guided Step-by-Step |
| Brownfield Devralma | Deep Analysis First |
| Hata Recovery | Stop and Consult |
| Verification | Test-Driven (TDD) |
| State Persistence | File-Based (Git-Friendly) |

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    MAGS PROJECT ORCHESTRATOR                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   ANALYZER   │    │  GENERATOR   │    │   EXECUTOR   │       │
│  │              │    │              │    │              │       │
│  │ • PRD Parser │    │ • Skill Gen  │    │ • Step Runner│       │
│  │ • Code Scan  │    │ • Agent Gen  │    │ • TDD Engine │       │
│  │ • Reverse PRD│    │ • Plan Gen   │    │ • Checkpoint │       │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘       │
│         │                   │                   │                │
│         └───────────────────┼───────────────────┘                │
│                             │                                    │
│                    ┌────────▼────────┐                          │
│                    │  ORCHESTRATOR   │                          │
│                    │    CORE         │                          │
│                    │                 │                          │
│                    │ • State Machine │                          │
│                    │ • Decision Tree │                          │
│                    │ • Recovery Mgr  │                          │
│                    └────────┬────────┘                          │
│                             │                                    │
│         ┌───────────────────┼───────────────────┐               │
│         │                   │                   │                │
│  ┌──────▼───────┐    ┌──────▼───────┐    ┌──────▼───────┐       │
│  │    MEMORY    │    │   PROGRESS   │    │   SESSION    │       │
│  │   (Mevcut)   │    │   (Mevcut)   │    │   (Mevcut)   │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**3 Ana Katman:**
1. **Analyzer** - Projeyi anlar (PRD parse, code scan, reverse engineering)
2. **Generator** - Artifacts üretir (skill, agent, plan, backlog)
3. **Executor** - Planı uygular (guided steps, TDD, checkpoints)

---

## 2. PRD Parser (Strict Schema)

### PRD Schema Format

```markdown
# {project_name} — Product Requirements (PRD)

## Overview
{proje açıklaması}

## Modules

### M1: {module_name}
> {module açıklaması}

#### Features
| ID | Feature | Description | Priority | Phase |
|---|---|---|---|---|
| M1-001 | Login | Email/password auth | P0 | 1 |

#### Acceptance Criteria
- [ ] User can login with email/password

#### Dependencies
- Requires: [infrastructure]
- Blocks: [crm, dashboard]
```

### Parser Output

```typescript
interface ExtractedPlan {
  project: string;
  overview: string;
  modules: ExtractedModule[];
  phases: Phase[];
  totalFeatures: number;
  dependencyGraph: DependencyNode[];
}

interface ExtractedModule {
  id: string;           // "M1"
  name: string;         // "auth"
  description: string;
  features: Feature[];
  acceptanceCriteria: string[];
  dependencies: {
    requires: string[];
    blocks: string[];
  };
  phase: number;
  priority: "P0" | "P1" | "P2";
}
```

### Validation Rules

| Rule | Error |
|------|-------|
| Module ID format | `M{n}` zorunlu |
| Feature ID format | `{ModuleID}-{NNN}` zorunlu |
| Priority values | Sadece P0/P1/P2 |
| Phase values | Sadece 1/2/3 |
| Dependency reference | Tanımlı modüle işaret etmeli |
| Circular dependency | Hata ver |

---

## 3. Skill/Agent Generator (Fully Dynamic)

### Agent Yapısı

#### Core Agents (Sabit)

| Agent | Görevi |
|-------|--------|
| `project-manager` | Proje planlama, backlog yönetimi, önceliklendirme |
| `business-analyst` | PRD analizi, requirement çıkarma, user story |
| `backend-builder` | Backend servis/controller/repository oluşturma |
| `frontend-builder` | UI component, page, form oluşturma |
| `api-designer` | REST/GraphQL endpoint tasarımı, contract |
| `db-modeler` | Schema tasarımı, migration, index |
| `test-writer` | Unit/integration/e2e test yazımı |
| `doc-writer` | Teknik dokümantasyon, API docs |

#### Module Agents (Dinamik)

| Agent | Görevi |
|-------|--------|
| `{module}-builder` | Belirli modülün end-to-end geliştirmesi |

### Skill Yapısı

#### Core Skills
- `backend-dev`
- `frontend-dev`
- `api-dev`
- `database-dev`
- `testing`
- `documentation`

#### Module Skills
- `{module}-dev`

### Generated Skill Template

```markdown
---
name: {module}-dev
description: {module} modülü geliştirme rehberi
---

# {Module} Development Skill

## Context
{PRD'den çekilen modül açıklaması}

## Tech Stack
{Projeden algılanan stack}

## Features to Implement
{PRD'den çekilen feature listesi}

## Step-by-Step Guide
### Step 1: Setup
### Step 2: Data Model
### Step 3: API Endpoints
### Step 4: Business Logic
### Step 5: Testing (TDD)
### Step 6: Documentation

## Validation Checklist
{Acceptance criteria → checklist}
```

---

## 4. Plan Executor (Guided Step-by-Step)

### Execution Flow

```
Phase 1 (MVP)
    │
    ▼
Module Sequence: auth ──▶ tenant ──▶ crm ──▶ billing
    │
    ▼
Step Executor:
  1. Show step to user
  2. Wait for approval
  3. Execute step
  4. Run tests (TDD)
  5. Verify & checkpoint
  6. Next step or handle error
```

### Step Types

| Step Type | Açıklama |
|-----------|----------|
| `scaffold` | Dosya/klasör oluştur |
| `code` | Kod yaz |
| `test` | Test yaz ve çalıştır |
| `migrate` | Database migration |
| `config` | Konfigürasyon |
| `verify` | Doğrulama |
| `document` | Dokümantasyon |
| `checkpoint` | Milestone kaydet |

### User Interaction

```
┌────────────────────────────────────────────────────────────┐
│  STEP 3/12: Create Auth Service                            │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  📁 src/modules/auth/auth.service.ts                      │
│  📝 Login + Register + JWT                                 │
│                                                            │
├────────────────────────────────────────────────────────────┤
│  [a] Proceed   [e] Modify   [s] Skip   [d] Details   [q] Stop │
└────────────────────────────────────────────────────────────┘
```

### Keyboard Shortcuts

| Kısayol | Aksiyon |
|---------|---------|
| `a` | Approve / Accept |
| `e` | Edit / Modify |
| `s` | Skip |
| `r` | Retry / Re-scan |
| `n` | Next |
| `p` | Previous |
| `q` | Quit / Stop |
| `h` | Help |
| `d` | Details |
| `l` | List |

---

## 5. Deep Analysis (Brownfield)

### Analysis Pipeline

```
SCANNER          CODE PARSER       DB ANALYZER
    │                │                 │
    └────────────────┼─────────────────┘
                     │
                     ▼
              PATTERN DETECTOR
                     │
                     ▼
               REVERSE PRD
```

### Detection Capabilities

| Analiz Alanı | Tespit Edilenler |
|--------------|------------------|
| Modules | `src/modules/*`, `src/features/*` |
| API Endpoints | Controller routes, handlers |
| DB Schema | Prisma, TypeORM models |
| Dependencies | Import graph |
| Patterns | Repository, Service, Factory |
| Tech Debt | TODO/FIXME, deprecated |
| Test Coverage | Existing tests |
| Conventions | Naming, structure |

### Reverse PRD Output

```markdown
# {project} — Reverse PRD (Auto-Generated)

## Detected Stack
## Modules (Discovered)
## Dependency Graph
## Recommendations
```

---

## 6. TDD Verification Engine

### TDD Flow

```
1.TEST FIRST → 2.CODE IMPL → 3.RUN TESTS → 4.VERIFY
```

### Test Categories

| Kategori | Amaç |
|----------|------|
| `unit` | Tek fonksiyon/method |
| `integration` | Modüller arası |
| `e2e` | Full API flow |
| `isolation` | Tenant izolasyonu |
| `permission` | RBAC kontrolü |

### Verification Report

```yaml
module: auth
status: "passed"
tests:
  unit: { total: 12, passed: 12, coverage: 85% }
  integration: { total: 5, passed: 5 }
  isolation: { total: 3, passed: 3 }
acceptance:
  - criteria: "User can login"
    status: "verified"
```

---

## 7. Error Recovery (Stop & Consult)

### Error Categories

| Seviye | Davranış |
|--------|----------|
| 🟢 `info` | Log, devam |
| 🟡 `warning` | Göster, devam |
| 🔴 `error` | Dur, danış |
| ⛔ `blocker` | Dur, çözüm öner |

### Error UI

```
┌────────────────────────────────────────────────────────────┐
│  ⛔ BLOCKER: Database Connection Failed                    │
├────────────────────────────────────────────────────────────┤
│  💡 Suggested fixes:                                       │
│  • Run: docker-compose up -d postgres                      │
├────────────────────────────────────────────────────────────┤
│  [r] Retry   [e] Edit   [s] Skip   [q] Stop & save        │
└────────────────────────────────────────────────────────────┘
```

### Learning

Her çözüm memory'ye kaydedilir, aynı hata tekrarında önerilir.

---

## 8. State Persistence (File-Based)

### File Structure

```
docs/.mags/
├── config.yaml
├── plans/
│   ├── extracted-plan.yaml
│   └── execution-state.yaml
├── generated/
│   ├── skills/
│   └── agents/
├── progress/
│   └── modules/
├── verification/
├── memory/
└── sessions/
```

### Git Integration

- Her checkpoint'te auto-commit
- Module branch strategy
- Merge on complete

---

## 9. MCP Tools (Yeni)

| Tool | Açıklama |
|------|----------|
| `mags_parse_prd` | PRD'den plan çıkar |
| `mags_analyze_codebase` | Deep analysis |
| `mags_generate_skill` | Dinamik skill üret |
| `mags_generate_agent` | Dinamik agent üret |
| `mags_execute_step` | Tek adım çalıştır |
| `mags_verify_step` | TDD verification |
| `mags_checkpoint` | State kaydet |
| `mags_recover` | Hata recovery |
| `mags_get_execution_state` | Mevcut durum |
| `mags_resume` | Kaldığı yerden devam |

---

## 10. New Services

| Service | Dosya | Görev |
|---------|-------|-------|
| `PrdParser` | `prd-parser.ts` | PRD → ExtractedPlan |
| `CodeAnalyzer` | `code-analyzer.ts` | Codebase → Analysis |
| `SkillGenerator` | `skill-generator.ts` | Plan → Skills |
| `AgentGenerator` | `agent-generator.ts` | Plan → Agents |
| `PlanExecutor` | `plan-executor.ts` | Plan → Execution |
| `TddEngine` | `tdd-engine.ts` | Test verification |
| `RecoveryManager` | `recovery-manager.ts` | Error handling |
| `OrchestratorCore` | `orchestrator.ts` | Ana koordinatör |

---

## 11. Implementation Phases

### Phase 1: Foundation
- [ ] PRD Parser (strict schema)
- [ ] ExtractedPlan types
- [ ] Basic execution state

### Phase 2: Generators
- [ ] Skill Generator (dynamic)
- [ ] Agent Generator (dynamic)
- [ ] Core agents/skills

### Phase 3: Executor
- [ ] Step executor
- [ ] User interaction (shortcuts)
- [ ] Checkpoint system

### Phase 4: Analysis
- [ ] Code analyzer
- [ ] Reverse PRD generator
- [ ] Deep analysis pipeline

### Phase 5: Verification
- [ ] TDD engine
- [ ] Coverage tracking
- [ ] Verification reports

### Phase 6: Recovery
- [ ] Error classification
- [ ] Stop & consult flow
- [ ] Learning system

### Phase 7: Integration
- [ ] MCP tools
- [ ] CLI commands
- [ ] Full workflow test

---

## Appendix: Full File Structure

```
server/src/
├── services/
│   ├── orchestrator/
│   │   ├── orchestrator.ts
│   │   ├── prd-parser.ts
│   │   ├── code-analyzer.ts
│   │   ├── skill-generator.ts
│   │   ├── agent-generator.ts
│   │   ├── plan-executor.ts
│   │   ├── tdd-engine.ts
│   │   └── recovery-manager.ts
│   └── ... (existing)
├── tools/
│   ├── orchestrator-tools.ts
│   └── ... (existing)
└── types/
    ├── orchestrator.ts
    └── ... (existing)
```
