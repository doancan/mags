---
title: "{{project_name}}: Project Structure"
version: v1.0
status: DRAFT
author: {{author}}
last_updated: {{date}}
tags: [architecture, structure]
---

# {{project_name}} — Project Structure

## General Layout

```
{{project_name}}/
├── src/                    → Source code
├── tests/                  → Test files
├── docs/                   → Documentation
├── config/                 → Configuration
└── package.json
```

## Source Organization

```
src/
├── modules/
│   └── [module-name]/
│       ├── module.ts
│       ├── controller.ts
│       ├── service.ts
│       └── dto/
├── common/
│   ├── guards/
│   ├── decorators/
│   └── filters/
└── config/
```

## Coding Rules

### Backend
1. Controller → Service → Repository layer separation
2. Validation on every endpoint (DTO + schema)
3. Proper error handling

### Frontend
1. Data fetching: Query library (no useEffect fetch)
2. Forms: Form library + validation
3. Every screen: loading, error, empty state
