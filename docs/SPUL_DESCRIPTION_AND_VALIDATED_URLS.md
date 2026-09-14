S-PUL — WHAT IT IS (paste-ready)
================================
Updated: 2026-09-13T22:38:00.568Z
Product names: S-PUL · Webpoint · TaxCert.ai
Account-of-record domain: taxcert.ai (marketing today: webpointllc.com)

ONE SENTENCE
------------
S-PUL is generative jurisdiction search: type a place (or tax intent), get the
official county/city tax collector or property-tax search URL with a confidence
score — or an honest miss. It does not invent URLs.

WHAT IT DOES
------------
- Accepts natural queries: "San Diego", "Travis County TX", "pay taxes Chicago",
  "LA County", parish/borough forms, soft typos.
- Normalizes the query (Layer B aliases) into a registry-friendly county + state
  shape. Example: "San Diego" → unique lock on San Diego County, CA;
  "Chicago" → Cook, IL; "Jackson" (ambiguous) → ranked list + ask for state.
- Looks up a locked Extractor registry of official Search/Base URLs.
- Returns the locked URL + confidence (and a short Path B guide: intent → open
  URL → search by owner/parcel). If the registry has no row, it says so.
- Prefer Search URL over Base homepage when both exist in source data.
- Never invents domains. Never uses LLM guesses as URL evidence.

WHAT IT IS NOT
--------------
- Not Central Intelligence (CI) / Path A orchestrator
- Not voice-first / TTS / orb
- Not RAG-over-docs / embeddings over a document corpus
- Not a scraper that invents collector sites from Google
- Highlighter (DEP) is untouched

COUNTS (hybrid + remainder revalidate)
-------------------------------------
Listed jurisdictions:     2062
With primary_search_url:  2055
Validated-true (HTTP):    1675
Dead (clear):             163
Uncertain (timeout/TLS/…):217
Registry active after write-back (validated-true + uncertain kept): 1866
Remainder newly validated-true vs hybrid baseline: 238
URL replacements applied (HTTP-evidenced, cumulative): 228
Path to 2000+ true: need 325 more (bot-walls/NXDOMAIN/geo may block)
DeepShake: NOT RUN (no /Volumes/T7, no Mac worker)

VALIDATED-TRUE URLS (full list — state, county, URL)
----------------------------------------------------

AK	Anchorage	https://www.muni.org/pw/dfhwbtta/
AK	Matanuska Susitna	https://myproperty.matsugov.us/
AL	Baldwin	https://baldwinproperty.countygovservices.com/Property/Search
AL	Barbour	https://barbour.capturecama.com/propsearch
AL	Calhoun	https://altags.com/calhoun_revenue/
AL	Chambers	https://www.ingproperty.com/Chambers_Revenue/property.aspx
AL	Cherokee	https://cherokeeproperty.countygovservices.com/Property/Search
AL	Choctaw	https://www.ingproperty.com/Choctaw_Revenue/property.aspx
AL	Coffee	https://www.coffeecountyrevenue.com/property.html
AL	Colbert	http://www.deltacomputersystems.com/AL/AL20/
AL	Dale	http://www.alabamagis.com/Dale/CamaTemplates/reports/
AL	De Kalb	https://dekalbproperty.assurancegov.com/Property/Search
AL	Elmore	http://www.elmorerevenuecommissioner.com/
AL	Escambia	https://altags.com/Escambia_License/property.aspx
AL	Etowah	https://etowahproperty.assurancegov.com/Property/Search
AL	Franklin	https://franklinproperty.countygovservices.com/Property/Search
AL	Houston	http://www.houstoncounty.org/Revenue/record/
AL	Jefferson	https://www.jccal.org/
AL	Lauderdale	http://www.deltacomputersystems.com/AL/AL41/
AL	Lawrence	https://lawrenceproperty.countygovservices.com/Property/Search
AL	Lee	http://www.deltacomputersystems.com/AL/AL43/
AL	Limestone	https://www.limestonerevenue.net/PRC/PublicPRC/
AL	Marshall	https://marshall.capturecama.com/propsearch
AL	Mobile	https://mobile.capturecama.com/propsearch
AL	Montgomery	https://montgomery.capturecama.com/
AL	Morgan	https://morgan.capturecama.com/propsearch
AL	Russell	https://russell.capturecama.com/propsearch
AL	Shelby	https://ptc.shelbyal.com/propsearch
AL	St Clair	http://www.deltacomputersystems.com/
AL	Talladega	https://talladegaproperty.countygovservices.com/Property/Property/Search
AL	Tallapoosa	http://tallapoosapropertytax.com/taxes/
AL	Walker	http://www.walkercountyrevenue.com/
AL	Winston	https://winstonproperty.assurancegov.com/Property/Search
AR	Arkansas	http://www.arcountydata.com/
AR	Baxter	http://www.arcountydata.com/
AR	Benton	https://bentoncountyar.gov/collector/
AR	Boone	http://www.arcountydata.com/
AR	Calhoun	https://www.arcountydata.com/propsearch.asp?county=Calhoun&s=T
AR	Carroll	http://www.arcountydata.com/
AR	Chicot	https://www.arcountydata.com/propsearch.asp?county=Chicot&s=T
AR	Clay	https://www.arcountydata.com/propsearch.asp?county=Clay&s=T
AR	Cleburne	https://www.arcountydata.com/propsearch.asp?county=Cleburne&s=T
AR	Columbia	http://www.arcountydata.com/
AR	Craighead	https://www.arcountydata.com/propsearch.asp?county=Craighead&s=T
AR	Crawford	https://www.arcountydata.com/propsearch.asp?county=Benton
AR	Dallas	https://www.arcountydata.com/propsearch.asp?county=Dallas&s=T
AR	Desha	http://www.arcountydata.com/
AR	Faulkner	https://www.arcountydata.com/propsearch.asp?county=Faulkner&s=T
AR	Fulton	https://www.arcountydata.com/propsearch.asp?county=Fulton&s=T
AR	Grant	https://www.arcountydata.com/propsearch.asp?county=Grant&s=T
AR	Greene	https://www.arcountydata.com/propsearch.asp?county=Greene&s=T
AR	Hempstead	https://www.arcountydata.com/propsearch.asp?county=Hempstead&s=T
AR	Howard	http://www.arcountydata.com/
AR	Izard	http://www.arcountydata.com/
AR	Jackson	https://www.arcountydata.com/propsearch.asp?county=Jackson&s=T
AR	Johnson	https://www.arcountydata.com/propsearch.asp?county=Johnson&s=T
AR	Lawrence	https://www.arcountydata.com/propsearch.asp?county=Lawrence&s=T
AR	Little River	https://www.arcountydata.com/propsearch.asp?county=Little%20River&s=T
AR	Logan	https://www.arcountydata.com/propsearch.asp?county=Logan&s=T
AR	Lonoke	http://www.arcountydata.com/
AR	Madison	https://www.arcountydata.com/propsearch.asp?county=Madison&s=T
AR	Mississippi	https://www.arcountydata.com/propsearch.asp?county=Mississippi&s=T
AR	Monroe	https://www.arcountydata.com/propsearch.asp?county=Monroe&s=T
AR	Montgomery	https://www.arcountydata.com/propsearch.asp?county=Montgomery&s=T
AR	Nevada	https://www.arcountydata.com/propsearch.asp?county=Nevada&s=T
AR	Newton	https://www.arcountydata.com/propsearch.asp?county=Newton&s=T
AR	Ouachita	https://www.arcountydata.com/propsearch.asp?county=Ouachita&s=T
AR	Perry	https://www.arcountydata.com/propsearch.asp?county=Perry&s=T
AR	Phillips	https://www.arcountydata.com/propsearch.asp?county=Phillips&s=T
AR	Pike	https://www.arcountydata.com/propsearch.asp?county=Pike&s=T
AR	Poinsett	https://www.arcountydata.com/propsearch.asp?county=Poinsett&s=T
AR	Polk	https://www.arcountydata.com/propsearch.asp?county=Polk&s=T
AR	Pope	https://www.arcountydata.com/propsearch.asp?county=Pope&s=T
AR	Prairie	https://www.arcountydata.com/propsearch.asp?county=Prairie&s=T
AR	Pulaski	https://public.pulaskicountytreasurer.net/
AR	Randolph	https://www.arcountydata.com/propsearch.asp?county=Randolph&s=T
AR	Saline	http://www.arcountydata.com/
AR	Scott	https://www.arcountydata.com/propsearch.asp?county=Scott&s=T
AR	Searcy	https://www.arcountydata.com/propsearch.asp?county=Searcy&s=T
AR	Sebastian	https://www.arcountydata.com/propsearch.asp?county=Sebastian&s=T
AR	Sharp	https://www.arcountydata.com/propsearch.asp?county=Sharp&s=T
AR	St Francis	https://www.arcountydata.com/propsearch.asp?county=St.%20Francis&s=T
AR	Stone	https://www.arcountydata.com/propsearch.asp?county=Stone&s=T
AR	Union	https://www.arcountydata.com/propsearch.asp?county=Union&s=T
AR	Van Buren	https://www.arcountydata.com/propsearch.asp?county=Van%20Buren&s=T
AR	Woodruff	https://www.arcountydata.com/propsearch.asp?county=Woodruff&s=T
AR	Yell	https://www.arcountydata.com/propsearch.asp?county=Yell&s=T
AZ	Maricopa	https://treasurer.maricopa.gov/PropertyTaxInformation/
AZ	Pima	https://www.to.pima.gov/propertyInquiry/
AZ	Pinal	https://treasurer.pinal.gov/parcelinquiry/
CA	Alameda	http://www.acgov.org/treasurer/index.htm
CA	ALTAIrrigation	http://altaid.org/
CA	Butte	https://common3.mptsweb.com/MBC/butte/tax/search
CA	Calaveras	https://common3.mptsweb.com/MBC/calaveras/tax/search
CA	Del Norte	https://common3.mptsweb.com/MBC/delnorte/tax/search
CA	Fresno	http://www.co.fresno.ca.us/DepartmentPage.aspx?id=6218
CA	Humboldt	https://common3.mptsweb.com/MBC/humboldt/tax/search
CA	Imperial	https://common3.mptsweb.com/MBC/imperial/tax/search
CA	Inyo	https://ca-inyo.publicaccessnow.com/
CA	Kern	https://www.kcttc.co.kern.ca.us/
CA	Los Angeles	https://ttc.lacounty.gov/
CA	Madera	https://common3.mptsweb.com/MBC/madera/tax/search
CA	Marin	https://apps.marincounty.gov/TaxBillOnline/?PropertyId={parcel}
CA	Mendicino	https://ca-mendocino.publicaccessnow.com/TaxCollector/TaxSearch.aspx
CA	Merced	https://common3.mptsweb.com/MBC/merced/tax/search
CA	Modoc	https://common3.mptsweb.com/MBC/modoc/tax/search
CA	Mono	https://common3.mptsweb.com/MBC/mono/tax/search
CA	Monterey	https://common3.mptsweb.com/MBC/monterey/tax/search
CA	Napa	https://common3.mptsweb.com/MBC/napa/tax/search
CA	Orange	http://ttc.ocgov.com/
CA	Placer	https://common3.mptsweb.com/MBC/placer/tax/search
CA	Sacramento	https://eproptax.saccounty.net/
CA	San Bernardino	https://www.sbcountyatc.gov/tax-services/property-tax
CA	San Diego	http://www.sdtreastax.com/
CA	San Francisco	http://sftreasurer.org/property-tax-payments
CA	San Joaquin	https://common3.mptsweb.com/MBC/sanjoaquin/tax/search
CA	San Mateo	https://www.sanmateocountytaxcollector.org/
CA	Santa Clara	https://www.sccgov.org/sites/tax/Pages/Santa-Clara-Tax-Collector's-Office.aspx
CA	Santa Cruz	http://ttc.co.santa-cruz.ca.us/Taxbills/
CA	SBSKern	http://www.kcttc.co.kern.ca.us/payment/
CA	SBSLos Angeles	https://vcheck.ttc.lacounty.gov/
CA	SBSSan Mateo	http://www.sanmateocountytaxcollector.org/SMCWPS/
CA	Shasta	https://common3.mptsweb.com/MBC/shasta/tax/search
CA	Siskiyou	https://common1.mptsweb.com/MBC/siskiyou/tax/search
CA	Sonoma	https://common3.mptsweb.com/MBC/sonoma/tax/search
CA	Stanislaus	https://common3.mptsweb.com/MBC/stanislaus/tax/search
CA	Sutter	https://ca-sutter.publicaccessnow.com/
CA	Tuolumne	https://common1.mptsweb.com/MBC/tuolumne/tax/search
CA	Ventura	https://taxpayment.venturacounty.gov/
CA	Yolo	https://common2.mptsweb.com/MBC/yolo/tax/search
CO	Adams	https://adcotax.com/treasurer/treasurerweb/
CO	Arapahoe	http://www.co.arapahoe.co.us
CO	Denver	https://property.spatialest.com/co/denver#/
CO	Douglas	https://apps.douglas.co.us/treasurer/treasurerweb/search.jsp
CO	El Paso	https://property.spatialest.com/co/elpaso/#/
CO	Jefferson	http://www.jeffco.us
CO	Larimer	http://www.co.larimer.co.us/assessor/query/
CO	Mesa	https://appz.mesacounty.us/treasurer/treasurerweb/
CO	Saguache	https://saguachecountyco-treasurer.tylerhost.net/treasurer/treasurerweb/search.jsp
CO	Weld	https://www.weldtax.com/treasurer/treasurerweb/
CT	Cromwell Town	https://www.opaldata.net/onlinetax/
CT	Ellington	https://www.mytaxbill.org/inet/bill/home.do?town=ellington
CT	Enfield Town	https://enfield.munisselfservice.com/
CT	Greenwich Town	https://www.mytaxbill.org/inet/bill/home.do?town=greenwich
CT	Naugatuck Town	https://www.mytaxbill.org/inet/bill/home.do?town=naugatuck
CT	New Milford Town	https://www.mytaxbill.org/inet/bill/home.do?town=new%20milford
CT	Old Lyme Town	https://www.mytaxbill.org/inet/bill/home.do?town=old%20lyme
CT	Somers Town	https://www.mytaxbill.org/inet/bill/home.do?town=somers
CT	Torrington City	https://www.mytaxbill.org/inet/bill/home.do?town=torrington
CT	Waterbury City	https://www.mytaxbill.org/inet/bill/home.do?town=waterbury
DC	District Of Columbia	https://www.taxpayerservicecenter.com/
DC	District Of Columbia Separate BID	https://www.taxpayerservicecenter.com/
DE	Dewey Beach Town	https://wipp.edmundsgovtech.cloud/home?wippId=334
DE	Kent	https://kent400.co.kent.de.us/
DE	Middletown Town	https://wipp.edmundsassoc.com/Wipp/?wippid=Middletown
DE	Sussex	http://www.sussexcountyde.gov/e-service/propertytaxes/
FL	Bradford	http://qpublic.net/cgi-bin/
FL	Brevard	https://county-taxes.net/brevard/property-tax
FL	Broward	https://county-taxes.net/broward/broward/property-tax
FL	Charlotte	https://county-taxes.net/charlotte/property-tax
FL	Citrus	https://county-taxes.net/citrus/property-tax
FL	Collier	https://county-taxes.net/fl-collier/property-tax
FL	De Soto	https://www.desotocountytaxcollector.com/
FL	Duval	http://www.coj.net/departments/tax-collector.aspx
FL	Flagler	http://www.flaglertax.com/
FL	Highlands	https://county-taxes.net/highlands/property-tax
FL	Hillsborough	http://www.hillstax.org/
FL	Lafayette	http://www.lafayettetc.com/TAX/
FL	Lake	http://www.laketax.com/
FL	Lee	https://leetc.com/
FL	Leon	https://wwwtax2.leoncountyfl.gov/itm/PropertySearchAccount.aspx
FL	Manatee	https://secure.taxcollector.com/ptaxweb/editPropertySearch2.action?action=list
FL	Marion	https://www.mariontax.com/itm/PropertySearchAccount.aspx
FL	Miami Dade	https://www.miamidade.gov/taxcollector/
FL	Monroe	https://county-taxes.net/monroe/property-tax
FL	Okaloosa	http://www.okaloosatax.com/
FL	Orange	https://www.octaxcol.com/taxes/
FL	Palm Beach	https://www.pbctax.com/
FL	Pasco	http://www.pascotaxes.com/
FL	Pinellas	http://www.taxcollect.com/
FL	Polk	https://polk.floridatax.us/AccountSearch?s=pt
FL	Santa Rosa	http://www.srctc.com/
FL	Sarasota	https://www.sarasotataxcollector.com/
FL	Seminole	https://seminolecounty.tax/services/property-taxes/property-and-tangible-taxes/
FL	St Lucie	https://county-taxes.net/stlucie/property-tax
FL	Volusia	https://www.volusia.org/
FL	Wakulla	http://www.wakullacountytaxcollector.com/
GA	Alpharetta City	https://mss.alpharetta.ga.us/MSS/citizens/RealEstate/
GA	Americus	https://americusga.governmentwindow.com/tax.html
GA	Banks	https://www.qpublic.net/ga/banks/
GA	Bartow	https://www.qpublic.net/ga/bartow/
GA	Brooks	https://d1ebsyxxbc7tep.cloudfront.net/
GA	Bryan	https://www.qpublic.net/ga/bryan/
GA	Bulloch	https://www.qpublic.net/ga/bulloch/
GA	Burke	https://burkeproperty.assurancegov.com/Property/Search
GA	Byron City	https://byronga.csibillpay.com/Tax/
GA	Camden	https://www.qpublic.net/ga/camden/
GA	Catoosa	http://catoosataxes.com/
GA	Centerville City	https://centervillega.mygovhub.com/#/quickpay
GA	Chatham	http://chathamtax.org/
GA	Cherokee	http://www.cherokeega.com/applications/taxbills/
GA	Cobb	https://cobbtaxpayments.org/
GA	Colquitt	https://www.qpublic.net/ga/colquitt/
GA	Crawford	https://crawfordproperty.assurancegov.com/Property/Search
GA	Crisp	https://www.qpublic.net/ga/crisp/
GA	Dade	https://dadeproperty.assurancegov.com/Property/Search
GA	Dawson	https://www.qpublic.net/ga/dawson/
GA	Decatur City	https://www.decaturgatax.com/taxes#/WildfireSearch
GA	Dougherty	https://www.qpublic.net/ga/dougherty/
GA	Duluth City	https://duluthga.municipalonlinepayments.com/duluthga/tax/search
GA	Elbert	https://d1ebsyxxbc7tep.cloudfront.net/
GA	Emanuel	https://emanuelproperty.assurancegov.com/Property/Search
GA	Fayette	http://www.fayettecountytaxcomm.com/
GA	Folkston	https://www.qpublic.net/ga/folkston/
GA	Franklin	http://taxes.franklincountyga.com/TaxSearch/
GA	Fulton	https://fultoncountytaxes.org/propertytax/search
GA	Fulton Cities	https://fultoncountytaxes.org/propertytax/search
GA	Fulton Solid Waste	https://fultoncountytaxes.org/propertytax/search
GA	Gilmer	https://www.qpublic.net/ga/gilmer/
GA	Gordon	https://www.qpublic.net/ga/gordon/
GA	Grady	https://qpublic.schneidercorp.com/Application.aspx?AppID=1065&LayerID=25364&PageTypeID=2&PageID=10318
GA	Gwinnett	https://www.gwinnetttaxcommissioner.com/property-tax/view-pay-your-taxes
GA	Haralson	https://www.qpublic.net/ga/haralson/
GA	Heard	https://www.qpublic.net/ga/heard/
GA	Houston	https://www.qpublic.net/ga/houston/
GA	Jones	https://www.qpublic.net/ga/jones/
GA	Kennesaw City	https://www.municipalonlinepayments.com/
GA	Lamar	https://www.qpublic.net/ga/lamar/
GA	Laurens	https://www.qpublic.net/ga/laurens/
GA	Lee	https://www.qpublic.net/ga/lee/
GA	Long	https://www.longcountytax.com/taxes.html#/WildfireSearch
GA	Lumpkin	https://www.lumpkincountytax.com/
GA	Madison	https://www.qpublic.net/ga/madison/
GA	Mc Intosh	https://www.qpublic.net/ga/mc-intosh/
GA	Milton City	https://www.municipalonlinepayments.com/
GA	Monroe	https://www.qpublic.net/ga/monroe/
GA	Morgan	https://www.qpublic.net/ga/morgan/
GA	Paulding	https://www.qpublic.net/ga/paulding/
GA	Peach	http://www.peachcountytax.com/
GA	Pickens	https://pickensproperty.assurancegov.com/Property/Search
GA	Pierce	https://www.qpublic.net/ga/pierce/
GA	Pike	https://www.qpublic.net/ga/pike/
GA	Powder Springs City	https://wipp.edmundsassoc.com/Wipp/
GA	Pulaski	https://pulaskicountyga.governmentwindow.com/tax.html
GA	Putnam	https://www.qpublic.net/ga/putnam/
GA	Riverdale City	https://www.qpublic.net/ga/riverdale/
GA	Savannah City	http://revenue.savannahga.gov/revwebpay/WebPortal/WEB_PT_MAIN.aspx?command=REPORTPARAMETERSTYLE&style=&group=RE
GA	Smyrna	https://www.qpublic.net/ga/smyrna/
GA	Spaulding	http://www.spaldingcountytax.com/
GA	Sumter	http://www.sumtercountygatax.com/
GA	Thomas	https://thomascountyga.governmentwindow.com/tax.html
GA	Tift	https://www.qpublic.net/ga/tift/
GA	Toccoa City	https://www.invoicecloud.com/portal/(S(xkepqelrtghf3prgwu1eiiwj))/2/
GA	Troup	https://pay.troupcountytax.com/
GA	Union City	https://unioncityga.governmentwindow.com/
GA	Vesta Holdings	http://blackbox1.vestaholdings.com/p9/infoaccount/
GA	Vidalia	https://www.qpublic.net/ga/vidalia/
GA	Walker	https://walkerproperty.assurancegov.com/Property/Search
GA	Ware	https://d1ebsyxxbc7tep.cloudfront.net/
GA	Warner Robins City	https://wrga.governmentwindow.com/tax.html
GA	Washington	https://washingtoncountyga.governmentwindow.com/
GA	West Point	https://www.qpublic.net/ga/west-point/
GA	Wilkinson	https://www.qpublic.net/ga/wilkinson/
GA	Woodstock City	https://woodstock.surecourt.com/
GU	Guam	https://www.guamtax.com/
HI	Honolulu	https://qpublic.schneidercorp.com/Application.aspx?App=HonoluluCountyHI&PageType=Search
IA	Buchanan	https://www.iowataxandtags.org/
IA	Clayton	https://www.iowataxandtags.org/
IA	Clinton	https://www.iowataxandtags.org/
IA	Dallas	https://www.iowataxandtags.org/
IA	Dickinson	https://www.iowataxandtags.org/
IA	Floyd	https://www.iowataxandtags.org/
IA	Iowa	https://www.iowataxandtags.org/
IA	Johnson	https://www.iowataxandtags.org/
IA	Linn	https://www.iowataxandtags.org/
IA	Montgomery	https://www.iowataxandtags.org/
IA	Polk	https://www.iowataxandtags.org/
IA	Pottawattamie	https://www.pottco.org/
IA	Poweshiek	https://www.iowataxandtags.org/
IA	Story	https://www.iowatreasurers.org/
IA	Woodbury	https://www.iowataxandtags.org/
IA	Worth	https://www.iowataxandtags.org/
IL	Adams	https://adamsil.devnetwedge.com/
IL	Boone	https://booneil.devnetwedge.com/
IL	Bureau	https://propertytaxonline.org/Bureau/
IL	Champaign	http://www.co.champaign.il.us/
IL	Christian	http://www.fikeandfike.com/propertytax/Christian/
IL	Clark	https://clarkil.devnetwedge.com/
IL	Coles	http://colesil.devnetwedge.com/
IL	Cook	https://cookcountytreasurer.com/pinsummary.aspx
IL	Cook Clerk	http://www.cookcountyclerk.com/tsd/delinquenttaxsearch/Pages/DelinquentTaxSearch.aspx
IL	Cook Treasurer	https://www.cookcountytreasurer.com/setsearchparameters.aspx
IL	Du Page	https://propertylookup.dupagecounty.gov/search/commonsearch.aspx?mode=parid
IL	Du Page Clerk	http://www.dupageco.org/CountyClerk/
IL	Greene	https://propertytaxonline.org/Greene/InquiryCriteria.aspx
IL	Grundy	https://www.fikeandfike.com/
IL	Henry	https://henryil.devnetwedge.com/
IL	Jackson	https://jacksonil.devnetwedge.com/
IL	Jersey	https://jerseyil.devnetwedge.com/
IL	Kane	https://kaneil.devnetwedge.com/
IL	Lake	http://www.lakecountyil.gov/Treasurer/Payments/Pages/CurrentPaymentStatus.aspx
IL	Livingston	https://livingstonil.devnetwedge.com/
IL	Logan	https://taxsearch.co.logan.il.us/
IL	Macon	http://www.fikeandfike.com/
IL	Madison	http://reweb1.co.madison.il.us/
IL	Marion	https://marionil.devnetwedge.com/
IL	Mc Lean	https://mcleanil.devnetwedge.com/
IL	Monroe	http://propertytaxonline.org/Monroe/
IL	Ogle	http://beacon.schneidercorp.com/
IL	Peoria	http://propertytax.peoriacounty.org/parcel/view/
IL	Rock Island	http://www.rockislandcounty.org/
IL	Saline	https://salineil.devnetwedge.com/
IL	Sangamon	http://tax.co.sangamon.il.us/SangamonCountyWeb/app/
IL	Shelby	https://propertytaxonline.org/Shelby/InquiryCriteria.aspx?i=1
IL	Stark	http://www.fikeandfike.com/propertytax/Stark/
IL	St Clair	https://www.co.st-clair.il.us/
IL	Tazewell	https://tazewellil.devnetwedge.com/
IL	Vermilion	http://taxinquiry.vercounty.org/
IL	Whiteside	https://whitesideil.devnetwedge.com/
IL	Will	https://willcountytreasurer.us/taxes.html#/WildfireSearch
IN	Adams	http://web1.adams-county.com/pti_release/
IN	Bartholomew	https://beacon.schneidercorp.com/Application.aspx?AppID=1130&LayerID=28606&PageTypeID=2&PageID=12977
IN	Benton	https://bentonin.wthgis.com/tgis/
IN	Blackford	https://beacon.schneidercorp.com/
IN	Boone	https://www.invoicecloud.com/boonecounty
IN	Brown	https://brownin.wthgis.com/tgis/
IN	Cass	https://www.govtechtaxpro.com/
IN	Clay	https://clayin.wthgis.com/tgis/
IN	Clinton	http://beacon.schneidercorp.com/
IN	Crawford	https://beacon.schneidercorp.com/
IN	Daviess	https://www.govtechtaxpro.com/
IN	Dearborn	https://beacon.schneidercorp.com/
IN	Decatur	https://beacon.schneidercorp.com/
IN	De Kalb	https://beacon.schneidercorp.com/
IN	Dubois	https://duboisin.wthgis.com/tgis/
IN	Elkhart	https://www.invoicecloud.com/
IN	Fountain	https://beacon.schneidercorp.com/
IN	Franklin	https://franklinin.wthgis.com/tgis/
IN	Fulton	https://fultonin.wthgis.com/tgis/
IN	Gibson	https://beacon.schneidercorp.com/
IN	Grant	http://treasurer.grant.in.datapitstop.us/
IN	Greene	https://greenein.wthgis.com/tgis/
IN	Hamilton	https://www.hamiltoncounty.in.gov/
IN	Hancock	http://beacon.schneidercorp.com/
IN	Hendricks	https://www.co.hendricks.in.us/
IN	Henry	https://beacon.schneidercorp.com/
IN	Howard	http://beacon.schneidercorp.com/
IN	Jasper	https://beacon.schneidercorp.com/
IN	Jefferson	https://jeffersonin.wthgis.com/tgis/
IN	Jennings	https://jenningsin.wthgis.com/tgis/
IN	Johnson	http://beacon.schneidercorp.com/
IN	Knox	https://beacon.schneidercorp.com/
IN	Kosciusko	http://beacon.schneidercorp.com/
IN	La Grange	https://lowtaxinfo.com/lagrangecounty/
IN	Lake	https://in-lake.publicaccessnow.com/PropertyTax/TaxSearch.aspx
IN	La Porte	https://beacon.schneidercorp.com/
IN	Madison	http://treasurer.madisoncounty48.us/
IN	Marion	https://www.biz.indygov.org/treasurer/property/
IN	Marion Auctions	https://liveauctions.govease.com/in/inmarion/1282/PublicPortalRecords/
IN	Martin	https://www.govtechtaxpro.com/
IN	Montgomery	http://beacon.schneidercorp.com/
IN	Newton	https://beacon.schneidercorp.com/
IN	Noble	https://beacon.schneidercorp.com/
IN	Ohio	https://ohioin.wthgis.com/tgis/
IN	Owen	https://www.govtechtaxpro.com/
IN	Perry	https://perryin.wthgis.com/tgis/
IN	Pike	https://pikein.wthgis.com/tgis/
IN	Porter	https://lowtaxinfo.com/portercounty/
IN	Posey	http://poseycountytax.com/taxes/
IN	Pulaski	https://pulaskiin.wthgis.com/tgis/
IN	Putnam	https://putnamin.wthgis.com/tgis/
IN	Randolph	https://randolphin.wthgis.com/tgis/
IN	Rush	https://beacon.schneidercorp.com/
IN	Scott	https://scottin.wthgis.com/
IN	Shelby	http://auditor.shelbycounty73.us/
IN	Spencer	https://spencerin.wthgis.com/tgis/
IN	Starke	https://starkein.wthgis.com/tgis/
IN	Steuben	http://beacon.schneidercorp.com/
IN	Sullivan	https://beacon.schneidercorp.com/
IN	Switzerland	https://switzerlandin.wthgis.com/tgis/
IN	Tipton	https://beacon.schneidercorp.com/
IN	Union	https://unionin.wthgis.com/tgis/
IN	Vermillion	https://vermillionin.wthgis.com/tgis/
IN	Vigo	http://beacon.schneidercorp.com/
IN	Wabash	https://beacon.schneidercorp.com/
IN	Warren	https://www.invoicecloud.com/portal/
IN	Washington	https://washingtonin.wthgis.com/tgis/
IN	Wayne	https://beacon.schneidercorp.com/
IN	Wells	https://beacon.schneidercorp.com/
IN	Whitley	http://beacon.schneidercorp.com/
KS	Butler	http://ww1.bucoks.com/InternetSite/OLS/tax/Search/
KS	Gray	http://www.gray.kansasgov.com/tax/
KS	Johnson	https://taxbill.jocogov.org/
KS	Lyon	https://beacon.schneidercorp.com/
KS	Marion	http://www.marion.kansasgov.com/tax/
KS	Mitchell	http://www.mitchell.kansasgov.com/tax/
KS	Nemaha	http://ks284.cichosting.com/ttp/tax/Search/
KS	Pottawatomie	http://www2.pottcounty.org/aspnet/Taxes/
KS	Reno	http://tax.renogov.org/ols/tax/Search/
KS	Sedgwick	https://ssc.sedgwickcounty.org/propertytax/realproperty.aspx?pin={taxid}
KS	Shawnee	http://www.snco.us/treasurer/
KS	Thomas	http://ks1057.cichosting.com/tax/search/
KY	Alexandria City	http://alexandria.campbell.ky.govern.com/
KY	Anderson	https://view.properlytaxes.com/
KY	Barren	https://ecclix.com/ecclix/
KY	Boone	https://www.boonecountyky.org/
KY	Boone Clerk	https://ecclix.com/ecclix/login.aspx
KY	Boyle Clerk	https://ecclix.com/ecclix/login.aspx
KY	Bracken	https://ecclix.com/ecclix/login.aspx
KY	Breathitt	https://ecclix.com/ecclix/login.aspx
KY	Breckinridge	https://ecclix.com/ecclix/login.aspx
KY	Bullitt	http://ptax1.csiky.com/bullitt_current/
KY	Caldwell	https://ecclix.com/ecclix/login.aspx
KY	Daviess	https://ecclix.com/ecclix/login.aspx
KY	Elliott	https://ecclix.com/ecclix/login.aspx
KY	Fayette	https://fayettesheriff.com/property_taxes_lookup_2025.php
KY	Floyd	https://americanlandrecords.com/delinquent-tax?countyId=1029
KY	Floyd Clerk	https://americanlandrecords.com/
KY	Franklin	https://ecclix.com/ecclix/login.aspx
KY	Grant	https://ecclix.com/ecclix/
KY	Graves	https://ecclix.com/ecclix/
KY	Green	https://ecclix.com/ecclix/login.aspx
KY	Hancock	https://ecclix.com/ecclix/login.aspx
KY	Hardin	https://www.compuaid.com:8080/
KY	Harrison	https://view.properlytaxes.com/
KY	Henry	https://ecclix.com/ecclix/login.aspx
KY	Hopkins	https://www.hopkinscountysheriff.com/index.php/taxes
KY	Jassamine	https://jessaminesheriff.org/pay-taxes/
KY	Jefferson	https://pay-jeffersonky-sheriff.com/#/WildfireSearch
KY	Johnson	https://ecclix.com/ecclix/login.aspx
KY	Knox	https://ecclix.com/ecclix/login.aspx
KY	La Rue	https://view.properlytaxes.com/index?id=192&loc=2
KY	Logan	https://ecclix.com/ecclix/login.aspx
KY	Madison	https://ecclix.com/ecclix/
KY	Marshall	https://view.properlytaxes.com/
KY	Mason	https://ecclix.com/ecclix/login.aspx
KY	Mc Cracken	https://ecclix.com/ecclix/login.aspx
KY	Meade	https://ecclix.com/ecclix/login.aspx
KY	Montgomery	https://ecclix.com/ecclix/login.aspx
KY	Muhlenberg	https://ecclix.com/ecclix/login.aspx
KY	Oldham	http://ptax1.csiky.com/oldham_current/
KY	Owen	https://ecclix.com/ecclix/login.aspx
KY	Scott	https://ecclix.com/ecclix/login.aspx
KY	Simpson	https://ecclix.com/ecclix/login.aspx
KY	Spencer	https://ecclix.com/ecclix/login.aspx
KY	Union	https://ecclix.com/ecclix/login.aspx
KY	Warren	https://ecclix.com/ecclix/
KY	Whitley	https://ecclix.com/ecclix/
KY	Woodford	https://ecclix.com/ecclix/login.aspx
LA	Allen Parish	http://snstaxpayments.com/
LA	Beauregard Parish	http://snstaxpayments.com/
LA	Bossier Parish	http://www.bossiersheriff.com/property-details/
LA	Caddo Parish	https://mytax.eztaxonline.net/
LA	Caddo Parish Assessor	https://www.actdatascout.com/RealProperty/Index
LA	De Soto Parish	https://snstaxpayments.com/desoto/
LA	East Baton Rouge Parish	https://www.ebrso.org/DesktopModules/TCMOnline/
LA	Gretna City	https://www.municipalonlinepayments.com/gretnala/tax/
LA	Harahan City	https://www.municipalonlinepayments.com/harahanla/tax/
LA	Iberville Parish	http://snstaxpayments.com/
LA	Jefferson Parish	https://eservices.jpso.com/eservicespt/propertytax/
LA	Kenner City	https://payments.kenner.la.us/RE_PropertyTax/RETaxSelfService.aspx
LA	Lincoln Parish	http://snstaxpayments.com/
LA	Livingston Parish	http://www.lpso.org/General/
LA	Natchitoches Parish	http://snstaxpayments.com/
LA	New Iberia City	http://snstaxpayments.com/
LA	New Orleans Parish	https://services.nola.gov/
LA	Sabine Parish	http://snstaxpayments.com/
LA	Shreveport	https://www.shreveportla.gov/
LA	St James Parish	http://snstaxpayments.com/
LA	St John The Baptist Parish	http://snstaxpayments.com/
LA	St Mary Parish	https://snstaxpayments.com/stmary/
LA	St Tammany Parish	https://secure.stpsopayments.com/propertyTax/
LA	Tangipahoa Parish	http://snstaxpayments.com/
LA	Terrebonne Parish	http://tpso.net/
MA	Arlington Town	https://www.invoicecloud.com/portal/
MA	Barnstable Town	https://www.invoicecloud.com/portal/2/customerlocator.aspx?iti=8&bg=e547f99d-4428-4d04-85c8-4c7b2efb3256&vsii=1
MA	Boston City	https://www.boston.gov/real-estate-taxes?input1=
MA	Cambridge	https://www.cambridgema.gov/externallinks/paybillsonline/InvoiceCloud
MA	Lowell City	https://www.invoicecloud.com/portal/(S(e3qdmnuh3cq23pd5wadi14kr))/2/
MA	Malden City	https://www.invoicecloud.com/portal/
MA	Waltham City	https://web-server.city.waltham.ma.us/GovernEcomponents/WebUserInterface/
MA	Worcester City	https://unipaygold.unibank.com/transactioninfo.aspx?TID=3486
MA	Worcester City Lien	https://www.worcesterma.gov/finance/liens-auctions/municipal-lien
MD	Allegany	http://propertytaxes.allconet.org/account/
MD	Anne Arundel	https://aacounty.munisselfservice.com/citizens/RealEstate/
MD	Anne Arundel Utility	https://aacounty.munisselfservice.com/citizens/UtilityBilling/
MD	Baltimore	https://mytax.baltimorecountymd.gov/rptp/portal/property-tax-payment/
MD	Baltimore City	http://cityservices.baltimorecity.gov/realproperty/
MD	Caroline	https://www.carolinemd.org/
MD	Cecil	https://cecilco.munisselfservice.com/
MD	Charles	https://www.charlescounty.org/
MD	Frederick	http://frederickcountymd.munisselfservice.com/citizens/RealEstate/
MD	Garrett	https://payments.garrettcounty.org/
MD	Hagerstown City	https://mycity.hagerstownmd.org/MSS/citizens/RealEstate/
MD	Harford	https://hcgweb01.harfordcountymd.gov/billpay?tabindex=0
MD	Havre De Grace City	https://wipp.edmundsassoc.com/WippHAVR/
MD	Howard	https://howardcountymd.munisselfservice.com/
MD	Montgomery	https://apps.montgomerycountymd.gov/realpropertytax/
MD	Prince George	http://taxinquiry.princegeorgescountymd.gov/
MD	Washington	https://www.washco-md.net/
MD	Wicomico	https://www.wicomicocounty.org/
ME	Falmouth	http://falmouthme.munisselfservice.com/citizens/RealEstate/
MI	Auburn City	https://accessmygov.com/SiteSearch/
MI	Bedford Charter Township	https://www.bsaonline.com/
MI	Bedford Township	https://www.bsaonline.com/
MI	Bennington Township	https://accessmygov.com/SiteSearch/
MI	Berlin Township	https://bsaonline.com/
MI	Blissfield Township	https://bsaonline.com/
MI	Caledonia Township	https://bsaonline.com/SiteSearch/
MI	Carlton Township	https://accessmygov.com/SiteSearch/
MI	Chelsea City	https://bsaonline.com/
MI	Colon Township	https://bsaonline.com/
MI	Dearborn City	https://bsaonline.com/?uid=599
MI	Detroit City	https://bsaonline.com/?uid=155
MI	Dundee Township	https://bsaonline.com/
MI	Durand City	https://bsaonline.com/SiteSearch/
MI	Farmington Hills City	https://bsaonline.com/?uid=316
MI	Flint City	https://accessmygov.com/SiteSearch/
MI	Gibraltar City	https://accessmygov.com/SiteSearch/
MI	Hadley Township	https://bsaonline.com/SiteSearch/
MI	Hamilton Township	https://bsaonline.com/?uid=1895
MI	Hartford Township	https://bsaonline.com/?uid=1896
MI	Iosco	https://bsaonline.com/?uid=1995
MI	Iosco-Duplicate-c67e0d91	https://bsaonline.com/?uid=1995
MI	Isabella	http://www.fetchgis.com/isabellaLRP/
MI	Lansing City	https://bsaonline.com/?uid=384
MI	Lyon Township	https://bsaonline.com/
MI	Merritt Township	https://bsaonline.com/?uid=934
MI	Milan	https://accessmygov.com/
MI	North Branch Township	https://accessmygov.com/
MI	Olive Township	https://accessmygov.com/SiteSearch/
MI	Pierson Township	https://accessmygov.com/SiteSearch/
MI	Prairieville Township	https://bsaonline.com/SiteSearch/
MI	Redford Town	https://bsaonline.com/?uid=677
MI	Reynolds Township	https://accessmygov.com/
MI	Romeo Village	https://accessmygov.com/SiteSearch/
MI	St Clair	https://www.stclaircounty.org/Offices/equalization/
MI	St Clair Township	https://bsaonline.com/SiteSearch/
MI	St Joseph	https://bsaonline.com/
MI	Sullivan Township	https://bsaonline.com/?uid=1598
MI	Thornapple Township	https://bsaonline.com/SiteSearch/
MI	Van Buren	https://accessmygov.com/
MI	Venice Township	https://bsaonline.com/
MI	Vernon Township	https://bsaonline.com/
MI	Vienna Township	https://bsaonline.com/?uid=417
MI	Wayne	https://pta.waynecounty.com/Home/PropertySearch
MN	Benton	https://property.bentoncountymn.gov/search/commonsearch.aspx?mode=realprop
MN	Blue Earth	https://www.blueearthcountymn.gov/
MN	Carver	https://www.carvercountymn.gov/
MN	Chisago	https://gis.chisagocounty.us/chisago_tax/
MN	Cook	https://beacon.schneidercorp.com/Application.aspx?AppID=1373&LayerID=46422&PageTypeID=2&PageID=19190
MN	Dakota	https://services.co.dakota.mn.us/
MN	Dodge	http://dodge.visualgov.com/
MN	Douglas	https://www.douglascountymn.gov/
MN	Fillmore	https://beacon.schneidercorp.com/Application.aspx?AppID=1066&LayerID=25416&PageTypeID=2&PageID=10333
MN	Freeborn	https://beacon.schneidercorp.com/
MN	Goodhue	http://visualgov.co.goodhue.mn.us/
MN	Grant	https://www.grantcountymn.gov/
MN	Hennepin	http://www16.co.hennepin.mn.us/pins/
MN	Hubbard	https://publicaccess.co.hubbard.mn.us/search/
MN	Isanti	https://www.isanticountymn.gov/
MN	Kanabec	https://beacon.schneidercorp.com/Application.aspx?AppID=453&LayerID=6582&PageTypeID=2&PageID=3498
MN	Kandiyohi	https://www.kandiyohicountymn.gov/
MN	Le Sueur	https://beacon.schneidercorp.com/Application.aspx?AppID=248&LayerID=3190&PageTypeID=2&PageID=1710
MN	Lincoln	https://tax.cptmn.us/PTaxPortal/#/parcelSearch/Lincoln
MN	Lyon	https://www.lyoncountymn.gov/
MN	Marshall	https://www.marshallcountymn.gov/
MN	Martin	https://beacon.schneidercorp.com/
MN	Mc Leod	http://mcleod.visualgov.com/
MN	Meeker	https://www.meekercountymn.gov/
MN	Morrison	http://beacon.schneidercorp.com/
MN	Murray	https://www.murraycountymn.gov/
MN	Nobles	https://www.noblescountymn.gov/
MN	Norman	https://www.co.norman.mn.us/
MN	Olmsted	https://publicaccess.co.olmsted.mn.us/Datalets/
MN	Ottertail	http://ottertail.visualgov.com/
MN	Pennington	https://publicsearch.co.pennington.mn.us/search/commonsearch.aspx?mode=parid
MN	Pine	http://beacon.schneidercorp.com/
MN	Polk	https://mn-polk-treasurer.publicaccessnow.com/TaxSearch.aspx
MN	Pope	https://tax.cptmn.us/PTaxPortal/#/parcelSearch/Pope
MN	Ramsey	https://beacon.schneidercorp.com/application.aspx?app=RamseyCountyMN&PageType=Search
MN	Renville	https://www.renvillecountymn.gov/
MN	Rice	https://beacon.schneidercorp.com/
MN	Rock	https://www.co.rock.mn.us/
MN	Roseau	http://mn-roseau-treasurer.publicaccessnow.com/
MN	Scott	https://www.scottcountymn.gov/
MN	Steele	http://cpuimei.com/tax/
MN	Stevens	https://www.stevenscountymn.gov/
MN	Todd	https://www.toddcountymn.gov/
MN	Traverse	https://www.traversecountymn.gov/
MN	Wadena	https://tax.cptmn.us/PTaxPortal/#/parcelSearch/Wadena
MN	Washington	https://www.washingtoncountymn.gov/
MN	Wilkin	https://www.co.wilkin.mn.us/
MN	Winona	https://www.co.winona.mn.us/
MO	Boone	http://www.showmeboone.com/collector/
MO	Buchanan	https://buchananmo.devnetwedge.com/
MO	Callaway	http://www.callawaycollector.com/
MO	Cass	http://www.casscountycollector.com/
MO	Cole	https://colemo.devnetwedge.com/
MO	Crawford	http://crawfordmo.devnetwedge.com/
MO	Dade	https://dadecountycollector.org/
MO	Dent	http://dentmo.taxnet.us/
MO	Gladstone City	https://www.gladstone.mo.us/
MO	Greene	https://www.greenecountymo.org/
MO	Jackson	https://mo-jackson.publicaccessnow.com/Collector/TaxSearch.aspx
MO	Laclede	http://lacledecollector.com/details/
MO	Nodaway	https://billpay.forte.net/NodawayMOTax/
MO	Pettis	http://pettismo.devnetwedge.com/
MO	Phelps	https://www.phelpscountycollector.com/
MO	Pike	http://beacon.schneidercorp.com/
MO	Scott	https://www.scottcocollector.com/
MO	St Charles	http://collector.sccmo.org/ecollector/Tabs/RealEstateSearch/
MO	St Louis	https://taxpayments.stlouiscountymo.gov/
MO	St Louis City	https://www.stlouis-mo.gov/data/address-search/
MO	Warren	https://billpay.forte.net/WARRENCOMOCOLLECTOR/api/
MS	Alcorn	http://www.deltacomputersystems.com/MS/MS02/
MS	Clarke	http://www.deltacomputersystems.com/MS/MS12/
MS	Clay	https://cs.datasysmgt.com/
MS	Forrest	http://www.deltacomputersystems.com/MS/MS18/
MS	George	http://www.deltacomputersystems.com/MS/MS20/
MS	Greene	http://www.deltacomputersystems.com/MS/MS21/
MS	Hancock	https://www.pay1stop.com/PropTaxView/
MS	Harrison	http://www.deltacomputersystems.com/cgi-lrm5/lrmcgi01?HTMCNTY=MS24
MS	Hinds	http://www.co.hinds.ms.us/pgs/apps/
MS	Jackson	https://co-jackson-ms-taxpayments.us/payTaxes.html#/WildfireSearch
MS	Lafayette	http://www.deltacomputersystems.com/MS/MS36/
MS	Lamar	http://www.deltacomputersystems.com/MS/MS37/
MS	Lauderdale	http://www.deltacomputersystems.com/MS/MS38/
MS	Lee	http://www.deltacomputersystems.com/MS/MS41/
MS	Lowndes	http://www.deltacomputersystems.com/MS/MS44/
MS	Madison	https://www.pay1stop.com/PropTax/
MS	Madison Step One Only	https://madison.ibcpayments.com/
MS	Marshall	http://www.deltacomputersystems.com/MS/MS47/
MS	Neshoba	http://www.deltacomputersystems.com/MS/MS50/
MS	Pearl River	http://www.deltacomputersystems.com/MS/MS55/
MS	Perry	http://www.deltacomputersystems.com/MS/MS56/
MS	Pike	http://www.deltacomputersystems.com/MS/MS57/
MS	Rankin	https://www2.rankincounty.org/TA/
MS	Scott	http://www.deltacomputersystems.com/MS/MS62/
MS	Stone	http://www.deltacomputersystems.com/MS/MS66/
MS	Union	http://www.deltacomputersystems.com/MS/MS73/
MS	Warren	http://www.deltacomputersystems.com/MS/MS75/
MS	Washington	http://www.deltacomputersystems.com/MS/MS76/
MS	Wayne	http://www.deltacomputersystems.com/MS/MS77/
MT	Cascade	http://itax.tylertech.com/cascademt/
MT	Glacier	https://glaciercountymt.gov/departments/treasurer/
MT	Lake	http://www.mtcounty.com/bmsrdl/
MT	Missoula	https://itax.missoulacounty.us/itax/
MT	Ravalli	http://www.mtcounty.com/bmsrdl/
MT	Sanders	http://www.mtcounty.com/bmsrdl/
NC	Alexander	http://alexander.ustaxdata.com/
NC	Anson	https://www.bttaxpayerportal.com/ITSPublicAN/TaxBillSearch
NC	Avery	https://secure.webtaxpay.com/?county=avery&state=NC
NC	Bertie	https://d1ebsyxxbc7tep.cloudfront.net/
NC	Bladen	https://bladen.ustaxdata.com/TaxSearch.cfm
NC	Buncombe	http://www.buncombetax.org/
NC	Burlington City	https://www.burlingtonnctax.com/#/WildfireSearch
NC	Cabarrus	http://tax.cabarruscounty.us/
NC	Carteret	http://carteretcountytax.com/
NC	Cumberland	https://taxpwa.co.cumberland.nc.us/publicwebaccess/
NC	Currituck	http://currituck.munisselfservice.com/citizens/RealEstate/
NC	Dare	https://darenctax.munisselfservice.com/
NC	Durham	http://www.ustaxdata.com/nc/durham/
NC	Forsyth	https://bcpwa.ncptscloud.com/forsythtax/
NC	Gaston	https://gastonnc.devnetwedge.com/
NC	Guilford	https://bcpwa.ncptscloud.com/guilfordtax/
NC	Henderson	https://lrcpwa.ncptscloud.com/Henderson/
NC	Hoke	https://hokecountytaxes.munisselfservice.com/citizens/RealEstate/
NC	Hudson Town	https://hudsonnc.mygovhub.com/#/quickpay
NC	Indian Trail Town	https://wipp.edmundsassoc.com/Wipp600/
NC	Iredell	https://www.co.iredell.nc.us/
NC	Jackson	https://d1ebsyxxbc7tep.cloudfront.net/
NC	Johnston	https://my.johnstonnc.gov/service/johnston_county_property_tax
NC	Lee	https://leecountync.munisselfservice.com/citizens/RealEstate/
NC	Lenoir City	https://lenoirnc.mygovhub.com/#/quickpay
NC	Lincoln	https://www.lincolncountytax.com/
NC	Macon	https://tax.maconnc.org/ITSPublicMA/TaxBillSearch
NC	Mecklenburg	http://taxbill.co.mecklenburg.nc.us/publicwebaccess/
NC	Mitchell	http://mitchell.webtaxpay.com/
NC	Nash	https://nashcountync.munisselfservice.com/
NC	New Hanover	https://mss.nhcgov.com/
NC	Oak Island Town	https://www.municipalonlinepayments.com/OAKISLANDNC/tax/
NC	Orange	http://web.co.orange.nc.us/PublicWebAccess/
NC	Polk	http://cms.revize.com/revize/apps/polkcounty/
NC	Randolph	https://txpwa.randolphcountync.gov/publicwebaccess/
NC	Robeson	http://www.ustaxdata.com/nc/robeson/
NC	Rocky Mount City	https://rockymountnc.munisselfservice.com/css/citizens/RealEstate/Default.aspx?mode=new
NC	Rowan	http://rowan.ustaxdata.com/
NC	Stokes	http://www.stokescountytax.com/taxes/
NC	Surf City	https://wipp.edmundsgovtech.cloud/home?wippId=SURF
NC	Tarboro Town	https://wipp.edmundsassoc.com/WippTARB/
NC	Transylvania	https://tax.transylvaniacounty.org/TaxBillSearch
NC	Vance	http://vance.ustaxdata.com/
NC	Wake	https://services.wake.gov/realestate/
NC	Waynesville	https://waynesville.munisselfservice.com/citizens/RealEstate/Default.aspx?mode=n
ND	Barnes	http://www.co.stutsman.nd.us/Tax/
ND	Dunn	http://www.co.stutsman.nd.us/Tax/
ND	La Moure	http://www.co.stutsman.nd.us/Tax/
ND	Mc Kenzie	http://www.co.stutsman.nd.us/Tax/
ND	Morton	http://www.co.stutsman.nd.us/Tax/
ND	Mountrail	http://www.co.stutsman.nd.us/Tax/
ND	Pembina	http://www.co.stutsman.nd.us/Tax/
ND	Ransom	http://www.co.stutsman.nd.us/Tax/
ND	Sargent	http://www.co.stutsman.nd.us/Tax/
ND	Stutsman	http://www.co.stutsman.nd.us/Tax/
ND	Ward	https://itax.tylertech.com/wardnd/
ND	Williams	https://www.williamsnd.com/
NE	Adams	http://www.nebraskataxesonline.us/
NE	Boone	http://www.nebraskataxesonline.us/
NE	Box Butte	http://www.nebraskataxesonline.us/
NE	Buffalo	http://www.nebraskataxesonline.us/
NE	Burt	http://www.nebraskataxesonline.us/
NE	Butler	https://butler.gisworkshop.com/
NE	Cass	http://www.nebraskataxesonline.us/
NE	Cedar	http://www.nebraskataxesonline.us/
NE	Chase	http://www.nebraskataxesonline.us/
NE	Clay	http://www.nebraskataxesonline.us/
NE	Colfax	http://www.nebraskataxesonline.us/
NE	Cuming	http://www.nebraskataxesonline.us/
NE	Dawes	http://www.nebraskataxesonline.us/
NE	Dawson	http://www.nebraskataxesonline.us/
NE	Deuel	http://www.nebraskataxesonline.us/
NE	Dixon	http://www.nebraskataxesonline.us/
NE	Douglas	https://treasurer.douglascounty-ne.gov/property-tax-lookup/property-tax-records/
NE	Dundy	http://www.nebraskataxesonline.us/
NE	Fillmore	http://www.nebraskataxesonline.us/
NE	Franklin	http://www.nebraskataxesonline.us/
NE	Frontier	http://www.nebraskataxesonline.us/
NE	Furnas	http://www.nebraskataxesonline.us/
NE	Gage	http://www.nebraskataxesonline.us/
NE	Garden	http://www.nebraskataxesonline.us/
NE	Gosper	http://www.nebraskataxesonline.us/
NE	Greeley	http://www.nebraskataxesonline.us/
NE	Hamilton	http://www.nebraskataxesonline.us/
NE	Hitchcock	http://www.nebraskataxesonline.us/
NE	Holt	http://www.nebraskataxesonline.us/
NE	Jefferson	http://www.nebraskataxesonline.us/
NE	Johnson	http://www.nebraskataxesonline.us/
NE	Keith	http://www.nebraskataxesonline.us/
NE	Kimball	http://www.nebraskataxesonline.us/
NE	Knox	http://www.nebraskataxesonline.us/
NE	Lincoln	http://www.nebraskataxesonline.us/
NE	Madison	http://www.nebraskataxesonline.us/
NE	Merrick	http://www.nebraskataxesonline.us/
NE	Morrill	http://www.nebraskataxesonline.us/
NE	Nance	http://www.nebraskataxesonline.us/
NE	Nemaha	http://www.nebraskataxesonline.us/
NE	Otoe	http://www.nebraskataxesonline.us/
NE	Pawnee	http://www.nebraskataxesonline.us/
NE	Perkins	http://www.nebraskataxesonline.us/
NE	Phelps	http://www.nebraskataxesonline.us/
NE	Platte	http://www.nebraskataxesonline.us/
NE	Red Willow	http://www.nebraskataxesonline.us/
NE	Saline	http://www.nebraskataxesonline.us/
NE	Saunders	http://www.nebraskataxesonline.us/
NE	Scotts Bluff	http://www.nebraskataxesonline.us/
NE	Seward	http://www.nebraskataxesonline.us/
NE	Stanton	http://www.nebraskataxesonline.us/
NE	Thayer	http://www.nebraskataxesonline.us/
NE	Thurston	http://www.nebraskataxesonline.us/
NE	Wayne	http://www.nebraskataxesonline.us/
NE	Webster	http://www.nebraskataxesonline.us/
NE	Wheeler	http://www.nebraskataxesonline.us/
NH	Andover Town	http://www.nhtaxkiosk.com/
NH	Boscawen Town	http://www.nhtaxkiosk.com/
NH	Bristol Town	http://www.nhtaxkiosk.com/
NH	Danville Town	http://www.nhtaxkiosk.com/
NH	Deering Town	http://www.nhtaxkiosk.com/
NH	Effingham Town	http://www.nhtaxkiosk.com/
NH	Epsom Town	http://www.nhtaxkiosk.com/
NH	Fitzwilliam Town	http://www.nhtaxkiosk.com/
NH	Hampstead Town	http://www.nhtaxkiosk.com/
NH	Lempster Town	http://www.nhtaxkiosk.com/
NH	Loudon Town	http://www.nhtaxkiosk.com/
NH	Madison Town	http://www.nhtaxkiosk.com/
NH	Merrimack Town	http://www.nhtaxkiosk.com/
NH	Middleton Town	http://www.nhtaxkiosk.com/
NH	New Boston Town	http://www.nhtaxkiosk.com/
NH	Newbury Town	https://www.eb2gov.com/
NH	New Ipswich Town	http://www.nhtaxkiosk.com/
NH	Northfield Town	http://www.nhtaxkiosk.com/
NH	North Hampton Town	http://www.nhtaxkiosk.com/
NH	Stratham Town	http://www.nhtaxkiosk.com/
NH	Tilton Town	http://www.nhtaxkiosk.com/
NH	Tuftonboro Town	http://www.nhtaxkiosk.com/
NH	Walpole Town	http://www.nhtaxkiosk.com/
NH	Washington Town	http://www.nhtaxkiosk.com/
NH	Weare Town	http://www.nhtaxkiosk.com/
NH	Webster Town	http://www.nhtaxkiosk.com/
NH	Wentworth Town	http://www.nhtaxkiosk.com/
NJ	Aberdeen Twp	https://lots.signatureinfo.com/
NJ	Absecon City	https://lots.signatureinfo.com/
NJ	Allendale Boro	https://lots.signatureinfo.com/
NJ	Alloway Twp	https://lots.signatureinfo.com/
NJ	Alpha Boro	https://lots.signatureinfo.com/
NJ	Alpine Boro	https://lots.signatureinfo.com/
NJ	Andover Twp	https://lots.signatureinfo.com/
NJ	Asbury Park City	https://lots.signatureinfo.com/
NJ	Atlantic City	https://lots.signatureinfo.com/
NJ	Atlantic Highlands Boro	https://lots.signatureinfo.com/
NJ	Audubon Boro	https://lots.signatureinfo.com/
NJ	Avalon Boro	https://lots.signatureinfo.com/
NJ	Avonbythesea Boro	https://lots.signatureinfo.com/
NJ	Barnegat Light Boro	https://lots.signatureinfo.com/
NJ	Barnegat Twp	https://lots.signatureinfo.com/
NJ	Barrington Boro	https://lots.signatureinfo.com/
NJ	Bay Head Boro	https://lots.signatureinfo.com/
NJ	Beachwood Boro	https://lots.signatureinfo.com/
NJ	Belleville Twp	https://lots.signatureinfo.com/
NJ	Bellmawr Boro	https://lots.signatureinfo.com/
NJ	Belmar Boro	https://lots.signatureinfo.com/
NJ	Bergenfield Boro	https://lots.signatureinfo.com/
NJ	Berkeley Heights Twp	https://lots.signatureinfo.com/
NJ	Berlin Boro	https://lots.signatureinfo.com/
NJ	Bernards Twp	https://lots.signatureinfo.com/
NJ	Bloomfield Twp	https://lots.signatureinfo.com/
NJ	Bloomingdale Boro	https://lots.signatureinfo.com/
NJ	Boonton Town	https://lots.signatureinfo.com/
NJ	Bordentown Twp	https://lots.signatureinfo.com/
NJ	Bradley Beach Boro	https://lots.signatureinfo.com/
NJ	Branchburg Twp	https://lots.signatureinfo.com/
NJ	Brick	https://apps.hlssystems.com/Brick/PropertyTaxInquiry/
NJ	Brielle Boro	https://lots.signatureinfo.com/
NJ	Brigantine City	https://lots.signatureinfo.com/
NJ	Brooklawn Boro	https://lots.signatureinfo.com/
NJ	Buena Boro	https://lots.signatureinfo.com/
NJ	Buena Vista Twp	https://lots.signatureinfo.com/
NJ	Burlington City	https://lots.signatureinfo.com/
NJ	Butler Boro	https://lots.signatureinfo.com/
NJ	Caldwell Borough Twp	https://lots.signatureinfo.com/
NJ	Camden City	https://lots.signatureinfo.com/
NJ	Cape May City	https://lots.signatureinfo.com/
NJ	Cape May Point Boro	https://lots.signatureinfo.com/
NJ	Carlstadt Boro	https://lots.signatureinfo.com/
NJ	Carneys Point Twp	https://lots.signatureinfo.com/
NJ	Carteret Boro	https://lots.signatureinfo.com/
NJ	Chatham Boro	https://lots.signatureinfo.com/
NJ	Chesilhurst Boro	https://lots.signatureinfo.com/
NJ	Chesterfield Twp	https://lots.signatureinfo.com/
NJ	Chester Twp	https://lots.signatureinfo.com/
NJ	Clayton Boro	https://lots.signatureinfo.com/
NJ	Clementon Boro	https://lots.signatureinfo.com/
NJ	Collingswood Boro	https://lots.signatureinfo.com/
NJ	Commercial Twp	https://lots.signatureinfo.com/
NJ	Cresskill Boro	https://lots.signatureinfo.com/
NJ	Deal Boro	https://lots.signatureinfo.com/
NJ	Deerfield Twp	https://lots.signatureinfo.com/
NJ	Delanco Twp	https://lots.signatureinfo.com/
NJ	Delran Twp	https://lots.signatureinfo.com/
NJ	Dennis Twp	https://lots.signatureinfo.com/
NJ	Dover Town	https://lots.signatureinfo.com/
NJ	Dumont Boro	https://lots.signatureinfo.com/
NJ	Eagleswood Twp	https://lots.signatureinfo.com/
NJ	Eastampton Twp	https://lots.signatureinfo.com/
NJ	East Hanover Twp	https://lots.signatureinfo.com/
NJ	East Windsor Twp	https://lots.signatureinfo.com/
NJ	Eatontown Boro	https://lots.signatureinfo.com/
NJ	Edgewater Park Twp	https://lots.signatureinfo.com/
NJ	Egg Harbor Twp	https://lots.signatureinfo.com/
NJ	Elizabeth City	https://lots.signatureinfo.com/
NJ	Elk Twp	https://lots.signatureinfo.com/
NJ	Elmwood Park Boro	https://lots.signatureinfo.com/
NJ	Emerson Boro	https://lots.signatureinfo.com/
NJ	Englishtown Boro	https://lots.signatureinfo.com/
NJ	Estell Manor City	https://lots.signatureinfo.com/
NJ	Evesham Twp	https://lots.signatureinfo.com/
NJ	Fairfield Twp	https://lots.signatureinfo.com/
NJ	Fair Haven Boro	https://lots.signatureinfo.com/
NJ	Fair Lawn Boro	https://lots.signatureinfo.com/
NJ	Fairview Boro	https://lots.signatureinfo.com/
NJ	Far Hills Boro	https://lots.signatureinfo.com/
NJ	Farmingdale Boro	https://lots.signatureinfo.com/
NJ	Florham Park Boro	https://lots.signatureinfo.com/
NJ	Folsom Boro	https://lots.signatureinfo.com/
NJ	Franklin Lakes Boro	https://lots.signatureinfo.com/
NJ	Franklin Twp	https://lots.signatureinfo.com/
NJ	Freehold Boro	https://lots.signatureinfo.com/
NJ	Freehold Twp	https://lots.signatureinfo.com/
NJ	Galloway Twp	https://lots.signatureinfo.com/
NJ	Gibbsboro Boro	https://lots.signatureinfo.com/
NJ	Glassboro Boro	https://lots.signatureinfo.com/
NJ	Glen Ridge Borough Twp	https://lots.signatureinfo.com/
NJ	Gloucester Township	https://wipp.edmundsassoc.com/Wipp/?wippid=Gloucestertownship
NJ	Greenwich Twp	https://lots.signatureinfo.com/
NJ	Hackensack City	https://lots.signatureinfo.com/
NJ	Hackettstown Town	https://lots.signatureinfo.com/
NJ	Haddonfield Boro	https://lots.signatureinfo.com/
NJ	Haddon Heights Boro	https://lots.signatureinfo.com/
NJ	Haledon Boro	https://lots.signatureinfo.com/
NJ	Hamilton Township	https://wipp.edmundsassoc.com/Wipp/?wippid=Hamiltontownship
NJ	Hamilton Twp	https://lots.signatureinfo.com/
NJ	Hammonton Town	https://lots.signatureinfo.com/
NJ	Harrison Twp	https://lots.signatureinfo.com/
NJ	Harvey Cedars Boro	https://lots.signatureinfo.com/
NJ	Haworth Boro	https://lots.signatureinfo.com/
NJ	Hazlet Twp	https://lots.signatureinfo.com/
NJ	Helmetta Boro	https://lots.signatureinfo.com/
NJ	Highland Park Boro	https://lots.signatureinfo.com/
NJ	Highlands Boro	https://wipp.edmundsassoc.com/Wipp/?wippid=1319
NJ	Hightstown Boro	https://lots.signatureinfo.com/
NJ	Hillsborough Twp	https://lots.signatureinfo.com/
NJ	Hillsdale Boro	https://lots.signatureinfo.com/
NJ	Holmdel Twp	https://lots.signatureinfo.com/
NJ	Hopatcong Boro	https://lots.signatureinfo.com/
NJ	Howell Twp	https://lots.signatureinfo.com/
NJ	Interlaken Boro	https://lots.signatureinfo.com/
NJ	Irvington Twp	https://lots.signatureinfo.com/
NJ	Island Heights Boro	https://lots.signatureinfo.com/
NJ	Jamesburg Boro	https://lots.signatureinfo.com/
NJ	Jefferson Twp	https://lots.signatureinfo.com/
NJ	Keansburg Boro	https://lots.signatureinfo.com/
NJ	Kenilworth Boro	https://lots.signatureinfo.com/
NJ	Keyport Boro	https://lots.signatureinfo.com/
NJ	Kinnelon Boro	https://lots.signatureinfo.com/
NJ	Lake Como Boro	https://lots.signatureinfo.com/
NJ	Lakehurst Boro	https://lots.signatureinfo.com/
NJ	Lakewood Twp	https://lots.signatureinfo.com/
NJ	Laurel Springs Boro	https://lots.signatureinfo.com/
NJ	Lavallette Boro	https://lots.signatureinfo.com/
NJ	Lawnside Boro	https://lots.signatureinfo.com/
NJ	Lawrence Twp	https://lots.signatureinfo.com/
NJ	Leonia Boro	https://lots.signatureinfo.com/
NJ	Lincoln Park Boro	https://lots.signatureinfo.com/
NJ	Linden City	https://lots.signatureinfo.com/
NJ	Lindenwold Boro	https://lots.signatureinfo.com/
NJ	Linwood City	https://lots.signatureinfo.com/
NJ	Little Ferry Boro	https://lots.signatureinfo.com/
NJ	Little Silver Boro	https://lots.signatureinfo.com/
NJ	Livingston Twp	https://lots.signatureinfo.com/
NJ	Loch Arbour Village	https://lots.signatureinfo.com/
NJ	Logan Twp	https://lots.signatureinfo.com/
NJ	Long Beach Twp	https://lots.signatureinfo.com/
NJ	Longport Boro	https://lots.signatureinfo.com/
NJ	Lower Alloways Creek Twp	https://lots.signatureinfo.com/
NJ	Lower Twp	https://lots.signatureinfo.com/
NJ	Madison Boro	https://lots.signatureinfo.com/
NJ	Magnolia Boro	https://lots.signatureinfo.com/
NJ	Manasquan Boro	https://lots.signatureinfo.com/
NJ	Mannington Twp	https://lots.signatureinfo.com/
NJ	Mansfield Twp	https://lots.signatureinfo.com/
NJ	Mantoloking Boro	https://lots.signatureinfo.com/
NJ	Mantua Twp	https://lots.signatureinfo.com/
NJ	Manville Boro	https://lots.signatureinfo.com/
NJ	Maplewood Twp	https://lots.signatureinfo.com/
NJ	Matawan Boro	https://lots.signatureinfo.com/
NJ	Maurice River Twp	https://lots.signatureinfo.com/
NJ	Medford Lakes Boro	https://lots.signatureinfo.com/
NJ	Mendham Twp	https://lots.signatureinfo.com/
NJ	Merchantville Boro	https://lots.signatureinfo.com/
NJ	Metuchen Boro	https://lots.signatureinfo.com/
NJ	Middletown Twp	https://lots.signatureinfo.com/
NJ	Middle Twp	https://lots.signatureinfo.com/
NJ	Midland Park Boro	https://lots.signatureinfo.com/
NJ	Millburn Twp	https://lots.signatureinfo.com/
NJ	Millstone Twp	https://lots.signatureinfo.com/
NJ	Milltown Boro	https://lots.signatureinfo.com/
NJ	Millville City	https://lots.signatureinfo.com/
NJ	Monroe Twp	https://lots.signatureinfo.com/
NJ	Montclair Twp	https://lots.signatureinfo.com/
NJ	Montvale Boro	https://lots.signatureinfo.com/
NJ	Montville Twp	https://lots.signatureinfo.com/
NJ	Morristown Town	https://lots.signatureinfo.com/
NJ	Morris Twp	https://lots.signatureinfo.com/
NJ	Mountainside Boro	https://lots.signatureinfo.com/
NJ	Mount Arlington Boro	https://lots.signatureinfo.com/
NJ	Mount Ephraim Boro	https://lots.signatureinfo.com/
NJ	Mount Laurel Twp	https://lots.signatureinfo.com/
NJ	Mount Olive Twp	https://lots.signatureinfo.com/
NJ	Mullica Twp	https://lots.signatureinfo.com/
NJ	National Park Boro	https://lots.signatureinfo.com/
NJ	Neptune City Boro	https://lots.signatureinfo.com/
NJ	Netcong Boro	https://lots.signatureinfo.com/
NJ	Newark City	https://lots.signatureinfo.com/
NJ	New Hanover Twp	https://lots.signatureinfo.com/
NJ	North Bergen Twp	https://lots.signatureinfo.com/
NJ	North Brunswick Twp	https://lots.signatureinfo.com/
NJ	North Caldwell Boro	https://lots.signatureinfo.com/
NJ	Northfield City	https://lots.signatureinfo.com/
NJ	North Haledon Boro	https://lots.signatureinfo.com/
NJ	North Hanover Twp	https://lots.signatureinfo.com/
NJ	North Plainfield Boro	https://lots.signatureinfo.com/
NJ	Oakland Boro	https://lots.signatureinfo.com/
NJ	Oaklyn Boro	https://lots.signatureinfo.com/
NJ	Ocean City	https://lots.signatureinfo.com/
NJ	Ocean Gate Boro	https://lots.signatureinfo.com/
NJ	Oceanport Boro	https://lots.signatureinfo.com/
NJ	Ocean Twp	https://lots.signatureinfo.com/
NJ	Oldmans Twp	https://lots.signatureinfo.com/
NJ	Old Tappan Boro	https://lots.signatureinfo.com/
NJ	Oradell Boro	https://lots.signatureinfo.com/
NJ	Paramus Boro	https://lots.signatureinfo.com/
NJ	Park Ridge Boro	https://lots.signatureinfo.com/
NJ	Parsippanytroy Hills Twp	https://lots.signatureinfo.com/
NJ	Passaic City	https://lots.signatureinfo.com/
NJ	Paterson City	https://wipp.edmundsassoc.com/Wipp/
NJ	Peapack Gladstone Boro	https://lots.signatureinfo.com/
NJ	Pemberton Twp	https://wipp.edmundsassoc.com/Wipp/?wippid=0329
NJ	Pennsauken Twp	https://lots.signatureinfo.com/
NJ	Penns Grove Boro	https://lots.signatureinfo.com/
NJ	Pennsville Twp	https://lots.signatureinfo.com/
NJ	Perth Amboy City	https://lots.signatureinfo.com/
NJ	Pilesgrove Twp	https://lots.signatureinfo.com/
NJ	Pine Beach Boro	https://lots.signatureinfo.com/
NJ	Pine Hill Boro	https://lots.signatureinfo.com/
NJ	Pitman Boro	https://lots.signatureinfo.com/
NJ	Pittsgrove Twp	https://lots.signatureinfo.com/
NJ	Pleasantville City	https://lots.signatureinfo.com/
NJ	Plumsted Twp	https://lots.signatureinfo.com/
NJ	Point Pleasant Beach Boro	https://lots.signatureinfo.com/
NJ	Port Republic City	https://lots.signatureinfo.com/
NJ	Prospect Park Boro	https://lots.signatureinfo.com/
NJ	Quinton Twp	https://lots.signatureinfo.com/
NJ	Rahway City	https://lots.signatureinfo.com/
NJ	Raritan Boro	https://lots.signatureinfo.com/
NJ	Red Bank Boro	https://lots.signatureinfo.com/
NJ	Ridgewood Village	https://lots.signatureinfo.com/
NJ	Riverdale Boro	https://lots.signatureinfo.com/
NJ	Riverton Boro	https://lots.signatureinfo.com/
NJ	River Vale Twp	https://lots.signatureinfo.com/
NJ	Robbinsville Twp	https://lots.signatureinfo.com/
NJ	Roseland Boro	https://lots.signatureinfo.com/
NJ	Roxbury Twp	https://lots.signatureinfo.com/
NJ	Rumson Boro	https://lots.signatureinfo.com/
NJ	Runnemede Boro	https://lots.signatureinfo.com/
NJ	Rutherford Boro	https://lots.signatureinfo.com/
NJ	Salem City	https://lots.signatureinfo.com/
NJ	Sea Bright Boro	https://lots.signatureinfo.com/
NJ	Sea Girt Boro	https://lots.signatureinfo.com/
NJ	Sea Isle City	https://lots.signatureinfo.com/
NJ	Seaside Park Boro	https://lots.signatureinfo.com/
NJ	Shrewsbury Boro	https://lots.signatureinfo.com/
NJ	Shrewsbury Twp	https://lots.signatureinfo.com/
NJ	Somerdale Boro	https://lots.signatureinfo.com/
NJ	Somers Point City	https://lots.signatureinfo.com/
NJ	South Amboy City	https://lots.signatureinfo.com/
NJ	Southampton Twp	https://lots.signatureinfo.com/
NJ	South Bound Brook Boro	https://lots.signatureinfo.com/
NJ	South Brunswick Twp	https://lots.signatureinfo.com/
NJ	South Hackensack Twp	https://lots.signatureinfo.com/
NJ	South Harrison Twp	https://lots.signatureinfo.com/
NJ	South Plainfield Boro	https://lots.signatureinfo.com/
NJ	South River Boro	https://lots.signatureinfo.com/
NJ	South Toms River Boro	https://lots.signatureinfo.com/
NJ	Sparta Twp	https://lots.signatureinfo.com/
NJ	Spotswood Boro	https://lots.signatureinfo.com/
NJ	Springfield Twp	https://lots.signatureinfo.com/
NJ	Stockton Boro	https://lots.signatureinfo.com/
NJ	Stratford Boro	https://lots.signatureinfo.com/
NJ	Surf City Boro	https://lots.signatureinfo.com/
NJ	Swedesboro Boro	https://lots.signatureinfo.com/
NJ	Tabernacle Twp	https://lots.signatureinfo.com/
NJ	Toms River Township	https://wipp.edmundsassoc.com/Wipp/
NJ	Totowa Boro	https://lots.signatureinfo.com/
NJ	Tuckerton Boro	https://lots.signatureinfo.com/
NJ	Union Beach Boro	https://lots.signatureinfo.com/
NJ	Union Twp	https://lots.signatureinfo.com/
NJ	Upper Deerfield Twp	https://lots.signatureinfo.com/
NJ	Upper Freehold Twp	https://lots.signatureinfo.com/
NJ	Upper Twp	https://lots.signatureinfo.com/
NJ	Ventnor City	https://lots.signatureinfo.com/
NJ	Verona Twp	https://lots.signatureinfo.com/
NJ	Vineland City	https://lots.signatureinfo.com/
NJ	Voorhees Twp	https://lots.signatureinfo.com/
NJ	Waldwick Boro	https://lots.signatureinfo.com/
NJ	Wall Twp	https://lots.signatureinfo.com/
NJ	Wanaque Boro	https://lots.signatureinfo.com/
NJ	Washington Boro	https://lots.signatureinfo.com/
NJ	Washington Township	http://wipp.edmundsassoc.com/Wipp0818/
NJ	Washington Twp	https://lots.signatureinfo.com/
NJ	Waterford Twp	https://lots.signatureinfo.com/
NJ	Wayne Twp	https://lots.signatureinfo.com/
NJ	Wenonah Boro	https://lots.signatureinfo.com/
NJ	Westampton Twp	https://lots.signatureinfo.com/
NJ	West Caldwell Twp	https://lots.signatureinfo.com/
NJ	West Cape May Boro	https://lots.signatureinfo.com/
NJ	Westfield Town	https://lots.signatureinfo.com/
NJ	West Orange Twp	https://lots.signatureinfo.com/
NJ	Westville Boro	https://lots.signatureinfo.com/
NJ	West Wildwood Boro	https://lots.signatureinfo.com/
NJ	Westwood Boro	https://lots.signatureinfo.com/
NJ	Weymouth Twp	https://lots.signatureinfo.com/
NJ	Wharton Boro	https://lots.signatureinfo.com/
NJ	Wildwood City	https://lots.signatureinfo.com/
NJ	Wildwood Crest Boro	https://lots.signatureinfo.com/
NJ	Winslow Twp	https://lots.signatureinfo.com/
NJ	Woodbine Boro	https://lots.signatureinfo.com/
NJ	Woodbridge Twp	https://lots.signatureinfo.com/
NJ	Woodbury Heights Boro	https://lots.signatureinfo.com/
NJ	Woodcliff Lake Boro	https://lots.signatureinfo.com/
NJ	Woodland Park Boro	https://lots.signatureinfo.com/
NJ	Woodridge Boro	https://lots.signatureinfo.com/
NJ	Woolwich Twp	https://lots.signatureinfo.com/
NJ	Wrightstown Boro	https://lots.signatureinfo.com/
NJ	Wyckoff Twp	https://lots.signatureinfo.com/
NM	Bernalillo	https://www.bernco.gov/
NM	Dona Ana	http://treasurer.donaanacounty.org/treasurer/treasurerweb/
NM	Sandoval	https://etweb.sandovalcountynm.gov/Treasurer/treasurerweb/
NM	Santa Fe	http://www.workplace.com/
NV	Clark	https://www.clarkcountynv.gov/
NY	Albany City	https://magic.collectorsolutions.com/magic-ui/OneTimePayment/albany-ny
NY	Albany City School	http://tax.neric.org/
NY	Amherst Town	https://www.amherst.ny.us/
NY	Aurelius Town	http://www.taxlookup.net/
NY	Binghamton Town	http://www.taxlookup.net/
NY	Brasher Town	http://www.taxlookup.net/
NY	Bronx Boro	http://nycserv.nyc.gov/NYCServWeb/
NY	Brooklyn Boro	http://nycserv.nyc.gov/NYCServWeb/
NY	Buffalo City	https://pay.buffalony.gov/form/property-tax
NY	Buffalo City Sewer	https://pay.buffalony.gov/form/property-tax
NY	Canton Town	http://www.taxlookup.net/
NY	Chautauqua	https://app.co.chautauqua.ny.us/cctaxonline/
NY	Chenango Town	http://www.taxlookup.net/
NY	Cherry Valley Town	http://www.taxlookup.net/
NY	Clifton Town	http://www.taxlookup.net/
NY	Clinton	https://www.clintoncountygov.com/
NY	Colton Town	http://www.taxlookup.net/
NY	Columbia	http://www.totalcollectionsolution.com/Entity/show/id/
NY	Conklin Town	http://www.taxlookup.net/
NY	Cortlandt School	https://www.municipaltaxpayments.com/
NY	Cortlandt Town	https://www.municipaltaxpayments.com/
NY	De Kalb Town	http://www.taxlookup.net/
NY	Delaware Town	http://www.taxlookup.net/
NY	Dickinson Town	http://www.taxlookup.net/
NY	Duanesburg Town	https://egov.basgov.com/duanesburg/
NY	East Chester School	https://www.cit-e.net/eastchester-ny/Cit-e-Access/TaxBill/
NY	East Chester Town	https://www.cit-e.net/eastchester-ny/Cit-e-Access/TaxBill/
NY	East Fishkill Town	http://www.taxlookup.net/
NY	Ellenburg Town	http://www.taxlookup.net/
NY	Erie	https://paytax.erie.gov/webprop/
NY	Essex	http://www.co.essex.ny.us/Treasurer/
NY	Exeter Town	http://www.taxlookup.net/
NY	Fallsburg Town	http://www.taxlookup.net/
NY	Fenton Town	http://www.taxlookup.net/
NY	Fine Town	http://www.taxlookup.net/
NY	Glenville Town	https://egov.basgov.com/glenville/
NY	Gouverneur Town	http://www.taxlookup.net/
NY	Greene	http://ny.greenecounty.totalcollectionsolution.com/
NY	Guilderland Town	http://www.taxlookup.net/
NY	Hasting On Hudson Village	https://hastingsonhudsonny.municipalonlinepayments.com/
NY	Hempstead School	http://mylocalgov.com/hempsteadny/
NY	Hempstead Town	http://mylocalgov.com/hempsteadny/
NY	Kirkwood Town	http://www.taxlookup.net/
NY	Lewisboro School	https://www.municipaltaxpayments.com/
NY	Lewisboro Town	https://www.municipaltaxpayments.com/
NY	Liberty Town	http://www.taxlookup.net/
NY	Louisville Town	http://www.taxlookup.net/
NY	Madrid Town	http://www.taxlookup.net/
NY	Maine Town	http://www.taxlookup.net/
NY	Mamakating Town	http://www.taxlookup.net/
NY	Mamaroneck Village	https://www.invoicecloud.com/portal/
NY	Manhattan Boro	http://nycserv.nyc.gov/NYCServWeb/
NY	Mastic Beach Village	https://www.municipaltaxpayments.com/
NY	Monroe	https://www.monroecountytax.org/monroe/tax/
NY	Mount Vernon City	https://infotaxonline.com/FindProperty.aspx?129
NY	Mount Vernon City Schools	https://www.infotaxonline.com/FindProperty.aspx
NY	Mount Vernon County	https://infotaxonline.com/FindProperty.aspx?129
NY	Mount Vernon School	https://www.infotaxonline.com/FindProperty.aspx?125
NY	New Rochelle City	https://cnr.munisselfservice.com/citizens/RealEstate/
NY	New Rochelle School	https://cnr.munisselfservice.com/citizens/RealEstate/
NY	New York City	http://nycserv.nyc.gov/NYCServWeb/
NY	New York City DEP	https://a826-umax.dep.nyc.gov/balance
NY	Niskayuna Town	http://WWW.totalcollectionsolution.com/
NY	North Castle School	https://www.municipaltaxpayments.com/
NY	North Castle Town	https://www.municipaltaxpayments.com/
NY	Onondaga	http://ocfintax.ongov.net/Imate/
NY	Orange	http://propertydata.orangecountygov.com/imate/
NY	Queens Boro	http://nycserv.nyc.gov/NYCServWeb/
NY	Rensselaer	http://ny.rensselaercounty.totalcollectionsolution.com/entity
NY	Rochester City	http://geo.cityofrochester.gov/
NY	Rochester City ATF	https://www.atfs.com/
NY	Rockville Centre Village	https://rockvillecentre.municipaltaxpayments.com/
NY	Rome City	https://selfservice.romenewyork.com/MSS/citizens/RealEstate/
NY	Rome School	https://selfservice.romenewyork.com/mss/citizens/RealEstate/
NY	Rotterdam Town	http://www.totalcollectionsolution.com/
NY	Rye	https://rye.municipaltaxpayments.com/
NY	Rye City	https://rye.municipaltaxpayments.com/
NY	Rye School	https://www.infotaxonline.com/FindProperty.aspx?112
NY	Schenectady City School	http://tax.neric.org/
NY	Staten Island Boro	http://nycserv.nyc.gov/NYCServWeb/
NY	St Lawrence	http://www.taxlookup.net/stlawrence/
NY	Syracuse City	http://ocfintax.ongov.net/ImateSyr/
NY	Syracuse County	http://ocfintax.ongov.net/ImateSyr/
NY	Warren	https://public.warrencountyny.gov/vinyl/app/Property%20Taxes/Home/Property%20Taxes/Public%20Delinquent%20Bills
NY	Washington	http://www.totalcollectionsolution.com/
NY	Wayne	https://web.co.wayne.ny.us/
NY	Westchester	https://cnr.munisselfservice.com/citizens/RealEstate/
NY	White Plains	http://cwp.munisselfservice.com/citizens/RealEstate/
NY	White Plains City	https://cwp.munisselfservice.com/citizens/RealEstate/Default.aspx?mode=new
NY	Wyoming	http://wyomingcountytreasurer.com/Property/
NY	Yates	http://www.tslco.net/
NY	Yorktown School	https://www.municipaltaxpayments.com/
NY	Yorktown Town	https://www.municipaltaxpayments.com/
OH	Allen	http://allencountyohpropertytax.com/
OH	Ashtabula	http://oh-ashtabulacounty.civicplus.com/311/Treasurer
OH	Athens	https://www.athenscountyauditor.org/
OH	Butler	https://www.butlercountytreasurer.org/
OH	Carroll	https://www.carrollcountyauditor.us/Search/Number
OH	Clermont	https://www.clermontauditorrealestate.org/_web/search/commonsearch.aspx?mode=parid
OH	Clinton	https://clintoncountyauditor.org/Search/Number
OH	Coshocton	https://www.coshoctoncountytreasurer.com/Search/Number
OH	Crawford	http://realestate.crawford-co.org/re-search.php?item=Parn
OH	Cuyahoga	https://treasurer.cuyahogacounty.us/
OH	Darke	http://www.darkecountyrealestate.org/
OH	Franklin	https://treasurer.franklincountyohio.gov/
OH	Geauga	https://geaugarealink.co.geauga.oh.us/REALink/parcel/
OH	Hamilton	http://www.hamiltoncountyohio.gov/treasurer/default.asp
OH	Hancock	https://www.co.hancock.oh.us/
OH	Hardin	http://realestate.co.hardin.oh.us/
OH	Highland	http://highlandcountyauditor.org/
OH	Holmes	https://www.holmescountyauditor.org/Search/Number
OH	Huron	http://www.huroncountyauditor.org/
OH	Jackson	http://jacksoncountyauditor.org/
OH	Knox	http://knoxcountyauditor.org/
OH	Lake	https://www.lakecountyohio.gov/
OH	Lawrence	http://lawrencecountytreasurer.org/TaxDetails/
OH	Licking	https://www.lcounty.com/
OH	Logan	https://realestate.co.logan.oh.us/
OH	Lorain	https://loraincountyauditor.gov/
OH	Lucas	http://www.co.lucas.oh.us/index.aspx?nid=466
OH	Mahoning	https://auditor.mahoningcountyoh.gov/
OH	Medina	http://www.medinacountytax.com/
OH	Meigs	https://beacon.schneidercorp.com/
OH	Miami	http://www.miamicountyauditor.org/
OH	Montgomery	http://www.mctreas.org/
OH	Morgan	https://www.morgancountyauditor.org/Search/Number
OH	Ottawa	http://ottawacountytreasurer.org/
OH	Pickaway	http://picktreasurer.org/
OH	Pike	https://pikeparcelsearch.appraisalresearchcorp.com/
OH	Portage	http://portagecountyauditor.org/
OH	Preble	http://www.preblecountyauditor.org/
OH	Richland	https://www.billpayit.com/richlandcoohtax/
OH	Sandusky	http://www.sanduskycountyauditor.us/
OH	Scioto	http://oh-scioto-auditor.publicaccessnow.com/
OH	Seneca	https://senecacountytreasurer.org/Search/Account
OH	Stark	https://realestate.starkcountyohio.gov/Datalets/PrintDatalet.aspx
OH	Summit	https://fiscaloffice.summitoh.net/
OH	Tuscarawas	http://auditor.co.tuscarawas.oh.us/
OH	Van Wert	https://auditor.vanwertcountyohio.gov/
OH	Vinton	https://beacon.schneidercorp.com/
OH	Warren	https://auditor.warrencountyohio.gov/PropertySearch/Summary/Index
OH	Williams	https://realestate.williamscountyoh.gov/Search
OH	Wyandot	http://realestate.co.wyandot.oh.us/re/re-search.php?item=Parn
OK	Oklahoma	http://www.oklahomacounty.org/treasurer/
OK	Tulsa	https://oktaxrolls.com/searchTaxRoll/Tulsa/
OR	Clackamas	https://www.clackamas.us/
OR	Multnomah	http://www.multcoproptax.org/
OR	Washington	http://www.co.washington.or.us/AssessmentTaxation/
PA	Allegheny	https://realestate.alleghenycounty.us/Tax?ID={0}&SearchType=3
PA	Allegheny Court	https://dcr.alleghenycounty.us/Civil/
PA	Beaver	https://propertyrecords.beavercountypa.gov/search/commonsearch.aspx
PA	Chester Due	https://www.officialpayments.com/
PA	Chester Payments	https://payments.municipay.com/api/b9b26aee8ebf11ea94907fc00dc56f18/parcel/search
PA	Lehigh	http://apps.lehighcounty.org/
PA	Luzerne	http://nerevenue.rba.com/taxes/luzerne/
PA	Mercer	https://www.infoconcountyaccess.com/CAS_Public_Inquiries/Monarch/
PA	Montgomery Tax Claim	https://webapp07.montcopa.org/taxclaim/
PA	New Castle City	https://wipp.edmundsassoc.com/Wipp/
PA	New Castle School	https://wipp.edmundsassoc.com/Wipp/
PA	Northampton	https://www.ncpub.org/
PA	Philadelphia City	https://tax-services.phila.gov/
PA	Schuylkill	https://www.co.schuylkill.pa.us/
PA	Scranton City	http://nerevenue.rba.com/taxes/scranton/
PA	West Mifflin School	https://billpay.forte.net/westmifflinpaschooltax/
PR	CRIM	https://www.crimpr.net/
PR	Special	https://siscon.hacienda.gobierno.pr/ce/
RI	Bristol Town	https://www.opaldata.net/onlinetax/
RI	Burrillville Town	https://www.opaldata.net/onlinetax/
RI	Charlestown Town	https://www.opaldata.net/onlinetax/
RI	Coventry Town	https://www.opaldata.net/onlinetax/
RI	Cumberland Town	https://www.opaldata.net/onlinetax/
RI	Exeter Town	https://www.opaldata.net/onlinetax/
RI	Glocester Town	https://www.opaldata.net/onlinetax/
RI	Hopkinton Town	https://www.opaldata.net/onlinetax/
RI	Jamestown Town	https://www.opaldata.net/onlinetax/
RI	Johnston Town	https://www.opaldata.net/onlinetax/
RI	Lincoln Town	https://www.opaldata.net/onlinetax/
RI	Little Compton Town	https://www.opaldata.net/onlinetax/
RI	Narragansett Town	https://www.opaldata.net/onlinetax/
RI	Newport City	https://www.opaldata.net/onlinetax/
RI	North Providence Town	https://www.opaldata.net/onlinetax/
RI	North Smithfield Town	https://www.opaldata.net/onlinetax/
RI	Portsmouth Town	https://www.opaldata.net/onlinetax/
RI	Providence City	https://billpay.providenceri.com/
RI	Richmond Town	https://www.opaldata.net/onlinetax/
RI	Scituate Town	https://www.opaldata.net/onlinetax/
RI	Smithfield Town	https://www.opaldata.net/onlinetax/
RI	South Kingstown Town	https://www.opaldata.net/onlinetax/
RI	Warren Town	https://www.opaldata.net/onlinetax/
RI	Warwick City	https://www.citizenselfservice.com/MSS/citizens/RealEstate/
RI	Westerly Town	https://www.mytaxbillri.org/inet/bill/home.do?town=westerlyri
RI	West Greenwich Town	https://www.opaldata.net/onlinetax/
RI	West Warwick Town	https://www.opaldata.net/onlinetax/
RI	Woonsocket City	https://www.opaldata.net/onlinetax/
SC	Anderson	https://acpass.andersoncountysc.org/p_tax_search.htm
SC	Beaufort	https://sc-beaufort.publicaccessnow.com/Home.aspx
SC	Cherokee	https://www.cherokeecountysctax.com/taxes.html#/
SC	Chester	https://d1ebsyxxbc7tep.cloudfront.net/data/61020303-8d26-4a16-b995-6deb1def7d97/
SC	Dorchester	http://dorchestercountytaxesonline.com/
SC	Dorchester Priors	https://as400.dorchestercounty.net/webapps/
SC	Florence	http://web.florenceco.org/cgi-bin/ta/
SC	Georgetown	https://georgetowncountysctax.com/update.html#/WildfireSearch
SC	Greenville	http://www.greenvillecounty.org/appsAS400/RealProperty/
SC	Horry	https://horrycountytreasurer.qpaybill.com/
SC	Jasper	http://www.jaspercountysc.org/
SC	Kershaw	http://www.kershawcountysctax.com/
SC	Lancaster	http://mylancastersctax.org/
SC	Laurens	http://www.laurenscountysctaxes.com/
SC	Lexington	https://lexingtoncountytreasurer.qpaybill.com/Taxes/TaxesDefaultType4.aspx
SC	Marion	http://marionsc.org/
SC	North Augusta City	https://www.govhost.com/
SC	Orangeburg	https://www.orangeburgcounty.org/
SC	Spartanburg	https://spartanburgcountytax.qpaybill.com/Taxes/TaxesDefaultType4.aspx
SC	Union	https://uniontreasurer.qpaybill.com/Taxes/
SD	Brown	http://tax.brown.sd.us/
TN	Anderson	https://anderson.paytntaxes.com/lookup/property-tax
TN	Chattanooga City	https://chattanoogatn.taxandrevenue.opengov.com
TN	Claiborne	https://claiborne-tn.mygovonline.com/
TN	Cleveland City	https://secure.tennesseetrustee.org/
TN	Crockett	http://www.crockett.tennesseetrustee.org/
TN	Davidson	https://nashville-tn.mygovonline.com/mod.php?mod=propertytax&mode=public_lookup
TN	Greene	http://www.greene.tennesseetrustee.org/
TN	Hamblen	https://hamblen-tn.mygovonline.com/
TN	Hendersonville City	http://www.cityofhendersonville.tennesseetrustee.org/
TN	Knox	http://workplace.com/
TN	Madison	https://madison-tn.mygovonline.com/
TN	Memphis City	https://epayments.memphistn.gov/property/
TN	Morristown City	https://morristown.munisselfservice.com/citizens/RealEstate/Default.aspx?mode=new
TN	Rutherford	http://payments.rctrustee.org/
TN	Shelby	https://sct.shelbycountytrustee.com/TaxQry/
TN	Sullivan	https://secure.tennesseetrustee.org/
TN	Washington	https://washington-tn.mygovonline.com/
TN	Wilson	https://wilson-tn.mygovonline.com/
TX	Aldine ISD	http://tax.aldine.k12.tx.us/TaxAldineISD/
TX	Alief ISD	https://texaspayments.com/Home/
TX	Andrews ISD	https://andrewsisdtax.com/taxes.html/
TX	Angelina	http://propaccess.trueautomation.com/clientdb/
TX	Aransas	http://www.aransascad.org/Appraisal/PublicAccess/
TX	ASW	http://www.aswtax.com/
TX	Atascosa	https://propaccess.trueautomation.com/clientdb/
TX	Austin CAD	http://tax.austincad.org/tax/
TX	Bailey CAD	https://esearch.bailey-cad.org/
TX	BAMunitax	http://www.bamunitax.com/
TX	Bastrop	https://www.bastroptac.com/
TX	Bee	https://actweb.acttax.com/bee/bee/index.jsp
TX	Bell CAD	https://esearch.bellcad.org/
TX	Bexar	http://home.bexar.org/tax/index.html
TX	Blanco CAD	http://propaccess.trueautomation.com/clientdb/
TX	Bob Leard Interests	http://www.bli-tax.com/tax-form/
TX	Bosque	http://www.bosquecountytaxoffice.com/
TX	Bowie CAD	https://bowie.propertytaxpayments.net/search
TX	Brazoria	https://www.brazoriacountytx.gov/
TX	Brazos	http://propaccess.trueautomation.com/clientdb/
TX	Brewster CAD	http://propaccess.trueautomation.com/clientdb/
TX	Brooks	http://propaccess.trueautomation.com/clientdb/
TX	Brooks ISD	http://propaccess.trueautomation.com/clientdb/
TX	Burnet CAD	https://propaccess.trueautomation.com/clientdb/
TX	Caldwell CAD	https://propaccess.trueautomation.com/clientdb/
TX	Calhoun CAD	http://propaccess.trueautomation.com/clientdb/
TX	Callahan	http://www.isouthwestdata.com/client/
TX	Cameron	https://www.cameroncountytax.org/
TX	Camp CAD	http://propaccess.trueautomation.com/clientdb/
TX	Carrollton Farmers Branch ISD	https://www.texaspayments.com/057903
TX	Carson	https://www.carsoncountytax.org/Home/Search
TX	Chambers	https://actweb.acttax.com/chambers/chambers/index.jsp
TX	Cherokee	https://tax.co.cherokee.tx.us/Accounts/
TX	Cherokee CAD	https://esearch.cherokeecad.com/
TX	Clay	http://www.claycad.org/
TX	Clear Lake City Water Authority	https://texaspayments.com/Home/
TX	Coleman	http://colemancountycad.com/Appraisal/PublicAccess/
TX	Collin	http://taxpublic.collincountytx.gov/taxcollincounty/
TX	Colorado CAD	http://propaccess.trueautomation.com/clientdb/
TX	Comal	https://property.co.comal.tx.us/search
TX	Comal CAD	http://taxweb.co.comal.tx.us/clientdb/
TX	Cypress Fairbanks ISD	https://actweb.acttax.com/act_webdev/cyfair/
TX	Dallam CAD	http://propaccess.trueautomation.com/clientdb/
TX	Dallas	http://www.dallascounty.org/applications/english/proptax_app/tax_intro.php
TX	Dayton ISD	https://propaccess.trueautomation.com/clientdb/
TX	Deer Park City	https://actweb.acttax.com/act_webdev/deerparkcity/
TX	Delta CAD	https://esearch.delta-cad.org/
TX	Denton	https://taxweb.dentoncounty.gov/search/
TX	Denton County LID1	http://bli-tax.com/cad-number/
TX	Denton County RUD1	http://bli-tax.com/cad-number/
TX	De Witt	https://www.dewittcad.org/(S(23vnxvbawv3tdhfnq2bcpznm))/
TX	Eastland CAD	http://www.eastlandcad.org
TX	Edwards	http://propaccess.trueautomation.com/clientdb/
TX	Ellis	https://www.elliscountytx.gov/
TX	Equitax	http://www.equitaxinc.com/
TX	Falls	https://www.texasonlinerecords.com/
TX	Fannin CAD	http://propaccess.trueautomation.com/clientdb/
TX	Fayette CAD	http://propaccess.trueautomation.com/clientdb/
TX	Floyd CAD	http://www.isouthwestdata.com/client/
TX	Freestone	http://www.freestonetax.org/
TX	Friendswood ISD	http://www.myfisd.com/
TX	Frio	http://www.friocountytax.org/
TX	Frio CAD	https://www.friocad.org/
TX	Gaines CAD	https://esearch.gainescad.org/
TX	Galveston	http://www.galvestoncountytx.gov/to/Pages/default.aspx
TX	Garland City	https://www.texaspayments.com/057120
TX	Garland ISD	https://www.texaspayments.com/057909
TX	Gillespie	http://propaccess.trueautomation.com/clientdb/
TX	Gonzales	http://tax.co.gonzales.tx.us/Appraisal/PublicAccess/
TX	Goose Creek ISD	https://tax.gccisd.net/search
TX	Grand Prairie Metropolitan URD	http://www.wheelerassoc.com/
TX	Grapevine Colleyville ISD	https://texaspayments.com/Home/
TX	Grayson	https://grayson.propertytaxpayments.net/search
TX	Gregg	http://actweb.acttax.com/act_webdev/gregg/
TX	Grimes CAD	https://www.grimescad.org/
TX	Guadalupe	http://property.co.guadalupe.tx.us/Appraisal/PublicAccess/
TX	Hale CAD	http://propaccess.trueautomation.com/clientdb/
TX	Hardin	https://tax.cagi.com/account-search/C100
TX	Harris	https://www.hctax.net/Property/PropertyTax
TX	Harrison	http://iswdataclient.azurewebsites.net/
TX	Harrison CAD	https://tax.harrisoncad.net/
TX	Hartley CAD	http://www.isouthwestdata.com/client/
TX	Hays	http://hayscountytax.com/Taxes/
TX	Henderson	https://henderson.propertytaxpayments.net/search
TX	Hidalgo	https://actweb.acttax.com/act_webdev/hidalgo/
TX	Hill	https://esearch.hilltax.org/
TX	Hill CAD	http://propaccess.trueautomation.com/clientdb/
TX	Hood CAD	http://www.isouthwestdata.com/client/
TX	Hopkins	https://hopkins.propertytaxpayments.net/search
TX	Howard	http://iswdataclient.azurewebsites.net/
TX	Howard CAD	http://iswdataclient.azurewebsites.net/
TX	Humble ISD	https://humbleisd.propertytaxpayments.net/search/
TX	Hunt	https://esearch.hctax.info/
TX	Irving ISD	https://actweb.acttax.com/act_webdev/irving
TX	ITMServices	http://www.itmservices.com/
TX	Jack	https://www.jackcountytax.org/
TX	Jefferson	https://actweb.acttax.com/act_webdev/jefferson/
TX	Jim Wells CAD	https://jimwells.propertytaxpayments.net/search
TX	Johnson	https://www.johnsoncountytaxoffice.org/search/
TX	Jones	http://www.jonescad.org/
TX	Karnes	http://www.karnescountytax.org/
TX	Kaufman	http://kaufmantax.net/clientdb/
TX	Kendall CAD	https://esearch.kendallad.org/Property/View/
TX	Kimble CAD	http://propaccess.trueautomation.com/clientdb/
TX	Knox CAD	http://www.isouthwestdata.com/client/
TX	Lamar CAD	http://propaccess.trueautomation.com/clientdb/
TX	Lamb	https://esearch.lambcad.org/
TX	Lampasas CAD	https://www.lampasascad.org/
TX	Lancaster MUD1	http://www.bli-tax.com/tax-form/
TX	Lavaca	https://www.lavacacountytax.com/
TX	Lee	http://www.leetax.org/
TX	Leon	http://leoncountytax.org/
TX	Liberty	https://www.libertycountytax.com/search
TX	Lipscomb	http://www.isouthwestdata.com/client/
TX	Llano	http://www.isouthwestdata.com/client/
TX	Lubbock	http://www.lubbockcad.org/Appraisal/PublicAccess/
TX	Madison	https://propaccess.trueautomation.com/clientdb/
TX	Matagorda CAD	http://propaccess.trueautomation.com/clientdb/
TX	Maverick	https://propaccess.trueautomation.com/clientdb/
TX	Mc Allen City	https://mcallen.go2gov.net/faces/search.jsp
TX	Mc Lennan	http://actweb.acttax.com/act_webdev/mclennan/
TX	Medina	http://www.medinacountytx.org/Appraisal/PublicAccess/
TX	Mesquite City	https://propertytax.cityofmesquite.com/mesquitetax/
TX	Midland CAD	http://www.isouthwestdata.com/client/
TX	Milam	https://esearch.milamad.org/
TX	Mills CAD	http://www.isouthwestdata.com/client/
TX	Montague	http://www.isouthwestdata.com/client/
TX	Montague CAD	http://www.isouthwestdata.com/client/
TX	Montgomery	https://actweb.acttax.com/act_webdev/montgomery/
TX	Moore	https://esearch.co.moore.tx.us/
TX	Morris CAD	http://www.morriscad.com/
TX	Nacogdoches CAD	https://esearch.nacocad.org/
TX	Navarro	http://actweb.acttax.com/act_webdev/navarro/
TX	Nolan	http://www.nolan-cad.org/
TX	Northwest Dallas County FCD	http://www.nwdallasfcd.com/
TX	Nueces	https://actweb.acttax.com/act_webdev/nueces/
TX	Palo Pinto	http://www.palopintocounty.net/tax/
TX	Panola	http://www.panolacountytax.org/
TX	Parker CAD	http://www.isouthwestdata.com/client/
TX	Parmer CAD	http://propaccess.trueautomation.com/clientdb/
TX	Pasadena ISD	https://taxoffice.pasadenaisd.org/search
TX	Pecos	http://www.pecostax.org/
TX	Rains CAD	http://propaccess.trueautomation.com/clientdb/
TX	Real CAD	https://propaccess.trueautomation.com/clientdb/
TX	Reeves	https://www.reevescountytax.org/search
TX	Richardson ISD	https://www.texaspayments.com/057916
TX	Robertson	https://tax.cagi.com/account-search/C198
TX	Rockwall CAD	http://esearch.rockwallcad.com/
TX	Runnels	https://iswdataclient.azurewebsites.net/
TX	Rusk	https://www.ruskcountytax.com/
TX	San Augustine	http://www.sanaugustinetax.org/
TX	San Jacinto Tax Service	http://www.sjtaxservice.com/
TX	Santa Fe ISD	https://www.texaspayments.com/084909
TX	Schleicher CAD	http://propaccess.trueautomation.com/clientdb/
TX	Scurry CAD	http://propaccess.trueautomation.com/clientdb/
TX	Shelby	https://tax.shelbytaxpayment.com/
TX	Smith	https://publictax.smith-county.com/search
TX	Somervell CAD	https://somervellcad.southwestdatasolutions.com/PropertySearch
TX	Spring Branch ISD	https://sbisd.propertytaxpayments.net/search
TX	Starr	https://starr.go2gov.net/faces/_rlvid.jsp?_rap=!searchID&_rvip=/search.jsp
TX	Stephens	http://iswdataclient.azurewebsites.net/
TX	Sulphur Springs ISD	https://actweb.acttax.com/ssisd/ssisd/index.jsp
TX	Sutton CAD	http://propaccess.trueautomation.com/clientdb/
TX	Swisher CAD	http://propaccess.trueautomation.com/clientdb/
TX	Tarrant	https://www.tax.tarrantcountytx.gov/Search/
TX	Tax Tech	http://www.taxtech.net/
TX	Terrell CAD	http://propaccess.trueautomation.com/clientdb/
TX	Terry	https://www.tax.cagi.com/
TX	Texas City ISD	https://actweb.acttax.com/act_webdev/texascity/
TX	Titus	https://propaccess.trueautomation.com/clientdb/
TX	Tomball ISD	https://tomballisd.propertytaxpayments.net/search
TX	Travis	https://tax-office.traviscountytx.gov
TX	Trinity CAD	https://propaccess.trueautomation.com/clientdb/
TX	Tyler	https://www.tylercountytax.org/
TX	Utility Tax	http://www.utilitytaxservice.com/
TX	Uvalde CAD	http://propaccess.trueautomation.com/clientdb/
TX	Valwood Improvement Authority	http://www.valwood.com/
TX	Van Zandt CAD	https://vanzandt.propertytaxpayments.net/search
TX	Walker CAD	http://propaccess.trueautomation.com/clientdb/
TX	Waller	http://tax.co.waller.tx.us/
TX	Waller ISD	https://mytax.eztaxonline.net/
TX	Ward	http://wardcountytax.org/
TX	Webb	https://www.webbcountytax.com/
TX	Wharton	http://www.whartoncountytaxoffice.com/
TX	Wheeler	http://www.wheelerassoc.com/
TX	Wheeler Associates	https://www.wheelerassoc.com/SearchAccount
TX	Wichita	https://wichita.propertytaxpayments.net/search
TX	Wilbarger	http://www.wilbargertax.org/
TX	Wilson	https://esearch.tax.wilsoncountytx.gov/
TX	Wilson CAD	http://propaccess.trueautomation.com/clientdb/
TX	Wise CAD	http://www.isouthwestdata.com/client/
TX	Wood	https://www.woodcountytax.com/
TX	Woodlands Mud	https://texaspayments.com/Home/
TX	Yoakum CAD	http://propaccess.trueautomation.com/clientdb/
TX	Zapata CAD	https://propaccess.trueautomation.com/clientdb/
UT	Carbon	https://secureinstantpayments.com/sip/reports/
UT	Davis	https://www.co.davis.ut.us/treasurer/
UT	Salt Lake	https://treasurer.slco.org/
UT	Summit	https://property.summitcounty.org/
UT	Washington	https://www.washco.utah.gov/
VA	Accomack	http://www.accomacktax.com/taxes/
VA	Albemarle	https://www.albemarlecountytaxes.org/taxes/
VA	Alexandria City	https://realestate.alexandriava.gov/
VA	Alexandria City Refuse	https://realestate.alexandriava.gov/
VA	Appomattox	https://appomattox-gov-revmgt.secure.openrda.net/portal/search/hb/
VA	Ashland Town	https://townofashlandva.tylerportico.com/css/citizen-selfservice/real-estate
VA	Augusta	https://tax.co.augusta.va.us/Applications/REPublicInquiry/
VA	Bath	https://eservices.bristolva.org/applications/REPublicInquiry/
VA	Botetourt	http://botetourtbillpay.com/
VA	Bristol City	https://eservices.bristolva.org/applications/REPublicInquiry/webform1.aspx
VA	Campbell	https://bai.co.campbell.va.us/applications/REPublicInquiry/
VA	Caroline	https://e-services.co.caroline.va.us/Applications/REPublicInquiry/
VA	Chesapeake	https://cityapps.cityofchesapeake.net/subscriptions/realestate/
VA	Chesterfield	https://www.chesterfield.gov/
VA	City Of Hopewell	https://cityofhopewellva.tylerportico.com/css/citizen-selfservice/real-estate/pay-bill
VA	Colonial Beach Town	https://wipp.edmundsgovtech.cloud/home?wippId=CBTN
VA	Culpeper	https://www.culpepercounty.gov/applications/REPublicInquiry/
VA	Dinwiddie	https://online.dinwiddieva.us/applications/REpublicInquiry/
VA	Fairfax City	https://eservices.fairfaxva.gov/taxes/
VA	Fauquier	https://tax.fauquiercounty.gov/PortalAccount/SearchForParcel?NextAction=VIEW
VA	Front Royal Town	https://taxpay.frontroyalva.com/applications/REpublicInquiry/
VA	Gloucester	https://gloucestercountyva.munisselfservice.com/citizens/RealEstate/Default.aspx?mode=new
VA	Hampton City	https://hamptonrealinfo.hampton.gov/HamptonTaxInfo/TaxInfo
VA	Hampton City City	https://hamptonrealinfo.hampton.gov/HamptonTaxInfo/TaxInfo
VA	Hampton City Sewer	https://hamptonrealinfo.hampton.gov/HamptonTaxInfo/TaxInfo
VA	Hampton City Storm	https://hamptonrealinfo.hampton.gov/HamptonTaxInfo/TaxInfo
VA	Hanover	https://taxes.hanovercounty.gov/
VA	Henrico	https://businesstax.henrico.gov/taxes.html#/WildfireSearch
VA	Hopewell City	https://cityofhopewellva.tylerportico.com/css/citizen-selfservice/real-estate
VA	James City	https://property.jamescitycountyva.gov/
VA	King George	https://eservices.kinggeorgecountyva.gov/applications/REPublicInquiry/
VA	King Queen	https://eservices.kingandqueenco.net/applications/trapps/
VA	Leesburg Town	https://leesburg.munisselfservice.com/citizens/RealEstate/
VA	Louisa	https://louweb.louisa.org/applications/republicinquiry/
VA	Lunenburg	https://eservices.lunenburgva.org/applications/REpublicInquiry/
VA	Lynchburg City	https://webapps.lynchburgva.gov/citylink
VA	Mathews	https://eservices-mathews.com/applications/trapps/
VA	Mecklenburg	https://meckweb.mecklenburgva.com/applications/REPublicInquiry/
VA	Middlesex	https://websrv-vmw.dmz.co.middlesex.va.us/applications/REPublicInquiry/
VA	Newport News City	https://assessment.nnva.gov/PT/search/
VA	Newport News City Storm	https://assessment.nnva.gov/PT/search/
VA	Norfolk City	https://eservices.norfolk.gov/Taxes/
VA	Page	https://eservices.pagecounty.virginia.gov/applications/REPublicInquiry/
VA	Petersburg City	https://www.petersburg-va.com/applications/REPublicInquiry/webform1.aspx
VA	Pittsylvania	https://keyweb.pittgov.net/WebPAAS/Parcels/
VA	Portsmouth City	http://data.portsmouthva.gov/treasurer/data/realestatereceivsearch.aspx
VA	Portsmouth City Storm	http://www.portsmouthva.gov/
VA	Prince William	https://tax.pwcgov.org/PortalAccount/ViewParcel/
VA	Prince William Storm	https://tax.pwcgov.org/PortalAccount/ViewParcel/
VA	Russell	https://egov.russellcountyva.us/applications/REPublicInquiry/
VA	Staunton City	https://services.ci.staunton.va.us/MSS/citizens/RealEstate/
VA	Suffolk City	https://www.suffolkvatax.us/#/
VA	Sussex	https://eservices.sussexcountyva.gov/applications/REpublicInquiry/
VA	Virginia Beach City	https://cvb.manatron.com/
VA	Warren	https://eservices.warrencountyva.net/applications/REPublicInquiry/
VA	Westmoreland	https://eservices.westmoreland-county.org/applications/REPublicInquiry/
WA	Cowlitz	https://www.cowlitzinfo.net/
WA	King	http://info.kingcounty.gov/finance/treasury/propertytax/
WA	Kitsap	https://psearch.kitsap.gov/pdetails/Default
WA	Lewis	https://parcels.lewiscountywa.gov/
WA	Pierce	https://atip.piercecountywa.gov/app/v2/parcelSearch/search
WA	Snohomish	https://wa-snohomish.publicaccessnow.com/Treasurer/TaxSearch.aspx
WA	Spokane	http://cp.spokanecounty.org/SCOUT/propertyinformation/
WI	Adams	http://adamscowi.wgxtreme.com/java/wgxparcel/
WI	Appleton City	http://my.appleton.org/
WI	Ashland	http://ashlandcowi.wgxtreme.com/java/wgxparcel/
WI	Barron	http://www.co.barron.wi.us/GCSWebPortal/
WI	Brown	https://bclrpp.browncountywi.gov/Search/RealEstate/Search
WI	Brown Deer Village	https://pp-milwaukee-co-wi-fb.app.landnav.com/Search/RealEstate/Search
WI	Buffalo	https://landnav-publicportal.buffalocounty.com/Search/RealEstate/Search
WI	Burnett	http://web.burnettcounty.org/access/REAL%20ESTATE/header.asp
WI	Clark	http://clarkcowi.wgxtreme.com/java/wgx_taxsearch/report/window/clarkcowi/
WI	Columbia	https://ascent.co.columbia.wi.us/LandRecords/PropertyListing/RealEstateTaxParcel#/Search
WI	Crawford	https://landrecords.crawfordcountywi.org/
WI	Florence	http://gcs.florencewisconsin.com/GCSWebPortal/
WI	Fond Du Lac	https://landinfo.fdlco.wi.gov/
WI	Fox Point Village	http://host.gcssoftware.com/Foxpoint/
WI	Glendale City	https://host.gcssoftware.com/Glendale/
WI	Grant	https://grantcountylandrecords.com/
WI	Green	http://landrecords.greencountywi.org/lrsweb/parcel/
WI	Green Lake	https://greenlake.transcendenttech.com/LandRecords/PropertyListing/RealEstateTaxParcel#/Search
WI	Jackson	https://pp-jackson-co-wi-fb.app.landnav.com/Search/RealEstate/Search
WI	Kenosha	https://pp-kenosha-co-wi-fb.app.landnav.com/Search/RealEstate/Search
WI	Kenosha City	http://kenosha.org/cgi-bin/
WI	Kewaunee	https://www.kewauneeco.org/
WI	La Crosse	http://www.co.la-crosse.wi.us/landrecordsportal/
WI	Lincoln	https://lrs.co.lincoln.wi.us/
WI	Madison City	http://www.cityofmadison.com/assessor/property/
WI	Manitowoc City	https://taxes.manitowoc.org/
WI	Marathon	http://ascent.co.marathon.wi.us/AscentLandRecords/PropertyListing/RealEstateTaxParcel#/Search
WI	Marquette	http://marquettecowi.wgxtreme.com/java/wgx_taxsearch/
WI	Menominee	https://ascent.co.menominee.wi.us/
WI	Monroe	https://pp-monroe-co-wi-fb.app.landnav.com/Search/RealEstate/Search
WI	Neenah City	http://www3.ci.neenah.wi.us/prod/
WI	New Berlin City	http://www.newberlin.org/
WI	Oak Creek City	http://city.oakcreekwi.org/gcswebportal/
WI	Oconto	http://ocgen.co.oconto.wi.us/GCSWebPortal/search.aspx
WI	Oshkosh City	https://www.ci.oshkosh.wi.us/
WI	Ozaukee	http://www.ascent.co.ozaukee.wi.us/LandRecords/
WI	Pierce	https://www.co.pierce.wi.us/
WI	Polk	https://pp-polk-co-wi-fb.app.landnav.com/Search/RealEstate/Search
WI	Price	https://www.co.price.wi.us/
WI	Richland	http://richlandcowi.wgxtreme.com/java/wgx_taxsearch/report/panel/richlandcowi/
WI	Rock	https://taxsearch.co.rock.wi.us/search.php
WI	Rusk	http://ruskcowi.wgxtreme.com/java/wgx_taxsearch/report/window/ruskcowi/
WI	Sawyer	https://tas.sawyercountygov.org/access/REAL%20ESTATE/header.asp
WI	Shawano	https://gis.co.shawano.wi.us/
WI	Sheboygan	https://treasurer.sheboygancounty.com/GCSWebPortal/Search.aspx
WI	Shorewood Village	http://gcs.villageofshorewood.org/
WI	St Croix	https://propertyinfo.kenoshacounty.org/Search/RealEstate/Search
WI	Stevens Point City	http://www2.stevenspoint.com/GCSWebPortal/
WI	St Francis City	http://host.gcssoftware.com/StFrancis/
WI	Taylor	https://taylorwi.mapping-online.com/
WI	Trempealeau	http://www.tremplocounty.com/Search/
WI	Two Rivers City	https://tworivers.transcendenttech.com/LandRecords/PropertyListing/RealEstateTaxParcel#/Search
WI	Vernon	https://vernonwi.mapping-online.com/
WI	Washburn	https://tax.co.washburn.wi.us/access/REAL%20ESTATE/header.asp
WI	Waupaca	https://waupaca.transcendenttech.com/LandRecords/PropertyListing/RealEstateTaxParcel#/Search
WI	Waushara	http://www.co.waushara.wi.us/
WI	Winnebago	http://www.co.winnebago.wi.us/
WI	Wood	http://www.co.wood.wi.us/Departments/Treasurer/TaxPublic/
WV	Boone	http://boone.softwaresystems.com/
WV	Brooke	http://www.brookecountysheriff.com/tax/
WV	Cabell	http://cabell.softwaresystems.com/
WV	Fayette	http://fayette.softwaresystems.com/
WV	Greenbrier	http://greenbrier.softwaresystems.com/
WV	Hampshire	http://129.71.205.207/
WV	Harrison	http://harrison.softwaresystems.com/
WV	Jackson	http://jackson.softwaresystems.com/
WV	Logan	http://logan.softwaresystems.com/
WV	Marion	http://marion.softwaresystems.com/
WV	Marshall	http://marshall.softwaresystems.com/
WV	Mineral	http://mineral.softwaresystems.com/
WV	Monongalia	http://monongalia.softwaresystems.com/
WV	Morgan	http://morgan.softwaresystems.com/
WV	Nicholas	http://nicholas.softwaresystems.com/
WV	Ohio	http://ohio.softwaresystems.com/
WV	Preston	https://129.71.117.27/
WV	Putnam	http://putnam.softwaresystems.com/
WV	Randolph	http://randolph.softwaresystems.com/
WV	Taylor	http://taylor.softwaresystems.com/
WV	Upshur	http://upshur.softwaresystems.com/
WV	Wayne	http://www.waynecountywv.us/WEBTax/

Total validated-true rows: 1675
Companion CSV: spul/data/validated-true-urls.csv
Also: docs/SPUL_DESCRIPTION_AND_VALIDATED_URLS.md
Artifact: /opt/cursor/artifacts/SPUL_DESCRIPTION_AND_VALIDATED_URLS.txt

