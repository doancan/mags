#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SQLITE_MODULE="$SCRIPT_DIR/node_modules/better-sqlite3"
NEEDS_INSTALL=0

# Check 1: node_modules/better-sqlite3 directory exists
if [ ! -d "$SQLITE_MODULE" ]; then
  NEEDS_INSTALL=1
fi

# Check 2: native .node binary exists (handles partial/corrupted installs)
if [ "$NEEDS_INSTALL" -eq 0 ] && [ ! -f "$SQLITE_MODULE/build/Release/better_sqlite3.node" ] && [ ! -f "$SQLITE_MODULE/prebuilds/"*"/node.napi.node" ] 2>/dev/null; then
  NEEDS_INSTALL=1
fi

# Check 3: verify the module is actually loadable (from SCRIPT_DIR so require resolves)
if [ "$NEEDS_INSTALL" -eq 0 ]; then
  if ! node -e "require('$SQLITE_MODULE')" --no-warnings 2>/dev/null; then
    NEEDS_INSTALL=1
  fi
fi

if [ "$NEEDS_INSTALL" -eq 1 ]; then
  cd "$SCRIPT_DIR"
  # Remove corrupted partial install if present
  if [ -d "$SQLITE_MODULE" ]; then
    rm -rf "$SQLITE_MODULE"
  fi
  npm install --production --no-audit --no-fund --loglevel=error 2>&1 >&2
fi

exec node "$SCRIPT_DIR/dist/mags-server.bundle.mjs" "$@"
