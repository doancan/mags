---
title: "{{project_name}}: API Gateway Design"
version: "0.1.0"
status: DRAFT
author: "{{author}}"
last_updated: "{{date}}"
tags: [architecture, microservices, api-gateway, routing]
---

# API Gateway Design

## Overview

This document describes the API gateway architecture for **{{project_name}}**, including routing rules, cross-cutting concerns, and load balancing strategies.

## Gateway Configuration

- **Gateway Technology**: <!-- e.g., Kong, AWS API Gateway, Nginx, Envoy -->
- **Base URL**: `https://api.example.com`
- **API Version Prefix**: `/v1`
- **TLS Termination**: Yes / No
- **CORS Policy**: <!-- Describe allowed origins, methods, headers -->

## Routing Rules

| Path | Service | Method(s) | Auth Required | Rate Limit | Notes |
|------|---------|-----------|---------------|------------|-------|
| | | | | | |

> Define all public-facing routes. Internal service-to-service routes should be documented in the service catalog.

## Cross-Cutting Concerns

### Authentication & Authorization

- **Mechanism**: <!-- e.g., JWT, OAuth2, API Key -->
- **Token Validation**: <!-- Where and how tokens are validated -->
- **Authorization Strategy**: <!-- e.g., RBAC, ABAC, scope-based -->

### Logging

- **Request Logging**: <!-- What is logged per request: method, path, status, latency -->
- **Correlation ID**: <!-- How distributed tracing IDs are propagated -->
- **Log Format**: <!-- e.g., JSON structured logging -->
- **Sensitive Data**: <!-- Fields to redact from logs -->

### Rate Limiting

| Tier | Requests/Minute | Burst Limit | Scope | Notes |
|------|-----------------|-------------|-------|-------|
| Default | | | | |
| Authenticated | | | | |
| Premium | | | | |

### Circuit Breaking

- **Failure Threshold**: <!-- Number of failures before circuit opens -->
- **Recovery Timeout**: <!-- Time before half-open state -->
- **Fallback Behavior**: <!-- What happens when circuit is open -->
- **Monitored Endpoints**: <!-- Which downstream services have circuit breakers -->

## Load Balancing Strategy

- **Algorithm**: <!-- e.g., round-robin, least-connections, weighted -->
- **Health Check Path**: <!-- e.g., /health -->
- **Health Check Interval**: <!-- e.g., 10s -->
- **Unhealthy Threshold**: <!-- Number of failed checks before removal -->
- **Session Affinity**: Yes / No
- **Sticky Sessions**: <!-- If applicable, describe mechanism -->
