# S-PUL query shapes (Layer A + B)

What the search engine should accept. Ranking is **registry-only** — aliases rewrite the query string; they never invent URLs.

## Ranking (highest → lowest)

1. **Exact county + state** — `Travis County TX`, `Cook, IL`, `San Diego County, California`
2. **Unique county name** — `San Diego`, `Los Angeles`, `Bexar` (one state in index)
3. **Ambiguous county name** — `Jackson`, `Orange`, `Washington` → return ranked list + **ask for state** (do not URL-lock)
4. **City / metro alias** (Layer B) — `Chicago` → `Cook, IL`; `LA County` → `Los Angeles, CA`
5. **Honest miss** — no registry row; clarify county + state

## Recognizable shapes

| Shape | Example | Expected behavior |
| --- | --- | --- |
| County, ST | `San Diego, CA` | Exact / high lock |
| County ST | `Travis TX` | Exact / high lock |
| County County, StateName | `San Diego County, California` | Strip noise words + state name → lock |
| Bare unique county | `San Diego` | Unique → lock CA |
| Bare ambiguous county | `Jackson` | Multi-state → prompt for ST |
| City → county | `Chicago`, `Miami`, `Atlanta` | Alias table → `Cook, IL` etc. |
| Abbrev county | `LA County`, `SD County`, `OC County` | Alias → Los Angeles / San Diego / Orange CA |
| NYC / boroughs | `NYC`, `Brooklyn` | → `New York City` / `Brooklyn Boro`, NY |
| Parish | `Orleans Parish LA` / `New Orleans` | Parish rows in LA index |
| Office synonyms | `Cook County treasurer` | Strip treasurer/collector/assessor; match county |
| Intent words | `pay taxes San Diego CA` | Intent for guide; county+state for lookup |
| Parcel / APN-ish | `APN 123-456-789 Travis TX` | Parcel signal for guide intent; jurisdiction from county+state tokens |
| FIPS (5-digit) | `06073` | Detected as signal only — **no FIPS map in registry yet** |
| Typo (top traffic) | `San Dieogo`, `Los Angles` | Soft typo fold → then match |
| Bare state code | `SD`, `CA` | Miss or too weak — need county (SD ≠ San Diego) |

## Do **not** accept as URL evidence

- LLM-guessed domains (`traviscountytax.com`-style inventions)
- Assessor/CAD pages when registry Search URL is treasurer/collector (and vice versa) unless indexed
- Autocomplete from the open web without Layer C verification

## Ambiguous names (sample)

~157 county names appear in 2+ states in the current Extractor index. Top offenders: Jackson, Madison, Washington, Jefferson, Montgomery, Franklin, Marshall, Shelby, Boone, Greene, Johnson, Monroe, Polk, Union, Warren, Orange, Wayne, …

Full export: `spul/data/counties-export-summary.json` → `topAmbiguous`.

## Alias module

`spul/services/normalizeQuery.js` — wired into `search()` before scoring; surfaced on `POST /api/guide` as `alias` + optional “Alias: … → …” line.
