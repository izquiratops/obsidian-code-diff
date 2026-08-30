#!/usr/bin/env bash
#
# scripts/deploy.sh - Build and publish a new release with `gh`.
#
# Requirements: git, node, npm, and gh (authenticated, with push access).

set -euo pipefail

# Accept both "0.4.0" and "v0.4.0"; tags and releases are created without "v".
VERSION="${1:-}"
VERSION="${VERSION#v}"

usage() {
  echo "Usage: npm run deploy <semver>   (e.g. npm run deploy 0.4.0)" >&2
  echo "       ./scripts/deploy.sh <semver>" >&2
}

if [[ -z "$VERSION" ]]; then
  usage
  exit 1
fi

# ---------------------------------------------------------------------------
# Tooling checks
# ---------------------------------------------------------------------------
for cmd in node npm git gh; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "error: '$cmd' is required but was not found in PATH." >&2
    exit 1
  fi
done

if ! gh auth status >/dev/null 2>&1; then
  echo "error: 'gh' is not authenticated. Run 'gh auth login' first." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Repo sanity checks
# ---------------------------------------------------------------------------
BRANCH="$(git branch --show-current)"
if [[ -z "$BRANCH" ]]; then
  echo "error: not on a branch (detached HEAD)." >&2
  exit 1
fi

REMOTE="$(git config --get "branch.$BRANCH.remote" || true)"
REMOTE="${REMOTE:-origin}"
if ! git remote get-url "$REMOTE" >/dev/null 2>&1; then
  echo "error: no remote named '$REMOTE' for branch '$BRANCH'." >&2
  exit 1
fi

if git rev-parse --verify --quiet "refs/tags/$VERSION" >/dev/null; then
  echo "error: tag '$VERSION' already exists locally." >&2
  exit 1
fi

if git ls-remote --exit-code --tags "$REMOTE" "$VERSION" >/dev/null 2>&1; then
  echo "error: tag '$VERSION' already exists on remote '$REMOTE'." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Install dependencies
# ---------------------------------------------------------------------------
npm ci
echo "==> Dependencies installed"

# ---------------------------------------------------------------------------
# Validate the version is valid semver
# ---------------------------------------------------------------------------
SEMVER_KIND="$(node -e '
  const semver = require("semver");
  const v = process.argv[1];
  if (!semver.valid(v)) {
    console.error(`error: "${v}" is not a valid semver version (e.g. 0.4.0, 1.2.3, 2.0.0-rc.1).`);
    process.exit(1);
  }
  process.stdout.write(semver.prerelease(v) ? "prerelease" : "stable");
' "$VERSION")"

if [[ "$SEMVER_KIND" == "stable" ]]; then
  echo "==> Valid semver version: $VERSION"
else
  echo "==> Valid semver version (pre-release): $VERSION"
fi


# ---------------------------------------------------------------------------
# Bump versions (npm version re-validates the semver as a second gate and
# keeps package-lock.json in sync; manifest.json is patched to match so the
# plugin behaves like the published tag).
# ---------------------------------------------------------------------------
npm version "$VERSION" --no-git-tag-version

node - "$VERSION" <<'EOF'
const fs = require('fs');
const file = 'manifest.json';
const version = process.argv[2];
const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
manifest.version = version;
fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');
console.log(`    manifest.json version -> ${version}`);
EOF

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------
npm run build
echo "==> Build succeeded"

# ---------------------------------------------------------------------------
# Verify the release assets
# ---------------------------------------------------------------------------
for asset in dist/main.js manifest.json styles.css; do
  if [[ ! -f "$asset" ]]; then
    echo "error: required release asset not found: $asset" >&2
    exit 1
  fi
done

MANIFEST_VERSION="$(node -p "JSON.parse(require('fs').readFileSync('manifest.json','utf8')).version")"
if [[ "$MANIFEST_VERSION" != "$VERSION" ]]; then
  echo "error: manifest.json version ($MANIFEST_VERSION) does not match $VERSION." >&2
  exit 1
fi
echo "==> Release assets verified (dist/main.js, manifest.json, styles.css)"

# ---------------------------------------------------------------------------
# Commit the bump, tag it, and push branch + tag
# ---------------------------------------------------------------------------
git commit -m "chore: 🤖 bump version to $VERSION" -- manifest.json package.json package-lock.json
git tag -a "$VERSION" -m "Release $VERSION"
git push "$REMOTE" "$BRANCH"
git push "$REMOTE" "$VERSION"
echo "==> Pushed $BRANCH and tag $VERSION to $REMOTE"

# ---------------------------------------------------------------------------
# Create the release and upload the assets
# ---------------------------------------------------------------------------
RELEASE_ARGS=(--title "$VERSION" --generate-notes)
if [[ "$SEMVER_KIND" == "prerelease" ]]; then
  RELEASE_ARGS+=(--prerelease)
fi

gh release create "$VERSION" "${RELEASE_ARGS[@]}" dist/main.js manifest.json styles.css

REPO="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
echo
echo "ฅ^>ω<^ฅ Release $VERSION published: https://github.com/$REPO/releases/tag/$VERSION"
gh release view "$VERSION"