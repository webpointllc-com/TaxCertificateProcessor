#!/usr/bin/env bash
# WebPoint launch — chmod, print the pay block, open Render billing, bind 0.0.0.0:$PORT.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
chmod +x "$ROOT/scripts/ru.sh"

export PORT="${PORT:-3000}"
export HOST="${HOST:-0.0.0.0}"

BILLING="https://dashboard.render.com/billing"
BLUEPRINT="https://dashboard.render.com/blueprint/new?repo=https://github.com/webpointllc-com/TaxCertificateProcessor"
GROQ="https://console.groq.com/keys"
LOCAL_PAY="http://127.0.0.1:${PORT}/pay.html?prep=1"
LOCAL_TOOL="http://127.0.0.1:${PORT}/"
LOCAL_EMBED="http://127.0.0.1:${PORT}/embed-preview.html"
LIVE="https://tax-certificate-processor.onrender.com/"

HANDOFF="$ROOT/public/CLAUDE_PASTE.txt"

cat <<E0F
============================================================
WEBPOINT — PREP TO PAY (selected: Starter web + Postgres 256MB)
============================================================
Selected now     \$14/mo  Oregon
  Render web     \$7/mo   plan starter     bind 0.0.0.0:\$PORT
  Render Postgres \$7/mo   plan basic-256mb  PG16  webpoint-tcs-db
  Groq Llama 70B \$0 now  key after pay    never git

Ready to scale   Standard \$25 · Pro \$85 autoscale (not selected)

1. PAY CARD     ${BILLING}
2. APPLY BLUEPRINT  ${BLUEPRINT}
3. GROQ KEY     ${GROQ}
4. LOCAL PAY    ${LOCAL_PAY}
5. LOCAL TOOL   ${LOCAL_TOOL}
6. LOCAL EMBED  ${LOCAL_EMBED}
7. LIVE (after deploy)  ${LIVE}

Claude handoff is public/CLAUDE_PASTE.txt (also copied to clipboard when a clipboard tool exists).
Squarespace cannot hit localhost. Card → Blueprint → paste public/SQUARESPACE_EMBED.html.
============================================================
E0F

copy_handoff() {
  if [[ ! -f "$HANDOFF" ]]; then
    return 0
  fi
  if command -v pbcopy >/dev/null 2>&1; then
    pbcopy < "$HANDOFF"
    echo "Clipboard: Claude handoff copied (pbcopy)."
  elif command -v xclip >/dev/null 2>&1; then
    xclip -selection clipboard < "$HANDOFF" && echo "Clipboard: Claude handoff copied (xclip)."
  elif command -v xsel >/dev/null 2>&1; then
    xsel --clipboard --input < "$HANDOFF" && echo "Clipboard: Claude handoff copied (xsel)."
  elif command -v wl-copy >/dev/null 2>&1; then
    wl-copy < "$HANDOFF"
    echo "Clipboard: Claude handoff copied (wl-copy)."
  else
    echo "Clipboard tool not on this VM. Copy ${HANDOFF} or use /pay.html → Copy Claude handoff."
  fi
}

open_url() {
  local url="$1"
  if command -v open >/dev/null 2>&1; then
    open "$url" >/dev/null 2>&1 || true
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$url" >/dev/null 2>&1 || true
  fi
}

copy_handoff

if [[ "${PREP_TO_PAY:-1}" == "1" ]]; then
  echo "Opening Render billing (add the card here)…"
  open_url "$BILLING"
  (
    for _ in $(seq 1 20); do
      if command -v curl >/dev/null 2>&1 && curl -sf "http://127.0.0.1:${PORT}/api/health" >/dev/null; then
        open_url "$LOCAL_PAY"
        open_url "$LOCAL_EMBED"
        exit 0
      fi
      sleep 0.35
    done
  ) &
fi

echo "Starting Tax Certificate Processor on ${HOST}:${PORT}"
exec node src/server.js
