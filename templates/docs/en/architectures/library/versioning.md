---
title: "{{project_name}}: Versioning Policy"
version: "0.1.0"
status: draft
author: "{{author}}"
last_updated: "{{date}}"
tags: [architecture, library, versioning, semver]
---

# Versioning Policy

## Overview

**{{project_name}}** follows [Semantic Versioning 2.0.0](https://semver.org/) to communicate changes clearly to consumers.

## Semantic Versioning Rules

### Version Format: `MAJOR.MINOR.PATCH`

| Component | Incremented When | Example |
|-----------|-----------------|---------|
| **MAJOR** | Incompatible API changes are introduced | `1.x.x` -> `2.0.0` |
| **MINOR** | New functionality is added in a backward-compatible manner | `1.1.x` -> `1.2.0` |
| **PATCH** | Backward-compatible bug fixes are made | `1.1.1` -> `1.1.2` |

### Pre-Release Versions

- Alpha: `x.y.z-alpha.N` -- Unstable, API may change without notice
- Beta: `x.y.z-beta.N` -- Feature-complete, API unlikely to change
- Release Candidate: `x.y.z-rc.N` -- Production-ready candidate

## Breaking Changes Policy

A breaking change is any modification that requires consumers to update their code. This includes:

- Removing or renaming a public function, class, method, or type
- Changing the type signature of a public API
- Changing default behavior in a way that affects existing consumers
- Removing or renaming configuration options
- Changing error types or error codes

### Process for Introducing Breaking Changes

1. Open an RFC or discussion issue describing the change and rationale
2. Provide a migration path for existing consumers
3. Announce the change at least one minor release in advance via deprecation
4. Include the change in a major version release only

## Deprecation Process

### Timeline

| Phase | Duration | Action |
|-------|----------|--------|
| Announcement | MINOR release N | Mark API as deprecated with `@deprecated` annotation and console warning |
| Grace Period | At least 1 MINOR release | Maintain deprecated API with full functionality |
| Removal | Next MAJOR release | Remove deprecated API |

### Deprecation Notice Format

```typescript
/**
 * @deprecated Since v{version}. Use `newFunction()` instead.
 * Will be removed in v{next_major}.0.0.
 */
function oldFunction(): void {
  console.warn('[{{project_name}}] oldFunction is deprecated. Use newFunction() instead.');
  // existing implementation
}
```

## Migration Guides

### Migrating from vX to vY

<!-- Create a subsection for each major version migration -->

#### Prerequisites

- Ensure you are on the latest vX release before migrating

#### Step-by-Step

1. <!-- Step 1 -->
2. <!-- Step 2 -->
3. <!-- Step 3 -->

#### Breaking Changes Summary

| Before (vX) | After (vY) | Notes |
|-------------|-----------|-------|
| | | |

## Changelog

> Maintain a changelog following the [Keep a Changelog](https://keepachangelog.com/) format.

### [Unreleased]

#### Added
-

#### Changed
-

#### Deprecated
-

#### Removed
-

#### Fixed
-

#### Security
-
