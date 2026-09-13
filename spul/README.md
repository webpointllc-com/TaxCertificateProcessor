# S-PUL Minimal — Render Free Autodeploy

Prototype: indexed Extractor Search/Base URLs → jurisdiction URL(s) with confidence and staggered cascade reveal.

## Live (after Blueprint / auto-deploy)

- Service name: `search-spul-minimal`
- Expected URL: `https://search-spul-minimal.onrender.com`
- Health: `GET /api/health` must return 200
- UI: `/` · Embed helper: `/SQUARESPACE_EMBED.html`

## Local

```bash
cd spul
npm install
npm start
# open http://localhost:3000
```

## Data

- Source: Extractor URL export (`ExtractorUrls_*.txt`, 2085 listed; ~2055 searchable / ~1969 active after health + URL fixes)
- Built index: `spul/data/search-index.json`
- County export: `spul/data/counties-export.csv` (+ `counties-export-summary.json`)
- Query shapes: `docs/prototype-best-practice/QUERY_SHAPES.md`
- Live triangulation note: `docs/prototype-best-practice/LIVE_TRIANGULATION.md`
- Quality report: `docs/prototype-best-practice/URL_QUALITY_REPORT.md`

## Product scope

S-PUL only — registry lookup + confidence + local query aliases. Honest miss when no URL. No CI orchestrator, no voice. Highlighter untouched.

## Autodeploy

See `docs/AUTODEPLOY_VARIABLE/README.md`.
