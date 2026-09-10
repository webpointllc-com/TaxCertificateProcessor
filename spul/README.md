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

- Source: Extractor URL export (`ExtractorUrls_*.txt`, 2085 listed; ~2052 searchable after quality filter)
- Built index: `spul/data/search-index.json`
- Quality report: `docs/prototype-best-practice/URL_QUALITY_REPORT.md`

## Product scope

S-PUL only — registry lookup + confidence. Honest miss when no URL. No CI orchestrator, no voice.

## Autodeploy

See `docs/AUTODEPLOY_VARIABLE/README.md`.
