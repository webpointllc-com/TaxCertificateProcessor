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

DeepShake did **not** run in cloud agents (no `/Volumes/T7`). On Bill’s Mac:

```bash
bash scripts/deepshake-hunt-mac.sh   # from repo root, on Darwin + T7 mounted
cursor worker start                  # so cloud agents can see the volume
```

When DeepShake (or Playwright offline) produces a better Search URL, emit a row matching `contract.example.json` and merge via `scripts/apply-url-fixes.js` or a future importer.

## Related scripts (already in repo)

| Script | Role |
| --- | --- |
| `../scripts/hybrid-revalidate.js` | Cloud-safe HTTP substitute for DeepShake |
| `../scripts/remainder-revalidate.js` | Dead/uncertain recovery |
| `../scripts/apply-url-fixes.js` | Apply evidenced URL replacements |

## Handshake fields (from beta — keep the shape)

Beta `/api/search` returns `extractor` hints such as:

- `platform` — vendor/generic  
- `search_inputs` — e.g. `owner_name`, `parcel_id`, `address`  
- `hint` — short operator text  
- `deepshake_handshake_recommended` — whether offline shake is useful  

Product UI may show `hint` / `platform` later; it must still open only the **locked** registry URL.
