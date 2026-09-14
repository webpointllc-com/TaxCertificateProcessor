# S-PUL Minimal Deploy Status

- App path: `spul/`
- Blueprint: `render.yaml` (service `search-spul-minimal`, free, autoDeploy)
- Autodeploy playbook: `docs/AUTODEPLOY_VARIABLE/README.md`
- T7 / Passport / DeepShake: `docs/AUTODEPLOY_VARIABLE/T7_PASSPORT_DEEPSHAKE.md`, `T7_VOLUME_HUNT.md`, `docs/PASSPORT_RECOVERY.md`, `docs/prototype-best-practice/DEEPSHAKE_STATUS.md`
- LLM Comm guide: `POST /api/guide` (+ `/api/chat` alias) — registry-locked; optional `GROQ_API_KEY`
- URL health: full crawl + gated reclass + curated fixes → `docs/prototype-best-practice/URL_HEALTH_SAMPLE.md`, `URL_FIXES.md`

Expected URL after Blueprint apply: https://search-spul-minimal.onrender.com

**Live checks (cloud agent, 2026-09-10):**

| URL | Result |
| --- | --- |
| `https://search-spul-minimal.onrender.com` | **404** `x-render-routing: no-server` (Blueprint / API still pending) |
| `https://search-spul-test.onrender.com` | **200** (older Groq S-PUL — read-only precedent, not this service) |

## Status (2026-09-10)

- Code + `render.yaml` on `s-pul-front_end-Betaspul-minimal-deploy-55de` (PR #4)
- Local smoke: `/api/health` OK · guide locks Travis/Cook/San Diego · cascade search + LLM Comm panel
- Index: **2055** searchable · **~1969** active after full HTTP crawl + URL fixes (403/429 treated as up)
- DeepShake: **not run** (no self-hosted Mac worker / `/Volumes/T7`) — HTTP substitute + curated fixes only
- Render live URL: **pending** one-click Blueprint or `RENDER_API_KEY` (see `ONE_CLICK_BLUEPRINT.md`)
- Highlighter: **untouched** (read-only method clone)
- PR: https://github.com/webpointllc-com/TaxCertificateProcessor/pull/4

## Squarespace iframe (after HTTP 200)

```html
<iframe
  src="https://search-spul-minimal.onrender.com"
  width="100%"
  height="700"
  style="border:none;border-radius:16px;overflow:hidden;"
  title="S-PUL Property Tax Search"
  loading="lazy"
></iframe>
```
