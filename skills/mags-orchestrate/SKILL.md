---
name: mags-orchestrate
description: PRD analysis, codebase analysis, and execution plan management
version: 1.0.0
user-invocable: true
allowed-tools:
  - mcp__mags_mags__mags_parse_prd
  - mcp__mags_mags__mags_analyze_codebase
  - mcp__mags_mags__mags_generate_skill
  - mcp__mags_mags__mags_generate_agent
  - mcp__mags_mags__mags_init_execution
  - mcp__mags_mags__mags_execute_step
  - mcp__mags_mags__mags_get_current_step
  - mcp__mags_mags__mags_get_execution_status
  - mcp__mags_mags__mags_resume_execution
  - mcp__mags_mags__mags_verify_module
  - AskUserQuestion
  - Read
  - Glob
  - Bash
---

# MAGS Orchestrate

Orchestrate PRD-driven development: parse requirements, analyze your codebase, create execution plans, and run them step by step.

## Steps

### 1. Ask what to do

Use `AskUserQuestion` with the following options:

**Question:** "What would you like to do?"

| Option | Description |
|--------|-------------|
| **PRD Analysis** | Parse a PRD document to extract features, modules, and requirements |
| **Codebase Analysis** | Analyze your codebase for tech debt, endpoints, and schema |
| **Create Execution Plan** | Generate a step-by-step execution plan from your PRD |
| **Run / Resume Plan** | Execute or resume an existing execution plan |

### 2A. PRD Analysis

If the user chose "PRD Analysis":

1. Call `mags_parse_prd` to parse the PRD document
2. Display the extracted:
   - Features and modules
   - Requirements and priorities
   - Dependencies between modules
3. Ask if the user wants to proceed with creating an execution plan

### 2B. Codebase Analysis

If the user chose "Codebase Analysis":

1. Call `mags_analyze_codebase` to scan the project
2. Display:
   - Tech debt items found
   - Endpoints discovered
   - Schema/data model overview
3. Suggest next steps: fix tech debt, update docs, or create a migration plan

### 2C. Create Execution Plan

If the user chose "Create Execution Plan":

1. If PRD hasn't been parsed yet, call `mags_parse_prd` first
2. Call `mags_init_execution` to create the execution plan
3. Display the plan with all steps, their order, and dependencies
4. Ask if the user wants to start executing

### 2D. Run / Resume Plan

If the user chose "Run / Resume Plan":

1. Call `mags_get_execution_status` to check current state
2. If no execution exists, inform the user and suggest "Create Execution Plan" first
3. If execution is paused or failed, call `mags_resume_execution`
4. If execution is in progress, call `mags_get_current_step` to show where we are
5. Call `mags_execute_step` to execute the next step
6. After each step, show progress and ask if the user wants to continue

### 3. Post-action summary

After any action, display:
- What was done
- Current execution progress (if applicable)
- Suggested next step

**Related:** See [Orchestrator Guide](../docs/orchestrator-guide.md) for detailed documentation.

---

**Related commands:**
| Command | Description |
|---------|-------------|
| `/mags-status` | See overall project progress |
| `/mags-docs-validate` | Validate documentation consistency |
| `/mags-help` | See all available commands |
