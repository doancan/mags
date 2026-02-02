---
title: "{{project_name}}: Project Structure (Go)"
version: "1.0"
status: draft
author: "{{author}}"
last_updated: "{{date}}"
tags: [architecture, structure, go]
---

# Project Structure

## Standard Go Layout

```
{{project_name}}/
├── cmd/
│   └── server/
│       └── main.go                 # Application entry point
├── internal/                       # Private application code
│   ├── config/
│   │   └── config.go              # Configuration loading
│   ├── server/
│   │   ├── server.go              # HTTP server setup
│   │   ├── routes.go              # Route registration
│   │   └── middleware.go          # HTTP middleware
│   ├── handler/
│   │   ├── handler.go             # Handler interface / base
│   │   ├── user_handler.go        # User HTTP handlers
│   │   └── health_handler.go      # Health check endpoint
│   ├── service/
│   │   ├── user_service.go        # Business logic
│   │   └── auth_service.go
│   ├── repository/
│   │   ├── repository.go          # Repository interfaces
│   │   ├── user_repo.go           # User data access
│   │   └── postgres/
│   │       └── user_repo.go       # PostgreSQL implementation
│   ├── model/
│   │   ├── user.go                # Domain models
│   │   └── errors.go              # Domain errors
│   └── dto/
│       ├── request.go             # Request DTOs
│       └── response.go            # Response DTOs
├── pkg/                            # Public reusable packages
│   ├── logger/
│   │   └── logger.go
│   ├── httputil/
│   │   └── response.go
│   └── validator/
│       └── validator.go
├── api/                            # API specifications
│   └── openapi.yaml
├── configs/                        # Configuration files
│   ├── config.yaml
│   └── config.example.yaml
├── migrations/                     # Database migrations
│   ├── 001_create_users.up.sql
│   └── 001_create_users.down.sql
├── scripts/                        # Build & utility scripts
│   ├── migrate.sh
│   └── seed.sh
├── deployments/                    # Deployment configurations
│   ├── Dockerfile
│   └── docker-compose.yml
├── go.mod
├── go.sum
├── Makefile
└── README.md
```

## Directory Purposes

### `cmd/`

Application entry points. Each subdirectory is a separate binary:

```go
// cmd/server/main.go
package main

func main() {
    cfg := config.Load()
    srv := server.New(cfg)
    srv.Run()
}
```

### `internal/`

Private application code that cannot be imported by other projects. This is enforced by the Go compiler.

| Package | Responsibility |
|---------|---------------|
| `config` | Load and validate configuration |
| `server` | HTTP server, routes, middleware |
| `handler` | HTTP request handling, input validation |
| `service` | Business logic, orchestration |
| `repository` | Data access interfaces and implementations |
| `model` | Domain entities and value objects |
| `dto` | Data transfer objects for API boundary |

### `pkg/`

Public packages that can be imported by other projects. Keep minimal; only truly reusable code belongs here.

### `api/`

API specification files (OpenAPI, Protocol Buffers, GraphQL schemas).

### `configs/`

Configuration file templates and defaults. Never commit secrets.

### `migrations/`

Database migration files, numbered sequentially.

### `scripts/`

Shell scripts for development, CI/CD, and operations.

## Package Dependencies

```
cmd/server
  └── internal/server
        ├── internal/handler
        │     ├── internal/service
        │     │     └── internal/repository
        │     │           └── internal/model
        │     └── internal/dto
        └── internal/config
```

### Dependency Rules

| Package | May Import | Must Not Import |
|---------|-----------|----------------|
| `handler` | `service`, `dto`, `model` | `repository` directly |
| `service` | `repository`, `model` | `handler`, `dto` |
| `repository` | `model` | `service`, `handler` |
| `model` | stdlib only | Any internal package |
| `dto` | `model` (for conversion) | `service`, `repository` |

## File Naming Conventions

| Convention | Example |
|-----------|---------|
| Lowercase, underscores | `user_handler.go` |
| Test files | `user_handler_test.go` |
| Interface files | `repository.go` (defines interface) |
| Implementation files | `postgres/user_repo.go` |
| Constructor pattern | `func NewUserService(...) *UserService` |

## Multi-Binary Project

```
cmd/
├── server/
│   └── main.go          # API server
├── worker/
│   └── main.go          # Background worker
├── migrate/
│   └── main.go          # Migration CLI
└── seed/
    └── main.go          # Database seeding
```
