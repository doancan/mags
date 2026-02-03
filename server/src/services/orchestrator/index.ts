// ============================================
// MAGS — Project Orchestrator
// Main entry point and coordinator
// ============================================

export * from "./prd-parser.js";
export * from "./skill-generator.js";
export * from "./agent-generator.js";
export * from "./plan-executor.js";
export * from "./code-analyzer.js";
export * from "./tdd-engine.js";

import { PrdParser, createPrdParser } from "./prd-parser.js";
import { SkillGenerator, createSkillGenerator } from "./skill-generator.js";
import { AgentGenerator, createAgentGenerator } from "./agent-generator.js";
import { PlanExecutor, createPlanExecutor, parseShortcut } from "./plan-executor.js";
import { CodeAnalyzer, createCodeAnalyzer } from "./code-analyzer.js";
import { TddEngine, createTddEngine } from "./tdd-engine.js";

import type {
  ExtractedPlan,
  ExecutionState,
  GeneratedSkill,
  GeneratedAgent,
  VerificationReport,
  UserAction,
  StepPrompt,
  CodeAnalysisResult,
  ReversePrd,
} from "../../types/orchestrator.js";
import type { DetectedStack } from "../../types/index.js";

// --- Orchestrator Class ---

export interface OrchestratorConfig {
  projectRoot?: string;
  magsDir?: string;
  moduleType?: "backend" | "frontend";
}

export class Orchestrator {
  private prdParser: PrdParser;
  private skillGenerator: SkillGenerator;
  private agentGenerator: AgentGenerator;
  private planExecutor: PlanExecutor;
  private codeAnalyzer: CodeAnalyzer;
  private tddEngine: TddEngine;

  private config: OrchestratorConfig;
  private plan: ExtractedPlan | null = null;
  private stack: DetectedStack | null = null;

  constructor(config: OrchestratorConfig = {}) {
    this.config = {
      projectRoot: config.projectRoot || process.cwd(),
      magsDir: config.magsDir || "docs/.mags",
      moduleType: config.moduleType || "backend",
    };

    this.prdParser = createPrdParser();
    this.skillGenerator = createSkillGenerator();
    this.agentGenerator = createAgentGenerator();
    this.planExecutor = createPlanExecutor(this.config.magsDir);
    this.codeAnalyzer = createCodeAnalyzer(this.config.projectRoot);
    this.tddEngine = createTddEngine(this.config.projectRoot, this.config.magsDir);
  }

  // --- Greenfield Flow (New Project) ---

  /**
   * Initialize from PRD (new project)
   */
  async initializeFromPrd(prdPath: string, stack?: DetectedStack): Promise<{
    success: boolean;
    plan?: ExtractedPlan;
    errors?: string[];
  }> {
    // Parse PRD
    const plan = await this.prdParser.parse(prdPath);

    if (!plan) {
      return {
        success: false,
        errors: this.prdParser.getErrors().map((e) => e.message),
      };
    }

    this.plan = plan;
    this.stack = stack || null;

    // Initialize execution
    await this.planExecutor.initialize(plan, this.config.moduleType);

    return { success: true, plan };
  }

  /**
   * Generate all skills and agents
   */
  async generateArtifacts(): Promise<{
    skills: GeneratedSkill[];
    agents: GeneratedAgent[];
  }> {
    if (!this.plan) {
      throw new Error("No plan loaded. Call initializeFromPrd first.");
    }

    const skills = await this.skillGenerator.generateAll(this.plan, this.stack || undefined);
    const agents = await this.agentGenerator.generateAll(this.plan, this.stack || undefined);

    return { skills, agents };
  }

  // --- Brownfield Flow (Existing Project) ---

  /**
   * Analyze existing codebase
   */
  async analyzeCodebase(): Promise<CodeAnalysisResult> {
    return this.codeAnalyzer.analyze();
  }

  /**
   * Generate reverse PRD from analysis
   */
  async generateReversePrd(): Promise<ReversePrd> {
    return this.codeAnalyzer.generateReversePrd();
  }

  // --- Execution Flow ---

  /**
   * Get current step prompt
   */
  getCurrentStep(): StepPrompt | null {
    return this.planExecutor.getCurrentStepPrompt();
  }

  /**
   * Execute user action
   */
  async executeAction(action: UserAction | string): Promise<{
    success: boolean;
    message: string;
    nextPrompt?: StepPrompt | null;
  }> {
    // Parse shortcut if string
    const parsedAction = typeof action === "string" ? parseShortcut(action) : action;

    if (!parsedAction) {
      return { success: false, message: `Unknown action: ${action}` };
    }

    return this.planExecutor.executeAction(parsedAction);
  }

  /**
   * Resume from saved state
   */
  async resume(): Promise<{
    success: boolean;
    state?: ExecutionState;
    prompt?: StepPrompt | null;
  }> {
    const state = await this.planExecutor.load();

    if (!state) {
      return { success: false };
    }

    return {
      success: true,
      state,
      prompt: this.planExecutor.getCurrentStepPrompt(),
    };
  }

  // --- Verification ---

  /**
   * Verify current module
   */
  async verifyCurrentModule(): Promise<VerificationReport | null> {
    const state = this.planExecutor.getState();
    if (!state || !this.plan) return null;

    const module = this.plan.modules.find((m) => m.name === state.currentModule);
    if (!module) return null;

    return this.tddEngine.verify(module);
  }

  // --- Status ---

  /**
   * Get execution status
   */
  getStatus(): {
    status: string;
    progress: number;
    currentModule: string;
    currentStep: number;
    totalSteps: number;
  } | null {
    const state = this.planExecutor.getState();
    if (!state) return null;

    return {
      status: state.status,
      progress: this.planExecutor.getProgressPercent(),
      currentModule: state.currentModule,
      currentStep: state.currentStep,
      totalSteps: state.totalSteps,
    };
  }

  /**
   * Check if execution is complete
   */
  isComplete(): boolean {
    return this.planExecutor.isComplete();
  }

  // --- Getters ---

  getPlan(): ExtractedPlan | null {
    return this.plan;
  }

  getStack(): DetectedStack | null {
    return this.stack;
  }

  getExecutionState(): ExecutionState | null {
    return this.planExecutor.getState();
  }
}

// --- Factory ---

export function createOrchestrator(config?: OrchestratorConfig): Orchestrator {
  return new Orchestrator(config);
}

// --- Quick Start Helpers ---

/**
 * Quick start for new project
 */
export async function quickStartGreenfield(
  prdPath: string,
  stack?: DetectedStack
): Promise<Orchestrator> {
  const orchestrator = createOrchestrator();
  await orchestrator.initializeFromPrd(prdPath, stack);
  return orchestrator;
}

/**
 * Quick start for existing project
 */
export async function quickStartBrownfield(
  projectRoot?: string
): Promise<{ orchestrator: Orchestrator; analysis: CodeAnalysisResult; reversePrd: ReversePrd }> {
  const orchestrator = createOrchestrator({ projectRoot });
  const analysis = await orchestrator.analyzeCodebase();
  const reversePrd = await orchestrator.generateReversePrd();
  return { orchestrator, analysis, reversePrd };
}
