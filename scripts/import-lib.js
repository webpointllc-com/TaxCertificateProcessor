/** Shared helpers for import scripts (no side effects on load). */
const fs = require('fs');
const path = require('path');
const { compactJurisdictionName, isRealHttpUrl: spulIsRealHttpUrl } = require('../src/services/spulTruth');

const REPO_ROOT = path.join(__dirname, '..');
const COUNTIES_PATH = path.join(REPO_ROOT, 'data', 'counties.json');
const GOLDEN_PATH = path.join(REPO_ROOT, 'data', 'golden_overrides.json');
const LOCK_PATH = path.join(REPO_ROOT, '.agent-coord', 'LOCK');
const CATALOG_PATH = path.join(REPO_ROOT, 'data', 'wpt_production_counties.json');
const ALIASES_PATH = path.join(REPO_ROOT, 'data', 'sheet_aliases.json');
const CENSUS_PATH = path.join(REPO_ROOT, 'data', 'us_counties_census.json');

function compactName(s) {
  return compactJurisdictionName(s);
}

function normalizeKey(state, county) {
  const st = (state || '').toUpperCase().trim();
  const co = (county || '').trim();
  return `${st}-${co}`;
}

function masterKey(state, county) {
  const st = (state || '').toUpperCase().trim();
  const co = String(county || '').replace(/\s+/g, '');
  return `${st}-${co}`;
}

function dedupeKey(state, county) {
  return compactName(state) + compactName(county);
}

function aliasLookupKey(state, county) {
  return `${(state || '').toUpperCase().trim()}:${compactName(county)}`;
}

function humanizeCounty(name) {
  if (!name || /\s/.test(name)) return (name || '').trim();
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .trim();
}

function readNdjson(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line, i) => {
      try {
        return JSON.parse(line);
      } catch (e) {
        throw new Error(`${filePath}:${i + 1}: ${e.message}`);
      }
    });
}

function loadGoldenOverrides() {
  if (!fs.existsSync(GOLDEN_PATH)) return new Map();
  const raw = JSON.parse(fs.readFileSync(GOLDEN_PATH, 'utf8'));
  const entries =
    raw && typeof raw === 'object' && !Array.isArray(raw) && raw.overrides
      ? raw.overrides
      : raw;
  const map = new Map();
  for (const [key, val] of Object.entries(entries || {})) {
    if (key.startsWith('_')) continue;
    map.set(key, val);
  }
  return map;
}

function applyGoldenOverride(county, override) {
  const merged = { ...county };
  if (override.county) merged.county = override.county;
  if (override.state) merged.state = override.state.toUpperCase();
  if (override.searchURL) merged.searchURL = override.searchURL;
  if (override.vendor) merged.vendor = override.vendor;
  if (override.entity) merged.entity = override.entity;
  if (override.entityNote) merged.entityNote = override.entityNote;
  if (override.entityType) merged.entityType = override.entityType;
  if (override.verified === true) merged.verified = true;
  if (Array.isArray(override.rejectURLs) && override.rejectURLs.length) {
    merged.rejectURLs = override.rejectURLs;
  }
  if (override.rdsURL) merged.rdsURL = override.rdsURL;
  if (override.gisURL) merged.gisURL = override.gisURL;
  if (override.treasurerURL) merged.treasurerURL = override.treasurerURL;
  merged.importSource = 'golden_override';
  merged.coverageStatus = 'verified';
  merged.lastChecked = new Date().toISOString().slice(0, 10);
  return merged;
}

function isCountiesJsonLocked() {
  if (!fs.existsSync(LOCK_PATH)) return false;
  try {
    const lock = JSON.parse(fs.readFileSync(LOCK_PATH, 'utf8'));
    return lock.file === 'data/counties.json' && lock.holder && lock.holder !== 'lane-b';
  } catch {
    return false;
  }
}

function detectVendor(url) {
  try {
    const h = new URL(url).hostname.toLowerCase();
    if (h.includes('spatialest.com')) return 'spatialest';
    if (h.includes('sdttc.com') || h.includes('wps.sdttc')) return 'sdttc_webpayments';
    if (h.includes('landnav.com') || h.includes('catalis')) return 'catalis_landnav';
    if (h.includes('esearch') || h.includes('esearchgsa')) return 'esearch';
    if (h.includes('qpublic.net') || h.includes('qpublic')) return 'qpublic';
    if (h.includes('schneidercorp.com') || h.includes('beacon.')) return 'beacon';
    if (h.includes('countygovservices.com')) return 'countygovservices';
    if (h.includes('property.muni.org')) return 'muni_property';
    if (h.includes('civicplus')) return 'civicplus';
    if (h.includes('tyler') || h.includes('tylertech')) return 'tyler';
    if (h.includes('egov') || h.includes('e-gov')) return 'egov';
  } catch {
    /* ignore */
  }
  return '';
}

function inferEntityType(label, notes, url) {
  const blob = `${label || ''} ${notes || ''} ${url || ''}`.toLowerCase();
  if (
    /\b(cad|appraisal district|assessor|property appraiser)\b/.test(blob) &&
    !/\b(treasurer|tax collector|tax office)\b/.test(blob)
  ) {
    return 'appraisal_district';
  }
  return 'tax_collector';
}

function isBadAssessorPick(url) {
  if (!url) return false;
  const u = url.toLowerCase();
  const hasAssessorSignal =
    /\/assessor\b/.test(u) ||
    u.includes('arcc.') ||
    u.includes('denvergov.org/assessor');
  const hasSearchSignal = /\/search\b|webpayments|spatialest|esearch|qpublic|landnav/i.test(u);
  return hasAssessorSignal && !hasSearchSignal;
}

function isRealHttpUrl(url) {
  return spulIsRealHttpUrl(url);
}

function loadCountiesFile() {
  if (!fs.existsSync(COUNTIES_PATH)) return [];
  return JSON.parse(fs.readFileSync(COUNTIES_PATH, 'utf8'));
}

module.exports = {
  REPO_ROOT,
  COUNTIES_PATH,
  GOLDEN_PATH,
  LOCK_PATH,
  CATALOG_PATH,
  ALIASES_PATH,
  CENSUS_PATH,
  compactName,
  normalizeKey,
  masterKey,
  dedupeKey,
  aliasLookupKey,
  humanizeCounty,
  readNdjson,
  loadGoldenOverrides,
  applyGoldenOverride,
  isCountiesJsonLocked,
  detectVendor,
  inferEntityType,
  isBadAssessorPick,
  isRealHttpUrl,
  loadCountiesFile
};
