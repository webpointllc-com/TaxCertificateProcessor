# S-PUL / Real-Time-Tax — prototype best-practice file tree

> **Handoff:** `workplace-technologies` / `Real-Time-Tax` remotes were **not accessible** from this agent (org create/push blocked; no Real-Time-Tax repo in the webpointllc-com listing). Docs live here in the Webpoint deploy repo until promoted. **No production deploy was invented** for those orgs.

## Intended real-system tree (target)

```
Real-Time-Tax/   (or workplace-technologies equivalent)
├── apps/
│   └── spul-search/                 # productized S-PUL service
│       ├── src/
│       │   ├── api/                 # search, suggest, feedback
│       │   ├── index/               # jurisdiction loader + ranker
│       │   └── ui/                  # embeddable desktop canvas
│       ├── data/                    # build-time exports only (or DB migrations)
│       └── package.json
├── packages/
│   └── jurisdiction-schema/         # shared types
├── docs/
│   ├── AUTODEPLOY_VARIABLE/         # proto lane only — not prod
│   └── architecture/
└── infra/
    └── kamatera/                    # owned-servers (long-term)
```

## Schema notes (file-backed proto → DB later)

### `jurisdictions`
| Field | Notes |
|-------|--------|
| `key` | `ST-CountyToken` from Extractor |
| `state` | ISO-2 |
| `county` | Display name |
| `url` | Official Search or Base URL |
| `source` | `Search` \| `Base` |
| `active` | bool |
| `confidenceBase` | 0–1 from source quality |
| `quality` | `ok` \| `placeholder` \| `broken*` \| `no_url` |

### `search_results` (future)
Query, ranked keys, scores, timestamp, client session (no PII required for proto).

### `feedback` (future)
Thumbs / wrong-URL flags → correction queue (exists in older search-spul-test; out of scope for this minimal proto).

## This prototype (Webpoint)

```
TaxCertificateProcessor/
├── render.yaml                      # Blueprint → search-spul-minimal
├── spul/
│   ├── server.js
│   ├── package.json
│   ├── data/search-index.json
│   └── public/index.html
├── docs/
│   ├── AUTODEPLOY_VARIABLE/
│   └── prototype-best-practice/
└── public/boss-briefing.html        # preserved; not the Render entry UI
```

## Related Webpoint lanes (reference only — do not modify unless shipping there)

- `webpointllc-com/search-spul-test` — older Node S-PUL (Groq chat); live but separate from this minimal registry proto.
- `webpointllc-com/mobile` — canonical static AUTODEPLOY_VARIABLE lane (`public/` → free static).
- Precedent Python/Node free services — READ-ONLY; clone Blueprint method only.
