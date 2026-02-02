---
title: "{{project_name}}: API Design"
version: "1.0"
status: draft
author: {{author}}
last_updated: {{date}}
tags: [architecture, api, rest]
---

# {{project_name}} — API Design

## General Principles

1. **REST** — Resource-based URL structure
2. **JSON** — Request/Response body
3. **Versioning** — `/api/v1/`
4. **Pagination** — Cursor-based

## Authentication

```
POST /api/v1/auth/login → Get token
```

## URL Structure

```
/api/v1/{resource}                     → Collection
/api/v1/{resource}/{id}                → Single resource
/api/v1/{resource}/{id}/{sub-resource} → Nested resource
```

## Endpoints

### [Resource 1]

```
GET    /api/v1/resources               → List
POST   /api/v1/resources               → Create
GET    /api/v1/resources/{id}          → Detail
PATCH  /api/v1/resources/{id}          → Update
DELETE /api/v1/resources/{id}          → Delete
```

## Request/Response Format

### Pagination

```json
{
  "data": [],
  "pagination": {
    "limit": 20,
    "has_more": true,
    "next_cursor": "..."
  }
}
```

### Error Format

```json
{
  "type": "https://example.com/errors/validation",
  "title": "Validation Error",
  "status": 422,
  "detail": "Description",
  "errors": []
}
```

## Rate Limiting

| Endpoint | Limit |
|----------|-------|
| Auth | 10 req/minute |
| API general | 100 req/minute |
