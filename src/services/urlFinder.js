const fs = require('fs');
const path = require('path');
const {
  isRealHttpUrl,
  hasUrlLock,
  compactJurisdictionName,
  isGoogleFallbackUrl,
  isGenericCountyHomepage
} = require('./spulTruth');
const { parseJurisdictionRaw } = require('./parseJurisdiction');

const countiesPath = path.join(__dirname, '../../data/counties.json');
const goldenPath = path.join(__dirname, '../../data/golden_overrides.json');
const aliasesPath = path.join(__dirname, '../../data/sheet_aliases.json');
const playbooksPath = path.join(__dirname, '../../data/extractor_playbooks.json');
let countiesCache = null;
let goldenCache = null;
let aliasCache = null;
let playbookCache = null;

function compactName(s) {
  return compactJurisdictionName(s);
}

function loadCounties() {
  if (!countiesCache) {
    countiesCache = JSON.parse(fs.readFileSync(countiesPath, 'utf8'));
  }
  return countiesCache;
}

function loadGoldenOverrides() {
  if (goldenCache !== null) return goldenCache;
  if (!fs.existsSync(goldenPath)) {
    goldenCache = new Map();
    return goldenCache;
  }
  const raw = JSON.parse(fs.readFileSync(goldenPath, 'utf8'));
  const entries =
    raw && typeof raw === 'object' && !Array.isArray(raw) && raw.overrides ? raw.overrides : raw;
  goldenCache = new Map();
  for (const [key, val] of Object.entries(entries || {})) {
    if (key.startsWith('_')) continue;
    goldenCache.set(key, val);
  }
  return goldenCache;
}

function loadAliases() {
  if (aliasCache !== null) return aliasCache;
  aliasCache = {};
  if (fs.existsSync(aliasesPath)) {
    try {
      aliasCache = JSON.parse(fs.readFileSync(aliasesPath, 'utf8')) || {};
    } catch {
      aliasCache = {};
    }
  }
  return aliasCache;
}

function aliasLookupKey(state, county) {
  return `${(state || '').toUpperCase().trim()}:${compactName(county)}`;
}

function resolveAlias(county, state) {
  const aliases = loadAliases();
  const st = (state || '').toUpperCase().trim();
  const co = (county || '').trim();
  if (!co) return { county: co, state: st || null, aliased: false };
  const hit = aliases[aliasLookupKey(st, co)];
  if (hit && hit.county) {
    return {
      county: hit.county,
      state: (hit.state || st).toUpperCase(),
      aliased: true
    };
  }
  return { county: co, state: st || null, aliased: false };
}

function goldenKeyFor(county, state) {
  const st = (state || '').toUpperCase().trim();
  const co = (county || '').trim();
  return `${st}-${co}`;
}

function findGoldenOverride(county, state) {
  const resolved = resolveAlias(county, state);
  const map = loadGoldenOverrides();
  const direct = map.get(goldenKeyFor(resolved.county, resolved.state));
  if (direct) return direct;
  const normalizedCounty = compactName(resolved.county);
  const st = (resolved.state || '').toUpperCase().trim();
  for (const [, val] of map) {
    if (
      val.state === st &&
      val.county &&
      compactName(val.county) === normalizedCounty
    ) {
      return val;
    }
  }
  return null;
}

function loadPlaybooks() {
  if (playbookCache !== null) return playbookCache;
  playbookCache = {};
  if (!fs.existsSync(playbooksPath)) return playbookCache;
  try {
    const raw = JSON.parse(fs.readFileSync(playbooksPath, 'utf8'));
    const entries = raw && raw.playbooks ? raw.playbooks : raw;
    for (const [key, val] of Object.entries(entries || {})) {
      if (key.startsWith('_')) continue;
      playbookCache[key] = val;
    }
  } catch {
    playbookCache = {};
  }
  return playbookCache;
}

function playbookFor(county, state) {
  const st = (state || '').toUpperCase().trim();
  const co = compactName(county);
  const books = loadPlaybooks();
  const direct = books[`${st}-${county}`] || books[`${st}-${String(county || '').replace(/\s+/g, '')}`];
  if (direct) return direct;
  for (const [key, val] of Object.entries(books)) {
    if (!val || !val.county) continue;
    if ((val.state || key.split('-')[0]) === st && compactName(val.county) === co) return val;
  }
  return null;
}

function invalidateGoldenCache() {
  goldenCache = null;
  aliasCache = null;
  playbookCache = null;
}

function invalidateCountiesCache() {
  countiesCache = null;
  invalidateGoldenCache();
}

function sameJurisdiction(row, county, state) {
  const normalizedCounty = compactName(county);
  const normalizedState = state ? state.toUpperCase().trim() : '';
  return (
    compactName(row.county) === normalizedCounty &&
    (!normalizedState || row.state === normalizedState)
  );
}

function countyInDatabase(county, state) {
  const resolved = resolveAlias(county, state);
  const counties = loadCounties();
  return counties.some((c) => sameJurisdiction(c, resolved.county, resolved.state));
}

function knownRecord(county, state) {
  const resolved = resolveAlias(county, state);
  const counties = loadCounties();
  return counties.find((c) => sameJurisdiction(c, resolved.county, resolved.state)) || null;
}

function findPropertyURL(county, state) {
  const resolved = resolveAlias(county, state);
  county = resolved.county;
  state = resolved.state;

  const counties = loadCounties();
  const normalizedCounty = compactName(county);
  const normalizedState = state ? state.toUpperCase().trim() : '';

  const golden = findGoldenOverride(county, state);
  const playbook = playbookFor(county, state);
  if (golden) {
    if (golden.searchURL && isRealHttpUrl(golden.searchURL)) {
      return {
        url: golden.searchURL,
        confidence: 'verified',
        source: 'golden_override (runtime)',
        entityType: golden.entityType || 'tax_collector',
        entityNote: golden.entityNote || (playbook && playbook.entityNote) || '',
        entity: golden.entity || '',
        vendor: golden.vendor || '',
        rejectURLs: golden.rejectURLs || [],
        rdsURL: golden.rdsURL || '',
        gisURL: golden.gisURL || '',
        treasurerURL: golden.treasurerURL || '',
        coverageStatus: 'verified',
        layout: golden.layout || playbook?.layout || null,
        method: golden.method || playbook?.method || null,
        howFound: playbook?.how_found || golden.howFound || '',
        parcelFormat: golden.parcelFormat || playbook?.parcel_format || ''
      };
    }
    if (golden.verified === false || golden.coverageStatus === 'needs_correction') {
      return {
        url: null,
        confidence: 'not_found',
        source:
          golden.entityNote ||
          'Golden override cleared a bad catalog URL — no collector search page until confirmed',
        entityType: golden.entityType || 'unknown',
        entityNote: golden.entityNote || '',
        entity: golden.entity || '',
        vendor: golden.vendor || '',
        rejectURLs: golden.rejectURLs || [],
        coverageStatus: 'needs_correction',
        layout: playbook?.layout || null,
        method: playbook?.method || null,
        howFound: playbook?.how_found || golden.howFound || ''
      };
    }
  }

  const meta = (c) => {
    const book = playbook || playbookFor(c.county, c.state);
    return {
      entityType: c.entityType || 'tax_collector',
      entityNote: c.entityNote || book?.entityNote || '',
      entity: c.entity || '',
      vendor: c.vendor || '',
      rejectURLs: c.rejectURLs || [],
      coverageStatus: c.coverageStatus || (c.verified ? 'verified' : 'needs_correction'),
      rdsURL: c.rdsURL || '',
      gisURL: c.gisURL || '',
      treasurerURL: c.treasurerURL || '',
      layout: c.layout || book?.layout || null,
      method: book?.method || null,
      howFound: book?.how_found || '',
      parcelFormat: c.parcelFormat || book?.parcel_format || ''
    };
  };

  // 1. Exact verified match (punctuation-insensitive)
  const exact = counties.find(
    (c) =>
      compactName(c.county) === normalizedCounty &&
      c.state === normalizedState &&
      c.verified === true
  );
  if (exact && isRealHttpUrl(exact.searchURL)) {
    return { url: exact.searchURL, confidence: 'verified', source: 'SPUL database (verified)', ...meta(exact) };
  }

  // 2. Partial name match (handles dashes vs spaces, e.g. "miami-dade" vs "miami dade")
  const partial = counties.find((c) => {
    return compactName(c.county) === normalizedCounty && (!normalizedState || c.state === normalizedState);
  });
  if (partial && isRealHttpUrl(partial.searchURL)) {
    return {
      url: partial.searchURL,
      confidence: partial.verified ? 'verified' : 'pattern_matched',
      source: `SPUL database (${partial.verified ? 'verified' : 'needs verification'})`,
      ...meta(partial)
    };
  }

  // 2b. Exact name match even when not flagged verified (bulk import rows)
  const exactAny = counties.find(
    (c) =>
      compactName(c.county) === normalizedCounty &&
      c.state === normalizedState &&
      isRealHttpUrl(c.searchURL)
  );
  if (exactAny) {
    return {
      url: exactAny.searchURL,
      confidence: exactAny.verified ? 'verified' : 'pattern_matched',
      source: `SPUL database (${exactAny.verified ? 'verified' : 'imported'})`,
      ...meta(exactAny)
    };
  }

  // 3. Known jurisdiction (WPT sheet / SPUL row) with no valid URL — honest not_found, never Google
  const known = knownRecord(county, state);
  if (known || countyInDatabase(county, state)) {
    return {
      url: null,
      confidence: 'not_found',
      source: 'SPUL record exists but no valid search URL — operator correction needed',
      entityType: (known && known.entityType) || 'unknown',
      entityNote: (known && known.entityNote) || '',
      entity: (known && known.entity) || '',
      rejectURLs: (known && known.rejectURLs) || [],
      coverageStatus: (known && known.coverageStatus) || 'needs_correction'
    };
  }

  const googleSearch = `https://www.google.com/search?q=${encodeURIComponent(
    `${county} ${state || ''} county tax assessor collector property search official site`.trim()
  )}`;
  return {
    url: googleSearch,
    confidence: 'not_found',
    source: 'No SPUL record — Google fallback',
    entityType: 'unknown',
    entityNote: '',
    entity: '',
    coverageStatus: 'unknown'
  };
}

// Parse raw user message into { county, state }
function parseJurisdiction(message) {
  const parsed = parseJurisdictionRaw(message);
  if (!parsed.county) return parsed;
  const resolved = resolveAlias(parsed.county, parsed.state);
  if (!resolved.aliased) return parsed;
  return { county: resolved.county, state: resolved.state };
}

function lookupForApi(county, state) {
  const result = findPropertyURL(county, state);
  const locked = hasUrlLock(result.confidence, result.url, result);
  const googleFallback = isGoogleFallbackUrl(result.url);
  const known = knownRecord(county, state);
  const homepageOnly = Boolean(result.url && isGenericCountyHomepage(result.url, result) && !locked);
  return {
    ...result,
    urlLocked: locked,
    lockedUrl: locked ? result.url : null,
    officialUrl: locked ? result.url : null,
    candidateUrl: !locked && result.url && !googleFallback ? result.url : null,
    googleFallback,
    displayUrl: locked ? result.url : null,
    homepageOnly,
    canonicalCounty: known ? known.county : county,
    canonicalState: known ? known.state : (state || null)
  };
}

function suggestJurisdictions(query, limit = 8) {
  const raw = String(query || '').trim();
  if (raw.length < 2) return [];
  const cap = Math.min(Math.max(Number(limit) || 8, 1), 20);
  const parsed = parseJurisdiction(raw);
  const needle = compactName(raw.replace(/\bcounty\b/gi, ' '));
  const counties = loadCounties();
  const scored = [];

  for (const c of counties) {
    const cname = compactName(c.county);
    const blob = cname + String(c.state || '').toLowerCase();
    let score = 0;
    if (
      parsed.county &&
      compactName(parsed.county) === cname &&
      (!parsed.state || parsed.state === c.state)
    ) {
      score = 10;
    } else if (needle && cname.startsWith(needle)) {
      score = 6;
    } else if (needle.length >= 3 && cname.includes(needle)) {
      score = 4;
    } else if (needle.length >= 3 && blob.includes(needle)) {
      score = 2;
    } else {
      continue;
    }
    if (c.verified || isRealHttpUrl(c.searchURL)) score += 1;
    if (c.state === 'WI' && cname === 'chippewa') score += 2;
    scored.push({
      county: c.county,
      state: c.state,
      label: `${c.county} County, ${c.state}`,
      coverageStatus: c.coverageStatus || (c.verified ? 'verified' : 'needs_correction'),
      score
    });
  }

  scored.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
  const seen = new Set();
  const out = [];
  for (const row of scored) {
    const key = `${row.state}-${compactName(row.county)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const lookup = lookupForApi(row.county, row.state);
    out.push({
      county: row.county,
      state: row.state,
      label: row.label,
      coverageStatus: lookup.coverageStatus || row.coverageStatus,
      urlLocked: Boolean(lookup.urlLocked),
      confidence: lookup.confidence || 'not_found'
    });
    if (out.length >= cap) break;
  }
  return out;
}

module.exports = {
  findPropertyURL,
  lookupForApi,
  parseJurisdiction,
  parseJurisdictionRaw,
  playbookFor,
  invalidateCountiesCache,
  loadCounties,
  hasUrlLock,
  countyInDatabase,
  findGoldenOverride,
  resolveAlias,
  compactName,
  suggestJurisdictions
};
