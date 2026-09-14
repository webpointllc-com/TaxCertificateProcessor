# S-PUL shareability audit — 2026-09-14

**For:** Bill (before inviting Adam)  
**Verdict:** Use **`TaxCertificateProcessor/spul/`** as the canonical product. Treat live `webpoint-spul-beta` as an experimental archive reference — do **not** hand Adam that UI/pipeline as-is.

---

## Access limits (honest)

| Source | Result |
| --- | --- |
| Screenshot `kata_deploy/` | Reviewed. Symlink farm of overlapping deploy/runbook/env files. |
| `CURSOR_TASK_DEEPSHAKE_PREVIEW.md` | **Not found** in this workspace, uploads, or accessible `webpointllc-com` repos. Proxies used: `docs/prototype-best-practice/DEEPSHAKE_STATUS.md`, T7 notes, live beta `/api/search` pipeline. |
| GitHub commit `webpointllc-com/webpoint-spul-beta@5ef1a1cc…` | **Repo not accessible** to this agent (`404` / `Repository not found`). |
| Live `https://webpoint-spul-beta.onrender.com` | **HTTP 200** (2026-09-14). Health + `/api/search` inspected read-only. |
| `TaxCertificateProcessor` PR #4 / `spul/` | Full local tree reviewed (1675 validated-true URLs). |
| `search-spul-test` | Read-only structure + `spulTruth` / deploy patterns. |
| DEP Highlighter | **Untouched** (read-only mention only). |

---

## Canonical recommendation

**Canonical repo URL:** https://github.com/webpointllc-com/TaxCertificateProcessor  
**Canonical app path:** `spul/`  
**Shipping branch (today):** `s-pul-front_end-Betaspul-minimal-deploy-55de` (PR #4)  
**This cleanup docs branch:** `s-pul-front_end-Betaadam-clean-share-39e4`

### Why not `webpoint-spul-beta` as product?

1. Named GitHub product repo is **not shareable from this token** (missing or private elsewhere).
2. Live beta is a **demo stack**, not a clean teammate onboarding surface: Three.js/GSAP orb UI, live DDG discovery, Playwright “deep_shake” in the request pipeline, field-gate probes, telemetry.
3. Boss briefing already said move off Render as owned production; beta is still on Render free.
4. `spul/` already has the **connected system pieces** Adam needs: Express API, vanilla UI, locked registry, 1675 HTTP-validated URLs, revalidators, secret-free `.env.example`.

Archive rule: keep beta URL as historical/demo reference; never merge its UI chrome or live-discovery path into the share branch without a deliberate product decision.

---

## Keep / delete table

### A. `TaxCertificateProcessor` (this repo)

| Path | Action | Why |
| --- | --- | --- |
| `spul/server.js` | **KEEP** | Core API: search, health, guide. |
| `spul/services/spulTruth.js` | **KEEP** | Hard URL lock — product law. |
| `spul/services/normalizeQuery.js` | **KEEP** | Layer B aliases (Chicago→Cook, etc.). |
| `spul/services/guide.js` | **KEEP** (optional LLM) | Registry-locked Path B; Groq optional. |
| `spul/public/index.html` | **KEEP** | Clean cascade UI without Three.js. |
| `spul/data/search-index.json` | **KEEP** | Runtime index. |
| `spul/data/validated-true-urls.csv` | **KEEP** | Shareable evidence pack (1675). |
| `spul/data/jurisdictions.json` | **KEEP** | Registry export. |
| `spul/data/counties-export.csv` | **KEEP** | Full county list for ops. |
| `spul/scripts/hybrid-revalidate.js` | **KEEP** | Offline URL quality (DeepShake substitute). |
| `spul/scripts/remainder-revalidate.js` | **KEEP** | Dead/uncertain recovery. |
| `spul/scripts/apply-url-fixes.js` | **KEEP** | Curated HTTP-evidenced fixes. |
| `spul/.env.example` | **KEEP** | No secrets. |
| `spul/extractors/` (new stub) | **KEEP** | Interface only for Mac/DeepShake offline jobs. |
| `docs/spul-clean-share/*` (this pack) | **KEEP** | Adam onboarding + audit. |
| `docs/SPUL_DESCRIPTION_AND_VALIDATED_URLS.txt` | **KEEP** | Paste pack. |
| `docs/prototype-best-practice/QUERY_SHAPES.md` | **KEEP** | Product behavior. |
| `docs/AUTODEPLOY_VARIABLE/*` | **ARCHIVE / demote** | Useful history for free Render proto; **not** production. |
| Root `render.yaml` | **HISTORICAL only** | Free proto OK; AWS is production target. |
| Root `index.html` + root `README.md` (“I Just Farted”) | **DELETE or quarantine** before Adam | Unrelated noise; wrong first impression. |
| `docs/BOSS_BRIEFING_*` | **KEEP (internal)** | Accounts truth; not required for day-1 code. |
| `docs/PASSPORT_RECOVERY.md`, `T7_*`, passport scripts | **KEEP (ops Mac only)** | Not in Adam day-1 path. |
| Duplicate `SPUL_DESCRIPTION_*.md` + `.txt` | **KEEP one** (prefer `.txt` paste pack) | Redundant pair. |
| Large revalidate JSON blobs in git | **TRIM later** | Useful evidence; consider Git LFS or `artifacts/` outside clone for Adam. |
| `public/boss-briefing.html` | **KEEP optional** | Marketing; not runtime. |
| DEP Highlighter (any path) | **NEVER TOUCH** | Out of scope. |

### B. `kata_deploy/`-style clutter (screenshot)

| Item pattern | Action | Why |
| --- | --- | --- |
| Symlink → many `*_RUNBOOK*`, `FREE_DEPLOY`, `PREP_AUTO_DEPLOY`, `SELF_HOSTED_*`, `MAINTENANCE_*`, `SYNC_OPERATOR` | **DELETE from share tree** | Overlapping operator notes; collapse into one AWS + one local README. |
| Duplicate `.webpoint_deploy.env` + `.deploy.env.example` + symlink env | **KEEP one `.env.example` only** | Never commit real `.env`. |
| Duplicate `SPUL_SEED_VALIDA*` (symlink + copy) | **KEEP one seed/validated CSV** | Prefer `spul/data/validated-true-urls.csv`. |
| `SQUARESPACE_EM*` | **Collapse** into a 10-line iframe snippet in README | Not a separate product. |
| `BROWSER_FETCH.md`, `MASTER_SEED_*`, `KATA_*` notes | **Archive off-repo** or one `docs/archive/` | Noise for onboarding. |
| `FREE_DEPLOY.md` / Render-first guides | **Historical note only** | Production = AWS. |

### C. Live `webpoint-spul-beta` (commit inaccessible — audited via live service)

| Component | Action | Why |
| --- | --- | --- |
| Master/seed static URL file (~1757 lines) | **KEEP idea** | Same job as `spul` registry; migrate best rows into `spul/data`. |
| `/api/search` confidence + extractor hint (`platform`, `search_inputs`) | **KEEP shape** | Clean interface for DeepShake handshake later. |
| `/api/health` coverage counters | **KEEP idea** | Ops clarity. |
| URL lock / no Google fallback (from `search-spul-test` lineage) | **KEEP** | Already in `spul/services/spulTruth.js`. |
| Three.js + GSAP orb / glass UI | **DROP** | Demo chrome; hard to maintain; not product. |
| Pipeline step `web_search` (DDG) on request | **DROP from product path** | Invents candidates; conflicts with “never invent URLs.” Offline only if ever. |
| `playwright_deep_shake_fetch` **in request path** | **DROP from request path** | Move to offline Mac worker / extractors job. |
| `field_gate` live probes failing on seeded last names | **DROP or offline** | Noisy; not ready to share. |
| `preview_screenshot` | **DROP for v1** | Nice-to-have later. |
| Telemetry POST `/api/telemetry` | **DROP for share** | Extra surface. |
| Llama score fields | **DROP** | Registry product does not need hosted LLM. |

### D. `search-spul-test` (precedent)

| Component | Action |
| --- | --- |
| `services/spulTruth.js` | Already ported — **KEEP** in `spul`. |
| Correction queue / golden overrides | **Later** — not day-1. |
| Groq streaming chat | **DROP** for owned product (optional narration only). |
| Deploy-hook docs | Historical Render pattern only. |

---

## Redundancy themes

1. **Too many deploy docs** saying the same free-Render thing five ways (`kata_deploy`, `AUTODEPLOY_VARIABLE`, `SPUL_MINIMAL_DEPLOY`, `ONE_CLICK_BLUEPRINT`).
2. **Two UIs** (minimal `spul` vs beta orb) for one product story.
3. **Two registries** (beta seed ~1757 vs `spul` 1675 validated-true / 1866 active) without a single owner file.
4. **Root of TaxCertificateProcessor** still presents an unrelated joke app — fix before Adam clones.

---

## Production host

| Target | Role |
| --- | --- |
| **AWS Lightsail (preferred minimal)** or single **EC2** | Production Node bind `0.0.0.0:$PORT` + Caddy/nginx TLS. |
| **ECS/Fargate** | Only if Bill wants containers/autoscaling later — overkill for current file-backed index. |
| **Render free** | Historical / optional demo only — not the owned system. |
| **Kamatera** | Still in boss briefing as existing VPS option; AWS is the chosen long-term path per this cleanup. |
