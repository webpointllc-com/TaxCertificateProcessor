# URL Hybrid Revalidate (2026-09-13)

**Generated:** 2026-09-13T20:22:09.943Z
**DeepShake:** **not_run** — DeepShake unavailable: cloud Linux VM has no /Volumes/T7 and no connected Mac self-hosted worker. Mac path: bash scripts/deepshake-hunt-mac.sh then cursor worker start.

## Method

- **A:** HTTP HEAD then GET; follow redirects (≤4); timeout 12s
- **A class:** 200–399 / 401 / 403 / 405 / 429 / 502 / 503 → validated_true; 404/410/NXDOMAIN/InvalidURL/google → dead; timeout/TLS/other 5xx → uncertain (keep active)
- **B:** Registry already prefers Search URL over Base; google placeholders skipped/dead
- **C:** Redirect follow; sample title/form sniff; host vs state+county soft cross-check

## Counts

| Metric | Count |
|---|---:|
| Listed (export jurisdictions) | 2062 |
| With URL | 2055 |
| Checked this run | 2055 |
| Validated-true | 1437 |
| Dead | 368 |
| Uncertain | 250 |
| Index active after write-back | 1681 |
| Flipped inactive | 288 |
| Flipped active | 0 |
| Host hard mismatches | 0 |
| Sniff sample (tax/form) | 73/150 |

## Host mismatches (flagged)

- none

## Dead sample (first 60)

- `AL-Blount` → `http://www.deltacomputersystems.com/AL/AL08/` — status=404 kind=gone error=
- `AL-Cullman` → `http://www.deltacomputersystems.com/AL/AL25/` — status=404 kind=gone error=
- `AL-Jackson` → `http://www.deltacomputersystems.com/AL/AL39/` — status=404 kind=gone error=
- `AL-Jefferson` → `http://tc.jeffcointouch.com/taxcollection/ASP/` — status=null kind=nxdomain error=NXDOMAIN
- `AL-Madison` → `http://www.deltacomputersystems.com/AL/AL47/` — status=404 kind=gone error=
- `AL-Montgomery` → `https://montgomery.capturecama.com/propsearch` — status=404 kind=gone error=
- `AL-Tuscaloosa` → `https://www.payyourpropertytax.com/tuscaloosa/la/` — status=404 kind=gone error=
- `AZ-Gila` → `https://parcelsearch.gilacountyaz.gov/` — status=null kind=nxdomain error=NXDOMAIN
- `CA-Inyo` → `https://ca-inyo.publicaccessnow.com/Treasurer/TaxSearch/` — status=404 kind=gone error=
- `CA-Sutter` → `https://ca-sutter.publicaccessnow.com/TaxCollector/TaxSearch/` — status=404 kind=gone error=
- `CO-ElPaso` → `http://www.trs.elpasoco.com` — status=null kind=nxdomain error=NXDOMAIN
- `CO-LaPlata` → `https://treasurer.laplata.co.us/treasurer/treasurerweb/` — status=null kind=nxdomain error=NXDOMAIN
- `CT-Ellington` → `https://www.mytaxbill.org/inet/bill/` — status=404 kind=gone error=
- `CT-GreenwichTown` → `https://www.mytaxbill.org/inet/bill/` — status=404 kind=gone error=
- `CT-HartfordCity` → `http://selfservice.hartford.gov/MSS/citizens/RealEstate/` — status=null kind=nxdomain error=NXDOMAIN
- `CT-NaugatuckTown` → `https://www.mytaxbill.org/inet/bill/` — status=404 kind=gone error=
- `CT-NewHavenCity` → `http://c2g.cityofnewhaven.com/Click2GovTX/` — status=null kind=nxdomain error=NXDOMAIN
- `CT-NewMilfordTown` → `https://www.mytaxbill.org/inet/bill/` — status=404 kind=gone error=
- `CT-OldLymeTown` → `https://www.mytaxbill.org/inet/bill/` — status=404 kind=gone error=
- `CT-SomersTown` → `https://www.mytaxbill.org/inet/bill/` — status=404 kind=gone error=
- `CT-TorringtonCity` → `https://www.mytaxbill.org/inet/bill/` — status=404 kind=gone error=
- `DE-MiddletownTown` → `https://wipp.edmundsassoc.com/Wipp/Wipp23/` — status=404 kind=gone error=
- `DE-WilmingtonCity` → `http://cityfinance1.wilmingtonde.gov/Departments/` — status=null kind=nxdomain error=NXDOMAIN
- `FL-Alachua` → `http://alachuataxcollector.governmax.com/collectmax/` — status=null kind=nxdomain error=NXDOMAIN
- `FL-Bay` → `http://tc.co.bay.fl.us/Property/` — status=null kind=nxdomain error=NXDOMAIN
- `FL-Charlotte` → `http://www.charlotte.county-taxes.com/` — status=null kind=nxdomain error=NXDOMAIN
- `FL-Citrus` → `http://www.citrus.county-taxes.com/` — status=null kind=nxdomain error=NXDOMAIN
- `FL-Columbia` → `http://fl-columbia-taxcollector.governmax.com/collectmax/` — status=null kind=nxdomain error=NXDOMAIN
- `FL-DeSoto` → `http://www.desotocountytaxcollector.com/Property/` — status=404 kind=gone error=
- `FL-Escambia` → `http://escambiataxcollector.governmaxa.com/collectmax/` — status=404 kind=gone error=
- `FL-Gilchrist` → `http://fl-gilchrist-taxcollector.governmax.com/collectmax/` — status=null kind=nxdomain error=NXDOMAIN
- `FL-Highlands` → `http://www.highlands.county-taxes.com/` — status=null kind=nxdomain error=NXDOMAIN
- `FL-IndianRiver` → `http://fl-indianriver-taxcollector.governmaxa.com/collectmax/` — status=404 kind=gone error=
- `FL-Lee` → `http://www.leetc.com/taxes` — status=404 kind=gone error=
- `FL-Levy` → `http://www.lctax.org/ptaxweb/` — status=null kind=nxdomain error=NXDOMAIN
- `FL-Monroe` → `http://www.monroe.county-taxes.com/` — status=null kind=nxdomain error=NXDOMAIN
- `FL-Nassau` → `http://fl-nassau-taxcollector.governmax.com/collectmax/` — status=null kind=nxdomain error=NXDOMAIN
- `FL-Osceola` → `http://www.osceolataxcollector.com/` — status=null kind=nxdomain error=NXDOMAIN
- `FL-StJohns` → `http://stjohnstaxcollector.governmax.com/collectmax/` — status=null kind=nxdomain error=NXDOMAIN
- `FL-StLucie` → `http://www.stlucie.county-taxes.com/` — status=null kind=nxdomain error=NXDOMAIN
- `FL-Suwannee` → `http://fl-suwannee-taxcollector.governmax.com/collectmax/` — status=null kind=nxdomain error=NXDOMAIN
- `FL-Taylor` → `http://fl-taylor-taxcollector.governmax.com/collectmax/` — status=null kind=nxdomain error=NXDOMAIN
- `FL-Volusia` → `http://www.volusia.org/services/financial-and-administrative-services/revenue-services/property-tax-collection/` — status=404 kind=gone error=
- `FL-Walton` → `http://taxsearch.waltontaxcollector.com/collectmax/` — status=null kind=nxdomain error=NXDOMAIN
- `GA-Banks` → `https://bankscounty.paytaxes.net/customer/` — status=null kind=nxdomain error=NXDOMAIN
- `GA-Bartow` → `https://bartow.paytaxes.net/customer/` — status=null kind=nxdomain error=NXDOMAIN
- `GA-Bryan` → `https://bryancounty.paytaxes.net/customer/` — status=null kind=nxdomain error=NXDOMAIN
- `GA-Bulloch` → `https://bulloch.paytaxes.net/customer/` — status=null kind=nxdomain error=NXDOMAIN
- `GA-Camden` → `https://camden.paytaxes.net/customer/` — status=null kind=nxdomain error=NXDOMAIN
- `GA-Coffee` → `http://coffeecountytax.com/` — status=null kind=nxdomain error=NXDOMAIN
- `GA-Colquitt` → `https://colquittcounty.paytaxes.net/customer/` — status=null kind=nxdomain error=NXDOMAIN
- `GA-Crisp` → `https://crispcounty.paytaxes.net/customer/` — status=null kind=nxdomain error=NXDOMAIN
- `GA-Dawson` → `https://dawsoncounty.paytaxes.net/customer/` — status=null kind=nxdomain error=NXDOMAIN
- `GA-DeKalb` → `http://taxcommissioner.dekalbcountyga.gov/TaxCommissioner/` — status=null kind=nxdomain error=NXDOMAIN
- `GA-Dougherty` → `https://dougherty.paytaxes.net/customer/` — status=null kind=nxdomain error=NXDOMAIN
- `GA-DublinCity` → `https://dubl-egov.aspgov.com/dublc2gtx/` — status=null kind=nxdomain error=NXDOMAIN
- `GA-EastPointCity` → `http://www.iparceltools.com/eastpointcitytax/iparceltools/` — status=null kind=nxdomain error=NXDOMAIN
- `GA-Folkston` → `https://folkston.paytaxes.net/customer/` — status=null kind=nxdomain error=NXDOMAIN
- `GA-Franklin` → `http://taxes.franklincountyga.com/TaxSearch/` — status=404 kind=gone error=
- `GA-GainesvilleCity` → `http://www.gainesvilletax.org/` — status=null kind=nxdomain error=NXDOMAIN
