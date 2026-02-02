#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Auto-install native dependencies if missing
if [ ! -d "$SCRIPT_DIR/node_modules/better-sqlite3" ]; then
  cd "$SCRIPT_DIR"
  npm install --production --no-audit --no-fund --loglevel=error 2>&1 >&2
fi

exec node "$SCRIPT_DIR/dist/mags-server.bundle.mjs" "$@"
