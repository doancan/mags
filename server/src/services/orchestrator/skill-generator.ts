// ============================================
// MAGS — Skill Generator (Dynamic LLM-based)
// ============================================

import type {
  ExtractedPlan,
  ExtractedModule,
  GeneratedSkill,
  CoreSkillType,
} from "../../types/orchestrator.js";
import type { DetectedStack } from "../../types/index.js";

// --- Core Skills (Pre-defined templates) ---

const CORE_SKILLS: Record<CoreSkillType, string> = {
  "backend-dev": `---
name: backend-dev
description: Backend development guidance
---

# Backend Development

## Layers
- Controller → Service → Repository
- Each layer has single responsibility

## Standards
- All endpoints must be typed
- Validation with class-validator/zod
- Error handling with proper HTTP codes
- Logging for debugging

## Testing
- Unit tests for services
- Integration tests for controllers
- Tenant isolation tests (if multi-tenant)
`,

  "frontend-dev": `---
name: frontend-dev
description: Frontend development guidance
---

# Frontend Development

## Component Structure
- Atomic design: atoms → molecules → organisms → templates → pages
- Each component in its own folder with test

## State Management
- Server state: TanStack Query
- Client state: Context or Zustand
- No useEffect for data fetching

## Standards
- TypeScript strict mode
- Tailwind for styling (no arbitrary values)
- Accessibility: semantic HTML, ARIA labels
`,

  "api-dev": `---
name: api-dev
description: API design and development
---

# API Development

## REST Standards
- Resource-based URLs
- Proper HTTP methods (GET, POST, PATCH, DELETE)
- Consistent response format
- Pagination for lists

## Validation
- Request validation at controller level
- Response DTOs for type safety

## Documentation
- OpenAPI/Swagger specs
- Examples for each endpoint
`,

  "database-dev": `---
name: database-dev
description: Database schema design and migrations
---

# Database Development

## Schema Design
- Normalize appropriately
- Use UUIDs for primary keys
- Timestamps: created_at, updated_at
- Soft delete: deleted_at

## Migrations
- One change per migration
- Reversible migrations
- Test on copy before production

## Performance
- Index frequently queried columns
- Avoid N+1 queries
- Use connection pooling
`,

  "testing": `---
name: testing
description: Testing strategy and patterns
---

# Testing

## Test Pyramid
- Unit tests: 70%
- Integration tests: 20%
- E2E tests: 10%

## Coverage Targets
- Minimum: 80%
- Critical paths: 100%

## Patterns
- Arrange-Act-Assert
- One assertion per test
- Mock external dependencies
- Use factories for test data
`,

  "documentation": `---
name: documentation
description: Technical documentation standards
---

# Documentation

## Types
- API reference (auto-generated)
- Architecture decisions (ADR)
- Developer guides
- Runbooks

## Standards
- Keep close to code
- Update with code changes
- Examples over explanations
- Version alongside code
`,
};

// --- Skill Generator Class ---

export class SkillGenerator {
  /**
   * Generate all skills for a plan
   */
  async generateAll(
    plan: ExtractedPlan,
    stack?: DetectedStack
  ): Promise<GeneratedSkill[]> {
    const skills: GeneratedSkill[] = [];

    // Add core skills
    for (const [type, content] of Object.entries(CORE_SKILLS)) {
      skills.push({
        name: type,
        path: `skills/${type}/SKILL.md`,
        content: this.enhanceWithStack(content, stack),
        module: "core",
        features: [],
      });
    }

    // Generate module-specific skills
    for (const module of plan.modules) {
      const skill = await this.generateModuleSkill(module, plan, stack);
      skills.push(skill);
    }

    return skills;
  }

  /**
   * Generate skill for a specific module
   */
  async generateModuleSkill(
    module: ExtractedModule,
    plan: ExtractedPlan,
    stack?: DetectedStack
  ): Promise<GeneratedSkill> {
    const content = this.buildModuleSkillContent(module, plan, stack);

    return {
      name: `${module.name}-dev`,
      path: `skills/${module.name}-dev/SKILL.md`,
      content,
      module: module.name,
      features: module.features.map((f) => f.id),
    };
  }

  /**
   * Get core skill by type
   */
  getCoreSkill(type: CoreSkillType): string {
    return CORE_SKILLS[type] || "";
  }

  // --- Private Methods ---

  private buildModuleSkillContent(
    module: ExtractedModule,
    plan: ExtractedPlan,
    stack?: DetectedStack
  ): string {
    const stackInfo = stack
      ? `
## Tech Stack
- Language: ${stack.languages.join(", ")}
- Frameworks: ${stack.frameworks.join(", ")}
- Database: ${stack.databases.join(", ")}
- API Style: ${stack.apiStyle.join(", ")}
`
      : "";

    const features = module.features
      .map((f) => `- [ ] ${f.id}: ${f.name} (${f.priority})`)
      .join("\n");

    const acceptance = module.acceptanceCriteria
      .map((ac) => `- [ ] ${ac}`)
      .join("\n");

    const deps = module.dependencies.requires.length > 0
      ? `\n## Dependencies\nRequires: ${module.dependencies.requires.join(", ")}`
      : "";

    const blocks = module.dependencies.blocks.length > 0
      ? `\nEnables: ${module.dependencies.blocks.join(", ")}`
      : "";

    return `---
name: ${module.name}-dev
description: ${module.description || `${module.name} module development`}
triggers:
  - "${module.name} modülünü geliştir"
  - "${module.name} özelliği ekle"
  - "develop ${module.name}"
---

# ${this.capitalize(module.name)} Development

## Context
${module.description || `Development guide for ${module.name} module.`}
${stackInfo}
## Features to Implement
${features}

## Step-by-Step Guide

### Step 1: Setup
- [ ] Create module directory: \`src/modules/${module.name}/\`
- [ ] Create base files: controller, service, repository
- [ ] Register module in app.module.ts

### Step 2: Data Model
- [ ] Define schema/model for ${module.name}
- [ ] Add necessary relations
- [ ] Run migration

### Step 3: API Endpoints
${this.generateEndpointChecklist(module)}

### Step 4: Business Logic
- [ ] Implement core service methods
- [ ] Add validation rules
- [ ] Handle edge cases

### Step 5: Testing (TDD)
- [ ] Write unit tests for service (min 80% coverage)
- [ ] Write integration tests for controller
${plan.project.name.toLowerCase().includes("tenant") ? "- [ ] Write tenant isolation tests" : ""}
- [ ] Verify all acceptance criteria

### Step 6: Documentation
- [ ] Update API docs
- [ ] Update data model docs
- [ ] Record decisions in memory

## Acceptance Criteria
${acceptance}
${deps}${blocks}

## Validation Checklist
- [ ] All tests passing
- [ ] Coverage >= 80%
- [ ] No lint errors
- [ ] API documented
- [ ] PRD requirements met
`;
  }

  private generateEndpointChecklist(module: ExtractedModule): string {
    const name = module.name;
    return `- [ ] GET /api/v1/${name}s - List with pagination
- [ ] POST /api/v1/${name}s - Create
- [ ] GET /api/v1/${name}s/:id - Get by ID
- [ ] PATCH /api/v1/${name}s/:id - Update
- [ ] DELETE /api/v1/${name}s/:id - Delete`;
  }

  private enhanceWithStack(content: string, stack?: DetectedStack): string {
    if (!stack) return content;

    // Add stack-specific notes
    let enhanced = content;

    if (stack.frameworks.includes("nestjs")) {
      enhanced = enhanced.replace(
        "## Standards",
        "## Standards\n- Use NestJS decorators\n- Dependency injection for services"
      );
    }

    if (stack.frameworks.includes("prisma")) {
      enhanced = enhanced.replace(
        "## Migrations",
        "## Migrations (Prisma)\n- Use `prisma migrate dev`\n- Check schema.prisma"
      );
    }

    return enhanced;
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

// --- Factory ---

export function createSkillGenerator(): SkillGenerator {
  return new SkillGenerator();
}
