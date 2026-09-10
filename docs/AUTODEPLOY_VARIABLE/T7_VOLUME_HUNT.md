# T7 volume hunt — auto-deploy notes

**Keyword searched (user):** `DEP Highlighter` (precedent that auto-deployed successfully).  
**Hard rule:** do **not** open/edit/push `webpointllc-com/webpoint-dep-highlighter`. Clone the *method* only into this playbook + S-PUL bring-up.

## Which machine saw `/Volumes/T7`?

| Machine | Saw `/Volumes/T7`? | Notes |
| --- | --- | --- |
| **Bill’s Mac (Finder)** | **Yes** | Screenshot confirms Locations → **T7** with eject control. Path on that Mac is `/Volumes/T7`. |
| **This Cursor cloud Linux VM** | **No** | `ls /Volumes/T7` → no such path. Host is Linux (`uname` = `Linux cursor`). |
| **Self-hosted Cursor worker on Bill’s Mac** | **No worker connected** | `list-self-hosted-workers` returned `[]`. No `cursor worker start` session registered. |
| **computerUse / Desktop GUI control** | **Unavailable** | No computerUse / browser-desktop MCP tools in this run’s tool catalog. |

**Verdict:** T7 is mounted on **Bill’s Mac only**. This cloud agent cannot browse it until a self-hosted worker runs on that Mac (or notes are copied into the repo / chat).

## Method recovered without T7 (public Webpoint precedents)

Search keyword led to the known AUTODEPLOY_VARIABLE lane — read-only GitHub inspection (highlighter repo **not** modified):

| Source | What it teaches | Live today? |
| --- | --- | --- |
| `webpointllc-com/mobile` + `HANDOFF.md` | Canonical static lane: root `render.yaml`, `runtime: static`, `staticPublishPath: ./public`, `autoDeploy: true`, one-time Blueprint apply | `webpoint-mobile.onrender.com` → **404 no-server** (Blueprint never applied or service gone) |
| `webpointllc-com/webpoint-shipyard` | Same pattern; README says **superseded** by `mobile` | **404 no-server** |
| `webpointllc-com/search-spul-test` | Node free Blueprint: `env: node`, `plan: free`, `npm install` / `npm start`, secrets `sync: false` / `generateValue`; optional Deploy Hook | **`https://search-spul-test.onrender.com` → HTTP 200** (live precedent) |

Copied into this repo only:

- `render.yaml` → service `search-spul-minimal` (Node, free, `rootDir: spul`, `autoDeploy: true`)
- `docs/AUTODEPLOY_VARIABLE/*` playbook
- Operator one-click: `ONE_CLICK_BLUEPRINT.md`

## What Bill can do so agents can read T7 next time

1. On the Mac where Finder shows **T7**: run `cursor worker start` and leave it connected.
2. Or copy the auto-deploy notes folder from `/Volumes/T7/...` into this repo under `docs/AUTODEPLOY_VARIABLE/from-t7/` (no highlighter source trees).
3. Or paste `RENDER_API_KEY` into the cloud agent environment so MCP can `create_web_service` without Dashboard.

## DeepShake / Passport

DeepShake is a local Mac engine — unreachable from this cloud VM. WD Passport recovery (separate from T7) is documented in `docs/PASSPORT_RECOVERY.md`. HTTP health sampling is the cloud substitute (`npm run health:sample` in `spul/`).
