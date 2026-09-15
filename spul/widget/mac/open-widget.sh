#!/usr/bin/env bash
# S-PUL Continuity Wall — Mac launcher (run on Bill’s MacBook, NOT in Cursor cloud VM).
# Starts localhost widget server and opens the browser to the change wall.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WIDGET_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SPUL_DIR="$(cd "$WIDGET_DIR/.." && pwd)"
REPO_ROOT="$(cd "$SPUL_DIR/.." && pwd)"

HOST="${WIDGET_HOST:-127.0.0.1}"
PORT="${WIDGET_PORT:-3847}"
URL="http://${HOST}:${PORT}/"

echo "=== Webpoint Continuity Wall (Mac) ==="
echo "Repo:    $REPO_ROOT"
echo "Widget:  $WIDGET_DIR"
echo "URL:     $URL"
echo ""
echo "This must run on YOUR Mac. Cloud agent shells cannot replace this."
echo ""

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "WARN: uname is $(uname -s) — expected Darwin (macOS)."
  echo "Continuing anyway (useful for smoke tests), but Bill should run this on the MacBook."
fi

cd "$SPUL_DIR"
if [[ ! -f package.json ]]; then
  echo "ERROR: spul/package.json missing at $SPUL_DIR"
  exit 1
fi

# Prefer repo node; fall back to system
if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node not found. Install Node 18+ then re-run."
  exit 1
fi

# Kill prior widget on same port (best-effort, Mac-safe)
if command -v lsof >/dev/null 2>&1; then
  OLD_PIDS="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "${OLD_PIDS}" ]]; then
    echo "Stopping prior listener(s) on :$PORT → $OLD_PIDS"
    kill $OLD_PIDS 2>/dev/null || true
    sleep 0.4
  fi
fi

export WIDGET_HOST="$HOST"
export WIDGET_PORT="$PORT"

node "$WIDGET_DIR/server.js" &
SERVER_PID=$!
cleanup() {
  kill "$SERVER_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Wait for health
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS "$URL/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.25
done

if command -v open >/dev/null 2>&1; then
  open "$URL"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$URL" >/dev/null 2>&1 || true
fi

echo "Wall live → $URL"
echo "Posts file → $WIDGET_DIR/wall/posts.jsonl"
echo "Optional watcher: python3 $SCRIPT_DIR/run_widget.py --watch"
echo "EF_EE import:     $SCRIPT_DIR/import-ef-ee-checkpoint.sh"
echo "Ctrl+C to stop."

# Optional: auto-draft wall posts from new commits (local only)
if [[ "${WIDGET_WATCH:-0}" == "1" ]]; then
  python3 "$SCRIPT_DIR/run_widget.py" --watch-only --repo "$REPO_ROOT" &
  WATCH_PID=$!
  trap 'kill $SERVER_PID $WATCH_PID 2>/dev/null || true' EXIT INT TERM
fi

wait "$SERVER_PID"
