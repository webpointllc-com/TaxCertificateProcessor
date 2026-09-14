# webpointllc.com/searchpages — S-PUL embed

Working branch for the best S-PUL search + validated URL registry to embed on Squarespace.

## Product

- Path: `spul/` in TaxCertificateProcessor
- Registry-locked search: `GET/POST /api/search`, `POST /api/guide` (+ `/api/chat`)
- Validated-true county URLs: **1675** (`spul/data/validated-true-urls.csv`)
- Layout: fixed 1280×820 desktop composition, scaled to **100% of iframe width** (`?embed=1`)

## Squarespace Code block

```html
<!-- S-PUL for webpointllc.com/searchpages — proportional desktop layout -->
<div style="width:100%;max-width:100%;">
  <iframe
    src="https://search-spul-minimal.onrender.com/?embed=1"
    title="S-PUL Property Tax Search"
    loading="lazy"
    allow="clipboard-write"
    style="width:100%;aspect-ratio:1280/820;height:auto;border:none;border-radius:16px;overflow:hidden;display:block;background:#05080f;"
  ></iframe>
</div>
```

Replace `src` with your live host once `/api/health` returns HTTP 200. Render free (`search-spul-minimal`) is prototype-only and may be cold/404; production host is AWS later.

## Local

```bash
cd spul && npm install && npm start
# http://localhost:3000/?embed=1
# http://localhost:3000/SQUARESPACE_EMBED.html
```

## Base lineage

- Best code + URLs: PR #4 (`Betaspul-minimal-deploy`) → PR #7 (`Betaadam-clean-share`)
- This branch: searchpages embed polish on that stack
