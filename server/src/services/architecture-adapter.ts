// ============================================
// MAGS — Architecture Adapter
// Provides architecture-specific defaults and guidance
// ============================================

import type { ArchitectureType } from "../types/index.js";

export interface ArchitectureDefaults {
  templates: string[];
  modules: string[];
  guidance: string[];
}

const ARCHITECTURE_DEFAULTS: Record<ArchitectureType, ArchitectureDefaults> = {
  monolith: {
    templates: ["vision", "discovery", "prd", "tech-stack", "data-model", "api-design", "project-structure", "mvp-scope", "index"],
    modules: ["auth", "core", "api", "database", "frontend"],
    guidance: [
      "Use modular monolith patterns to keep boundaries clear",
      "Separate concerns into modules/domains within a single deployable",
      "Plan for potential future decomposition by keeping module interfaces clean",
      "Use a shared database with schema-per-module where appropriate",
    ],
  },
  microservices: {
    templates: ["vision", "discovery", "prd", "tech-stack", "data-model", "api-design", "project-structure", "mvp-scope", "index", "service-catalog", "api-gateway", "inter-service-comm"],
    modules: ["api-gateway", "service-discovery", "auth-service", "messaging"],
    guidance: [
      "Each service owns its data — no shared databases",
      "Use async communication (events/messages) between services where possible",
      "Implement circuit breakers and retry policies for inter-service calls",
      "Centralize cross-cutting concerns in the API gateway",
      "Define clear service boundaries based on domain contexts",
    ],
  },
  library: {
    templates: ["vision", "discovery", "tech-stack", "project-structure", "index", "api-reference", "usage-guide", "versioning"],
    modules: ["core", "api", "types", "utils"],
    guidance: [
      "Design a minimal, intuitive public API surface",
      "Follow semantic versioning strictly",
      "Document every public function, class, and type",
      "Maintain backward compatibility within major versions",
      "Include comprehensive examples in documentation",
      "Keep dependencies minimal to avoid version conflicts",
    ],
  },
  cli: {
    templates: ["vision", "discovery", "tech-stack", "project-structure", "index", "cli-design", "cli-reference"],
    modules: ["commands", "config", "output", "utils"],
    guidance: [
      "Follow the verb-noun command pattern (e.g., 'get users')",
      "Support both interactive and non-interactive (CI) modes",
      "Provide structured output options (JSON, table, YAML)",
      "Use meaningful exit codes",
      "Include --help for every command and subcommand",
      "Support configuration files and environment variables",
    ],
  },
  mobile: {
    templates: ["vision", "discovery", "prd", "tech-stack", "project-structure", "mvp-scope", "index", "screens", "platform-config"],
    modules: ["navigation", "auth", "networking", "storage", "ui-components"],
    guidance: [
      "Design offline-first where applicable",
      "Handle all screen states: loading, error, empty, data",
      "Respect platform conventions (iOS HIG, Material Design)",
      "Optimize for battery and network efficiency",
      "Test on multiple screen sizes and OS versions",
      "Plan deep linking from the start",
    ],
  },
  serverless: {
    templates: ["vision", "discovery", "prd", "tech-stack", "data-model", "api-design", "project-structure", "index", "functions", "event-triggers"],
    modules: ["functions", "triggers", "storage", "auth"],
    guidance: [
      "Design functions to be stateless and idempotent",
      "Minimize cold start impact (small packages, lazy initialization)",
      "Use event-driven patterns over synchronous calls where possible",
      "Set appropriate timeouts and memory limits per function",
      "Implement proper error handling with dead letter queues",
      "Monitor and alert on function duration and error rates",
    ],
  },
};

export class ArchitectureAdapter {
  private architecture: ArchitectureType;

  constructor(architecture: ArchitectureType) {
    this.architecture = architecture;
  }

  getDefaults(): ArchitectureDefaults {
    return ARCHITECTURE_DEFAULTS[this.architecture] ?? ARCHITECTURE_DEFAULTS.monolith;
  }

  getTemplates(): string[] {
    return this.getDefaults().templates;
  }

  getModules(): string[] {
    return this.getDefaults().modules;
  }

  getGuidance(): string[] {
    return this.getDefaults().guidance;
  }
}
