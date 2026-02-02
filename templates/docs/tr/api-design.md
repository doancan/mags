---
title: "{{project_name}}: API Design"
version: v1.0
status: DRAFT
author: {{author}}
last_updated: {{date}}
tags: [architecture, api, rest]
---

# {{project_name}} — API Design

## Genel Prensipler

1. **REST** — Resource-based URL yapısı
2. **JSON** — Request/Response body
3. **Versioning** — `/api/v1/`
4. **Pagination** — Cursor-based

## Authentication

```
POST /api/v1/auth/login → Token al
```

## URL Yapısı

```
/api/v1/{resource}                     → Collection
/api/v1/{resource}/{id}                → Single resource
/api/v1/{resource}/{id}/{sub-resource} → Nested resource
```

## Endpoints

### [Resource 1]

```
GET    /api/v1/resources               → Liste
POST   /api/v1/resources               → Oluştur
GET    /api/v1/resources/{id}          → Detay
PATCH  /api/v1/resources/{id}          → Güncelle
DELETE /api/v1/resources/{id}          → Sil
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

### Hata Formatı

```json
{
  "type": "https://example.com/errors/validation",
  "title": "Validation Error",
  "status": 422,
  "detail": "Açıklama",
  "errors": []
}
```

## Rate Limiting

| Endpoint | Limit |
|----------|-------|
| Auth | 10 req/dakika |
| API genel | 100 req/dakika |
