# Host swap (Render → AWS when we actually scale)

The product does not care whether it is on Render or AWS. The process is:

1. Bind `0.0.0.0:$PORT`
2. Read `DATABASE_URL` (Postgres 16, same `src/db/schema.sql`)
3. Read `GROQ_API_KEY` / optional `ANTHROPIC_API_KEY`
4. Optional `PUBLIC_ORIGIN` for confirm links and OAuth behind an ALB
5. Drain on `SIGTERM` (Render deploys and ECS both send it)

Do **not** rewrite search, agents, auth, or the Squarespace UI to “move to AWS.” Change the host. Keep the app.

## When to swap

| Load | Stay | Swap |
| --- | --- | --- |
| Launch → ~200 researchers | Render Starter + Postgres **$14/mo** | No |
| ~200–500 | Render Standard / Pro | Only if idle AWS RDS/ECS is already on the bill |
| 500–1,200+ | Render Pro autoscale **or** this cutover | Yes if reserved AWS is cheaper *and* ops is ready |

Greenfield ALB + Fargate + RDS + NAT is **$45–90/mo** before Groq. That is not a savings at 50 users.

## Same image everywhere

```bash
docker build -t webpoint-tcs .
docker run --rm -p 3000:3000 \
  -e PORT=3000 \
  -e DATABASE_URL \
  -e GROQ_API_KEY \
  -e MODEL_PROVIDER=groq \
  -e PUBLIC_ORIGIN=https://tax.webpointllc.com \
  webpoint-tcs
```

Health: `GET /healthz` (also `/api/health`). ALB / App Runner / Render all accept it.

## Cutover steps (when the boss says scale)

1. `pg_dump` the Render database (conversations, accounts, county-agent extractors, `/v1/feedback`).
2. Restore onto the target Postgres (existing RDS if you already pay for it — do not create a second bill).
3. Set env on the new host (never commit secrets):

| Var | Why |
| --- | --- |
| `PORT` | Platform sets this (Render, App Runner, ECS) |
| `DATABASE_URL` | Internal URL on Render; RDS URL + SSL on AWS |
| `DATABASE_SSL` | `auto` (default) · `require` · `disable` |
| `PGPOOL_MAX` | Default 10. Raise on a bigger RDS; stay under the instance connection cap |
| `GROQ_API_KEY` | Workhorse LLM |
| `MODEL_PROVIDER` | `groq` |
| `PUBLIC_ORIGIN` | `https://your-custom-domain` so confirm email and Google OAuth survive the ALB |
| `GOOGLE_CLIENT_ID` / `SECRET` | Optional; update the Google redirect URI to the new origin |
| `SESSION_SECRET` | Copy from Render or rotate (signs nothing critical today; keep stable) |

4. Point DNS / Squarespace iframe `src` at the new origin. `public/SQUARESPACE_EMBED.html` is one URL. `/embed.js` already uses the request host.
5. Confirm `/healthz` shows `db: "postgres"` and `swap.ready: true`.
6. Run one Chippewa search as a signed-in member. Follow-up must not burn a second free credit. `/v1/feedback` from a testing convo must still be in Postgres.
7. Only then delete the Render web service. Keep the Render Postgres until you have verified the dump.

## AWS shapes (examples in `deploy/`)

- **App Runner** — closest to Render. One service, one health path, Docker from ECR.
- **ECS Fargate** — when you want 2–N tasks behind an ALB. Use `deploy/ecs-task-definition.example.json`. Start 0.5 vCPU / 1 GB; scale tasks, not a rewrite.

Groq stays Groq. Moving the Node process to AWS does not replace the LLM. Year-2 self-hosted Llama is a different project.
