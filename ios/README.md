# iOS Shortcuts & Pythonista integration

Once the API is deployed (e.g. `https://ijf-api.onrender.com`), you can drive it from your iPhone.

Replace `API_BASE` in the examples with your deployed URL.

---

## Option A — iOS Shortcut (single-tap fart)

Build this shortcut in the **Shortcuts** app (Add Action → search for each step):

1. **Text** → `bill` (your handle — edit to yours)
2. **Set Variable** → `handle`
3. *(optional)* **Get Current Location**
4. *(optional)* **Get Details of Location** → `Latitude`, save as `lat`. Repeat for `Longitude` → `lng`.
5. **URL** → build this string:

   ```
   https://ijf-api.onrender.com/trigger/ios?handle=[handle]&note=quick&intensity=6
   ```

   If you captured lat/lng, append `&lat=[lat]&lng=[lng]`.

6. **Get Contents of URL**
   - Method: **POST**
   - Request body: **None** (all params are in the query string)
7. **Show Result** (optional) — displays the API response.

Add the shortcut to your **Home Screen** or **Back Tap** (Settings → Accessibility → Touch → Back Tap → Double/Triple Tap → your shortcut) for one-tap farting.

### Shareable link

Shortcuts can also be triggered by URL: `shortcuts://run-shortcut?name=Fart`.
Use this from Pythonista via `webbrowser.open('shortcuts://run-shortcut?name=Fart')`.

---

## Option B — Pythonista script

Copy `fart.py` into Pythonista and edit `API_BASE` / `HANDLE`:

```python
# fart.py — Pythonista
import location
import requests

API_BASE = "https://ijf-api.onrender.com"
HANDLE = "bill"

def record(note=None, intensity=None):
    location.start_updates()
    try:
        loc = location.get_location()
    finally:
        location.stop_updates()

    payload = {
        "handle": HANDLE,
        "note": note,
        "intensity": intensity,
        "lat": loc.get("latitude") if loc else None,
        "lng": loc.get("longitude") if loc else None,
        "source": "pythonista",
    }
    r = requests.post(f"{API_BASE}/farts", json=payload, timeout=10)
    r.raise_for_status()
    return r.json()

if __name__ == "__main__":
    print(record(note="from pythonista", intensity=7))
```

Add the script to a Pythonista home-screen shortcut for a real one-tap workflow.

---

## Option C — Shortcut → Pythonista bridge

If you want an iOS Shortcut to invoke a Pythonista script instead of hitting the API directly:

1. In your Shortcut, add **Open URL** with:

   ```
   pythonista3://fart.py?action=run
   ```

2. Pythonista opens and runs `fart.py`. The script records the fart via the API.

This is useful if you want richer client-side logic (e.g. custom sensors, local caching) before hitting the API.

---

## Notes

- All endpoints accept plain JSON — no auth required in v1. Add an auth layer before making the URL truly public.
- `/trigger/ios` uses query-string params on purpose, because the built-in Shortcuts action doesn't make it easy to send a JSON body.
- To read your fart history from Shortcuts: **Get Contents of URL** on `https://ijf-api.onrender.com/farts?handle=bill&limit=20`, then **Get Dictionary from Input** → iterate.
