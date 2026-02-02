// ============================================
// MAGS — OpenAI Embedding Provider
// Real semantic search using OpenAI embeddings
// ============================================

import type { EmbeddingProvider, MemoryEntry, ScoredMemory } from "../../types/index.js";

/**
 * OpenAI embedding provider for semantic search.
 * Requires OPENAI_API_KEY or config in .mags.yaml
 */
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = "text-embedding-3-small") {
    this.apiKey = apiKey;
    this.model = model;
  }

  async embed(text: string): Promise<number[]> {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: text,
        model: this.model,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `OpenAI API error: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as {
      data: Array<{ embedding: number[] }>;
    };

    return data.data[0].embedding;
  }

  async search(
    query: string,
    entries: MemoryEntry[],
    limit = 10
  ): Promise<ScoredMemory[]> {
    const queryEmbedding = await this.embed(query);

    const scored: ScoredMemory[] = entries
      .filter((e) => e.embedding && e.embedding.length > 0)
      .map((entry) => {
        const score = cosineSimilarity(queryEmbedding, entry.embedding!);
        return { ...entry, score };
      });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;

  return dotProduct / magnitude;
}
