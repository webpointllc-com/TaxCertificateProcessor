# WebPoint Tax Certificate Processor

Sellable, Squarespace-embeddable tax certificate software. Chippewa County, Wisconsin is the first live county.

This repo is no longer the placeholder app. It fuses:

| Source | What we took |
| --- | --- |
| **Search Spul** (`search-spul-test`) | Locked collector URLs, Groq RAG prompt injection, county DB, correction/golden override rules |
| **Workplace Technologies TCS / TPA / RDS** | Certificate, portfolio, and recorded-document products (clone lives on the WD Passport — GitHub org is empty) |
| **Real-Time-Tax** | `ScaleToFit` 1280×800 identical-desktop embed, Squarespace `frame-ancestors`, session-without-3rd-party-cookies |
| **DEP Highlighter** | WebPoint visual language (no left accent stripes) |
| **webpointllc.com** | 10-parcel batch demo matching LandNav Chippewa’s own 10-parcel payment cap |

## What I think of the Passport clone

The `workplace-technologies` GitHub org still exists and has **zero repositories**. That matches “the company is gone on GitHub.” The clone on the WD Passport is the only remaining source of the original TCS/TPA/RDS schema, collector adapters, and any shared database dumps.

This cloud agent **cannot see a USB drive**. There is no self-hosted Cursor worker online, and `/Volumes` is empty here. As soon as the Passport is plugged into a Mac that can run `cursor worker start`, or you copy the clone to `./imports/workplace` and set `WORKPLACE_CLONE_PATH`, run:

```bash
npm run import:workplace
```

The importer inventories SQL dumps, CSVs, JSON, and app trees and records them in Postgres (`workplace_imports`). Next pass maps those tables onto the TCS schema below — we do not guess table names before we have the files.

## Database choice: Render PostgreSQL

Use **Render PostgreSQL** (not SQLite, not Mongo, not a spreadsheet, not AWS RDS yet).

Why:

- Workplace TCS is an **order / parcel / certificate** system. That is relational.
- Search Spul needs a durable corrections + conversation log. Render disks are **ephemeral**.
- `pg` full-text search (`tsvector`) is the RAG retrieval layer that works **without** an embeddings API. Groq does chat, not embeddings.
- JSONB holds collector payloads until the Passport dump tells us the exact columns.
- Same private network as the web service (`DATABASE_URL` via `fromDatabase` in `render.yaml`).
- Testing conversations on `/v1/chat` and `/v1/feedback` survive deploys. When you later swap to AWS, `pg_dump` the same schema — the Node app already binds `0.0.0.0:$PORT`.

Plan: **Basic 256MB ($7/mo)**. Do **not** use Free Postgres (expires in 30 days). Region: **Oregon**.

SQLite/memory is only the local test fallback when `DATABASE_URL` is unset. Production on Render must set `DATABASE_URL`.

## Server + LLM (the decision)

**Launch on Render, not AWS.** AWS is a later cutover once the product is taking paid load and you want a dedicated GPU box. Render Starter is the professional always-on surface for a Squarespace iframe (Free web spin-down after 15 minutes looks broken to members).

**Claude 4.6 is the coding agent. It is not the production tax LLM.** Production stack:

| Layer | Model | Role |
| --- | --- | --- |
| Workhorse | Llama 3.3 70B on Groq | County lookup, intake, FAQ, routing (`MODEL_PROVIDER=groq`) |
| Heavy lift (optional) | Anthropic Sonnet via `ANTHROPIC_API_KEY` | Extractor heal / ambiguous certificate reasoning |
| Year 2+ | Fine-tuned Llama 70B on *your* county data | Self-hosted GPU — not this month |

Node is async, so Starter is not Gunicorn’s “2 workers = 2 chats.” Chat still waits on Groq, which is hundreds of tokens/sec, not a 60s Anthropic hold.

### What the boss pays this month

| Item | Monthly | Annual | Required to go live |
| --- | --- | --- | --- |
| Render web **Starter** | **$7** | $84 | Yes — always-on iframe |
| Render Postgres **Basic 256MB** | **$7** | $84 | Yes — durable memory |
| Groq Llama 3.3 70B | $0–15 at launch volume | ~$0–180 | Free key first; card later |
| Anthropic API | $0 | $0 | Off until we turn it on |
| AWS / GPU box | $0 | $0 | Not this launch |
| **Total to turn it on** | **$14** | **$168** | |

At ~200 users expect ~$14 compute + ~$40–80 Groq. Do not buy RunPod/Lambda until year 2.

Pay: [Render billing](https://dashboard.render.com/billing) → Apply Blueprint → paste Groq key from [console.groq.com/keys](https://console.groq.com/keys).

## Squarespace members page

1. Create the paid members area on [webpointllc.com](https://webpointllc.com).
2. On the paid page, add a **Code Block**.
3. Paste `public/SQUARESPACE_EMBED.html` (update the `src` host after the first Render deploy).
4. The iframe is `width: 100%` with `padding-top: 62.5%` (800/1280). The tool **scale-transforms the full desktop layout** so a phone iframe is the same composition, just smaller.
5. Optional: embed the end-user manual from `public/SQUARESPACE_MANUAL_EMBED.html` (same 62.5% iframe, `/manual.html`). The tool header includes **User guide** and **Architecture**.
6. Members land on the Google-style search bar. Sign in is required before a research task. Email/password plus a confirmation link; Google/Apple light up when those keys are set on Render. Shop code `WP-XXXX-XXXX` or skip for one free task. Sessions use `X-Auth-Token` in `localStorage` so the Squarespace iframe still works without third-party cookies.

Optional script tag (host will match the request):

```html
<script src="https://YOUR-SERVICE.onrender.com/embed.js" data-key=""></script>
```

## Local

```bash
npm install
npm test
npm start   # http://localhost:3000
```

## Chippewa County WI (first county)

Search Spul had `https://chippewacounty.gov/` which does not resolve. Golden override now locks:

- Tax search: [LandNav / Catalis public portal](https://pp-chippewa-co-wi-fb.app.landnav.com/login/index/) (Guest Sign In)
- Treasurer: [chippewacountywi.gov/169/Treasurer](https://chippewacountywi.gov/169/Treasurer)
- RDS: [Online Real Estate Search](https://www.chippewacountywi.gov/451/Online-Real-Estate-Search)

## WPT Production Log counties

S-PUL must know every jurisdiction on the [WPT Production Log](https://docs.google.com/spreadsheets/d/1yOKyy5NqJHVKiuVO1kYvSIf7s_R7gCGJ2cyfcCz2zcM/edit#gid=1491656814) (CoreLogic, Lereta, Lument, NTS, Master Log, UPF).

```bash
npm run sync:sheet          # fetch sheet, merge stubs, apply golden locks
npm run import:master       # optional local MASTER_VALIDATED ndjson + golden
```

Missing sheet counties are stored with `coverageStatus: needs_correction` and **no invented URL**. Typos such as `WI-Horry` alias to `SC-Horry`. Catalog: `data/wpt_production_counties.json`.

## Architecture (how the pieces connect)

End-user + operator diagram (same 1280×800 canvas): [`public/architecture.html`](public/architecture.html). Squarespace paste: [`public/SQUARESPACE_ARCHITECTURE_EMBED.html`](public/SQUARESPACE_ARCHITECTURE_EMBED.html). Mermaid + paid-vs-free table: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

**We pay for:** Render web (Node Starter) + Render PostgreSQL. **We do not pay for:** SPUL county files, golden locks, the ingested WPT sheet (~2,923 jurisdictions), Groq free-tier if keyed, Squarespace members, or the WD Passport clone.

## Paste-ready agent prompt

[`docs/AGENT_PROMPT_GOOGLE_CLASS_SEARCH.md`](docs/AGENT_PROMPT_GOOGLE_CLASS_SEARCH.md) — Bill can paste that into a new Cursor/Grok turn to diagram the live setup, push Google-class search on this stack only, hunt the Passport, and keep spend on Render.

## Spine

Non-secret operating doctrine: [`docs/SPINE.md`](docs/SPINE.md). The private EF_EE 1000TK ledger is not in this repo.
