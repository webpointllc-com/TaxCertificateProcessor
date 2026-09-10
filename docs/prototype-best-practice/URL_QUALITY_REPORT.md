# Extractor URL Quality Report

**Source:** ExtractorUrls_d3f4.txt (identical to `_3058` and `_656d`, md5 `aa618cd930c11b41e321e45ce42026cc`)
**Generated:** 2026-09-10T16:55:57Z

## Summary

| Metric | Count |
|--------|------:|
| Extractors listed in header | 2085 |
| Parsed rows (deduped by key) | 2062 |
| Searchable (usable URL) | 2052 |
| Parse failures | 0 |

### Quality breakdown
- `broken_fixed`: **1**
- `no_url`: **7**
- `ok`: **2051**
- `placeholder`: **3**

### Source breakdown
- `Base`: **1633**
- `Search`: **422**
- `none`: **7**

## Smoke check (sample, non-blocking)

Checked **40** URLs (HEAD then GET fallback, 8s timeout).
- OK (&lt;400): **25**
- Fail / error: **15**

Full HTTP crawl of ~2000 URLs was intentionally skipped for deploy speed.

### Sample failures / known-bad
- `AR-Benton` → `https://www.arcountydata.com/propsearch.asp?county=Benton` — status=None error=HTTPError
- `AR-LittleRiver` → `https://www.arcountydata.com/propsearch.asp?county=Little River&s=T` — status=None error=InvalidURL
- `CA-Calaveras` → `https://common3.mptsweb.com/MBC/api/search/calaveras/0000-CURR/feeparcel/{parcel}` — status=None error=HTTPError
- `IN-ClayFD` → `http://www.itricityfreedomdata.com/content/` — status=None error=TimeoutError
- `KS-Thomas` → `http://ks1057.cichosting.com/tax/search/` — status=None error=HTTPError
- `LA-CaddoParishAssessor` → `https://www.actdatascout.com/RealProperty/Index` — status=None error=HTTPError
- `MI-ConstantineTownship` → `https://is.bsasoftware.com/bsa.is/TaxServices/` — status=None error=URLError
- `NJ-BelmarBoro` → `https://lots.signatureinfo.com/` — status=None error=HTTPError
- `NJ-LavalletteBoro` → `https://lots.signatureinfo.com/` — status=None error=HTTPError
- `NJ-SeaBrightBoro` → `https://lots.signatureinfo.com/` — status=None error=HTTPError
- `OH-Carroll` → `https://www.carrollcountyauditor.us/Search/Number` — status=None error=HTTPError
- `PA-Dauphin` → `http://www.dauphinpropertyinfo.org/` — status=None error=URLError
- `TX-BowieCAD` → `https://bowie.propertytaxpayments.net/search` — status=None error=HTTPError
- `TX-Grayson` → `https://grayson.propertytaxpayments.net/search` — status=None error=HTTPError
- `VA-Stafford` → `http://taxpaid.stafford.va.us/` — status=None error=TimeoutError

### Flagged rows (placeholders / broken)
- `AL-Chambers` [placeholder] google_placeholder — `https://www.google.com/`
- `AL-Coffee` [placeholder] google_placeholder — `https://www.google.com/`
- `AL-Marshall` [broken_fixed] double_scheme, fix_candidate:https://www.deltacomputersystems.com/cgi-lra2/ — `https://www.deltacomputersystems.com/cgi-lra2/`
- `AL-Russell` [placeholder] google_placeholder — `https://www.google.com/`
- `GA-Jasper` [no_url] missing_url — ``
- `ID-Ada` [no_url] missing_url — ``
- `IL-CookCounty` [no_url] missing_url — ``
- `IN-Allen` [no_url] missing_url — ``
- `NM-Curry` [no_url] missing_url — ``
- `TX-HardinCAD` [no_url] missing_url — ``
- `WI-EauClaire` [no_url] missing_url — ``
