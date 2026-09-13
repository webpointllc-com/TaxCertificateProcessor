# Live search-page triangulation — what it takes (Bill checklist)

Honest architecture for **real-time / live** confirmation of S-PUL official search pages. CI and voice stay out of scope. DEP Highlighter untouched.

## Layers

### Layer A — Registry match (shipped)

- Extractor index in `spul/data/search-index.json` (~2055 searchable / ~1969 active after health + URL fixes).
- `GET/POST /api/search`, `POST /api/guide` — score county+state, return locked URL + confidence.
- **Never invent URLs.** Honest miss when absent.

### Layer B — Alias / NLP normalization (local, no invented URLs)

- `normalizeQuery()` city→county, abbrevs (`LA County`), typo fold, strip treasurer/collector/assessor noise.
- Output is still a query string that Layer A must resolve against the registry.
- Cost: CPU only on the web dyno. Safe on Render free.

### Layer C — Live triangulation (not fully shipped)

Goal: **verify** the registry URL is still the official search page, optionally confirm assessor vs treasurer.

| Step | What | Where |
| --- | --- | --- |
| C1 | HEAD/GET registry URL; treat 2xx/3xx + gated 401/403/405/429 as up | Cloud (already: health sample / full reclass) |
| C2 | Title / form sniff — HTML contains search form, “property tax”, parcel/owner fields | Cloud worker or on-demand (rate-limit) |
| C3 | DeepShake / dork on Mac when T7 + Passport available | Bill’s Mac only (`scripts/deepshake-hunt-mac.sh`) |
| C4 | Optional multi-source confirm — second official source (assessor vs treasurer) **only if both exist in registry or curated fix list** | Curated `url-fixes.json`; never LLM |
| C5 | Write-back — flip `active`, apply fix, bump confidence | Offline job → commit index; not free-tier request path |

## Cost & hosting

| Path | Fit | Notes |
| --- | --- | --- |
| **Render free web** | Layer A + B + light C1 sample | Spins down ~15 min idle; ephemeral FS; no long crawls; Blueprint still needs Apply / API key |
| **Render paid / background worker** | Scheduled C1–C2 health | Better for full 2k HEAD/GET; still no Mac DeepShake |
| **Kamatera (or similar VPS)** | Always-on triangulation worker | Good for queue + Redis; still needs egress allowlist; DeepShake remains Mac/T7 |
| **Bill’s Mac + T7** | C3 DeepShake / Passport | Cloud VM cannot mount `/Volumes/T7`; do not block deploys on DeepShake |

## What NOT to do

1. **LLM inventing URLs** — Groq (if keyed) narrates around locked registry truth only.
2. **Live Google/Bing scrape as source of truth** — dorks are Mac/DeepShake assist, then human/curated write-back.
3. **On-request full crawl of 2k counties** — kills free dyno, looks like abuse, timeouts.
4. **Touch Highlighter / CI / voice** in this track.
5. **Treat assessor as collector** without an indexed Search URL or curated fix.

## Bill checklist (minimal path to “live”)

- [ ] Keep PR #4 `search-spul-minimal` on Render (Apply Blueprint or `RENDER_API_KEY`).
- [ ] Ship Layer A+B (this branch): registry + `normalizeQuery` aliases.
- [ ] Nightly/weekly **C1 sample or full** health job; commit `active` flips + `url-fixes.json` (already patterned).
- [ ] On Mac: run DeepShake hunt for inactive/broken subset; paste curated fixes → `apply-url-fixes.js`.
- [ ] Optional: Kamatera worker for continuous C1–C2 if free Render spin-down hurts UX.
- [ ] Only then: expose “last verified at” in `/api/guide` response (metadata, not a new URL).

## Current honest status

- Registry + health substitute: **done** (cloud HTTP; gated = up).
- DeepShake: **not_run** from cloud.
- Live per-request triangulation: **not enabled** (correct — cost + correctness).
- Layer B aliases: **in code** on deploy branch.
