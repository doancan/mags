---
title: "{{project_name}}: API Design (Rust)"
version: "1.0"
status: draft
author: "{{author}}"
last_updated: "{{date}}"
tags: [architecture, api, rust]
---

# API Design

## Framework

| Component | Choice | Notes |
|-----------|--------|-------|
| Web Framework | {{web_framework}} | Options: Axum, Actix-Web |
| Serialization | serde + serde_json | De/serialization |
| Validation | validator | Struct-level validation |
| Docs | utoipa | OpenAPI generation |

## Base URL & Versioning

```
{{base_url}}/api/v1/
```

Versioning strategy: URL prefix (`/api/v1/`, `/api/v2/`).

## Endpoints

### Resource: {{resource_name}}

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/v1/{{resource_name}}s` | List all | {{auth}} |
| POST | `/api/v1/{{resource_name}}s` | Create new | {{auth}} |
| GET | `/api/v1/{{resource_name}}s/{id}` | Get by ID | {{auth}} |
| PUT | `/api/v1/{{resource_name}}s/{id}` | Full update | {{auth}} |
| DELETE | `/api/v1/{{resource_name}}s/{id}` | Delete | {{auth}} |

## Axum Handler Patterns

### Router Setup

```rust
use axum::{Router, routing::{get, post}};

pub fn create_router(state: AppState) -> Router {
    Router::new()
        .route("/api/v1/{{resource_name}}s", get(list).post(create))
        .route("/api/v1/{{resource_name}}s/:id", get(get_by_id).put(update).delete(delete))
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive())
        .with_state(state)
}
```

### Handler Functions

```rust
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};

async fn list(
    State(state): State<AppState>,
    Query(params): Query<ListParams>,
) -> Result<Json<PaginatedResponse<{{resource_name}}Response>>, AppError> {
    let items = state.service.list(params.page, params.page_size).await?;
    Ok(Json(items))
}

async fn create(
    State(state): State<AppState>,
    Json(payload): Json<Create{{resource_name}}Request>,
) -> Result<(StatusCode, Json<{{resource_name}}Response>), AppError> {
    payload.validate()?;
    let item = state.service.create(payload).await?;
    Ok((StatusCode::CREATED, Json(item)))
}

async fn get_by_id(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<{{resource_name}}Response>, AppError> {
    let item = state.service.get_by_id(id).await?;
    Ok(Json(item))
}
```

### Extractors

| Extractor | Source | Usage |
|-----------|--------|-------|
| `Path<T>` | URL path params | `Path(id): Path<Uuid>` |
| `Query<T>` | Query string | `Query(params): Query<ListParams>` |
| `Json<T>` | Request body | `Json(body): Json<CreateRequest>` |
| `State<T>` | Shared state | `State(state): State<AppState>` |
| `Header<T>` | Request headers | `TypedHeader(auth): TypedHeader<Authorization>` |
| Custom | Any source | Implement `FromRequestParts` |

### Custom Extractor

```rust
use axum::extract::FromRequestParts;

pub struct AuthUser {
    pub user_id: Uuid,
    pub role: Role,
}

#[async_trait]
impl<S> FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let token = parts.headers
            .get("Authorization")
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.strip_prefix("Bearer "))
            .ok_or(AppError::Unauthorized)?;

        let claims = decode_token(token)?;
        Ok(AuthUser { user_id: claims.sub, role: claims.role })
    }
}
```

## Actix-Web Handler Patterns

### Handler Functions

```rust
use actix_web::{web, HttpResponse};

async fn list(
    service: web::Data<dyn {{resource_name}}Service>,
    query: web::Query<ListParams>,
) -> Result<HttpResponse, AppError> {
    let items = service.list(query.page, query.page_size).await?;
    Ok(HttpResponse::Ok().json(items))
}

async fn create(
    service: web::Data<dyn {{resource_name}}Service>,
    body: web::Json<Create{{resource_name}}Request>,
) -> Result<HttpResponse, AppError> {
    body.validate()?;
    let item = service.create(body.into_inner()).await?;
    Ok(HttpResponse::Created().json(item))
}
```

## Middleware

### Tower Layer (Axum)

```rust
use tower_http::{
    cors::CorsLayer,
    trace::TraceLayer,
    timeout::TimeoutLayer,
};

let app = Router::new()
    .merge(routes)
    .layer(
        ServiceBuilder::new()
            .layer(TraceLayer::new_for_http())
            .layer(TimeoutLayer::new(Duration::from_secs(30)))
            .layer(CorsLayer::permissive())
    );
```

| Layer | Purpose | Order |
|-------|---------|-------|
| TraceLayer | Request tracing/logging | Outermost |
| TimeoutLayer | Request timeout | Early |
| CorsLayer | CORS headers | Early |
| Auth | Authentication | Before routes |
| CompressionLayer | Response compression | Inner |

## Error Handling

### Error Type with `thiserror`

```rust
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Resource not found")]
    NotFound,

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Unauthorized")]
    Unauthorized,

    #[error("Forbidden")]
    Forbidden,

    #[error("Conflict: {0}")]
    Conflict(String),

    #[error(transparent)]
    Internal(#[from] anyhow::Error),
}
```

### Error Response (Axum)

```rust
impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, code, message) = match &self {
            AppError::NotFound => (StatusCode::NOT_FOUND, "NOT_FOUND", self.to_string()),
            AppError::Validation(msg) => (StatusCode::BAD_REQUEST, "VALIDATION_ERROR", msg.clone()),
            AppError::Unauthorized => (StatusCode::UNAUTHORIZED, "UNAUTHORIZED", self.to_string()),
            AppError::Forbidden => (StatusCode::FORBIDDEN, "FORBIDDEN", self.to_string()),
            AppError::Conflict(msg) => (StatusCode::CONFLICT, "CONFLICT", msg.clone()),
            AppError::Internal(err) => {
                tracing::error!("Internal error: {:?}", err);
                (StatusCode::INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "Internal server error".into())
            }
        };

        let body = json!({
            "error": { "code": code, "message": message }
        });

        (status, Json(body)).into_response()
    }
}
```

### Using `anyhow` in Handlers

```rust
// For application-level error handling
async fn handler() -> Result<Json<Data>, AppError> {
    let data = fetch_data()
        .await
        .context("failed to fetch data")?; // anyhow context
    Ok(Json(data))
}
```

## Request/Response Types

```rust
use serde::{Deserialize, Serialize};
use validator::Validate;

#[derive(Deserialize, Validate)]
pub struct Create{{resource_name}}Request {
    #[validate(length(min = 1, max = 255))]
    pub name: String,
    pub description: Option<String>,
}

#[derive(Serialize)]
pub struct {{resource_name}}Response {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Serialize)]
pub struct PaginatedResponse<T: Serialize> {
    pub items: Vec<T>,
    pub total: i64,
    pub page: i32,
    pub page_size: i32,
    pub pages: i32,
}
```

## Authentication

| Method | Use Case | Crate |
|--------|----------|-------|
| JWT Bearer | API clients | `jsonwebtoken` |
| API Key | Service-to-service | Custom extractor |
| OAuth2 | Third-party auth | `oauth2` |
