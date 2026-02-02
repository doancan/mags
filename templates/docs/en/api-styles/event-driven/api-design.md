---
title: "{{project_name}}: API Design (Event-Driven)"
version: "1.0"
status: draft
author: "{{author}}"
last_updated: "{{date}}"
tags: [architecture, api, events, async]
---

# API Design (Event-Driven)

## Overview

| Component | Choice | Notes |
|-----------|--------|-------|
| Pattern | Event-Driven Architecture | Asynchronous, loosely coupled |
| Broker | {{broker}} | Options: Kafka, RabbitMQ, NATS, Pulsar, SQS/SNS |
| Schema Format | {{schema_format}} | Options: CloudEvents, Avro, JSON Schema, Protobuf |
| Schema Registry | {{registry}} | Options: Confluent, Apicurio, AWS Glue |

## Event Catalog

| Event Name | Producer | Consumer(s) | Schema | Topic/Queue | Priority |
|------------|----------|-------------|--------|-------------|----------|
| `{{resource_name}}.created` | {{service_a}} | {{service_b}}, {{service_c}} | `{{resource_name}}Created` | `{{domain}}.{{resource_name}}.events` | High |
| `{{resource_name}}.updated` | {{service_a}} | {{service_b}} | `{{resource_name}}Updated` | `{{domain}}.{{resource_name}}.events` | Medium |
| `{{resource_name}}.deleted` | {{service_a}} | {{service_b}}, {{service_c}} | `{{resource_name}}Deleted` | `{{domain}}.{{resource_name}}.events` | Medium |
| `{{resource_name}}.status_changed` | {{service_a}} | {{service_d}} | `{{resource_name}}StatusChanged` | `{{domain}}.{{resource_name}}.events` | High |

## Message Schemas (CloudEvents Format)

### Event Envelope

```json
{
  "specversion": "1.0",
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "type": "com.{{org}}.{{domain}}.{{resource_name}}.created.v1",
  "source": "/services/{{service_a}}",
  "time": "2024-01-15T12:00:00Z",
  "datacontenttype": "application/json",
  "subject": "{{resource_name}}/12345",
  "data": {
    "id": "12345",
    "name": "Example",
    "status": "active",
    "created_at": "2024-01-15T12:00:00Z"
  }
}
```

### Event Type Naming Convention

```
com.{{org}}.{{domain}}.{{resource}}.{{action}}.v{{version}}
```

| Segment | Description | Example |
|---------|-------------|---------|
| `com.{{org}}` | Organization reverse domain | `com.acme` |
| `{{domain}}` | Bounded context | `orders` |
| `{{resource}}` | Entity type | `order` |
| `{{action}}` | What happened | `created`, `updated`, `cancelled` |
| `v{{version}}` | Schema version | `v1` |

### Event Schemas

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "{{resource_name}}Created",
  "type": "object",
  "required": ["id", "name", "status", "created_at"],
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "name": { "type": "string", "minLength": 1 },
    "status": { "type": "string", "enum": ["active", "inactive"] },
    "created_at": { "type": "string", "format": "date-time" }
  }
}
```

## Broker Configuration

### Topic/Queue Design

| Topic | Partitions | Retention | Consumers |
|-------|-----------|-----------|-----------|
| `{{domain}}.{{resource_name}}.events` | {{partitions}} | {{retention}} | {{consumer_groups}} |
| `{{domain}}.{{resource_name}}.commands` | {{partitions}} | {{retention}} | {{consumer_groups}} |
| `{{domain}}.notifications` | {{partitions}} | {{retention}} | {{consumer_groups}} |
| `{{domain}}.dlq` | 1 | 30 days | Ops team |

### Partitioning Strategy

| Strategy | Partition Key | When to Use |
|----------|--------------|-------------|
| By entity ID | `{{resource_name}}.id` | Ordering per entity required |
| By tenant | `tenant_id` | Multi-tenant isolation |
| Round robin | None | Maximum throughput, no ordering needs |

## Consumer Groups

| Group ID | Subscribes To | Instances | Purpose |
|----------|--------------|-----------|---------|
| `{{service_b}}-group` | `{{domain}}.{{resource_name}}.events` | 3 | Sync data to read model |
| `{{service_c}}-group` | `{{domain}}.{{resource_name}}.events` | 2 | Send notifications |
| `{{service_d}}-group` | `{{domain}}.{{resource_name}}.events` | 1 | Analytics pipeline |

## Dead Letter Queues (DLQ)

### DLQ Flow

```
Main Topic → Consumer → [Processing Failed] → Retry Topic (1-3 retries) → DLQ
```

### DLQ Configuration

| Setting | Value | Notes |
|---------|-------|-------|
| Max retries | 3 | Before moving to DLQ |
| Retry delay | Exponential (1s, 5s, 30s) | Backoff between retries |
| DLQ retention | 30 days | Time to investigate |
| Alert threshold | 10 messages / hour | Trigger on-call alert |

### DLQ Message Format

```json
{
  "original_event": { "...": "original CloudEvent" },
  "error": {
    "message": "Failed to process event",
    "type": "ValidationError",
    "stack_trace": "...",
    "attempt": 3,
    "first_failure_at": "2024-01-15T12:00:00Z",
    "last_failure_at": "2024-01-15T12:01:30Z"
  }
}
```

## Idempotency

### Strategy

| Approach | Implementation | Trade-off |
|----------|---------------|-----------|
| Event ID deduplication | Store processed event IDs | Storage cost for ID store |
| Idempotency key | Client-provided unique key | Client must generate keys |
| Natural idempotency | Design operations to be inherently idempotent | Limits operation design |
| Conditional writes | Optimistic concurrency (version field) | Retry on conflict |

### Implementation Pattern

```
1. Receive event
2. Check if event.id exists in processed_events table
3. If exists → skip (already processed)
4. If not → process within transaction:
   a. Perform business logic
   b. Insert event.id into processed_events
   c. Commit transaction
```

## Event Versioning

### Compatibility Rules

| Change Type | Compatible? | Strategy |
|-------------|------------|----------|
| Add optional field | Yes | Consumer ignores unknown fields |
| Remove optional field | Yes | Consumer handles missing fields |
| Rename field | No | Use field alias during migration |
| Change field type | No | New schema version required |
| Add required field | No | New schema version required |
| Remove required field | No | New schema version required |

### Versioning Strategy

```
# Option A: Version in event type
com.acme.orders.order.created.v1
com.acme.orders.order.created.v2

# Option B: Version in topic
orders.events.v1
orders.events.v2

# Option C: Schema registry with compatibility checks
Schema ID embedded in message header
```

### Migration Pattern

```
Phase 1: Producer publishes v1 + v2 (dual-write)
Phase 2: Consumers migrate to v2
Phase 3: Producer stops publishing v1
Phase 4: Clean up v1 schemas
```

## Saga Patterns

### Choreography Saga

```
Order Service              Payment Service           Inventory Service
     │                           │                         │
     ├── OrderCreated ──────────>│                         │
     │                           ├── PaymentProcessed ────>│
     │                           │                         ├── InventoryReserved
     │<────────────────────────────────────────────────────┤
     ├── OrderConfirmed          │                         │
```

### Orchestration Saga

```
Saga Orchestrator
     │
     ├── CreateOrder ──────> Order Service
     │<── OrderCreated ─────┘
     │
     ├── ProcessPayment ───> Payment Service
     │<── PaymentProcessed ─┘
     │
     ├── ReserveInventory ─> Inventory Service
     │<── InventoryReserved ┘
     │
     └── ConfirmOrder ──────> Order Service
```

### Saga Compensation

| Step | Action | Compensation |
|------|--------|-------------|
| 1 | Create Order | Cancel Order |
| 2 | Process Payment | Refund Payment |
| 3 | Reserve Inventory | Release Inventory |
| 4 | Confirm Order | (final step, no compensation) |

## Monitoring

| Metric | Description | Alert Threshold |
|--------|-------------|----------------|
| Consumer lag | Messages behind head | > 1000 |
| Processing rate | Messages/second | < expected baseline |
| Error rate | Failed messages/total | > 1% |
| DLQ depth | Messages in DLQ | > 0 |
| End-to-end latency | Produce to consume time | > SLA threshold |
