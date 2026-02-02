---
title: "{{project_name}}: API Design (gRPC)"
version: "1.0"
status: draft
author: "{{author}}"
last_updated: "{{date}}"
tags: [architecture, api, grpc]
---

# API Design (gRPC)

## Overview

| Component | Choice | Notes |
|-----------|--------|-------|
| Protocol | gRPC over HTTP/2 | Binary protocol, multiplexed streams |
| IDL | Protocol Buffers (proto3) | Schema definition |
| Code Generation | protoc + language plugins | Client/server stubs |
| Gateway | grpc-gateway (optional) | REST-to-gRPC transcoding |

## Proto File Organization

```
proto/
├── buf.yaml                         # Buf configuration
├── buf.gen.yaml                     # Code generation config
├── {{org}}/
│   └── {{service_name}}/
│       └── v1/
│           ├── {{service_name}}.proto       # Service definitions
│           ├── messages.proto               # Request/response messages
│           ├── resources.proto              # Resource message types
│           └── enums.proto                  # Shared enums
```

## Package Structure

```protobuf
syntax = "proto3";

package {{org}}.{{service_name}}.v1;

option go_package = "github.com/{{org}}/{{project_name}}/gen/{{service_name}}/v1";
option java_package = "com.{{org}}.{{service_name}}.v1";
option java_multiple_files = true;
```

## Service Definitions

```protobuf
service {{resource_name}}Service {
  // Unary RPCs
  rpc Get{{resource_name}}(Get{{resource_name}}Request) returns ({{resource_name}});
  rpc List{{resource_name}}s(List{{resource_name}}sRequest) returns (List{{resource_name}}sResponse);
  rpc Create{{resource_name}}(Create{{resource_name}}Request) returns ({{resource_name}});
  rpc Update{{resource_name}}(Update{{resource_name}}Request) returns ({{resource_name}});
  rpc Delete{{resource_name}}(Delete{{resource_name}}Request) returns (google.protobuf.Empty);

  // Streaming RPCs
  rpc Watch{{resource_name}}s(Watch{{resource_name}}sRequest) returns (stream {{resource_name}}Event);
  rpc BatchCreate{{resource_name}}s(stream Create{{resource_name}}Request) returns (BatchCreate{{resource_name}}sResponse);
  rpc StreamProcess(stream ProcessRequest) returns (stream ProcessResponse);
}
```

## Message Types

### Resource Messages

```protobuf
import "google/protobuf/timestamp.proto";

message {{resource_name}} {
  string id = 1;
  string name = 2;
  string description = 3;
  {{resource_name}}Status status = 4;
  google.protobuf.Timestamp created_at = 5;
  google.protobuf.Timestamp updated_at = 6;
}

enum {{resource_name}}Status {
  {{RESOURCE_NAME}}_STATUS_UNSPECIFIED = 0;
  {{RESOURCE_NAME}}_STATUS_ACTIVE = 1;
  {{RESOURCE_NAME}}_STATUS_INACTIVE = 2;
  {{RESOURCE_NAME}}_STATUS_ARCHIVED = 3;
}
```

### Request/Response Messages

```protobuf
import "google/protobuf/field_mask.proto";

message Get{{resource_name}}Request {
  string id = 1;
}

message List{{resource_name}}sRequest {
  int32 page_size = 1;
  string page_token = 2;
  string filter = 3;       // AIP-160 filtering
  string order_by = 4;     // AIP-132 ordering
}

message List{{resource_name}}sResponse {
  repeated {{resource_name}} {{resource_name_lower}}s = 1;
  string next_page_token = 2;
  int32 total_size = 3;
}

message Create{{resource_name}}Request {
  {{resource_name}} {{resource_name_lower}} = 1;
}

message Update{{resource_name}}Request {
  {{resource_name}} {{resource_name_lower}} = 1;
  google.protobuf.FieldMask update_mask = 2;
}

message Delete{{resource_name}}Request {
  string id = 1;
}
```

## Streaming Patterns

### Unary (Request-Response)

```
Client ──Request──> Server
Client <──Response── Server
```

| Use Case | Example |
|----------|---------|
| Simple CRUD | Get, Create, Update, Delete |
| Short-lived operations | Lookup, validation |

### Server Streaming

```
Client ──Request──> Server
Client <──Response── Server
Client <──Response── Server
Client <──Response── Server
```

| Use Case | Example |
|----------|---------|
| Real-time updates | Watch resources, event feeds |
| Large result sets | Streaming query results |
| Progress updates | Long-running operation status |

### Client Streaming

```
Client ──Request──> Server
Client ──Request──> Server
Client ──Request──> Server
Client <──Response── Server
```

| Use Case | Example |
|----------|---------|
| Bulk operations | Batch import |
| File upload | Chunked upload |
| Aggregation | Client sends data, server aggregates |

### Bidirectional Streaming

```
Client ──Request──> Server
Client <──Response── Server
Client ──Request──> Server
Client <──Response── Server
```

| Use Case | Example |
|----------|---------|
| Chat | Real-time messaging |
| Interactive processing | Request-response cycles |
| Collaborative editing | Shared state updates |

## Error Codes

| gRPC Code | HTTP | When to Use |
|-----------|------|-------------|
| `OK` | 200 | Success |
| `INVALID_ARGUMENT` | 400 | Bad request data |
| `NOT_FOUND` | 404 | Resource doesn't exist |
| `ALREADY_EXISTS` | 409 | Duplicate resource |
| `PERMISSION_DENIED` | 403 | Insufficient permissions |
| `UNAUTHENTICATED` | 401 | Missing/invalid credentials |
| `RESOURCE_EXHAUSTED` | 429 | Rate limited |
| `FAILED_PRECONDITION` | 400 | System not in required state |
| `ABORTED` | 409 | Concurrency conflict |
| `UNIMPLEMENTED` | 501 | Method not implemented |
| `INTERNAL` | 500 | Unexpected server error |
| `UNAVAILABLE` | 503 | Service temporarily unavailable |
| `DEADLINE_EXCEEDED` | 504 | Timeout |

### Rich Error Details

```protobuf
import "google/rpc/status.proto";
import "google/rpc/error_details.proto";

// Error with details
google.rpc.Status {
  code: 3,  // INVALID_ARGUMENT
  message: "Validation failed",
  details: [
    {
      "@type": "type.googleapis.com/google.rpc.BadRequest",
      field_violations: [
        { field: "name", description: "must not be empty" }
      ]
    }
  ]
}
```

## Interceptors (Middleware)

| Interceptor | Purpose | Type |
|-------------|---------|------|
| Auth | Token validation | Unary + Stream |
| Logging | Request/response logging | Unary + Stream |
| Recovery | Panic recovery | Unary + Stream |
| Retry | Client-side retry | Client |
| Timeout | Deadline enforcement | Client |
| Rate Limit | Throttle requests | Server |
| Validation | Proto validation | Server |
| Metrics | Prometheus/OTel | Both |

### Interceptor Chain Order (Server)

```
Request → Recovery → Logging → Auth → RateLimit → Validation → Handler
```

## Load Balancing

| Strategy | Description | Use Case |
|----------|-------------|----------|
| Round Robin | Rotate through backends | Default, uniform load |
| Pick First | Use first available | Simple, low-scale |
| Weighted | Distribute by weight | Heterogeneous backends |
| Least Connections | Route to least busy | Variable request duration |

### Client-Side vs Server-Side

| Aspect | Client-Side (L4) | Server-Side (L7 / Proxy) |
|--------|------------------|--------------------------|
| Implementation | gRPC built-in | Envoy, Linkerd, Nginx |
| Connection awareness | Per-connection | Per-request |
| Streaming support | Limited | Full |
| Complexity | Lower | Higher |

## Buf Configuration

```yaml
# buf.yaml
version: v2
modules:
  - path: proto
lint:
  use:
    - DEFAULT
breaking:
  use:
    - FILE

# buf.gen.yaml
version: v2
plugins:
  - remote: buf.build/protocolbuffers/go
    out: gen
    opt: paths=source_relative
  - remote: buf.build/grpc/go
    out: gen
    opt: paths=source_relative
```

## Best Practices

| Practice | Description |
|----------|-------------|
| Use `UNSPECIFIED` as enum zero value | Avoid default enum ambiguity |
| Use `FieldMask` for updates | Partial updates, explicit fields |
| Follow AIP guidelines | Google API Improvement Proposals |
| Version via package path | `v1`, `v2` in package name |
| Use `buf` for linting/breaking | Prevent breaking changes |
| Set deadlines on all RPCs | Prevent indefinite waits |
