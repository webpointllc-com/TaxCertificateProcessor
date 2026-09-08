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

Use **Render PostgreSQL** (not SQLite, not Mongo, not a spreadsheet).

Why:

- Workplace TCS is an **order / parcel / certificate** system. That is relational.
- Search Spul needs a durable corrections + conversation log. Render disks are **ephemeral**.
- `pg` full-text search (`tsvector`) is the RAG retrieval layer that works **without** an embeddings API. Groq does chat, not embeddings.
- JSONB holds collector payloads until the Passport dump tells us the exact columns.
- Same private network as the web service (`DATABASE_URL` via `fromDatabase` in `render.yaml`).

Plan: start on **Basic 256MB** (or Free only for a 30-day trial — Free Postgres expires). Region: **Oregon**, matching the other WebPoint Render services.

SQLite is used only as an **in-memory fallback** when `DATABASE_URL` is unset (local tests). Production on Render must set `DATABASE_URL`.

## Server choice: Render web service (Node 18+)

Bind `0.0.0.0:$PORT`. Starter plan for a paid members tool (Free spin-down after 15 minutes will look broken inside Squarespace). Auto-deploy from this branch once the Blueprint is applied.

Set in the dashboard (never commit):

- `GROQ_API_KEY` — Search Spul LLM. Lookup + certificate drafts work without it.
- `MEMBER_EMBED_KEY` — optional. Put `?k=...` on the members-page iframe so the public onrender URL can be limited later.
- `WORKPLACE_CLONE_PATH` — only needed on a machine that can see the Passport.

## Squarespace members page

1. Create the paid members area on [webpointllc.com](https://webpointllc.com).
2. On the paid page, add a **Code Block**.
3. Paste `public/SQUARESPACE_EMBED.html` (update the `src` host after the first Render deploy).
4. The iframe is `width: 100%` with `padding-top: 62.5%` (800/1280). The tool **scale-transforms the full desktop layout** so a phone iframe is the same composition, just smaller.

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
