# Site validator — how every update is supposed to run

This is the repeatable path so a monthly pass and a single county session produce the same kind of evidence.

## What we look for

The output document is **DR Production Results** (`finale/schema.json`). Same 40 columns every county. On the live portal we sniff these heads (search + result):

- Parcel Number
- Tax Id
- Owner 1 Name
- Legal Description
- Bill Amount
- Balance Due
- As Of
- Bill Year

Talk about the **whole row**. Isolate a column only when the user names it. Empty cells stay empty.

## Sources (union, then dedupe by URL)

1. Development Extractor table — `data/extractor_urls.txt` / `.json` (Search over Base; drop google.com and `{parcel}` templates)
2. Squarespace Searching inventory — `data/spul_searching_inventory.json`
3. Operator locks — `data/spul_searching_operator_locks.json`
4. Golden overrides still win on apply
5. User session on that county — `POST /api/extractors/session`

OH-Hamilton, CT-HartfordCity, and IL-Sangamon stay **unlocked** until a collector search page is confirmed (production workbooks exist; treasurer/homepage is not enough).

## Update commands (same every time)

```bash
npm run import:extractor-urls      # refresh dump JSON if the txt changed
npm run validate:extractors        # HTTP GET + DR field sniff of the full union (~2k URLs)
npm run validate:apply             # write probeStatus / verified onto counties.json
npm test
```

`npm run revalidate:searching` is the same validator (hybrid-revalidate delegates).

Reports written:

| File | Role |
| --- | --- |
| `data/validation_run.json` | counts, look-for hits, **how** this pass was done |
| `data/validation_hits.json` | compact per-URL evidence (no HTML bodies) |
| `data/deepshake_queue.json` | Cloudflare / no-form / timeout — open in user Chrome |
| `data/validation_apply.json` | what apply changed |

## Cloudflare / DeepShake

Datacenter GET cannot complete a Cloudflare JS challenge. We do **not** fingerprint-spoof or solve challenges.

1. Classify `collector_host_cloudflare` as a live collector host.
2. Put it on the DeepShake queue.
3. The web app opens the locked URL in the **signed-in user's real Chrome tab**.
4. That click posts `/api/extractors/session` so the county extractor remembers the session.

On a Mac with T7: `npm run deepshake:mac`.

## Cadence

| When | What |
| --- | --- |
| Per county, live | Search → county agent → Open official tax search → session ported |
| Every ~28 days | Always-on Render Starter (`VALIDATE_MONTHLY` not `0`) re-runs `validate-extractors.js` if `validation_run.json` is stale |
| Before a release | Operator runs the three npm commands above |

Set `VALIDATE_MONTHLY=0` to disable the in-process monthly tick (tests and one-off boxes).

## Honest limits

- A 403/timeout on a **already locked** collector does not unlock it. It queues DeepShake.
- Apply never invents a host.
- Assessor / CAD pages stay assessor.
- Monthly HTTP is comparable because the look-for list and classifier are the same files every run.
