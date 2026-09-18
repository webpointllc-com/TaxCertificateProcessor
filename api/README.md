# I Just Farted — API

FastAPI service that backs the web frontend, iOS Shortcuts, Pythonista, and the companion MCP server.

## Run locally

```bash
cd /workspace
python -m venv .venv && source .venv/bin/activate
pip install -r api/requirements.txt
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

- Interactive docs: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`
- Local dev falls back to SQLite (`./ijf.db`). Set `DATABASE_URL` to use Postgres.

## Environment variables

| Var | Purpose | Default |
| --- | --- | --- |
| `DATABASE_URL` | Postgres connection string. `postgres://` and `postgresql://` are auto-normalized to `postgresql+psycopg://`. | `sqlite:///./ijf.db` |
| `CORS_ALLOW_ORIGINS` | Comma-separated allowlist for CORS. Use `*` to allow everything. | `*` |
| `PORT` | HTTP port (Render sets this). Bind to `0.0.0.0:$PORT`. | `8000` |

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/` | Service info |
| GET | `/health` | Health check |
| POST | `/users` | Create/get user by handle |
| GET | `/users/{handle}` | Fetch a user |
| POST | `/farts` | Record a fart |
| GET | `/farts` | List farts (filter by `handle`, `limit`, `since_minutes`) |
| GET | `/farts/{id}` | Fetch one fart |
| DELETE | `/farts/{id}` | Delete a fart |
| POST | `/friends` | Add a friend |
| GET | `/friends/{owner_handle}` | List friends |
| DELETE | `/friends` | Remove a friend |
| GET | `/stats` | Aggregate stats + top farters |
| POST | `/trigger/ios` | Query-string friendly single-shot endpoint for iOS Shortcuts |

## Quick examples

```bash
# record a fart
curl -X POST http://localhost:8000/farts \
  -H "content-type: application/json" \
  -d '{"handle":"bill","note":"stealthy","lat":40.71,"lng":-74.00,"intensity":7,"source":"curl"}'

# list recent
curl 'http://localhost:8000/farts?limit=10'

# add a friend
curl -X POST http://localhost:8000/friends \
  -H "content-type: application/json" \
  -d '{"owner_handle":"bill","friend_handle":"adam"}'

# stats
curl http://localhost:8000/stats

# iOS Shortcut style (query string only, POST)
curl -X POST 'http://localhost:8000/trigger/ios?handle=bill&note=meeting&intensity=5'
```

## Deploy on Render

The repo's `render.yaml` provisions:

- `ijf-postgres` — free managed Postgres
- `ijf-api` — this web service, wired to Postgres via `fromDatabase`
- `ijf-frontend` — the existing static `index.html`

The API binds to `0.0.0.0:$PORT` as required. The filesystem is ephemeral, so
never rely on the SQLite fallback in production — the render.yaml wires
Postgres automatically.
