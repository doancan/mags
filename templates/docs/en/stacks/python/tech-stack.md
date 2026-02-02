---
title: "{{project_name}}: Tech Stack (Python)"
version: "1.0"
status: draft
author: "{{author}}"
last_updated: "{{date}}"
tags: [architecture, tech-stack, python]
---

# Tech Stack

## Summary

> Brief summary of the tech stack and key architectural decisions.

## Runtime

| Component | Choice | Version | Notes |
|-----------|--------|---------|-------|
| Language | Python | 3.11+ | Modern syntax features, performance improvements |
| Package Manager | {{package_manager}} | Latest | Options: pip, poetry, uv |
| Virtual Environment | {{venv_tool}} | Latest | Options: venv, virtualenv, conda |

## Core Framework

| Component | Choice | Notes |
|-----------|--------|-------|
| Web Framework | {{web_framework}} | Options: FastAPI, Django, Flask |
| ORM | {{orm}} | Options: SQLAlchemy, Django ORM, Tortoise ORM |
| Task Queue | {{task_queue}} | Options: Celery, Dramatiq, Huey |
| Caching | {{cache}} | Options: Redis, Memcached |

### Framework Comparison

| Feature | FastAPI | Django | Flask |
|---------|---------|--------|-------|
| Async support | Native | 4.1+ (partial) | Via extensions |
| Auto docs | OpenAPI built-in | Via DRF | Via extensions |
| ORM | BYO (SQLAlchemy) | Built-in | BYO |
| Admin panel | No | Built-in | Via Flask-Admin |
| Learning curve | Low | Medium | Low |
| Best for | APIs, microservices | Full-stack, CMS | Small apps, APIs |

## Database

| Component | Choice | Notes |
|-----------|--------|-------|
| Primary DB | {{database}} | Options: PostgreSQL, MySQL, SQLite |
| Migrations | {{migration_tool}} | Options: Alembic, Django Migrations |
| Driver | {{db_driver}} | Options: psycopg2, asyncpg, aiomysql |

## Testing

| Component | Choice | Notes |
|-----------|--------|-------|
| Test Runner | pytest | Industry standard for Python testing |
| Coverage | pytest-cov | Coverage reporting |
| Fixtures | pytest fixtures | Built-in fixture system |
| Mocking | unittest.mock / pytest-mock | Standard library + pytest plugin |
| API Testing | httpx / TestClient | Async-compatible HTTP testing |
| Factory | factory_boy | Test data generation |

## Code Quality

| Tool | Purpose | Configuration |
|------|---------|---------------|
| ruff | Linting + formatting | `ruff.toml` or `pyproject.toml` |
| mypy | Static type checking | `mypy.ini` or `pyproject.toml` |
| bandit | Security linting | `.bandit` |
| pre-commit | Git hooks | `.pre-commit-config.yaml` |

## Key Dependencies

| Package | Purpose | Version |
|---------|---------|---------|
| pydantic | Data validation | v2.x |
| httpx | HTTP client | Latest |
| structlog | Structured logging | Latest |
| python-dotenv | Environment management | Latest |
| tenacity | Retry logic | Latest |

## Virtual Environments

All development should use isolated virtual environments:

```bash
# Using venv (stdlib)
python -m venv .venv
source .venv/bin/activate

# Using poetry
poetry install
poetry shell

# Using uv
uv venv
source .venv/bin/activate
uv pip install -r requirements.txt
```

## Environment Configuration

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | Database connection string | Yes |
| `SECRET_KEY` | Application secret key | Yes |
| `DEBUG` | Debug mode flag | No (default: false) |
| `LOG_LEVEL` | Logging level | No (default: INFO) |

## Decision Log

| Decision | Rationale | Date |
|----------|-----------|------|
| | | |
