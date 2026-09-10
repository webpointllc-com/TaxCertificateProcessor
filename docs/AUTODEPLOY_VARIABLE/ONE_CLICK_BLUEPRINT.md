# ONE-CLICK: Apply Render Blueprint (operator)

Code is pushed on `s-pul-front_end-Betaspul-minimal-deploy-55de` (PR #4).

Render MCP/API in the cloud agent is **unauthorized** (`list_workspaces` fails; `RENDER_API_KEY` unset; CLI needs `render login`). Free service must be created once via Dashboard **or** by adding an API key and re-running the agent.

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

Add secret `RENDER_API_KEY` to the cloud agent environment and re-run; agent will call `create_web_service` with autoDeploy + `workspaceId` from `list_workspaces`.

Mac precedent (highlighter method only — do not edit that repo): Desktop `Webpoint_ Workspace/Toolbox/deploy` + Deploy Hook; see `T7_PASSPORT_DEEPSHAKE.md`.

## Not done from this agent

- Could not push to `search-spul-test` / `mobile` (403)
- Could not create a new org repo
- Could not create GitHub PR (integration lacks `createPullRequest`) — PR #4 already open
- Precedent highlighter repo was **not** modified (read-only inspection only)
- DeepShake **not run** (no self-hosted worker / T7 / Passport mount)
- `/Volumes/T7` confirmed in **Bill’s Mac Finder** only — cloud VM has no `/Volumes`; no computerUse tool; see `T7_VOLUME_HUNT.md`
- Render MCP `list_workspaces` → **unauthorized** (needs OAuth or `RENDER_API_KEY`)
