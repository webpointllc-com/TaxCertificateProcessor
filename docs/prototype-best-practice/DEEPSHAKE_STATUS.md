# DeepShake status (2026-09-13)

## Did DeepShake run?

**No.** DeepShake did **not** execute in this cloud agent turn (same as 2026-09-10).

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

## Cloud substitute used this turn (2026-09-13 hybrid)

1. Full hybrid crawl of **2055** Extractor URLs (`npm run health:hybrid`)
2. Method A/B/C: HEAD/GET + redirect follow; Search-over-Base; sample title/form sniff; host cross-check
3. Reclassify: 403/429/gated = validated-true; 404/NXDOMAIN = dead; timeout/TLS = uncertain
4. Result: **1675 validated-true** / **163 dead** / **217 uncertain** / registry active **1866** / listed **2062** / with URL **2055**

See `docs/prototype-best-practice/URL_REVALIDATE_2026-09-13.md` and `docs/SPUL_DESCRIPTION_AND_VALIDATED_URLS.txt`.
