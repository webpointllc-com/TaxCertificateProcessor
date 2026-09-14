#!/bin/bash
# READ-ONLY hunt for DeepShake on Bill's Mac + Samsung T7.
# Run on the Mac where Finder shows Locations → T7.
# Does not modify DEP Highlighter. Does not write to T7 except via find metadata.
set -euo pipefail

echo "=== DeepShake hunt (macOS) ==="
echo "Host: $(hostname)  User: $(whoami)  Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "FAIL: This script must run on Bill's Mac (Darwin)."
  echo "Cloud VMs cannot see /Volumes/T7 USB mounts."
  exit 2
fi

echo "=== Mounted volumes ==="
ls -la /Volumes 2>/dev/null || true
echo

T7=""
for cand in /Volumes/T7 /Volumes/t7 /Volumes/Samsung*T7* /Volumes/T7\ Shield*; do
  if [[ -d "$cand" ]]; then
    T7="$cand"
    break
  fi
done

if [[ -z "$T7" ]]; then
  echo "T7 not found under /Volumes. Open Finder → Locations and confirm T7 is mounted."
  echo "Then re-run: bash scripts/deepshake-hunt-mac.sh"
  exit 3
fi

echo "T7 mount: $T7"
echo

search_roots=(
  "$T7"
  "$HOME/Desktop"
  "$HOME/Downloads"
  "$HOME/Applications"
  "/Applications"
  "$HOME/Documents"
  "$HOME/Library/Application Support"
)

echo "=== Name search (DeepShake / deepshake / Deep Shake) ==="
for root in "${search_roots[@]}"; do
  [[ -d "$root" ]] || continue
  echo "-- $root"
  # Cap depth on huge T7 trees for first pass
  find "$root" -maxdepth 6 \( \
      -iname '*deepshake*' -o \
      -iname '*deep*shake*' -o \
      -iname 'DeepShake*' \
    \) 2>/dev/null | head -n 80 || true
done
echo

echo "=== Chrome-linked / extension hints ==="
find "$HOME/Library/Application Support/Google/Chrome" -maxdepth 5 \( \
    -iname '*deepshake*' -o -iname '*deep*shake*' \
  \) 2>/dev/null | head -n 40 || true
echo

echo "=== Spotlight (mdfind) ==="
mdfind 'kMDItemFSName == "*DeepShake*"c' 2>/dev/null | head -n 40 || true
mdfind 'DeepShake' 2>/dev/null | head -n 40 || true
echo

echo "=== Done ==="
echo "If a path printed above, run that binary/app and feed fixed Search URLs into spul/data."
echo "Start a Cursor self-hosted worker so cloud agents can see $T7:"
echo "  cursor worker start"
