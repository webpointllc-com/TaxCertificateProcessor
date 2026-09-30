# WebPoint Tax Certificate Processor

Sellable, Squarespace-embeddable tax certificate software. Chippewa County, Wisconsin is the first live county.

This repo is no longer the placeholder app. It fuses:

| Source | What we took |
| --- | --- |
| **Search Spul** (`search-spul-test` + Squarespace **Searching**) | Locked collector URLs from the live Searching registry (`data/spul_searching_inventory.json`), Groq RAG prompt injection, county DB, correction/golden override rules |
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

Use **Render PostgreSQL** (not SQLite, not Mongo, not a spreadsheet). Do not stand up a second AWS RDS this month unless you are pointing `DATABASE_URL` at an **already-paid** instance.

Why:

- Workplace TCS is an **order / parcel / certificate** system. That is relational.
- Search Spul needs a durable corrections + conversation log. Render disks are **ephemeral**.
- `pg` full-text search (`tsvector`) is the RAG retrieval layer that works **without** an embeddings API. Groq does chat, not embeddings.
- JSONB holds collector payloads until the Passport dump tells us the exact columns.
- Same private network as the web service (`DATABASE_URL` via `fromDatabase` in `render.yaml`).
- Testing conversations on `/v1/chat` and `/v1/feedback` survive deploys. The Node app is host-agnostic (`0.0.0.0:$PORT` + `DATABASE_URL`). A later AWS cutover is `pg_dump` + the `Dockerfile`, not a product rewrite.

Plan: **Basic 256MB ($7/mo)**. Do **not** use Free Postgres (expires in 30 days). Region: **Oregon**.

SQLite/memory is only the local test fallback when `DATABASE_URL` is unset. Production on Render must set `DATABASE_URL`.

## Server + LLM (the decision)

**Launch on Render, not a new AWS bill.** A greenfield ALB + Fargate + RDS + NAT stack is $45–90/mo. Render Starter + Postgres is **$14/mo** and is the professional Squarespace iframe host (Free web spin-down after 15 minutes looks broken to members). Ride existing idle AWS only if that capacity is already on the bill.

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
| **Greenfield AWS** (ALB + Fargate + RDS + NAT) | **$45–90** | $540–1,080 | No — more expensive until ~500+ users |
| **Total to turn it on** | **$14** | **$168** | |

Render **is** scalable at an affordable rate through a few hundred concurrent researchers. Starter is 512MB / 0.5 CPU, one instance — fine for launch. Standard ($25) and Pro ($85, autoscale) are the next rungs. Node is async, so this is not Gunicorn’s two-chat ceiling.

**AWS is not cheaper just because the company already has an AWS login.** A *new* production stack (ALB ~$16 + Fargate ~$15–25 + RDS ~$12–25 + NAT Gateway ~$32) is **3–6× Render** before Groq. AWS wins only when (a) this app sits on **idle RDS/ECS you already pay for** (marginal cost near $0), or (b) you are north of ~500–1,200 users with reserved capacity. Same Node app either way: `0.0.0.0:$PORT` + `DATABASE_URL`. `Dockerfile` is the swap, not a rewrite of the product.

Do not buy RunPod/Lambda until year 2. Do not rebuild every flow onto AWS to “save money” at 50 users — that is how a $14 tool becomes a $70 tool that still talks to Groq.

Pay: open [`/pay.html`](public/pay.html) (or `npm run pay` / `bash scripts/ru.sh`). That page has the selected stack (Starter web + Postgres Basic 256MB = **$14/mo**) and a **Prep to pay** toggle. Flip it to jump straight to [Render billing](https://dashboard.render.com/billing), then [Apply Blueprint](https://dashboard.render.com/blueprint/new?repo=https://github.com/webpointllc-com/TaxCertificateProcessor), then paste Groq key from [console.groq.com/keys](https://console.groq.com/keys) into the Render Dashboard (never git).

## Squarespace members page

The live operator page is [webpointllc.com/searching](https://webpointllc.com/searching). Layout is already decided:

1. **Top** — Tax Certificate Processor iframe (`class="wp-tcs-frame"`, `src="https://tax-certificate-processor.onrender.com/"`). Paste `public/SQUARESPACE_EMBED.html`. Render billing and OTP are operator-owned.
2. **Below** — County Tax Collecting Entity Index (~1,675 validated collector URLs). Same registry as `data/spul_searching_inventory.json` and `public/County_Names_Urls_BillValidated.html`.
3. The iframe is `width: 100%` with `padding-top: 62.5%` (800/1280). The tool **scale-transforms the full desktop layout** so a phone iframe is the same composition, just smaller.
4. Optional: embed the end-user manual from `public/SQUARESPACE_MANUAL_EMBED.html` (same 62.5% iframe, `/manual.html`). The tool header includes **User guide** and **Architecture**.
5. Members land on the Google-style search bar. Sign in is required before a research task. Email/password plus a confirmation link; Google/Apple light up when those keys are set on Render. Shop code `WP-XXXX-XXXX` or skip for one free task. Sessions use `X-Auth-Token` in `localStorage` so the Squarespace iframe still works without third-party cookies.

Site passwords and Restricted Index access codes stay with the operator. They are never stored in this repo.

Optional script tag (host will match the request):

```html
<script src="https://YOUR-SERVICE.onrender.com/embed.js" data-key=""></script>
```

## Local

```bash
npm install
npm test
npm start          # http://localhost:3000
npm run pay        # chmod ru.sh, copy Claude handoff, open billing, start 0.0.0.0:$PORT
# then: /pay.html?prep=1  and  /embed-preview.html  (62.5% iframe, working now)
```

Same process in Docker (Render and a later AWS cutover use this image):

```bash
docker build -t webpoint-tcs .
docker run --rm -p 3000:3000 -e PORT=3000 webpoint-tcs
```

Cutover runbook when load actually requires AWS: [`docs/HOST_SWAP.md`](docs/HOST_SWAP.md). ECS example: [`deploy/ecs-task-definition.example.json`](deploy/ecs-task-definition.example.json).

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
npm run import:searching    # fuse Squarespace Searching / searchpages URL grid
```

Missing sheet counties are stored with `coverageStatus: needs_correction` and **no invented URL**. Typos such as `WI-Horry` alias to `SC-Horry`. Catalog: `data/wpt_production_counties.json`.

## Architecture (how the pieces connect)

End-user + operator diagram (same 1280×800 canvas): [`public/architecture.html`](public/architecture.html). Squarespace paste: [`public/SQUARESPACE_ARCHITECTURE_EMBED.html`](public/SQUARESPACE_ARCHITECTURE_EMBED.html). Mermaid + paid-vs-free table: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

**We pay for:** Render web (Node Starter) + Render PostgreSQL. **We do not pay for:** SPUL county files, golden locks, the ingested WPT sheet (~2,923 jurisdictions), Groq free-tier if keyed, Squarespace members, or the WD Passport clone.

## Paste-ready agent prompt

[`docs/AGENT_PROMPT_GOOGLE_CLASS_SEARCH.md`](docs/AGENT_PROMPT_GOOGLE_CLASS_SEARCH.md) — Bill can paste that into a new Cursor/Grok turn to diagram the live setup, push Google-class search on this stack only, hunt the Passport, and keep spend on Render.

## Spine

Non-secret operating doctrine: [`docs/SPINE.md`](docs/SPINE.md). The private EF_EE 1000TK ledger is not in this repo.
