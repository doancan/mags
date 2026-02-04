import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OpenAIEmbeddingProvider } from "./openai.js";
import type { MemoryEntry } from "../../types/index.js";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function makeEntry(
  key: string,
  value: string,
  embedding?: number[],
  tags: string[] = []
): MemoryEntry {
  return {
    id: `id-${key}`,
    key,
    value,
    tags,
    embedding,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  };
}

describe("OpenAIEmbeddingProvider", () => {
  const mockApiKey = "test-api-key";
  let provider: OpenAIEmbeddingProvider;

  beforeEach(() => {
    provider = new OpenAIEmbeddingProvider(mockApiKey);
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Constructor ────────────────────────────────

  describe("constructor", () => {
    it("varsayılan model text-embedding-3-small olmalı", () => {
      const p = new OpenAIEmbeddingProvider("key");
      // Internal state test etmek için embed çağırıp body'yi kontrol ediyoruz
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [{ embedding: [0.1] }] }),
      });

      p.embed("test");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.openai.com/v1/embeddings",
        expect.objectContaining({
          body: expect.stringContaining("text-embedding-3-small"),
        })
      );
    });

    it("özel model kullanılabilir", () => {
      const customProvider = new OpenAIEmbeddingProvider("key", "text-embedding-ada-002");
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [{ embedding: [0.1] }] }),
      });

      customProvider.embed("test");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining("text-embedding-ada-002"),
        })
      );
    });
  });

  // ── embed ────────────────────────────────

  describe("embed", () => {
    it("OpenAI API'yi doğru parametrelerle çağırmalı", async () => {
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [{ embedding: mockEmbedding }] }),
      });

      const result = await provider.embed("test text");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.openai.com/v1/embeddings",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer test-api-key",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            input: "test text",
            model: "text-embedding-3-small",
          }),
        }
      );

      expect(result).toEqual(mockEmbedding);
    });

    it("API 401 hatası fırlatmalı", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      });

      await expect(provider.embed("test")).rejects.toThrow(
        "OpenAI API error: 401 Unauthorized"
      );
    });

    it("API 429 rate limit hatası fırlatmalı", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
      });

      await expect(provider.embed("test")).rejects.toThrow(
        "OpenAI API error: 429 Too Many Requests"
      );
    });

    it("API 500 server hatası fırlatmalı", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      await expect(provider.embed("test")).rejects.toThrow(
        "OpenAI API error: 500 Internal Server Error"
      );
    });
  });

  // ── search ────────────────────────────────

  describe("search", () => {
    it("skorlanmış sonuçları döndürmeli (yüksek benzerlik önce)", async () => {
      // Query embedding - [1, 0, 0] birim vektör
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [{ embedding: [1, 0, 0] }] }),
      });

      const entries = [
        makeEntry("high", "high similarity", [1, 0, 0]), // cosine sim = 1
        makeEntry("low", "low similarity", [0, 1, 0]), // cosine sim = 0
        makeEntry("medium", "medium similarity", [0.7, 0.7, 0]), // cosine sim ≈ 0.7
      ];

      const results = await provider.search("query", entries);

      expect(results.length).toBe(3);
      expect(results[0].key).toBe("high");
      expect(results[0].score).toBeCloseTo(1, 5);
      expect(results[1].key).toBe("medium");
      expect(results[2].key).toBe("low");
      expect(results[2].score).toBeCloseTo(0, 5);
    });

    it("embedding olmayan entryleri filtrelemeli", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [{ embedding: [1, 0, 0] }] }),
      });

      const entries = [
        makeEntry("with_embed", "has embedding", [1, 0, 0]),
        makeEntry("no_embed", "no embedding"), // embedding yok
        makeEntry("empty_embed", "empty embedding", []), // boş dizi
      ];

      const results = await provider.search("query", entries);

      expect(results.length).toBe(1);
      expect(results[0].key).toBe("with_embed");
    });

    it("limit parametresi çalışmalı", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [{ embedding: [1, 0, 0] }] }),
      });

      const entries = [
        makeEntry("a", "entry a", [1, 0, 0]),
        makeEntry("b", "entry b", [0.9, 0.1, 0]),
        makeEntry("c", "entry c", [0.8, 0.2, 0]),
        makeEntry("d", "entry d", [0.7, 0.3, 0]),
        makeEntry("e", "entry e", [0.6, 0.4, 0]),
      ];

      const results = await provider.search("query", entries, 2);

      expect(results.length).toBe(2);
      expect(results[0].key).toBe("a");
      expect(results[1].key).toBe("b");
    });

    it("boş entries listesi boş döndürmeli", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [{ embedding: [1, 0, 0] }] }),
      });

      const results = await provider.search("query", []);

      expect(results).toEqual([]);
    });

    it("varsayılan limit 10 olmalı", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [{ embedding: [1, 0, 0] }] }),
      });

      // 15 entry oluştur
      const entries = Array.from({ length: 15 }, (_, i) =>
        makeEntry(`entry-${i}`, `entry ${i}`, [1 - i * 0.01, i * 0.01, 0])
      );

      const results = await provider.search("query", entries);

      expect(results.length).toBe(10);
    });
  });

  // ── Cosine Similarity (internal function davranışı) ────────────

  describe("cosine similarity hesaplama", () => {
    it("aynı vektörler için 1 döndürmeli", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [{ embedding: [1, 0, 0] }] }),
      });

      const entries = [makeEntry("same", "same vector", [1, 0, 0])];
      const results = await provider.search("query", entries);

      expect(results[0].score).toBeCloseTo(1, 5);
    });

    it("ortogonal vektörler için 0 döndürmeli", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [{ embedding: [1, 0, 0] }] }),
      });

      const entries = [makeEntry("ortho", "orthogonal vector", [0, 1, 0])];
      const results = await provider.search("query", entries);

      expect(results[0].score).toBeCloseTo(0, 5);
    });

    it("negatif korelasyon için negatif skor", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [{ embedding: [1, 0, 0] }] }),
      });

      const entries = [makeEntry("opposite", "opposite vector", [-1, 0, 0])];
      const results = await provider.search("query", entries);

      expect(results[0].score).toBeCloseTo(-1, 5);
    });

    it("farklı boyutlu vektörler için 0 döndürmeli", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [{ embedding: [1, 0, 0] }] }),
      });

      // 2 boyutlu vektör vs 3 boyutlu query
      const entries = [makeEntry("diff_dim", "different dimension", [1, 0])];
      const results = await provider.search("query", entries);

      expect(results[0].score).toBe(0);
    });

    it("sıfır vektör için 0 döndürmeli", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [{ embedding: [1, 0, 0] }] }),
      });

      const entries = [makeEntry("zero", "zero vector", [0, 0, 0])];
      const results = await provider.search("query", entries);

      expect(results[0].score).toBe(0);
    });
  });
});
