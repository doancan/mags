#!/usr/bin/env bash
# ============================================
# MAGS — Version Bump Script
# Updates version in all 4 SSOT files,
# rebuilds the bundle, and runs tests.
# ============================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ── Validate input ──────────────────────────

if [ $# -lt 1 ]; then
  echo -e "${RED}Usage: $0 <version>${NC}"
  echo "  Example: $0 0.3.0"
  exit 1
fi

NEW_VERSION="$1"

# Validate semver format
if ! echo "$NEW_VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo -e "${RED}Error: Version must be in semver format (e.g., 0.3.0)${NC}"
  exit 1
fi

# ── Read current version ────────────────────

CURRENT_VERSION=$(node -e "console.log(require('$PROJECT_ROOT/package.json').version)")
echo -e "${YELLOW}Bumping version: ${CURRENT_VERSION} → ${NEW_VERSION}${NC}"

# ── Backup files for rollback ───────────────

BACKUP_DIR=$(mktemp -d)
cp "$PROJECT_ROOT/package.json" "$BACKUP_DIR/package.json"
cp "$PROJECT_ROOT/server/package.json" "$BACKUP_DIR/server-package.json"
cp "$PROJECT_ROOT/.claude-plugin/plugin.json" "$BACKUP_DIR/plugin.json"
cp "$PROJECT_ROOT/.claude-plugin/marketplace.json" "$BACKUP_DIR/marketplace.json"

rollback() {
  echo -e "${RED}Error occurred! Rolling back...${NC}"
  cp "$BACKUP_DIR/package.json" "$PROJECT_ROOT/package.json"
  cp "$BACKUP_DIR/server-package.json" "$PROJECT_ROOT/server/package.json"
  cp "$BACKUP_DIR/plugin.json" "$PROJECT_ROOT/.claude-plugin/plugin.json"
  cp "$BACKUP_DIR/marketplace.json" "$PROJECT_ROOT/.claude-plugin/marketplace.json"
  rm -rf "$BACKUP_DIR"
  echo -e "${RED}Rolled back to version ${CURRENT_VERSION}${NC}"
  exit 1
}
trap rollback ERR

# ── Update versions ─────────────────────────

echo "Updating package.json..."
node -e "
const fs = require('fs');
const path = '$PROJECT_ROOT/package.json';
const pkg = JSON.parse(fs.readFileSync(path, 'utf-8'));
pkg.version = '$NEW_VERSION';
fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
"

echo "Updating server/package.json..."
node -e "
const fs = require('fs');
const path = '$PROJECT_ROOT/server/package.json';
const pkg = JSON.parse(fs.readFileSync(path, 'utf-8'));
pkg.version = '$NEW_VERSION';
fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
"

echo "Updating .claude-plugin/plugin.json..."
node -e "
const fs = require('fs');
const path = '$PROJECT_ROOT/.claude-plugin/plugin.json';
const plugin = JSON.parse(fs.readFileSync(path, 'utf-8'));
plugin.version = '$NEW_VERSION';
fs.writeFileSync(path, JSON.stringify(plugin, null, 2) + '\n');
"

echo "Updating .claude-plugin/marketplace.json..."
node -e "
const fs = require('fs');
const path = '$PROJECT_ROOT/.claude-plugin/marketplace.json';
const market = JSON.parse(fs.readFileSync(path, 'utf-8'));
market.plugins[0].version = '$NEW_VERSION';
fs.writeFileSync(path, JSON.stringify(market, null, 2) + '\n');
"

# ── Rebuild bundle ──────────────────────────

echo "Rebuilding bundle..."
cd "$PROJECT_ROOT/server"
npm run bundle

# ── Run tests ───────────────────────────────

echo "Running tests..."
npm test

# ── Cleanup ─────────────────────────────────

rm -rf "$BACKUP_DIR"
trap - ERR

echo ""
echo -e "${GREEN}Version bumped successfully: ${CURRENT_VERSION} → ${NEW_VERSION}${NC}"
echo ""
echo "Files updated:"
echo "  - package.json"
echo "  - server/package.json"
echo "  - .claude-plugin/plugin.json"
echo "  - .claude-plugin/marketplace.json"
echo "  - server/dist/mags-server.bundle.mjs (rebuilt)"
echo ""
echo "Next steps:"
echo "  git add -A && git commit -m \"chore: bump version to ${NEW_VERSION}\""
