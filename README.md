# 💨 I Just Farted — Beta v1.0

A fun, localized mini web app for broadcasting and tracking farts with friends!

## Features

### Core Functionality
- **🔴 Big Red Easy Button** — One tap to broadcast your fart
- **🟢 Go Live Toggle** — Control when you're active/streaming
- **📍 Location Tracking** — Pins your farts on a map with GPS coordinates
- **🗺️ Mini Map** — Shows recent fart locations with Leaflet/OpenStreetMap

### Social Features
- **👥 Add Friends** — Build your fart notification network
- **📢 Friend Notifications** — Alert online friends when you fart
- **📋 Friends List** — Manage your connections

### Reporting
- **📝 Report Farts** — Document fart sightings with notes
- **📸 Photo Support** — Attach images to reports
- **📊 History** — View your complete fart history

### User Experience
- **💫 Fart Animation** — Satisfying visual feedback on button press
- **📳 Haptic Vibration** — Tactile feedback (on supported devices)
- **🔔 Toast Notifications** — Real-time status updates
- **🌙 Dark Theme** — Modern, eye-friendly design

## How to Use

1. **Open `index.html`** in any modern browser
2. **Turn ON the Live toggle** to activate
3. **Press the big FART button** to broadcast
4. **Allow location access** when prompted for map features
5. **Add friends** via the hamburger menu

## Technical Details

- **Pure HTML/CSS/JavaScript** — No build tools required
- **LocalStorage** — All data stored locally in browser
- **Leaflet.js** — Interactive maps
- **Responsive Design** — Works on mobile and desktop
- **PWA-Ready** — Can be installed as a web app

## Storage Keys

- `ijf_pins_v1` — Fart location pins
- `ijf_friends_v1` — Friends list

## Browser Support

- Chrome/Edge (recommended)
- Firefox
- Safari
- Any modern browser with ES6+ support

## Privacy

All data is stored locally on your device. No server communication. Location data is only used for map pins and never transmitted.

---

**Made with 💨 for the original creators**

*Beta v1.0 — December 2024*

---

## Server components (beta v1.1)

The frontend can now talk to a real API. Two new components ship in this repo:

- [`api/`](./api/README.md) — FastAPI HTTP API (users, farts, friends, stats, iOS-shortcut endpoint). Runs on Render via [`render.yaml`](./render.yaml), backed by managed Postgres.
- [`mcp_server/`](./mcp_server/README.md) — MCP server that exposes the API as tools so Cursor / Claude Desktop can drive it.
- [`ios/`](./ios/README.md) — iOS Shortcut recipe and Pythonista script for one-tap farting from your phone.

### Local dev quickstart

```bash
pip install -r api/requirements.txt
uvicorn api.main:app --reload --port 8000
# in another terminal:
pip install -r mcp_server/requirements.txt
IJF_API_BASE_URL=http://localhost:8000 python -m mcp_server.server
```

### Deploy

Push the repo to GitHub and connect it to Render. The included `render.yaml` provisions:

- `ijf-postgres` — free Postgres
- `ijf-api` — the FastAPI web service, wired to Postgres
- `ijf-frontend` — the existing static `index.html`

Point the frontend at the API by editing the deployed URL in `index.html` (or via a config injection layer of your choice).
