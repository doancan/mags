// ============================================
// MAGS — Default Constants
// ============================================

import type { ModuleDefinition, FrontmatterSchema } from "../types/index.js";

export const SUPPORTED_DOC_EXTENSIONS = [".md", ".mdx", ".rst", ".adoc"] as const;

export const DEFAULT_QUERY_LIMIT = 10;

export const MAX_MEMORY_ENTRIES = 1000;

export const MEMORY_WARNING_THRESHOLD = 0.8;

export const DEFAULT_LOCALE = "en";

export const FRONTMATTER_SCHEMAS: Record<string, FrontmatterSchema> = {
  adr: {
    required: ["title", "status", "last_updated"],
    status_values: ["accepted", "superseded", "deprecated", "proposed"],
  },
  default: {
    required: ["title"],
  },
};

export const DEFAULT_MODULES: ModuleDefinition[] = [
  { name: "auth", aliases: ["auth", "authentication", "login", "register", "jwt", "session"] },
  { name: "crm", aliases: ["crm", "customer", "proposal"] },
  { name: "pms", aliases: ["pms", "project", "task"] },
  { name: "feedback", aliases: ["feedback", "comment", "annotation"] },
  { name: "notification", aliases: ["notification"] },
  { name: "rbac", aliases: ["rbac", "role", "permission"] },
  { name: "workspace", aliases: ["workspace"] },
  { name: "tenant", aliases: ["tenant"] },
  { name: "report", aliases: ["report"] },
  { name: "storage", aliases: ["storage", "upload", "file"] },
  { name: "dashboard", aliases: ["dashboard", "panel", "widget"] },
  { name: "infrastructure", aliases: ["infrastructure", "infra", "turborepo", "monorepo", "docker"] },
  { name: "platform", aliases: ["platform", "i18n", "responsive", "multi-tenant"] },
];
