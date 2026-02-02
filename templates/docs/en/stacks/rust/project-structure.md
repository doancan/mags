---
title: "{{project_name}}: Project Structure (Rust)"
version: "1.0"
status: draft
author: "{{author}}"
last_updated: "{{date}}"
tags: [architecture, structure, rust]
---

# Project Structure

## Single Crate Layout

```
{{project_name}}/
├── src/
│   ├── main.rs                     # Application entry point
│   ├── lib.rs                      # Library root (re-exports)
│   ├── config.rs                   # Configuration
│   ├── error.rs                    # Error types
│   ├── routes/
│   │   ├── mod.rs                  # Route registration
│   │   ├── health.rs               # Health check
│   │   └── users.rs                # User endpoints
│   ├── handlers/
│   │   ├── mod.rs
│   │   └── user_handler.rs         # Request handling
│   ├── services/
│   │   ├── mod.rs
│   │   └── user_service.rs         # Business logic
│   ├── repositories/
│   │   ├── mod.rs
│   │   └── user_repo.rs            # Data access
│   ├── models/
│   │   ├── mod.rs
│   │   └── user.rs                 # Domain models
│   ├── dto/
│   │   ├── mod.rs
│   │   ├── request.rs              # Request types
│   │   └── response.rs             # Response types
│   └── middleware/
│       ├── mod.rs
│       ├── auth.rs
│       └── logging.rs
├── tests/                          # Integration tests
│   ├── common/
│   │   └── mod.rs                  # Shared test utilities
│   ├── api_tests.rs
│   └── health_test.rs
├── migrations/                     # Database migrations
│   └── 20240101000000_create_users.sql
├── Cargo.toml
├── Cargo.lock
├── rust-toolchain.toml
├── rustfmt.toml
├── clippy.toml
├── deny.toml
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```

## Cargo Workspace Layout

For larger projects with multiple crates:

```
{{project_name}}/
├── Cargo.toml                      # Workspace root
├── Cargo.lock
├── crates/
│   ├── server/                     # HTTP server binary
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── main.rs
│   │       ├── routes.rs
│   │       └── handlers.rs
│   ├── core/                       # Domain logic library
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── models.rs
│   │       ├── services.rs
│   │       └── error.rs
│   ├── db/                         # Database layer library
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── repositories.rs
│   │       └── migrations.rs
│   └── common/                     # Shared utilities
│       ├── Cargo.toml
│       └── src/
│           ├── lib.rs
│           └── config.rs
├── migrations/
├── tests/                          # Workspace-level integration tests
├── Dockerfile
└── README.md
```

### Workspace Cargo.toml

```toml
[workspace]
resolver = "2"
members = [
    "crates/server",
    "crates/core",
    "crates/db",
    "crates/common",
]

[workspace.dependencies]
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
tracing = "0.1"
```

## `lib.rs` vs `main.rs`

| File | Purpose | Contains |
|------|---------|----------|
| `main.rs` | Binary entry point | `fn main()`, minimal setup |
| `lib.rs` | Library root | Module declarations, re-exports |

```rust
// src/lib.rs
pub mod config;
pub mod error;
pub mod handlers;
pub mod models;
pub mod repositories;
pub mod routes;
pub mod services;
```

```rust
// src/main.rs
use {{crate_name}}::{config::Config, routes};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::init();
    let config = Config::from_env()?;
    let app = routes::create_router(config).await?;
    let listener = tokio::net::TcpListener::bind(&config.addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
```

## Module Pattern

### `mod.rs` Style

```
routes/
├── mod.rs          # pub mod users; pub mod health;
├── users.rs
└── health.rs
```

### File-Based Style (Rust 2018+)

```
routes.rs           # pub mod users; pub mod health;
routes/
├── users.rs
└── health.rs
```

## Tests Directory

Integration tests live in the top-level `tests/` directory:

```rust
// tests/common/mod.rs
use sqlx::PgPool;

pub async fn setup_test_db() -> PgPool {
    // Create test database, run migrations
}

pub fn spawn_app() -> TestServer {
    // Start test server on random port
}
```

```rust
// tests/api_tests.rs
mod common;

#[tokio::test]
async fn test_create_user() {
    let app = common::spawn_app().await;
    let response = app.client
        .post(&format!("{}/api/v1/users", app.address))
        .json(&body)
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), 201);
}
```

## Dependency Rules

| Crate | May Depend On | Must Not Depend On |
|-------|--------------|-------------------|
| `server` | `core`, `db`, `common` | - |
| `core` | `common` | `server`, `db` |
| `db` | `core`, `common` | `server` |
| `common` | External crates only | Any workspace crate |
