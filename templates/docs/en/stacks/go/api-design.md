---
title: "{{project_name}}: API Design (Go)"
version: "1.0"
status: draft
author: "{{author}}"
last_updated: "{{date}}"
tags: [architecture, api, go]
---

# API Design

## Framework

| Component | Choice | Notes |
|-----------|--------|-------|
| HTTP Framework | {{http_framework}} | Options: stdlib, Gin, Echo, Chi |
| Router | {{router}} | Options: chi, stdlib mux, gorilla/mux |
| Validation | go-playground/validator | Struct tag validation |
| Docs | swaggo/swag | OpenAPI generation from comments |

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
| PATCH | `/api/v1/{{resource_name}}s/{id}` | Partial update | {{auth}} |
| DELETE | `/api/v1/{{resource_name}}s/{id}` | Delete | {{auth}} |

## HTTP Handler Patterns

### Handler Struct Pattern

```go
type {{resource_name}}Handler struct {
    service {{resource_name}}Service
    logger  *slog.Logger
}

func New{{resource_name}}Handler(svc {{resource_name}}Service, log *slog.Logger) *{{resource_name}}Handler {
    return &{{resource_name}}Handler{service: svc, logger: log}
}
```

### Handler Methods (stdlib)

```go
func (h *{{resource_name}}Handler) List(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    page, _ := strconv.Atoi(r.URL.Query().Get("page"))
    if page < 1 {
        page = 1
    }

    items, err := h.service.List(ctx, page)
    if err != nil {
        h.handleError(w, r, err)
        return
    }

    httputil.JSON(w, http.StatusOK, items)
}

func (h *{{resource_name}}Handler) Create(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    var req Create{{resource_name}}Request
    if err := httputil.Decode(r, &req); err != nil {
        httputil.Error(w, http.StatusBadRequest, "invalid request body")
        return
    }

    if err := validate.Struct(req); err != nil {
        httputil.ValidationError(w, err)
        return
    }

    item, err := h.service.Create(ctx, req)
    if err != nil {
        h.handleError(w, r, err)
        return
    }

    httputil.JSON(w, http.StatusCreated, item)
}
```

### Route Registration

```go
func (s *Server) routes() {
    r := chi.NewRouter()

    // Global middleware
    r.Use(middleware.RequestID)
    r.Use(middleware.RealIP)
    r.Use(middleware.Logger)
    r.Use(middleware.Recoverer)
    r.Use(middleware.Timeout(30 * time.Second))

    r.Route("/api/v1", func(r chi.Router) {
        r.Route("/{{resource_name}}s", func(r chi.Router) {
            r.Get("/", h.List)
            r.Post("/", h.Create)
            r.Route("/{id}", func(r chi.Router) {
                r.Get("/", h.GetByID)
                r.Put("/", h.Update)
                r.Delete("/", h.Delete)
            })
        })
    })
}
```

## Middleware Chain

| Middleware | Purpose | Order |
|-----------|---------|-------|
| Recovery | Panic recovery | 1 (outermost) |
| Request ID | Unique request tracking | 2 |
| CORS | Cross-origin requests | 3 |
| Logging | Request/response logging | 4 |
| Auth | Token validation | 5 |
| Rate Limit | Throttle requests | 6 |
| Timeout | Request timeout | 7 (innermost) |

### Middleware Pattern

```go
func AuthMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        token := r.Header.Get("Authorization")
        if token == "" {
            httputil.Error(w, http.StatusUnauthorized, "missing token")
            return
        }

        claims, err := validateToken(token)
        if err != nil {
            httputil.Error(w, http.StatusUnauthorized, "invalid token")
            return
        }

        ctx := context.WithValue(r.Context(), userCtxKey, claims)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}
```

## Context Usage

### Passing Values

```go
type contextKey string

const userCtxKey contextKey = "user"

func UserFromContext(ctx context.Context) (*User, error) {
    user, ok := ctx.Value(userCtxKey).(*User)
    if !ok {
        return nil, ErrUnauthenticated
    }
    return user, nil
}
```

### Timeouts and Cancellation

```go
func (s *Service) FetchData(ctx context.Context, id string) (*Data, error) {
    ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
    defer cancel()

    return s.repo.FindByID(ctx, id)
}
```

## Error Handling

### Domain Errors

```go
var (
    ErrNotFound       = errors.New("resource not found")
    ErrAlreadyExists  = errors.New("resource already exists")
    ErrUnauthorized   = errors.New("unauthorized")
    ErrForbidden      = errors.New("forbidden")
    ErrValidation     = errors.New("validation error")
)
```

### Error Response Mapping

```go
func (h *Handler) handleError(w http.ResponseWriter, r *http.Request, err error) {
    switch {
    case errors.Is(err, model.ErrNotFound):
        httputil.Error(w, http.StatusNotFound, err.Error())
    case errors.Is(err, model.ErrAlreadyExists):
        httputil.Error(w, http.StatusConflict, err.Error())
    case errors.Is(err, model.ErrValidation):
        httputil.Error(w, http.StatusBadRequest, err.Error())
    default:
        h.logger.ErrorContext(r.Context(), "internal error", "error", err)
        httputil.Error(w, http.StatusInternalServerError, "internal server error")
    }
}
```

### Standard Error Response

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Resource not found",
    "details": []
  }
}
```

## JSON Marshaling

### Response Helper

```go
package httputil

func JSON(w http.ResponseWriter, status int, data any) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(status)
    if err := json.NewEncoder(w).Encode(data); err != nil {
        slog.Error("failed to encode response", "error", err)
    }
}

func Decode(r *http.Request, dst any) error {
    dec := json.NewDecoder(r.Body)
    dec.DisallowUnknownFields()
    return dec.Decode(dst)
}
```

### Struct Tags

```go
type {{resource_name}}Response struct {
    ID        string    `json:"id"`
    Name      string    `json:"name"`
    CreatedAt time.Time `json:"created_at"`
    UpdatedAt time.Time `json:"updated_at"`
}
```

## Authentication

| Method | Use Case | Implementation |
|--------|----------|---------------|
| JWT Bearer | API clients | `golang-jwt/jwt` |
| API Key | Service-to-service | Custom header |
| OAuth2 | Third-party auth | `golang.org/x/oauth2` |

## Rate Limiting

| Endpoint Group | Limit | Window |
|---------------|-------|--------|
| Public | 60 req | 1 min |
| Authenticated | 300 req | 1 min |
| Admin | 1000 req | 1 min |
