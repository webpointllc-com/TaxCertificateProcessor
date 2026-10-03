'use strict';

// One validation core shared by the app, the editor, and the internal MCP server
// (mcp/extractors-server.js). Same probe + same classifier the monthly scripts use,
// so a single-county check and a family pass produce the same kind of evidence.

const probeLib = require('../../scripts/probe-lib');
const siteValidator = require('./siteValidator');
const urlFinder = require('./urlFinder');
const extractorCatalog = require('./extractorCatalog');

const STATUSES = ['collector_search', 'assessor_search', 'homepage', 'unknown_live', 'dead', 'empty', 'unprobed'];

let fetcher = probeLib.fetchOne;
function setFetcher(fn) {
  fetcher = typeof fn === 'function' ? fn : probeLib.fetchOne;
}

function statusOf(row) {
  return row.probeStatus || 'unprobed';
}

function summarize(row) {
  const lock = urlFinder.runtimeLockFor(row.county, row.state);
  return {
    key: row.key,
    state: row.state,
    county: row.county,
    entity: row.entity || null,
    vendor: row.vendor || null,
    url: lock ? lock.url : row.searchURL || null,
    verified: Boolean(lock) || Boolean(row.verified),
    lock_source: lock ? 'editor_approved' : row.verified ? 'catalog' : null,
    probe_status: statusOf(row),
    probe_reason: row.probeReason || null,
    last_probed: row.lastProbed || null,
    dr_fields: (row.layout && row.layout.drFields) || []
  };
}

function findRow(keyOrCounty, state) {
  const rows = urlFinder.loadCounties();
  const raw = String(keyOrCounty || '').trim();
  if (!raw) return null;
  const byKey = rows.find((r) => String(r.key).toLowerCase() === raw.toLowerCase());
  if (byKey) return byKey;
  const st = String(state || '').toUpperCase();
  const name = urlFinder.compactName(raw.replace(/\bcounty\b/gi, ' '));
  return rows.find((r) => (!st || r.state === st) && urlFinder.compactName(r.county) === name) || null;
}

function lookup({ key, county, state }) {
  const row = findRow(key || county, state);
  if (!row) return { ok: false, error: `No county row for ${key || `${county}, ${state}`}. Use extractor_list with a state to find the key.` };
  const dump = extractorCatalog.dumpFor(row.county, row.state, row.key);
  return {
    ok: true,
    extractor: summarize(row),
    catalog_candidate: dump && dump.url && dump.url !== row.searchURL ? { url: dump.url, source: dump.source || null } : null
  };
}

function list({ status = null, state = null, verified = null, offset = 0, limit = 25 } = {}) {
  let rows = urlFinder.loadCounties();
  if (state) rows = rows.filter((r) => r.state === String(state).toUpperCase());
  if (status) rows = rows.filter((r) => statusOf(r) === status);
  if (verified === true) rows = rows.filter((r) => r.verified || urlFinder.runtimeLockFor(r.county, r.state));
  if (verified === false) rows = rows.filter((r) => !r.verified && !urlFinder.runtimeLockFor(r.county, r.state));
  const total = rows.length;
  const start = Math.max(0, Number(offset) || 0);
  const n = Math.max(1, Math.min(Number(limit) || 25, 100));
  const items = rows.slice(start, start + n).map(summarize);
  return { total, offset: start, count: items.length, has_more: start + items.length < total, next_offset: start + items.length < total ? start + items.length : null, items };
}

function stats() {
  const rows = urlFinder.loadCounties();
  const by = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  let verified = 0;
  let editorLocked = 0;
  for (const r of rows) {
    by[statusOf(r)] = (by[statusOf(r)] || 0) + 1;
    const lock = urlFinder.runtimeLockFor(r.county, r.state);
    if (lock) editorLocked += 1;
    if (r.verified || lock) verified += 1;
  }
  let deepshakeQueue = 0;
  try {
    const q = siteValidator.loadQueue();
    deepshakeQueue = Array.isArray(q) ? q.length : Array.isArray(q && q.rows) ? q.rows.length : 0;
  } catch {
    deepshakeQueue = 0;
  }
  return { total: rows.length, verified, editor_locked: editorLocked, by_status: by, deepshake_queue: deepshakeQueue };
}

// Live probe one URL for one county. Read-only: nothing is saved here.
async function validate({ key, county, state, url } = {}) {
  const row = findRow(key || county, state);
  if (!row && !url) return { ok: false, error: 'Give a county key (e.g. WI-Chippewa) or a url to probe' };
  const target = url || (row && row.searchURL);
  if (!target) {
    return { ok: false, key: row && row.key, error: 'This county has no URL yet. Pass a candidate url to probe.' };
  }
  const started = Date.now();
  const res = await fetcher(target);
  const verdict = probeLib.classifyProbe({
    url: target,
    finalUrl: res.finalUrl,
    status: res.status,
    html: res.html,
    error: res.error,
    entity: row && row.entity,
    entityNote: row && row.entityNote,
    entityType: row && row.entityType,
    vendor: row && row.vendor
  });
  const drFields = siteValidator.sniffDrFields(res.html, verdict.fields);
  const hit = { ...verdict, status: res.status, error: res.error, html: res.html, drFields };
  const cloudflare = siteValidator.cloudflareGated(hit);
  const needsDeepShake = siteValidator.needsDeepShake({ ...hit, cloudflare });
  return {
    ok: true,
    key: row ? row.key : null,
    url: target,
    final_url: res.finalUrl,
    http_status: res.status,
    error: res.error,
    verdict: verdict.verdict,
    reason: verdict.reason,
    title: verdict.title || null,
    search_fields: (verdict.fields || []).map((f) => f.label || f.name || f.id).filter(Boolean).slice(0, 12),
    dr_fields: drFields,
    cloudflare,
    needs_deepshake: needsDeepShake,
    lock_eligible: probeLib.shouldLock(verdict.verdict) && !cloudflare,
    previous_status: row ? statusOf(row) : null,
    ms: Date.now() - started
  };
}

async function validateMany({ keys = [], concurrency = 4 } = {}) {
  const list = keys.slice(0, 25);
  const out = new Array(list.length);
  await probeLib.pool(list.map((k, i) => ({ k, i })), Math.max(1, Math.min(concurrency, 6)), async ({ k, i }) => {
    try {
      out[i] = await validate({ key: k });
    } catch (err) {
      out[i] = { ok: false, key: k, error: err.message };
    }
  });
  const tally = {};
  for (const r of out) if (r && r.verdict) tally[r.verdict] = (tally[r.verdict] || 0) + 1;
  return { count: out.length, tally, results: out };
}


// ---------- Discovery ----------
// Stored URLs and dump candidates are mostly homepages, assessor pages or dead links.
// The real collector search page is usually one or two clicks away: a "Pay taxes" link or a
// vendor link (LandNav, county-taxes, etc.) on the county or treasurer page.
const HUB_TEXT = /\b(treasurer|tax collector|tax office|tax assessor[- ]collector|trustee|sheriff.{0,20}tax|property tax(es)?|taxes)\b/i;

function hubLinks(html, baseUrl, limit) {
  const out = [];
  const seen = new Set();
  const re = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(String(html || '')))) {
    const text = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
    if (!HUB_TEXT.test(text) || /assessor(?!.{0,5}collector)|appraisal|appraiser|\bcad\b/i.test(text)) continue;
    let abs;
    try { abs = new URL(m[1].trim(), baseUrl).href; } catch { continue; }
    if (!/^https?:/i.test(abs) || seen.has(abs)) continue;
    seen.add(abs);
    out.push({ href: abs, text });
    if (out.length >= limit) break;
  }
  return out;
}

async function discover({ key, county, state, url, maxProbes = 10 } = {}) {
  const row = findRow(key || county, state);
  if (!row && !url) return { ok: false, error: 'Give a county key (e.g. TX-Bell) or a start url' };
  const dump = row ? extractorCatalog.dumpFor(row.county, row.state, row.key) : null;
  const starts = [...new Set([url, row && row.searchURL, dump && dump.url].filter((u) => u && /^https?:/i.test(u)))];
  if (!starts.length) return { ok: false, key: row && row.key, error: 'No start page on file. Pass the county homepage as url.' };

  const visited = [];
  const candidates = new Map();
  const addCandidates = (list, from, hop) => {
    for (const c of list) if (!candidates.has(c.href)) candidates.set(c.href, { url: c.href, text: c.text, reason: c.reason || 'hub', from, hop });
  };
  for (const start of starts.slice(0, 3)) {
    const page = await fetcher(start);
    visited.push({ url: start, status: page.status, error: page.error });
    if (!page.html) continue;
    addCandidates(probeLib.extractCollectorLinks(page.html, page.finalUrl || start), start, 1);
    for (const hub of hubLinks(page.html, page.finalUrl || start, 3)) {
      const sub = await fetcher(hub.href);
      visited.push({ url: hub.href, status: sub.status, error: sub.error, via: hub.text });
      if (sub.html) addCandidates(probeLib.extractCollectorLinks(sub.html, sub.finalUrl || hub.href), hub.href, 2);
    }
  }
  const toProbe = [...candidates.values()]
    .sort((a, b) => (a.reason === 'vendor_link' ? 0 : 1) - (b.reason === 'vendor_link' ? 0 : 1) || a.hop - b.hop)
    .slice(0, Math.max(1, Math.min(maxProbes, 20)));
  const probed = [];
  for (const c of toProbe) {
    const r = await validate({ key: row && row.key, url: c.url });
    probed.push({ url: c.url, link_text: c.text, found_on: c.from, hop: c.hop, verdict: r.verdict, reason: r.reason, title: r.title, dr_fields: r.dr_fields || [], cloudflare: r.cloudflare, lock_eligible: Boolean(r.lock_eligible), final_url: r.final_url });
  }
  const winners = probed
    .filter((p) => p.lock_eligible || (p.verdict === 'collector_search' && p.cloudflare))
    .sort((a, b) => Number(b.lock_eligible) - Number(a.lock_eligible) || b.dr_fields.length - a.dr_fields.length);
  return {
    ok: true,
    key: row ? row.key : null,
    visited,
    links_found: candidates.size,
    probed,
    best: winners[0] || null,
    collector_candidates: winners
  };
}

async function discoverMany({ keys = [], concurrency = 3 } = {}) {
  const list = keys.slice(0, 10);
  const out = new Array(list.length);
  await probeLib.pool(list.map((k, i) => ({ k, i })), Math.max(1, Math.min(concurrency, 4)), async ({ k, i }) => {
    try { out[i] = await discover({ key: k }); } catch (err) { out[i] = { ok: false, key: k, error: err.message }; }
  });
  return { count: out.length, found: out.filter((r) => r && r.best).length, results: out };
}

module.exports = { STATUSES, setFetcher, lookup, list, stats, validate, validateMany, discover, discoverMany, findRow };
