# Project Continuity Widget

Local-first desktop widget so Bill (and Cursor agents) can jump straight back into **S-PUL Day 0** with a shared **project memory** file.

**Visual language:** Webpoint / S-PUL stage art (and the Voice First *look* — shine mark, night atmosphere, Poppins). **Voice-first product features are OUT** — this reuses art only.

## Open on Mac

From the repo:

```bash
cd spul
npm run widget
```

Then in a browser (or):

```bash
open http://127.0.0.1:3847/
```

One-liner from repo root:

```bash
cd spul && npm run widget
# other terminal / after start:
open http://127.0.0.1:3847/
```

Port: `3847` (override with `WIDGET_PORT`). Binds `127.0.0.1` only.

You can also open `spul/widget/index.html` via `file://`, but **Enter will not write disk** until the tiny local server is running (read-only fallback loads `PROJECT_MEMORY.json`).

## Project memory (latent stand-in)

| Path | Role |
| --- | --- |
| [`PROJECT_MEMORY.json`](./PROJECT_MEMORY.json) | Shared continuity log — Bill + agents |

- Widget **loads** memory on open.
- Press **Enter** in the prompt → append `{ id, ts, author, text }` **immediately** to the JSON file.
- Recent entries render live in the stream.
- **Copy context for Cursor** builds a paste pack (branch, PR #8, stats, last memory lines).

### Agents

1. At session start, **read** `spul/widget/PROJECT_MEMORY.json` and [`docs/DAY0_MANIFEST.md`](../../docs/DAY0_MANIFEST.md).
2. After meaningful work, **append** a short entry (edit JSON or use the widget Enter box).
3. Do **not** invent an MCP “twin bridge” or claim telepathy with other AIs — this file is the honest coupling.

## Snapshot (Day 0)

- Branch: `s-pul-front_end-Betasearchpages-best-55de`
- PR: [#8](https://github.com/webpointllc-com/TaxCertificateProcessor/pull/8)
- Stats: **2062** listed · **2055** with URL · **1866** active · **7** no URL · **1675** validated-true
- Product path: `spul/` only

## Layout

100% scalable proportional desktop canvas (`1280×820`) — same embed-stage pattern as `spul/public/index.html`. No thin left accent stripes.
