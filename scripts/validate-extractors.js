#!/usr/bin/env node
/**
 * Validate every usable extractor / Searching URL.
 *
 * Looks for DR Production Results column heads on the live page.
 * Cloudflare / JS-gated hosts go on the DeepShake queue for a real Chrome
 * user session. Never invents URLs. Never bypasses Cloudflare.
 *
 *   node scripts/validate-extractors.js --all
 *   node scripts/validate-extractors.js --limit=80 --concurrency=8
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { fetchOne, classifyProbe, pool, extractFields } = require('./probe-lib');
const { isGoogleFallbackUrl, isRealHttpUrl } = require('../src/services/spulTruth');
const siteValidator = require('../src/services/siteValidator');

const ROOT = path.join(__dirname, '..');
const EXTRACTORS = path.join(ROOT, 'data', 'extractor_urls.json');
const INVENTORY = path.join(ROOT, 'data', 'spul_searching_inventory.json');
const LOCKS = path.join(ROOT, 'data', 'spul_searching_operator_locks.json');
const HITS_PATH = path.join(ROOT, 'data', 'validation_hits.json');

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
  })
);

const CONCURRENCY = Math.min(Math.max(parseInt(args.concurrency || '10', 10), 1), 20);
const LIMIT = args.limit ? Math.max(parseInt(args.limit, 10), 1) : 0;

function loadJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function pickTargets() {
  const dump = loadJson(EXTRACTORS, { rows: [] });
  const inventory = loadJson(INVENTORY, { rows: [] });
  const locks = loadJson(LOCKS, { locks: {} });
  const byUrl = new Map();
  const rows = [];

  function add(row) {
    const url = String(row.url || '').trim();
    if (!isRealHttpUrl(url) || isGoogleFallbackUrl(url)) return;
    if (/\{[a-z0-9]+\}/i.test(url)) return;
    if (byUrl.has(url)) {
      const existing = byUrl.get(url);
      if (row.key && !existing.keys.includes(row.key)) existing.keys.push(row.key);
      return;
    }
    const item = {
      key: row.key,
      keys: row.key ? [row.key] : [],
      state: row.state,
      county: row.county,
      url,
      source: row.source || 'dump'
    };
    byUrl.set(url, item);
    rows.push(item);
  }

  for (const lock of Object.values(locks.locks || {})) {
    add({
      key: `${lock.state}-${String(lock.county || '').replace(/\s+/g, '')}`,
      state: lock.state,
      county: lock.county,
      url: lock.searchURL,
      source: 'operator_lock'
    });
  }
  for (const row of dump.rows || []) add({ ...row, source: row.source || 'extractor_dump' });
  for (const row of inventory.rows || []) add({ ...row, source: row.source || 'inventory' });

  if (LIMIT) return rows.slice(0, LIMIT);
  return rows;
}

function compactHit(row, fetched, verdict, drFields) {
  const title = (verdict.title || extractTitleSafe(fetched.html)).slice(0, 160);
  const gated = siteValidator.cloudflareGated({
    html: fetched.html,
    title,
    reason: verdict.reason,
    status: fetched.status
  });
  return {
    key: row.key,
    keys: row.keys || [row.key],
    county: row.county,
    state: row.state,
    url: row.url,
    source: row.source,
    status: fetched.status,
    finalUrl: fetched.finalUrl,
    error: fetched.error,
    verdict: verdict.verdict,
    reason: verdict.reason,
    title,
    fieldCount: Array.isArray(verdict.fields) ? verdict.fields.length : 0,
    drFields,
    cloudflare: gated,
    needsDeepShake: siteValidator.needsDeepShake({
      verdict: verdict.verdict,
      reason: verdict.reason,
      error: fetched.error,
      drFields,
      cloudflare: gated
    })
  };
}

function extractTitleSafe(html) {
  const m = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';
}

async function main() {
  const targets = pickTargets();
  const hits = new Array(targets.length);
  let done = 0;
  await pool(targets, CONCURRENCY, async (row, idx) => {
    const fetched = await fetchOne(row.url, 12000);
    const fields = extractFields(fetched.html || '');
    const verdict = classifyProbe({
      url: row.url,
      finalUrl: fetched.finalUrl,
      status: fetched.status,
      html: fetched.html,
      error: fetched.error
    });
    verdict.fields = verdict.fields && verdict.fields.length ? verdict.fields : fields;
    const drFields = siteValidator.sniffDrFields(fetched.html, verdict.fields);
    hits[idx] = compactHit(row, fetched, verdict, drFields);
    done += 1;
    if (done % 50 === 0 || done === targets.length) {
      process.stderr.write(`validate-extractors ${done}/${targets.length}\n`);
    }
  });

  const counts = {};
  const lookForHits = {};
  for (const hit of hits) {
    counts[hit.verdict] = (counts[hit.verdict] || 0) + 1;
    if (hit.needsDeepShake) counts.needsDeepShake = (counts.needsDeepShake || 0) + 1;
    if (hit.cloudflare) counts.cloudflare = (counts.cloudflare || 0) + 1;
    if (hit.drFields && hit.drFields.length) counts.hasDrFields = (counts.hasDrFields || 0) + 1;
    for (const header of hit.drFields || []) {
      lookForHits[header] = (lookForHits[header] || 0) + 1;
    }
  }

  const queue = hits
    .filter((h) => h.needsDeepShake && !siteValidator.skipPlaybookKey(h.key))
    .slice(0, 400)
    .map((h) => ({
      key: h.key,
      url: h.url,
      verdict: h.verdict,
      reason: h.reason,
      cloudflare: h.cloudflare,
      drFields: h.drFields,
      lookFor: siteValidator.lookForHeaders()
    }));

  const run = {
    generatedAt: new Date().toISOString(),
    method: 'http_get_form_sniff + DR column heads',
    how: [
      'Union ExtractorUrls dump + Searching inventory + operator locks.',
      'Skip google.com, {parcel} templates, and blank URLs.',
      'GET each URL. Classify collector / assessor / homepage / dead.',
      'Sniff DR Production Results column heads (Parcel Number, Tax Id, Owner 1 Name, …).',
      'Cloudflare JS / no-form collector hosts → DeepShake queue for a real Chrome user session.',
      'Apply collector_search evidence with npm run validate:apply. Golden overrides still win.',
      'OH-Hamilton / CT-HartfordCity / IL-Sangamon stay unlocked until a collector search page is confirmed.',
      'Monthly: Starter web re-runs this when the last report is older than 28 days. Per-county: /api/extractors/session from the signed-in user tab.'
    ],
    deepshake: process.platform === 'darwin' ? 'mac_chrome_session' : 'queue_user_chrome_session',
    probed: hits.length,
    counts,
    lookForHits,
    lookFor: siteValidator.lookForHeaders()
  };

  fs.writeFileSync(siteValidator.RUN_PATH, JSON.stringify(run, null, 2) + '\n');
  fs.writeFileSync(
    siteValidator.QUEUE_PATH,
    JSON.stringify({ generatedAt: run.generatedAt, rows: queue }, null, 2) + '\n'
  );
  fs.writeFileSync(HITS_PATH, JSON.stringify({ generatedAt: run.generatedAt, hits }, null, 2) + '\n');

  try {
    const store = require('../src/db/store');
    const extractors = require('../src/db/extractors');
    await store.init();
    await extractors.recordValidationRun(run);
    await store.close();
  } catch (err) {
    process.stderr.write(`validate-extractors persist: ${err.message}\n`);
  }

  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        probed: run.probed,
        counts: run.counts,
        queue: queue.length,
        run: path.relative(ROOT, siteValidator.RUN_PATH)
      },
      null,
      2
    ) + '\n'
  );
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { pickTargets, main };
