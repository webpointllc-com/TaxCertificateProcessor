# URL Remainder Revalidate (2026-09-13)

**Generated:** 2026-09-13T22:38:00.568Z
**DeepShake:** **not_run**

## Method

- Load prior hybrid classifications; isolate dead + uncertain (~618)
- Retry: browser UA GET, wall-clock timeouts (8–14s), redirects ≤4
- Variants: www↔non-www, http→https, path trim, governmaxa typo
- Vendor patterns (HTTP evidence only; reject generic vendor homepages):
  mytaxbill `town=`, county-taxes.net, Iowa portals, PublicAccessNow roots,
  CaptureCAMA, Edmunds WIPP, qpublic for GA paytaxes, MN `*countymn.gov`,
  known county portals (jccal, leetc, spatialest/El Paso)
- Prefer Search-shaped URLs; never invent final URLs without HTTP evidence

## Counts

| Metric | Baseline hybrid | After remainder |
|---|---:|---:|
| Listed | 2062 | 2062 |
| With URL | 2055 | 2055 |
| Validated-true | 1437 | **1675** |
| Dead | 368 | **163** |
| Uncertain | 250 | **217** |
| Index active | 1681 | **1866** |
| Newly validated-true | — | **238** |
| Cumulative URL replacements | — | **228** |
| Gap to 2000 true | 563 | **325** |

## Honest path to 2000+

Still **325** short of 2000 validated-true.

Remaining dead are mostly **NXDOMAIN** vendor hosts (`tax.rptdata.com`, `actweb.acttax.com` county paths,
`deltacomputersystems` county paths that only redirect to marketing home, `texaspayments`,
`governmax`, `ddti`, leftover `morris.state.mn.us`) that need DeepShake/Mac or curated
official Search pages — not inventable from this cloud VM.

Remaining uncertain are mostly **TimeoutError / TLSError** behind bot-walls, slow gov networks,
or geo/network blocks from the cloud egress path. Longer timeouts and UA swaps recovered many;
the rest did not respond within policy windows.

## Artifacts

- `spul/data/hybrid-revalidate.json`
- `spul/data/remainder-revalidate.json`
- `spul/data/validated-true-urls.csv`
- `spul/data/url-fixes-remainder.json`
- `docs/SPUL_DESCRIPTION_AND_VALIDATED_URLS.txt`
- `/opt/cursor/artifacts/SPUL_DESCRIPTION_AND_VALIDATED_URLS.txt`
- `/opt/cursor/artifacts/SPUL_VALIDATED_TRUE_URLS.csv`
- `/opt/cursor/artifacts/SPUL_REMAINDER_REPORT.json`
