// ============================================
// MAGS — Search Engine
// Unified search across docs and memory
// ============================================

import type { DocIndexer } from "./doc-indexer.js";
import type { MemoryStore } from "./memory-store.js";
import type { DocSearchResult, ScoredMemory } from "../types/index.js";

export interface UnifiedSearchResult {
  type: "doc" | "memory";
  source: string;
  title: string;
  snippet: string;
  score: number;
}

export class SearchEngine {
  constructor(
    private docIndexer: DocIndexer,
    private memoryStore: MemoryStore
  ) {}

  /**
   * Search across both docs and memory
   */
  async search(
    query: string,
    limit = 10,
    scope?: "docs" | "memory" | "all"
  ): Promise<UnifiedSearchResult[]> {
    const results: UnifiedSearchResult[] = [];
    const effectiveScope = scope ?? "all";

    if (effectiveScope === "all" || effectiveScope === "docs") {
      const docResults = this.docIndexer.search(query, limit);
      for (const r of docResults) {
        results.push({
          type: "doc",
          source: r.doc,
          title: r.section,
          snippet: r.snippet,
          score: r.score,
        });
      }
    }

    if (effectiveScope === "all" || effectiveScope === "memory") {
      const memResults = await this.memoryStore.recall(query, undefined, limit);
      for (const r of memResults) {
        results.push({
          type: "memory",
          source: r.key,
          title: r.category ?? "note",
          snippet: r.value.slice(0, 300),
          score: r.score,
        });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}
