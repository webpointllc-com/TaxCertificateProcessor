#!/usr/bin/env bash
# Import EF_EE checkpoint log into the Continuity Wall (Mac-side).
# Paths are exact per Bill — run on the MacBook where iCloud Drive is mounted.
set -euo pipefail

EF_EE_PORT="${EF_EE_PORT:-/Users/billmccreary/Library/Mobile Documents/com~apple~CloudDocs/EF_EE_PORT}"
EF_EE_LOG="${EF_EE_LOG:-$EF_EE_PORT/EF_EE_CHECKPOINT_LOG.jsonl}"
DAY="${1:-2026-09-10}"
HOST="${WIDGET_HOST:-127.0.0.1}"
PORT="${WIDGET_PORT:-3847}"
URL="http://${HOST}:${PORT}/api/checkpoint-import"
AUTHOR="${WALL_AUTHOR:-claude-desktop}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WIDGET_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== EF_EE → Continuity Wall ==="
echo "Day:  $DAY"
echo "Log:  $EF_EE_LOG"
echo "API:  $URL"
echo ""

if [[ ! -f "$EF_EE_LOG" ]]; then
  echo "ERROR: checkpoint log not found."
  echo "Expected:"
  echo "  $EF_EE_LOG"
  echo "Also expected folder:"
  echo "  $EF_EE_PORT"
  echo ""
  echo "Cloud VMs will not have this path. Run this script on Bill’s Mac."
  exit 1
fi

# Ensure wall server is up (start briefly if needed)
NEED_STOP=0
SERVER_PID=""
if ! curl -fsS "http://${HOST}:${PORT}/api/health" >/dev/null 2>&1; then
  echo "Starting wall server…"
  (cd "$WIDGET_DIR/.." && node "$WIDGET_DIR/server.js") &
  NEED_STOP=1
  SERVER_PID=$!
  for i in 1 2 3 4 5 6 7 8 9 10; do
    if curl -fsS "http://${HOST}:${PORT}/api/health" >/dev/null 2>&1; then
      break
    fi
    sleep 0.25
  done
fi

python3 - "$EF_EE_LOG" "$DAY" "$URL" "$AUTHOR" <<'PY'
import json, sys, urllib.request
path, day, url, author = sys.argv[1:5]
raw = open(path, "r", encoding="utf-8", errors="replace").read()
payload = json.dumps({"day": day, "author": author, "jsonl": raw}).encode("utf-8")
req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"}, method="POST")
with urllib.request.urlopen(req, timeout=60) as r:
    body = json.loads(r.read().decode("utf-8"))
print(json.dumps({
    "ok": body.get("ok"),
    "postId": (body.get("post") or {}).get("id"),
    "matchCount": (body.get("extracted") or {}).get("matchCount"),
    "series": (body.get("extracted") or {}).get("series"),
}, indent=2))
PY

echo ""
echo "Open wall: http://${HOST}:${PORT}/"
echo "Template also at: $WIDGET_DIR/wall/CHECKPOINT_POST_TEMPLATE.json"

if [[ "$NEED_STOP" == "1" && -n "$SERVER_PID" ]]; then
  kill "$SERVER_PID" 2>/dev/null || true
fi
