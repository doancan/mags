// ============================================
// MAGS — Project Orchestrator E2E Tests
// En zorlu ve karmaşık senaryolar
// ============================================

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

import { PrdParser, createPrdParser } from "./prd-parser.js";
import { SkillGenerator, createSkillGenerator } from "./skill-generator.js";
import { AgentGenerator, createAgentGenerator } from "./agent-generator.js";
import { PlanExecutor, createPlanExecutor, parseShortcut } from "./plan-executor.js";
import { CodeAnalyzer, createCodeAnalyzer } from "./code-analyzer.js";
import { TddEngine, createTddEngine } from "./tdd-engine.js";
import { createOrchestrator, Orchestrator } from "./index.js";
import type { ExtractedPlan, ExtractedModule } from "../../types/orchestrator.js";

// --- Test Helpers ---

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "mags-orchestrator-e2e-"));
}

function writeFile(dir: string, relativePath: string, content: string): string {
  const fullPath = path.join(dir, relativePath);
  const dirPath = path.dirname(fullPath);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  fs.writeFileSync(fullPath, content);
  return fullPath;
}

function cleanupDir(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// --- Complex PRD Content ---

const COMPLEX_PRD = `---
title: "EnterpriseApp: Multi-tenant SaaS Platform"
version: "1.0.0"
status: draft
---

# EnterpriseApp — Product Requirements (PRD)

## Overview

A comprehensive multi-tenant SaaS platform with complex module dependencies,
multiple phases, and advanced features including RBAC, tenant isolation,
real-time notifications, and analytics dashboard.

## Phase Summary
| Phase | Modules | Focus |
|---|---|---|
| 1 | auth, tenant | MVP Core |
| 2 | crm, inventory | Growth Features |
| 3 | analytics, notifications | Scale & Insights |

## Modules

### M1: auth
> Core authentication and authorization with RBAC support

#### Features
| ID | Feature | Description | Priority | Phase |
|---|---|---|---|---|
| M1-001 | Login | Email/password + OAuth | P0 | 1 |
| M1-002 | Register | User registration with verification | P0 | 1 |
| M1-003 | RBAC | Role-based access control | P0 | 1 |
| M1-004 | 2FA | Two-factor authentication | P1 | 2 |

#### Acceptance Criteria
- [ ] User can login with email/password
- [ ] User can login with OAuth (Google, GitHub)
- [ ] Roles are enforced at API level
- [ ] Session management with refresh tokens

#### Dependencies
- Requires: []
- Blocks: [tenant, crm, inventory, analytics, notifications]

---

### M2: tenant
> Multi-tenancy with strict data isolation

#### Features
| ID | Feature | Description | Priority | Phase |
|---|---|---|---|---|
| M2-001 | TenantCRUD | Create, read, update tenants | P0 | 1 |
| M2-002 | Isolation | Row-level security | P0 | 1 |
| M2-003 | Billing | Subscription management | P1 | 2 |

#### Acceptance Criteria
- [ ] Each tenant has isolated data
- [ ] RLS policies enforced at DB level
- [ ] Tenant context propagates through all layers

#### Dependencies
- Requires: [auth]
- Blocks: [crm, inventory]

---

### M3: crm
> Customer relationship management module

#### Features
| ID | Feature | Description | Priority | Phase |
|---|---|---|---|---|
| M3-001 | Customers | Customer management | P1 | 2 |
| M3-002 | Contacts | Contact persons | P1 | 2 |
| M3-003 | Activities | Activity log | P2 | 3 |

#### Acceptance Criteria
- [ ] Full CRUD for customers
- [ ] Customers are tenant-isolated
- [ ] Activity history tracked

#### Dependencies
- Requires: [auth, tenant]
- Blocks: [analytics]

---

### M4: inventory
> Product and inventory management

#### Features
| ID | Feature | Description | Priority | Phase |
|---|---|---|---|---|
| M4-001 | Products | Product catalog | P1 | 2 |
| M4-002 | Stock | Stock tracking | P1 | 2 |
| M4-003 | Movements | Stock movements | P2 | 3 |

#### Acceptance Criteria
- [ ] Full CRUD for products
- [ ] Stock levels tracked
- [ ] Movement history

#### Dependencies
- Requires: [auth, tenant]
- Blocks: [analytics]

---

### M5: analytics
> Business intelligence and dashboards

#### Features
| ID | Feature | Description | Priority | Phase |
|---|---|---|---|---|
| M5-001 | Dashboard | Main dashboard | P2 | 3 |
| M5-002 | Reports | Export reports | P2 | 3 |
| M5-003 | KPIs | Key metrics | P2 | 3 |

#### Acceptance Criteria
- [ ] Real-time metrics
- [ ] PDF/Excel exports
- [ ] Custom date ranges

#### Dependencies
- Requires: [crm, inventory]
- Blocks: []

---

### M6: notifications
> Real-time notification system

#### Features
| ID | Feature | Description | Priority | Phase |
|---|---|---|---|---|
| M6-001 | InApp | In-app notifications | P1 | 2 |
| M6-002 | Email | Email notifications | P1 | 2 |
| M6-003 | WebSocket | Real-time delivery | P2 | 3 |

#### Acceptance Criteria
- [ ] Push notifications work
- [ ] Email templates customizable
- [ ] WebSocket connection stable

#### Dependencies
- Requires: [auth]
- Blocks: []
`;

// --- Tests ---

describe("Project Orchestrator E2E — Complex Scenarios", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupDir(tempDir);
  });

  describe("PRD Parser — Edge Cases", () => {
    it("should parse complex PRD with 6 modules and dependency graph", async () => {
      const prdPath = writeFile(tempDir, "prd.md", COMPLEX_PRD);
      const parser = createPrdParser();

      const plan = await parser.parse(prdPath);

      expect(plan).not.toBeNull();
      expect(plan!.project.name).toBe("EnterpriseApp");
      expect(plan!.modules).toHaveLength(6);
      expect(plan!.totalFeatures).toBe(19);
      expect(plan!.phases).toHaveLength(3);

      // Verify dependency graph
      const authNode = plan!.dependencyGraph.find((n) => n.module === "auth");
      expect(authNode!.dependsOn).toHaveLength(0);

      const analyticsNode = plan!.dependencyGraph.find((n) => n.module === "analytics");
      expect(analyticsNode!.dependsOn).toContain("crm");
      expect(analyticsNode!.dependsOn).toContain("inventory");
    });

    it("should detect multi-level circular dependency: A → B → C → A", async () => {
      const circularPrd = `# Test

## Modules

### M1: moduleA
> Module A

#### Features
| ID | Feature | Description | Priority | Phase |
|---|---|---|---|---|
| M1-001 | FeatureA | Feature A | P0 | 1 |

#### Dependencies
- Requires: [modulec]
- Blocks: []

---

### M2: moduleB
> Module B

#### Features
| ID | Feature | Description | Priority | Phase |
|---|---|---|---|---|
| M2-001 | FeatureB | Feature B | P0 | 1 |

#### Dependencies
- Requires: [modulea]
- Blocks: []

---

### M3: moduleC
> Module C

#### Features
| ID | Feature | Description | Priority | Phase |
|---|---|---|---|---|
| M3-001 | FeatureC | Feature C | P0 | 1 |

#### Dependencies
- Requires: [moduleb]
- Blocks: []
`;

      const prdPath = writeFile(tempDir, "circular.md", circularPrd);
      const parser = createPrdParser();

      const plan = await parser.parse(prdPath);

      expect(plan).toBeNull();
      const errors = parser.getErrors();
      expect(errors.some((e) => e.type === "dependency")).toBe(true);
      expect(errors.some((e) => e.message.includes("Circular"))).toBe(true);
    });

    it("should handle PRD with missing optional sections", async () => {
      const minimalPrd = `# MinimalApp

### M1: core
> The only module

#### Features
| ID | Feature | Description | Priority | Phase |
|---|---|---|---|---|
| M1-001 | Main | Main feature | P0 | 1 |
`;

      const prdPath = writeFile(tempDir, "minimal.md", minimalPrd);
      const parser = createPrdParser();

      const plan = await parser.parse(prdPath);

      expect(plan).not.toBeNull();
      expect(plan!.modules).toHaveLength(1);
      expect(plan!.modules[0].acceptanceCriteria).toHaveLength(0);
      expect(plan!.modules[0].dependencies.requires).toHaveLength(0);
    });

    it("should reject PRD with no modules", async () => {
      const emptyPrd = `# EmptyApp

## Overview
No modules defined.
`;

      const prdPath = writeFile(tempDir, "empty.md", emptyPrd);
      const parser = createPrdParser();

      const plan = await parser.parse(prdPath);

      expect(plan).toBeNull();
      expect(parser.getErrors().some((e) => e.message.includes("No modules"))).toBe(true);
    });

    it("should validate feature ID prefix matches module ID", async () => {
      const wrongIdPrd = `# Test

### M1: auth
> Auth module

#### Features
| ID | Feature | Description | Priority | Phase |
|---|---|---|---|---|
| M2-001 | Login | Wrong prefix | P0 | 1 |
`;

      const prdPath = writeFile(tempDir, "wrong-id.md", wrongIdPrd);
      const parser = createPrdParser();

      await parser.parse(prdPath);

      const errors = parser.getErrors();
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.message.includes("M2-001"))).toBe(true);
    });
  });

  describe("Skill Generator — All Scenarios", () => {
    let plan: ExtractedPlan;

    beforeEach(async () => {
      const prdPath = writeFile(tempDir, "prd.md", COMPLEX_PRD);
      const parser = createPrdParser();
      plan = (await parser.parse(prdPath))!;
    });

    it("should generate core skills (6) plus module skills (6)", async () => {
      const generator = createSkillGenerator();
      const skills = await generator.generateAll(plan);

      // 6 core + 6 module
      expect(skills).toHaveLength(12);

      // Check core skills exist
      const coreSkills = skills.filter((s) => s.module === "core");
      expect(coreSkills).toHaveLength(6);
      expect(coreSkills.map((s) => s.name)).toContain("backend-dev");
      expect(coreSkills.map((s) => s.name)).toContain("frontend-dev");
      expect(coreSkills.map((s) => s.name)).toContain("testing");

      // Check module skills
      const moduleSkills = skills.filter((s) => s.module !== "core");
      expect(moduleSkills).toHaveLength(6);
      expect(moduleSkills.map((s) => s.name)).toContain("auth-dev");
      expect(moduleSkills.map((s) => s.name)).toContain("analytics-dev");
    });

    it("should include dependencies in module skill content", async () => {
      const generator = createSkillGenerator();
      const skill = await generator.generateModuleSkill(
        plan.modules.find((m) => m.name === "analytics")!,
        plan
      );

      expect(skill.content).toContain("crm");
      expect(skill.content).toContain("inventory");
      expect(skill.content).toContain("Requires:");
    });

    it("should enhance skills with stack information", async () => {
      const generator = createSkillGenerator();
      const skills = await generator.generateAll(plan, {
        languages: ["typescript"],
        frameworks: ["nestjs", "prisma"],
        databases: ["postgresql"],
        apiStyle: ["rest"],
        packageManager: "pnpm",
        versions: {},
      });

      const backendSkill = skills.find((s) => s.name === "backend-dev");
      expect(backendSkill!.content).toContain("NestJS");
    });
  });

  describe("Agent Generator — All Scenarios", () => {
    let plan: ExtractedPlan;

    beforeEach(async () => {
      const prdPath = writeFile(tempDir, "prd.md", COMPLEX_PRD);
      const parser = createPrdParser();
      plan = (await parser.parse(prdPath))!;
    });

    it("should generate core agents (8) plus module agents (6)", async () => {
      const generator = createAgentGenerator();
      const agents = await generator.generateAll(plan);

      // 8 core + 6 module
      expect(agents).toHaveLength(14);

      // Core agents
      const coreAgents = agents.filter((a) => a.type === "core");
      expect(coreAgents).toHaveLength(8);
      expect(coreAgents.map((a) => a.name)).toContain("project-manager");
      expect(coreAgents.map((a) => a.name)).toContain("backend-builder");

      // Module agents
      const moduleAgents = agents.filter((a) => a.type === "module");
      expect(moduleAgents).toHaveLength(6);
      expect(moduleAgents.map((a) => a.name)).toContain("auth-builder");
    });

    it("should include module features in agent content", async () => {
      const generator = createAgentGenerator();
      const agent = await generator.generateModuleAgent(
        plan.modules.find((m) => m.name === "auth")!,
        plan
      );

      expect(agent.content).toContain("M1-001");
      expect(agent.content).toContain("Login");
      expect(agent.content).toContain("RBAC");
    });
  });

  describe("Plan Executor — Full Execution Flow", () => {
    let plan: ExtractedPlan;
    let magsDir: string;

    beforeEach(async () => {
      magsDir = path.join(tempDir, "docs/.mags");
      fs.mkdirSync(magsDir, { recursive: true });

      const prdPath = writeFile(tempDir, "prd.md", COMPLEX_PRD);
      const parser = createPrdParser();
      plan = (await parser.parse(prdPath))!;
    });

    it("should initialize execution with correct step count", async () => {
      const executor = createPlanExecutor(magsDir);
      const state = await executor.initialize(plan, "backend");

      // 6 modules × 12 steps per module = 72 steps
      expect(state.totalSteps).toBe(72);
      expect(state.status).toBe("idle");
      expect(state.currentStep).toBe(1);
      expect(state.completed.modules).toHaveLength(0);
    });

    it("should order modules by dependency (auth first, analytics last)", async () => {
      const executor = createPlanExecutor(magsDir);
      await executor.initialize(plan, "backend");

      const prompt = executor.getCurrentStepPrompt();

      // First step should be auth module (no dependencies)
      expect(prompt).not.toBeNull();
      expect(prompt!.title).toContain("auth");
    });

    it("should execute approve action and move to next step", async () => {
      const executor = createPlanExecutor(magsDir);
      await executor.initialize(plan, "backend");

      const result = await executor.executeAction("approve");

      expect(result.success).toBe(true);
      expect(result.message).toContain("completed");

      const state = executor.getState();
      expect(state!.completed.steps).toHaveLength(1);
      expect(state!.currentStep).toBe(2);
    });

    it("should execute skip action", async () => {
      const executor = createPlanExecutor(magsDir);
      await executor.initialize(plan, "backend");

      const result = await executor.executeAction("skip");

      expect(result.success).toBe(true);
      expect(result.message).toContain("skipped");

      const state = executor.getState();
      expect(state!.completed.steps[0].status).toBe("skipped");
    });

    it("should pause and resume execution", async () => {
      const executor = createPlanExecutor(magsDir);
      await executor.initialize(plan, "backend");

      // Execute a few steps
      await executor.executeAction("approve");
      await executor.executeAction("approve");

      // Pause
      const pauseResult = await executor.executeAction("quit");
      expect(pauseResult.success).toBe(true);
      expect(executor.getState()!.status).toBe("paused");

      // Create new executor and resume
      const executor2 = createPlanExecutor(magsDir);
      const loadedState = await executor2.load();

      expect(loadedState).not.toBeNull();
      expect(loadedState!.currentStep).toBe(3);
      expect(loadedState!.completed.steps).toHaveLength(2);
    });

    it("should track module completion", async () => {
      const executor = createPlanExecutor(magsDir);
      await executor.initialize(plan, "backend");

      // Complete all 12 steps of first module (auth)
      for (let i = 0; i < 12; i++) {
        await executor.executeAction("approve");
      }

      const state = executor.getState();
      expect(state!.completed.modules).toContain("auth");
    });

    it("should calculate progress percentage correctly", async () => {
      const executor = createPlanExecutor(magsDir);
      await executor.initialize(plan, "backend");

      expect(executor.getProgressPercent()).toBe(0);

      // Complete 12 steps (1 module out of 6)
      for (let i = 0; i < 12; i++) {
        await executor.executeAction("approve");
      }

      // 12/72 = 16.67% ≈ 17%
      expect(executor.getProgressPercent()).toBeCloseTo(17, 0);
    });

    it("should handle navigation (next, previous)", async () => {
      const executor = createPlanExecutor(magsDir);
      await executor.initialize(plan, "backend");

      // Move to step 2 (without completing step 1)
      await executor.executeAction("next");
      expect(executor.getState()!.currentStep).toBe(2);

      // Move back to step 1
      await executor.executeAction("previous");
      expect(executor.getState()!.currentStep).toBe(1);

      // Can't go before step 1
      const result = await executor.executeAction("previous");
      expect(result.success).toBe(false);
    });

    it("should parse all keyboard shortcuts", () => {
      expect(parseShortcut("a")).toBe("approve");
      expect(parseShortcut("s")).toBe("skip");
      expect(parseShortcut("r")).toBe("retry");
      expect(parseShortcut("q")).toBe("quit");
      expect(parseShortcut("n")).toBe("next");
      expect(parseShortcut("p")).toBe("previous");
      expect(parseShortcut("d")).toBe("details");
      expect(parseShortcut("h")).toBe("help");
      expect(parseShortcut("l")).toBe("list");
      expect(parseShortcut("X")).toBeNull(); // Invalid
    });
  });

  describe("Code Analyzer — Brownfield Project", () => {
    it("should analyze project structure and detect modules", async () => {
      // Create a simulated project structure
      writeFile(tempDir, "package.json", JSON.stringify({
        name: "test-project",
        version: "1.0.0",
      }));
      writeFile(tempDir, "src/modules/auth/auth.controller.ts", `
        @Controller('auth')
        export class AuthController {
          @Post('/login')
          async login() {}

          @Post('/register')
          async register() {}
        }
      `);
      writeFile(tempDir, "src/modules/users/users.service.ts", `
        @Injectable()
        export class UsersService {
          findAll() {}
          findOne(id: string) {}
        }
      `);
      writeFile(tempDir, "prisma/schema.prisma", `
        model User {
          id String @id
          email String @unique
          tenantId String
        }

        model Tenant {
          id String @id
          name String
        }
      `);

      const analyzer = createCodeAnalyzer(tempDir);
      const analysis = await analyzer.analyze();

      expect(analysis.projectName).toBe("test-project");
      expect(analysis.modules.length).toBeGreaterThanOrEqual(1);
      expect(analysis.endpoints.length).toBeGreaterThanOrEqual(2);
      expect(analysis.tables.length).toBeGreaterThanOrEqual(2);
    });

    it("should generate reverse PRD from analysis", async () => {
      writeFile(tempDir, "package.json", JSON.stringify({
        name: "reverse-test",
        version: "1.0.0",
      }));
      writeFile(tempDir, "src/modules/orders/orders.controller.ts", `
        @Controller('orders')
        export class OrdersController {
          @Get()
          findAll() {}

          @Post()
          create() {}
        }
      `);

      const analyzer = createCodeAnalyzer(tempDir);
      await analyzer.analyze();
      const reversePrd = await analyzer.generateReversePrd();

      expect(reversePrd.modules.length).toBeGreaterThanOrEqual(1);
      expect(reversePrd.recommendations.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("TDD Engine — Verification", () => {
    let magsDir: string;

    beforeEach(() => {
      magsDir = path.join(tempDir, "docs/.mags");
      fs.mkdirSync(magsDir, { recursive: true });
    });

    it("should verify module with acceptance criteria", async () => {
      // Create test file
      writeFile(tempDir, "src/modules/auth/auth.service.spec.ts", `
        describe('AuthService', () => {
          it('should login user', () => {
            expect(true).toBe(true);
          });

          it('should register user', () => {
            expect(true).toBe(true);
          });
        });
      `);

      const module: ExtractedModule = {
        id: "M1",
        name: "auth",
        description: "Auth module",
        features: [
          { id: "M1-001", name: "Login", description: "", priority: "P0", phase: 1, status: "pending" },
        ],
        acceptanceCriteria: ["User can login", "User can register"],
        dependencies: { requires: [], blocks: [] },
        phase: 1,
        priority: "P0",
      };

      const engine = createTddEngine(tempDir, magsDir);
      const report = await engine.verify(module);

      expect(report.module).toBe("auth");
      expect(report.status).toBeDefined();
      expect(report.acceptance).toHaveLength(2);
    });

    it("should check requirements with coverage", async () => {
      const engine = createTddEngine(tempDir, magsDir);

      const report = {
        module: "test",
        timestamp: new Date().toISOString(),
        status: "passed" as const,
        tests: {
          unit: { total: 10, passed: 10, failed: 0, skipped: 0, coverage: 85 },
          integration: { total: 5, passed: 5, failed: 0, skipped: 0 },
          e2e: { total: 2, passed: 2, failed: 0, skipped: 0 },
          isolation: { total: 0, passed: 0, failed: 0, skipped: 0 },
          permission: { total: 0, passed: 0, failed: 0, skipped: 0 },
        },
        results: [],
        acceptance: [
          { criteria: "Test 1", status: "verified" as const, testFile: "test.spec.ts", testName: "test1" },
        ],
        coverageTotal: 85,
      };

      const requirements = engine.meetsRequirements(report, 80);

      expect(requirements.passes).toBe(true);
      expect(requirements.reasons).toHaveLength(0);
    });

    it("should fail requirements if coverage is below threshold", () => {
      const engine = createTddEngine(tempDir, magsDir);

      const report = {
        module: "test",
        timestamp: new Date().toISOString(),
        status: "passed" as const,
        tests: {
          unit: { total: 10, passed: 10, failed: 0, skipped: 0, coverage: 50 },
          integration: { total: 0, passed: 0, failed: 0, skipped: 0 },
          e2e: { total: 0, passed: 0, failed: 0, skipped: 0 },
          isolation: { total: 0, passed: 0, failed: 0, skipped: 0 },
          permission: { total: 0, passed: 0, failed: 0, skipped: 0 },
        },
        results: [],
        acceptance: [],
        coverageTotal: 50,
      };

      const requirements = engine.meetsRequirements(report, 80);

      expect(requirements.passes).toBe(false);
      expect(requirements.reasons).toContain("Coverage 50% is below minimum 80%");
    });
  });

  describe("Full Orchestrator Integration", () => {
    let orchestrator: Orchestrator;
    let magsDir: string;

    beforeEach(() => {
      magsDir = path.join(tempDir, "docs/.mags");
      orchestrator = createOrchestrator({
        projectRoot: tempDir,
        magsDir: magsDir,
      });
    });

    it("should initialize from PRD and execute full workflow", async () => {
      const prdPath = writeFile(tempDir, "prd.md", COMPLEX_PRD);

      // Initialize
      const initResult = await orchestrator.initializeFromPrd(prdPath);
      expect(initResult.success).toBe(true);
      expect(initResult.plan).not.toBeNull();
      expect(initResult.plan!.modules).toHaveLength(6);

      // Check status
      const status = orchestrator.getStatus();
      expect(status).not.toBeNull();
      expect(status!.status).toBe("idle");
      expect(status!.totalSteps).toBe(72);

      // Get current step
      const step = orchestrator.getCurrentStep();
      expect(step).not.toBeNull();
      expect(step!.title).toContain("auth");

      // Execute some actions
      await orchestrator.executeAction("a"); // approve
      await orchestrator.executeAction("s"); // skip
      await orchestrator.executeAction("a"); // approve

      const newStatus = orchestrator.getStatus();
      expect(newStatus!.currentStep).toBe(4);
      expect(newStatus!.progress).toBeGreaterThan(0);
    });

    it("should generate artifacts (skills + agents)", async () => {
      const prdPath = writeFile(tempDir, "prd.md", COMPLEX_PRD);

      await orchestrator.initializeFromPrd(prdPath);
      const artifacts = await orchestrator.generateArtifacts();

      expect(artifacts.skills).toHaveLength(12); // 6 core + 6 module
      expect(artifacts.agents).toHaveLength(14); // 8 core + 6 module
    });

    it("should throw error when generating artifacts without plan", async () => {
      await expect(orchestrator.generateArtifacts()).rejects.toThrow(
        "No plan loaded"
      );
    });

    it("should handle resume from saved state", async () => {
      const prdPath = writeFile(tempDir, "prd.md", COMPLEX_PRD);

      await orchestrator.initializeFromPrd(prdPath);
      await orchestrator.executeAction("approve");
      await orchestrator.executeAction("approve");
      await orchestrator.executeAction("quit"); // Pause

      // Create new orchestrator and resume
      const orchestrator2 = createOrchestrator({
        projectRoot: tempDir,
        magsDir: magsDir,
      });

      const resumeResult = await orchestrator2.resume();

      expect(resumeResult.success).toBe(true);
      expect(resumeResult.state!.currentStep).toBe(3);
      expect(resumeResult.state!.completed.steps).toHaveLength(2);
    });

    it("should return errors for invalid PRD", async () => {
      const invalidPrd = `# Invalid
No modules here.
`;
      const prdPath = writeFile(tempDir, "invalid.md", invalidPrd);

      const result = await orchestrator.initializeFromPrd(prdPath);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });
  });

  describe("Shortcut Parser — Full Coverage", () => {
    it("should accept both shortcuts and full action names", () => {
      // Shortcuts
      expect(parseShortcut("a")).toBe("approve");
      expect(parseShortcut("s")).toBe("skip");
      expect(parseShortcut("q")).toBe("quit");

      // Full names
      expect(parseShortcut("approve")).toBe("approve");
      expect(parseShortcut("skip")).toBe("skip");
      expect(parseShortcut("quit")).toBe("quit");
      expect(parseShortcut("retry")).toBe("retry");
      expect(parseShortcut("next")).toBe("next");
      expect(parseShortcut("previous")).toBe("previous");
      expect(parseShortcut("details")).toBe("details");
      expect(parseShortcut("help")).toBe("help");
      expect(parseShortcut("list")).toBe("list");
      expect(parseShortcut("edit")).toBe("edit");
    });

    it("should handle case-insensitive input", () => {
      expect(parseShortcut("A")).toBe("approve");
      expect(parseShortcut("APPROVE")).toBe("approve");
      expect(parseShortcut("Approve")).toBe("approve");
      expect(parseShortcut("SKIP")).toBe("skip");
    });

    it("should handle whitespace", () => {
      expect(parseShortcut(" a ")).toBe("approve");
      expect(parseShortcut("  approve  ")).toBe("approve");
    });

    it("should return null for invalid input", () => {
      expect(parseShortcut("x")).toBeNull();
      expect(parseShortcut("invalid")).toBeNull();
      expect(parseShortcut("123")).toBeNull();
      expect(parseShortcut("")).toBeNull();
    });
  });

  describe("Plan Executor — Edge Cases", () => {
    let magsDir: string;

    beforeEach(() => {
      magsDir = path.join(tempDir, "docs/.mags");
      fs.mkdirSync(magsDir, { recursive: true });
    });

    it("should handle executeAction without state", async () => {
      const executor = createPlanExecutor(magsDir);

      const result = await executor.executeAction("approve");

      expect(result.success).toBe(false);
      expect(result.message).toBe("No execution state loaded");
    });

    it("should complete execution when all steps done", async () => {
      // Create a minimal PRD with just 1 module
      const minimalPrd = `# Test

### M1: mini
> Mini module

#### Features
| ID | Feature | Description | Priority | Phase |
|---|---|---|---|---|
| M1-001 | Test | Test feature | P0 | 1 |
`;
      const prdPath = writeFile(tempDir, "mini.md", minimalPrd);
      const parser = createPrdParser();
      const plan = (await parser.parse(prdPath))!;

      const executor = createPlanExecutor(magsDir);
      await executor.initialize(plan, "backend");

      // Complete all 12 steps
      for (let i = 0; i < 12; i++) {
        const result = await executor.executeAction("approve");
        expect(result.success).toBe(true);
      }

      expect(executor.isComplete()).toBe(true);
      expect(executor.getState()!.status).toBe("completed");
      expect(executor.getProgressPercent()).toBe(100);
    });

    it("should return null prompt when execution is complete", async () => {
      const minimalPrd = `# Test

### M1: mini
> Mini module

#### Features
| ID | Feature | Description | Priority | Phase |
|---|---|---|---|---|
| M1-001 | Test | Test feature | P0 | 1 |
`;
      const prdPath = writeFile(tempDir, "mini.md", minimalPrd);
      const parser = createPrdParser();
      const plan = (await parser.parse(prdPath))!;

      const executor = createPlanExecutor(magsDir);
      await executor.initialize(plan, "backend");

      // Complete all steps
      for (let i = 0; i < 12; i++) {
        await executor.executeAction("approve");
      }

      const prompt = executor.getCurrentStepPrompt();
      expect(prompt).toBeNull();
    });

    it("should use frontend step templates correctly", async () => {
      const minimalPrd = `# Test

### M1: ui
> UI module

#### Features
| ID | Feature | Description | Priority | Phase |
|---|---|---|---|---|
| M1-001 | Component | UI component | P0 | 1 |
`;
      const prdPath = writeFile(tempDir, "ui.md", minimalPrd);
      const parser = createPrdParser();
      const plan = (await parser.parse(prdPath))!;

      const executor = createPlanExecutor(magsDir);
      const state = await executor.initialize(plan, "frontend");

      // Frontend has 8 steps per module
      expect(state.totalSteps).toBe(8);

      const prompt = executor.getCurrentStepPrompt();
      expect(prompt!.title).toContain("component");
    });
  });

  describe("TDD Engine — Error Scenarios", () => {
    let magsDir: string;

    beforeEach(() => {
      magsDir = path.join(tempDir, "docs/.mags");
      fs.mkdirSync(magsDir, { recursive: true });
    });

    it("should handle module without test files", async () => {
      // Don't create any test files
      const module: ExtractedModule = {
        id: "M1",
        name: "notest",
        description: "Module without tests",
        features: [],
        acceptanceCriteria: [],
        dependencies: { requires: [], blocks: [] },
        phase: 1,
        priority: "P0",
      };

      const engine = createTddEngine(tempDir, magsDir);
      const quickResult = await engine.quickVerify("notest");

      expect(quickResult.total).toBe(0);
      expect(quickResult.passed).toBe(true); // No tests = no failures
    });

    it("should return null for non-existent report", async () => {
      const engine = createTddEngine(tempDir, magsDir);
      const report = await engine.getReport("nonexistent");

      expect(report).toBeNull();
    });

    it("should fail requirements when tests are failing", () => {
      const engine = createTddEngine(tempDir, magsDir);

      const report = {
        module: "failing",
        timestamp: new Date().toISOString(),
        status: "failed" as const,
        tests: {
          unit: { total: 10, passed: 5, failed: 5, skipped: 0, coverage: 90 },
          integration: { total: 0, passed: 0, failed: 0, skipped: 0 },
          e2e: { total: 0, passed: 0, failed: 0, skipped: 0 },
          isolation: { total: 0, passed: 0, failed: 0, skipped: 0 },
          permission: { total: 0, passed: 0, failed: 0, skipped: 0 },
        },
        results: [],
        acceptance: [],
        coverageTotal: 90,
      };

      const requirements = engine.meetsRequirements(report, 80);

      expect(requirements.passes).toBe(false);
      expect(requirements.reasons).toContain("Tests are failing");
    });

    it("should fail requirements when acceptance criteria unverified", () => {
      const engine = createTddEngine(tempDir, magsDir);

      const report = {
        module: "unverified",
        timestamp: new Date().toISOString(),
        status: "passed" as const,
        tests: {
          unit: { total: 10, passed: 10, failed: 0, skipped: 0, coverage: 90 },
          integration: { total: 0, passed: 0, failed: 0, skipped: 0 },
          e2e: { total: 0, passed: 0, failed: 0, skipped: 0 },
          isolation: { total: 0, passed: 0, failed: 0, skipped: 0 },
          permission: { total: 0, passed: 0, failed: 0, skipped: 0 },
        },
        results: [],
        acceptance: [
          { criteria: "Criteria 1", status: "verified" as const, testFile: "a.ts", testName: "a" },
          { criteria: "Criteria 2", status: "unverified" as const },
        ],
        coverageTotal: 90,
      };

      const requirements = engine.meetsRequirements(report, 80);

      expect(requirements.passes).toBe(false);
      expect(requirements.reasons.some((r) => r.includes("acceptance criteria"))).toBe(true);
    });
  });

  describe("Code Analyzer — Edge Cases", () => {
    it("should handle empty project gracefully", async () => {
      // Just create package.json, nothing else
      writeFile(tempDir, "package.json", JSON.stringify({
        name: "empty-project",
        version: "1.0.0",
      }));

      const analyzer = createCodeAnalyzer(tempDir);
      const analysis = await analyzer.analyze();

      expect(analysis.projectName).toBe("empty-project");
      expect(analysis.modules).toHaveLength(0);
      expect(analysis.endpoints).toHaveLength(0);
    });

    it("should detect tech debt markers", async () => {
      writeFile(tempDir, "package.json", JSON.stringify({ name: "debt-test" }));
      writeFile(tempDir, "src/service.ts", `
        // TODO: Implement caching
        // FIXME: This is a bug
        // HACK: Temporary workaround
        // XXX: Need to review
        function doSomething() {
          // BUG: Known issue
          return true;
        }
      `);

      const analyzer = createCodeAnalyzer(tempDir);
      const analysis = await analyzer.analyze();

      expect(analysis.techDebt.length).toBeGreaterThanOrEqual(5);
      expect(analysis.techDebt.some((td) => td.type === "todo")).toBe(true);
      expect(analysis.techDebt.some((td) => td.type === "fixme")).toBe(true);
      expect(analysis.techDebt.some((td) => td.type === "hack")).toBe(true);
    });

    it("should skip node_modules and dist folders", async () => {
      writeFile(tempDir, "package.json", JSON.stringify({ name: "skip-test" }));
      writeFile(tempDir, "node_modules/package/index.ts", `
        // TODO: This should be skipped
        @Get('/skip')
        async skip() {}
      `);
      writeFile(tempDir, "dist/bundle.js", `
        // TODO: This should also be skipped
      `);
      writeFile(tempDir, "src/real.ts", `
        // TODO: This should be found
      `);

      const analyzer = createCodeAnalyzer(tempDir);
      const analysis = await analyzer.analyze();

      // Should only find the one in src/
      expect(analysis.techDebt.length).toBe(1);
      expect(analysis.techDebt[0].file).toContain("src/real.ts");
    });
  });

  describe("Error Handling & Edge Cases", () => {
    it("should handle non-existent PRD file gracefully", async () => {
      const orchestrator = createOrchestrator({
        projectRoot: tempDir,
        magsDir: path.join(tempDir, "docs/.mags"),
      });

      const result = await orchestrator.initializeFromPrd("/nonexistent/prd.md");

      expect(result.success).toBe(false);
      expect(result.errors).toContain("PRD file not found: /nonexistent/prd.md");
    });

    it("should handle empty modules gracefully", async () => {
      const prdWithEmptyModule = `# Test

### M1: empty
> Empty module
`;
      const prdPath = writeFile(tempDir, "empty-module.md", prdWithEmptyModule);
      const parser = createPrdParser();

      await parser.parse(prdPath);

      const warnings = parser.getWarnings();
      expect(warnings.some((w) => w.message.includes("no features"))).toBe(true);
    });

    it("should handle special characters in module names", async () => {
      const prdWithSpecialChars = `# Test

### M1: auth-v2
> Auth version 2

#### Features
| ID | Feature | Description | Priority | Phase |
|---|---|---|---|---|
| M1-001 | Login | Login v2 | P0 | 1 |
`;

      const prdPath = writeFile(tempDir, "special.md", prdWithSpecialChars);
      const parser = createPrdParser();

      const plan = await parser.parse(prdPath);

      expect(plan).not.toBeNull();
      expect(plan!.modules[0].name).toBe("auth-v2");
    });

    it("should handle Turkish characters in descriptions", async () => {
      const prdWithTurkish = `# Test

### M1: auth
> Kimlik doğrulama ve yetkilendirme modülü

#### Features
| ID | Feature | Description | Priority | Phase |
|---|---|---|---|---|
| M1-001 | Giriş | E-posta ile giriş | P0 | 1 |

#### Acceptance Criteria
- [ ] Kullanıcı giriş yapabilmeli
- [ ] Şifre güvenli olmalı
`;

      const prdPath = writeFile(tempDir, "turkish.md", prdWithTurkish);
      const parser = createPrdParser();

      const plan = await parser.parse(prdPath);

      expect(plan).not.toBeNull();
      expect(plan!.modules[0].description).toContain("Kimlik");
      expect(plan!.modules[0].acceptanceCriteria[0]).toContain("giriş");
    });

    it("should handle very long module chains", async () => {
      // Create PRD with 10 modules in chain: m1 → m2 → m3 → ... → m10
      let modulesContent = "";
      for (let i = 1; i <= 10; i++) {
        const requires = i > 1 ? `m${i - 1}` : "";
        modulesContent += `
### M${i}: m${i}
> Module ${i}

#### Features
| ID | Feature | Description | Priority | Phase |
|---|---|---|---|---|
| M${i}-001 | Feature | Feature | P0 | 1 |

#### Dependencies
- Requires: [${requires}]
- Blocks: []

---
`;
      }

      const prd = `# ChainTest\n\n## Modules\n${modulesContent}`;
      const prdPath = writeFile(tempDir, "chain.md", prd);
      const parser = createPrdParser();

      const plan = await parser.parse(prdPath);

      expect(plan).not.toBeNull();
      expect(plan!.modules).toHaveLength(10);

      // Check dependency order
      expect(plan!.dependencyGraph[9].dependsOn).toContain("m9");
    });
  });
});
