# URL Fixes (cloud substitute for DeepShake)

**Generated:** 2026-09-10T17:35:53.442Z (updated with placeholder restores)
**DeepShake:** not run on this cloud VM — see `DEEPSHAKE_STATUS.md`

| Metric | Count |
|---|---:|
| Fixes applied | 30+ (27 crawl fixes + 3 AL placeholders restored) |
| Soft-verified OK (first pass) | 26 |
| Active after reclass | **~1969** |
| Searchable (non-google) | **2055** |

## Sample wins

- `AL-Chambers`: google placeholder → `https://www.ingproperty.com/Chambers_Revenue/property.aspx`
- `AL-Coffee`: google placeholder → `https://www.coffeecountyrevenue.com/property.html`
- `AL-Russell`: google placeholder → `https://russell.capturecama.com/propsearch`
- `AL-Marshall`: cgi-lra2 404 → `https://marshall.capturecama.com/propsearch`
- `AR-Benton`: fragile arcountydata → `https://bentoncountyar.gov/collector/`
- `AR-LittleRiver`: InvalidURL spaces → encoded `Little%20River`
- `CA-Calaveras` (+17 CA MPTS): API `{parcel}` templates → `/MBC/{county}/tax/search`
- `FL-MiamiDade`: dead asp → `https://www.miamidade.gov/taxcollector/`
- `FL-Orange`: dead Search.aspx → `https://www.octaxcol.com/taxes/`
- `VA-LynchburgCity`: empty URL → `https://webapps.lynchburgva.gov/citylink`

## Classification rules

- HTTP 200–399 → active
- 401/403/405/429/502/503 → active (host alive; bot/rate-limit)
- 404 / InvalidURL / google.com → inactive until replaced
- Timeout / TLS Error → keep active (false-negative risk)
