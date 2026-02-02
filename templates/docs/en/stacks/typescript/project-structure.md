---
title: "{{project_name}}: Project Structure (TypeScript)"
version: "1.0"
status: draft
author: "{{author}}"
last_updated: "{{date}}"
tags: [architecture, structure, typescript]
---

# Project Structure

## General TypeScript Layout

```
{{project_name}}/
├── src/
│   ├── index.ts                    # Application entry point
│   ├── config/
│   │   ├── index.ts                # Configuration loading
│   │   └── env.ts                  # Environment variables (zod validated)
│   ├── modules/
│   │   └── {{module_name}}/
│   │       ├── index.ts            # Module barrel export
│   │       ├── {{module_name}}.controller.ts
│   │       ├── {{module_name}}.service.ts
│   │       ├── {{module_name}}.repository.ts
│   │       ├── {{module_name}}.types.ts
│   │       └── __tests__/
│   │           └── {{module_name}}.service.test.ts
│   ├── shared/
│   │   ├── types/                  # Shared type definitions
│   │   ├── utils/                  # Shared utility functions
│   │   └── middleware/             # Shared middleware
│   └── lib/
│       ├── database.ts             # Database client setup
│       ├── logger.ts               # Logger configuration
│       └── errors.ts               # Custom error classes
├── dist/                           # Compiled output
├── tests/
│   ├── integration/                # Integration tests
│   ├── e2e/                        # End-to-end tests
│   └── helpers/                    # Test utilities and fixtures
├── tsconfig.json
├── package.json
├── .env.example
├── Dockerfile
└── README.md
```

## Next.js Structure (App Router)

```
{{project_name}}/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout
│   │   ├── page.tsx                # Home page
│   │   ├── globals.css             # Global styles
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   └── register/
│   │   │       └── page.tsx
│   │   ├── dashboard/
│   │   │   ├── layout.tsx          # Dashboard layout
│   │   │   ├── page.tsx
│   │   │   └── settings/
│   │   │       └── page.tsx
│   │   └── api/
│   │       └── v1/
│   │           └── {{resource_name}}/
│   │               └── route.ts    # API route handler
│   ├── components/
│   │   ├── ui/                     # Primitive UI components
│   │   │   ├── button.tsx
│   │   │   └── input.tsx
│   │   ├── forms/                  # Form components
│   │   └── layouts/                # Layout components
│   ├── hooks/                      # Custom React hooks
│   ├── lib/
│   │   ├── api.ts                  # API client
│   │   ├── auth.ts                 # Auth utilities
│   │   └── utils.ts                # General utilities
│   ├── types/                      # Type definitions
│   └── styles/                     # CSS modules / Tailwind
├── public/                         # Static assets
├── prisma/
│   ├── schema.prisma               # Database schema
│   └── migrations/
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## NestJS Structure

```
{{project_name}}/
├── src/
│   ├── main.ts                     # Bootstrap and app factory
│   ├── app.module.ts               # Root module
│   ├── common/
│   │   ├── decorators/             # Custom decorators
│   │   ├── filters/                # Exception filters
│   │   ├── guards/                 # Auth and role guards
│   │   ├── interceptors/           # Logging, transform interceptors
│   │   ├── pipes/                  # Validation pipes
│   │   └── dto/                    # Shared DTOs
│   ├── config/
│   │   ├── config.module.ts
│   │   └── configuration.ts        # ConfigService setup
│   ├── database/
│   │   ├── database.module.ts
│   │   └── prisma.service.ts       # Prisma client provider
│   └── modules/
│       └── {{module_name}}/
│           ├── {{module_name}}.module.ts
│           ├── {{module_name}}.controller.ts
│           ├── {{module_name}}.service.ts
│           ├── {{module_name}}.repository.ts
│           ├── dto/
│           │   ├── create-{{module_name}}.dto.ts
│           │   └── update-{{module_name}}.dto.ts
│           ├── entities/
│           │   └── {{module_name}}.entity.ts
│           └── __tests__/
│               ├── {{module_name}}.controller.spec.ts
│               └── {{module_name}}.service.spec.ts
├── test/
│   ├── app.e2e-spec.ts
│   └── jest-e2e.json
├── prisma/
│   └── schema.prisma
├── nest-cli.json
├── tsconfig.json
├── tsconfig.build.json
└── package.json
```

## Express / Fastify Structure

```
{{project_name}}/
├── src/
│   ├── index.ts                    # Server bootstrap
│   ├── app.ts                      # Express/Fastify app setup
│   ├── routes/
│   │   ├── index.ts                # Route aggregator
│   │   └── {{resource_name}}.routes.ts
│   ├── controllers/
│   │   └── {{resource_name}}.controller.ts
│   ├── services/
│   │   └── {{resource_name}}.service.ts
│   ├── repositories/
│   │   └── {{resource_name}}.repository.ts
│   ├── middleware/
│   │   ├── auth.ts                 # Authentication middleware
│   │   ├── error-handler.ts        # Global error handler
│   │   └── validate.ts             # Request validation
│   ├── schemas/
│   │   └── {{resource_name}}.schema.ts  # Zod schemas
│   ├── types/
│   │   └── index.ts
│   └── utils/
│       └── logger.ts
├── tests/
│   ├── integration/
│   └── helpers/
├── tsconfig.json
└── package.json
```

## Monorepo Structure

```
{{project_name}}/
├── apps/
│   ├── web/                        # Frontend application
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── api/                        # Backend application
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── admin/                      # Admin panel
│       ├── src/
│       ├── package.json
│       └── tsconfig.json
├── packages/
│   ├── shared/                     # Shared types and utilities
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── ui/                         # Shared UI components
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── config/                     # Shared configuration
│       ├── eslint/
│       ├── typescript/
│       └── package.json
├── tooling/
│   └── scripts/                    # Build and deployment scripts
├── turbo.json                      # Turborepo configuration
├── pnpm-workspace.yaml             # pnpm workspace definition
├── tsconfig.base.json              # Shared TypeScript config
└── package.json                    # Root package.json
```

## Key Conventions

### Barrel Exports

Use `index.ts` files to control the public API of each module:

```typescript
// src/modules/auth/index.ts
export { AuthService } from './auth.service';
export { AuthController } from './auth.controller';
export type { AuthPayload, TokenPair } from './auth.types';
```

### Path Aliases

Configure path aliases in `tsconfig.json` for cleaner imports:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@/modules/*": ["./src/modules/*"],
      "@/shared/*": ["./src/shared/*"],
      "@/lib/*": ["./src/lib/*"]
    }
  }
}
```

Usage:

```typescript
import { AuthService } from '@/modules/auth';
import { logger } from '@/lib/logger';
```

### File Naming

- Use **kebab-case** for file names: `user-service.ts`, `create-user.dto.ts`
- Suffix files by role: `.controller.ts`, `.service.ts`, `.repository.ts`, `.types.ts`, `.test.ts`
- Colocate tests: `__tests__/user.service.test.ts` next to `user.service.ts`

## Module Boundaries

| Layer | Imports From | Never Imports From |
|-------|-------------|-------------------|
| Controllers / Routes | Services, Schemas/DTOs | Repositories, Database directly |
| Services | Repositories, Types, External libs | Controllers, Routes |
| Repositories | Database client, Types | Services, Controllers |
| Schemas / DTOs | (standalone, may import types) | Services, Repositories |
