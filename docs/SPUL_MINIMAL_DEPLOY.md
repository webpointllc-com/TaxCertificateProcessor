# S-PUL Minimal Deploy Status

- App path: `spul/`
- Blueprint: `render.yaml` (service `search-spul-minimal`, free, autoDeploy)
- Autodeploy playbook: `docs/AUTODEPLOY_VARIABLE/README.md`
- T7 / Passport / DeepShake: `docs/AUTODEPLOY_VARIABLE/T7_PASSPORT_DEEPSHAKE.md`, `T7_VOLUME_HUNT.md`, `docs/PASSPORT_RECOVERY.md`
- LLM Comm guide: `POST /api/guide` (+ `/api/chat` alias) — registry-locked; optional `GROQ_API_KEY`
- URL health sample: `npm run health:sample` → `docs/prototype-best-practice/URL_HEALTH_SAMPLE.md`

Expected URL after Blueprint apply: https://search-spul-minimal.onrender.com

**Live checks (cloud agent, 2026-09-10):**

| URL | Result |
| --- | --- |
| `https://search-spul-minimal.onrender.com` | **404** `x-render-routing: no-server` (Blueprint / API still pending) |
| `https://search-spul-test.onrender.com` | **200** (older Groq S-PUL — read-only precedent, not this service) |

## Status (2026-09-10)

- Code + `render.yaml` on `s-pul-front_end-Betaspul-minimal-deploy-55de` (PR #4)
- Local smoke: `/api/health` OK · guide locks Cook IL / San Diego CA · cascade search
- Index: **2052** searchable · health sample refreshed with gated=up classifier
- DeepShake: **not run** (no self-hosted Mac worker / `/Volumes/T7`)
- Render live URL: **pending** one-click Blueprint or `RENDER_API_KEY` (see `ONE_CLICK_BLUEPRINT.md`)
- Highlighter: **untouched** (read-only method clone)
- PR: https://github.com/webpointllc-com/TaxCertificateProcessor/pull/4
