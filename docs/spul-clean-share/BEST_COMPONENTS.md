# Best components to keep (clean / simple / effective)

Pulled from: live `webpoint-spul-beta` (commit `5ef1a1cc…` GitHub inaccessible), DeepShake status notes, `search-spul-test`, and current `spul/`.

## Keep — product core

| Component | Source | Why it’s good |
| --- | --- | --- |
| Hard URL lock (`spulTruth`) | `spul/` + `search-spul-test` | Prevents LLM/search from inventing collector domains. |
| File-backed jurisdiction index | `spul/data/search-index.json` | Simple, inspectable, no managed DB required for v1. |
| Query normalize + aliases | `spul/services/normalizeQuery.js` | “Chicago” → Cook; soft typos; state extraction. |
| Cascade / confidence UI (vanilla) | `spul/public/index.html` | One composition, no Three.js. |
| HTTP hybrid + remainder revalidators | `spul/scripts/*` | Offline quality without Mac DeepShake. |
| Validated-true CSV (1675) | `spul/data/validated-true-urls.csv` | Shareable truth pack for Adam/boss. |
| Path B guide, registry-locked | `spul/services/guide.js` | Optional narration; URL still locked. |
| Health endpoint | `spul` + beta `/api/health` | Ops smoke. |
| Extractor hint shape | beta `/api/search` → `extractor.{platform,search_inputs,hint}` | Clean contract for DeepShake handshake **later**. |
| Seed/master static URL file idea | beta health (`master_validated_static` ~1757) | Same role as registry — merge into `spul/data`, don’t dual-own. |
| Secret-free `.env.example` | `spul/.env.example` | Onboarding hygiene. |
| Squarespace iframe snippet | embed HTML | Marketing wrap only. |

## Keep — ops / Mac (not day-1 app)

| Component | Source | Note |
| --- | --- | --- |
| `scripts/deepshake-hunt-mac.sh` | this repo | Locate DeepShake on T7; does not modify Highlighter. |
| T7 / Passport notes | `docs/AUTODEPLOY_VARIABLE/T7_*` | Visibility only on Bill’s Mac worker. |
| Boss briefing accounts memo | `docs/BOSS_BRIEFING_*` | Business truth; keep internal. |

## Drop / do not share as product

| Component | Source | Why drop |
| --- | --- | --- |
| Three.js + GSAP orb / glass demo UI | live beta | Heavy, brand-noisy, hard to maintain. |
| Request-path `web_search` (DDG) | beta pipeline | Competes with locked registry; invents candidates. |
| Request-path Playwright DeepShake | beta pipeline | Belongs offline; slow/fragile for UX. |
| Live `field_gate` taxonomy probes | beta | Fails on seeded names; not teammate-ready. |
| Preview screenshots + telemetry | beta | Extra surfaces. |
| Groq as required runtime | `search-spul-test` | Optional only; registry is the product. |
| `kata_deploy/` symlink + env duplicates | Bill Desktop screenshot | Collapse to one AWS doc + one `.env.example`. |
| Render-as-production Blueprint story | AUTODEPLOY / PR #2 era | AWS (or owned VPS) is the path. |
| Root “I Just Farted” app | TaxCertificateProcessor root | Quarantine before Adam’s first clone. |
| DEP Highlighter | separate repo | **Do not touch.** |

## DeepShake preview task file

`CURSOR_TASK_DEEPSHAKE_PREVIEW.md` was **not recoverable** here. Effective substitute understanding from live beta engine summary:

```text
pipeline: web_search → candidate_urls → playwright_deep_shake_fetch
        → eight_signal_score → rank_confidence → field_gate_taxonomy
        → preview_screenshot
```

**Shareable rewrite:** only `eight_signal_score` / ranking ideas + extractor handshake may graduate into offline `spul/extractors`. Everything else stays off the public product path until proven.
