# PASTE-READY PROMPT — Cursor / Grok (Tax Certificate Processor)

Copy everything below the line into a new Cursor Cloud / Desktop agent on repo `webpointllc-com/TaxCertificateProcessor`. Do not ask Bill to re-specify. Execute.

---

You are working in `/workspace` on **webpointllc-com/TaxCertificateProcessor**.

Default git branch for this product: `s-pul-front_end-Betatax-cert-fusion-1fee` (PR https://github.com/webpointllc-com/TaxCertificateProcessor/pull/2). Stay on that PR branch unless told otherwise. If you must branch, follow the workspace git prefix rules, then still land the work on PR #2.

You are Cursor Grok. Complete all of the following in one run. Do not boil the ocean. Do not rewrite the whole app. Another worker may own `public/manual.html` + the Figma user-manual prompt — **do not overwrite those files**; merge if you collide.

## 0. Non-negotiables

- **Accuracy first.** Collector URLs come only from `data/counties.json` + `data/golden_overrides.json`. Never invent hosts. Never “Google a better URL” into the product. Known sheet county with no verified URL → honest `not_found` / `needs_correction`, not a fake portal.
- **Chippewa County, WI is HARD LOCKED** to Catalis LandNav: `https://pp-chippewa-co-wi-fb.app.landnav.com/login/index/` (Guest Sign In). Reject `chippewacounty.gov` (dead). Treasurer + RDS stay on `chippewacountywi.gov`. LandNav payment cap = **10 parcels** (UI + API).
- **UI law:** 100% scale-to-fit **1280×800** identical desktop layout scaled into the iframe (`padding-top: 62.5%`). WebPoint aesthetic: dark navy `#050b20`, cyan glow, **full borders on every panel**, **NO left accent stripes**. Fonts: DM Sans / DM Mono.
- **Bind HTTP to `0.0.0.0:$PORT`.** Render disk is ephemeral — Postgres for anything that must survive a deploy.
- **Pay for hardly anything except Render web + Render PostgreSQL.** Do not add Pinecone, Algolia, Elastic Cloud, OpenAI embeddings, SerpAPI, browserless, or any new paid search vendor.
- `npm test` must pass. Commit, push, update PR #2.

## 1. Stack truth (do not invent paid SaaS)

**Product:** WebPoint Tax Certificate Processor fused with Search Spul generative search. Sellable members-area embed on webpointllc.com.

**Hosting we PAY for (the sellable surface):**

- Render **web service**, Node, Starter, Oregon, `0.0.0.0:$PORT`, health `/api/health`.
- Render **PostgreSQL 16** (Blueprint name `webpoint-tcs-db`, Basic 256MB). Orders / parcels / certificates / conversation log / `tsvector` RAG. `DATABASE_URL` via `fromDatabase` in `render.yaml`.

**We do NOT pay for:**

- Search Spul county DB (in-repo `data/counties.json`).
- Golden URL locks (`data/golden_overrides.json`).
- Groq free-tier LLM **if** `GROQ_API_KEY` is set (optional; lookup + drafts work without it). Groq fills ACTIONS/CONTEXT only.
- Squarespace members page Bill already has.
- WD Passport clone as the source of original Workplace Technologies TCS/TPA/RDS (GitHub org `workplace-technologies` is empty).
- WPT Production Log sheet already ingested (~2,923 unique jurisdictions, 6 tabs: CoreLogic, Lereta, Lument, NTS, Master Log, UPF). Catalog: `data/wpt_production_counties.json`. Aliases: `data/sheet_aliases.json`. Sheet: https://docs.google.com/spreadsheets/d/1yOKyy5NqJHVKiuVO1kYvSIf7s_R7gCGJ2cyfcCz2zcM/edit#gid=1491656814

**Render MCP:** OAuth cannot complete in the cloud agent. Infrastructure-as-code is `render.yaml`. Apply the Blueprint in the Render dashboard. Secrets (`GROQ_API_KEY`, `MEMBER_EMBED_KEY`) stay in the dashboard — never git.

**Embed path:** Squarespace iframe → Render app → Postgres + SPUL files + optional Groq.

## 2. Diagram the live setup

Keep (or refresh) an end-user + operator readable architecture diagram:

- `public/architecture.html` — 1280×800 scale-to-fit, WebPoint aesthetic, full borders, no left accent stripes.
- `public/SQUARESPACE_ARCHITECTURE_EMBED.html` — same 62.5% iframe snippet as the tool.
- `docs/ARCHITECTURE.md` — mermaid of the real graph (Squarespace → Render web → Postgres + SPUL files + optional Groq; Passport off to the side). Paid vs $0 must be obvious.

Show Chippewa WI → LandNav. Show that cloud VMs have no USB. Do not draw fake services.

## 3. Build a Google-class generative search experience (10/10 bar) using ONLY what we built

Members type a county the way they would type into Google. They get the **locked official tax-search page first**, then a short explanation. That is the product.

Already in this repo (use them; do not replace with a vendor):

- Hero search on the tool (`#hero-input`, `#hero-form`, chips from `/api/hero-examples`).
- Typeahead `/api/suggest?q=` over the in-repo county catalog.
- Instant SPUL card from `/api/lookup` (`officialUrl` / `urlLocked` only — never open a `google.com/search` fallback).
- RAG chat `/api/chat` (Postgres `tsvector` + optional Groq stream). URL lock enforcement in `src/services/spulTruth.js`.
- TCS / TPA / RDS order panel, 10-parcel cap, Chippewa defaults.

Improve toward that bar **only with existing code + cheap Render**. Examples of allowed upgrades: tighter hero copy, better typeahead ranking, instant card empty-states, keyboard (↑↓ Enter Esc), fill county/state from a hit, keep chat as follow-up not as the only search box. Forbidden: new paid APIs, scraping live collector sites, inventing URLs, restyling the whole app, replacing Squarespace.

Sellable members embed stays `public/SQUARESPACE_EMBED.html` + `/embed.js`. Optional `?k=` / `MEMBER_EMBED_KEY`.

## 4. Hunt / import the WD Passport clone

Bill may say the WD Passport is **physically plugged into his Mac, blinking green**, but Finder shows nothing. Do this in order:

1. `cursor-cloud` `list-self-hosted-workers`. If a Mac worker is connected, **use it** (computerUse / shell on that machine).
2. On the current host: `/Volumes`, `/media`, `/mnt`, `diskutil` / `lsblk` / `mount`, `WORKPLACE_CLONE_PATH`, `./imports/workplace`.
3. If a GUI Mac is available: Finder (Go → Computer, Go → `/Volumes`), Disk Utility → Show All Devices, System Settings → Privacy & Security (Files and Folders, Full Disk Access, External Volumes). `diskutil list` + `diskutil info`. Look for WD / Passport / exFAT / NTFS that is powered but **not mounted**.
4. If the volume is connected but unmounted, **mount it if safe**. Common causes of blinking-green + invisible in Finder:
   - Volume present in Disk Utility but not mounted (click Mount).
   - NTFS without macFUSE + Mounty (or Microsoft NTFS) — drive powers, macOS will not mount read/write.
   - First-time “Allow” / enable external disks in Privacy.
   - Dead USB port / cable / hub — light blinks, no I/O. Try direct port.
   - APFS/HFS volume that needs First Aid.
5. When a clone path is visible, set `WORKPLACE_CLONE_PATH` and run `npm run import:workplace` (uses `scripts/workplace-scan.js` / `scripts/import-workplace.js`). Do not guess TCS table names before files exist.
6. **Honest report if this cloud VM has no USB and no self-hosted worker** — then give Bill the Disk Utility / Finder steps above. Do not pretend the drive is here.

## 5. Tests, git, PR

- Add/keep tests for: Chippewa LandNav lock, suggest typeahead, architecture page 1280×800 + no `border-left` stripes, Squarespace 62.5% embed, 10-parcel cap, sheet coverage.
- `npm test` must pass.
- Commit with a descriptive message. Push `s-pul-front_end-Betatax-cert-fusion-1fee` (or the PR #2 branch). Update PR #2 (ManagePullRequest if available; otherwise push is enough — `gh` may be read-only).
- Do not commit secrets, the 1000TK ledger, or Passport file dumps.

## 6. Return to Bill (required summary)

1. Passport found / mounted / imported? Path if found. Why Finder might hide a blinking-green WD.
2. Architecture page path + mermaid doc path.
3. Agent prompt path (this file, if you had to refresh it).
4. What search UX you actually changed (one paragraph).
5. `npm test` result + PR #2 status.

## File map (do not get lost)

| Path | What |
| --- | --- |
| `src/server.js` | Express, health, lookup, suggest, chat, orders, embed.js |
| `src/services/urlFinder.js` | parseJurisdiction, lookupForApi, suggestJurisdictions |
| `src/services/spulTruth.js` | URL lock, Google-fallback detection |
| `src/services/taxIntelligence.js` | RAG system prompt + Chippewa playbook |
| `src/db/store.js` + `schema.sql` | Postgres / memory + tsvector |
| `public/index.html` `app.js` `styles.css` | Members tool |
| `public/architecture.html` | Stack diagram |
| `public/manual.html` | End-user manual — **other worker; do not clobber** |
| `render.yaml` | Blueprint |
| `docs/SPINE.md` | Public operating doctrine |
| `docs/ARCHITECTURE.md` | Mermaid + paid vs free |
| `scripts/workplace-scan.js` | Passport hunt |

Chippewa first. Locked URLs only. Render web + Postgres is the bill. Build.
