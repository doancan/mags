---
title: "{{project_name}}: Function Inventory"
version: "0.1.0"
status: draft
author: "{{author}}"
last_updated: "{{date}}"
tags: [architecture, serverless, functions, lambda]
---

# Function Inventory

## Overview

This document catalogs all serverless functions in **{{project_name}}**, including runtime configuration, triggers, permissions, and optimization strategies.

## Functions

| Name | Runtime | Trigger | Memory (MB) | Timeout (s) | Description |
|------|---------|---------|-------------|-------------|-------------|
| | | | | | |

> Keep functions small and single-purpose. If a function exceeds the timeout or memory limit, consider splitting it.

### Function Details

#### `function-name`

- **Handler**: `src/handlers/functionName.handler`
- **Runtime**: <!-- e.g., Node.js 20.x, Python 3.12 -->
- **Trigger**: <!-- e.g., API Gateway, S3, SQS, Schedule -->
- **Memory**: <!-- MB -->
- **Timeout**: <!-- seconds -->
- **Concurrency Limit**: <!-- reserved concurrency, if set -->
- **Description**: <!-- what this function does -->

> Copy this block for each function.

## Cold Start Optimization

### Strategies

| Strategy | Applicable To | Impact | Implemented |
|----------|--------------|--------|-------------|
| Provisioned Concurrency | Latency-sensitive functions | Eliminates cold starts | Yes / No |
| Smaller Bundle Size | All functions | Faster initialization | Yes / No |
| Lazy Loading | Functions with many dependencies | Faster initial response | Yes / No |
| Runtime Selection | All functions | Varies by runtime | Yes / No |
| Keep-Warm Pings | Low-traffic functions | Reduces cold start frequency | Yes / No |

### Bundle Size Targets

| Function | Current Size | Target Size | Notes |
|----------|-------------|-------------|-------|
| | | | |

> Monitor bundle sizes in CI. Alert when a function exceeds the target.

## IAM Permissions

### Per-Function Permissions

| Function | Resource | Actions | Condition |
|----------|----------|---------|-----------|
| | | | |

> Follow the principle of least privilege. Each function should only have the permissions it needs. Never use wildcard (`*`) resource ARNs in production.

### Shared Roles

| Role | Purpose | Functions | Key Permissions |
|------|---------|----------|----------------|
| | | | |

## Environment Variables

### Global Variables

| Variable | Description | Sensitive | Source |
|----------|-------------|-----------|--------|
| `STAGE` | Deployment stage (dev, staging, prod) | No | Build config |
| `LOG_LEVEL` | Logging verbosity | No | Build config |
| | | | |

### Per-Function Variables

| Function | Variable | Description | Sensitive | Source |
|----------|----------|-------------|-----------|--------|
| | | | | |

> Sensitive variables must be stored in a secrets manager (e.g., AWS Secrets Manager, SSM Parameter Store) and referenced at runtime. Never hardcode secrets.
