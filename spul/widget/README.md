# Continuity Wall — AI CONTRACT

**This file is the contract for Cursor agents and Claude Desktop.**  
When you change anything under `spul/`, you **MUST** post to the Continuity Wall with a GitHub or local file reference. Bill watches the UI — he should not re-explain work already done.

**Visual language:** Webpoint / Voice First *art* only. Voice-first product features stay **OUT**.

---

## Open on Bill’s Mac (sandbox escape)

Cloud Cursor VMs barely reach the Mac. Run the wall **on the MacBook**:

```bash
# From TaxCertificateProcessor repo root on the Mac:
bash spul/widget/mac/open-widget.sh
```

Or:

```bash
python3 spul/widget/mac/run_widget.py
# optional auto-draft from new commits:
python3 spul/widget/mac/run_widget.py --watch
```

Or classic:

```bash
cd spul && npm run widget
open http://127.0.0.1:3847/
```

| | |
| --- | --- |
| URL | http://127.0.0.1:3847/ |
| Wall file | `spul/widget/wall/posts.jsonl` |
| Port | `3847` (`WIDGET_PORT`) — binds `127.0.0.1` only |

**EF_EE checkpoint (Mac only):**

```bash
bash spul/widget/mac/import-ef-ee-checkpoint.sh 2026-09-10
```

Exact paths:

- `/Users/billmccreary/Library/Mobile Documents/com~apple~CloudDocs/EF_EE_PORT`
- `/Users/billmccreary/Library/Mobile Documents/com~apple~CloudDocs/EF_EE_PORT/EF_EE_CHECKPOINT_LOG.jsonl`

---

## Wall post schema (one JSON object per JSONL line)

```json
{
  "id": "optional-stable-id",
  "ts": "2026-09-15T20:00:00Z",
  "author": "cursor | claude-desktop | bill",
  "type": "change | snapshot | note",
  "title": "Short headline",
  "body": "What changed — enough for the other AI to continue.",
  "outcome": "What came of it (optional)",
  "links": [
    { "label": "PR #8", "url": "https://github.com/webpointllc-com/TaxCertificateProcessor/pull/8" },
    { "label": "local file", "url": "spul/server.js" }
  ],
  "snapshot": {
    "kind": "stats | checkpoint",
    "label": "optional chart title",
    "series": [{ "label": "Validated", "value": 1675 }]
  }
}
```

Authors allowed in UI: `cursor`, `claude-desktop`, `bill` (plus `system` for seeds).

---

## How Cursor posts

1. Read this README + `wall/posts.jsonl` + `docs/DAY0_MANIFEST.md` at session start.
2. After meaningful S-PUL work, **POST**:

```bash
curl -sS -X POST http://127.0.0.1:3847/api/wall \
  -H 'Content-Type: application/json' \
  -d '{
    "author": "cursor",
    "type": "change",
    "title": "What you did",
    "body": "Detail + why it matters",
    "outcome": "Result / decision",
    "links": [
      {"label": "commit or PR", "url": "https://github.com/webpointllc-com/TaxCertificateProcessor/..."},
      {"label": "file", "url": "spul/path/to/file"}
    ]
  }'
```

3. Or append one JSON line to `spul/widget/wall/posts.jsonl` (same schema) and commit it.
4. Prefer GitHub PR/commit/file URLs; local paths are fine when work is Mac-only.

## How Claude Desktop posts

Same contract. Prefer `author: "claude-desktop"`.

- If the wall server is running on the Mac: POST `/api/wall` as above.
- If offline: append a JSONL line to `spul/widget/wall/posts.jsonl` with direct refs.
- For EF_EE / iCloud work Bill already pointed at: run `mac/import-ef-ee-checkpoint.sh` or POST `/api/checkpoint-import` with the JSONL contents — then you do **not** make Bill repeat the datapoint ask.
- Twin bridge = **shared wall file + Copy twin pack** (see `TWIN_SYNC.md`). No MCP telepathy.

## How Bill posts

Open the wall UI → fill **Post change** (title/body enough) → Post. Or type author `bill`.

---

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/wall` | List posts (`?author=` / `?type=`) |
| POST | `/api/wall` | Append post |
| GET | `/api/twin-pack` | Latest wall + Day 0 context for paste |
| POST | `/api/checkpoint-import` | Import EF_EE JSONL → snapshot post + chart |
| GET | `/api/health` | Liveness |
| GET/POST | `/api/memory` | Legacy `PROJECT_MEMORY.json` (also mirrors to wall) |

---

## Twin sync (one-liner)

**Paste pack + shared `posts.jsonl` is the bridge** — Claude Desktop and Cursor both read/post the wall; Bill watches the UI. Details: [`TWIN_SYNC.md`](./TWIN_SYNC.md).

---

## Day 0 snapshot

- Product: `spul/` only — [PR #8](https://github.com/webpointllc-com/TaxCertificateProcessor/pull/8) · `s-pul-front_end-Betasearchpages-best-55de`
- Widget lineage: PR #10 · `s-pul-front_end-Betaproject-widget-55de`
- Stats: **2062** listed · **2055** with URL · **1866** active · **7** no URL · **1675** validated-true
- OUT: invented URLs · DEP Highlighter · `kata_deploy` expansion · voice product · secrets in git

## Layout

100% scalable proportional desktop canvas — Webpoint night atmosphere, no thin left accent stripes.
