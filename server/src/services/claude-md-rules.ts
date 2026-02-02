// ============================================
// MAGS — CLAUDE.md Rules
// Stack and architecture-specific rules for CLAUDE.md generation
// ============================================

import type { ArchitectureType, StackConfig } from "../types/index.js";

export const STACK_RULES: Record<string, string[]> = {
  typescript: [
    "No `any` types — use `unknown` when the type is truly uncertain",
    "Prefer `const` over `let`; never use `var`",
    "Use strict TypeScript (`strict: true` in tsconfig)",
    "Prefer interfaces over type aliases for object shapes",
    "Use `readonly` for properties that should not be mutated",
    "Handle all promise rejections — no unhandled promises",
    "Use branded types for domain identifiers (e.g., `UserId`, `OrderId`)",
  ],
  javascript: [
    "Use ES modules (`import`/`export`) over CommonJS (`require`)",
    "Prefer `const` over `let`; never use `var`",
    "Use optional chaining (`?.`) and nullish coalescing (`??`)",
    "Handle all promise rejections",
  ],
  python: [
    "Follow PEP 8 style guidelines",
    "Use type hints on all function signatures",
    "Use dataclasses or Pydantic models for structured data",
    "Prefer f-strings over `.format()` or `%` formatting",
    "Use `pathlib.Path` over `os.path` for file operations",
    "Use context managers (`with`) for resource management",
    "Run `ruff` or `flake8` for linting; `mypy` for type checking",
  ],
  go: [
    "Run `gofmt` and `go vet` on all code",
    "Always handle errors — never use `_` to discard errors",
    "Use `context.Context` as the first parameter for functions that do I/O",
    "Prefer returning errors over panicking",
    "Use `errors.Is()` and `errors.As()` for error checking",
    "Keep interfaces small (1-3 methods)",
    "Use table-driven tests",
  ],
  rust: [
    "Run `cargo clippy` and fix all warnings",
    "Avoid `.unwrap()` in production code — use `?` operator or proper error handling",
    "Use `thiserror` for library errors, `anyhow` for application errors",
    "Prefer borrowing over cloning",
    "Use `#[derive]` macros for common trait implementations",
    "Document public API with `///` doc comments",
    "Use `cargo fmt` for consistent formatting",
  ],
  java: [
    "Use `Optional` instead of returning `null`",
    "Prefer immutable objects — use `final` fields and builder pattern",
    "Use records for simple data carriers (Java 16+)",
    "Follow Java naming conventions (camelCase methods, PascalCase classes)",
    "Use `var` for local variables when the type is obvious",
    "Prefer `Stream` API over imperative loops for collections",
    "Use SLF4J for logging — never `System.out.println` in production",
  ],
};

export const ARCHITECTURE_GUIDANCE: Record<string, string[]> = {
  monolith: [
    "Organize code into modules with clear boundaries",
    "Each module should have a well-defined public API",
    "Avoid circular dependencies between modules",
    "Use dependency injection for loose coupling",
  ],
  microservices: [
    "Each service owns its data — no shared databases",
    "Define service boundaries based on domain contexts",
    "Use async communication between services where possible",
    "Implement circuit breakers for inter-service calls",
    "Keep services independently deployable",
  ],
  library: [
    "Minimize the public API surface — expose only what users need",
    "Document every public function, class, and type",
    "Follow semantic versioning strictly",
    "Do not introduce breaking changes in minor/patch versions",
    "Keep dependencies minimal to avoid conflicts",
  ],
  cli: [
    "Use consistent verb-noun command naming",
    "Provide `--help` for every command",
    "Support `--json` output for scripting",
    "Use meaningful exit codes (0 = success, 1 = error, 2 = usage error)",
    "Respect `NO_COLOR` and `TERM` environment variables",
  ],
  mobile: [
    "Design for offline-first where applicable",
    "Handle all screen states: loading, error, empty, data",
    "Follow platform conventions (iOS HIG / Material Design)",
    "Optimize images and assets for mobile",
    "Test on multiple screen sizes",
  ],
  serverless: [
    "Keep functions stateless and idempotent",
    "Minimize package size to reduce cold starts",
    "Set appropriate memory and timeout limits",
    "Use environment variables for configuration",
    "Implement dead letter queues for failed events",
  ],
};

export function getStackRules(stack?: StackConfig): string[] {
  if (!stack?.primaryLanguage) return [];

  const lang = stack.primaryLanguage.toLowerCase();

  // Map common language names to our keys
  const langMap: Record<string, string> = {
    typescript: "typescript",
    javascript: "javascript",
    "typescript/javascript": "typescript",
    python: "python",
    go: "go",
    rust: "rust",
    java: "java",
  };

  const key = langMap[lang] ?? lang;
  return STACK_RULES[key] ?? [];
}

export function getArchitectureGuidance(arch?: ArchitectureType): string[] {
  if (!arch) return [];
  return ARCHITECTURE_GUIDANCE[arch] ?? [];
}
