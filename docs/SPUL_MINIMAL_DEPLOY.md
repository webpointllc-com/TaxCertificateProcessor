# S-PUL Minimal Deploy Status

- App path: `spul/`
- Blueprint: `render.yaml` (service `search-spul-minimal`, free, autoDeploy)
- Autodeploy playbook: `docs/AUTODEPLOY_VARIABLE/README.md`
- Boss briefing assets under `public/boss-briefing.html` are preserved and unrelated to this service entrypoint (`rootDir: spul`).

Expected URL after Blueprint apply: https://search-spul-minimal.onrender.com

## Status (2026-09-10)

- Code + `render.yaml` pushed on `s-pul-front_end-Betaspul-minimal-deploy-55de`
- Local smoke: `/api/health` OK · Travis/San Diego hit · Chambers AL (google placeholder) honest miss
- Render live URL: **pending** one-click Blueprint or `RENDER_API_KEY` (see `docs/AUTODEPLOY_VARIABLE/ONE_CLICK_BLUEPRINT.md`)
- Open PR manually: https://github.com/webpointllc-com/TaxCertificateProcessor/compare/s-pul-front_end-Betaboss-briefing-accounts-55de...s-pul-front_end-Betaspul-minimal-deploy-55de
