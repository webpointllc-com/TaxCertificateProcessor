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

How to validate (same every time): [`docs/VALIDATION.md`](../../docs/VALIDATION.md).

```bash
npm run validate:extractors         # HTTP GET + DR column-head sniff of the 2k+ union
npm run validate:apply              # evidenced collector_search only; golden wins
bash scripts/deepshake-hunt-mac.sh  # Darwin + T7
```

Cloudflare JS challenges are queued for a **real Chrome user session** (`POST /api/extractors/session`). We do not bypass Cloudflare from the datacenter.

When DeepShake (or a user tab) produces a better Search URL, emit a row matching `contract.example.json` and merge via golden overrides — never invent a host.

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
