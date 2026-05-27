#!/usr/bin/env bash
# Optional: git pull + yarn install/build. No mirror/launchd in public devkit.
#
# Env:
#   DEVKIT_SYNC_BRANCH   default: main
#   DEVKIT_SYNC_REMOTE   default: origin
#   DEVKIT_MCP_FORCE_BUILD=1  — run yarn even when already up to date

set -euo pipefail

SOURCE="${BASH_SOURCE[0]}"
while [ -L "$SOURCE" ]; do
  DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"
  SOURCE="$(readlink "$SOURCE")"
  [[ "$SOURCE" != /* ]] && SOURCE="$DIR/$SOURCE"
done
SCRIPT_DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_DIR"

BRANCH="${DEVKIT_SYNC_BRANCH:-main}"
REMOTE="${DEVKIT_SYNC_REMOTE:-origin}"

ts() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
log() { echo "[$(ts)] [devkit-sync] $*" >&2; }

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  log "Not a git repo — exit"
  exit 1
fi

current_branch="$(git rev-parse --abbrev-ref HEAD)"
if [ "$current_branch" != "$BRANCH" ]; then
  log "Checked out '$current_branch', not '$BRANCH' — skip (set DEVKIT_SYNC_BRANCH to match)."
  exit 0
fi

git fetch "$REMOTE" "$BRANCH" --quiet
before="$(git rev-parse HEAD)"
git merge --ff-only "$REMOTE/$BRANCH" 2>/dev/null || true
after="$(git rev-parse HEAD)"
UPDATED=0
[ "$before" != "$after" ] && UPDATED=1

if [ "$UPDATED" = "1" ] || [ "${DEVKIT_MCP_FORCE_BUILD:-}" = "1" ]; then
  log "Running yarn install && yarn build"
  yarn install --frozen-lockfile 2>/dev/null || yarn install
  yarn build
  log "Done"
else
  log "No new commits on $REMOTE/$BRANCH — skip build (set DEVKIT_MCP_FORCE_BUILD=1 to force)."
fi
