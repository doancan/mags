// ============================================
// MAGS — Memory Store
// Key-value memory with semantic search support
// ============================================

import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import YAML from "yaml";
import type {
  MemoryEntry,
  ScoredMemory,
  EmbeddingProvider,
} from "../types/index.js";
import { MAX_MEMORY_ENTRIES } from "../config/defaults.js";

export class MemoryStore {
  private entries: Map<string, MemoryEntry> = new Map();
  private memoryDir: string;
  private entriesDir: string;
  private embeddingProvider: EmbeddingProvider | null = null;

  constructor(magsDir: string) {
    this.memoryDir = join(magsDir, "memory");
    this.entriesDir = join(this.memoryDir, "entries");
  }

  setEmbeddingProvider(provider: EmbeddingProvider): void {
    this.embeddingProvider = provider;
  }

  /**
   * Load all memory entries from disk
   */
  load(): void {
    this.entries.clear();

    if (!existsSync(this.entriesDir)) {
      mkdirSync(this.entriesDir, { recursive: true });
      return;
    }

    const files = readdirSync(this.entriesDir).filter((f) =>
      f.endsWith(".yaml")
    );

    for (const file of files) {
      try {
        const raw = readFileSync(join(this.entriesDir, file), "utf-8");
        const entry = YAML.parse(raw) as MemoryEntry;
        if (entry.id && entry.key) {
          this.entries.set(entry.key, entry);
        }
      } catch {
        // Skip corrupted entries
      }
    }
  }

  /**
   * Store a memory entry
   */
  async remember(
    key: string,
    value: string,
    category?: string,
    tags: string[] = []
  ): Promise<MemoryEntry> {
    if (this.entries.size >= MAX_MEMORY_ENTRIES && !this.entries.has(key)) {
      throw new Error(
        `Memory limit reached (${MAX_MEMORY_ENTRIES}). Remove some entries first.`
      );
    }

    const existing = this.entries.get(key);
    const now = new Date().toISOString();

    const entry: MemoryEntry = {
      id: existing?.id ?? randomUUID(),
      key,
      value,
      category: category ?? existing?.category,
      tags: tags.length > 0 ? tags : existing?.tags ?? [],
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    // Generate embedding if provider available
    if (this.embeddingProvider) {
      entry.embedding = await this.embeddingProvider.embed(
        `${key}: ${value}`
      );
    }

    this.entries.set(key, entry);
    this.saveEntry(entry);

    return entry;
  }

  /**
   * Recall memories by query (semantic or keyword search)
   */
  async recall(
    query: string,
    category?: string,
    limit = 10
  ): Promise<ScoredMemory[]> {
    let candidates = Array.from(this.entries.values());

    // Filter by category if specified
    if (category) {
      candidates = candidates.filter((e) => e.category === category);
    }

    // If query is empty, return all candidates (category-only filter)
    if (!query || query.trim().length === 0) {
      return candidates
        .slice(0, limit)
        .map((e) => ({ ...e, score: 1 }));
    }

    // Use embedding search if available
    if (this.embeddingProvider && candidates.some((e) => e.embedding)) {
      return this.embeddingProvider.search(query, candidates, limit);
    }

    // Fallback: keyword-based scoring
    return this.keywordSearch(query, candidates, limit);
  }

  /**
   * Delete a memory entry
   */
  forget(key: string): boolean {
    const entry = this.entries.get(key);
    if (!entry) return false;

    this.entries.delete(key);
    const filePath = join(this.entriesDir, `${entry.id}.yaml`);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
    return true;
  }

  /**
   * Get all entries (for export/debug)
   */
  getAll(): MemoryEntry[] {
    return Array.from(this.entries.values());
  }

  /**
   * Get entry by key
   */
  get(key: string): MemoryEntry | undefined {
    return this.entries.get(key);
  }

  // --- Private ---

  private saveEntry(entry: MemoryEntry): void {
    if (!existsSync(this.entriesDir)) {
      mkdirSync(this.entriesDir, { recursive: true });
    }

    // Don't persist embeddings to YAML (too large)
    const toSave = { ...entry };
    delete toSave.embedding;

    writeFileSync(
      join(this.entriesDir, `${entry.id}.yaml`),
      YAML.stringify(toSave),
      "utf-8"
    );
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
