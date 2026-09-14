#!/usr/bin/env bash
# Open the S-PUL validated county | URL grid on this machine.
# Prefer artifacts copy, then docs/, then spul/data/ (repo checkout).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

CANDIDATES=(
  "/opt/cursor/artifacts/SPUL_VALIDATED_COUNTY_URL_GRID.txt"
  "$REPO_ROOT/docs/SPUL_VALIDATED_COUNTY_URL_GRID.txt"
  "$REPO_ROOT/spul/data/SPUL_VALIDATED_COUNTY_URL_GRID.txt"
)

GRID=""
for path in "${CANDIDATES[@]}"; do
  if [[ -f "$path" ]]; then
    GRID="$path"
    break
  fi
done

if [[ -z "$GRID" ]]; then
  echo "ERROR: SPUL_VALIDATED_COUNTY_URL_GRID.txt not found." >&2
  echo "Tried:" >&2
  printf '  %s\n' "${CANDIDATES[@]}" >&2
  echo "Fetch branch s-pul-front_end-Betaadam-clean-share-39e4 or s-pul-front_end-Betaspul-minimal-deploy-55de." >&2
  exit 1
fi

echo "Validated county | URL grid: $GRID"
echo "Rows header:"
head -n 5 "$GRID"
echo "---"

opened=0
if command -v xdg-open >/dev/null 2>&1; then
  if xdg-open "$GRID" >/dev/null 2>&1; then
    echo "Opened with xdg-open."
    opened=1
  fi
elif command -v open >/dev/null 2>&1; then
  if open "$GRID" >/dev/null 2>&1; then
    echo "Opened with open (macOS)."
    opened=1
  fi
fi

if [[ "$opened" -eq 0 ]]; then
  echo "No GUI opener available (or open failed). Path above; preview:"
  head -n 25 "$GRID"
  exit 0
fi
