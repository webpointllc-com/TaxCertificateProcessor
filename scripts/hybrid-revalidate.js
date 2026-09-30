'use strict';

/**
 * Cloud-safe DeepShake substitute: HTTP GET + form sniff of the Searching inventory.
 * Darwin + T7 still uses scripts/deepshake-hunt-mac.sh. This path never invents URLs.
 *
 * Usage:
 *   node scripts/hybrid-revalidate.js
 *   node scripts/hybrid-revalidate.js --all --concurrency=12
 *   node scripts/hybrid-revalidate.js --limit=80
 */

const fs = require('fs');
const path = require('path');
const { fetchOne, classifyProbe, pool } = require('./probe-lib');

const ROOT = path.join(__dirname, '..');
const INVENTORY = path.join(ROOT, 'data', 'spul_searching_inventory.json');
const LOCKS = path.join(ROOT, 'data', 'spul_searching_operator_locks.json');
const PAGE = path.join(ROOT, 'data', 'searching_page.json');
const OUT = path.join(ROOT, 'data', 'hybrid-revalidate.json');

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
  })
);

const CONCURRENCY = Math.min(Math.max(parseInt(args.concurrency || '10', 10), 1), 24);
const LIMIT = args.limit ? Math.max(parseInt(args.limit, 10), 1) : 0;
const ALL = Boolean(args.all);

const VENDOR_HOST =
  /ecclix\.com|properlytaxes\.com|snstaxpayments\.com|csiky\.com|landnav\.com|spatialest\.com|sdttc\.com|myharriscountytax|bossiersheriff/i;

function loadJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function pickTargets(inventory, locks) {
  const byUrl = new Map();
  const lockRows = Object.values(locks.locks || {}).map((lock) => ({
    key: `${lock.state}-${String(lock.county || '').replace(/\s+/g, '')}`,
    state: lock.state,
    county: lock.county,
    url: lock.searchURL,
    source: 'operator_lock'
  }));
  const inventoryRows = (inventory.rows || []).map((row) => ({
    key: row.key,
    state: row.state,
    county: row.county,
    url: row.url,
    source: row.source || 'inventory'
  }));

  const prefer = [...lockRows, ...inventoryRows.filter((r) => VENDOR_HOST.test(r.url || ''))];
  const rest = inventoryRows.filter((r) => !VENDOR_HOST.test(r.url || ''));
  const ordered = ALL ? [...lockRows, ...inventoryRows] : [...prefer, ...rest];

  const out = [];
  for (const row of ordered) {
    const url = String(row.url || '').trim();
    if (!/^https?:/i.test(url)) continue;
    if (byUrl.has(url)) continue;
    byUrl.set(url, true);
    out.push(row);
    if (LIMIT && out.length >= LIMIT) break;
  }
  return out;
}

function compactHit(row, fetched, verdict) {
  return {
    key: row.key,
    county: row.county,
    state: row.state,
    url: row.url,
    source: row.source,
    status: fetched.status,
    finalUrl: fetched.finalUrl,
    error: fetched.error,
    verdict: verdict.verdict,
    reason: verdict.reason,
    title: (verdict.title || '').slice(0, 160),
    fieldCount: Array.isArray(verdict.fields) ? verdict.fields.length : 0
  };
}

async function main() {
  const inventory = loadJson(INVENTORY, { rows: [] });
  const locks = loadJson(LOCKS, { locks: {} });
  const page = loadJson(PAGE, {});
  const targets = pickTargets(inventory, locks);
  const hits = new Array(targets.length);
  let done = 0;

  await pool(targets, CONCURRENCY, async (row, idx) => {
    const fetched = await fetchOne(row.url, 12000);
    const verdict = classifyProbe({
      url: row.url,
      finalUrl: fetched.finalUrl,
      status: fetched.status,
      html: fetched.html,
      error: fetched.error,
      vendor: VENDOR_HOST.test(row.url) ? 'searching_vendor' : ''
    });
    hits[idx] = compactHit(row, fetched, verdict);
    done += 1;
    if (done % 25 === 0 || done === targets.length) {
      process.stderr.write(`hybrid-revalidate ${done}/${targets.length}\n`);
    }
  });

  const counts = {};
  for (const hit of hits) {
    counts[hit.verdict] = (counts[hit.verdict] || 0) + 1;
  }
  const dead = hits.filter((h) => h.verdict === 'dead');
  const report = {
    generatedAt: new Date().toISOString(),
    method: 'http_get_form_sniff',
    deepshake: process.platform === 'darwin' ? 'mac_script_available' : 'not_run_no_t7',
    searchingPage: page.canonicalUrl || 'https://webpointllc.com/searching',
    probed: hits.length,
    inventoryRows: (inventory.rows || []).length,
    counts,
    dead: dead.slice(0, 80),
    vendorSample: hits.filter((h) => VENDOR_HOST.test(h.url)).slice(0, 40)
  };
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');
  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        out: path.relative(ROOT, OUT),
        probed: report.probed,
        counts: report.counts,
        dead: report.dead.length
      },
      null,
      2
    ) + '\n'
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
