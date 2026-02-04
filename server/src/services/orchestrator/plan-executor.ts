// ============================================
// MAGS — Plan Executor (Guided Step-by-Step)
// ============================================

import * as fs from "fs";
import * as path from "path";
import * as yaml from "yaml";
import type {
  ExtractedPlan,
  ExtractedModule,
  ExecutionState,
  ExecutionStep,
  StepResult,
  StepType,
  StepPrompt,
  UserAction,
  ExecutionStatus,
  PhaseNumber,
} from "../../types/orchestrator.js";

// --- Step Templates ---

const STEP_TEMPLATES: Record<string, (module: ExtractedModule) => ExecutionStep[]> = {
  backend: (module) => [
    {
      step: 1,
      type: "scaffold",
      description: `Create ${module.name} module directory structure`,
      file: `src/modules/${module.name}/`,
      module: module.name,
    },
    {
      step: 2,
      type: "code",
      description: `Create ${module.name} entity/model`,
      file: `src/modules/${module.name}/${module.name}.entity.ts`,
      module: module.name,
    },
    {
      step: 3,
      type: "migrate",
      description: `Create database migration for ${module.name}`,
      module: module.name,
      commands: ["npx prisma migrate dev --name add_${module.name}"],
    },
    {
      step: 4,
      type: "code",
      description: `Create ${module.name} repository`,
      file: `src/modules/${module.name}/${module.name}.repository.ts`,
      module: module.name,
    },
    {
      step: 5,
      type: "code",
      description: `Create ${module.name} service`,
      file: `src/modules/${module.name}/${module.name}.service.ts`,
      module: module.name,
    },
    {
      step: 6,
      type: "test",
      description: `Write unit tests for ${module.name} service`,
      file: `src/modules/${module.name}/${module.name}.service.spec.ts`,
      module: module.name,
    },
    {
      step: 7,
      type: "code",
      description: `Create ${module.name} DTOs`,
      file: `src/modules/${module.name}/dto/`,
      module: module.name,
    },
    {
      step: 8,
      type: "code",
      description: `Create ${module.name} controller`,
      file: `src/modules/${module.name}/${module.name}.controller.ts`,
      module: module.name,
    },
    {
      step: 9,
      type: "test",
      description: `Write integration tests for ${module.name} controller`,
      file: `src/modules/${module.name}/${module.name}.controller.spec.ts`,
      module: module.name,
    },
    {
      step: 10,
      type: "config",
      description: `Register ${module.name} module`,
      file: `src/modules/${module.name}/${module.name}.module.ts`,
      module: module.name,
    },
    {
      step: 11,
      type: "verify",
      description: `Run all tests and verify ${module.name}`,
      module: module.name,
      commands: ["pnpm test", "pnpm lint", "pnpm typecheck"],
    },
    {
      step: 12,
      type: "checkpoint",
      description: `Commit ${module.name} module`,
      module: module.name,
    },
  ],

  frontend: (module) => [
    {
      step: 1,
      type: "scaffold",
      description: `Create ${module.name} component directory`,
      file: `src/components/${module.name}/`,
      module: module.name,
    },
    {
      step: 2,
      type: "code",
      description: `Create ${module.name} list component`,
      file: `src/components/${module.name}/${module.name}-list.tsx`,
      module: module.name,
    },
    {
      step: 3,
      type: "code",
      description: `Create ${module.name} form component`,
      file: `src/components/${module.name}/${module.name}-form.tsx`,
      module: module.name,
    },
    {
      step: 4,
      type: "code",
      description: `Create ${module.name} API hooks`,
      file: `src/hooks/use-${module.name}.ts`,
      module: module.name,
    },
    {
      step: 5,
      type: "code",
      description: `Create ${module.name} pages`,
      file: `src/routes/${module.name}/`,
      module: module.name,
    },
    {
      step: 6,
      type: "test",
      description: `Write component tests for ${module.name}`,
      file: `src/components/${module.name}/__tests__/`,
      module: module.name,
    },
    {
      step: 7,
      type: "verify",
      description: `Run tests and verify ${module.name} frontend`,
      module: module.name,
      commands: ["pnpm test", "pnpm lint"],
    },
    {
      step: 8,
      type: "checkpoint",
      description: `Commit ${module.name} frontend`,
      module: module.name,
    },
  ],
};

// --- Plan Executor Class ---

export class PlanExecutor {
  private state: ExecutionState | null = null;
  private stateFile: string;
  private plan: ExtractedPlan | null = null;

  constructor(magsDir: string = "docs/.mags") {
    this.stateFile = path.join(magsDir, "plans", "execution-state.yaml");
  }

  /**
   * Initialize execution from a plan
   */
  async initialize(plan: ExtractedPlan, moduleType: "backend" | "frontend" = "backend"): Promise<ExecutionState> {
    this.plan = plan;

    // Generate steps for all modules
    const allSteps: ExecutionStep[] = [];
    let stepCounter = 1;

    for (const module of this.getOrderedModules(plan)) {
      const template = STEP_TEMPLATES[moduleType] || STEP_TEMPLATES.backend;
      const moduleSteps = template(module).map((step) => ({
        ...step,
        step: stepCounter++,
      }));
      allSteps.push(...moduleSteps);
    }

    this.state = {
      version: "1.0",
      updatedAt: new Date().toISOString(),
      status: "idle",
      currentPhase: 1,
      currentModule: plan.modules[0]?.name || "",
      currentStep: 1,
      totalSteps: allSteps.length,
      completed: {
        modules: [],
        steps: [],
      },
      pending: {
        steps: allSteps,
      },
      errors: [],
      blockers: [],
      checkpoint: {
        lastSave: new Date().toISOString(),
      },
    };

    await this.saveState();
    return this.state;
  }

  /**
   * Load existing execution state
   */
  async load(): Promise<ExecutionState | null> {
    if (!fs.existsSync(this.stateFile)) {
      return null;
    }

    const content = fs.readFileSync(this.stateFile, "utf-8");
    this.state = yaml.parse(content) as ExecutionState;
    return this.state;
  }

  /**
   * Get current step prompt for user
   */
  getCurrentStepPrompt(): StepPrompt | null {
    if (!this.state || this.state.status === "completed") {
      return null;
    }

    const currentStep = this.state.pending.steps.find(
      (s) => s.step === this.state!.currentStep
    );

    if (!currentStep) {
      return null;
    }

    return {
      step: currentStep.step,
      totalSteps: this.state.totalSteps,
      title: currentStep.description,
      description: this.getStepDescription(currentStep),
      file: currentStep.file,
      actions: currentStep.feature ? [currentStep.feature] : [],
      availableActions: this.getAvailableActions(currentStep),
    };
  }

  /**
   * Execute user action on current step
   */
  async executeAction(action: UserAction): Promise<{
    success: boolean;
    message: string;
    nextPrompt?: StepPrompt | null;
  }> {
    if (!this.state) {
      return { success: false, message: "No execution state loaded" };
    }

    switch (action) {
      case "approve":
        return this.executeCurrentStep();

      case "skip":
        return this.skipCurrentStep();

      case "quit":
        return this.pauseExecution();

      case "retry":
        return this.retryCurrentStep();

      case "next":
        return this.moveToNextStep();

      case "previous":
        return this.moveToPreviousStep();

      default:
        return { success: false, message: `Unknown action: ${action}` };
    }
  }

  /**
   * Get execution state
   */
  getState(): ExecutionState | null {
    return this.state;
  }

  /**
   * Check if execution is complete
   */
  isComplete(): boolean {
    return this.state?.status === "completed";
  }

  /**
   * Get progress percentage
   */
  getProgressPercent(): number {
    if (!this.state) return 0;
    const completed = this.state.completed.steps.length;
    return Math.round((completed / this.state.totalSteps) * 100);
  }

  // --- Private Methods ---

  private async executeCurrentStep(): Promise<{
    success: boolean;
    message: string;
    nextPrompt?: StepPrompt | null;
  }> {
    if (!this.state) {
      return { success: false, message: "No state" };
    }

    const step = this.state.pending.steps.find(
      (s) => s.step === this.state!.currentStep
    );

    if (!step) {
      return { success: false, message: "Step not found" };
    }

    // Mark step as completed
    const result: StepResult = {
      step: step.step,
      status: "completed",
      duration: "0s", // Would be calculated in real execution
      timestamp: new Date().toISOString(),
    };

    this.state.completed.steps.push(result);
    this.state.pending.steps = this.state.pending.steps.filter(
      (s) => s.step !== step.step
    );

    // Check if module is complete
    const moduleSteps = this.state.pending.steps.filter(
      (s) => s.module === step.module
    );
    if (moduleSteps.length === 0) {
      this.state.completed.modules.push(step.module);
    }

    // Move to next step
    this.state.currentStep++;
    this.state.status = "in_progress";

    // Check if all done
    if (this.state.pending.steps.length === 0) {
      this.state.status = "completed";
    } else {
      // Update current module
      const nextStep = this.state.pending.steps[0];
      if (nextStep) {
        this.state.currentModule = nextStep.module;
      }
    }

    this.state.updatedAt = new Date().toISOString();
    await this.saveState();

    return {
      success: true,
      message: `Step ${step.step} completed: ${step.description}`,
      nextPrompt: this.getCurrentStepPrompt(),
    };
  }

  private async skipCurrentStep(): Promise<{
    success: boolean;
    message: string;
    nextPrompt?: StepPrompt | null;
  }> {
    if (!this.state) {
      return { success: false, message: "No state" };
    }

    const step = this.state.pending.steps.find(
      (s) => s.step === this.state!.currentStep
    );

    if (!step) {
      return { success: false, message: "Step not found" };
    }

    const result: StepResult = {
      step: step.step,
      status: "skipped",
      duration: "0s",
      timestamp: new Date().toISOString(),
    };

    this.state.completed.steps.push(result);
    this.state.pending.steps = this.state.pending.steps.filter(
      (s) => s.step !== step.step
    );

    this.state.currentStep++;
    this.state.updatedAt = new Date().toISOString();
    await this.saveState();

    return {
      success: true,
      message: `Step ${step.step} skipped`,
      nextPrompt: this.getCurrentStepPrompt(),
    };
  }

  private async pauseExecution(): Promise<{
    success: boolean;
    message: string;
  }> {
    if (!this.state) {
      return { success: false, message: "No state" };
    }

    this.state.status = "paused";
    this.state.updatedAt = new Date().toISOString();
    this.state.checkpoint.lastSave = new Date().toISOString();
    await this.saveState();

    return {
      success: true,
      message: `Execution paused at step ${this.state.currentStep}. Run resume to continue.`,
    };
  }

  private async retryCurrentStep(): Promise<{
    success: boolean;
    message: string;
    nextPrompt?: StepPrompt | null;
  }> {
    // Simply return current step prompt again
    return {
      success: true,
      message: "Retrying current step",
      nextPrompt: this.getCurrentStepPrompt(),
    };
  }

  private async moveToNextStep(): Promise<{
    success: boolean;
    message: string;
    nextPrompt?: StepPrompt | null;
  }> {
    if (!this.state) {
      return { success: false, message: "No state" };
    }

    this.state.currentStep++;
    await this.saveState();

    return {
      success: true,
      message: "Moved to next step",
      nextPrompt: this.getCurrentStepPrompt(),
    };
  }

  private async moveToPreviousStep(): Promise<{
    success: boolean;
    message: string;
    nextPrompt?: StepPrompt | null;
  }> {
    if (!this.state || this.state.currentStep <= 1) {
      return { success: false, message: "Already at first step" };
    }

    this.state.currentStep--;
    await this.saveState();

    return {
      success: true,
      message: "Moved to previous step",
      nextPrompt: this.getCurrentStepPrompt(),
    };
  }

  private getOrderedModules(plan: ExtractedPlan): ExtractedModule[] {
    // Topological sort based on dependencies
    const modules = [...plan.modules];
    const result: ExtractedModule[] = [];
    const visited = new Set<string>();

    const visit = (name: string) => {
      if (visited.has(name)) return;
      visited.add(name);

      const module = modules.find((m) => m.name === name);
      if (!module) return;

      for (const dep of module.dependencies.requires) {
        visit(dep);
      }

      result.push(module);
    };

    for (const module of modules) {
      visit(module.name);
    }

    return result;
  }

  private getStepDescription(step: ExecutionStep): string {
    const typeDescriptions: Record<StepType, string> = {
      scaffold: "Create directory structure",
      code: "Write implementation code",
      test: "Write and run tests",
      migrate: "Run database migration",
      config: "Update configuration",
      verify: "Verify all checks pass",
      document: "Update documentation",
      checkpoint: "Commit changes to git",
    };

    return typeDescriptions[step.type] || step.description;
  }

  private getAvailableActions(step: ExecutionStep): UserAction[] {
    const base: UserAction[] = ["approve", "skip", "quit", "details"];

    if (step.type === "verify" || step.type === "test") {
      return ["approve", "retry", "skip", "quit", "details"];
    }

    return base;
  }

  private async saveState(): Promise<void> {
    if (!this.state) return;

    const dir = path.dirname(this.stateFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const content = yaml.stringify(this.state);
    fs.writeFileSync(this.stateFile, content);
  }
}

// --- Factory ---

export function createPlanExecutor(magsDir?: string): PlanExecutor {
  return new PlanExecutor(magsDir);
}

// --- Shortcut Mapping ---

export const ACTION_SHORTCUTS: Record<string, UserAction> = {
  a: "approve",
  e: "edit",
  s: "skip",
  r: "retry",
  n: "next",
  p: "previous",
  q: "quit",
  h: "help",
  d: "details",
  l: "list",
};

// Valid user actions for direct matching
const VALID_ACTIONS: Set<UserAction> = new Set([
  "approve",
  "edit",
  "skip",
  "retry",
  "next",
  "previous",
  "quit",
  "help",
  "details",
  "list",
]);

export function parseShortcut(input: string): UserAction | null {
  const normalized = input.toLowerCase().trim();

  // First check if it's a valid action name directly
  if (VALID_ACTIONS.has(normalized as UserAction)) {
    return normalized as UserAction;
  }

  // Then check shortcuts
  return ACTION_SHORTCUTS[normalized] || null;
}
