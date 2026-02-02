---
title: "{{project_name}}: Tech Stack (Go)"
version: "1.0"
status: draft
author: "{{author}}"
last_updated: "{{date}}"
tags: [architecture, tech-stack, go]
---

# Tech Stack

## Runtime

| Component | Choice | Version | Notes |
|-----------|--------|---------|-------|
| Language | Go | 1.21+ | Statically typed, compiled |
| Module System | Go Modules | Built-in | `go.mod` / `go.sum` |
| Build Tool | `go build` | Built-in | Cross-compilation support |

## Core Framework

| Component | Choice | Notes |
|-----------|--------|-------|
| HTTP Framework | {{http_framework}} | Options: Gin, Echo, Fiber, stdlib (net/http) |
| Router | {{router}} | Options: chi, gorilla/mux, httprouter, stdlib |
| Configuration | {{config}} | Options: viper, envconfig, koanf |
| Logging | {{logger}} | Options: slog (stdlib), zerolog, zap |

### Framework Comparison

| Feature | stdlib (net/http) | Gin | Echo | Fiber |
|---------|-------------------|-----|------|-------|
| Performance | Good | Excellent | Excellent | Best |
| Middleware | Manual | Built-in | Built-in | Built-in |
| Route groups | Manual | Yes | Yes | Yes |
| Validation | BYO | binding | Built-in | BYO |
| Dependencies | Zero | Minimal | Minimal | fasthttp-based |
| Best for | Simplicity | General API | General API | High throughput |

## Database

| Component | Choice | Notes |
|-----------|--------|-------|
| Primary DB | {{database}} | Options: PostgreSQL, MySQL, SQLite |
| Driver | {{db_driver}} | Options: pgx, lib/pq, go-sql-driver |
| Query Builder | {{query_tool}} | Options: sqlc, sqlx, GORM, Ent |
| Migrations | {{migration_tool}} | Options: goose, golang-migrate, atlas |

### Database Tool Comparison

| Feature | sqlc | sqlx | GORM | Ent |
|---------|------|------|------|-----|
| Approach | Code gen from SQL | SQL + struct scan | ORM | Code gen from schema |
| Type safety | Compile-time | Runtime | Runtime | Compile-time |
| Learning curve | Low | Low | Medium | Medium |
| Performance | Excellent | Excellent | Good | Good |

## Testing

| Component | Choice | Notes |
|-----------|--------|-------|
| Test Runner | `go test` | Built-in |
| Assertions | testify | `assert` and `require` packages |
| Mocking | mockgen / mockery | Interface-based mock generation |
| HTTP Testing | `httptest` | Built-in test server |
| Integration | testcontainers-go | Docker-based test dependencies |
| Benchmarks | `go test -bench` | Built-in benchmarking |

## Code Quality

| Tool | Purpose | Configuration |
|------|---------|---------------|
| golangci-lint | Linting (aggregator) | `.golangci.yml` |
| gofmt / goimports | Formatting | Built-in |
| go vet | Static analysis | Built-in |
| govulncheck | Vulnerability scanning | `golang.org/x/vuln` |
| staticcheck | Advanced static analysis | Included in golangci-lint |

## Key Dependencies

| Package | Purpose | Import Path |
|---------|---------|-------------|
| pgx | PostgreSQL driver | `github.com/jackc/pgx/v5` |
| sqlc | Type-safe SQL | `github.com/sqlc-dev/sqlc` |
| validator | Struct validation | `github.com/go-playground/validator/v10` |
| jwt-go | JWT handling | `github.com/golang-jwt/jwt/v5` |
| uuid | UUID generation | `github.com/google/uuid` |
| otel | OpenTelemetry | `go.opentelemetry.io/otel` |

## Build & Deploy

```makefile
.PHONY: build run test lint

build:
	go build -o bin/server ./cmd/server

run:
	go run ./cmd/server

test:
	go test ./... -race -cover

lint:
	golangci-lint run ./...
```

## Environment Configuration

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | Database connection string | Yes |
| `PORT` | Server port | No (default: 8080) |
| `LOG_LEVEL` | Logging level | No (default: info) |
| `ENV` | Environment name | No (default: development) |

## Decision Log

| Decision | Rationale | Date |
|----------|-----------|------|
| | | |
