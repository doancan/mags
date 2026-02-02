#!/usr/bin/env node
// ============================================
// MAGS — Cross-platform MCP server launcher
// Ensures native dependencies are installed
// before starting the server.
// ============================================

import { existsSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync, execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SQLITE_MODULE = join(__dirname, "node_modules", "better-sqlite3");
const BUNDLE_PATH = join(__dirname, "dist", "mags-server.bundle.mjs");

let needsInstall = false;

// Check 1: node_modules/better-sqlite3 directory exists
if (!existsSync(SQLITE_MODULE)) {
  needsInstall = true;
}

// Check 2: native .node binary exists (handles partial/corrupted installs)
if (!needsInstall) {
  const hasBuild = existsSync(join(SQLITE_MODULE, "build", "Release", "better_sqlite3.node"));
  const hasPrebuilds = existsSync(join(SQLITE_MODULE, "prebuilds"));
  if (!hasBuild && !hasPrebuilds) {
    needsInstall = true;
  }
}

// Check 3: verify the module is actually loadable
if (!needsInstall) {
  try {
    execFileSync(process.execPath, ["-e", `require(${JSON.stringify(SQLITE_MODULE)})`], {
      stdio: "pipe",
      timeout: 10000,
    });
  } catch {
    needsInstall = true;
  }
}

if (needsInstall) {
  // Remove corrupted partial install if present
  if (existsSync(SQLITE_MODULE)) {
    rmSync(SQLITE_MODULE, { recursive: true, force: true });
  }

  try {
    execSync("npm install --production --no-audit --no-fund --loglevel=error", {
      cwd: __dirname,
      stdio: ["pipe", "pipe", "inherit"],
      timeout: 60000,
    });
  } catch (err) {
    process.stderr.write(`MAGS: Failed to install native dependencies: ${err.message}\n`);
    process.exit(1);
  }
}

// Start the MCP server
const { fork } = await import("node:child_process");
const child = fork(BUNDLE_PATH, process.argv.slice(2), {
  stdio: "inherit",
  cwd: __dirname,
});

child.on("exit", (code) => process.exit(code ?? 0));
