# Changelog

All notable changes to MAGS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-02-04

### Added

#### Project Orchestrator (Major Feature)
- **Orchestrator Core**: Intelligent project analysis and planning system
  - PRD parser for extracting features, modules, and requirements
  - Code analyzer for codebase structure analysis (directories, files, functions, classes)
  - Tech debt detection (TODO, FIXME, HACK, XXX, BUG markers)
  - Agent generator for creating specialized development agents
  - Skill generator for creating context-aware skills
  - Plan executor for automated task execution with progress tracking
  - TDD engine for test-driven development workflow support

- **New MCP Tools**:
  - `mags_analyze_project` - Comprehensive project analysis
  - `mags_generate_plan` - Generate execution plans from PRD
  - `mags_execute_plan` - Execute plans with progress tracking
  - `mags_analyze_tech_debt` - Analyze and report technical debt
  - `mags_generate_agent` - Generate specialized agents from analysis
  - `mags_generate_skill` - Generate skills based on project context

- **Hooks**:
  - `PreCompact` hook for session state persistence before context compaction
  - `SessionStart` hook for automatic session context loading

- **Build & Developer Experience**:
  - ESLint flat config with TypeScript support
  - Prettier configuration for consistent code formatting
  - Husky pre-commit hooks for lint and format checks
  - Postinstall script for automatic better-sqlite3 rebuild

- **Testing**:
  - Comprehensive unit tests for all tool modules (14 new test files)
  - OpenAI embedding provider unit tests
  - E2E test suite for orchestrator workflows
  - Integration tests for all tool modules

### Changed

- **McpServer type safety**: Added proper TypeScript types to tool handlers
- **Stack detector**: Use `detectWithFallback` for full fallback chain
- **CLAUDE.md tools**: Improved rules section detection with header matching
- **Doc indexer**: Handle YAML frontmatter parse errors gracefully
- **Progress manager**: Added null-safe checks for `dependsOn` field
- **Validation tools**: Always verify file existence for broken links

### Fixed

- Regex escape warnings in PRD parser and CLAUDE.md tools
- Silent catch blocks now include error logging
- N+1 query issues in doc indexer
- Injection-like patterns removed from stop hook prompt
- Test imports converted from `require()` to ESM

## [0.2.1] - 2026-02-03

### Fixed

- **doc-indexer**: Silent error swallowing now logs warnings with file path and error message
- **validation-tools**: Broken link false positives fixed with `existsSync` fallback for files not in index
- **claude-md-tools**: Case-insensitive detection for "rule", "convention", "standard" keywords in audit
- **stack-tools**: Config integration - pre-configured stack from `.mags.yaml` takes priority over filesystem detection
- **placeholder-detection**: Context-aware detection eliminates false positives (structural vs contextual mentions)

### Added

- **stack-detector**: Fallback chain for pre-code projects (FileSystem → Config → CLAUDE.md → tech-stack.md)
- **doc-indexer**: `reindex()` method with change detection (added/removed/updated tracking)
- **mags_reindex**: New MCP tool to refresh document index dynamically
- **module-discoverer**: Config-based module override support via `.mags.yaml`
- 60+ new tests covering fallback chain, placeholder detection, reindex, and module override

## [0.2.0] - 2026-02-02

### Added

- Deep cross-document validation via `mags_validate_docs({ deep: true })`
  - Version conflict detection across documents and against package.json/pyproject.toml/go.mod
  - Memory-document contradiction detection (e.g., memory says "JWT" but doc says "session-based")
  - Frontmatter schema enforcement per document type (ADR-specific required fields)
  - ADR structure validation (required sections: Status, Context, Decision, Consequences — EN/TR)
  - Module completeness checks (PRD, data-model, api-design coverage)
- `ConsistencyChecker` service for all deep validation logic
- `StackDetector.extractVersions()` — extracts actual versions from package.json, pyproject.toml, go.mod
- `FRONTMATTER_SCHEMAS` configuration for document type-specific required fields
- `TechTerm` and `FrontmatterSchema` type definitions
- `DetectedStack.versions` field for version-aware stack detection
- Regression guard suite with version SSOT, constants, template, skill, plugin, and bundle guards
- Cross-platform Node.js launcher (`start.js`)

### Fixed

- Stack detection uses shared `StackDetector` instance for validation
- Skills reference: `mags_init_progress` in mags-init allowed-tools
- Template frontmatter standardization and root/en locale sync
- Version SSOT: all 4 sources (root pkg, server pkg, plugin.json, marketplace.json) in sync

## [0.1.0] - 2026-02-02

### Added

- MCP server with 24 tools for document, memory, progress, session, and context management
- Document indexing with Fuse.js full-text search
- Semantic memory store with pluggable embedding providers (local TF-IDF + OpenAI)
- Session persistence with auto-save/load hooks
- Module-based progress tracking with dependency resolution
- Document validation (frontmatter, cross-references, empty sections, quality scoring)
- CLAUDE.md generation and auditing from project docs
- Changelog generation from conventional commits
- Module scaffolding with Handlebars templates
- Stack detection — automatically detects languages, frameworks, databases, API style, and package manager
- Module discovery — scans project structure to find modules with confidence scores
- Architecture support — 6 architecture types with tailored templates and guidance
- Legacy/brownfield support with tech debt tracking and migration plans
- i18n template fallback chain (locale → en → root) for multi-language templates
- Custom template packs with `pack.yaml` manifests
- Stack-aware CLAUDE.md generation
- Circular and orphan dependency detection with warnings on initialize
- Re-initialization guard with `force` param in `mags_init_progress`
- Dependency warning on `mags_update_progress` for unmet dependencies
- Overwrite guard for `mags_create_doc` — prevents accidental file overwrites
- Backup mechanism (`.bak`) for `mags_update_doc` writes
- Code fence awareness in document validation — no false positives on fenced headings
- Input validation with `min(1)` on `mags_remember` key/value fields
- 7 slash commands: /mags-init, /mags-status, /mags-docs, /mags-session, /mags-changelog, /mags-setup, /mags-legacy
- 7 auto-activating skills: doc-management, memory-guidance, claude-md-management, testing-strategy, security-review, infrastructure, api-lifecycle
- 2 specialized agents: doc-sync-validator, setup-recommender
- 3 event hooks: SessionStart, PreCompact, Stop
- 15 document templates: vision, discovery, prd, tech-stack, data-model, api-design, project-structure, mvp-scope, adr, module, guide, current-architecture, migration-plan, tech-debt, target-architecture
- Stack-specific templates for Go, Python, TypeScript, Rust, Java
