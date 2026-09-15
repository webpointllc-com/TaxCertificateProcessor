# S-PUL — Search Page URL Locator

Generative jurisdiction search: type a place, get the **official** county/city tax search URL + confidence — or an honest miss. **Never invents URLs.**

**Canonical path in repo:** `spul/` inside [TaxCertificateProcessor](https://github.com/webpointllc-com/TaxCertificateProcessor)  
**Day 0 handoff:** [`docs/DAY0_MANIFEST.md`](../docs/DAY0_MANIFEST.md) · reviewer PR [#8](https://github.com/webpointllc-com/TaxCertificateProcessor/pull/8)  
**Continuity widget (project memory):** [`widget/`](./widget/) — `npm run widget` → http://127.0.0.1:3847/ · memory file [`widget/PROJECT_MEMORY.json`](./widget/PROJECT_MEMORY.json)

## Quick start

```bash
cd spul
cp .env.example .env
npm install
npm start
# http://localhost:3000  ·  GET /api/health
# http://localhost:3000/?embed=1  ·  Squarespace iframe mode
```

## Squarespace /searchpages

Proportional desktop layout (1280×820 → scales to iframe width). Snippet: [`docs/SEARCHPAGES_EMBED.md`](../docs/SEARCHPAGES_EMBED.md) · live helper page `/SQUARESPACE_EMBED.html`.

## What ships here

| Layer | Path |
| --- | --- |
| UI | `public/index.html` (`?embed=1` for iframe) |
| API | `server.js` → `/api/search`, `/api/health`, `/api/guide` |
| URL lock | `services/spulTruth.js` |
| Data | `data/search-index.json` · `data/validated-true-urls.csv` (**1675** true) |
| Offline quality | `scripts/hybrid-revalidate.js`, `remainder-revalidate.js` |
| Extractors contract | `extractors/` (DeepShake offline — not in request path) |

## Deploy

**Production: AWS** — see [`docs/aws/LIGHTSAIL_MINIMAL.md`](../docs/aws/LIGHTSAIL_MINIMAL.md).  
Bind `0.0.0.0:$PORT`. No secrets in git.

Render free / `render.yaml` = historical proto only.

## Adam

Start with [`docs/spul-clean-share/ADAM_ONBOARDING.md`](../docs/spul-clean-share/ADAM_ONBOARDING.md).  
Audit / keep-delete: [`docs/spul-clean-share/AUDIT_MEMO.md`](../docs/spul-clean-share/AUDIT_MEMO.md).

## Out of scope

Central Intelligence · voice · DEP Highlighter · live beta Three.js demo as product.
