#!/usr/bin/env bash
#
# scripts/install.sh - Install the built plugin into an Obsidian vault.
#
# Requirements: node (to read manifest.json), and a successful build
# (npm run build) so dist/main.js exists.

set -euo pipefail

VAULT="${1:-${OBSIDIAN_VAULT:-}}"

usage() {
  echo "Usage: npm run install-plugin \"/path/to/Vault\"" >&2
  echo "       OBSIDIAN_VAULT=\"/path/to/Vault\" npm run install-plugin" >&2
}

if [[ -z "$VAULT" ]]; then
  echo "error: no vault path given." >&2
  usage
  exit 1
fi

if [[ ! -d "$VAULT" ]]; then
  echo "error: vault directory not found: $VAULT" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "error: 'node' is required but was not found in PATH." >&2
  exit 1
fi

PLUGIN_ID="$(node -p "JSON.parse(require('fs').readFileSync('manifest.json','utf8')).id")"
TARGET="$VAULT/.obsidian/plugins/$PLUGIN_ID"

mkdir -p "$TARGET"

for file in dist/main.js manifest.json styles.css; do
  if [[ ! -f "$file" ]]; then
    echo "error: required file not found: $file (run 'npm run build' first)." >&2
    exit 1
  fi
  cp "$file" "$TARGET/"
  echo "    copied $file -> $TARGET/$(basename "$file")"
done

echo "Installed $PLUGIN_ID to $TARGET ⊹₊⋆ ✧"
echo 'Reload Obsidian, then enable "Code Diff" in Settings > Community plugins.'