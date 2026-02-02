# Changelog

All notable changes to MAGS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
