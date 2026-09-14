#!/bin/bash
# READ-ONLY forensic look at a WD Passport on macOS.
# Never formats. Never calls eraseDisk / partitionDisk / Initialize.
set -euo pipefail

echo "=== WD Passport read-only forensic ==="
echo "If macOS asked to Initialize the disk: click IGNORE. Never Initialize."
echo

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This script must run on the Mac the Passport is plugged into."
  echo "This cloud VM has no USB and cannot see disk4."
  exit 2
fi

echo "=== diskutil list ==="
diskutil list
echo

TARGET=""
while IFS= read -r line; do
  if echo "$line" | grep -qiE 'passport|western digital|wd '; then
    TARGET=$(echo "$line" | awk '{print $NF}')
  fi
done < <(diskutil list)

if [[ -z "$TARGET" ]]; then
  echo "No disk whose name looks like Passport. Using last external if present."
  TARGET=$(diskutil list | awk '/external, physical/{print $1}' | tail -1 | tr -d ':')
fi

if [[ -z "$TARGET" ]]; then
  echo "Could not identify the USB disk. Paste 'diskutil list' output before doing anything else."
  exit 3
fi

# Accept disk4 or /dev/disk4
TARGET=${TARGET#/dev/}
echo "Suspect device: /dev/$TARGET"
echo

echo "=== diskutil info (physical) ==="
diskutil info "$TARGET" || true
echo

echo "=== GPT / partition map (read) ==="
if command -v gpt >/dev/null 2>&1; then
  gpt -r show "/dev/$TARGET" 2>&1 || true
else
  echo "gpt tool not available"
fi
echo

echo "=== First 2 sectors (MBR + GPT header signatures) ==="
if [[ -r "/dev/$TARGET" ]] || [[ -r "/dev/r$TARGET" ]]; then
  DEV="/dev/r$TARGET"
  [[ -r "$DEV" ]] || DEV="/dev/$TARGET"
  echo "(may need sudo if Permission denied — re-run: sudo bash $0)"
  dd if="$DEV" bs=512 count=2 2>/dev/null | xxd | head -n 40 || \
    sudo dd if="$DEV" bs=512 count=2 2>/dev/null | xxd | head -n 40 || \
    echo "Could not read sectors (need sudo, or the USB bridge is not passing data)."
else
  echo "Need sudo to read /dev/$TARGET"
  sudo dd if="/dev/r$TARGET" bs=512 count=2 2>/dev/null | xxd | head -n 40 || true
fi
echo

echo "=== How to read the hex ==="
echo "  55 AA at the end of sector 0 = protective/real MBR"
echo "  ASCII 'EFI PART' in sector 1 = GPT header is still there"
echo "  NTFS    at offset of a partition = Windows volume"
echo "  EXFAT   or 'EXFAT' = exFAT volume"
echo "  If the first sectors are all zero or random, stop DIY and image/lab."
echo

echo "=== Mount attempts (non-destructive) ==="
diskutil list "$TARGET"
echo "Trying mountDisk (fails softly if no filesystem):"
diskutil mountDisk "$TARGET" 2>&1 || true
echo
echo "Volumes now:"
ls -la /Volumes || true
echo

echo "=== Next (still not a format) ==="
echo "  diskutil verifyDisk $TARGET"
echo "  If you can see files in TestDisk (P to list), COPY OFF to another disk first."
echo "  brew install testdisk && sudo testdisk"
echo "FORBIDDEN: Disk Utility Initialize / Erase / partitionDisk / eraseDisk"
echo "Done."
