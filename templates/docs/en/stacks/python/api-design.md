---
title: "{{project_name}}: API Design (Python)"
version: "1.0"
status: draft
author: "{{author}}"
last_updated: "{{date}}"
tags: [architecture, api, python]
---

# API Design

## Framework

| Component | Choice | Notes |
|-----------|--------|-------|
| Framework | {{web_framework}} | Options: FastAPI, Django REST Framework |
| Serialization | Pydantic v2 | Request/response validation |
| Server | uvicorn | ASGI server |
| Docs | OpenAPI 3.1 | Auto-generated |

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

## Pydantic Models

### Request/Response Schemas

```python
from pydantic import BaseModel, Field
from datetime import datetime

class {{resource_name}}Base(BaseModel):
    """Shared fields."""
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None

class {{resource_name}}Create({{resource_name}}Base):
    """Fields required for creation."""
    pass

class {{resource_name}}Update(BaseModel):
    """Fields allowed for update (all optional)."""
    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None

class {{resource_name}}Response({{resource_name}}Base):
    """Response schema with DB fields."""
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
```

### Pagination

```python
from pydantic import BaseModel
from typing import Generic, TypeVar

T = TypeVar("T")

class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    pages: int
```

## FastAPI Patterns

### Router Definition

```python
from fastapi import APIRouter, Depends, HTTPException, status

router = APIRouter(prefix="/{{resource_name}}s", tags=["{{resource_name}}s"])

@router.get("/", response_model=PaginatedResponse[{{resource_name}}Response])
async def list_items(
    page: int = 1,
    page_size: int = 20,
    service: {{resource_name}}Service = Depends(get_service),
):
    return await service.list(page=page, page_size=page_size)

@router.post("/", response_model={{resource_name}}Response, status_code=status.HTTP_201_CREATED)
async def create_item(
    data: {{resource_name}}Create,
    service: {{resource_name}}Service = Depends(get_service),
):
    return await service.create(data)
```

### Dependency Injection

```python
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        yield session

async def get_repository(db: AsyncSession = Depends(get_db)):
    return {{resource_name}}Repository(db)

async def get_service(repo = Depends(get_repository)):
    return {{resource_name}}Service(repo)
```

## Django REST Framework Patterns

### ViewSet

```python
from rest_framework import viewsets, permissions, status
from rest_framework.response import Response

class {{resource_name}}ViewSet(viewsets.ModelViewSet):
    queryset = {{resource_name}}.objects.all()
    serializer_class = {{resource_name}}Serializer
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action == "create":
            return {{resource_name}}CreateSerializer
        return {{resource_name}}Serializer
```

## Middleware

| Middleware | Purpose | Order |
|-----------|---------|-------|
| CORS | Cross-origin requests | First |
| Request ID | Unique request tracking | Early |
| Logging | Request/response logging | Early |
| Authentication | Token validation | Before routes |
| Rate Limiting | Throttle requests | Before routes |
| Error Handler | Consistent error responses | Last |

### ASGI Middleware Example

```python
from starlette.middleware.base import BaseHTTPMiddleware

class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        request_id = request.headers.get("X-Request-ID", str(uuid4()))
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response
```

## Error Handling

### Standard Error Response

```json
{
  "detail": "Resource not found",
  "code": "NOT_FOUND",
  "status": 404,
  "errors": []
}
```

### Exception Handler

```python
from fastapi import Request
from fastapi.responses import JSONResponse

class AppException(Exception):
    def __init__(self, status_code: int, code: str, detail: str):
        self.status_code = status_code
        self.code = code
        self.detail = detail

@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "code": exc.code, "status": exc.status_code},
    )
```

## Authentication

| Method | Use Case | Implementation |
|--------|----------|---------------|
| JWT Bearer | API clients | `python-jose` / `PyJWT` |
| OAuth2 | Third-party auth | `authlib` |
| API Key | Service-to-service | Custom header |
| Session | Web frontend | Cookie-based |

## Rate Limiting

| Endpoint Group | Limit | Window |
|---------------|-------|--------|
| Public | 60 req | 1 min |
| Authenticated | 300 req | 1 min |
| Admin | 1000 req | 1 min |
