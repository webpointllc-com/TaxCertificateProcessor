'use strict';

/**
 * Batch HTTP health sample for Extractor registry URLs.
 * DeepShake is a local Mac engine — this is the cloud substitute only.
 * Prefer Search over Base; skip google placeholders.
 *
 * Usage:
 *   node scripts/http-health-sample.js [--limit=200] [--concurrency=12]
 *   node scripts/http-health-sample.js --all [--concurrency=16]
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const ROOT = path.join(__dirname, '..');
const INDEX_PATH = path.join(ROOT, 'data', 'search-index.json');
const OUT_PATH = path.join(ROOT, 'data', 'health-sample.json');
const FULL_OUT_PATH = path.join(ROOT, 'data', 'health-full.json');
const REPORT_PATH = path.join(ROOT, '..', 'docs', 'prototype-best-practice', 'URL_HEALTH_SAMPLE.md');

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
  })
);

const RUN_ALL = Boolean(args.all);
const LIMIT = RUN_ALL
  ? 99999
  : Math.min(Math.max(parseInt(args.limit || '200', 10), 10), 2052);
const CONCURRENCY = Math.min(Math.max(parseInt(args.concurrency || (RUN_ALL ? '16' : '12'), 10), 1), 32);
const TIMEOUT_MS = RUN_ALL ? 10000 : 8000;

function isGoogle(url) {
  return /google\.com/i.test(url || '');
}

function pickSample(items, limit) {
  // Prefer Search, then active Base; exclude google
  const search = items.filter((i) => i.source === 'Search' && i.url && !isGoogle(i.url));
  const base = items.filter((i) => i.source === 'Base' && i.url && !isGoogle(i.url));
  const popularKeys = new Set([
    'TX-Travis', 'TX-Harris', 'TX-Dallas', 'CA-LosAngeles', 'CA-SanDiego', 'IL-Cook',
    'FL-MiamiDade', 'FL-Orange', 'WA-King', 'CO-Denver', 'AZ-Maricopa', 'GA-Fulton',
    'NC-Mecklenburg', 'OH-Franklin', 'MI-Wayne', 'MN-Hennepin', 'OR-Multnomah', 'NV-Clark',
  ]);
  const byKey = new Map(items.map((i) => [i.key, i]));
  const forced = [...popularKeys].map((k) => byKey.get(k)).filter(Boolean);

  const seen = new Set();
  const out = [];
  function add(i) {
    if (!i || !i.url || seen.has(i.key) || isGoogle(i.url)) return;
    seen.add(i.key);
    out.push(i);
  }
  forced.forEach(add);
  // stride sample Search then Base
  const stride = Math.max(1, Math.floor(search.length / Math.max(1, Math.floor(limit * 0.55))));
  for (let i = 0; i < search.length && out.length < limit; i += stride) add(search[i]);
  const strideB = Math.max(1, Math.floor(base.length / Math.max(1, limit - out.length)));
  for (let i = 0; i < base.length && out.length < limit; i += strideB) add(base[i]);
  return out.slice(0, limit);
}

function fetchOnce(url, method) {
  return new Promise((resolve) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (e) {
      resolve({ status: null, error: 'InvalidURL', ms: 0 });
      return;
    }
    const lib = parsed.protocol === 'https:' ? https : http;
    const started = Date.now();
    const req = lib.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method,
        timeout: TIMEOUT_MS,
        headers: {
          'User-Agent': 'S-PUL-health-sample/1.0 (+webpointllc.com)',
          Accept: '*/*',
        },
        rejectUnauthorized: false,
      },
      (res) => {
        res.resume();
        resolve({ status: res.statusCode || null, error: null, ms: Date.now() - started });
      }
    );
    req.on('timeout', () => {
      req.destroy();
      resolve({ status: null, error: 'TimeoutError', ms: Date.now() - started });
    });
    req.on('error', (err) => {
      resolve({ status: null, error: err.name || 'URLError', ms: Date.now() - started });
    });
    req.end();
  });
}

async function checkUrl(url) {
  let r = await fetchOnce(url, 'HEAD');
  if (r.status && r.status >= 200 && r.status < 400) return r;
  // many county sites reject HEAD
  if (!r.status || r.status === 405 || r.status === 403 || r.status >= 400) {
    const g = await fetchOnce(url, 'GET');
    if (g.status) return g;
    return r.error ? r : g;
  }
  return r;
}

/**
 * Treat bot-gates / auth walls as "up" (site exists). Only hard-down → inactive.
 * 401/403/405/429 = reachable. 404/410/5xx/null = down.
 */
function classifyHealth(r) {
  const s = r.status;
  if (s != null && s >= 200 && s < 400) return { ok: true, kind: 'ok' };
  if (s === 401 || s === 403 || s === 405 || s === 429) return { ok: true, kind: 'gated' };
  if (s === 404 || s === 410) return { ok: false, kind: 'gone' };
  if (s != null && s >= 500) return { ok: false, kind: 'server_error' };
  return { ok: false, kind: r.error || 'unreachable' };
}

async function mapPool(list, concurrency, fn) {
  const out = new Array(list.length);
  let i = 0;
  async function worker() {
    while (i < list.length) {
      const idx = i++;
      out[idx] = await fn(list[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return out;
}

async function main() {
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  const items = index.items || [];
  const checkable = items.filter((i) => i.url && !isGoogle(i.url));
  const sample = RUN_ALL ? checkable : pickSample(items, LIMIT);
  console.log(
    `Checking ${sample.length} URLs (mode=${RUN_ALL ? 'all' : 'sample'}, concurrency=${CONCURRENCY})…`
  );

  const results = await mapPool(sample, CONCURRENCY, async (item) => {
    const r = await checkUrl(item.url);
    const cls = classifyHealth(r);
    return {
      key: item.key,
      url: item.url,
      source: item.source,
      status: r.status,
      error: r.error,
      ms: r.ms,
      ok: cls.ok,
      kind: cls.kind,
    };
  });

  const okN = results.filter((r) => r.ok).length;
  const gatedN = results.filter((r) => r.kind === 'gated').length;
  const fail = results.filter((r) => !r.ok);
  const rate = okN / Math.max(results.length, 1);

  // Update active flags for checked keys
  const byKey = new Map(results.map((r) => [r.key, r]));
  let flippedInactive = 0;
  let flippedActive = 0;
  for (const item of items) {
    const r = byKey.get(item.key);
    if (!r) continue;
    const prev = item.active !== false;
    item.active = !!r.ok;
    if (prev && !item.active) flippedInactive++;
    if (!prev && item.active) flippedActive++;
  }

  index.meta = index.meta || {};
  // Unsampled rows stay active=true (default trust) unless previously false from this run's checks
  for (const item of items) {
    if (!byKey.has(item.key) && item.active === undefined) item.active = true;
  }

  const activeCount = items.filter((i) => i.active !== false).length;
  const healthMeta = {
    generatedAt: new Date().toISOString(),
    mode: RUN_ALL ? 'full' : 'sample',
    sampleSize: results.length,
    ok: okN,
    gated: gatedN,
    fail: fail.length,
    okRate: Math.round(rate * 1000) / 1000,
    extrapolatedActiveEstimate: Math.round(items.length * rate),
    indexActiveCount: activeCount,
    flippedInactive,
    flippedActive,
    deepShake: 'not_run',
    note:
      'DeepShake unreachable from cloud VM (no self-hosted Mac worker; /Volumes/T7 not mounted here). HTTP HEAD/GET substitute; 401/403/405/429 counted as up (gated).',
  };
  index.meta.healthSample = healthMeta;
  if (RUN_ALL) index.meta.healthFull = healthMeta;

  fs.writeFileSync(INDEX_PATH, JSON.stringify(index));
  fs.writeFileSync(OUT_PATH, JSON.stringify(results, null, 2));
  if (RUN_ALL) fs.writeFileSync(FULL_OUT_PATH, JSON.stringify(results, null, 2));

  // Sync active flags into jurisdictions.json / min if present
  for (const name of ['jurisdictions.json', 'jurisdictions.min.json']) {
    const p = path.join(ROOT, 'data', name);
    if (!fs.existsSync(p)) continue;
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    const list = j.jurisdictions || j.items || [];
    for (const row of list) {
      const r = byKey.get(row.key);
      if (r) row.active = !!r.ok;
    }
    if (j.meta) {
      j.meta.healthSample = healthMeta;
      if (RUN_ALL) j.meta.healthFull = healthMeta;
    }
    fs.writeFileSync(p, JSON.stringify(j));
  }

  const md = [
    '# URL Health Sample',
    '',
    `**Generated:** ${healthMeta.generatedAt}`,
    `**Mode:** ${healthMeta.mode}`,
    `**DeepShake:** not run (blocked — no Mac worker / T7 mount on this cloud VM)`,
    '',
    '## Results',
    '',
    `| Metric | Count |`,
    `|---|---:|`,
    `| Checked | ${results.length} |`,
    `| OK / gated (counted up) | ${okN} (gated ${gatedN}) |`,
    `| Hard fail | ${fail.length} |`,
    `| Up rate | ${(rate * 100).toFixed(1)}% |`,
    `| Index active after sample | ${healthMeta.indexActiveCount} |`,
    `| Extrapolated if rate applied to all | ~${healthMeta.extrapolatedActiveEstimate} |`,
    `| Flipped inactive this run | ${flippedInactive} |`,
    `| Flipped active this run | ${flippedActive} |`,
    '',
    '## Failures (first 80)',
    '',
    ...fail.slice(0, 80).map(
      (f) => `- \`${f.key}\` → \`${f.url}\` — status=${f.status} error=${f.error || 'HTTP'}`
    ),
    '',
    '## Handoff for DeepShake (Mac + T7)',
    '',
    'T7 is mounted on Bill’s Mac (`/Volumes/T7` in Finder → Locations). This cloud agent cannot see USB.',
    '',
    '1. On the Mac: `bash scripts/deepshake-hunt-mac.sh` (searches `/Volumes/T7`, Desktop, Downloads, Applications).',
    '2. `cursor worker start` on that Mac so a cloud agent can see `/Volumes/T7`.',
    '3. Run DeepShake URL-fix / dork against keys flagged inactive above.',
    '4. Prefer treasurer/sheriff/clerk/collector **search** pages over Base homepages.',
    '',
  ].join('\n');
  fs.writeFileSync(REPORT_PATH, md);

  console.log(JSON.stringify(healthMeta, null, 2));
  console.log(`Wrote ${OUT_PATH}`);
  if (RUN_ALL) console.log(`Wrote ${FULL_OUT_PATH}`);
  console.log(`Wrote ${REPORT_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
