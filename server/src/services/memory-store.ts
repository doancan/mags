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
import { MAX_MEMORY_ENTRIES, MEMORY_WARNING_THRESHOLD } from "../config/defaults.js";

export interface CapacityInfo {
  total: number;
  used: number;
  available: number;
  usagePercent: number;
}

export interface RememberResult {
  entry: MemoryEntry;
  isUpdate: boolean;
  totalEntries: number;
  capacityPercent: number;
  warning?: string;
  pruned?: number;
  similarKeys?: string[];
}

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
  private closed = false;

  // Prepared statements
  private stmtUpsert!: Database.Statement;
  private stmtGet!: Database.Statement;
  private stmtGetAll!: Database.Statement;
  private stmtDelete!: Database.Statement;
  private stmtCount!: Database.Statement;
  private stmtGetByCategory!: Database.Statement;
  private stmtGetByCategoryLimited!: Database.Statement;
  private stmtGetAllLimited!: Database.Statement;
  private stmtPruneOldest!: Database.Statement;
  private stmtSimilarKeys!: Database.Statement;

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
    this.stmtGetByCategoryLimited = this.db.prepare("SELECT * FROM memories WHERE category = ? ORDER BY updated_at DESC LIMIT ?");
    this.stmtGetAllLimited = this.db.prepare("SELECT * FROM memories ORDER BY updated_at DESC LIMIT ?");
    this.stmtPruneOldest = this.db.prepare("DELETE FROM memories WHERE key IN (SELECT key FROM memories ORDER BY updated_at ASC LIMIT ?)");
    this.stmtSimilarKeys = this.db.prepare("SELECT key FROM memories WHERE category = ? AND key != ? AND key LIKE ? ESCAPE '\\' LIMIT 5");
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
   * Get capacity information
   */
  getCapacity(): CapacityInfo {
    this.ensureOpen();
    const { count } = this.stmtCount.get() as { count: number };
    return {
      total: MAX_MEMORY_ENTRIES,
      used: count,
      available: MAX_MEMORY_ENTRIES - count,
      usagePercent: Math.round((count / MAX_MEMORY_ENTRIES) * 100),
    };
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
   * Returns enriched result with capacity info, update status, and similar keys.
   */
  async remember(
    key: string,
    value: string,
    category?: string,
    tags: string[] = [],
    metadata?: Record<string, unknown>
  ): Promise<RememberResult> {
    this.ensureOpen();
    // Atomic transaction: check limit + upsert + prune if needed
    const result = this.db.transaction(() => {
      const row = this.stmtGet.get(key) as MemoryRow | undefined;
      const existing = row ? this.rowToEntry(row) : undefined;
      const isUpdate = !!existing;
      let pruned = 0;

      if (!existing) {
        const { count } = this.stmtCount.get() as { count: number };
        if (count >= MAX_MEMORY_ENTRIES) {
          // Auto-prune: remove oldest entry instead of hard error
          this.pruneOldest(1);
          pruned = 1;
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

      const entry: MemoryEntry = {
        id,
        key,
        value,
        category: resolvedCategory ?? undefined,
        tags: resolvedTags,
        metadata: Object.keys(resolvedMetadata).length > 0 ? resolvedMetadata : undefined,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };

      // Check capacity after upsert
      const { count: totalEntries } = this.stmtCount.get() as { count: number };
      const capacityPercent = Math.round((totalEntries / MAX_MEMORY_ENTRIES) * 100);
      const warning = (totalEntries / MAX_MEMORY_ENTRIES) >= MEMORY_WARNING_THRESHOLD
        ? `Memory usage at ${capacityPercent}% (${totalEntries}/${MAX_MEMORY_ENTRIES}). Consider removing unused entries.`
        : undefined;

      // Find similar keys in same category
      let similarKeys: string[] | undefined;
      if (resolvedCategory) {
        const keyParts = key.split("_");
        const keyPrefix = keyParts.length > 1 ? keyParts[0] : key;
        // Escape LIKE wildcards (% and _) in the prefix to prevent pattern injection
        const escapedPrefix = keyPrefix.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
        const similarRows = this.stmtSimilarKeys.all(resolvedCategory, key, `${escapedPrefix}%`) as { key: string }[];
        if (similarRows.length > 0) {
          similarKeys = similarRows.map((r) => r.key);
        }
      }

      return { entry, isUpdate, totalEntries, capacityPercent, warning, pruned: pruned > 0 ? pruned : undefined, similarKeys };
    })();

    // Generate embedding outside transaction (async, not persisted)
    if (this.embeddingProvider) {
      result.entry.embedding = await this.embeddingProvider.embed(`${key}: ${value}`);
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
    this.ensureOpen();
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
    this.ensureOpen();
    const result = this.stmtDelete.run(key);
    return result.changes > 0;
  }

  /**
   * Get all entries
   */
  getAll(): MemoryEntry[] {
    this.ensureOpen();
    const rows = this.stmtGetAll.all() as MemoryRow[];
    return rows.map((r) => this.rowToEntry(r));
  }

  /**
   * Get entry by key
   */
  get(key: string): MemoryEntry | undefined {
    this.ensureOpen();
    const row = this.stmtGet.get(key) as MemoryRow | undefined;
    if (!row) return undefined;
    return this.rowToEntry(row);
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.db.close();
  }

  private ensureOpen(): void {
    if (this.closed) {
      throw new Error("MemoryStore is closed");
    }
  }

  // --- Private ---

  private pruneOldest(count: number): void {
    this.stmtPruneOldest.run(count);
  }

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

    const now = Date.now();

    const scored: ScoredMemory[] = candidates.map((entry) => {
      const metadataStr = entry.metadata ? JSON.stringify(entry.metadata) : "";
      const text = `${entry.key} ${entry.value} ${entry.category ?? ""} ${entry.tags.join(" ")} ${metadataStr}`.toLowerCase();
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

      // Apply temporal decay: 1% per day (capped at 1.0, NaN-safe)
      const updatedMs = new Date(entry.updatedAt).getTime();
      const daysSinceUpdate = isNaN(updatedMs) ? 0 : Math.max(0, (now - updatedMs) / (1000 * 60 * 60 * 24));
      const decayFactor = 1 / (1 + daysSinceUpdate * 0.01);

      return { ...entry, score: (score / queryTerms.length) * decayFactor };
    });

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}
