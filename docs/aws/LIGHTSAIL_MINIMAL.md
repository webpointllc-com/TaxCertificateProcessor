# AWS minimal deploy — S-PUL (`spul/`)

Production target: **AWS**. Render free is historical/demo only.

## Recommended shape (minimal)

**AWS Lightsail** Node instance (or one **EC2** t3.small) + **Caddy** or nginx for TLS.

Why not ECS yet: the app is a single Node process + JSON files. ECS/Fargate adds IAM/ALB/ECR ceremony without payoff until you need horizontal scale or blue/green.

Kamatera remains an owned-VPS alternative from the boss briefing; this doc standardizes on AWS for Adam.

## Steps (Lightsail)

1. Create Lightsail **Linux/Unix** instance (Ubuntu 22.04+), open ports **22, 80, 443**.
2. SSH in. Install Node 20+:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

3. Deploy code (pick one):
   - `git clone` the repo and `cd spul`, or
   - `scp`/`rsync` a release tarball of `spul/` only.
4. Configure env (**never commit real values**):

```bash
cd spul
cp .env.example .env
# edit: PORT=3000  NODE_ENV=production
# optional: GROQ_API_KEY only if narration enabled
npm install --omit=dev
```

5. Process manager:

```bash
sudo npm install -g pm2
pm2 start server.js --name spul
pm2 save
pm2 startup
```

6. TLS reverse proxy (Caddy example) — proxy to `127.0.0.1:3000`, obtain cert for `search.taxcert.ai` (or chosen host).
7. Verify:

```bash
curl -sS https://<host>/api/health
# expect JSON with ok: true
```

8. Squarespace iframe only after HTTPS 200 (see `spul/public/SQUARESPACE_EMBED.html`).

## EC2 variant

Same Node + pm2 + Caddy flow. Attach Elastic IP. Prefer SSM Session Manager over open SSH when possible.

## ECS later (optional)

Containerize `spul/` with a tiny Dockerfile, push to ECR, one Fargate service + ALB health check `/api/health`. Use when you need zero-downtime deploys across multiple tasks — not required for teammate day-1.

## Env (no secrets in git)

| Variable | Required | Notes |
| --- | --- | --- |
| `PORT` | yes | App listens `0.0.0.0:$PORT` |
| `NODE_ENV` | yes | `production` |
| `GROQ_API_KEY` | no | Dashboard/SSM only if used |
| `SESSION_SECRET` | no | Only if sessions added later |

Store secrets in Lightsail/EC2 env files with `chmod 600`, or AWS SSM Parameter Store / Secrets Manager.

## What not to do

- Do not treat `render.yaml` as production IaC.
- Do not commit `.env`, deploy hooks, or API keys.
- Do not deploy the beta Three.js stack as the owned product.
- Do not modify DEP Highlighter for S-PUL deploys.
