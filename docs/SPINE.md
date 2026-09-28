# S-PUL operating spine (non-secret)

This is the **public, secret-free** orientation pack for Tax Certificate Processor / Search Spul. It is **not** the private 1000-token ledger.

## Load order (genesis capsule pattern)

From `mac-assistant-env` `genesis/BOOT.md`:

1. Verify integrity if a capsule is present (`MANIFEST.sha256` / `rehydrate.sh`).
2. Read `CORE_STATE.md` — highest verified `seq` wins.
3. Replay the ledger — **newest entries at the bottom**.
4. Read `OPERATING_CONTEXT.md` — non-negotiables and write gates.
5. Then act. Latent boot: do not re-read the whole spine every turn.

This repo ships **this file + BOOT pattern references**. It does **not** ship `EF_EE_1000TK_LOG.txt`, live `CORE_STATE.md`, or `OPERATING_CONTEXT.md`.

## What was found (this environment)

| Artifact | Status |
| --- | --- |
| `EF_EE_1000TK_LOG.txt` / `JARVIS_1000TK` | **Not in git.** `mac-assistant-env` documents it as excluded (secret gates). The private `~/Desktop/everything/EF & EE/` tree is on local metal / WD Passport, not this VM. |
| `CORE_STATE.md` / `OPERATING_CONTEXT.md` | **Not in public webpointllc-com repos.** Same Passport / home-tree gap. |
| `genesis/BOOT.md` | Loaded from cloned `mac-assistant-env`. |
| GET TO GIT doctrine | Loaded from `mac-assistant-env/docs/GET_TO_GIT_DOCTRINE.md`. |
| Search Spul truth | Loaded from `search-spul-test` (`SEARCH_SPUL_TRUTH.md`, `GROK_HANDOFF.md`, generative-training notes). |
| Workplace Technologies TCS/TPA/RDS | GitHub org empty; clone not mounted. |

Honest record: **LOAD IN** of the real 1000TK ledger cannot complete here. Product rules below are the usable public fragments.

## Durable triggers (not secrets)

Treat as process labels only — never echo or store passcodes:

- `LOAD IN`
- `BUILDING MODE`
- `COLAB_MODE`

## Operating doctrine (non-secret)

**Reads are free. Writes / consequential actions are gated** (explicit human ack).

**Secrets never travel.** No approval passcodes, API keys, `.env` values, or raw ledgers in git or chat.

**Search Spul URL law**

- URLs come only from `data/counties.json` + `data/golden_overrides.json`.
- The model must **not invent hosts**.
- Golden overrides win at runtime (Chippewa WI → Catalis LandNav; `chippewacounty.gov` is dead).
- Known jurisdiction with no verified URL → `not_found` + operator correction. Do **not** Google-invent a collector page.
- Tax collector / treasurer / tax office = pay/search page. CAD / assessor = values only, unless the DB says otherwise.
- Texas: CAD does not collect. Illinois: treasurer collects. Georgia: tax commissioner. Florida: tax collector.

**Product**

- Chippewa County, Wisconsin is the first live county.
- LandNav Chippewa payment cap = **10 parcels** per transaction (UI + API).
- UI is 100% scale-to-fit **1280×800**. No left accent stripes. Squarespace embed stays intact.
- Bind HTTP to `0.0.0.0:$PORT`. Render disk is ephemeral — Postgres for orders.

**Get to Git (ship gates)**

Secrets gitignored · lockfiles committed · `render.yaml` IaC · README one-command run · tests on push · never commit the ledger.

## WPT Production Log

Public sheet (all six tabs ingested):  
https://docs.google.com/spreadsheets/d/1yOKyy5NqJHVKiuVO1kYvSIf7s_R7gCGJ2cyfcCz2zcM/edit#gid=1491656814

Tabs: CoreLogic, Lereta, Lument, NTS, Master Log, UPF.

`npm run sync:sheet` re-fetches, canonicalizes typos (e.g. `WI-Horry` → `SC-Horry`), merges missing rows as `needs_correction`, and reapplies golden locks. Catalog: `data/wpt_production_counties.json`. Aliases: `data/sheet_aliases.json`.
