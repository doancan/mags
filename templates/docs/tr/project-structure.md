---
title: "{{project_name}}: Project Structure"
version: "1.0"
status: draft
author: {{author}}
last_updated: {{date}}
tags: [architecture, structure, monorepo]
---

# {{project_name}} — Proje Yapısı

## Genel Yapı

```
{{project_name}}/
├── apps/
│   ├── web/                 → Frontend
│   └── api/                 → Backend
├── packages/
│   ├── shared/              → Ortak tipler ve sabitler
│   └── config/              → Paylaşılan konfigürasyon
├── docs/                    → Dokümanlar
└── package.json
```

## Backend Modülleri

```
apps/api/src/
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

## Frontend Yapısı

```
apps/web/src/
├── routes/
├── components/
├── hooks/
├── api/
├── stores/
└── lib/
```

## Kodlama Kuralları

### Backend
1. Controller → Service → Repository katman ayrımı
2. Her endpoint'te validation (DTO + Zod)
3. Tenant isolation zorunlu

### Frontend
1. Data fetching: Query library (useEffect ile fetch yasak)
2. Form: Form library + validation
3. Her ekranda: loading, error, empty state
