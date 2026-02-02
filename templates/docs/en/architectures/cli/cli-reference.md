---
title: "{{project_name}}: CLI Reference"
version: "0.1.0"
status: DRAFT
author: "{{author}}"
last_updated: "{{date}}"
tags: [architecture, cli, reference, commands]
---

# CLI Reference

## Overview

Complete reference for all **{{project_name}}** CLI commands. For design principles and conventions, see the CLI Design document.

---

## Command: `init`

### Synopsis

```
{{project_name}} init [directory] [flags]
```

### Description

Initialize a new {{project_name}} project in the specified directory. If no directory is provided, the current directory is used.

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `directory` | No | Target directory (default: `.`) |

### Options

| Flag | Short | Type | Default | Description |
|------|-------|------|---------|-------------|
| `--template` | `-t` | string | `default` | Project template to use |
| `--force` | `-f` | bool | `false` | Overwrite existing files |

### Examples

```bash
# Initialize in current directory
{{project_name}} init

# Initialize in a new directory with a template
{{project_name}} init my-project --template minimal

# Force re-initialization
{{project_name}} init --force
```

---

## Command: `config`

### Synopsis

```
{{project_name}} config <subcommand> [flags]
```

### Description

Manage {{project_name}} configuration values.

### Subcommands

#### `config get`

```
{{project_name}} config get <key>
```

Retrieve the value of a configuration key.

#### `config set`

```
{{project_name}} config set <key> <value>
```

Set a configuration key to the specified value.

#### `config list`

```
{{project_name}} config list [flags]
```

List all configuration values.

### Options

| Flag | Short | Type | Default | Description |
|------|-------|------|---------|-------------|
| `--global` | `-g` | bool | `false` | Use global configuration |

### Examples

```bash
# Get a config value
{{project_name}} config get defaults.output

# Set a config value
{{project_name}} config set defaults.output json

# List all config values
{{project_name}} config list
```

---

## Command: `<!-- command_name -->`

> Copy this section as a template for each new command.

### Synopsis

```
{{project_name}} <command> [arguments] [flags]
```

### Description

<!-- What this command does -->

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| | | |

### Options

| Flag | Short | Type | Default | Description |
|------|-------|------|---------|-------------|
| | | | | |

### Examples

```bash
# Example 1: Basic usage
{{project_name}} <command> <arg>

# Example 2: With flags
{{project_name}} <command> <arg> --flag value
```

---

## Command: `version`

### Synopsis

```
{{project_name}} version [flags]
```

### Description

Print the version information for {{project_name}}.

### Options

| Flag | Short | Type | Default | Description |
|------|-------|------|---------|-------------|
| `--short` | `-s` | bool | `false` | Print only the version number |

### Examples

```bash
# Full version info
{{project_name}} version

# Short version
{{project_name}} version --short
```

---

## Command: `help`

### Synopsis

```
{{project_name}} help [command]
```

### Description

Display help information for {{project_name}} or a specific command.

### Examples

```bash
# General help
{{project_name}} help

# Help for a specific command
{{project_name}} help init
```
