# DeepShake status (2026-09-10)

## Did DeepShake run?

**No.** DeepShake did **not** execute in this cloud agent turn.

| Check | Result |
| --- | --- |
| Binary / app on cloud VM | Not present |
| `/Volumes/T7` on cloud VM | **Not mounted** (Linux cloud has no USB) |
| Self-hosted Mac workers (`cursor worker start`) | **0 connected** |
| computerUse / Finder automation | **Not available** in this agent toolset |
| GitHub `webpointllc-com` code search for DeepShake | **0 hits** |
| Public web for “DeepShake” Mac extractor | No matching product found |

## What Bill’s screenshot proves

Finder → Locations → **T7** is mounted on **Bill’s Mac** (`billmccreary`). That path is `/Volumes/T7` **on that Mac only**.

## How to run DeepShake next (Mac)

```bash
# On Bill's Mac with T7 mounted:
bash scripts/deepshake-hunt-mac.sh
# then:
cursor worker start   # so cloud agents can see /Volumes/T7
```

Document the exact path the hunt script prints (e.g. `/Volumes/T7/.../DeepShake.app`).

**Do not modify DEP Highlighter.**

## Cloud substitute used this turn

1. Full HTTP crawl of **2052** Extractor URLs (`npm run health:all`)
2. Reclassify bot-blocks (403/429/503) as alive
3. Curated + MPTS template URL fixes (`npm run health:fix`)
4. Result: **~1969 active** / **2055 searchable** rows in `spul/data`

See `docs/prototype-best-practice/URL_HEALTH_SAMPLE.md` and `URL_FIXES.md`.
