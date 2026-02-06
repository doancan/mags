// ============================================
// MAGS — Orchestrator MCP Tools
// ============================================

import { z } from "zod";
import * as path from "path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  createOrchestrator,
  createPrdParser,
  createCodeAnalyzer,
  createSkillGenerator,
  createAgentGenerator,
  createTddEngine,
  formatVerificationResult,
} from "../services/orchestrator/index.js";
import type { MagsConfig } from "../types/index.js";

let orchestratorInstance: ReturnType<typeof createOrchestrator> | null = null;

function getOrchestrator(config?: { projectRoot?: string; magsDir?: string }) {
  if (!orchestratorInstance) {
    orchestratorInstance = createOrchestrator(config);
  }
  return orchestratorInstance;
}

export function registerOrchestratorTools(server: McpServer, config: MagsConfig, projectRoot: string) {
  const magsDir = config.magsDir;

  /** Resolve a user-provided path against the project root */
  function resolvePath(filePath: string): string {
    return path.isAbsolute(filePath) ? filePath : path.resolve(projectRoot, filePath);
  }

  // --- mags_parse_prd ---
  server.tool(
    "mags_parse_prd",
    "Parse a PRD document and extract plan with modules, features, and dependencies. Uses strict schema validation.",
    {
      prdPath: z.string().describe("Path to PRD markdown file"),
      validateOnly: z.boolean().optional().describe("Only validate, don't extract plan"),
    },
    async ({ prdPath, validateOnly }: { prdPath: string; validateOnly?: boolean }) => {
      const resolvedPath = resolvePath(prdPath);
      const parser = createPrdParser();

      if (validateOnly) {
        const result = parser.validate(resolvedPath);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  valid: result.valid,
                  errors: result.errors,
                  warnings: result.warnings,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      const plan = await parser.parse(resolvedPath);

      if (!plan) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: false,
                  errors: parser.getErrors(),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: true,
                project: plan.project,
                totalModules: plan.modules.length,
                totalFeatures: plan.totalFeatures,
                phases: plan.phases,
                modules: plan.modules.map((m) => ({
                  id: m.id,
                  name: m.name,
                  features: m.features.length,
                  priority: m.priority,
                  phase: m.phase,
                  dependencies: m.dependencies,
                })),
                dependencyGraph: plan.dependencyGraph,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // --- mags_analyze_codebase ---
  server.tool(
    "mags_analyze_codebase",
    "Deep analysis of existing codebase. Discovers modules, endpoints, tables, patterns, and tech debt.",
    {
      projectRoot: z.string().optional().describe("Project root directory (default: current)"),
      generateReversePrd: z.boolean().optional().describe("Also generate reverse PRD"),
    },
    async ({
      projectRoot: userProjectRoot,
      generateReversePrd,
    }: {
      projectRoot?: string;
      generateReversePrd?: boolean;
    }) => {
      const resolvedRoot = userProjectRoot ? resolvePath(userProjectRoot) : projectRoot;
      const analyzer = createCodeAnalyzer(resolvedRoot);
      const analysis = await analyzer.analyze();

      const result: Record<string, unknown> = {
        success: true,
        projectName: analysis.projectName,
        stack: analysis.stack,
        modules: analysis.modules.map((m) => ({
          name: m.name,
          confidence: m.confidence,
          endpoints: m.endpoints.length,
          files: m.files.length,
        })),
        totalEndpoints: analysis.endpoints.length,
        totalTables: analysis.tables.length,
        techDebtItems: analysis.techDebt.length,
        testCoverage: analysis.testCoverage,
        patterns: analysis.patterns,
      };

      if (generateReversePrd) {
        const reversePrd = await analyzer.generateReversePrd();
        result.reversePrd = {
          generated: true,
          modules: reversePrd.modules.length,
          recommendations: reversePrd.recommendations,
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  // --- mags_generate_skill ---
  server.tool(
    "mags_generate_skill",
    "Generate a development skill for a module based on PRD requirements.",
    {
      moduleName: z.string().describe("Module name to generate skill for"),
      prdPath: z.string().describe("Path to PRD file"),
    },
    async ({ moduleName, prdPath }: { moduleName: string; prdPath: string }) => {
      const resolvedPath = resolvePath(prdPath);
      const parser = createPrdParser();
      const plan = await parser.parse(resolvedPath);

      if (!plan) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ success: false, error: "Failed to parse PRD" }, null, 2),
            },
          ],
        };
      }

      const module = plan.modules.find((m) => m.name === moduleName);
      if (!module) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                error: `Module "${moduleName}" not found in PRD`,
                availableModules: plan.modules.map((m) => m.name),
              }, null, 2),
            },
          ],
        };
      }

      const generator = createSkillGenerator();
      const skill = await generator.generateModuleSkill(module, plan);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: true,
                skill: {
                  name: skill.name,
                  path: skill.path,
                  features: skill.features,
                  contentPreview: skill.content.slice(0, 500) + "...",
                },
                fullContent: skill.content,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // --- mags_generate_agent ---
  server.tool(
    "mags_generate_agent",
    "Generate a builder agent for a module based on PRD requirements.",
    {
      moduleName: z.string().describe("Module name to generate agent for"),
      prdPath: z.string().describe("Path to PRD file"),
    },
    async ({ moduleName, prdPath }: { moduleName: string; prdPath: string }) => {
      const resolvedPath = resolvePath(prdPath);
      const parser = createPrdParser();
      const plan = await parser.parse(resolvedPath);

      if (!plan) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ success: false, error: "Failed to parse PRD" }, null, 2),
            },
          ],
        };
      }

      const module = plan.modules.find((m) => m.name === moduleName);
      if (!module) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                error: `Module "${moduleName}" not found`,
              }, null, 2),
            },
          ],
        };
      }

      const generator = createAgentGenerator();
      const agent = await generator.generateModuleAgent(module, plan);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: true,
                agent: {
                  name: agent.name,
                  path: agent.path,
                  type: agent.type,
                  contentPreview: agent.content.slice(0, 500) + "...",
                },
                fullContent: agent.content,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // --- mags_init_execution ---
  server.tool(
    "mags_init_execution",
    "Initialize plan execution from a PRD. Creates execution state and step sequence.",
    {
      prdPath: z.string().describe("Path to PRD file"),
      moduleType: z.enum(["backend", "frontend"]).optional().describe("Type of modules (default: backend)"),
    },
    async ({ prdPath, moduleType: _moduleType }: { prdPath: string; moduleType?: "backend" | "frontend" }) => {
      const resolvedPath = resolvePath(prdPath);
      const orchestrator = getOrchestrator({ projectRoot, magsDir });
      const result = await orchestrator.initializeFromPrd(resolvedPath);

      if (!result.success) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ success: false, errors: result.errors }, null, 2),
            },
          ],
        };
      }

      const status = orchestrator.getStatus();

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: true,
                initialized: true,
                totalSteps: status?.totalSteps,
                modules: result.plan?.modules.map((m) => m.name),
                firstStep: orchestrator.getCurrentStep(),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // --- mags_execute_step ---
  server.tool(
    "mags_execute_step",
    "Execute an action on the current step. Actions: a(pprove), s(kip), r(etry), q(uit), n(ext), p(revious).",
    {
      action: z.string().describe("Action shortcut: a, s, r, q, n, p"),
    },
    async ({ action }: { action: string }) => {
      const orchestrator = getOrchestrator({ magsDir });
      const result = await orchestrator.executeAction(action);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: result.success,
                message: result.message,
                nextStep: result.nextPrompt,
                status: orchestrator.getStatus(),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // --- mags_get_current_step ---
  server.tool(
    "mags_get_current_step",
    "Get the current execution step details and available actions.",
    {},
    async () => {
      const orchestrator = getOrchestrator({ magsDir });
      const step = orchestrator.getCurrentStep();
      const status = orchestrator.getStatus();

      if (!step) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  hasStep: false,
                  status: status?.status || "no execution state",
                  message: status?.status === "completed"
                    ? "All steps completed!"
                    : "No execution state. Run mags_init_execution first.",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                hasStep: true,
                step: step.step,
                totalSteps: step.totalSteps,
                title: step.title,
                description: step.description,
                file: step.file,
                actions: step.availableActions,
                shortcuts: {
                  a: "approve",
                  s: "skip",
                  r: "retry",
                  q: "quit",
                  d: "details",
                },
                progress: status,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // --- mags_resume_execution ---
  server.tool(
    "mags_resume_execution",
    "Resume execution from saved state.",
    {},
    async () => {
      const orchestrator = getOrchestrator({ magsDir });
      const result = await orchestrator.resume();

      if (!result.success) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: false,
                  message: "No saved execution state found. Run mags_init_execution first.",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: true,
                resumed: true,
                status: result.state?.status,
                currentStep: result.state?.currentStep,
                currentModule: result.state?.currentModule,
                nextPrompt: result.prompt,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // --- mags_verify_module ---
  server.tool(
    "mags_verify_module",
    "Run TDD verification for a module. Checks tests, coverage, and acceptance criteria.",
    {
      moduleName: z.string().describe("Module name to verify"),
      prdPath: z.string().optional().describe("Path to PRD file for acceptance criteria"),
    },
    async ({ moduleName, prdPath }: { moduleName: string; prdPath?: string }) => {
      const tddEngine = createTddEngine(projectRoot, magsDir);

      // Quick verify without PRD
      if (!prdPath) {
        const result = await tddEngine.quickVerify(moduleName);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: true,
                  module: moduleName,
                  passed: result.passed,
                  total: result.total,
                  failed: result.failed,
                  errors: result.errors,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      // Full verify with PRD
      const resolvedPrdPath = resolvePath(prdPath);
      const parser = createPrdParser();
      const plan = await parser.parse(resolvedPrdPath);

      if (!plan) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ success: false, error: "Failed to parse PRD" }, null, 2),
            },
          ],
        };
      }

      const module = plan.modules.find((m) => m.name === moduleName);
      if (!module) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ success: false, error: `Module "${moduleName}" not found` }, null, 2),
            },
          ],
        };
      }

      const report = await tddEngine.verify(module);
      const requirements = tddEngine.meetsRequirements(report);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: true,
                module: moduleName,
                status: report.status,
                meetsRequirements: requirements.passes,
                reasons: requirements.reasons,
                coverage: report.coverageTotal,
                tests: report.tests,
                acceptance: report.acceptance,
                formatted: formatVerificationResult(report),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // --- mags_get_execution_status ---
  server.tool(
    "mags_get_execution_status",
    "Get current execution status and progress.",
    {},
    async () => {
      const orchestrator = getOrchestrator({ magsDir });
      const status = orchestrator.getStatus();
      const state = orchestrator.getExecutionState();

      if (!status) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  hasState: false,
                  message: "No execution state. Run mags_init_execution first.",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                hasState: true,
                status: status.status,
                progress: `${status.progress}%`,
                currentModule: status.currentModule,
                currentStep: status.currentStep,
                totalSteps: status.totalSteps,
                completedModules: state?.completed.modules || [],
                completedSteps: state?.completed.steps.length || 0,
                pendingSteps: state?.pending.steps.length || 0,
                errors: state?.errors.length || 0,
                blockers: state?.blockers.length || 0,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
