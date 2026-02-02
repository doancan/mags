---
title: "{{project_name}}: Project Structure (Python)"
version: "1.0"
status: draft
author: "{{author}}"
last_updated: "{{date}}"
tags: [architecture, structure, python]
---

# Project Structure

## General Python Layout (src layout)

```
{{project_name}}/
├── src/
│   └── {{package_name}}/
│       ├── __init__.py
│       ├── main.py                 # Application entry point
│       ├── config.py               # Configuration management
│       ├── core/
│       │   ├── __init__.py
│       │   ├── exceptions.py       # Custom exceptions
│       │   ├── logging.py          # Logging setup
│       │   └── security.py         # Auth utilities
│       ├── models/
│       │   ├── __init__.py
│       │   ├── base.py             # Base model class
│       │   └── user.py             # Domain models
│       ├── schemas/
│       │   ├── __init__.py
│       │   └── user.py             # Pydantic schemas
│       ├── api/
│       │   ├── __init__.py
│       │   ├── router.py           # Root router
│       │   ├── deps.py             # Shared dependencies
│       │   └── v1/
│       │       ├── __init__.py
│       │       └── endpoints/
│       │           └── users.py
│       ├── services/
│       │   ├── __init__.py
│       │   └── user_service.py     # Business logic
│       ├── repositories/
│       │   ├── __init__.py
│       │   └── user_repo.py        # Data access layer
│       └── utils/
│           ├── __init__.py
│           └── helpers.py
├── tests/
│   ├── __init__.py
│   ├── conftest.py                 # Shared fixtures
│   ├── unit/
│   │   ├── __init__.py
│   │   └── test_user_service.py
│   ├── integration/
│   │   ├── __init__.py
│   │   └── test_user_api.py
│   └── e2e/
│       └── __init__.py
├── alembic/                        # Database migrations
│   ├── env.py
│   └── versions/
├── scripts/                        # Utility scripts
│   └── seed_db.py
├── pyproject.toml                  # Project metadata & dependencies
├── Makefile                        # Common commands
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── .pre-commit-config.yaml
└── README.md
```

## FastAPI-Specific Structure

```
src/{{package_name}}/
├── __init__.py
├── main.py                         # FastAPI app factory
├── config.py                       # Settings via pydantic-settings
├── dependencies.py                 # Shared FastAPI dependencies
├── api/
│   ├── __init__.py
│   └── v1/
│       ├── __init__.py
│       ├── router.py               # APIRouter aggregation
│       └── endpoints/
│           ├── __init__.py
│           ├── auth.py
│           └── users.py
├── models/                         # SQLAlchemy models
├── schemas/                        # Pydantic request/response models
├── services/                       # Business logic
├── repositories/                   # Database queries
├── middleware/
│   ├── __init__.py
│   ├── cors.py
│   └── logging.py
└── core/
    ├── __init__.py
    ├── database.py                 # DB session management
    ├── exceptions.py
    └── security.py
```

## Django-Specific Structure

```
{{project_name}}/
├── manage.py
├── config/                         # Project-level settings
│   ├── __init__.py
│   ├── settings/
│   │   ├── __init__.py
│   │   ├── base.py
│   │   ├── development.py
│   │   └── production.py
│   ├── urls.py
│   ├── wsgi.py
│   └── asgi.py
├── apps/
│   ├── users/
│   │   ├── __init__.py
│   │   ├── admin.py
│   │   ├── apps.py
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── urls.py
│   │   ├── views.py
│   │   ├── services.py
│   │   ├── selectors.py
│   │   ├── tests/
│   │   │   ├── __init__.py
│   │   │   ├── test_models.py
│   │   │   ├── test_views.py
│   │   │   └── factories.py
│   │   └── migrations/
│   │       └── __init__.py
│   └── core/
│       ├── __init__.py
│       └── models.py               # Abstract base models
├── tests/
│   └── conftest.py
├── static/
├── templates/
└── pyproject.toml
```

## Key Conventions

### `__init__.py` Pattern

Use `__init__.py` to control public API of each package:

```python
# src/{{package_name}}/models/__init__.py
from .user import User
from .base import BaseModel

__all__ = ["User", "BaseModel"]
```

### `conftest.py` Pattern

Place shared test fixtures in `conftest.py` at appropriate levels:

```python
# tests/conftest.py
import pytest

@pytest.fixture
def db_session():
    """Provide a transactional database session for tests."""
    ...

@pytest.fixture
def client(db_session):
    """Provide an API test client."""
    ...
```

### `pyproject.toml` Configuration

```toml
[project]
name = "{{package_name}}"
version = "0.1.0"
requires-python = ">=3.11"

[tool.pytest.ini_options]
testpaths = ["tests"]
asyncio_mode = "auto"

[tool.ruff]
target-version = "py311"
line-length = 88

[tool.mypy]
python_version = "3.11"
strict = true
```

## Module Boundaries

| Layer | Imports From | Never Imports From |
|-------|-------------|-------------------|
| API / Endpoints | Services, Schemas | Repositories, Models directly |
| Services | Repositories, Models, Schemas | API layer |
| Repositories | Models | Services, API layer |
| Schemas | (standalone) | Models (keep separate) |
