#!/usr/bin/env bash
# Local MCP: HTTP server + mcp-remote stdio bridge for Claude Desktop / Cursor.

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

devkit_node_major() {
  command -v node >/dev/null 2>&1 || { echo 0; return; }
  node -p 'parseInt(process.versions.node.split(".")[0],10)' 2>/dev/null || echo 0
}

devkit_pick_nvm_bin_dir_ge_20() {
  local nvm_root="${NVM_DIR:-$HOME/.nvm}/versions/node"
  local d ver maj best_ver="" best_dir=""
  [ -d "$nvm_root" ] || return 1
  for d in "$nvm_root"/v*; do
    [ -x "$d/bin/node" ] || continue
    ver="${d##*/v}"
    maj="${ver%%.*}"
    [[ "$maj" =~ ^[0-9]+$ ]] || continue
    [ "$maj" -lt 20 ] && continue
    if [ -z "$best_ver" ]; then
      best_ver=$ver
      best_dir="$d/bin"
    elif [ "$(printf '%s\n%s\n' "$best_ver" "$ver" | sort -V | tail -1)" = "$ver" ]; then
      best_ver=$ver
      best_dir="$d/bin"
    fi
  done
  [ -n "$best_dir" ] && printf '%s\n' "$best_dir"
}

devkit_ensure_node20_path() {
  if [ -n "${DEVKIT_NODE_BIN:-}" ] && [ -x "$DEVKIT_NODE_BIN" ]; then
    export PATH="$(cd "$(dirname "$DEVKIT_NODE_BIN")" && pwd):$PATH"
    return 0
  fi
  local maj picked cand
  maj=$(devkit_node_major)
  [ "${maj:-0}" -ge 20 ] && return 0
  picked=$(devkit_pick_nvm_bin_dir_ge_20 || true)
  [ -n "$picked" ] && export PATH="$picked:$PATH"
  maj=$(devkit_node_major)
  [ "${maj:-0}" -ge 20 ] && return 0
  for cand in /opt/homebrew/bin/node /usr/local/bin/node; do
    if [ -x "$cand" ]; then
      maj=$("$cand" -p 'parseInt(process.versions.node.split(".")[0],10)' 2>/dev/null || echo 0)
      if [ "${maj:-0}" -ge 20 ]; then
        export PATH="$(dirname "$cand"):$PATH"
        return 0
      fi
    fi
  done
  echo "[devkit-local] Need Node.js 20+ for mcp-remote. Set DEVKIT_NODE_BIN to a v20+ node." >&2
  return 1
}

devkit_ensure_node20_path

PORT="${PORT:-3737}"
MCP_URL="${MCP_URL:-http://localhost:${PORT}}"
LOG_FILE="${DEVKIT_LOCAL_LOG:-/tmp/mcp-devkit-local-${PORT}.log}"

export PORT MCP_URL

if [ ! -f "$REPO_DIR/dist/index.js" ]; then
  echo "[devkit-local] dist/index.js missing — run 'yarn build' in $REPO_DIR" >&2
  exit 1
fi

server_pid=""
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "[devkit-local] Server already listening on :$PORT — reusing." >&2
else
  echo "[devkit-local] Starting HTTP server on :$PORT (logs: $LOG_FILE)" >&2
  node "$REPO_DIR/dist/index.js" >"$LOG_FILE" 2>&1 &
  server_pid=$!
  cleanup() {
    if [ -n "$server_pid" ] && kill -0 "$server_pid" 2>/dev/null; then
      kill "$server_pid" 2>/dev/null || true
    fi
  }
  trap cleanup EXIT INT TERM

  for _ in $(seq 1 50); do
    if curl -sSf -o /dev/null "http://localhost:${PORT}/inspector" 2>/dev/null; then
      break
    fi
    sleep 0.2
  done
fi

strip_ide_node_from_path() {
  local cleaned="" part
  IFS=':'
  for part in $PATH; do
    [[ "$part" == *Cursor.app* ]] && continue
    cleaned="${cleaned:+$cleaned:}$part"
  done
  IFS=
  PATH="$cleaned"
  export PATH
}
strip_ide_node_from_path
if ! command -v node >/dev/null 2>&1 || [[ "$(command -v node)" == *Cursor.app* ]]; then
  if [ -d "$HOME/.nvm/versions/node" ]; then
    nvm_ver="$(ls -1 "$HOME/.nvm/versions/node" 2>/dev/null | sort -V | tail -1)"
    [ -n "$nvm_ver" ] && export PATH="$HOME/.nvm/versions/node/$nvm_ver/bin:$PATH"
  fi
fi

NPX="$(command -v npx)"
if [ -z "$NPX" ] || [[ "$NPX" == *Cursor.app* ]]; then
  echo "[devkit-local] npx not found. Install Node via nvm/Homebrew." >&2
  exit 1
fi
exec "$NPX" -y mcp-remote@latest "${MCP_URL%/}/mcp"
