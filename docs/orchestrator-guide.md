# Orchestrator Guide

MAGS includes an advanced **Orchestrator Subsystem** for PRD-driven development. It parses Product Requirements Documents, generates development artifacts (skills, agents), and manages execution state.

## Overview

The orchestrator enables:
- **PRD Parsing** — Extract modules, features, and dependencies from structured PRDs
- **Skill Generation** — Auto-generate development skills for each module
- **Agent Generation** — Create builder agents based on PRD requirements
- **Codebase Analysis** — Deep analysis for tech debt, endpoints, and patterns
- **Execution Management** — Step-by-step implementation with state persistence
- **TDD Verification** — Run tests and verify acceptance criteria

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Project Orchestrator                        │
│                    (services/orchestrator/index.ts)             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ PRD Parser  │  │   Code      │  │   Generators            │ │
│  │             │  │   Analyzer  │  │   (Skill, Agent)        │ │
│  └──────┬──────┘  └──────┬──────┘  └────────────┬────────────┘ │
│         │                │                      │              │
│         ▼                ▼                      ▼              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Plan Executor                         │   │
│  │              (step sequencing, state management)         │   │
│  └──────────────────────────┬──────────────────────────────┘   │
│                             │                                   │
│                             ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                      TDD Engine                          │   │
│  │           (test running, coverage verification)          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Services

### PRD Parser (`prd-parser.ts`)

Parses structured PRD documents and extracts:
- Project name and overview
- Modules with features and priorities
- Dependencies between modules
- Phase assignments

**Expected PRD Structure:**
```markdown
---
title: Project PRD
status: DRAFT
---

# Project Name

## Overview
Brief project description.

## Module: Auth
Priority: 1
Phase: 1
Dependencies: none

### Features
- M1-001: User login
- M1-002: User registration
- M1-003: Password reset

## Module: API
Priority: 2
Phase: 1
Dependencies: Auth

### Features
- M2-001: REST endpoints
- M2-002: Rate limiting
```

**Usage:**
```typescript
import { createPrdParser } from './services/orchestrator/index.js';

const parser = createPrdParser();
const plan = await parser.parse('docs/prd.md');

console.log(plan.modules);     // [{ name: 'Auth', features: [...] }, ...]
console.log(plan.dependencyGraph); // { 'API': ['Auth'] }
```

### Code Analyzer (`code-analyzer.ts`)

Performs deep analysis of existing codebases:

- **Module Discovery** — Scans `src/modules`, `src/features`, etc.
- **Endpoint Extraction** — Finds NestJS and Express routes
- **Table Discovery** — Parses Prisma schemas
- **Tech Debt Detection** — Finds TODO, FIXME, HACK, BUG markers
- **Stack Detection** — Identifies frameworks and databases
- **Pattern Detection** — Recognizes repository, service, controller patterns

**Usage:**
```typescript
import { createCodeAnalyzer } from './services/orchestrator/index.js';

const analyzer = createCodeAnalyzer('/path/to/project');
const analysis = await analyzer.analyze();

console.log(analysis.modules);    // Discovered modules
console.log(analysis.endpoints);  // Found endpoints
console.log(analysis.techDebt);   // Tech debt items
console.log(analysis.stack);      // Detected stack

// Generate reverse PRD from existing code
const reversePrd = await analyzer.generateReversePrd();
```

### Skill Generator (`skill-generator.ts`)

Generates development skills from PRD modules:

```typescript
import { createSkillGenerator, createPrdParser } from './services/orchestrator/index.js';

const parser = createPrdParser();
const plan = await parser.parse('docs/prd.md');

const generator = createSkillGenerator();
const authModule = plan.modules.find(m => m.name === 'auth');
const skill = await generator.generateModuleSkill(authModule, plan);

console.log(skill.name);     // 'auth-development'
console.log(skill.path);     // 'skills/auth-development/SKILL.md'
console.log(skill.content);  // Full skill markdown content
```

### Agent Generator (`agent-generator.ts`)

Generates builder agents for modules:

```typescript
import { createAgentGenerator, createPrdParser } from './services/orchestrator/index.js';

const parser = createPrdParser();
const plan = await parser.parse('docs/prd.md');

const generator = createAgentGenerator();
const authModule = plan.modules.find(m => m.name === 'auth');
const agent = await generator.generateModuleAgent(authModule, plan);

console.log(agent.name);    // 'auth-builder'
console.log(agent.type);    // 'module-builder'
console.log(agent.content); // Full agent markdown content
```

### Plan Executor (`plan-executor.ts`)

Manages step-by-step execution:

- Sequences steps based on dependencies
- Persists execution state to `.mags/execution-state.json`
- Supports pause/resume functionality
- Tracks completed/pending/blocked steps

**Actions:**
- `a` — Approve current step
- `s` — Skip current step
- `r` — Retry failed step
- `n` — Move to next step
- `p` — Move to previous step
- `q` — Quit execution

### TDD Engine (`tdd-engine.ts`)

Verifies module implementation:

```typescript
import { createTddEngine } from './services/orchestrator/index.js';

const engine = createTddEngine('/project/root', '.mags');

// Quick verify (just runs tests)
const quickResult = await engine.quickVerify('auth');
console.log(quickResult.passed, quickResult.failed);

// Full verify with PRD (checks acceptance criteria)
const fullReport = await engine.verify(authModule);
const requirements = engine.meetsRequirements(fullReport);
console.log(requirements.passes, requirements.reasons);
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `mags_parse_prd` | Parse PRD and extract plan |
| `mags_analyze_codebase` | Deep codebase analysis |
| `mags_generate_skill` | Generate module skill |
| `mags_generate_agent` | Generate module agent |
| `mags_init_execution` | Initialize execution from PRD |
| `mags_execute_step` | Execute action on current step |
| `mags_get_current_step` | Get current step details |
| `mags_get_execution_status` | Get execution progress |
| `mags_resume_execution` | Resume from saved state |
| `mags_verify_module` | Run TDD verification |

## Workflow Example

### 1. Parse PRD

```
User: Parse my PRD at docs/prd.md
Claude: [calls mags_parse_prd]

Result:
- Project: my-app
- Modules: auth, api, database
- Total Features: 23
- Phases: 3
```

### 2. Analyze Existing Code (for brownfield projects)

```
User: Analyze the current codebase
Claude: [calls mags_analyze_codebase]

Result:
- 5 modules discovered
- 45 endpoints found
- 12 tables in schema
- 8 tech debt items
```

### 3. Generate Skills

```
User: Generate a skill for the auth module
Claude: [calls mags_generate_skill with moduleName: "auth"]

Result:
- Skill created at skills/auth-development/SKILL.md
- Includes feature checklist, acceptance criteria, dependencies
```

### 4. Initialize Execution

```
User: Start implementing from the PRD
Claude: [calls mags_init_execution]

Result:
- 45 steps created
- First step: Create auth module structure
```

### 5. Execute Steps

```
User: Approve this step
Claude: [calls mags_execute_step with action: "a"]

Result:
- Step approved
- Moving to step 2: Implement login endpoint
```

### 6. Verify Module

```
User: Verify the auth module is complete
Claude: [calls mags_verify_module with moduleName: "auth"]

Result:
- Tests: 25 passed, 3 failed
- Coverage: 78%
- Acceptance: 8/10 met
- Recommendation: Fix failing tests before proceeding
```

## State Persistence

Execution state is persisted to `.mags/execution-state.json`:

```json
{
  "status": "in_progress",
  "currentModule": "auth",
  "currentStep": 12,
  "completed": {
    "modules": ["database"],
    "steps": [1, 2, 3, ...]
  },
  "pending": {
    "steps": [12, 13, 14, ...]
  },
  "errors": [],
  "blockers": []
}
```

This allows resuming execution across sessions.

## Best Practices

1. **Structure your PRD properly** — Use the expected format with clear module sections, feature IDs, and dependencies.

2. **Run analysis first for brownfield projects** — Use `mags_analyze_codebase` before creating a PRD to understand existing structure.

3. **Generate skills before implementation** — Skills provide structured guidance for each module.

4. **Verify frequently** — Run `mags_verify_module` after implementing each module to catch issues early.

5. **Use execution state** — Let the orchestrator track progress; resume from saved state rather than restarting.
