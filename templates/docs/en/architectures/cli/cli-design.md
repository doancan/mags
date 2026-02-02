---
title: "{{project_name}}: CLI Design"
version: "0.1.0"
status: DRAFT
author: "{{author}}"
last_updated: "{{date}}"
tags: [architecture, cli, design, ux]
---

# CLI Design

## Overview

This document defines the design principles, command structure, and user experience conventions for the **{{project_name}}** command-line interface.

## Command Structure

### Verb-Noun Pattern

Commands follow the `<tool> <verb> <noun> [flags]` pattern:

```
{{project_name}} create resource --name my-resource
{{project_name}} list resources --output json
{{project_name}} delete resource my-resource --force
```

### Command Hierarchy

```
{{project_name}}
  |-- init              # Initialize a new project
  |-- config            # Manage configuration
  |   |-- get           # Get a config value
  |   |-- set           # Set a config value
  |   |-- list          # List all config values
  |-- <verb> <noun>     # Domain-specific commands
  |-- version           # Print version information
  |-- help              # Show help
```

## Global Flags

| Flag | Short | Type | Default | Description |
|------|-------|------|---------|-------------|
| `--help` | `-h` | bool | `false` | Show help for the command |
| `--version` | `-v` | bool | `false` | Print version information |
| `--verbose` | | bool | `false` | Enable verbose output |
| `--quiet` | `-q` | bool | `false` | Suppress non-essential output |
| `--output` | `-o` | string | `table` | Output format: table, json, yaml |
| `--config` | `-c` | string | `~/.config/{{project_name}}/config.yaml` | Path to config file |
| `--no-color` | | bool | `false` | Disable colored output |

## Configuration File Format

### Location

- Default: `~/.config/{{project_name}}/config.yaml`
- Override: `--config` flag or `{{project_name}}_CONFIG` environment variable

### Structure

```yaml
# {{project_name}} configuration
version: 1

defaults:
  output: table
  verbose: false

# Add domain-specific configuration sections
```

### Precedence Order

1. Command-line flags (highest)
2. Environment variables
3. Project-level config (`.{{project_name}}.yaml`)
4. User-level config (`~/.config/{{project_name}}/config.yaml`)
5. Built-in defaults (lowest)

## Output Formats

### Table (Default)

```
NAME          STATUS    CREATED
my-resource   active    2024-01-15
other-item    pending   2024-01-16
```

### JSON

```json
[
  {
    "name": "my-resource",
    "status": "active",
    "created": "2024-01-15"
  }
]
```

### YAML

```yaml
- name: my-resource
  status: active
  created: "2024-01-15"
```

> All list commands must support all three output formats. Single-item commands should default to YAML for readability.

## Exit Codes

| Code | Meaning | Description |
|------|---------|-------------|
| `0` | Success | Command completed successfully |
| `1` | General Error | An unspecified error occurred |
| `2` | Usage Error | Invalid command syntax or missing arguments |
| `3` | Configuration Error | Invalid or missing configuration |
| `4` | Authentication Error | Authentication failed or credentials expired |
| `5` | Not Found | Requested resource was not found |
| `126` | Permission Denied | Insufficient permissions |
| `130` | Interrupted | Command was interrupted by user (Ctrl+C) |

## Interactive vs Non-Interactive Modes

### Interactive Mode

When the terminal is a TTY (interactive session):

- Display prompts for missing required arguments
- Show progress spinners and status bars
- Use colored output
- Prompt for confirmation on destructive actions

### Non-Interactive Mode

When piped or running in CI/CD (non-TTY):

- Fail immediately if required arguments are missing
- Print plain text without ANSI codes
- Skip confirmation prompts (require `--force` for destructive actions)
- Output structured data (JSON) suitable for parsing

### Detection

```
if (isTTY) {
  // interactive mode
} else {
  // non-interactive mode
}
```

> Always respect `--no-color` and `--quiet` flags regardless of TTY detection. Use `--force` to skip confirmations in scripts.
