// ============================================
// MAGS — Local Embedding Provider
// TF-IDF + BM25 based search (no API required)
// ============================================

import type { EmbeddingProvider, MemoryEntry, ScoredMemory } from "../../types/index.js";

/**
 * Local embedding provider using TF-IDF scoring.
 * No external API required — works completely offline.
 */
export class LocalEmbeddingProvider implements EmbeddingProvider {
  private idfCache: Map<string, number> = new Map();

  /**
   * Generate a pseudo-embedding using term frequencies.
   * Not a real embedding, but sufficient for keyword-based search.
   */
  async embed(text: string): Promise<number[]> {
    // For local provider, we don't generate real embeddings.
    // Search is done via BM25 scoring at query time.
    const terms = this.tokenize(text);
    const tf = new Map<string, number>();

    for (const term of terms) {
      tf.set(term, (tf.get(term) ?? 0) + 1);
    }

    // Return empty — local search uses BM25 directly
    return [];
  }

  /**
   * Search using BM25 scoring algorithm
   */
  async search(
    query: string,
    entries: MemoryEntry[],
    limit = 10
  ): Promise<ScoredMemory[]> {
    const queryTerms = this.tokenize(query);

    if (queryTerms.length === 0 || entries.length === 0) {
      return [];
    }

    // Build IDF for query terms
    this.buildIDF(queryTerms, entries);

    // BM25 parameters
    const k1 = 1.2;
    const b = 0.75;

    // Calculate average document length
    const avgDl =
      entries.reduce(
        (sum, e) => sum + this.tokenize(`${e.key} ${e.value}`).length,
        0
      ) / entries.length;

    const scored: ScoredMemory[] = entries.map((entry) => {
      const docText = `${entry.key} ${entry.value} ${entry.tags.join(" ")}`;
      const docTerms = this.tokenize(docText);
      const dl = docTerms.length;

      // Term frequency in document
      const tf = new Map<string, number>();
      for (const term of docTerms) {
        tf.set(term, (tf.get(term) ?? 0) + 1);
      }

      let score = 0;
      for (const queryTerm of queryTerms) {
        const termFreq = tf.get(queryTerm) ?? 0;
        const idf = this.idfCache.get(queryTerm) ?? 0;

        // BM25 formula
        const numerator = termFreq * (k1 + 1);
        const denominator = termFreq + k1 * (1 - b + b * (dl / avgDl));

        score += idf * (numerator / denominator);
      }

      // Boost exact key matches
      if (entry.key.toLowerCase().includes(query.toLowerCase())) {
        score *= 2;
      }

      return { ...entry, score };
    });

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  // --- Private ---

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\sğüşıöçĞÜŞİÖÇ]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1);
  }

  private buildIDF(queryTerms: string[], entries: MemoryEntry[]): void {
    const n = entries.length;

    for (const term of queryTerms) {
      if (this.idfCache.has(term)) continue;

      const df = entries.filter((e) => {
        const text = `${e.key} ${e.value} ${e.tags.join(" ")}`.toLowerCase();
        return text.includes(term);
      }).length;

      // IDF with smoothing
      const idf = Math.log((n - df + 0.5) / (df + 0.5) + 1);
      this.idfCache.set(term, idf);
    }
  }
}
