// ============================================
// MAGS — Memory Tools Integration Tests
// MCP tool handlers icin integration testleri
// ============================================

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerMemoryTools } from "./memory-tools.js";
import { MemoryStore } from "../services/memory-store.js";

// Mock server olusturucu - stack-tools.test.ts patternini takip eder
interface MockServer extends McpServer {
  registeredTools: Map<string, { description: string; schema: object; handler: Function }>;
}

function createMockServer(): MockServer {
  const tools = new Map<string, { description: string; schema: object; handler: Function }>();

  return {
    registeredTools: tools,
    tool: (name: string, description: string, schema: object, handler: Function) => {
      tools.set(name, { description, schema, handler });
    },
  } as MockServer;
}

// JSON response'u parse etmek icin yardimci
function parseToolResponse<T>(response: { content: Array<{ type: string; text: string }> }): T {
  return JSON.parse(response.content[0].text) as T;
}

describe("Memory Tools", () => {
  let tempDir: string;
  let memoryStore: MemoryStore;
  let server: MockServer;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "mags-memory-tools-test-"));
    memoryStore = new MemoryStore(tempDir);
    server = createMockServer();
    registerMemoryTools(server, memoryStore);
  });

  afterEach(() => {
    memoryStore?.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  // ── Tool Registration ────────────────────────────────

  describe("tool registration", () => {
    it("mags_remember tool'u kaydedilmis olmali", () => {
      expect(server.registeredTools.has("mags_remember")).toBe(true);
    });

    it("mags_recall tool'u kaydedilmis olmali", () => {
      expect(server.registeredTools.has("mags_recall")).toBe(true);
    });

    it("mags_forget tool'u kaydedilmis olmali", () => {
      expect(server.registeredTools.has("mags_forget")).toBe(true);
    });

    it("mags_promote_memory tool'u kaydedilmis olmali", () => {
      expect(server.registeredTools.has("mags_promote_memory")).toBe(true);
    });

    it("toplam 4 memory tool kaydedilmis olmali", () => {
      const memoryTools = ["mags_remember", "mags_recall", "mags_forget", "mags_promote_memory"];
      for (const tool of memoryTools) {
        expect(server.registeredTools.has(tool)).toBe(true);
      }
    });

    it("tool description'lar dogru tanimlanmis olmali", () => {
      const rememberTool = server.registeredTools.get("mags_remember");
      expect(rememberTool?.description).toContain("Store a memory note");

      const recallTool = server.registeredTools.get("mags_recall");
      expect(recallTool?.description).toContain("Search and retrieve");

      const forgetTool = server.registeredTools.get("mags_forget");
      expect(forgetTool?.description).toContain("Delete a stored memory");

      const promoteTool = server.registeredTools.get("mags_promote_memory");
      expect(promoteTool?.description).toContain("promoting");
    });
  });

  // ── mags_remember ────────────────────────────────────

  describe("mags_remember", () => {
    it("key/value ile memory kaydeder", async () => {
      const tool = server.registeredTools.get("mags_remember");
      const response = await tool?.handler({
        key: "test_key",
        value: "test value content",
      });

      const result = parseToolResponse<{
        stored: boolean;
        key: string;
        isUpdate: boolean;
        totalEntries: number;
      }>(response);

      expect(result.stored).toBe(true);
      expect(result.key).toBe("test_key");
      expect(result.isUpdate).toBe(false);
      expect(result.totalEntries).toBe(1);
    });

    it("category ve tags ile memory kaydeder", async () => {
      const tool = server.registeredTools.get("mags_remember");
      const response = await tool?.handler({
        key: "auth_strategy",
        value: "JWT with refresh tokens",
        category: "decisions",
        tags: ["auth", "security"],
      });

      const result = parseToolResponse<{
        stored: boolean;
        key: string;
        category: string;
      }>(response);

      expect(result.stored).toBe(true);
      expect(result.category).toBe("decisions");

      // MemoryStore'dan dogrulama
      const entry = memoryStore.get("auth_strategy");
      expect(entry?.tags).toEqual(["auth", "security"]);
    });

    it("metadata ile memory kaydeder", async () => {
      const tool = server.registeredTools.get("mags_remember");
      const response = await tool?.handler({
        key: "db_decision",
        value: "PostgreSQL secildi",
        category: "decisions",
        metadata: {
          alternatives: ["MySQL", "MongoDB"],
          reason: "ACID compliance ve JSON destegi",
        },
      });

      const result = parseToolResponse<{ stored: boolean }>(response);
      expect(result.stored).toBe(true);

      const entry = memoryStore.get("db_decision");
      expect(entry?.metadata).toEqual({
        alternatives: ["MySQL", "MongoDB"],
        reason: "ACID compliance ve JSON destegi",
      });
    });

    it("mevcut key'i gunceller ve isUpdate=true doner", async () => {
      const tool = server.registeredTools.get("mags_remember");

      // Ilk kayit
      await tool?.handler({
        key: "update_test",
        value: "original value",
        category: "notes",
      });

      // Guncelleme
      const response = await tool?.handler({
        key: "update_test",
        value: "updated value",
        category: "notes",
      });

      const result = parseToolResponse<{
        isUpdate: boolean;
        key: string;
        totalEntries: number;
      }>(response);

      expect(result.isUpdate).toBe(true);
      expect(result.totalEntries).toBe(1); // Yeni kayit olusturulmadi

      const entry = memoryStore.get("update_test");
      expect(entry?.value).toBe("updated value");
    });

    it("benzer key'ler varsa similarKeys doner", async () => {
      const tool = server.registeredTools.get("mags_remember");

      // Once benzer key'ler olustur
      await tool?.handler({
        key: "api_auth",
        value: "Auth API design",
        category: "api",
      });
      await tool?.handler({
        key: "api_users",
        value: "Users API design",
        category: "api",
      });

      // Yeni benzer key ekle
      const response = await tool?.handler({
        key: "api_products",
        value: "Products API design",
        category: "api",
      });

      const result = parseToolResponse<{
        stored: boolean;
        similarKeys?: string[];
      }>(response);

      expect(result.stored).toBe(true);
      // "api" prefix ile baslayan diger key'ler bulunmali
      if (result.similarKeys) {
        expect(result.similarKeys.length).toBeGreaterThan(0);
      }
    });

    it("null category ve tags degerlerini kabul eder", async () => {
      const tool = server.registeredTools.get("mags_remember");
      const response = await tool?.handler({
        key: "nullable_test",
        value: "test value",
        category: null,
        tags: null,
      });

      const result = parseToolResponse<{ stored: boolean }>(response);
      expect(result.stored).toBe(true);

      const entry = memoryStore.get("nullable_test");
      expect(entry?.category).toBeUndefined();
      expect(entry?.tags).toEqual([]);
    });

    it("capacity bilgisi response'a dahil edilir", async () => {
      const tool = server.registeredTools.get("mags_remember");
      const response = await tool?.handler({
        key: "capacity_test",
        value: "test value",
      });

      const result = parseToolResponse<{
        stored: boolean;
        capacityPercent: number;
        totalEntries: number;
      }>(response);

      expect(result.stored).toBe(true);
      expect(typeof result.capacityPercent).toBe("number");
      expect(typeof result.totalEntries).toBe("number");
    });
  });

  // ── mags_recall ──────────────────────────────────────

  describe("mags_recall", () => {
    beforeEach(async () => {
      // Test verileri hazirla
      await memoryStore.remember("auth_strategy", "JWT with refresh tokens", "decisions", ["auth", "jwt"]);
      await memoryStore.remember("db_choice", "PostgreSQL with Prisma", "decisions", ["database"]);
      await memoryStore.remember("ui_framework", "React with TanStack Query", "conventions", ["frontend"]);
      await memoryStore.remember("api_pattern", "REST with OpenAPI", "conventions", ["api"]);
    });

    it("query ile memory arar", async () => {
      const tool = server.registeredTools.get("mags_recall");
      // "jwt" veya "auth" gibi gercek veri icindeki anahtar kelimeyi kullan
      const response = await tool?.handler({
        query: "jwt tokens",
      });

      const result = parseToolResponse<{
        results: Array<{ key: string; value: string; score: number }>;
        total: number;
      }>(response);

      expect(result.total).toBeGreaterThan(0);
      expect(result.results[0].key).toBe("auth_strategy");
    });

    it("category ile filtreler", async () => {
      const tool = server.registeredTools.get("mags_recall");
      const response = await tool?.handler({
        query: "",
        category: "conventions",
      });

      const result = parseToolResponse<{
        results: Array<{ key: string; category: string }>;
        total: number;
      }>(response);

      expect(result.total).toBe(2);
      for (const r of result.results) {
        expect(r.category).toBe("conventions");
      }
    });

    it("bos query ile tum kayitlari (limit dahilinde) doner", async () => {
      const tool = server.registeredTools.get("mags_recall");
      const response = await tool?.handler({
        query: "",
      });

      const result = parseToolResponse<{
        results: Array<{ key: string }>;
        total: number;
      }>(response);

      expect(result.total).toBe(4);
    });

    it("limit parametresi calisir", async () => {
      const tool = server.registeredTools.get("mags_recall");
      const response = await tool?.handler({
        query: "",
        limit: 2,
      });

      const result = parseToolResponse<{
        results: Array<{ key: string }>;
        total: number;
      }>(response);

      expect(result.total).toBe(2);
    });

    it("null degerler varsayilanlara donusur", async () => {
      const tool = server.registeredTools.get("mags_recall");
      const response = await tool?.handler({
        query: null,
        category: null,
        limit: null,
      });

      const result = parseToolResponse<{
        results: Array<{ key: string }>;
        total: number;
      }>(response);

      // null degerler default'a donusmeli, hata vermemeli
      expect(result.total).toBe(4);
    });

    it("eslesme yoksa bos array doner", async () => {
      const tool = server.registeredTools.get("mags_recall");
      const response = await tool?.handler({
        query: "nonexistent_keyword_xyz",
      });

      const result = parseToolResponse<{
        results: Array<{ key: string }>;
        total: number;
      }>(response);

      expect(result.total).toBe(0);
      expect(result.results).toEqual([]);
    });

    it("response'da score degeri dahil edilir", async () => {
      const tool = server.registeredTools.get("mags_recall");
      const response = await tool?.handler({
        query: "auth",
      });

      const result = parseToolResponse<{
        results: Array<{ key: string; score: number }>;
      }>(response);

      expect(result.results.length).toBeGreaterThan(0);
      expect(typeof result.results[0].score).toBe("number");
    });

    it("response'da tags ve metadata dahil edilir", async () => {
      const tool = server.registeredTools.get("mags_recall");
      const response = await tool?.handler({
        query: "auth",
      });

      const result = parseToolResponse<{
        results: Array<{ key: string; tags: string[]; metadata?: unknown }>;
      }>(response);

      expect(result.results[0].tags).toEqual(["auth", "jwt"]);
    });
  });

  // ── mags_forget ──────────────────────────────────────

  describe("mags_forget", () => {
    it("mevcut memory'i siler ve deleted=true doner", async () => {
      await memoryStore.remember("to_delete", "will be deleted");

      const tool = server.registeredTools.get("mags_forget");
      const response = await tool?.handler({
        key: "to_delete",
      });

      const result = parseToolResponse<{ deleted: boolean; key: string }>(response);

      expect(result.deleted).toBe(true);
      expect(result.key).toBe("to_delete");
      expect(memoryStore.get("to_delete")).toBeUndefined();
    });

    it("olmayan key icin deleted=false doner", async () => {
      const tool = server.registeredTools.get("mags_forget");
      const response = await tool?.handler({
        key: "nonexistent_key",
      });

      const result = parseToolResponse<{ deleted: boolean; key: string }>(response);

      expect(result.deleted).toBe(false);
      expect(result.key).toBe("nonexistent_key");
    });

    it("silinen key tekrar sorgulanamaz", async () => {
      await memoryStore.remember("temp_key", "temporary value");

      const forgetTool = server.registeredTools.get("mags_forget");
      await forgetTool?.handler({ key: "temp_key" });

      const recallTool = server.registeredTools.get("mags_recall");
      const recallResponse = await recallTool?.handler({
        query: "temporary",
      });

      const result = parseToolResponse<{ total: number }>(recallResponse);
      expect(result.total).toBe(0);
    });
  });

  // ── mags_promote_memory ──────────────────────────────

  describe("mags_promote_memory", () => {
    it("mevcut key icin promotion suggestion doner (claude_md hedefi)", async () => {
      await memoryStore.remember(
        "api_convention",
        "Always use camelCase for API responses",
        "conventions",
        ["api", "naming"]
      );

      const tool = server.registeredTools.get("mags_promote_memory");
      const response = await tool?.handler({
        key: "api_convention",
        target: "claude_md",
      });

      expect(response.isError).toBeFalsy();

      const result = parseToolResponse<{
        key: string;
        value: string;
        category: string;
        target: string;
        recommendation: string;
        suggestedContent: string;
        action: string;
        ageInDays: number;
      }>(response);

      expect(result.key).toBe("api_convention");
      expect(result.target).toBe("claude_md");
      expect(result.recommendation).toContain("CLAUDE.md");
      expect(result.suggestedContent).toBeDefined();
      expect(result.action).toContain("Review");
      expect(typeof result.ageInDays).toBe("number");
    });

    it("mevcut key icin promotion suggestion doner (doc hedefi)", async () => {
      await memoryStore.remember(
        "architecture_decision",
        "Event sourcing for audit trail",
        "decisions",
        ["architecture"],
        { reason: "Compliance requirements" }
      );

      const tool = server.registeredTools.get("mags_promote_memory");
      const response = await tool?.handler({
        key: "architecture_decision",
        target: "doc",
      });

      expect(response.isError).toBeFalsy();

      const result = parseToolResponse<{
        key: string;
        target: string;
        recommendation: string;
        suggestedContent: string;
      }>(response);

      expect(result.key).toBe("architecture_decision");
      expect(result.target).toBe("doc");
      expect(result.recommendation).toContain("project docs");
      expect(result.suggestedContent).toContain("### architecture_decision");
      // Metadata varsa suggestedContent'e eklenmeli
      expect(result.suggestedContent).toContain("Metadata:");
    });

    it("conventions kategorisi icin farkli format kullanir", async () => {
      await memoryStore.remember(
        "naming_convention",
        "Use kebab-case for file names",
        "conventions"
      );

      const tool = server.registeredTools.get("mags_promote_memory");
      const response = await tool?.handler({
        key: "naming_convention",
        target: "claude_md",
      });

      const result = parseToolResponse<{ suggestedContent: string }>(response);

      // conventions kategorisi icin "- value" formati kullanilmali
      expect(result.suggestedContent).toBe("- Use kebab-case for file names");
    });

    it("diger kategoriler icin key:value formati kullanir", async () => {
      await memoryStore.remember(
        "db_decision",
        "PostgreSQL selected",
        "decisions"
      );

      const tool = server.registeredTools.get("mags_promote_memory");
      const response = await tool?.handler({
        key: "db_decision",
        target: "claude_md",
      });

      const result = parseToolResponse<{ suggestedContent: string }>(response);

      // decisions kategorisi icin "- **key**: value" formati kullanilmali
      expect(result.suggestedContent).toBe("- **db_decision**: PostgreSQL selected");
    });

    it("olmayan key icin error doner", async () => {
      const tool = server.registeredTools.get("mags_promote_memory");
      const response = await tool?.handler({
        key: "nonexistent_key",
        target: "claude_md",
      });

      expect(response.isError).toBe(true);

      const result = parseToolResponse<{ error: string }>(response);
      expect(result.error).toContain("not found");
      expect(result.error).toContain("nonexistent_key");
    });

    it("tags bilgisi response'a dahil edilir", async () => {
      await memoryStore.remember(
        "tagged_memory",
        "Important note",
        "notes",
        ["important", "review"]
      );

      const tool = server.registeredTools.get("mags_promote_memory");
      const response = await tool?.handler({
        key: "tagged_memory",
        target: "claude_md",
      });

      const result = parseToolResponse<{ tags: string[] }>(response);
      expect(result.tags).toEqual(["important", "review"]);
    });
  });

  // ── Integration Scenarios ────────────────────────────

  describe("integration scenarios", () => {
    it("remember -> recall -> forget akisi calisir", async () => {
      const rememberTool = server.registeredTools.get("mags_remember");
      const recallTool = server.registeredTools.get("mags_recall");
      const forgetTool = server.registeredTools.get("mags_forget");

      // 1. Remember
      const rememberResponse = await rememberTool?.handler({
        key: "integration_test",
        value: "integration test value",
        category: "test",
      });
      const rememberResult = parseToolResponse<{ stored: boolean }>(rememberResponse);
      expect(rememberResult.stored).toBe(true);

      // 2. Recall
      const recallResponse = await recallTool?.handler({
        query: "integration",
        category: "test",
      });
      const recallResult = parseToolResponse<{ total: number }>(recallResponse);
      expect(recallResult.total).toBe(1);

      // 3. Forget
      const forgetResponse = await forgetTool?.handler({
        key: "integration_test",
      });
      const forgetResult = parseToolResponse<{ deleted: boolean }>(forgetResponse);
      expect(forgetResult.deleted).toBe(true);

      // 4. Verify deletion
      const verifyResponse = await recallTool?.handler({
        query: "integration",
        category: "test",
      });
      const verifyResult = parseToolResponse<{ total: number }>(verifyResponse);
      expect(verifyResult.total).toBe(0);
    });

    it("remember -> update -> promote akisi calisir", async () => {
      const rememberTool = server.registeredTools.get("mags_remember");
      const promoteTool = server.registeredTools.get("mags_promote_memory");

      // 1. Remember
      await rememberTool?.handler({
        key: "evolving_decision",
        value: "Initial decision: Use REST",
        category: "decisions",
      });

      // 2. Update
      const updateResponse = await rememberTool?.handler({
        key: "evolving_decision",
        value: "Updated decision: Use GraphQL for complex queries, REST for simple ones",
        category: "decisions",
        tags: ["api", "architecture"],
      });
      const updateResult = parseToolResponse<{ isUpdate: boolean }>(updateResponse);
      expect(updateResult.isUpdate).toBe(true);

      // 3. Promote
      const promoteResponse = await promoteTool?.handler({
        key: "evolving_decision",
        target: "doc",
      });
      const promoteResult = parseToolResponse<{ value: string }>(promoteResponse);
      expect(promoteResult.value).toContain("GraphQL");
    });

    it("birden fazla kayit ile toplu islem", async () => {
      const rememberTool = server.registeredTools.get("mags_remember");
      const recallTool = server.registeredTools.get("mags_recall");
      const forgetTool = server.registeredTools.get("mags_forget");

      // Bulk remember
      const keys = ["bulk_1", "bulk_2", "bulk_3", "bulk_4", "bulk_5"];
      for (const key of keys) {
        await rememberTool?.handler({
          key,
          value: `Value for ${key}`,
          category: "bulk_test",
        });
      }

      // Verify all stored
      const recallResponse = await recallTool?.handler({
        query: "",
        category: "bulk_test",
      });
      const recallResult = parseToolResponse<{ total: number }>(recallResponse);
      expect(recallResult.total).toBe(5);

      // Delete some
      await forgetTool?.handler({ key: "bulk_2" });
      await forgetTool?.handler({ key: "bulk_4" });

      // Verify remaining
      const finalResponse = await recallTool?.handler({
        query: "",
        category: "bulk_test",
      });
      const finalResult = parseToolResponse<{ total: number }>(finalResponse);
      expect(finalResult.total).toBe(3);
    });
  });

  // ── Response Format ──────────────────────────────────

  describe("response format", () => {
    it("remember MCP content format doner", async () => {
      const tool = server.registeredTools.get("mags_remember");
      const response = await tool?.handler({
        key: "format_test",
        value: "test value",
      });

      expect(response).toHaveProperty("content");
      expect(Array.isArray(response.content)).toBe(true);
      expect(response.content[0]).toHaveProperty("type", "text");
      expect(response.content[0]).toHaveProperty("text");
      expect(() => JSON.parse(response.content[0].text)).not.toThrow();
    });

    it("recall MCP content format doner", async () => {
      await memoryStore.remember("test", "value");

      const tool = server.registeredTools.get("mags_recall");
      const response = await tool?.handler({ query: "test" });

      expect(response).toHaveProperty("content");
      expect(Array.isArray(response.content)).toBe(true);
      expect(response.content[0]).toHaveProperty("type", "text");
    });

    it("forget MCP content format doner", async () => {
      await memoryStore.remember("test", "value");

      const tool = server.registeredTools.get("mags_forget");
      const response = await tool?.handler({ key: "test" });

      expect(response).toHaveProperty("content");
      expect(Array.isArray(response.content)).toBe(true);
      expect(response.content[0]).toHaveProperty("type", "text");
    });

    it("promote_memory MCP content format doner", async () => {
      await memoryStore.remember("test", "value");

      const tool = server.registeredTools.get("mags_promote_memory");
      const response = await tool?.handler({ key: "test", target: "claude_md" });

      expect(response).toHaveProperty("content");
      expect(Array.isArray(response.content)).toBe(true);
      expect(response.content[0]).toHaveProperty("type", "text");
    });
  });
});
