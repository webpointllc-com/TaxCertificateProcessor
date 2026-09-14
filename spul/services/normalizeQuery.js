'use strict';

/**
 * Layer B — local alias / NLP-lite normalization.
 * Rewrites common city / abbreviation queries into registry-friendly
 * "County, ST" forms. Never invents URLs — only reshapes the query string.
 */

/** City / metro / nickname → registry county + state (must exist in Extractor index). */
const CITY_ALIASES = {
  chicago: { county: 'Cook', state: 'IL' },
  'chi town': { county: 'Cook', state: 'IL' },
  houston: { county: 'Harris', state: 'TX' },
  phoenix: { county: 'Maricopa', state: 'AZ' },
  'las vegas': { county: 'Clark', state: 'NV' },
  vegas: { county: 'Clark', state: 'NV' },
  miami: { county: 'Miami Dade', state: 'FL' },
  'miami dade': { county: 'Miami Dade', state: 'FL' },
  tampa: { county: 'Hillsborough', state: 'FL' },
  'st petersburg': { county: 'Pinellas', state: 'FL' },
  'saint petersburg': { county: 'Pinellas', state: 'FL' },
  jacksonville: { county: 'Duval', state: 'FL' },
  'fort lauderdale': { county: 'Broward', state: 'FL' },
  orlando: { county: 'Orange', state: 'FL' },
  'west palm beach': { county: 'Palm Beach', state: 'FL' },
  atlanta: { county: 'Fulton', state: 'GA' },
  charlotte: { county: 'Mecklenburg', state: 'NC' },
  raleigh: { county: 'Wake', state: 'NC' },
  detroit: { county: 'Wayne', state: 'MI' },
  cleveland: { county: 'Cuyahoga', state: 'OH' },
  pittsburgh: { county: 'Allegheny', state: 'PA' },
  philadelphia: { county: 'Philadelphia City', state: 'PA' },
  philly: { county: 'Philadelphia City', state: 'PA' },
  minneapolis: { county: 'Hennepin', state: 'MN' },
  'st paul': { county: 'Ramsey', state: 'MN' },
  'saint paul': { county: 'Ramsey', state: 'MN' },
  seattle: { county: 'King', state: 'WA' },
  portland: { county: 'Multnomah', state: 'OR' }, // OR preferred over ME (ME not in index)
  denver: { county: 'Denver', state: 'CO' },
  'salt lake city': { county: 'Salt Lake', state: 'UT' },
  'salt lake': { county: 'Salt Lake', state: 'UT' },
  honolulu: { county: 'Honolulu', state: 'HI' },
  anchorage: { county: 'Anchorage', state: 'AK' },
  austin: { county: 'Travis', state: 'TX' },
  'san antonio': { county: 'Bexar', state: 'TX' },
  dallas: { county: 'Dallas', state: 'TX' }, // TX preferred over AR/IA/MO when city-like
  'fort worth': { county: 'Tarrant', state: 'TX' },
  'san francisco': { county: 'San Francisco', state: 'CA' },
  sf: { county: 'San Francisco', state: 'CA' },
  'san jose': { county: 'Santa Clara', state: 'CA' },
  oakland: { county: 'Alameda', state: 'CA' },
  'los angeles': { county: 'Los Angeles', state: 'CA' },
  'new orleans': { county: 'New Orleans Parish', state: 'LA' },
  nola: { county: 'New Orleans Parish', state: 'LA' },
  'new york': { county: 'New York City', state: 'NY' },
  'new york city': { county: 'New York City', state: 'NY' },
  nyc: { county: 'New York City', state: 'NY' },
  manhattan: { county: 'Manhattan Boro', state: 'NY' },
  brooklyn: { county: 'Brooklyn Boro', state: 'NY' },
  queens: { county: 'Queens Boro', state: 'NY' },
  bronx: { county: 'Bronx Boro', state: 'NY' },
  'staten island': { county: 'Staten Island Boro', state: 'NY' },
};

/** Compact abbreviations that are statistically county-scoped (not bare state codes). */
const ABBREV_ALIASES = {
  'la county': { county: 'Los Angeles', state: 'CA' },
  'l.a. county': { county: 'Los Angeles', state: 'CA' },
  'la co': { county: 'Los Angeles', state: 'CA' },
  'sd county': { county: 'San Diego', state: 'CA' },
  's.d. county': { county: 'San Diego', state: 'CA' },
  'oc county': { county: 'Orange', state: 'CA' },
  'orange county ca': { county: 'Orange', state: 'CA' },
  'orange county california': { county: 'Orange', state: 'CA' },
  'sf county': { county: 'San Francisco', state: 'CA' },
  'nyc tax': { county: 'New York City', state: 'NY' },
};

/** Office-role synonyms stripped before county match (intent stays in guide.js). */
const OFFICE_NOISE =
  /\b(treasurer|collector|tax\s*collector|assessor|cad|appraisal|auditor|revenue\s*commissioner|tax\s*office|property\s*appraiser)\b/gi;

/** APN / PIN / account-ish tokens — signal parcel intent, not a jurisdiction. */
const PARCEL_RE =
  /\b(?:apn|pin|folio|parcel(?:\s*(?:id|no|number|#))?|account(?:\s*(?:no|number|#))?)\s*[:#]?\s*[A-Z0-9][-A-Z0-9.\/]{4,}\b/i;

/** 5-digit FIPS county code (SSCCC) — rare in user chat; documented for future. */
const FIPS_RE = /\b([0-9]{5})\b/;

function stripDiacritics(s) {
  return String(s || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
}

function softNormalize(s) {
  return stripDiacritics(s)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s.,#'/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Light typo fold for a few high-traffic counties (edit-distance 1–2 patterns).
 * Only applied when the whole remaining county token matches.
 */
const TYPO_MAP = {
  sandiego: 'san diego',
  'san dieogo': 'san diego',
  'san dieago': 'san diego',
  losangeles: 'los angeles',
  'los angles': 'los angeles',
  'los angelas': 'los angeles',
  philidelphia: 'philadelphia',
  philedelphia: 'philadelphia',
  'new orlean': 'new orleans',
  'new orleanas': 'new orleans',
  alberquerque: 'albuquerque', // may still miss if not in index
  'san antonioo': 'san antonio',
};

/** Intent / filler words removed before city alias detection. */
const INTENT_NOISE =
  /\b(please|help|find|locate|open|go|to|for|and|or|by|with|from|my|our|your|me|pay|paying|payment|property|taxes?|tax|search|lookup|look|up|bill|bills|parcel|account|pin|apn|owner|address|online|website|page|official|in|the|a|an)\b/gi;

function extractStateToken(q) {
  const STATE_OK = new Set([
    'al','ak','az','ar','ca','co','ct','de','fl','ga','hi','id','il','in','ia','ks','ky',
    'la','me','md','ma','mi','mn','ms','mo','mt','ne','nv','nh','nj','nm','ny','nc','nd',
    'oh','ok','or','pa','ri','sc','sd','tn','tx','ut','vt','va','wa','wv','wi','wy','dc',
  ]);
  const parts = q.split(/[\s,]+/).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    if (parts[i].length === 2 && STATE_OK.has(parts[i])) return parts[i].toUpperCase();
  }
  return null;
}

/**
 * @param {string} raw
 * @returns {{
 *   query: string,
 *   original: string,
 *   aliasApplied: string|null,
 *   aliasTarget: {county:string,state:string}|null,
 *   signals: {parcelLike:boolean, fips:string|null, officeNoise:boolean},
 *   notes: string[]
 * }}
 */
function normalizeQuery(raw) {
  const original = String(raw || '').trim();
  const notes = [];
  const signals = {
    parcelLike: PARCEL_RE.test(original),
    fips: null,
    officeNoise: false,
  };

  if (!original) {
    return {
      query: '',
      original,
      aliasApplied: null,
      aliasTarget: null,
      signals,
      notes: ['empty'],
    };
  }

  let q = softNormalize(original);
  if (OFFICE_NOISE.test(q)) {
    signals.officeNoise = true;
    q = q.replace(OFFICE_NOISE, ' ').replace(/\s+/g, ' ').trim();
    notes.push('stripped_office_synonym');
  }

  // Strip intent filler so "pay taxes Austin TX" → "austin tx"
  const intentStripped = q.replace(INTENT_NOISE, ' ').replace(/\s+/g, ' ').trim();
  if (intentStripped && intentStripped !== q) {
    q = intentStripped;
    notes.push('stripped_intent_noise');
  }

  const fipsMatch = q.match(FIPS_RE);
  if (fipsMatch) {
    signals.fips = fipsMatch[1];
    notes.push('fips_token_detected_no_registry_map');
  }

  // Exact abbrev / phrase aliases first (longer keys first)
  const abbrevKeys = Object.keys(ABBREV_ALIASES).sort((a, b) => b.length - a.length);
  for (const key of abbrevKeys) {
    if (q === key || q.startsWith(key + ' ') || q.endsWith(' ' + key) || q.includes(' ' + key + ' ')) {
      const t = ABBREV_ALIASES[key];
      notes.push(`abbrev:${key}`);
      return {
        query: `${t.county}, ${t.state}`,
        original,
        aliasApplied: key,
        aliasTarget: t,
        signals,
        notes,
      };
    }
  }

  // Typo fold on remaining core
  if (TYPO_MAP[q]) {
    q = TYPO_MAP[q];
    notes.push('typo_fold');
  } else {
    // typo on multi-word cores without state
    const noState = q.replace(/\b(al|ak|az|ar|ca|co|ct|de|fl|ga|hi|id|il|in|ia|ks|ky|la|me|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|oh|ok|or|pa|ri|sc|sd|tn|tx|ut|vt|va|wa|wv|wi|wy|dc)\b/g, ' ').replace(/\s+/g, ' ').trim();
    if (TYPO_MAP[noState]) {
      const st = extractStateToken(q);
      q = st ? `${TYPO_MAP[noState]} ${st.toLowerCase()}` : TYPO_MAP[noState];
      notes.push('typo_fold');
    }
  }

  const stateInQ = extractStateToken(q);
  const cityKeys = Object.keys(CITY_ALIASES).sort((a, b) => b.length - a.length);
  for (const key of cityKeys) {
    const esc = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const contained = new RegExp(`(?:^|\\s)${esc}(?:\\s|,|$)`).test(q);
    if (!contained) continue;
    const t = CITY_ALIASES[key];
    if (stateInQ && stateInQ !== t.state) {
      notes.push('city_alias_skipped_state_conflict');
      continue;
    }
    notes.push(`city:${key}`);
    return {
      query: `${t.county}, ${t.state}`,
      original,
      aliasApplied: key,
      aliasTarget: t,
      signals,
      notes,
    };
  }

  if (q !== softNormalize(original)) {
    notes.push('soft_normalized');
  }

  return {
    query: q || original,
    original,
    aliasApplied: null,
    aliasTarget: null,
    signals,
    notes,
  };
}

module.exports = {
  normalizeQuery,
  CITY_ALIASES,
  ABBREV_ALIASES,
  TYPO_MAP,
  PARCEL_RE,
};
