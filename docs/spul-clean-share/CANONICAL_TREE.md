# Canonical tree — Adam-ready S-PUL

Product lives under **`spul/`** in https://github.com/webpointllc-com/TaxCertificateProcessor  
Root joke app (`index.html` / root README) is **not** the product — ignore until quarantined.

```text
TaxCertificateProcessor/
├── spul/                          # ← CANONICAL APP
│   ├── README.md                  # one-pager
│   ├── package.json
│   ├── .env.example               # no secrets
│   ├── server.js                  # Express: /api/search /api/health /api/guide
│   ├── services/
│   │   ├── spulTruth.js           # hard URL lock
│   │   ├── normalizeQuery.js      # query aliases
│   │   └── guide.js               # Path B guide (optional Groq)
│   ├── public/
│   │   ├── index.html             # search UI
│   │   └── SQUARESPACE_EMBED.html # iframe helper
│   ├── data/
│   │   ├── search-index.json      # runtime index
│   │   ├── jurisdictions.json     # registry export
│   │   ├── validated-true-urls.csv# 1675 HTTP-true
│   │   └── counties-export.csv    # full county dump
│   ├── scripts/                   # offline URL quality (not request path)
│   │   ├── hybrid-revalidate.js
│   │   ├── remainder-revalidate.js
│   │   └── apply-url-fixes.js
│   └── extractors/                # interface only — DeepShake offline
│       ├── README.md
│       └── contract.example.json
├── docs/
│   ├── spul-clean-share/          # this pack (audit + Adam + AWS)
│   ├── aws/
│   │   └── LIGHTSAIL_MINIMAL.md
│   ├── SPUL_DESCRIPTION_AND_VALIDATED_URLS.txt
│   └── prototype-best-practice/   # query shapes, URL reports
└── (historical)
    ├── render.yaml                # free proto only — not production
    └── docs/AUTODEPLOY_VARIABLE/  # Render playbook archive
```

## Connected system (how pieces talk)

```text
[Browser UI]  →  GET/POST /api/search?q=…
                     ↓
              normalizeQuery + rank against search-index.json
                     ↓
              spulTruth lock (never invent URL)
                     ↓
              { url, confidence, county, state }

[Optional] /api/guide  → same locked URL + steps (Groq narrate optional)

[Offline Mac / CI] extractors job or npm run health:*
                     ↓
              write validated-true-urls.csv → rebuild search-index.json
                     ↓
              deploy Node on AWS (restart picks up data)
```

DeepShake / Playwright / field-gate belong **only** in offline extractors — never in the live request path for the shareable product.
