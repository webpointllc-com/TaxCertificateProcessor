# AUTODEPLOY_VARIABLE

**Generic push → Render free auto-deploy pattern for Webpoint prototypes.**

Use this document for every future Webpoint proto. Do **not** open or edit any prior tool's source, docs, or `render.yaml` to rediscover the method — copy **this** playbook.

**Provenance (2026-09-10):** Method cloned from public Webpoint lanes `mobile` / `webpoint-shipyard` / `search-spul-test` after the search keyword *DEP Highlighter* (that repo stayed **READ-ONLY / untouched**). Samsung **T7** notes were **not** readable from the cloud VM — see `T7_VOLUME_HUNT.md`.

---

## Law (repo choice)

| Kind | When to use | Render shape |
|------|-------------|--------------|
| **Static lane** | Single HTML/CSS/JS tool, no secrets, no server | `runtime: static`, `staticPublishPath: ./public`, `autoDeploy: true`. Every file in `public/` = a live URL. |
| **Node web service** | Needs an API, file-backed index, or dynamic search | `runtime: node` (or `env: node`), `buildCommand: npm install`, `startCommand: npm start`, bind `0.0.0.0:$PORT`. |
| **Python web service** | Existing Python app | `runtime: python`, `pip install -r requirements.txt`, gunicorn/uvicorn on `0.0.0.0:$PORT`. |

**Repo ownership**

1. **Prototype / embed tier** → create or reuse a **webpointllc-com** public repo. Push → Render free auto-deploy.
2. **Production / owned-servers** → workplace-technologies / Real-Time-Tax promotion gates (not this free proto lane).
3. Never put secrets in git. Env values live only in the Render dashboard (`sync: false` / generateValue in Blueprint).
4. Precedent deployments are **READ-ONLY**. Clone the *mechanism* (Blueprint + autoDeploy + iframe), never modify the precedent service.

If you cannot create a new org repo (token scope), ship the complete app + `render.yaml` in the accessible Webpoint repo (e.g. `TaxCertificateProcessor/spul`) and apply the Blueprint against that repo/branch. Document the handoff; do not invent false deploys.

---

## Controller form fields (one-time Blueprint / New Web Service)

Fill these exactly when creating or applying a service:

| Field | Example / rule |
|-------|----------------|
| **Repo** | `https://github.com/webpointllc-com/<proto-repo>` (Git URL, no branch in string) |
| **Branch** | `main` (or the shipping branch; auto-deploy watches this) |
| **Service name** | Unique kebab-case, e.g. `search-spul-minimal` → `https://<name>.onrender.com` |
| **Runtime** | `static` \| `node` \| `python` |
| **Plan** | `free` (use `starter` only if free blocked) |
| **Root directory** | `.` or `spul` if the app lives in a subfolder |
| **Build command** | static: `echo "no build"` · node: `npm install --omit=dev` · python: `pip install -r requirements.txt` |
| **Start command** | node: `npm start` · python: `gunicorn -w 1 -b 0.0.0.0:$PORT app:app` · static: N/A |
| **Health check path** | `/` or `/api/health` |
| **Auto-deploy** | **yes** / `autoDeploy: true` |
| **Env vars** | Only non-secret defaults in Blueprint; secrets via dashboard, never committed |
| **Region** | `oregon` default |
| **Squarespace embed target** | Password-protected / taxcert.ai members Code block (iframe below) |

---

## `render.yaml` templates

### Node (this S-PUL proto)

```yaml
services:
  - type: web
    name: search-spul-minimal
    runtime: node
    plan: free
    rootDir: spul
    buildCommand: npm install --omit=dev
    startCommand: npm start
    autoDeploy: true
    healthCheckPath: /api/health
```

### Static lane

```yaml
services:
  - type: web
    runtime: static
    name: webpoint-proto-name
    buildCommand: echo "static — no build step"
    staticPublishPath: ./public
    autoDeploy: true
```

### Python web

```yaml
services:
  - type: web
    name: webpoint-proto-name
    runtime: python
    plan: free
    buildCommand: pip install -r requirements.txt
    startCommand: gunicorn -w 1 -b 0.0.0.0:$PORT --timeout 120 app:app
    autoDeploy: true
```

---

## Secrets handling

- **Never** commit passwords, API keys, deploy hooks, or `.env` with real values.
- Use `.env.example` with empty placeholders only.
- In Blueprint: `sync: false` for secrets the operator pastes in the dashboard; `generateValue: true` for random session secrets.
- Deploy hooks (if used) live in GitHub Actions secrets or operator clipboard — not in the repo.

---

## Deploy verification (required before “done”)

1. Push to the watched branch.
2. Wait for Render deploy (free cold start can take 1–2 minutes; spin-down after ~15 min idle).
3. `curl -sI https://<service>.onrender.com/` → **200** (or follow redirect to 200).
4. Hit health: `curl -s https://<service>.onrender.com/api/health` → JSON `ok: true` when applicable.
5. Smoke the primary UX once in a browser (or headless).
6. Only then paste the iframe into Squarespace.

A URL is **not live** until it returns 200.

---

## Iframe paste (Squarespace)

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

UI rule for embeds: **100% scalable desktop canvas** — design at a fixed desktop size and proportionally `scale()` to the iframe width so the layout never reflows into a broken mobile stack inside members pages.

---

## Report-back format (agents)

```
LIVE_URL: https://<service>.onrender.com
HTTP: 200
REPO: webpointllc-com/<repo>@<branch>
PR: <url or n/a>
AUTODEPLOY_VARIABLE: docs/AUTODEPLOY_VARIABLE/README.md
INDEXED: <n> jurisdictions
HIGHLIGHTER_TOUCHED: no
IFRAME: <snippet or path to SQUARESPACE_EMBED.html>
NOTES: <Render MCP / Blueprint one-click if blocked>
```

---

## Squarespace members + Render free (recommendation)

**Short-term OK:** selling/demoing from a password-protected Squarespace members area with a Render **free** proto iframe is acceptable for evaluation and early access. Expect cold starts after idle (~15 min).

**Long-term:** production customer traffic should move to owned servers (Kamatera / Workplace Technologies 09-07 owned-servers rule) behind taxcert.ai — not free-tier spin-down hosts.

---

## Handoff when org push / Render API is blocked

1. Complete app + `render.yaml` + this doc in the accessible repo.
2. Operator: Render Dashboard → **New** → **Blueprint** → select repo → apply.
3. Confirm `https://<service-name>.onrender.com` returns 200.
4. Paste iframe into Squarespace.
5. Optionally mirror best-practice docs into workplace-technologies / Real-Time-Tax when those remotes are available (see `docs/prototype-best-practice/`).

## Related

- `T7_VOLUME_HUNT.md` — which machine saw `/Volumes/T7`, and public precedent sources
- `ONE_CLICK_BLUEPRINT.md` — operator apply for `search-spul-minimal`
- `CONTROLLER_FORM.json` — machine-readable controller fields

## T7 / Passport / DeepShake

See `docs/AUTODEPLOY_VARIABLE/T7_PASSPORT_DEEPSHAKE.md` and `docs/PASSPORT_RECOVERY.md`.
Cloud agents cannot see USB; self-hosted Mac worker required for DeepShake / workplace clone mounts.
