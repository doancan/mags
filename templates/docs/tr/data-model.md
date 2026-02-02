---
title: "{{project_name}}: Data Model"
version: v1.0
status: DRAFT
author: {{author}}
last_updated: {{date}}
tags: [architecture, database, schema]
---

# {{project_name}} — Data Model

## ER Diyagramı

```
[Table1] 1──N [Table2] N──1 [Table3]
```

## Tablolar

### table_name

| Kolon | Tip | Açıklama | Kısıtlar |
|-------|-----|----------|----------|
| id | UUID | Primary key | PK, DEFAULT uuid_generate_v4() |
| created_at | TIMESTAMP | Oluşturulma tarihi | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMP | Güncellenme tarihi | NOT NULL, DEFAULT NOW() |

**İndeksler:**
- `idx_table_name_created`: (created_at DESC)

**İlişkiler:**
-

---

## İndeks Stratejisi

| Tip | Kural |
|-----|-------|
| Zorunlu | Her tabloda created_at indeksi |
| Composite | Sık kullanılan filtrelerde |
| Partial | Soft delete: WHERE deleted_at IS NULL |

## Migration Stratejisi

- Her schema değişikliği migration dosyası ile
- Geri alınabilir (rollback) migration'lar
- Seed data ayrı dosyada
