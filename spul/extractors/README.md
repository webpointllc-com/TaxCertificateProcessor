# Extractors interface (offline)

Live S-PUL **must not** call browser automation or invent URLs at request time.

This folder defines the **contract** between:

1. the registry (`../data/search-index.json`), and  
2. offline jobs (DeepShake on Bill’s Mac / T7, hybrid HTTP revalidators, future healers).

## Rules

- Input: jurisdiction key (`ST-CountyToken`), optional current URL, optional vendor hint.
- Output: candidate URL(s) with **HTTP or page evidence**, never a Google search fallback.
- Write-back only after evidence; then rebuild the search index.
- DEP Highlighter is out of scope — do not open or edit it.

## DeepShake status

The canonical operator index is **https://webpointllc.com/searching**. Top of that page is the Render TCS iframe; the grid under it is the collector URL registry this contract protects.

DeepShake AppleScript is Darwin + `/Volumes/T7` only. Cloud agents run the HTTP substitute:

```bash
npm run revalidate:searching         # hybrid GET + form sniff of Searching inventory
bash scripts/deepshake-hunt-mac.sh   # from repo root, on Darwin + T7 mounted
cursor worker start                  # so cloud agents can see the volume
```

Optional Chrome unlock of the live Searching page uses env `SQS_SITE` / `SQS_INDEX` (never git, never argv): `scripts/searching-chrome-sniff.mjs`.

When DeepShake (or Playwright offline) produces a better Search URL, emit a row matching `contract.example.json` and merge via golden overrides — never invent a host.

## Related scripts (already in repo)

| Script | Role |
| --- | --- |
| `../scripts/hybrid-revalidate.js` | Cloud-safe HTTP substitute for DeepShake |
| `../scripts/deepshake-hunt-mac.sh` | Darwin + T7 name hunt |
| `../scripts/searching-chrome-sniff.mjs` | Optional Chrome pass; secrets from env only |

## Handshake fields (from beta — keep the shape)

Beta `/api/search` returns `extractor` hints such as:

- `platform` — vendor/generic  
- `search_inputs` — e.g. `owner_name`, `parcel_id`, `address`  
- `hint` — short operator text  
- `deepshake_handshake_recommended` — whether offline shake is useful  

Product UI may show `hint` / `platform` later; it must still open only the **locked** registry URL.
