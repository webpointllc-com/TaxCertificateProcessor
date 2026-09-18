"""Pythonista one-tap fart recorder.

Copy this into Pythonista on your iPhone, edit `API_BASE` and `HANDLE`,
then bind it to a home-screen shortcut or Back Tap via iOS Shortcuts.
"""
from __future__ import annotations

try:
    import location  # type: ignore  # Pythonista-only module
except ImportError:  # pragma: no cover - only present on iOS Pythonista
    location = None  # type: ignore

import sys

import requests

API_BASE = "https://ijf-api.onrender.com"
HANDLE = "bill"


def _get_location() -> tuple[float | None, float | None]:
    if location is None:
        return None, None
    location.start_updates()
    try:
        loc = location.get_location() or {}
        return loc.get("latitude"), loc.get("longitude")
    finally:
        location.stop_updates()


def record(note: str | None = None, intensity: int | None = None) -> dict:
    lat, lng = _get_location()
    payload = {
        "handle": HANDLE,
        "note": note,
        "intensity": intensity,
        "lat": lat,
        "lng": lng,
        "source": "pythonista",
    }
    resp = requests.post(f"{API_BASE}/farts", json=payload, timeout=10)
    resp.raise_for_status()
    return resp.json()


def main() -> None:
    note = sys.argv[1] if len(sys.argv) > 1 else None
    intensity = int(sys.argv[2]) if len(sys.argv) > 2 else None
    result = record(note=note, intensity=intensity)
    print(result)


if __name__ == "__main__":
    main()
