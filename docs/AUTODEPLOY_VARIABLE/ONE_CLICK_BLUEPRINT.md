# ONE-CLICK: Apply Render Blueprint (operator)

Code is already pushed. Render MCP/API auth is not available in this agent environment, so the free service must be created once via Dashboard.

## Steps (≈1 minute)

1. Open **https://dashboard.render.com/blueprints/new**
2. Connect / select repo **`webpointllc-com/TaxCertificateProcessor`**
3. Confirm Blueprint reads root **`render.yaml`**:
   - Service: `search-spul-minimal`
   - Plan: **free**
   - `rootDir: spul`
   - `autoDeploy: true`
   - Branch: set to `s-pul-front_end-Betaspul-minimal-deploy-55de` (or merge to your watched branch first)
4. Apply Blueprint
5. Wait for deploy → verify:

```bash
curl -sI https://search-spul-minimal.onrender.com/
curl -s https://search-spul-minimal.onrender.com/api/health
```

Both must be **200** / `ok: true` before declaring live.

## After live

Paste Squarespace iframe from `spul/public/SQUARESPACE_EMBED.html` (or `public/SQUARESPACE_SPUL_EMBED.html`).

## Alternative

Add secret `RENDER_API_KEY` to the cloud agent environment and re-run; agent will call `create_web_service` with autoDeploy.

## Not done from this agent

- Could not push to `search-spul-test` / `mobile` (403)
- Could not create a new org repo
- Could not create GitHub PR (integration lacks `createPullRequest`)
- Precedent highlighter repo was **not** modified (read-only inspection only)
