# S-PUL Minimal Deploy Status

- App path: `spul/`
- Blueprint: `render.yaml` (service `search-spul-minimal`, free, autoDeploy)
- Autodeploy playbook: `docs/AUTODEPLOY_VARIABLE/README.md`
- T7 hunt: `docs/AUTODEPLOY_VARIABLE/T7_VOLUME_HUNT.md` (Bill’s Mac sees T7; cloud VM does not)
- LLM Comm guide: `POST /api/guide` (+ `/api/chat` alias) — registry-locked; optional `GROQ_API_KEY`
- Boss briefing assets under `public/boss-briefing.html` are preserved and unrelated to this service entrypoint (`rootDir: spul`).

Expected URL after Blueprint apply: https://search-spul-minimal.onrender.com

**Live checks (cloud agent, 2026-09-10):**

| URL | Result |
| --- | --- |
| `https://search-spul-minimal.onrender.com` | **404** `x-render-routing: no-server` (Blueprint / API still pending) |
| `https://search-spul-test.onrender.com` | **200** (older Groq S-PUL — read-only precedent, not this service) |

## Status (2026-09-10)

- Code + `render.yaml` pushed on `s-pul-front_end-Betaspul-minimal-deploy-55de`
- Local smoke: `/api/health` OK · Travis/San Diego hit · Chambers AL (google placeholder) honest miss
- Render live URL: **pending** one-click Blueprint or `RENDER_API_KEY` (see `docs/AUTODEPLOY_VARIABLE/ONE_CLICK_BLUEPRINT.md`)
- Open PR manually: https://github.com/webpointllc-com/TaxCertificateProcessor/compare/s-pul-front_end-Betaboss-briefing-accounts-55de...s-pul-front_end-Betaspul-minimal-deploy-55de
