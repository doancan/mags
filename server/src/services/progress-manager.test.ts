import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { ProgressManager } from "./progress-manager.js";
import type { ModuleProgress, ModuleStatus } from "../types/index.js";

function makeTmpDir(): string {
  const dir = join(tmpdir(), `mags-prog-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function makeModule(overrides: Partial<ModuleProgress> & { name: string }): Omit<ModuleProgress, "completionPercent"> {
  return {
    name: overrides.name,
    status: overrides.status ?? "not_started",
    phase: overrides.phase ?? 1,
    priority: overrides.priority ?? 1,
    dependsOn: overrides.dependsOn ?? [],
    items: overrides.items ?? [],
  };
}

describe("ProgressManager", () => {
  let magsDir: string;

  beforeEach(() => {
    magsDir = makeTmpDir();
  });

  afterEach(() => {
    rmSync(magsDir, { recursive: true, force: true });
  });

  // ── Boş proje ────────────────────────────────

  describe("boş proje / ilk kullanım", () => {
    it("dosya yokken load null döner", () => {
      const pm = new ProgressManager(magsDir);
      expect(pm.load()).toBeNull();
    });

    it("dosya yokken getProgress null döner", () => {
      const pm = new ProgressManager(magsDir);
      expect(pm.getProgress()).toBeNull();
    });

    it("dosya yokken getNext boş döner", () => {
      const pm = new ProgressManager(magsDir);
      expect(pm.getNext()).toEqual([]);
    });

    it("dosya yokken updateProgress false döner", () => {
      const pm = new ProgressManager(magsDir);
      expect(pm.updateProgress("auth")).toBe(false);
    });
  });

  // ── Initialize ───────────────────────────────

  describe("initialize", () => {
    it("yeni proje oluşturur ve dosyaya yazar", () => {
      const pm = new ProgressManager(magsDir);

      const progress = pm.initialize("test-project", [
        makeModule({ name: "auth", priority: 1 }),
        makeModule({ name: "api", priority: 2, dependsOn: ["auth"] }),
      ]);

      expect(progress.project).toBe("test-project");
      expect(progress.modules).toHaveLength(2);
      expect(progress.modules[0].completionPercent).toBe(0);
      expect(existsSync(join(magsDir, "progress.yaml"))).toBe(true);
    });

    it("initialize sonrası load çalışır", () => {
      const pm = new ProgressManager(magsDir);
      pm.initialize("test-project", [
        makeModule({ name: "auth" }),
      ]);

      const pm2 = new ProgressManager(magsDir);
      const progress = pm2.load();

      expect(progress).toBeTruthy();
      expect(progress?.project).toBe("test-project");
    });
  });

  // ── Status auto-calculation ──────────────────

  describe("status auto-calculation", () => {
    let pm: ProgressManager;

    beforeEach(() => {
      pm = new ProgressManager(magsDir);
      pm.initialize("test", [
        makeModule({
          name: "auth",
          items: [
            { name: "login", status: "not_started" },
            { name: "register", status: "not_started" },
            { name: "logout", status: "not_started" },
          ],
        }),
      ]);
    });

    it("tüm item not_started → module not_started", () => {
      const mod = pm.getProgress("auth") as ModuleProgress;
      expect(mod.status).toBe("not_started");
    });

    it("bir item in_progress → module in_progress", () => {
      pm.updateProgress("auth", "login", "in_progress");

      const mod = pm.getProgress("auth") as ModuleProgress;
      expect(mod.status).toBe("in_progress");
    });

    it("bazı item completed → module in_progress", () => {
      pm.updateProgress("auth", "login", "completed");

      const mod = pm.getProgress("auth") as ModuleProgress;
      expect(mod.status).toBe("in_progress");
    });

    it("tüm item completed → module completed", () => {
      pm.updateProgress("auth", "login", "completed");
      pm.updateProgress("auth", "register", "completed");
      pm.updateProgress("auth", "logout", "completed");

      const mod = pm.getProgress("auth") as ModuleProgress;
      expect(mod.status).toBe("completed");
    });

    it("kalan tüm item blocked → module blocked", () => {
      pm.updateProgress("auth", "login", "completed");
      pm.updateProgress("auth", "register", "blocked");
      pm.updateProgress("auth", "logout", "blocked");

      const mod = pm.getProgress("auth") as ModuleProgress;
      expect(mod.status).toBe("blocked");
    });

    it("item + blocked karışık ama in_progress var → in_progress", () => {
      pm.updateProgress("auth", "login", "in_progress");
      pm.updateProgress("auth", "register", "blocked");

      const mod = pm.getProgress("auth") as ModuleProgress;
      expect(mod.status).toBe("in_progress");
    });
  });

  // ── Completion percent ───────────────────────

  describe("completion percent", () => {
    it("0/3 completed → %0", () => {
      const pm = new ProgressManager(magsDir);
      pm.initialize("test", [
        makeModule({
          name: "auth",
          items: [
            { name: "a", status: "not_started" },
            { name: "b", status: "not_started" },
            { name: "c", status: "not_started" },
          ],
        }),
      ]);

      const mod = pm.getProgress("auth") as ModuleProgress;
      expect(mod.completionPercent).toBe(0);
    });

    it("1/3 completed → %33", () => {
      const pm = new ProgressManager(magsDir);
      pm.initialize("test", [
        makeModule({
          name: "auth",
          items: [
            { name: "a", status: "completed" },
            { name: "b", status: "not_started" },
            { name: "c", status: "not_started" },
          ],
        }),
      ]);

      const mod = pm.getProgress("auth") as ModuleProgress;
      expect(mod.completionPercent).toBe(33);
    });

    it("3/3 completed → %100", () => {
      const pm = new ProgressManager(magsDir);
      pm.initialize("test", [
        makeModule({
          name: "auth",
          items: [
            { name: "a", status: "completed" },
            { name: "b", status: "completed" },
            { name: "c", status: "completed" },
          ],
        }),
      ]);

      const mod = pm.getProgress("auth") as ModuleProgress;
      expect(mod.completionPercent).toBe(100);
    });

    it("item olmayan modül, status completed → %100", () => {
      const pm = new ProgressManager(magsDir);
      pm.initialize("test", [
        makeModule({ name: "setup", status: "completed", items: [] }),
      ]);

      const mod = pm.getProgress("setup") as ModuleProgress;
      expect(mod.completionPercent).toBe(100);
    });

    it("item olmayan modül, status not_started → %0", () => {
      const pm = new ProgressManager(magsDir);
      pm.initialize("test", [
        makeModule({ name: "setup", items: [] }),
      ]);

      const mod = pm.getProgress("setup") as ModuleProgress;
      expect(mod.completionPercent).toBe(0);
    });
  });

  // ── Dependency resolution / getNext ──────────

  describe("dependency resolution (getNext)", () => {
    it("bağımlılığı olmayan modüllerin item'ları döner", () => {
      const pm = new ProgressManager(magsDir);
      pm.initialize("test", [
        makeModule({
          name: "auth",
          priority: 1,
          items: [{ name: "login", status: "not_started" }],
        }),
        makeModule({
          name: "api",
          priority: 2,
          dependsOn: ["auth"],
          items: [{ name: "endpoints", status: "not_started" }],
        }),
      ]);

      const next = pm.getNext();

      expect(next).toHaveLength(1);
      expect(next[0].module).toBe("auth");
      expect(next[0].item).toBe("login");
    });

    it("bağımlılık tamamlanınca sonraki modül açılır", () => {
      const pm = new ProgressManager(magsDir);
      pm.initialize("test", [
        makeModule({
          name: "auth",
          priority: 1,
          items: [{ name: "login", status: "completed" }],
          status: "completed",
        }),
        makeModule({
          name: "api",
          priority: 2,
          dependsOn: ["auth"],
          items: [{ name: "endpoints", status: "not_started" }],
        }),
      ]);

      const next = pm.getNext();

      expect(next.length).toBeGreaterThan(0);
      expect(next[0].module).toBe("api");
    });

    it("tamamlanmış modüller getNext'te görünmez", () => {
      const pm = new ProgressManager(magsDir);
      pm.initialize("test", [
        makeModule({
          name: "auth",
          status: "completed",
          items: [{ name: "login", status: "completed" }],
        }),
      ]);

      const next = pm.getNext();
      expect(next).toEqual([]);
    });

    it("priority sıralaması çalışır", () => {
      const pm = new ProgressManager(magsDir);
      pm.initialize("test", [
        makeModule({
          name: "low",
          priority: 3,
          items: [{ name: "item", status: "not_started" }],
        }),
        makeModule({
          name: "high",
          priority: 1,
          items: [{ name: "item", status: "not_started" }],
        }),
        makeModule({
          name: "mid",
          priority: 2,
          items: [{ name: "item", status: "not_started" }],
        }),
      ]);

      const next = pm.getNext();

      expect(next[0].module).toBe("high");
      expect(next[1].module).toBe("mid");
      expect(next[2].module).toBe("low");
    });

    it("zincirleme bağımlılıklar çalışır (A → B → C)", () => {
      const pm = new ProgressManager(magsDir);
      pm.initialize("test", [
        makeModule({
          name: "A",
          priority: 1,
          items: [{ name: "a1", status: "not_started" }],
        }),
        makeModule({
          name: "B",
          priority: 2,
          dependsOn: ["A"],
          items: [{ name: "b1", status: "not_started" }],
        }),
        makeModule({
          name: "C",
          priority: 3,
          dependsOn: ["B"],
          items: [{ name: "c1", status: "not_started" }],
        }),
      ]);

      // Sadece A açık
      let next = pm.getNext();
      expect(next).toHaveLength(1);
      expect(next[0].module).toBe("A");

      // A'yı tamamla
      pm.updateProgress("A", "a1", "completed");

      // Şimdi B açılmalı, C hala kapalı
      next = pm.getNext();
      expect(next).toHaveLength(1);
      expect(next[0].module).toBe("B");
    });
  });

  // ── updateProgress edge case'ler ─────────────

  describe("updateProgress edge case'ler", () => {
    it("varolmayan modül false döner", () => {
      const pm = new ProgressManager(magsDir);
      pm.initialize("test", [makeModule({ name: "auth" })]);

      expect(pm.updateProgress("nonexistent")).toBe(false);
    });

    it("case-insensitive modül adı çalışır", () => {
      const pm = new ProgressManager(magsDir);
      pm.initialize("test", [
        makeModule({
          name: "Auth",
          items: [{ name: "Login", status: "not_started" }],
        }),
      ]);

      expect(pm.updateProgress("auth", "login", "completed")).toBe(true);

      const mod = pm.getProgress("auth") as ModuleProgress;
      const item = mod.items.find((i) => i.name === "Login");
      expect(item?.status).toBe("completed");
    });

    it("varolmayan item false döner ve eklenmez", () => {
      const pm = new ProgressManager(magsDir);
      pm.initialize("test", [makeModule({ name: "auth", items: [] })]);

      const result = pm.updateProgress("auth", "new_feature", "in_progress");

      expect(result).toBe(false);
      const mod = pm.getProgress("auth") as ModuleProgress;
      expect(mod.items).toHaveLength(0);
    });

    it("modül status'ı doğrudan değiştirilebilir", () => {
      const pm = new ProgressManager(magsDir);
      pm.initialize("test", [makeModule({ name: "auth" })]);

      pm.updateProgress("auth", undefined, "completed");

      const mod = pm.getProgress("auth") as ModuleProgress;
      expect(mod.status).toBe("completed");
    });

    it("notes güncellenir", () => {
      const pm = new ProgressManager(magsDir);
      pm.initialize("test", [
        makeModule({
          name: "auth",
          items: [{ name: "login", status: "not_started" }],
        }),
      ]);

      pm.updateProgress("auth", "login", "in_progress", "WIP: form validation");

      const mod = pm.getProgress("auth") as ModuleProgress;
      expect(mod.items[0].notes).toBe("WIP: form validation");
    });
  });

  // ── addModule ────────────────────────────────

  describe("addModule", () => {
    it("mevcut projeye modül ekler", () => {
      const pm = new ProgressManager(magsDir);
      pm.initialize("test", [makeModule({ name: "auth" })]);

      pm.addModule(makeModule({ name: "payments", priority: 5 }));

      const progress = pm.getProgress() as any;
      expect(progress.modules).toHaveLength(2);
      expect(progress.modules[1].name).toBe("payments");
    });

    it("progress null iken sessizce geçer", () => {
      const pm = new ProgressManager(magsDir);
      // initialize etmeden
      pm.addModule(makeModule({ name: "test" }));
      // hata fırlatmaz
      expect(pm.getProgress()).toBeNull();
    });
  });

  // ── Dependency doğrulama ────────────────────

  describe("dependency doğrulama", () => {
    it("orphan dependency uyarı döner", () => {
      const pm = new ProgressManager(magsDir);

      const progress = pm.initialize("test", [
        makeModule({ name: "auth", dependsOn: ["nonexistent"] }),
      ]);

      expect("warnings" in progress).toBe(true);
      const warnings = (progress as any).warnings as string[];
      expect(warnings.some((w: string) => w.includes("nonexistent") && w.includes("does not exist"))).toBe(true);
    });

    it("circular dependency uyarı döner", () => {
      const pm = new ProgressManager(magsDir);

      const progress = pm.initialize("test", [
        makeModule({ name: "A", dependsOn: ["B"] }),
        makeModule({ name: "B", dependsOn: ["A"] }),
      ]);

      expect("warnings" in progress).toBe(true);
      const warnings = (progress as any).warnings as string[];
      expect(warnings.some((w: string) => w.includes("Circular dependency"))).toBe(true);
    });

    it("geçerli graf uyarı döndürmez", () => {
      const pm = new ProgressManager(magsDir);

      const progress = pm.initialize("test", [
        makeModule({ name: "auth" }),
        makeModule({ name: "api", dependsOn: ["auth"] }),
      ]);

      expect("warnings" in progress).toBe(false);
    });
  });

  // ── Büyük proje senaryosu ────────────────────

  describe("büyük proje senaryosu (20 modül)", () => {
    it("çok modüllü projeyi yönetir", () => {
      const pm = new ProgressManager(magsDir);

      const modules = Array.from({ length: 20 }, (_, i) =>
        makeModule({
          name: `module-${i}`,
          priority: i + 1,
          dependsOn: i > 0 ? [`module-${i - 1}`] : [],
          items: [
            { name: "setup", status: "not_started" },
            { name: "impl", status: "not_started" },
            { name: "test", status: "not_started" },
          ],
        })
      );

      pm.initialize("big-project", modules);

      // Sadece ilk modül erişilebilir
      const next = pm.getNext();
      expect(next[0].module).toBe("module-0");

      // İlk modülü tamamla
      pm.updateProgress("module-0", "setup", "completed");
      pm.updateProgress("module-0", "impl", "completed");
      pm.updateProgress("module-0", "test", "completed");

      // İkinci modül açılmalı
      const next2 = pm.getNext();
      expect(next2[0].module).toBe("module-1");
    });
  });
});
