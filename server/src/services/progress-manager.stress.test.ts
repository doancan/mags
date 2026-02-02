/**
 * ProgressManager — Zorlu & Stres Testleri
 *
 * - Circular dependency
 * - Diamond dependency (A → B, A → C, B → D, C → D)
 * - 100 modül, her biri 20 item
 * - Rapid status toggle
 * - Modül ekleme sonrası dependency check
 * - completionPercent precision
 * - Persistence → reload → tutarlılık
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { ProgressManager } from "./progress-manager.js";
import type { ModuleProgress, ModuleStatus } from "../types/index.js";

function tmp(): string {
  const d = join(tmpdir(), `mags-pm-stress-${randomUUID()}`);
  mkdirSync(d, { recursive: true });
  return d;
}

function mod(
  overrides: Partial<ModuleProgress> & { name: string }
): Omit<ModuleProgress, "completionPercent"> {
  return {
    name: overrides.name,
    status: overrides.status ?? "not_started",
    phase: overrides.phase ?? 1,
    priority: overrides.priority ?? 1,
    dependsOn: overrides.dependsOn ?? [],
    items: overrides.items ?? [],
  };
}

describe("ProgressManager — Zorlu Testler", () => {
  let dir: string;
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  // ─────────────────────────────────────────────
  // 1. Circular dependency
  // ─────────────────────────────────────────────

  describe("circular dependency", () => {
    beforeEach(() => {
      dir = tmp();
    });

    it("A → B → A döngüsünde hiçbir modül getNext'te görünmez", () => {
      const pm = new ProgressManager(dir);
      pm.initialize("test", [
        mod({
          name: "A",
          dependsOn: ["B"],
          items: [{ name: "a1", status: "not_started" }],
        }),
        mod({
          name: "B",
          dependsOn: ["A"],
          items: [{ name: "b1", status: "not_started" }],
        }),
      ]);

      const next = pm.getNext();
      // Her ikisi de diğerine bağımlı → hiçbiri açılmaz
      expect(next).toEqual([]);
    });

    it("üçlü döngü (A → B → C → A) hiçbir modül erişilemez", () => {
      const pm = new ProgressManager(dir);
      pm.initialize("test", [
        mod({ name: "A", dependsOn: ["C"], items: [{ name: "a1", status: "not_started" }] }),
        mod({ name: "B", dependsOn: ["A"], items: [{ name: "b1", status: "not_started" }] }),
        mod({ name: "C", dependsOn: ["B"], items: [{ name: "c1", status: "not_started" }] }),
      ]);

      expect(pm.getNext()).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────
  // 1b. Re-init koruması (tool katmanında, burada belgelenir)
  // ─────────────────────────────────────────────

  describe("re-init koruması", () => {
    beforeEach(() => {
      dir = tmp();
    });

    it("initialize iki kez çağrılabilir (koruma tool katmanında)", () => {
      const pm = new ProgressManager(dir);
      pm.initialize("test-1", [mod({ name: "A" })]);
      // Core service allows re-init; tool layer guards this
      const progress = pm.initialize("test-2", [mod({ name: "B" })]);
      expect(progress.project).toBe("test-2");
    });
  });

  // ─────────────────────────────────────────────
  // 1c. Dependency uyarı on update with unmet deps
  // ─────────────────────────────────────────────

  describe("dependency uyarı on update", () => {
    beforeEach(() => {
      dir = tmp();
    });

    it("unmet dependency olan modülün getUnmetDependencies listesi döner", () => {
      const pm = new ProgressManager(dir);
      pm.initialize("test", [
        mod({ name: "auth", items: [{ name: "login", status: "not_started" }] }),
        mod({
          name: "api",
          dependsOn: ["auth"],
          items: [{ name: "endpoints", status: "not_started" }],
        }),
      ]);

      const unmet = pm.getUnmetDependencies("api");
      expect(unmet).toEqual(["auth"]);

      // auth tamamla
      pm.updateProgress("auth", "login", "completed");
      pm.updateProgress("auth", undefined, "completed");

      const unmet2 = pm.getUnmetDependencies("api");
      expect(unmet2).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────
  // 2. Diamond dependency
  // ─────────────────────────────────────────────

  describe("diamond dependency (A → B,C → D)", () => {
    beforeEach(() => {
      dir = tmp();
    });

    it("diamond bağımlılık doğru çözülür", () => {
      const pm = new ProgressManager(dir);
      pm.initialize("test", [
        mod({ name: "A", priority: 1, items: [{ name: "a1", status: "not_started" }] }),
        mod({
          name: "B",
          priority: 2,
          dependsOn: ["A"],
          items: [{ name: "b1", status: "not_started" }],
        }),
        mod({
          name: "C",
          priority: 2,
          dependsOn: ["A"],
          items: [{ name: "c1", status: "not_started" }],
        }),
        mod({
          name: "D",
          priority: 3,
          dependsOn: ["B", "C"],
          items: [{ name: "d1", status: "not_started" }],
        }),
      ]);

      // İlk: sadece A
      let next = pm.getNext();
      expect(next).toHaveLength(1);
      expect(next[0].module).toBe("A");

      // A tamamla
      pm.updateProgress("A", "a1", "completed");

      // B ve C paralel açılır, D kapalı
      next = pm.getNext();
      const modules = next.map((n) => n.module).sort();
      expect(modules).toEqual(["B", "C"]);

      // Sadece B tamamla — D hala kapalı
      pm.updateProgress("B", "b1", "completed");
      next = pm.getNext();
      expect(next.map((n) => n.module)).toEqual(["C"]);

      // C de tamamla → D açılır
      pm.updateProgress("C", "c1", "completed");
      next = pm.getNext();
      expect(next).toHaveLength(1);
      expect(next[0].module).toBe("D");
    });
  });

  // ─────────────────────────────────────────────
  // 3. 100 modül, her biri 20 item
  // ─────────────────────────────────────────────

  describe("büyük proje (100 modül × 20 item)", () => {
    beforeEach(() => {
      dir = tmp();
    });

    it("2000 item'ı yönetir", () => {
      const pm = new ProgressManager(dir);
      const modules = Array.from({ length: 100 }, (_, i) =>
        mod({
          name: `mod-${i}`,
          priority: i + 1,
          items: Array.from({ length: 20 }, (_, j) => ({
            name: `item-${j}`,
            status: "not_started" as ModuleStatus,
          })),
        })
      );

      pm.initialize("mega-project", modules);

      const progress = pm.getProgress() as any;
      expect(progress.modules).toHaveLength(100);
      expect(progress.modules[0].items).toHaveLength(20);
    });

    it("ilk modülün tüm item'larını tamamlama", () => {
      const pm = new ProgressManager(dir);
      pm.initialize("test", [
        mod({
          name: "mod-0",
          items: Array.from({ length: 20 }, (_, j) => ({
            name: `item-${j}`,
            status: "not_started" as ModuleStatus,
          })),
        }),
      ]);

      for (let j = 0; j < 20; j++) {
        pm.updateProgress("mod-0", `item-${j}`, "completed");
      }

      const m = pm.getProgress("mod-0") as ModuleProgress;
      expect(m.status).toBe("completed");
      expect(m.completionPercent).toBe(100);
    });

    it("persistence → reload 2000 item tutarlı", () => {
      const pm = new ProgressManager(dir);
      const modules = Array.from({ length: 100 }, (_, i) =>
        mod({
          name: `mod-${i}`,
          priority: i + 1,
          items: Array.from({ length: 20 }, (_, j) => ({
            name: `item-${j}`,
            status: j < 5 ? ("completed" as ModuleStatus) : ("not_started" as ModuleStatus),
          })),
        })
      );
      pm.initialize("mega", modules);

      const pm2 = new ProgressManager(dir);
      pm2.load();

      const m0 = pm2.getProgress("mod-0") as ModuleProgress;
      expect(m0.completionPercent).toBe(25); // 5/20
      expect(m0.status).toBe("in_progress"); // bazıları completed
    });
  });

  // ─────────────────────────────────────────────
  // 4. Rapid status toggle
  // ─────────────────────────────────────────────

  describe("rapid status toggle", () => {
    beforeEach(() => {
      dir = tmp();
    });

    it("item status'ı hızlıca değiştirilir → son durum geçerli", () => {
      const pm = new ProgressManager(dir);
      pm.initialize("test", [
        mod({
          name: "auth",
          items: [{ name: "login", status: "not_started" }],
        }),
      ]);

      const statuses: ModuleStatus[] = [
        "in_progress",
        "blocked",
        "in_progress",
        "completed",
        "in_progress",
        "completed",
      ];

      for (const s of statuses) {
        pm.updateProgress("auth", "login", s);
      }

      const m = pm.getProgress("auth") as ModuleProgress;
      expect(m.items[0].status).toBe("completed");
    });

    it("modül status toggle → completionPercent tutarlı", () => {
      const pm = new ProgressManager(dir);
      pm.initialize("test", [
        mod({
          name: "auth",
          items: [
            { name: "a", status: "not_started" },
            { name: "b", status: "not_started" },
          ],
        }),
      ]);

      pm.updateProgress("auth", "a", "completed");
      let m = pm.getProgress("auth") as ModuleProgress;
      expect(m.completionPercent).toBe(50);

      pm.updateProgress("auth", "a", "not_started"); // geri al
      m = pm.getProgress("auth") as ModuleProgress;
      expect(m.completionPercent).toBe(0);

      pm.updateProgress("auth", "a", "completed");
      pm.updateProgress("auth", "b", "completed");
      m = pm.getProgress("auth") as ModuleProgress;
      expect(m.completionPercent).toBe(100);
    });
  });

  // ─────────────────────────────────────────────
  // 5. addModule + dependency interaction
  // ─────────────────────────────────────────────

  describe("addModule + dependency interaction", () => {
    beforeEach(() => {
      dir = tmp();
    });

    it("runtime'da eklenen modül dependency check'e dahil olur", () => {
      const pm = new ProgressManager(dir);
      pm.initialize("test", [
        mod({
          name: "auth",
          items: [{ name: "login", status: "not_started" }],
        }),
      ]);

      pm.addModule(
        mod({
          name: "api",
          dependsOn: ["auth"],
          items: [{ name: "endpoints", status: "not_started" }],
        })
      );

      let next = pm.getNext();
      expect(next.map((n) => n.module)).toEqual(["auth"]);

      pm.updateProgress("auth", "login", "completed");

      next = pm.getNext();
      expect(next.map((n) => n.module)).toContain("api");
    });

    it("varolmayan dependency'ye sahip modül erişilemez", () => {
      const pm = new ProgressManager(dir);
      pm.initialize("test", [
        mod({
          name: "lonely",
          dependsOn: ["nonexistent_module"],
          items: [{ name: "task", status: "not_started" }],
        }),
      ]);

      const next = pm.getNext();
      expect(next).toEqual([]); // nonexistent tamamlanmamış sayılır
    });
  });

  // ─────────────────────────────────────────────
  // 6. completionPercent precision
  // ─────────────────────────────────────────────

  describe("completionPercent precision", () => {
    beforeEach(() => {
      dir = tmp();
    });

    it("1/3 = %33 (Math.round)", () => {
      const pm = new ProgressManager(dir);
      pm.initialize("test", [
        mod({
          name: "auth",
          items: [
            { name: "a", status: "completed" },
            { name: "b", status: "not_started" },
            { name: "c", status: "not_started" },
          ],
        }),
      ]);
      expect((pm.getProgress("auth") as ModuleProgress).completionPercent).toBe(33);
    });

    it("2/3 = %67 (Math.round)", () => {
      const pm = new ProgressManager(dir);
      pm.initialize("test", [
        mod({
          name: "auth",
          items: [
            { name: "a", status: "completed" },
            { name: "b", status: "completed" },
            { name: "c", status: "not_started" },
          ],
        }),
      ]);
      expect((pm.getProgress("auth") as ModuleProgress).completionPercent).toBe(67);
    });

    it("1/7 = %14 (Math.round)", () => {
      const pm = new ProgressManager(dir);
      pm.initialize("test", [
        mod({
          name: "auth",
          items: Array.from({ length: 7 }, (_, i) => ({
            name: `i${i}`,
            status: (i === 0 ? "completed" : "not_started") as ModuleStatus,
          })),
        }),
      ]);
      expect((pm.getProgress("auth") as ModuleProgress).completionPercent).toBe(14);
    });

    it("tek item completed = %100", () => {
      const pm = new ProgressManager(dir);
      pm.initialize("test", [
        mod({
          name: "single",
          items: [{ name: "only", status: "completed" }],
        }),
      ]);
      expect((pm.getProgress("single") as ModuleProgress).completionPercent).toBe(100);
    });
  });

  // ─────────────────────────────────────────────
  // 7. getProgress edge case'ler
  // ─────────────────────────────────────────────

  describe("getProgress edge case'ler", () => {
    beforeEach(() => {
      dir = tmp();
    });

    it("varolmayan modül adıyla getProgress null döner", () => {
      const pm = new ProgressManager(dir);
      pm.initialize("test", [mod({ name: "auth" })]);

      expect(pm.getProgress("nonexistent")).toBeNull();
    });

    it("case-insensitive modül adı getProgress'te çalışır", () => {
      const pm = new ProgressManager(dir);
      pm.initialize("test", [mod({ name: "Auth" })]);

      expect(pm.getProgress("auth")).toBeTruthy();
      expect(pm.getProgress("AUTH")).toBeTruthy();
      expect(pm.getProgress("Auth")).toBeTruthy();
    });

    it("modül adı boş string → tüm progress döner (falsy check)", () => {
      const pm = new ProgressManager(dir);
      pm.initialize("test", [mod({ name: "auth" })]);

      // "" falsy olduğundan moduleName koşulu atlanır, tüm progress döner
      const result = pm.getProgress("");
      expect(result).toBeTruthy();
      expect((result as any).project).toBe("test");
    });
  });

  // ─────────────────────────────────────────────
  // 8. Karmaşık gerçek dünya senaryosu
  // ─────────────────────────────────────────────

  describe("gerçek dünya senaryosu: e-commerce platform", () => {
    beforeEach(() => {
      dir = tmp();
    });

    it("tam lifecycle: initialize → work → complete → new phase", () => {
      const pm = new ProgressManager(dir);
      pm.initialize("ecommerce", [
        mod({
          name: "auth",
          priority: 1,
          phase: 1,
          items: [
            { name: "login", status: "not_started" },
            { name: "register", status: "not_started" },
            { name: "forgot-password", status: "not_started" },
          ],
        }),
        mod({
          name: "products",
          priority: 2,
          phase: 1,
          dependsOn: ["auth"],
          items: [
            { name: "list", status: "not_started" },
            { name: "detail", status: "not_started" },
            { name: "search", status: "not_started" },
          ],
        }),
        mod({
          name: "cart",
          priority: 3,
          phase: 2,
          dependsOn: ["products"],
          items: [
            { name: "add-to-cart", status: "not_started" },
            { name: "remove-from-cart", status: "not_started" },
            { name: "checkout", status: "not_started" },
          ],
        }),
        mod({
          name: "payments",
          priority: 4,
          phase: 2,
          dependsOn: ["cart"],
          items: [
            { name: "stripe-integration", status: "not_started" },
            { name: "invoice", status: "not_started" },
          ],
        }),
      ]);

      // Phase 1: auth
      let next = pm.getNext();
      expect(next[0].module).toBe("auth");

      pm.updateProgress("auth", "login", "in_progress");
      let auth = pm.getProgress("auth") as ModuleProgress;
      expect(auth.status).toBe("in_progress");

      pm.updateProgress("auth", "login", "completed");
      pm.updateProgress("auth", "register", "completed");
      pm.updateProgress("auth", "forgot-password", "completed");

      auth = pm.getProgress("auth") as ModuleProgress;
      expect(auth.status).toBe("completed");
      expect(auth.completionPercent).toBe(100);

      // Phase 1: products açıldı
      next = pm.getNext();
      expect(next[0].module).toBe("products");

      pm.updateProgress("products", "list", "completed");
      pm.updateProgress("products", "detail", "completed");
      pm.updateProgress("products", "search", "blocked", "Elasticsearch not ready");

      let products = pm.getProgress("products") as ModuleProgress;
      expect(products.status).toBe("blocked"); // completed + blocked = blocked
      expect(products.completionPercent).toBe(67);

      // Cart blocked çünkü products tamamlanmadı
      next = pm.getNext();
      expect(next).toEqual([]); // products blocked, cart bekliyor

      // Search'ü tamamla
      pm.updateProgress("products", "search", "completed");
      products = pm.getProgress("products") as ModuleProgress;
      expect(products.status).toBe("completed");

      // Phase 2: cart açıldı
      next = pm.getNext();
      expect(next[0].module).toBe("cart");

      // Tüm cart item'ları tamamla
      pm.updateProgress("cart", "add-to-cart", "completed");
      pm.updateProgress("cart", "remove-from-cart", "completed");
      pm.updateProgress("cart", "checkout", "completed");

      // Payments açıldı
      next = pm.getNext();
      expect(next[0].module).toBe("payments");

      pm.updateProgress("payments", "stripe-integration", "completed");
      pm.updateProgress("payments", "invoice", "completed");

      // Tüm proje tamamlandı
      next = pm.getNext();
      expect(next).toEqual([]);

      // Reload sonrası tutarlılık
      const pm2 = new ProgressManager(dir);
      pm2.load();
      const allProgress = pm2.getProgress() as any;
      expect(allProgress.modules.every((m: any) => m.status === "completed")).toBe(true);
      expect(allProgress.modules.every((m: any) => m.completionPercent === 100)).toBe(true);
    });
  });
});
