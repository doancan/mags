---
title: "{{project_name}}: Documentation Index"
version: "1.0"
last_updated: {{date}}
---

# {{project_name}} — Doküman Haritası

## Doküman Durumları

| Durum | Anlamı |
|---|---|
| `LOCKED` | Kesinleşmiş, değişiklik için onay gerekir |
| `DRAFT` | Taslak, aktif olarak güncelleniyor |
| `REVIEW` | İnceleme bekliyor |

---

## Dokümanlar

| Doküman | Açıklama | Durum |
|---|---|---|
| [Vision](./vision.md) | Vizyon ve strateji | `DRAFT` |
| [Discovery](./discovery.md) | Problem tanımı ve araştırma | `DRAFT` |
| [PRD](./prd.md) | Ürün gereksinimleri | `DRAFT` |
| [Tech Stack](./tech-stack.md) | Teknoloji seçimleri | `DRAFT` |
| [Data Model](./data-model.md) | Veritabanı şeması | `DRAFT` |
| [API Design](./api-design.md) | API tasarımı | `DRAFT` |

---

## Doküman Kuralları

1. Her dokümanın YAML frontmatter'ı olmalı.
2. `LOCKED` dokümanlar tek taraflı değiştirilemez.
3. Kod değişikliği doküman değişikliği gerektirebilir.
