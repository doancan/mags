---
title: "{{project_name}}: Tech Stack (TypeScript)"
version: "1.0"
status: draft
author: "{{author}}"
last_updated: "{{date}}"
tags: [architecture, tech-stack, typescript]
---

# Tech Stack

## Summary

> Brief summary of the tech stack and key architectural decisions.

## Runtime

| Component | Choice | Version | Notes |
|-----------|--------|---------|-------|
| Language | TypeScript | 5.x | Strict mode enabled |
| Runtime | {{runtime}} | Latest LTS | Options: Node.js, Deno, Bun |
| Package Manager | {{package_manager}} | Latest | Options: npm, pnpm, yarn, bun |

## Core Framework

| Component | Choice | Notes |
|-----------|--------|-------|
| Web Framework | {{web_framework}} | Options: Next.js, NestJS, Express, Fastify, Hono |
| ORM | {{orm}} | Options: Prisma, Drizzle, TypeORM |
| Task Queue | {{task_queue}} | Options: BullMQ, Temporal, inngest |
| Caching | {{cache}} | Options: Redis, Keyv |

### Framework Comparison

| Feature | Next.js | NestJS | Express | Fastify | Hono |
|---------|---------|--------|---------|---------|------|
| Full-stack | Yes (RSC) | Backend only | Backend only | Backend only | Backend only |
| Routing | File-based (app/) | Decorator-based | Manual | Manual | Manual |
| DI/IoC | No | Built-in | No | No | No |
| OpenAPI | Via next-swagger | Via @nestjs/swagger | Via swagger-jsdoc | Via @fastify/swagger | Via zod-openapi |
| Performance | Medium | Medium | Medium | High | High |
| Best for | Full-stack apps, SSR | Enterprise APIs | Simple APIs | High-perf APIs | Edge/lightweight |

## Database

| Component | Choice | Notes |
|-----------|--------|-------|
| Primary DB | {{database}} | Options: PostgreSQL, MySQL, SQLite |
| Migrations | {{migration_tool}} | Options: Prisma Migrate, Drizzle Kit, TypeORM Migrations |
| Driver | {{db_driver}} | Options: pg, mysql2, better-sqlite3 |

## Testing

| Component | Choice | Notes |
|-----------|--------|-------|
| Test Runner | {{test_runner}} | Options: Vitest (recommended), Jest |
| Coverage | v8 / istanbul | Built-in with Vitest/Jest |
| Mocking | vi.mock / jest.mock | Framework-native mocking |
| API Testing | Supertest | HTTP assertion library |
| E2E | Playwright | Cross-browser testing |
| Factory | @factory-ts, fishery | Test data generation |

## Code Quality

| Tool | Purpose | Configuration |
|------|---------|---------------|
| ESLint | Linting | `eslint.config.mjs` (flat config) |
| Prettier | Formatting | `.prettierrc` |
| Biome | Lint + format (alternative) | `biome.json` |
| TypeScript | Type checking | `tsconfig.json` |

## Key Dependencies

| Package | Purpose | Version |
|---------|---------|---------|
| zod | Schema validation | v3.x |
| @tanstack/react-query | Data fetching (frontend) | v5.x |
| dotenv | Environment management | Latest |
| pino / winston | Logging | Latest |
| tsx | TypeScript execution | Latest |

## TypeScript Configuration

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
```

## Environment Configuration

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | Database connection string | Yes |
| `NODE_ENV` | Environment (development/production/test) | Yes |
| `PORT` | Server port | No (default: 3000) |
| `LOG_LEVEL` | Logging level | No (default: info) |

## Decision Log

| Decision | Rationale | Date |
|----------|-----------|------|
| | | |
