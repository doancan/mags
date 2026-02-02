---
title: "{{project_name}}: Tech Stack (Rust)"
version: "1.0"
status: draft
author: "{{author}}"
last_updated: "{{date}}"
tags: [architecture, tech-stack, rust]
---

# Tech Stack

## Summary

> Brief summary of the tech stack and key architectural decisions.

## Runtime

| Component | Choice | Version | Notes |
|-----------|--------|---------|-------|
| Language | Rust | Edition 2021 | Memory-safe, zero-cost abstractions |
| Package Manager | Cargo | Built-in | `Cargo.toml` / `Cargo.lock` |
| Toolchain Manager | rustup | Latest | Manages Rust versions and targets |

## Core Framework

| Component | Choice | Notes |
|-----------|--------|-------|
| Async Runtime | tokio | Multi-threaded async runtime |
| Web Framework | {{web_framework}} | Options: Axum, Actix-Web, Rocket |
| Serialization | serde + serde_json | De/serialization framework |
| Configuration | {{config}} | Options: config-rs, figment, dotenvy |
| Logging | tracing | Structured, async-aware logging |

### Framework Comparison

| Feature | Axum | Actix-Web | Rocket |
|---------|------|-----------|--------|
| Async | tokio-native | actix-rt | tokio (v0.5+) |
| Performance | Excellent | Best | Good |
| Ergonomics | Good (tower-based) | Good | Best (macros) |
| Middleware | tower layers | Built-in | Fairings |
| Ecosystem | Growing fast | Mature | Mature |
| Best for | tower ecosystem | High performance | Rapid development |

## Database

| Component | Choice | Notes |
|-----------|--------|-------|
| Primary DB | {{database}} | Options: PostgreSQL, MySQL, SQLite |
| Driver | {{db_driver}} | Options: sqlx, diesel, sea-orm |
| Migrations | {{migration_tool}} | Options: sqlx-cli, diesel_cli, refinery |
| Connection Pool | {{pool}} | Options: sqlx (built-in), deadpool, bb8 |

### Database Crate Comparison

| Feature | sqlx | diesel | sea-orm |
|---------|------|--------|---------|
| Approach | Compile-time SQL | DSL | ORM |
| Async | Native | Via extensions | Native |
| Type checking | Compile-time | Compile-time | Runtime |
| Migrations | Built-in | Built-in | Built-in |

## Testing

| Component | Choice | Notes |
|-----------|--------|-------|
| Test Runner | `cargo test` | Built-in |
| Assertions | Built-in + pretty_assertions | Enhanced diff output |
| Mocking | mockall | Trait-based mock generation |
| HTTP Testing | reqwest + wiremock | HTTP client + mock server |
| Property Testing | proptest | Property-based testing |
| Benchmarks | criterion | Statistical benchmarking |

## Code Quality

| Tool | Purpose | Configuration |
|------|---------|---------------|
| clippy | Linting | `clippy.toml` or `Cargo.toml` |
| rustfmt | Formatting | `rustfmt.toml` |
| cargo-audit | Dependency vulnerability scanning | CI pipeline |
| cargo-deny | License and advisory checking | `deny.toml` |
| cargo-tarpaulin | Code coverage | CI pipeline |

## Key Crates

| Crate | Purpose | Version |
|-------|---------|---------|
| tokio | Async runtime | 1.x |
| serde | Serialization | 1.x |
| axum / actix-web | Web framework | Latest |
| sqlx | Database access | 0.7+ |
| tracing | Logging / tracing | 0.1.x |
| thiserror | Library error types | 1.x |
| anyhow | Application error handling | 1.x |
| uuid | UUID generation | 1.x |
| chrono | Date/time handling | 0.4.x |
| tower | Middleware framework | 0.4.x |
| jsonwebtoken | JWT handling | 9.x |

## Build Configuration

```toml
# Cargo.toml
[package]
name = "{{project_name}}"
version = "0.1.0"
edition = "2021"
rust-version = "1.75"

[dependencies]
tokio = { version = "1", features = ["full"] }
axum = "0.7"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
sqlx = { version = "0.7", features = ["runtime-tokio-rustls", "postgres"] }
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }

[dev-dependencies]
tokio = { version = "1", features = ["test-util"] }
pretty_assertions = "1"
mockall = "0.12"

[profile.release]
lto = true
strip = true
```

## Environment Configuration

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | Database connection string | Yes |
| `HOST` | Server bind address | No (default: 0.0.0.0) |
| `PORT` | Server port | No (default: 8080) |
| `RUST_LOG` | Logging filter | No (default: info) |

## Decision Log

| Decision | Rationale | Date |
|----------|-----------|------|
| | | |
