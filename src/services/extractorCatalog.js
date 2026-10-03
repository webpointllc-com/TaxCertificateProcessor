'use strict';

const fs = require('fs');
const path = require('path');
const { compactJurisdictionName, isRealHttpUrl, isGoogleFallbackUrl } = require('./spulTruth');

const DUMP_PATH = path.join(__dirname, '../../data/extractor_urls.json');

let cache = null;

function tokenKey(state, county) {
  return `${String(state || '').toUpperCase().trim()}-${String(county || '').replace(/\s+/g, '')}`;
}

function loadDump() {
  if (cache) return cache;
  cache = { byKey: new Map(), byCompact: new Map(), stats: {}, rows: [], source: null };
  if (!fs.existsSync(DUMP_PATH)) return cache;
  try {
    const raw = JSON.parse(fs.readFileSync(DUMP_PATH, 'utf8'));
    cache.stats = raw.stats || {};
    cache.source = raw.source || null;
    cache.rows = Array.isArray(raw.rows) ? raw.rows : [];
    for (const row of cache.rows) {
      if (row.key) cache.byKey.set(row.key, row);
      const ck = `${String(row.state || '').toUpperCase()}:${compactJurisdictionName(row.county)}`;
      if (!cache.byCompact.has(ck)) cache.byCompact.set(ck, row);
    }
  } catch {
    cache = { byKey: new Map(), byCompact: new Map(), stats: {}, rows: [], source: null };
  }
  return cache;
}

function dumpFor(county, state, keyHint) {
  const dump = loadDump();
  const st = String(state || '').toUpperCase().trim();
  const hints = [keyHint, tokenKey(st, county), `${st}-${county}`].filter(Boolean);
  for (const k of hints) {
    if (dump.byKey.has(k)) return dump.byKey.get(k);
  }
  return dump.byCompact.get(`${st}:${compactJurisdictionName(county)}`) || null;
}

function keysFor(lookup = {}) {
  const county = lookup.jurisdiction?.county || lookup.canonicalCounty || lookup.county || '';
  const state = (lookup.jurisdiction?.state || lookup.canonicalState || lookup.state || '').toUpperCase();
  const out = [];
  const add = (k) => {
    if (k && !out.includes(k)) out.push(k);
  };
  add(lookup.key);
  add(lookup.jurisdiction_key);
  add(lookup.dumpKey);
  add(tokenKey(state, county));
  add(`${state}-${county}`);
  if (county) add(`${state}-${compactJurisdictionName(county)}`);
  return out;
}

function sameUrl(a, b) {
  const norm = (u) =>
    String(u || '')
      .trim()
      .replace(/\/+$/, '')
      .toLowerCase();
  return Boolean(a && b && norm(a) === norm(b));
}

function catalogBlock(county, state, urlResult = {}) {
  const dump = dumpFor(county, state, urlResult.key || urlResult.dumpKey);
  const vendorFamily = require('./vendorFamily');
  const locked = urlResult.officialUrl || urlResult.lockedUrl || '';
  const candidate = urlResult.candidateUrl || '';
  const url = locked || candidate || (dump && dump.url) || '';
  const family = vendorFamily.classify(url, 1);
  let out =
    '\n--- COUNTY EXTRACTOR CATALOG (repo dump of ~2k extractors + vendor family. Groq is rented — this catalog is the WebPoint model people pay for.) ---';
  if (dump && isRealHttpUrl(dump.url) && !isGoogleFallbackUrl(dump.url)) {
    if (locked && sameUrl(dump.url, locked)) {
      out += `\nDump ${dump.key} (${dump.source || 'row'}) agrees with the locked collector URL.`;
    } else {
      out += `\nDump ${dump.key} ${dump.source || ''} candidate URL (do NOT copy into SPUL_URL unless JURISDICTION DATA locks it): ${dump.url}`;
    }
  } else {
    out += '\nNo usable Development dump row for this county.';
  }
  out += `\nVendor family: ${family.family} kind=${family.kind} chrome=${family.chrome} lockable=${family.lockable}`;
  if (family.kind === 'assessor') {
    out += '\nThis family is assessor / CAD — never present it as the tax collector.';
  }
  if (family.kind === 'hub' || family.kind === 'payment_hub') {
    out += '\nThis family is a shared hub — do not mass-lock a homepage.';
  }
  return out;
}

function learnedBlock(feedback) {
  const rows = Array.isArray(feedback) ? feedback : [];
  if (!rows.length) return '';
  const lines = rows.slice(0, 8).map((f) => {
    const when = f.created_at || f.createdAt || '';
    const kind = f.kind || 'session';
    const body = String(f.body || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 240);
    return `- ${when} ${kind}: ${body}`;
  });
  return (
    '\n--- LEARNED FEEDBACK (this account allowed WebPoint to learn; replay on this county extractor. Groq weights are not trained.) ---\n' +
    lines.join('\n')
  );
}

function invalidate() {
  cache = null;
}

module.exports = {
  DUMP_PATH,
  loadDump,
  dumpFor,
  keysFor,
  tokenKey,
  sameUrl,
  catalogBlock,
  learnedBlock,
  invalidate
};
