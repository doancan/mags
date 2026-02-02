import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { SessionManager } from "./session-manager.js";

function makeTmpDir(): string {
  const dir = join(tmpdir(), `mags-sess-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("SessionManager", () => {
  let magsDir: string;

  beforeEach(() => {
    magsDir = makeTmpDir();
  });

  afterEach(() => {
    rmSync(magsDir, { recursive: true, force: true });
  });

  // ── Boş / ilk kullanım ──────────────────────

  describe("boş / ilk kullanım", () => {
    it("sessions dizini yokken getLatest null döner", () => {
      const sm = new SessionManager(magsDir);
      expect(sm.getLatest()).toBeNull();
    });

    it("sessions dizini yokken listSessions boş döner", () => {
      const sm = new SessionManager(magsDir);
      expect(sm.listSessions()).toEqual([]);
    });

    it("varolmayan sessionId null döner", () => {
      const sm = new SessionManager(magsDir);
      expect(sm.getSession("2025-01-01-001")).toBeNull();
    });
  });

  // ── Save ─────────────────────────────────────

  describe("save", () => {
    it("session kaydeder ve doğru format döner", () => {
      const sm = new SessionManager(magsDir);

      const session = sm.save({
        summary: "Test session",
        decisions: ["Used JWT"],
        completed: ["Login page"],
        nextSteps: ["Add logout"],
        blockers: [],
      });

      expect(session.sessionId).toMatch(/^\d{4}-\d{2}-\d{2}-\d{3}$/);
      expect(session.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(session.summary).toBe("Test session");
      expect(session.decisions).toEqual(["Used JWT"]);
    });

    it("sessions dizinini otomatik oluşturur", () => {
      const sm = new SessionManager(magsDir);
      sm.save({ summary: "test", decisions: [], completed: [], nextSteps: [], blockers: [] });

      expect(existsSync(join(magsDir, "sessions"))).toBe(true);
    });

    it("latest.yaml güncellenir", () => {
      const sm = new SessionManager(magsDir);
      sm.save({ summary: "first", decisions: [], completed: [], nextSteps: [], blockers: [] });
      sm.save({ summary: "second", decisions: [], completed: [], nextSteps: [], blockers: [] });

      const latest = sm.getLatest();
      expect(latest?.summary).toBe("second");
    });
  });

  // ── Aynı gün çoklu session ──────────────────

  describe("aynı gün çoklu session", () => {
    it("sequence numarası artar (001, 002, 003)", () => {
      const sm = new SessionManager(magsDir);

      const s1 = sm.save({ summary: "s1", decisions: [], completed: [], nextSteps: [], blockers: [] });
      const s2 = sm.save({ summary: "s2", decisions: [], completed: [], nextSteps: [], blockers: [] });
      const s3 = sm.save({ summary: "s3", decisions: [], completed: [], nextSteps: [], blockers: [] });

      const date = s1.sessionId.split("-").slice(0, 3).join("-");
      expect(s1.sessionId).toBe(`${date}-001`);
      expect(s2.sessionId).toBe(`${date}-002`);
      expect(s3.sessionId).toBe(`${date}-003`);
    });
  });

  // ── getSession ───────────────────────────────

  describe("getSession", () => {
    it("sessionId ile getirir", () => {
      const sm = new SessionManager(magsDir);
      const saved = sm.save({
        summary: "specific session",
        decisions: ["decision A"],
        completed: [],
        nextSteps: [],
        blockers: [],
      });

      const retrieved = sm.getSession(saved.sessionId);
      expect(retrieved).toBeTruthy();
      expect(retrieved?.summary).toBe("specific session");
      expect(retrieved?.decisions).toEqual(["decision A"]);
    });
  });

  // ── listSessions ─────────────────────────────

  describe("listSessions", () => {
    it("son N session'ı ters kronolojik sırada döner", () => {
      const sm = new SessionManager(magsDir);

      sm.save({ summary: "first", decisions: [], completed: [], nextSteps: [], blockers: [] });
      sm.save({ summary: "second", decisions: [], completed: [], nextSteps: [], blockers: [] });
      sm.save({ summary: "third", decisions: [], completed: [], nextSteps: [], blockers: [] });

      const sessions = sm.listSessions(2);
      expect(sessions).toHaveLength(2);
      expect(sessions[0].summary).toBe("third");
      expect(sessions[1].summary).toBe("second");
    });

    it("latest.yaml listeye dahil edilmez", () => {
      const sm = new SessionManager(magsDir);
      sm.save({ summary: "test", decisions: [], completed: [], nextSteps: [], blockers: [] });

      const sessions = sm.listSessions();
      // latest.yaml filtrelenmeli, sadece asıl session dosyası olmalı
      const ids = sessions.map((s) => s.sessionId);
      expect(ids.every((id) => id !== "latest")).toBe(true);
    });

    it("limit varsayılan 10", () => {
      const sm = new SessionManager(magsDir);

      for (let i = 0; i < 15; i++) {
        sm.save({ summary: `s-${i}`, decisions: [], completed: [], nextSteps: [], blockers: [] });
      }

      const sessions = sm.listSessions();
      expect(sessions).toHaveLength(10);
    });
  });

  // ── Corrupted dosyalar ───────────────────────

  describe("corrupted dosyalar", () => {
    it("corrupted latest.yaml null döner", () => {
      const sm = new SessionManager(magsDir);
      const sessionsDir = join(magsDir, "sessions");
      mkdirSync(sessionsDir, { recursive: true });
      writeFileSync(join(sessionsDir, "latest.yaml"), "{{{{INVALID", "utf-8");

      expect(sm.getLatest()).toBeNull();
    });

    it("corrupted session dosyası null döner", () => {
      const sm = new SessionManager(magsDir);
      const sessionsDir = join(magsDir, "sessions");
      mkdirSync(sessionsDir, { recursive: true });
      writeFileSync(join(sessionsDir, "2025-01-01-001.yaml"), "{{BAD", "utf-8");

      expect(sm.getSession("2025-01-01-001")).toBeNull();
    });

    it("corrupted dosyalar listSessions'da atlanır", () => {
      const sm = new SessionManager(magsDir);
      sm.save({ summary: "good", decisions: [], completed: [], nextSteps: [], blockers: [] });

      const sessionsDir = join(magsDir, "sessions");
      writeFileSync(join(sessionsDir, "2025-01-01-999.yaml"), "{{BAD", "utf-8");

      const sessions = sm.listSessions();
      // En az 1 iyi session olmalı, corrupted atlanmalı
      expect(sessions.length).toBeGreaterThanOrEqual(1);
      expect(sessions.every((s) => s.summary !== undefined)).toBe(true);
    });
  });

  // ── Çok session senaryosu ────────────────────

  describe("çok session senaryosu", () => {
    it("50 session sorunsuz yönetilir", () => {
      const sm = new SessionManager(magsDir);

      for (let i = 0; i < 50; i++) {
        sm.save({
          summary: `Session ${i}: completed feature ${i}`,
          decisions: [`decision-${i}`],
          completed: [`task-${i}`],
          nextSteps: [`next-${i}`],
          blockers: i % 10 === 0 ? [`blocker-${i}`] : [],
        });
      }

      // Son session doğru olmalı
      const latest = sm.getLatest();
      expect(latest?.summary).toContain("Session 49");

      // Liste doğru çalışmalı
      const sessions = sm.listSessions(5);
      expect(sessions).toHaveLength(5);
    });
  });
});
