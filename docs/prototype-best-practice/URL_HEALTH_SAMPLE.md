# URL Health Sample

**Generated:** 2026-09-10T17:28:34.220Z
**Mode:** sample
**DeepShake:** not run (blocked — no Mac worker / T7 mount on this cloud VM)

## Results

| Metric | Count |
|---|---:|
| Checked | 40 |
| OK (&lt;400) | 28 |
| Fail | 12 |
| OK rate | 70.0% |
| Extrapolated active (~index 2052) | ~1436 |
| Flipped inactive this run | 7 |
| Flipped active this run | 0 |

## Failures (first 80)

- `FL-MiamiDade` → `http://www.miamidade.gov/taxcollector/online-services.asp` — status=404 error=HTTP
- `FL-Orange` → `https://www.octaxcol.com/Octc/PropertyTax/Search.aspx` — status=404 error=HTTP
- `GA-Fulton` → `https://fultoncountytaxes.org/propertytax/search` — status=403 error=HTTP
- `OH-Franklin` → `http://treasurer.franklincountyohio.gov/` — status=403 error=HTTP
- `AR-Clay` → `https://www.arcountydata.com/propsearch.asp?county=Clay&s=T` — status=403 error=HTTP
- `AR-Nevada` → `https://www.arcountydata.com/propsearch.asp?county=Nevada&s=T` — status=403 error=HTTP
- `AR-VanBuren` → `https://www.arcountydata.com/propsearch.asp?county=Van Buren&s=T` — status=403 error=HTTP
- `CA-Modoc` → `https://common3.mptsweb.com/MBC/api/search/modoc/0000-CURR/feeparcel/{parcel}` — status=404 error=HTTP
- `CA-Tuolumne` → `https://common1.mptsweb.com/MBC/api/search/tuolumne/0000-CURR/feeparcel/{parcel}` — status=404 error=HTTP
- `GA-WarnerRobinsCity` → `https://wrga.governmentwindow.com/tax.html` — status=403 error=HTTP
- `SC-Horry` → `https://horrycountytreasurer.qpaybill.com/Taxes/TaxesDefaultType4.aspx"` — status=404 error=HTTP
- `TX-Coryell` → `https://tax.coryellcountytax.com/` — status=null error=Error

## Handoff for DeepShake (Mac + T7)

T7 is mounted on Bill’s Mac (`/Volumes/T7` in Finder → Locations). This cloud agent cannot see USB.

1. On the Mac: `bash scripts/deepshake-hunt-mac.sh` (searches `/Volumes/T7`, Desktop, Downloads, Applications).
2. `cursor worker start` on that Mac so a cloud agent can see `/Volumes/T7`.
3. Run DeepShake URL-fix / dork against keys flagged inactive above.
4. Prefer treasurer/sheriff/clerk/collector **search** pages over Base homepages.
