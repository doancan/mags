---
title: "{{project_name}}: Data Model"
version: "1.0"
status: draft
author: {{author}}
last_updated: {{date}}
tags: [architecture, database, schema]
---

# {{project_name}} — Data Model

## ER Diagram

```
[Table1] 1──N [Table2] N──1 [Table3]
```

## Tables

### table_name

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| id | UUID | Primary key | PK, DEFAULT uuid_generate_v4() |
| created_at | TIMESTAMP | Created date | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMP | Updated date | NOT NULL, DEFAULT NOW() |

**Indexes:**
- `idx_table_name_created`: (created_at DESC)

**Relations:**
-

---

## Index Strategy

| Type | Rule |
|------|------|
| Required | created_at index on every table |
| Composite | Frequently used filter combinations |
| Partial | Soft delete: WHERE deleted_at IS NULL |

## Migration Strategy

- Every schema change via migration file
- Reversible (rollback) migrations
- Seed data in separate files
