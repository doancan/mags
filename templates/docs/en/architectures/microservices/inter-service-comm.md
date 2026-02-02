---
title: "{{project_name}}: Inter-Service Communication"
version: "0.1.0"
status: draft
author: "{{author}}"
last_updated: "{{date}}"
tags: [architecture, microservices, communication, messaging]
---

# Inter-Service Communication

## Overview

This document defines the communication patterns, protocols, and resilience strategies used for inter-service communication in **{{project_name}}**.

## Synchronous Communication

### Protocol Selection

- **Primary Protocol**: <!-- REST / gRPC / GraphQL -->
- **Serialization Format**: <!-- JSON / Protobuf / Avro -->
- **API Contract Management**: <!-- OpenAPI spec, proto files location -->

### REST Conventions

- **Base Path Pattern**: `http://{service-name}:{port}/api/v{version}`
- **Content Type**: `application/json`
- **Error Response Format**:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {}
  }
}
```

### gRPC Conventions

- **Proto File Location**: <!-- e.g., /proto, shared repo -->
- **Reflection Enabled**: Yes / No
- **Deadline Propagation**: <!-- How deadlines flow across calls -->

### Retry Policies

| Service Pair | Max Retries | Backoff Strategy | Retry On | Non-Retryable Errors |
|-------------|-------------|------------------|----------|---------------------|
| | | | | |

> Use exponential backoff with jitter as the default retry strategy. Never retry non-idempotent operations without explicit safeguards.

### Timeout Configuration

| Service Pair | Connection Timeout | Request Timeout | Idle Timeout | Notes |
|-------------|-------------------|----------------|-------------|-------|
| Default | | | | |

## Asynchronous Communication

### Message Broker

- **Broker Technology**: <!-- e.g., RabbitMQ, Kafka, AWS SQS/SNS, NATS -->
- **Connection String**: <!-- Reference to secrets management -->
- **Cluster Configuration**: <!-- Replicas, partitions -->

### Event Schema

- **Schema Registry**: <!-- URL or location -->
- **Schema Format**: <!-- JSON Schema, Avro, Protobuf -->
- **Naming Convention**: `{domain}.{entity}.{action}` <!-- e.g., order.payment.completed -->

#### Event Envelope

```json
{
  "event_id": "uuid",
  "event_type": "domain.entity.action",
  "source": "service-name",
  "timestamp": "ISO8601",
  "version": "1.0",
  "data": {}
}
```

### Topics / Queues

| Topic/Queue | Publisher | Consumer(s) | Schema | Retention |
|------------|----------|-------------|--------|-----------|
| | | | | |

### Dead Letter Queues

| Source Queue | DLQ Name | Max Retries | Alert Threshold | Reprocessing Strategy |
|-------------|----------|-------------|----------------|----------------------|
| | | | | |

> Every queue must have a corresponding DLQ. Set up alerts when DLQ depth exceeds thresholds.

## Service Discovery

- **Mechanism**: <!-- e.g., DNS-based, Consul, Kubernetes Services, Eureka -->
- **Registration**: <!-- Automatic / Manual -->
- **TTL / Refresh Interval**: <!-- How often registrations refresh -->
- **Failover Behavior**: <!-- What happens when a service instance is unreachable -->

### Service Registry

| Service Name | Discovery Name | Port | Protocol | Instances |
|-------------|---------------|------|----------|-----------|
| | | | | |

## Circuit Breaker Patterns

### Configuration

| Service Pair | Library | Failure Threshold | Open Duration | Half-Open Requests | Fallback |
|-------------|---------|-------------------|---------------|-------------------|----------|
| | | | | | |

### States

- **Closed**: Requests flow normally. Failures are counted.
- **Open**: All requests are rejected immediately. Fallback is invoked.
- **Half-Open**: A limited number of requests are allowed through to test recovery.

### Monitoring

- Track circuit state transitions and alert on circuits that remain open beyond expected recovery times.
- Dashboard: <!-- Link to monitoring dashboard -->
