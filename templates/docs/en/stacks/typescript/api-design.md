---
title: "{{project_name}}: API Design (TypeScript)"
version: "1.0"
status: draft
author: "{{author}}"
last_updated: "{{date}}"
tags: [architecture, api, typescript]
---

# API Design

## Framework

| Component | Choice | Notes |
|-----------|--------|-------|
| Framework | {{web_framework}} | Options: Express, Fastify, NestJS, Hono, Next.js API Routes |
| Validation | Zod | Runtime schema validation with TypeScript inference |
| Server | {{server}} | Options: Node.js HTTP, Fastify, uvicorn (via Hono) |
| Docs | OpenAPI 3.1 | Auto-generated or manual |

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
| GET | `/api/v1/{{resource_name}}s/:id` | Get by ID | {{auth}} |
| PUT | `/api/v1/{{resource_name}}s/:id` | Full update | {{auth}} |
| PATCH | `/api/v1/{{resource_name}}s/:id` | Partial update | {{auth}} |
| DELETE | `/api/v1/{{resource_name}}s/:id` | Delete | {{auth}} |

## Zod Validation Schemas

```typescript
import { z } from 'zod';

export const {{resource_name}}CreateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
});

export const {{resource_name}}UpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
});

export const {{resource_name}}ParamsSchema = z.object({
  id: z.string().uuid(),
});

export const {{resource_name}}QuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'name']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Inferred types
export type {{resource_name}}Create = z.infer<typeof {{resource_name}}CreateSchema>;
export type {{resource_name}}Update = z.infer<typeof {{resource_name}}UpdateSchema>;
```

## Express / Fastify Route Patterns

### Route Definition

```typescript
import { Router } from 'express';
import { z } from 'zod';
import { validate } from '@/middleware/validate';

const router = Router();

router.get(
  '/{{resource_name}}s',
  validate({ query: {{resource_name}}QuerySchema }),
  async (req, res) => {
    const result = await service.list(req.query);
    res.json(result);
  }
);

router.post(
  '/{{resource_name}}s',
  validate({ body: {{resource_name}}CreateSchema }),
  async (req, res) => {
    const item = await service.create(req.body);
    res.status(201).json(item);
  }
);

export { router as {{resource_name}}Router };
```

### Validation Middleware

```typescript
import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';

interface ValidationSchemas {
  body?: AnyZodObject;
  query?: AnyZodObject;
  params?: AnyZodObject;
}

export function validate(schemas: ValidationSchemas) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.query) req.query = schemas.query.parse(req.query);
      if (schemas.params) req.params = schemas.params.parse(req.params);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.errors,
        });
        return;
      }
      next(error);
    }
  };
}
```

## NestJS Controller / DTO Pattern

### Controller

```typescript
import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Create{{resource_name}}Dto } from './dto/create-{{resource_name}}.dto';
import { {{resource_name}}QueryDto } from './dto/{{resource_name}}-query.dto';
import { {{resource_name}}Service } from './{{resource_name}}.service';

@ApiTags('{{resource_name}}s')
@Controller('{{resource_name}}s')
export class {{resource_name}}Controller {
  constructor(private readonly service: {{resource_name}}Service) {}

  @Get()
  @ApiOperation({ summary: 'List all {{resource_name}}s' })
  async findAll(@Query() query: {{resource_name}}QueryDto) {
    return this.service.findAll(query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a {{resource_name}}' })
  async create(@Body() dto: Create{{resource_name}}Dto) {
    return this.service.create(dto);
  }
}
```

### DTO

```typescript
import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class Create{{resource_name}}Dto {
  @ApiProperty({ description: 'Name', minLength: 1, maxLength: 255 })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;
}
```

## tRPC Patterns

```typescript
import { router, publicProcedure, protectedProcedure } from '@/trpc';
import { z } from 'zod';

export const {{resource_name}}Router = router({
  list: publicProcedure
    .input({{resource_name}}QuerySchema)
    .query(async ({ input, ctx }) => {
      return ctx.db.{{resource_name}}.findMany({
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        orderBy: { [input.sortBy]: input.sortOrder },
      });
    }),

  create: protectedProcedure
    .input({{resource_name}}CreateSchema)
    .mutation(async ({ input, ctx }) => {
      return ctx.db.{{resource_name}}.create({ data: input });
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const item = await ctx.db.{{resource_name}}.findUnique({
        where: { id: input.id },
      });
      if (!item) throw new TRPCError({ code: 'NOT_FOUND' });
      return item;
    }),
});
```

## Middleware

| Middleware | Purpose | Order |
|-----------|---------|-------|
| CORS | Cross-origin requests | First |
| Request ID | Unique request tracking | Early |
| Logger | Request/response logging | Early |
| Auth | Token validation | Before routes |
| Rate Limiter | Throttle requests | Before routes |
| Error Handler | Consistent error responses | Last |

### Express Middleware Example

```typescript
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export function requestId(req: Request, _res: Response, next: NextFunction) {
  req.id = req.headers['x-request-id'] as string ?? randomUUID();
  next();
}
```

## Error Handling

### Standard Error Response

```json
{
  "error": "Resource not found",
  "code": "NOT_FOUND",
  "status": 404,
  "details": []
}
```

### Error Handler

```typescript
import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown[],
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: err.message,
      code: err.code,
      status: err.status,
      details: err.details ?? [],
    });
    return;
  }

  res.status(500).json({
    error: 'Internal Server Error',
    code: 'INTERNAL_ERROR',
    status: 500,
  });
}
```

## Authentication

| Method | Use Case | Implementation |
|--------|----------|---------------|
| JWT Bearer | API clients | `jose` / `jsonwebtoken` |
| OAuth2 | Third-party auth | `arctic` / `next-auth` |
| API Key | Service-to-service | Custom header middleware |
| Session | Web frontend | Cookie-based (`iron-session`, `express-session`) |

## Rate Limiting

| Endpoint Group | Limit | Window |
|---------------|-------|--------|
| Public | 60 req | 1 min |
| Authenticated | 300 req | 1 min |
| Admin | 1000 req | 1 min |
