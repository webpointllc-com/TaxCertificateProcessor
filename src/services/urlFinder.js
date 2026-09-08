const fs = require('fs');
const path = require('path');
const { isRealHttpUrl, hasUrlLock, compactJurisdictionName, isGoogleFallbackUrl } = require('./spulTruth');

const countiesPath = path.join(__dirname, '../../data/counties.json');
const goldenPath = path.join(__dirname, '../../data/golden_overrides.json');
const aliasesPath = path.join(__dirname, '../../data/sheet_aliases.json');
let countiesCache = null;
let goldenCache = null;
let aliasCache = null;

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

function invalidateGoldenCache() {
  goldenCache = null;
  aliasCache = null;
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
  if (golden && golden.searchURL && isRealHttpUrl(golden.searchURL)) {
    return {
      url: golden.searchURL,
      confidence: 'verified',
      source: 'golden_override (runtime)',
      entityType: golden.entityType || 'tax_collector',
      entityNote: golden.entityNote || '',
      entity: golden.entity || '',
      vendor: golden.vendor || '',
      rejectURLs: golden.rejectURLs || [],
      rdsURL: golden.rdsURL || '',
      gisURL: golden.gisURL || '',
      treasurerURL: golden.treasurerURL || '',
      coverageStatus: 'verified'
    };
  }

  const meta = (c) => ({
    entityType: c.entityType || 'tax_collector',
    entityNote: c.entityNote || '',
    entity: c.entity || '',
    vendor: c.vendor || '',
    rejectURLs: c.rejectURLs || [],
    coverageStatus: c.coverageStatus || (c.verified ? 'verified' : 'needs_correction'),
    rdsURL: c.rdsURL || '',
    gisURL: c.gisURL || '',
    treasurerURL: c.treasurerURL || ''
  });

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

function parseJurisdictionRaw(message) {
  let msg = message.toLowerCase().trim();
  msg = msg
    .replace(/^(where do i |how do i |i need (the )?|help me )+/i, '')
    .replace(/\b(search by last name|search by owner|tax bill lookup|bill lookup|lookup)\b.*$/i, '')
    .replace(/\b(property tax|property taxes)\b/gi, ' property taxes ')
    .replace(/\s+/g, ' ')
    .trim();

  const stateMap = {
    'tx': 'TX', 'fl': 'FL', 'ga': 'GA', 'il': 'IL', 'ca': 'CA',
    'ny': 'NY', 'nc': 'NC', 'sc': 'SC', 'va': 'VA', 'pa': 'PA',
    'oh': 'OH', 'mi': 'MI', 'az': 'AZ', 'co': 'CO', 'wa': 'WA',
    'or': 'OR', 'tn': 'TN', 'al': 'AL', 'ms': 'MS', 'mo': 'MO',
    'la': 'LA', 'ar': 'AR', 'ok': 'OK', 'nm': 'NM', 'nv': 'NV',
    'ut': 'UT', 'id': 'ID', 'mt': 'MT', 'wy': 'WY', 'nd': 'ND',
    'sd': 'SD', 'ne': 'NE', 'ks': 'KS', 'mn': 'MN', 'ia': 'IA',
    'wi': 'WI', 'in': 'IN', 'ky': 'KY', 'wv': 'WV', 'md': 'MD',
    'de': 'DE', 'nj': 'NJ', 'ct': 'CT', 'ri': 'RI', 'ma': 'MA',
    'vt': 'VT', 'nh': 'NH', 'me': 'ME', 'hi': 'HI', 'ak': 'AK',
    'dc': 'DC', 'pr': 'PR'
  };

  const stateNames = {
    'texas': 'TX', 'florida': 'FL', 'georgia': 'GA', 'illinois': 'IL',
    'california': 'CA', 'new york': 'NY', 'north carolina': 'NC',
    'south carolina': 'SC', 'virginia': 'VA', 'pennsylvania': 'PA',
    'ohio': 'OH', 'michigan': 'MI', 'arizona': 'AZ', 'colorado': 'CO',
    'washington': 'WA', 'oregon': 'OR', 'tennessee': 'TN', 'alabama': 'AL',
    'mississippi': 'MS', 'missouri': 'MO', 'louisiana': 'LA', 'arkansas': 'AR',
    'oklahoma': 'OK', 'new mexico': 'NM', 'nevada': 'NV', 'utah': 'UT',
    'new jersey': 'NJ', 'maryland': 'MD', 'minnesota': 'MN', 'wisconsin': 'WI',
    'indiana': 'IN', 'kentucky': 'KY', 'kansas': 'KS', 'nebraska': 'NE',
    'district of columbia': 'DC', 'puerto rico': 'PR', 'rhode island': 'RI',
    'massachusetts': 'MA', 'connecticut': 'CT'
  };

  // CAD / appraisal district → always TX
  const cadMatch = /([a-z][a-z\s\-]+?)\s+(?:county\s+)?(?:cad|central appraisal district|appraisal district)/i.exec(msg);
  if (cadMatch) {
    const county = cadMatch[1].trim().replace(/\s*county\s*$/i, '').trim();
    return { county, state: 'TX' };
  }

  // "[name], ST" or "[name] ST" (city-county / common chat queries, e.g. "San Diego, CA", "Denver CO")
  const commaState = /([a-z][a-z\s\-]+?),\s*([a-z]{2})\b/i.exec(msg);
  if (commaState) {
    const abbr = commaState[2].toLowerCase();
    return {
      county: commaState[1].trim().replace(/\s*county\s*$/i, '').trim(),
      state: stateMap[abbr] || abbr.toUpperCase()
    };
  }
  const payTaxes = /(?:pay\s+)?property taxes?\s+([a-z][a-z\s\-]+?)\s+([a-z]{2})\b/i.exec(msg);
  if (payTaxes && stateMap[payTaxes[2].toLowerCase()]) {
    return {
      county: payTaxes[1].trim().replace(/\s*county\s*$/i, '').trim(),
      state: stateMap[payTaxes[2].toLowerCase()]
    };
  }

  for (const [name, abbr] of Object.entries(stateNames)) {
    const payFullState = new RegExp(
      `(?:pay\\s+)?property taxes?\\s+([a-z][a-z\\s\\-]+?)\\s+${name}\\b`,
      'i'
    ).exec(msg);
    if (payFullState) {
      return {
        county: payFullState[1].trim().replace(/\s*county\s*$/i, '').trim(),
        state: abbr
      };
    }
  }

  const inlineCityState =
    /\b([a-z][a-z\s\-]{1,40}?)\s+([a-z]{2})\b/i.exec(msg);
  if (inlineCityState && stateMap[inlineCityState[2].toLowerCase()]) {
    let name = inlineCityState[1]
      .trim()
      .replace(/\s*county\s*$/i, '')
      .replace(/^(?:pay|property)\s+taxes?\s+/i, '')
      .trim();
    if (name.split(/\s+/).length <= 4 && name.length > 1) {
      return {
        county: name,
        state: stateMap[inlineCityState[2].toLowerCase()]
      };
    }
  }

  const trailingState = /\b([a-z][a-z\s\-]{1,48}?)\s+([a-z]{2})\s*$/i.exec(msg);
  if (trailingState && stateMap[trailingState[2].toLowerCase()]) {
    const name = trailingState[1].trim().replace(/\s*county\s*$/i, '').trim();
    if (name.split(/\s+/).length <= 4) {
      return {
        county: name,
        state: stateMap[trailingState[2].toLowerCase()]
      };
    }
  }

  // "[name] county, ST" or "[name] county ST"
  const withState = /([a-z][a-z\s\-]+?)\s+county[\s,]+([a-z]{2})\b/i.exec(msg);
  if (withState) {
    const abbr = withState[2].toLowerCase();
    return { county: withState[1].trim(), state: stateMap[abbr] || abbr.toUpperCase() };
  }

  // "[name] county" alone — check for state name elsewhere in message
  const countyOnly = /([a-z][a-z\s\-]+?)\s+county/i.exec(msg);
  if (countyOnly) {
    let state = null;
    for (const [name, abbr] of Object.entries(stateNames)) {
      if (msg.includes(name)) { state = abbr; break; }
    }
    return { county: countyOnly[1].trim(), state };
  }

  // State name present without explicit "county" word
  for (const [name, abbr] of Object.entries(stateNames)) {
    if (msg.includes(name)) {
      const before = msg.split(name)[0].trim().split(/\s+/).slice(-3).join(' ')
        .replace(/[,]+$/, '').replace(/\bcounty\b/i, '').trim();
      if (before.length > 1) return { county: before, state: abbr };
    }
  }

  return { county: null, state: null };
}

function lookupForApi(county, state) {
  const result = findPropertyURL(county, state);
  const locked = hasUrlLock(result.confidence, result.url);
  const googleFallback = isGoogleFallbackUrl(result.url);
  const known = knownRecord(county, state);
  return {
    ...result,
    urlLocked: locked,
    lockedUrl: locked ? result.url : null,
    officialUrl: locked ? result.url : null,
    googleFallback,
    displayUrl: locked ? result.url : null,
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
  invalidateCountiesCache,
  loadCounties,
  hasUrlLock,
  countyInDatabase,
  findGoldenOverride,
  resolveAlias,
  compactName,
  suggestJurisdictions
};
