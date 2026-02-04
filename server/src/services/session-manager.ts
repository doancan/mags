// ============================================
// MAGS — Session Manager
// Handles session persistence and history
// ============================================

import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
} from "node:fs";
import { join } from "node:path";
import YAML from "yaml";
import type { SessionEntry } from "../types/index.js";

export class SessionManager {
  private sessionsDir: string;
  private latestPath: string;

  constructor(magsDir: string) {
    this.sessionsDir = join(magsDir, "sessions");
    this.latestPath = join(this.sessionsDir, "latest.yaml");
  }

  /**
   * Save a new session
   */
  save(session: Omit<SessionEntry, "sessionId" | "date">): SessionEntry {
    if (!existsSync(this.sessionsDir)) {
      mkdirSync(this.sessionsDir, { recursive: true });
    }

    const date = new Date().toISOString().split("T")[0];
    const seq = this.getNextSequence(date);
    const sessionId = `${date}-${String(seq).padStart(3, "0")}`;

    const entry: SessionEntry = {
      sessionId,
      date,
      ...session,
    };

    const filePath = join(this.sessionsDir, `${sessionId}.yaml`);
    writeFileSync(filePath, YAML.stringify(entry), "utf-8");

    // Update latest
    writeFileSync(this.latestPath, YAML.stringify(entry), "utf-8");

    return entry;
  }

  /**
   * Get the latest session
   */
  getLatest(): SessionEntry | null {
    if (!existsSync(this.latestPath)) return null;

    try {
      const raw = readFileSync(this.latestPath, "utf-8");
      return YAML.parse(raw) as SessionEntry;
    } catch (err) {
      console.warn("[SessionManager] Failed to parse latest session:", err instanceof Error ? err.message : err);
      return null;
    }
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): SessionEntry | null {
    const filePath = join(this.sessionsDir, `${sessionId}.yaml`);
    if (!existsSync(filePath)) return null;

    try {
      const raw = readFileSync(filePath, "utf-8");
      return YAML.parse(raw) as SessionEntry;
    } catch (err) {
      console.warn(`[SessionManager] Failed to parse session ${sessionId}:`, err instanceof Error ? err.message : err);
      return null;
    }
  }

  /**
   * List recent sessions
   */
  listSessions(limit = 10): SessionEntry[] {
    if (!existsSync(this.sessionsDir)) return [];

    const files = readdirSync(this.sessionsDir)
      .filter((f) => f.endsWith(".yaml") && f !== "latest.yaml")
      .sort()
      .reverse()
      .slice(0, limit);

    const sessions: SessionEntry[] = [];
    for (const file of files) {
      try {
        const raw = readFileSync(join(this.sessionsDir, file), "utf-8");
        sessions.push(YAML.parse(raw) as SessionEntry);
      } catch (err) {
        console.warn(`[SessionManager] Failed to parse session file ${file}:`, err instanceof Error ? err.message : err);
      }
    }

    return sessions;
  }

  // --- Private ---

  private getNextSequence(date: string): number {
    if (!existsSync(this.sessionsDir)) return 1;

    const files = readdirSync(this.sessionsDir).filter((f) =>
      f.startsWith(date)
    );

    return files.length + 1;
  }
}
