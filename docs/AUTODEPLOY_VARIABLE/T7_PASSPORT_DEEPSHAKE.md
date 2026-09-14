# T7 / WD Passport / Mac workplace clone notes

These notes extend `AUTODEPLOY_VARIABLE` with **where the prior auto-deploy tooling lived**.
This cloud VM cannot see USB disks. Do not invent mounts.

## How highlighter auto-deploy actually worked (READ-ONLY clone of method)

Precedent repo `webpointllc-com/webpoint-dep-highlighter` (do **not** edit it):

1. Root `render.yaml` → free Python web service `webpoint-dep-highlighter`, `autoDeploy` via Blueprint / GitHub connect.
2. After first create: push to watched branch **or** Deploy Hook URL (`https://api.render.com/deploy/srv-…?key=…`) stored as GitHub Actions secret `RENDER_DEPLOY_HOOK_URL` / local `.env`.
3. Mac one-click path Bill used (Desktop workspace, not cloud):

```text
/Users/billmccreary/Desktop/Webpoint_ Workspace/Toolbox/deploy
./MAKE_LIVE.sh   # wake URL + clipboard iframe + optional deploy hook
```

4. Squarespace iframe → toolbox / members Code block after HTTP 200.

**Clone this mechanism for S-PUL:** Blueprint + `autoDeploy: true` + free plan + iframe. Never modify highlighter source/docs/deploy.

## WD Passport / Samsung T7

| Device | Role | Cloud agent visibility |
|--------|------|------------------------|
| **WD My Passport** | Workplace-technologies clone (often unreadable GPT until Ignore + forensic) | **Not mounted here.** See `docs/PASSPORT_RECOVERY.md` |
| **Samsung T7** | Alternate clone / DeepShake / auto-deploy notes Bill referenced | **Mounted on Bill’s Mac** (Finder Locations → T7). **Not** visible on this Linux cloud VM (`/Volumes` absent). Needs `cursor worker start` on that Mac for agents to browse `/Volumes/T7`. See `T7_VOLUME_HUNT.md`. |
| Mac `/Volumes/*` | Only after macOS mounts a volume | Requires `cursor worker start` on that Mac |

Environment probes this agent ran:

- `WORKPLACE_CLONE_PATH` — unset
- `/Volumes` — absent on Linux cloud VM
- `cursor-cloud list-self-hosted-workers` — **0 workers**
- DeepShake — local Mac extraction/URL-fix engine → **not reachable**; do not claim it ran

After a volume mounts on the Mac:

```bash
export WORKPLACE_CLONE_PATH="/Volumes/<name>/path/to/workplace-technologies"
# optional: npm run import:workplace when that script exists in the clone
cursor worker start   # so cloud agents can see the mount
```

## S-PUL free deploy (this repo)

| Field | Value |
|-------|-------|
| Repo | `https://github.com/webpointllc-com/TaxCertificateProcessor` |
| Branch | `s-pul-front_end-Betaspul-minimal-deploy-55de` |
| Blueprint | root `render.yaml` |
| Service | `search-spul-minimal` |
| Plan | free |
| rootDir | `spul` |
| Expected URL | `https://search-spul-minimal.onrender.com` |

### Blockers observed 2026-09-10

- `RENDER_API_KEY` unset in cloud agent env
- Render MCP `list_workspaces` → **unauthorized** (OAuth/API not usable to create service)
- Render CLI installed but `render login` required (no browser credentials in env)
- Prior agents “Log into Render dashboard” / “Retry Render dashboard login” could not complete Google OAuth without secrets

### Unblock (operator — pick one)

1. **Fastest:** Dashboard → [Blueprint new](https://dashboard.render.com/blueprints/new) → connect `TaxCertificateProcessor` → apply `render.yaml` on the shipping branch (see `ONE_CLICK_BLUEPRINT.md`).
2. Add secret `RENDER_API_KEY` (Account Settings → API Keys) to the cloud agent environment, re-run; agent calls `create_web_service`.
3. On Mac with Desktop Toolbox deploy folder: mirror highlighter Deploy Hook pattern for `search-spul-minimal` once the service exists.

## Highlighter untouched

`HIGHLIGHTER_TOUCHED: no` — only read-only GitHub API inspection of `render.yaml` / `DEPLOY_NOW.md` / `GO_LIVE.md` / `docs/DEPLOYMENT.md` to clone the method.
