'use strict';

/**
 * Parse WebPoint Tax (WPT) Production Log sheet tabs into canonical jurisdictions.
 * Never invent collector URLs — catalog + merge only.
 */
const fs = require('fs');
const path = require('path');
const {
  compactName,
  humanizeCounty,
  aliasLookupKey,
  dedupeKey,
  masterKey,
  CENSUS_PATH,
  ALIASES_PATH,
  CATALOG_PATH,
  loadCountiesFile
} = require('./import-lib');

const SHEET_ID = '1yOKyy5NqJHVKiuVO1kYvSIf7s_R7gCGJ2cyfcCz2zcM';
const SHEET_TABS = [
  { gid: '2101364724', name: 'CoreLogic' },
  { gid: '34743927', name: 'Lereta' },
  { gid: '1170624916', name: 'Lument' },
  { gid: '409090044', name: 'NTS' },
  { gid: '1491656814', name: 'Master Log' },
  { gid: '1206398728', name: 'UPF' }
];

const US_STATES = new Set(
  `AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY GU PR VI AS`.split(
    /\s+/
  )
);

/** Sheet typos / mislabels → canonical jurisdiction. Never invent URLs here. */
const HARD_ALIASES = {
  'WI:horry': { state: 'SC', county: 'Horry' },
  'MD:princegeorge': { state: 'MD', county: 'Prince George' },
  'MD:princegeorges': { state: 'MD', county: 'Prince George' },
  'DC:washington': { state: 'DC', county: 'District Of Columbia' },
  'DC:washingtondc': { state: 'DC', county: 'District Of Columbia' },
  'FL:miamidade': { state: 'FL', county: 'Miami Dade' },
  'FL:miamdade': { state: 'FL', county: 'Miami Dade' },
  'FL:hillsbourgh': { state: 'FL', county: 'Hillsborough' },
  'FL:naussau': { state: 'FL', county: 'Nassau' },
  'FL:puertorico': { state: 'PR', county: 'Puerto Rico' },
  'AL:balwin': { state: 'AL', county: 'Baldwin' },
  'AL:choctow': { state: 'AL', county: 'Choctaw' },
  'AL:dekab': { state: 'AL', county: 'De Kalb' },
  'AL:dekalb': { state: 'AL', county: 'De Kalb' },
  'AL:jeffeson': { state: 'AL', county: 'Jefferson' },
  'AL:jefferonbessemer': { state: 'AL', county: 'Jefferson' },
  'AL:mongomery': { state: 'AL', county: 'Montgomery' },
  'AL:stclaire': { state: 'AL', county: 'St Clair' },
  'AL:stclair': { state: 'AL', county: 'St Clair' },
  'AL:talladaga': { state: 'AL', county: 'Talladega' },
  'AL:tallapaloosa': { state: 'AL', county: 'Tallapoosa' },
  'AL:tuscaloossa': { state: 'AL', county: 'Tuscaloosa' },
  'AR:craigsheadcunty': { state: 'AR', county: 'Craighead' },
  'AR:sabastian': { state: 'AR', county: 'Sebastian' },
  'AZ:cocinino': { state: 'AZ', county: 'Coconino' },
  'CA:almeda': { state: 'CA', county: 'Alameda' },
  'CA:sanbernadino': { state: 'CA', county: 'San Bernardino' },
  'CA:sanbernaardino': { state: 'CA', county: 'San Bernardino' },
  'CA:canbernardino': { state: 'CA', county: 'San Bernardino' },
  'CA:sanjaoquin': { state: 'CA', county: 'San Joaquin' },
  'CA:canjaoquin': { state: 'CA', county: 'San Joaquin' },
  'CA:sanqoaquin': { state: 'CA', county: 'San Joaquin' },
  'CA:cantaclara': { state: 'CA', county: 'Santa Clara' },
  'CA:conracosta': { state: 'CA', county: 'Contra Costa' },
  'CA:medocino': { state: 'CA', county: 'Mendocino' },
  'CA:mendecino': { state: 'CA', county: 'Mendocino' },
  'CA:menocino': { state: 'CA', county: 'Mendocino' },
  'CA:sanoma': { state: 'CA', county: 'Sonoma' },
  'CA:sarcamento': { state: 'CA', county: 'Sacramento' },
  'CA:santaclarita': { state: 'CA', county: 'Los Angeles' },
  'CO:admas': { state: 'CO', county: 'Adams' },
  'CO:broomfieldcitycounty': { state: 'CO', county: 'Broomfield' },
  'CT:greenwhichtown': { state: 'CT', county: 'Greenwich' },
  'CT:harfordcity': { state: 'CT', county: 'Hartford' },
  'CT:hartordcity': { state: 'CT', county: 'Hartford' },
  'IL:efingham': { state: 'IL', county: 'Effingham' },
  'IL:cookcountytreasurer': { state: 'IL', county: 'Cook Treasurer' },
  'IN:koscuisco': { state: 'IN', county: 'Kosciusko' },
  'LA:jeffeson': { state: 'LA', county: 'Jefferson' },
  'LA:lafayatte': { state: 'LA', county: 'Lafayette' },
  'LA:nitchitoches': { state: 'LA', county: 'Natchitoches' },
  'LA:terrebone': { state: 'LA', county: 'Terrebonne' },
  'LA:orleansperish': { state: 'LA', county: 'Orleans' },
  'LA:ascensionperish': { state: 'LA', county: 'Ascension' },
  'LA:terrebonneperish': { state: 'LA', county: 'Terrebonne' },
  'GA:fultoncities': { state: 'GA', county: 'Fulton' },
  'GA:atlantacity': { state: 'GA', county: 'Fulton' },
  'GA:atlanta': { state: 'GA', county: 'Fulton' },
  'GA:fultonsolidwaste': { state: 'GA', county: 'Fulton' },
  'GA:rowwellcity': { state: 'GA', county: 'Fulton' },
  'KY:warnerrobinscity': { state: 'GA', county: 'Houston' },
  'NY:nycdof': { state: 'NY', county: 'New York City' },
  'NY:manhattanboro': { state: 'NY', county: 'New York City' },
  'NY:brooklynboro': { state: 'NY', county: 'New York City' },
  'NY:queensboro': { state: 'NY', county: 'New York City' },
  'NY:bronxboro': { state: 'NY', county: 'Bronx' },
  'NY:statenislandboro': { state: 'NY', county: 'Richmond' },
  'PR:crim': { state: 'PR', county: 'CRIM' },
  'PR:puertorico': { state: 'PR', county: 'Puerto Rico' }
};

const SKIP_RE =
  /mixed\s*agenc|multi(?:ple)?\s*agenc|various agenc|b2b test|greentree|tnt project|signature assist|trs deal|misc\b/i;

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  if (Math.abs(a.length - b.length) > 3) return 99;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const cur = [i + 1];
    for (let j = 0; j < b.length; j++) {
      const ins = cur[j] + 1;
      const del = prev[j + 1] + 1;
      const sub = prev[j] + (a[i] === b[j] ? 0 : 1);
      cur.push(Math.min(ins, del, sub));
    }
    for (let j = 0; j < prev.length; j++) prev[j] = cur[j];
  }
  return prev[b.length];
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = false;
      } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function parseCsv(text) {
  const lines = String(text).replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.length);
  if (!lines.length) return [];
  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx] == null ? '' : cols[idx];
    });
    rows.push(row);
  }
  return rows;
}

function fileNameFromRow(row) {
  const keys = Object.keys(row);
  for (const cand of ['File Name', 'Agency', '']) {
    if (Object.prototype.hasOwnProperty.call(row, cand) && String(row[cand] || '').trim()) {
      return String(row[cand]).trim();
    }
  }
  for (const k of keys) {
    const v = String(row[k] || '').trim();
    if (/^[A-Za-z]{2}[-_\s]/.test(v)) return v;
  }
  return '';
}

function parseFileName(raw) {
  if (!raw) return null;
  const text = String(raw).trim();
  if (SKIP_RE.test(text)) return null;
  const m = /^([A-Za-z]{2})[-_\s]+(.+)$/.exec(text);
  if (!m) return null;
  let st = m[1].toUpperCase();
  let rest = m[2].trim();
  if (!US_STATES.has(st) && st !== 'DC') return null;
  rest = rest.replace(/\([^)]*\)/g, '').replace(/_/g, ' ').trim();
  rest = rest.replace(/\s+LA\d{5,}$/i, '').trim();
  for (let i = 0; i < 8; i++) {
    const next = rest.replace(
      /\s+(annual|semi|semiannual|semi-annual|tpv|tcs|tpa|rds|supp|supplemental|installments?|1st|2nd|final|re-?run|split payment|sanitation|sewer)$/i,
      ''
    );
    if (next === rest) break;
    rest = next.trim();
  }
  rest = rest.replace(/\s+(county|co|parish|perish|borough)$/i, '').trim();
  rest = humanizeCounty(rest);
  rest = rest.replace(/\s+/g, ' ').trim();
  rest = rest.replace(/\bst\.?\s+/gi, 'St ');
  rest = rest.replace(/\bprince\s*george'?s?\b/gi, 'Prince George');
  if (!rest) return null;
  const n = compactName(rest);
  if (!n || n === 'multiple' || n === 'misc') return null;
  return { state: st, county: rest, raw: text };
}

function loadCensusIndex() {
  if (!fs.existsSync(CENSUS_PATH)) return new Map();
  const rows = JSON.parse(fs.readFileSync(CENSUS_PATH, 'utf8'));
  const byState = new Map();
  for (const r of rows) {
    const st = (r.state || '').toUpperCase();
    if (!byState.has(st)) byState.set(st, []);
    byState.get(st).push({ county: r.county, fips: r.fips, compact: compactName(r.county) });
  }
  return byState;
}

function dbIndex(counties) {
  const byState = new Map();
  for (const c of counties) {
    const st = (c.state || '').toUpperCase();
    if (!byState.has(st)) byState.set(st, []);
    byState.get(st).push({ row: c, compact: compactName(c.county) });
  }
  return byState;
}

function bestFuzzy(compact, list, maxDist) {
  let best = null;
  for (const item of list || []) {
    if (!item.compact) continue;
    if (item.compact === compact) return { dist: 0, item };
    const d = levenshtein(compact, item.compact);
    if (d <= maxDist && Math.min(compact.length, item.compact.length) >= 4) {
      if (!best || d < best.dist) best = { dist: d, item };
    }
  }
  return best;
}

function canonicalize(parsed, censusByState, dbByState) {
  const fromKey = aliasLookupKey(parsed.state, parsed.county);
  if (HARD_ALIASES[fromKey]) {
    const a = HARD_ALIASES[fromKey];
    return { state: a.state, county: a.county, match: 'hard_alias', fromKey };
  }
  const compact = compactName(parsed.county);
  const dbList = dbByState.get(parsed.state) || [];
  const censusList = censusByState.get(parsed.state) || [];

  const dbExact = dbList.find((x) => x.compact === compact);
  if (dbExact) {
    return { state: dbExact.row.state, county: dbExact.row.county, match: 'db_exact', fromKey };
  }
  const censusExact = censusList.find((x) => x.compact === compact);
  if (censusExact) {
    return { state: parsed.state, county: censusExact.county, match: 'census_exact', fromKey };
  }

  const dbF = bestFuzzy(compact, dbList, 1);
  if (dbF && dbF.dist <= 1) {
    return {
      state: dbF.item.row.state,
      county: dbF.item.row.county,
      match: `db_fuzzy${dbF.dist}`,
      fromKey
    };
  }
  const cenF = bestFuzzy(compact, censusList, 1);
  if (cenF && cenF.dist <= 1) {
    return {
      state: parsed.state,
      county: cenF.item.county,
      match: `census_fuzzy${cenF.dist}`,
      fromKey
    };
  }

  const stripped = parsed.county.replace(
    /\s+(city|town|township|twp|tsp|village|boro|borough|treasurer|clerk|assessor)$/i,
    ''
  ).trim();
  if (stripped && compactName(stripped) !== compact) {
    const sub = canonicalize(
      { state: parsed.state, county: stripped, raw: parsed.raw },
      censusByState,
      dbByState
    );
    if (sub.match !== 'sheet_raw') {
      return { ...sub, match: `strip_${sub.match}`, fromKey };
    }
  }

  const dbF2 = bestFuzzy(compact, dbList, 2);
  if (dbF2 && dbF2.dist === 2) {
    return {
      state: dbF2.item.row.state,
      county: dbF2.item.row.county,
      match: 'db_fuzzy2',
      fromKey
    };
  }
  const cenF2 = bestFuzzy(compact, censusList, 2);
  if (cenF2 && cenF2.dist === 2) {
    return {
      state: parsed.state,
      county: cenF2.item.county,
      match: 'census_fuzzy2',
      fromKey
    };
  }

  return { state: parsed.state, county: parsed.county, match: 'sheet_raw', fromKey };
}

function rowsFromCsvText(text, tabName) {
  const rows = parseCsv(text);
  const out = [];
  for (const row of rows) {
    const raw = fileNameFromRow(row);
    const parsed = parseFileName(raw);
    if (parsed) out.push({ ...parsed, tab: tabName });
  }
  return out;
}

async function fetchTabCsv(gid) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 SearchSpulSync/1.0' } });
  if (!res.ok) throw new Error(`sheet fetch ${gid} HTTP ${res.status}`);
  return res.text();
}

async function loadSheetHits(options = {}) {
  const cacheDir = options.cacheDir || path.join(require('os').tmpdir(), 'sheet-tabs');
  const hits = [];
  const fetchErrors = [];
  for (const tab of SHEET_TABS) {
    const cacheName = tab.name.replace(/\s+/g, '_');
    const cachePath = path.join(cacheDir, `${cacheName}.csv`);
    let text = null;
    if (options.offline && fs.existsSync(cachePath)) {
      text = fs.readFileSync(cachePath, 'utf8');
    } else {
      try {
        text = await fetchTabCsv(tab.gid);
        fs.mkdirSync(cacheDir, { recursive: true });
        fs.writeFileSync(cachePath, text);
      } catch (err) {
        fetchErrors.push({ tab: tab.name, gid: tab.gid, error: String(err.message || err) });
        if (fs.existsSync(cachePath)) text = fs.readFileSync(cachePath, 'utf8');
      }
    }
    if (!text) continue;
    hits.push(...rowsFromCsvText(text, tab.name));
  }
  return { hits, fetchErrors };
}

function buildCatalog(hits, counties) {
  const censusByState = loadCensusIndex();
  const dbBy = dbIndex(counties);
  const unique = new Map();
  const aliases = { ...HARD_ALIASES };

  for (const hit of hits) {
    const canon = canonicalize(hit, censusByState, dbBy);
    const dk = dedupeKey(canon.state, canon.county);
    const rec = unique.get(dk) || {
      state: canon.state,
      county: canon.county,
      key: masterKey(canon.state, canon.county),
      match: canon.match,
      fileHits: 0,
      sourceTabs: [],
      sampleRaw: [],
      inCountiesJson: Boolean((dbBy.get(canon.state) || []).find((x) => x.compact === compactName(canon.county)))
    };
    rec.fileHits += 1;
    if (!rec.sourceTabs.includes(hit.tab)) rec.sourceTabs.push(hit.tab);
    if (rec.sampleRaw.length < 4 && !rec.sampleRaw.includes(hit.raw)) rec.sampleRaw.push(hit.raw);
    if (canon.match !== 'sheet_raw' && rec.match === 'sheet_raw') rec.match = canon.match;
    unique.set(dk, rec);

    const fromKey = aliasLookupKey(hit.state, hit.county);
    const same =
      compactName(hit.county) === compactName(canon.county) && hit.state === canon.state;
    if (!same && !aliases[fromKey]) {
      aliases[fromKey] = { state: canon.state, county: canon.county };
    }
  }

  const jurisdictions = Array.from(unique.values()).sort((a, b) =>
    `${a.state}-${a.county}`.localeCompare(`${b.state}-${b.county}`)
  );

  return {
    source: {
      spreadsheetId: SHEET_ID,
      title: 'WPT Production Log 03012018',
      url: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=1491656814`,
      tabs: SHEET_TABS
    },
    generatedAt: new Date().toISOString().slice(0, 10),
    counts: {
      uniqueJurisdictions: jurisdictions.length,
      alreadyInCountiesJson: jurisdictions.filter((j) => j.inCountiesJson).length,
      missingFromCountiesJson: jurisdictions.filter((j) => !j.inCountiesJson).length,
      fileHits: hits.length
    },
    jurisdictions,
    aliases
  };
}

function writeCatalogArtifacts(catalog) {
  const slim = {
    source: catalog.source,
    generatedAt: catalog.generatedAt,
    counts: catalog.counts,
    jurisdictions: catalog.jurisdictions
  };
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(slim, null, 2) + '\n');
  fs.writeFileSync(ALIASES_PATH, JSON.stringify(catalog.aliases, null, 2) + '\n');
  return { catalogPath: CATALOG_PATH, aliasesPath: ALIASES_PATH };
}

function stubCountyFromCatalog(j) {
  const inDb = j.inCountiesJson;
  return {
    state: j.state,
    county: j.county,
    key: j.key,
    entityType: 'tax_collector',
    entity: `${j.county}, ${j.state} — WPT production-log jurisdiction`,
    entityNote:
      'Present on the WPT Production Log (CoreLogic / Lereta / Lument / NTS / Master Log / UPF). No verified Search Spul collector URL yet — do not invent a host.',
    vendor: '',
    searchURL: '',
    verified: false,
    lastChecked: new Date().toISOString().slice(0, 10),
    importSource: 'WPT_PRODUCTION_LOG',
    coverageStatus: inDb ? 'present' : 'needs_correction',
    wptProductionLog: true,
    wptFileHits: j.fileHits
  };
}

module.exports = {
  SHEET_ID,
  SHEET_TABS,
  HARD_ALIASES,
  compactName,
  parseFileName,
  parseCsv,
  rowsFromCsvText,
  loadSheetHits,
  buildCatalog,
  writeCatalogArtifacts,
  stubCountyFromCatalog,
  canonicalize,
  loadCensusIndex,
  aliasLookupKey
};
