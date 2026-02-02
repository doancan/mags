// ============================================
// MAGS — Memory Store
// SQLite-backed key-value memory with semantic search
// ============================================

import { existsSync, readdirSync, readFileSync, renameSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import YAML from "yaml";
import type {
  MemoryEntry,
  ScoredMemory,
  EmbeddingProvider,
} from "../types/index.js";
import { MAX_MEMORY_ENTRIES } from "../config/defaults.js";

interface MemoryRow {
  id: string;
  key: string;
  value: string;
  category: string | null;
  tags: string;
  metadata: string;
  created_at: string;
  updated_at: string;
}

export class MemoryStore {
  private db: Database.Database;
  private embeddingProvider: EmbeddingProvider | null = null;
  private memoryDir: string;

  // Prepared statements
  private stmtUpsert!: Database.Statement;
  private stmtGet!: Database.Statement;
  private stmtGetAll!: Database.Statement;
  private stmtDelete!: Database.Statement;
  private stmtCount!: Database.Statement;
  private stmtGetByCategory!: Database.Statement;
  private stmtGetByCategoryLimited!: Database.Statement;
  private stmtGetAllLimited!: Database.Statement;

  constructor(magsDir: string) {
    this.memoryDir = join(magsDir, "memory");

    if (!existsSync(this.memoryDir)) {
      mkdirSync(this.memoryDir, { recursive: true });
    }

    const dbPath = join(this.memoryDir, "memories.db");
    this.db = new Database(dbPath);

    this.initSchema();
    this.prepareStatements();
    this.migrateFromYaml();
  }

  private initSchema(): void {
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id          TEXT PRIMARY KEY,
        key         TEXT UNIQUE NOT NULL,
        value       TEXT NOT NULL,
        category    TEXT,
        tags        TEXT NOT NULL DEFAULT '[]',
        metadata    TEXT NOT NULL DEFAULT '{}',
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category);
    `);
  }

  private prepareStatements(): void {
    this.stmtUpsert = this.db.prepare(`
      INSERT INTO memories (id, key, value, category, tags, metadata, created_at, updated_at)
      VALUES (@id, @key, @value, @category, @tags, @metadata, @created_at, @updated_at)
      ON CONFLICT(key) DO UPDATE SET
        value = @value,
        category = @category,
        tags = @tags,
        metadata = @metadata,
        updated_at = @updated_at
    `);

    this.stmtGet = this.db.prepare("SELECT * FROM memories WHERE key = ?");
    this.stmtGetAll = this.db.prepare("SELECT * FROM memories");
    this.stmtDelete = this.db.prepare("DELETE FROM memories WHERE key = ?");
    this.stmtCount = this.db.prepare("SELECT COUNT(*) as count FROM memories");
    this.stmtGetByCategory = this.db.prepare("SELECT * FROM memories WHERE category = ?");
    this.stmtGetByCategoryLimited = this.db.prepare("SELECT * FROM memories WHERE category = ? LIMIT ?");
    this.stmtGetAllLimited = this.db.prepare("SELECT * FROM memories LIMIT ?");
  }

  private migrateFromYaml(): void {
    const entriesDir = join(this.memoryDir, "entries");
    if (!existsSync(entriesDir)) return;

    const files = readdirSync(entriesDir).filter((f) => f.endsWith(".yaml"));
    if (files.length === 0) return;

    // Only migrate if DB is empty (first time)
    const { count } = this.stmtCount.get() as { count: number };
    if (count > 0) return;

    try {
      const insertMany = this.db.transaction((entries: MemoryRow[]) => {
        for (const entry of entries) {
          this.stmtUpsert.run(entry);
        }
      });

      const rows: MemoryRow[] = [];
      for (const file of files) {
        try {
          const raw = readFileSync(join(entriesDir, file), "utf-8");
          const parsed = YAML.parse(raw);
          if (!parsed?.id || !parsed?.key) continue;

          rows.push({
            id: parsed.id,
            key: parsed.key,
            value: parsed.value ?? "",
            category: parsed.category ?? null,
            tags: JSON.stringify(parsed.tags ?? []),
            metadata: JSON.stringify(parsed.metadata ?? {}),
            created_at: parsed.createdAt ?? new Date().toISOString(),
            updated_at: parsed.updatedAt ?? new Date().toISOString(),
          });
        } catch {
          // Skip corrupted YAML files
        }
      }

      if (rows.length > 0) {
        insertMany(rows);
      }

      // Rename entries dir to entries.bak
      const backupDir = join(this.memoryDir, "entries.bak");
      if (!existsSync(backupDir)) {
        renameSync(entriesDir, backupDir);
      }
    } catch (err) {
      console.error("MAGS: YAML migration failed, continuing with SQLite:", err);
    }
  }

  setEmbeddingProvider(provider: EmbeddingProvider): void {
    this.embeddingProvider = provider;
  }

  /**
   * No-op for backward compatibility (constructor handles init)
   */
  load(): void {
    // no-op — SQLite is initialized in constructor
  }

  /**
   * Store a memory entry.
   * Uses a SQLite transaction to atomically check the limit and upsert.
   */
  async remember(
    key: string,
    value: string,
    category?: string,
    tags: string[] = [],
    metadata?: Record<string, unknown>
  ): Promise<MemoryEntry> {
    // Atomic transaction: check limit + upsert
    const result = this.db.transaction(() => {
      const row = this.stmtGet.get(key) as MemoryRow | undefined;
      const existing = row ? this.rowToEntry(row) : undefined;

      if (!existing) {
        const { count } = this.stmtCount.get() as { count: number };
        if (count >= MAX_MEMORY_ENTRIES) {
          throw new Error(
            `Memory limit reached (${MAX_MEMORY_ENTRIES}). Remove some entries first.`
          );
        }
      }

      const now = new Date().toISOString();
      const id = existing?.id ?? randomUUID();
      const resolvedTags = tags.length > 0 ? tags : existing?.tags ?? [];
      const resolvedCategory = category ?? existing?.category ?? null;
      const resolvedMetadata = metadata ?? existing?.metadata ?? {};

      this.stmtUpsert.run({
        id,
        key,
        value,
        category: resolvedCategory ?? null,
        tags: JSON.stringify(resolvedTags),
        metadata: JSON.stringify(resolvedMetadata),
        created_at: existing?.createdAt ?? now,
        updated_at: now,
      });

      return {
        id,
        key,
        value,
        category: resolvedCategory ?? undefined,
        tags: resolvedTags,
        metadata: Object.keys(resolvedMetadata).length > 0 ? resolvedMetadata : undefined,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      } as MemoryEntry;
    })();

    // Generate embedding outside transaction (async, not persisted)
    if (this.embeddingProvider) {
      result.embedding = await this.embeddingProvider.embed(`${key}: ${value}`);
    }

    return result;
  }

  /**
   * Recall memories by query (semantic or keyword search)
   */
  async recall(
    query: string,
    category?: string,
    limit = 10
  ): Promise<ScoredMemory[]> {
    // If query is empty, use SQL LIMIT directly (fast path)
    if (!query || query.trim().length === 0) {
      let rows: MemoryRow[];
      if (category) {
        rows = this.stmtGetByCategoryLimited.all(category, limit) as MemoryRow[];
      } else {
        rows = this.stmtGetAllLimited.all(limit) as MemoryRow[];
      }
      return rows.map((r) => ({ ...this.rowToEntry(r), score: 1 }));
    }

    // Load candidates for search
    let candidates: MemoryEntry[];
    if (category) {
      const rows = this.stmtGetByCategory.all(category) as MemoryRow[];
      candidates = rows.map((r) => this.rowToEntry(r));
    } else {
      candidates = this.getAll();
    }

    // Use embedding search if provider available
    if (this.embeddingProvider) {
      for (const c of candidates) {
        if (!c.embedding) {
          c.embedding = await this.embeddingProvider.embed(`${c.key}: ${c.value}`);
        }
      }
      return this.embeddingProvider.search(query, candidates, limit);
    }

    // Fallback: keyword-based scoring
    return this.keywordSearch(query, candidates, limit);
  }

  /**
   * Delete a memory entry
   */
  forget(key: string): boolean {
    const result = this.stmtDelete.run(key);
    return result.changes > 0;
  }

  /**
   * Get all entries
   */
  getAll(): MemoryEntry[] {
    const rows = this.stmtGetAll.all() as MemoryRow[];
    return rows.map((r) => this.rowToEntry(r));
  }

  /**
   * Get entry by key
   */
  get(key: string): MemoryEntry | undefined {
    const row = this.stmtGet.get(key) as MemoryRow | undefined;
    if (!row) return undefined;
    return this.rowToEntry(row);
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }

  // --- Private ---

  private rowToEntry(row: MemoryRow): MemoryEntry {
    let tags: string[] = [];
    try {
      tags = JSON.parse(row.tags);
    } catch {
      tags = [];
    }

    let metadata: Record<string, unknown> | undefined;
    try {
      const parsed = JSON.parse(row.metadata);
      if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
        metadata = parsed;
      }
    } catch {
      metadata = undefined;
    }

    return {
      id: row.id,
      key: row.key,
      value: row.value,
      category: row.category ?? undefined,
      tags,
      metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private keywordSearch(
    query: string,
    candidates: MemoryEntry[],
    limit: number
  ): ScoredMemory[] {
    const queryTerms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 1);

    if (queryTerms.length === 0) return [];

    const scored: ScoredMemory[] = candidates.map((entry) => {
      const text = `${entry.key} ${entry.value} ${entry.category ?? ""} ${entry.tags.join(" ")}`.toLowerCase();
      let score = 0;

      for (const term of queryTerms) {
        if (text.includes(term)) {
          score += 1;
          // Boost exact key match
          if (entry.key.toLowerCase().includes(term)) score += 2;
          // Boost tag match
          if (entry.tags.some((t) => t.toLowerCase().includes(term)))
            score += 1;
        }
      }

      return { ...entry, score: score / queryTerms.length };
    });

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}
