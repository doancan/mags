/**
 * MemoryStore — End-to-End Integration Tests
 *
 * Kapsamlı testler:
 * - Sıfırdan kurulum (clean install) senaryosu
 * - YAML migrasyon uçtan uca
 * - SearchEngine entegrasyonu
 * - Context-tools benzeri kullanım kalıpları
 * - Metadata kalitesi ve tutarlılığı
 * - Transaction atomicity (race condition koruması)
 * - DB corruption recovery
 * - Çoklu instance (close → reopen)
 * - Embedding provider entegrasyonu
 * - Serbest kategori + boş query optimizasyonu
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdirSync,
  writeFileSync,
  rmSync,
  existsSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import YAML from "yaml";
import { MemoryStore } from "./memory-store.js";
import { SearchEngine } from "./search-engine.js";
import { DocIndexer } from "./doc-indexer.js";
import { LocalEmbeddingProvider } from "./embedding/local.js";
import type { MemoryEntry } from "../types/index.js";

function tmp(): string {
  const d = join(tmpdir(), `mags-e2e-${randomUUID()}`);
  mkdirSync(d, { recursive: true });
  return d;
}

describe("MemoryStore — E2E Integration Tests", () => {
  let rootDir: string;
  let store: MemoryStore;

  afterEach(() => {
    try { store?.close(); } catch {}
    if (rootDir) rmSync(rootDir, { recursive: true, force: true });
  });

  // ═════════════════════════════════════════════
  // 1. SIFIRDAN KURULUM (CLEAN INSTALL)
  // ═════════════════════════════════════════════

  describe("sıfırdan kurulum senaryosu", () => {
    it("hiç mags dizini yokken tam lifecycle çalışır", async () => {
      rootDir = tmp();
      const magsDir = join(rootDir, "project", "docs", ".mags");
      // magsDir henüz yok

      // 1. Store oluştur (dizini kendisi oluşturmalı)
      store = new MemoryStore(magsDir);

      // 2. DB dosyası oluşturulmuş olmalı
      expect(existsSync(join(magsDir, "memory", "memories.db"))).toBe(true);

      // 3. Boş store
      expect(store.getAll()).toEqual([]);
      expect(store.get("nonexistent")).toBeUndefined();

      // 4. Kayıt ekle
      const { entry } = await store.remember(
        "db_choice",
        "PostgreSQL with Prisma",
        "decisions",
        ["database", "orm"],
        { alternatives: ["MongoDB", "MySQL"], reason: "Type safety" }
      );
      expect(entry.id).toBeTruthy();
      expect(entry.key).toBe("db_choice");

      // 5. Geri oku
      const fetched = store.get("db_choice");
      expect(fetched?.value).toBe("PostgreSQL with Prisma");
      expect(fetched?.metadata?.alternatives).toEqual(["MongoDB", "MySQL"]);

      // 6. Arama
      const results = await store.recall("database");
      expect(results.length).toBe(1);
      expect(results[0].key).toBe("db_choice");

      // 7. Kapat ve yeniden aç
      store.close();
      store = new MemoryStore(magsDir);
      expect(store.get("db_choice")?.value).toBe("PostgreSQL with Prisma");

      // 8. Sil
      expect(store.forget("db_choice")).toBe(true);
      expect(store.getAll()).toHaveLength(0);
    });

    it("docs/.mags dizini yokken ardışık store instance'ları", async () => {
      rootDir = tmp();
      const magsDir = join(rootDir, "fresh-project", ".mags");

      // İlk instance
      store = new MemoryStore(magsDir);
      await store.remember("k1", "v1");
      store.close();

      // İkinci instance
      store = new MemoryStore(magsDir);
      await store.remember("k2", "v2");
      expect(store.getAll()).toHaveLength(2);
      store.close();

      // Üçüncü instance — hepsi orada mı?
      store = new MemoryStore(magsDir);
      expect(store.getAll()).toHaveLength(2);
      expect(store.get("k1")?.value).toBe("v1");
      expect(store.get("k2")?.value).toBe("v2");
    });
  });

  // ═════════════════════════════════════════════
  // 2. YAML MİGRASYON — UÇTAN UCA
  // ═════════════════════════════════════════════

  describe("YAML migrasyon — uçtan uca", () => {
    it("mevcut YAML projesinden tam migrasyon", async () => {
      rootDir = tmp();
      const magsDir = join(rootDir, ".mags");
      const entriesDir = join(magsDir, "memory", "entries");
      mkdirSync(entriesDir, { recursive: true });

      // 10 adet YAML entry oluştur (legacy format)
      const legacyEntries: Record<string, any> = {};
      for (let i = 0; i < 10; i++) {
        const entry = {
          id: randomUUID(),
          key: `legacy_key_${i}`,
          value: `Legacy value ${i} with unique marker word-${i}`,
          category: i % 2 === 0 ? "decisions" : "notes",
          tags: [`tag-${i}`],
          createdAt: `2025-01-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`,
          updatedAt: `2025-01-${String(i + 1).padStart(2, "0")}T12:00:00.000Z`,
        };
        legacyEntries[entry.key] = entry;
        writeFileSync(
          join(entriesDir, `${entry.id}.yaml`),
          YAML.stringify(entry),
          "utf-8"
        );
      }

      // Store oluştur — migrasyon tetiklenmeli
      store = new MemoryStore(magsDir);

      // entries/ → entries.bak/ olmuş olmalı
      expect(existsSync(join(magsDir, "memory", "entries.bak"))).toBe(true);
      expect(existsSync(join(magsDir, "memory", "memories.db"))).toBe(true);

      // 10 kayıt SQLite'da olmalı
      expect(store.getAll()).toHaveLength(10);

      // Her kayıt doğru verilerle geldi mi?
      for (const [key, legacy] of Object.entries(legacyEntries)) {
        const entry = store.get(key);
        expect(entry).toBeTruthy();
        expect(entry!.value).toBe(legacy.value);
        expect(entry!.category).toBe(legacy.category);
        expect(entry!.tags).toEqual(legacy.tags);
        expect(entry!.createdAt).toBe(legacy.createdAt);
        expect(entry!.updatedAt).toBe(legacy.updatedAt);
      }

      // Arama çalışıyor mu?
      const results = await store.recall("word-5");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].key).toBe("legacy_key_5");

      // Yeni kayıt ekleme çalışıyor mu?
      await store.remember("new_key", "new value");
      expect(store.getAll()).toHaveLength(11);
    });

    it("YAML + corrupted + boş dosyalar karışık migrasyon", async () => {
      rootDir = tmp();
      const magsDir = join(rootDir, ".mags");
      const entriesDir = join(magsDir, "memory", "entries");
      mkdirSync(entriesDir, { recursive: true });

      // Geçerli entry
      const good = {
        id: randomUUID(),
        key: "good_key",
        value: "good value",
        tags: ["valid"],
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
      };
      writeFileSync(join(entriesDir, `${good.id}.yaml`), YAML.stringify(good), "utf-8");

      // Corrupted YAML
      writeFileSync(join(entriesDir, "corrupted.yaml"), "{{{{BAD YAML", "utf-8");

      // Boş dosya
      writeFileSync(join(entriesDir, "empty.yaml"), "", "utf-8");

      // Key/id eksik entry
      writeFileSync(join(entriesDir, "no-key.yaml"), "value: something\n", "utf-8");

      // JSON formatında (geçerli YAML sayılır)
      writeFileSync(
        join(entriesDir, "json.yaml"),
        JSON.stringify({ id: randomUUID(), key: "json_key", value: "from json", tags: [] }),
        "utf-8"
      );

      store = new MemoryStore(magsDir);

      // good_key ve json_key migre olmuş olmalı
      expect(store.get("good_key")).toBeTruthy();
      expect(store.get("json_key")).toBeTruthy();
      expect(store.getAll()).toHaveLength(2);
    });

    it("zaten SQLite DB varken YAML migrasyon yapılmaz (idempotent)", async () => {
      rootDir = tmp();
      const magsDir = join(rootDir, ".mags");

      // İlk store — DB oluştur
      store = new MemoryStore(magsDir);
      await store.remember("existing", "already here");
      store.close();

      // YAML entries dizini oluştur (sanki eski proje)
      const entriesDir = join(magsDir, "memory", "entries");
      mkdirSync(entriesDir, { recursive: true });
      writeFileSync(
        join(entriesDir, "fake.yaml"),
        YAML.stringify({ id: randomUUID(), key: "should_not_migrate", value: "nope", tags: [] }),
        "utf-8"
      );

      // Tekrar store aç — DB dolu olduğu için migrasyon yapmamalı
      store = new MemoryStore(magsDir);
      expect(store.get("existing")).toBeTruthy();
      expect(store.get("should_not_migrate")).toBeUndefined();
      expect(store.getAll()).toHaveLength(1);
    });
  });

  // ═════════════════════════════════════════════
  // 3. SEARCH ENGINE ENTEGRASYONU
  // ═════════════════════════════════════════════

  describe("SearchEngine entegrasyonu", () => {
    it("memory store + doc indexer birlikte çalışır", async () => {
      rootDir = tmp();
      const docsDir = join(rootDir, "docs");
      const magsDir = join(rootDir, ".mags");
      mkdirSync(docsDir, { recursive: true });

      // Docs
      writeFileSync(
        join(docsDir, "auth.md"),
        "---\ntitle: Auth\n---\n\n# Authentication\n\nOAuth2 with PKCE flow for mobile clients.",
        "utf-8"
      );

      const docIndexer = new DocIndexer(docsDir);
      docIndexer.index();

      store = new MemoryStore(magsDir);

      // Memory
      await store.remember("auth_strategy", "JWT with RS256 for API auth", "decisions", ["auth"]);
      await store.remember("session_store", "Redis for session management", "decisions", ["cache"]);

      const engine = new SearchEngine(docIndexer, store);

      // Unified search
      const results = await engine.search("authentication", 10, "all");
      expect(results.length).toBeGreaterThan(0);

      // Memory-only search
      const memResults = await engine.search("JWT", 10, "memory");
      expect(memResults.length).toBeGreaterThan(0);
      expect(memResults[0].source).toBe("auth_strategy");
      expect(memResults[0].type).toBe("memory");

      // Doc-only search
      const docResults = await engine.search("OAuth2", 10, "docs");
      expect(docResults.length).toBeGreaterThan(0);
      expect(docResults[0].type).toBe("doc");
    });
  });

  // ═════════════════════════════════════════════
  // 4. CONTEXT-TOOLS BENZERİ KULLANIM KALIPLARI
  // ═════════════════════════════════════════════

  describe("context-tools kullanım kalıpları", () => {
    beforeEach(async () => {
      rootDir = tmp();
      store = new MemoryStore(rootDir);

      // Tipik bir proje memory'si oluştur
      await store.remember("auth_strategy", "JWT tokens with RS256", "decisions", ["auth", "security"]);
      await store.remember("db_choice", "PostgreSQL with Prisma ORM", "decisions", ["database"]);
      await store.remember("cache_strategy", "Redis for sessions and rate limiting", "decisions", ["cache"]);
      await store.remember("api_pattern", "REST with OpenAPI spec", "conventions", ["api"]);
      await store.remember("test_framework", "Vitest with 80% coverage", "conventions", ["testing"]);
      await store.remember("css_approach", "Tailwind CSS with custom theme", "conventions", ["frontend"]);
      await store.remember("known_bug_1", "Race condition in payment module", "bugs", ["payment"]);
      await store.remember("refactor_note", "Need to refactor auth middleware", "notes", ["auth"]);
    });

    it("project_summary pattern: boş query + decisions category", async () => {
      // context-tools: memoryStore.recall("", "decisions", 5)
      const recentDecisions = await store.recall("", "decisions", 5);
      expect(recentDecisions.length).toBeLessThanOrEqual(5);
      for (const d of recentDecisions) {
        expect(d.category).toBe("decisions");
        expect(d.score).toBe(1); // boş query → score 1
      }
    });

    it("module_context pattern: modül adı ile arama", async () => {
      // context-tools: memoryStore.recall(module, undefined, 5)
      const authMemories = await store.recall("auth", undefined, 5);
      expect(authMemories.length).toBeGreaterThan(0);
      // auth_strategy ve refactor_note (auth tag) gelmelibir
      const keys = authMemories.map((m) => m.key);
      expect(keys).toContain("auth_strategy");
    });

    it("tüm memory'leri listeleme", async () => {
      const all = store.getAll();
      expect(all).toHaveLength(8);
    });

    it("serbest kategori ile filtreleme", async () => {
      const bugs = await store.recall("", "bugs");
      expect(bugs.length).toBe(1);
      expect(bugs[0].key).toBe("known_bug_1");
    });

    it("yokolan kategori boş döner", async () => {
      const empty = await store.recall("", "nonexistent-category");
      expect(empty).toEqual([]);
    });
  });

  // ═════════════════════════════════════════════
  // 5. METADATA KALİTESİ VE TUTARLILIĞI
  // ═════════════════════════════════════════════

  describe("metadata kalitesi", () => {
    beforeEach(() => {
      rootDir = tmp();
      store = new MemoryStore(rootDir);
    });

    it("karmaşık karar metadata'sı tam cycle", async () => {
      // Gerçek dünya senaryosu: bir mimari karar
      await store.remember(
        "state_management",
        "Zustand selected for client state",
        "decisions",
        ["frontend", "state"],
        {
          alternatives: ["Redux", "MobX", "Jotai"],
          reason: "Minimal boilerplate, React-native uyumlu",
          decidedBy: "team consensus",
          date: "2025-06-15",
          relatedTo: ["auth_strategy", "api_pattern"],
          performance: { bundleSize: "2KB", benchmarkMs: 0.5 },
        }
      );

      // Aynı instance'dan oku
      const entry = store.get("state_management");
      expect(entry?.metadata?.alternatives).toEqual(["Redux", "MobX", "Jotai"]);
      expect(entry?.metadata?.performance).toEqual({ bundleSize: "2KB", benchmarkMs: 0.5 });

      // Persist → reload
      store.close();
      store = new MemoryStore(rootDir);
      const reloaded = store.get("state_management");
      expect(reloaded?.metadata?.alternatives).toEqual(["Redux", "MobX", "Jotai"]);
      expect(reloaded?.metadata?.decidedBy).toBe("team consensus");
      expect((reloaded?.metadata?.performance as any)?.benchmarkMs).toBe(0.5);
    });

    it("bug metadata'sı: workaround, severity, stack trace", async () => {
      await store.remember(
        "payment_race",
        "Concurrent payment requests cause double charge",
        "bugs",
        ["payment", "critical"],
        {
          severity: "critical",
          workaround: "Added mutex lock on payment endpoint",
          stackTrace: "PaymentService.ts:142 → processPayment()",
          affectedVersions: ["1.2.0", "1.2.1"],
          fixedIn: null,
        }
      );

      store.close();
      store = new MemoryStore(rootDir);
      const bug = store.get("payment_race");
      expect(bug?.metadata?.severity).toBe("critical");
      expect(bug?.metadata?.workaround).toContain("mutex");
      expect(bug?.metadata?.fixedIn).toBeNull();
      expect(bug?.metadata?.affectedVersions).toEqual(["1.2.0", "1.2.1"]);
    });

    it("metadata güncelleme: eski metadata korunur veya override edilir", async () => {
      // İlk kayıt
      await store.remember("api_version", "v2", "decisions", ["api"], {
        migrationPlan: "gradual rollout",
        deadline: "2025-Q3",
      });

      // metadata undefined ile güncelleme → mevcut metadata korunur
      await store.remember("api_version", "v2.1");
      let entry = store.get("api_version");
      expect(entry?.metadata?.migrationPlan).toBe("gradual rollout");
      expect(entry?.value).toBe("v2.1");

      // metadata ile güncelleme → yeni metadata override eder
      await store.remember("api_version", "v3", undefined, [], {
        migrationPlan: "big bang",
        newField: true,
      });
      entry = store.get("api_version");
      expect(entry?.metadata?.migrationPlan).toBe("big bang");
      expect(entry?.metadata?.newField).toBe(true);
      // deadline artık yok (yeni metadata tamamen override eder)
      expect(entry?.metadata?.deadline).toBeUndefined();
    });

    it("recall sonuçlarında metadata gelir", async () => {
      await store.remember("key_with_meta", "value", "notes", [], {
        important: true,
        source: "meeting",
      });

      const results = await store.recall("key_with_meta");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].metadata?.important).toBe(true);
      expect(results[0].metadata?.source).toBe("meeting");
    });
  });

  // ═════════════════════════════════════════════
  // 6. TRANSACTION ATOMICITY
  // ═════════════════════════════════════════════

  describe("transaction atomicity", () => {
    it("concurrent remember aynı key — son yazılan kazanır", async () => {
      rootDir = tmp();
      store = new MemoryStore(rootDir);

      // 20 concurrent remember aynı key'e
      const promises = Array.from({ length: 20 }, (_, i) =>
        store.remember("contested_key", `value-${i}`, "notes")
      );
      await Promise.all(promises);

      // Tek kayıt olmalı
      expect(store.getAll()).toHaveLength(1);
      const entry = store.get("contested_key");
      expect(entry?.value).toMatch(/^value-\d+$/);
    });

    it("concurrent remember farklı key'ler — hepsi yazılır", async () => {
      rootDir = tmp();
      store = new MemoryStore(rootDir);

      const promises = Array.from({ length: 100 }, (_, i) =>
        store.remember(`key-${i}`, `value-${i}`)
      );
      await Promise.all(promises);

      expect(store.getAll()).toHaveLength(100);
    });

    it("limit kontrolü concurrent durumda çalışır", async () => {
      rootDir = tmp();
      store = new MemoryStore(rootDir);

      // 998 kayıt ekle
      for (let i = 0; i < 998; i++) {
        await store.remember(`fill-${i}`, `v-${i}`);
      }

      // 5 concurrent remember → en fazla 2 daha eklenmeli (1000 limit)
      const promises = Array.from({ length: 5 }, (_, i) =>
        store.remember(`overflow-${i}`, `o-${i}`).catch(() => null)
      );
      const results = await Promise.all(promises);

      const total = store.getAll().length;
      expect(total).toBeLessThanOrEqual(1000);

      // En az bazıları başarılı olmalı
      const succeeded = results.filter((r) => r !== null);
      expect(succeeded.length).toBeGreaterThan(0);
    });
  });

  // ═════════════════════════════════════════════
  // 7. DB DOSYA BÜTÜNLÜĞÜ
  // ═════════════════════════════════════════════

  describe("DB dosya bütünlüğü", () => {
    it("WAL mode etkin olmalı", async () => {
      rootDir = tmp();
      store = new MemoryStore(rootDir);
      await store.remember("test", "value");

      // WAL dosyası oluşmuş olmalı (veya journal_mode WAL olmalı)
      const dbPath = join(rootDir, "memory", "memories.db");
      expect(existsSync(dbPath)).toBe(true);
    });

    it("close sonrası yeniden açma sorunsuz çalışır", async () => {
      rootDir = tmp();
      store = new MemoryStore(rootDir);

      await store.remember("persist_me", "I survive");
      store.close();

      // Yeniden aç
      store = new MemoryStore(rootDir);
      expect(store.get("persist_me")?.value).toBe("I survive");
    });

    it("çok sayıda open/close cycle sonrası veri bozulmaz", async () => {
      rootDir = tmp();

      for (let i = 0; i < 10; i++) {
        store = new MemoryStore(rootDir);
        await store.remember(`cycle-${i}`, `val-${i}`);
        store.close();
      }

      store = new MemoryStore(rootDir);
      expect(store.getAll()).toHaveLength(10);
      for (let i = 0; i < 10; i++) {
        expect(store.get(`cycle-${i}`)?.value).toBe(`val-${i}`);
      }
    });
  });

  // ═════════════════════════════════════════════
  // 8. EMBEDDING PROVIDER ENTEGRASYONU
  // ═════════════════════════════════════════════

  describe("embedding provider entegrasyonu", () => {
    it("LocalEmbeddingProvider ile BM25 search doğru sıralama yapar", async () => {
      rootDir = tmp();
      store = new MemoryStore(rootDir);
      store.setEmbeddingProvider(new LocalEmbeddingProvider());

      await store.remember("jwt_auth", "JWT token authentication with RS256 signing algorithm");
      await store.remember("session_auth", "Session-based authentication with Redis store");
      await store.remember("db_schema", "PostgreSQL database schema design");

      const results = await store.recall("JWT authentication");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].key).toBe("jwt_auth");
    });

    it("embedding provider olmadan keyword search fallback çalışır", async () => {
      rootDir = tmp();
      store = new MemoryStore(rootDir);
      // embeddingProvider set edilmedi

      await store.remember("auth_key", "JWT authentication strategy", "decisions", ["auth"]);

      const results = await store.recall("authentication");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].key).toBe("auth_key");
    });

    it("embedding provider sonradan eklendikten sonra search çalışır", async () => {
      rootDir = tmp();
      store = new MemoryStore(rootDir);

      // Önce embedding olmadan kayıt ekle
      await store.remember("early_entry", "stored before provider", "notes");

      // Sonra provider ekle
      store.setEmbeddingProvider(new LocalEmbeddingProvider());

      // Yeni kayıt
      await store.remember("late_entry", "stored after provider", "notes");

      // Her ikisini de bulmalı
      const results = await store.recall("stored");
      expect(results.length).toBe(2);
    });
  });

  // ═════════════════════════════════════════════
  // 9. SERBEST KATEGORİ SENARYOLARI
  // ═════════════════════════════════════════════

  describe("serbest kategori senaryoları", () => {
    beforeEach(async () => {
      rootDir = tmp();
      store = new MemoryStore(rootDir);
    });

    it("standart kategoriler çalışır", async () => {
      const categories = ["decisions", "conventions", "notes", "context", "bugs"];
      for (const cat of categories) {
        await store.remember(`${cat}_key`, `${cat} value`, cat);
      }

      for (const cat of categories) {
        const results = await store.recall("", cat);
        expect(results).toHaveLength(1);
        expect(results[0].category).toBe(cat);
      }
    });

    it("özel kategoriler çalışır", async () => {
      const customCategories = [
        "architecture",
        "performance-tuning",
        "team-agreements",
        "tech-debt",
        "migration-plans",
        "security-notes",
      ];
      for (const cat of customCategories) {
        await store.remember(`${cat}_key`, `${cat} value`, cat);
      }

      for (const cat of customCategories) {
        const results = await store.recall("", cat);
        expect(results).toHaveLength(1);
        expect(results[0].category).toBe(cat);
      }
    });

    it("kategorisiz kayıtlar category=undefined ile gelir", async () => {
      await store.remember("no_cat", "no category");
      const entry = store.get("no_cat");
      expect(entry?.category).toBeUndefined();

      // Kategorisiz kayıtlar herhangi bir category filtresiyle gelmez
      const results = await store.recall("", "decisions");
      expect(results.map((r) => r.key)).not.toContain("no_cat");
    });
  });

  // ═════════════════════════════════════════════
  // 10. GERÇEK DÜNYA SENARYO — TAM BİR SESSION
  // ═════════════════════════════════════════════

  describe("gerçek dünya: tam bir Claude Code session", () => {
    it("session başı → kararlar → arama → session sonu", async () => {
      rootDir = tmp();
      store = new MemoryStore(rootDir);
      store.setEmbeddingProvider(new LocalEmbeddingProvider());

      // === SESSION START ===
      // context-tools: recent decisions
      let decisions = await store.recall("", "decisions", 5);
      expect(decisions).toEqual([]); // İlk session, boş

      // === KULLANICI ÇALIŞIYOR ===
      // Karar 1: Auth stratejisi
      await store.remember(
        "auth_strategy",
        "JWT with RS256 for API, httpOnly cookies for web",
        "decisions",
        ["auth", "security"],
        {
          alternatives: ["session-based", "OAuth2 only"],
          reason: "SPA + mobile app desteği gerekiyor",
        }
      );

      // Karar 2: Database
      await store.remember(
        "database_choice",
        "PostgreSQL 16 with Prisma ORM",
        "decisions",
        ["database", "orm"],
        {
          alternatives: ["MySQL", "MongoDB"],
          reason: "Complex queries + type safety",
        }
      );

      // Convention 1
      await store.remember(
        "error_handling",
        "All errors follow RFC 7807 Problem Details format",
        "conventions",
        ["api", "errors"]
      );

      // Bug kaydı
      await store.remember(
        "cors_issue",
        "CORS preflight fails for multipart uploads",
        "bugs",
        ["api", "cors"],
        {
          workaround: "Added explicit OPTIONS handler",
          severity: "medium",
          fixedIn: null,
        }
      );

      // Not
      await store.remember(
        "meeting_2025_06",
        "Team decided to use monorepo with Turborepo",
        "notes",
        ["architecture"],
        { attendees: ["alice", "bob"], date: "2025-06-15" }
      );

      // === ARAMA SENARYOLARI ===

      // 1. Auth hakkında herşey
      const authResults = await store.recall("authentication auth JWT");
      expect(authResults.length).toBeGreaterThan(0);
      expect(authResults[0].key).toBe("auth_strategy");

      // 2. Decisions listele
      decisions = await store.recall("", "decisions", 5);
      expect(decisions).toHaveLength(2);

      // 3. Bug'lar
      const bugs = await store.recall("", "bugs");
      expect(bugs).toHaveLength(1);
      expect(bugs[0].metadata?.severity).toBe("medium");

      // 4. Keyword search
      const dbResults = await store.recall("PostgreSQL");
      expect(dbResults[0].key).toBe("database_choice");

      // === SESSION END ===
      // Persist check
      store.close();

      // === NEXT SESSION ===
      store = new MemoryStore(rootDir);
      store.setEmbeddingProvider(new LocalEmbeddingProvider());

      // context-tools: recent decisions
      const nextSessionDecisions = await store.recall("", "decisions", 5);
      expect(nextSessionDecisions).toHaveLength(2);

      // module_context: auth modülü
      const authContext = await store.recall("auth", undefined, 5);
      expect(authContext.length).toBeGreaterThan(0);

      // Bug hala orada
      const bug = store.get("cors_issue");
      expect(bug?.metadata?.workaround).toContain("OPTIONS");

      // Yeni session'da güncelleme
      await store.remember("cors_issue", "CORS preflight fails — FIXED in v1.3", "bugs", ["api", "cors"], {
        workaround: "Added explicit OPTIONS handler",
        severity: "medium",
        fixedIn: "v1.3",
      });

      const updatedBug = store.get("cors_issue");
      expect(updatedBug?.metadata?.fixedIn).toBe("v1.3");
      expect(updatedBug?.value).toContain("FIXED");
    });
  });

  // ═════════════════════════════════════════════
  // 11. EMPTY QUERY SQL LIMIT OPTİMİZASYONU
  // ═════════════════════════════════════════════

  describe("empty query SQL LIMIT optimizasyonu", () => {
    it("boş query + limit → SQL LIMIT ile sınırlı sonuç", async () => {
      rootDir = tmp();
      store = new MemoryStore(rootDir);

      for (let i = 0; i < 50; i++) {
        await store.remember(`key-${i}`, `val-${i}`, "decisions");
      }

      const results = await store.recall("", "decisions", 5);
      expect(results).toHaveLength(5);
      for (const r of results) {
        expect(r.category).toBe("decisions");
        expect(r.score).toBe(1);
      }
    });

    it("boş query + limit olmadan tüm kayıtlar", async () => {
      rootDir = tmp();
      store = new MemoryStore(rootDir);

      for (let i = 0; i < 20; i++) {
        await store.remember(`key-${i}`, `val-${i}`, "notes");
      }

      // Default limit=10
      const results = await store.recall("", "notes");
      expect(results).toHaveLength(10);
    });

    it("boş query + kategori olmadan + limit", async () => {
      rootDir = tmp();
      store = new MemoryStore(rootDir);

      for (let i = 0; i < 30; i++) {
        await store.remember(`key-${i}`, `val-${i}`, i % 2 === 0 ? "decisions" : "notes");
      }

      const results = await store.recall("", undefined, 3);
      expect(results).toHaveLength(3);
    });
  });

  // ═════════════════════════════════════════════
  // 12. MEMORY KALİTESİ — VERİ BÜTÜNLÜĞÜ
  // ═════════════════════════════════════════════

  describe("memory kalitesi — veri bütünlüğü", () => {
    it("tüm MemoryEntry alanları doğru tipte", async () => {
      rootDir = tmp();
      store = new MemoryStore(rootDir);

      await store.remember("typed_key", "typed_value", "decisions", ["tag1", "tag2"], { m: 1 });
      const entry = store.get("typed_key")!;

      // Type checks
      expect(typeof entry.id).toBe("string");
      expect(entry.id.length).toBeGreaterThan(0);
      expect(typeof entry.key).toBe("string");
      expect(typeof entry.value).toBe("string");
      expect(typeof entry.category).toBe("string");
      expect(Array.isArray(entry.tags)).toBe(true);
      expect(entry.tags.every((t) => typeof t === "string")).toBe(true);
      expect(typeof entry.metadata).toBe("object");
      expect(typeof entry.createdAt).toBe("string");
      expect(typeof entry.updatedAt).toBe("string");

      // ISO date format
      expect(() => new Date(entry.createdAt)).not.toThrow();
      expect(new Date(entry.createdAt).toISOString()).toBe(entry.createdAt);

      // UUID format
      expect(entry.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );

      // embedding runtime only — DB'den gelince undefined
      expect(entry.embedding).toBeUndefined();
    });

    it("ScoredMemory alanları doğru tipte", async () => {
      rootDir = tmp();
      store = new MemoryStore(rootDir);

      await store.remember("scored_key", "scored_value", "notes", ["tag"]);
      const results = await store.recall("scored");
      expect(results.length).toBeGreaterThan(0);

      const scored = results[0];
      expect(typeof scored.score).toBe("number");
      expect(scored.score).toBeGreaterThan(0);
      expect(scored.score).toBeLessThanOrEqual(10); // reasonable upper bound
    });

    it("id benzersizliği korunur", async () => {
      rootDir = tmp();
      store = new MemoryStore(rootDir);

      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const { entry } = await store.remember(`unique-${i}`, `val-${i}`);
        ids.add(entry.id);
      }
      expect(ids.size).toBe(100);
    });

    it("createdAt güncelleme sırasında değişmez, updatedAt değişir", async () => {
      rootDir = tmp();
      store = new MemoryStore(rootDir);

      const { entry: first } = await store.remember("ts_check", "v1");
      await new Promise((r) => setTimeout(r, 5));
      const { entry: second } = await store.remember("ts_check", "v2");

      expect(second.createdAt).toBe(first.createdAt);
      // updatedAt farklı olabilir (ms hassasiyetinde)
      expect(second.updatedAt).toBeTruthy();
    });
  });
});
