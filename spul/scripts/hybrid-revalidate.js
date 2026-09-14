'use strict';

/**
 * Hybrid URL revalidation for S-PUL Extractor registry.
 * Method A: HEAD/GET with timeouts; 403/429/gated = often-alive; 404/NXDOMAIN = dead
 * Method B: Prefer Search over Base (already selected in primary_search_url); skip google
 * Method C: redirect follow; sample title/form sniff; host vs state+county mismatch flags
 * DeepShake: documented not_run on cloud (no Mac/T7)
 *
 * Usage: node scripts/hybrid-revalidate.js [--concurrency=20] [--sniff=120]
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const INDEX_PATH = path.join(DATA, 'search-index.json');
const EXPORT_CSV = path.join(DATA, 'counties-export.csv');
const EXPORT_SUMMARY = path.join(DATA, 'counties-export-summary.json');
const OUT_JSON = path.join(DATA, 'hybrid-revalidate.json');
const OUT_VALIDATED_CSV = path.join(DATA, 'validated-true-urls.csv');
const REPORT_MD = path.join(ROOT, '..', 'docs', 'prototype-best-practice', 'URL_REVALIDATE_2026-09-13.md');

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
  })
);

const CONCURRENCY = Math.min(Math.max(parseInt(args.concurrency || '20', 10), 1), 40);
const SNIFF_LIMIT = Math.min(Math.max(parseInt(args.sniff || '120', 10), 0), 400);
const TIMEOUT_MS = 12000;
const MAX_REDIRECTS = 4;
const BODY_SNIFF_BYTES = 48 * 1024;

const STATE_NAMES = {
  AL: 'alabama', AK: 'alaska', AZ: 'arizona', AR: 'arkansas', CA: 'california',
  CO: 'colorado', CT: 'connecticut', DE: 'delaware', FL: 'florida', GA: 'georgia',
  HI: 'hawaii', ID: 'idaho', IL: 'illinois', IN: 'indiana', IA: 'iowa',
  KS: 'kansas', KY: 'kentucky', LA: 'louisiana', ME: 'maine', MD: 'maryland',
  MA: 'massachusetts', MI: 'michigan', MN: 'minnesota', MS: 'mississippi', MO: 'missouri',
  MT: 'montana', NE: 'nebraska', NV: 'nevada', NH: 'newhampshire', NJ: 'newjersey',
  NM: 'newmexico', NY: 'newyork', NC: 'northcarolina', ND: 'northdakota', OH: 'ohio',
  OK: 'oklahoma', OR: 'oregon', PA: 'pennsylvania', RI: 'rhodeisland', SC: 'southcarolina',
  SD: 'southdakota', TN: 'tennessee', TX: 'texas', UT: 'utah', VT: 'vermont',
  VA: 'virginia', WA: 'washington', WV: 'westvirginia', WI: 'wisconsin', WY: 'wyoming',
  DC: 'districtofcolumbia',
};

function isGoogle(url) {
  return /google\.com/i.test(url || '');
}

function normToken(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function hostMismatch(item, finalUrl) {
  let host = '';
  try {
    host = new URL(finalUrl || item.url).hostname.toLowerCase();
  } catch {
    return { mismatch: true, reason: 'bad_final_url' };
  }
  const hostCompact = host.replace(/[^a-z0-9]/g, '');
  const county = normToken(item.county);
  const state = String(item.state || '').toUpperCase();
  const stateName = STATE_NAMES[state] || '';
  const countyHint = county.length >= 4 ? county.slice(0, Math.min(county.length, 10)) : county;

  // Shared vendors / statewide portals — not mismatches
  const shared =
    /gov(?:ern)?max|tylerhost|tylertech|bsasoftware|actdatascout|countygovservices|capturecama|mptsweb|paytaxes|propertytax|manatron|truelevy|deltacomputer|arcountydata|iowatreasurers|signatureinfo|mygovonline|opaldatal|cichosting|esearch|propaccess|ingproperty|lots\.|azurefd|municode|qpublic|schneidercorp|beacon\.|iasworld|patriotproperties|visionappraisal|wgx|wgxtax|taxsys|taxbill|taxweb|onlinepayments|gov\.|state\./i.test(
      host
    );
  if (shared) return { mismatch: false, reason: 'shared_vendor_or_gov' };

  const hasCounty = countyHint && countyHint.length >= 4 && hostCompact.includes(countyHint);
  const hasState =
    (state && hostCompact.includes(state.toLowerCase())) ||
    (stateName && hostCompact.includes(stateName));

  // Strong mismatch: host names a different US state abbreviation as a label
  const otherStates = Object.keys(STATE_NAMES).filter((s) => s !== state);
  for (const os of otherStates) {
    const re = new RegExp(`(?:^|[^a-z])${os.toLowerCase()}(?:[^a-z]|$)`);
    // only flag if host has clear other-state token AND no county/state match
    if (re.test(host.replace(/\./g, ' ')) && !hasCounty && !hasState) {
      // many false positives on short codes in vendor names — require state name of other
      const otherName = STATE_NAMES[os];
      if (otherName && hostCompact.includes(otherName) && !hostCompact.includes(stateName)) {
        return { mismatch: true, reason: `host_looks_like_${os}` };
      }
    }
  }

  if (!hasCounty && !hasState && county.length >= 6) {
    return { mismatch: false, reason: 'no_local_token_soft', soft: true };
  }
  return { mismatch: false, reason: hasCounty || hasState ? 'local_token_ok' : 'neutral' };
}

function sniffHtml(html) {
  const text = String(html || '');
  const titleM = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleM ? titleM[1].replace(/\s+/g, ' ').trim().slice(0, 160) : '';
  const lower = text.toLowerCase();
  const hasForm = /<form[\s>]/i.test(text);
  const taxish =
    /property\s*tax|tax\s*collector|treasurer|parcel|assessor|owner\s*name|account\s*number|pay\s*taxes|tax\s*search|real\s*property/i.test(
      lower
    );
  const loginWall = /cloudflare|access denied|captcha|bot detection|just a moment/i.test(lower);
  return { title, hasForm, taxish, loginWall };
}

function requestOnce(url, method, { followBody = false, redirectCount = 0 } = {}) {
  return new Promise((resolve) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      resolve({ status: null, error: 'InvalidURL', ms: 0, finalUrl: url, headers: {}, body: '' });
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
          'User-Agent':
            'Mozilla/5.0 (compatible; S-PUL-hybrid-revalidate/1.1; +https://webpointllc.com)',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        rejectUnauthorized: false,
      },
      (res) => {
        const status = res.statusCode || null;
        const loc = res.headers.location;
        if (
          status &&
          status >= 300 &&
          status < 400 &&
          loc &&
          redirectCount < MAX_REDIRECTS
        ) {
          res.resume();
          let next;
          try {
            next = new URL(loc, url).toString();
          } catch {
            resolve({
              status,
              error: 'BadRedirect',
              ms: Date.now() - started,
              finalUrl: url,
              headers: res.headers,
              body: '',
            });
            return;
          }
          requestOnce(next, method, { followBody, redirectCount: redirectCount + 1 }).then(resolve);
          return;
        }

        if (!followBody) {
          res.resume();
          resolve({
            status,
            error: null,
            ms: Date.now() - started,
            finalUrl: url,
            headers: res.headers,
            body: '',
            redirects: redirectCount,
          });
          return;
        }

        const chunks = [];
        let size = 0;
        res.on('data', (c) => {
          if (size < BODY_SNIFF_BYTES) {
            chunks.push(c);
            size += c.length;
          }
        });
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          resolve({
            status,
            error: null,
            ms: Date.now() - started,
            finalUrl: url,
            headers: res.headers,
            body,
            redirects: redirectCount,
          });
        });
      }
    );
    req.on('timeout', () => {
      req.destroy();
      resolve({
        status: null,
        error: 'TimeoutError',
        ms: Date.now() - started,
        finalUrl: url,
        headers: {},
        body: '',
      });
    });
    req.on('error', (err) => {
      const msg = err && err.message ? String(err.message) : '';
      let error = err.code || err.name || 'URLError';
      if (/ENOTFOUND|getaddrinfo/i.test(msg) || err.code === 'ENOTFOUND') error = 'NXDOMAIN';
      if (/CERT|SSL|TLS/i.test(msg) || /CERT|SSL|TLS/i.test(String(err.code || ''))) error = 'TLSError';
      resolve({
        status: null,
        error,
        ms: Date.now() - started,
        finalUrl: url,
        headers: {},
        body: '',
      });
    });
    req.end();
  });
}

/**
 * validated_true | dead | uncertain
 */
function classifyBucket(r) {
  if (isGoogle(r.url)) return { bucket: 'dead', kind: 'google_placeholder', active: false };
  if (r.error === 'InvalidURL') return { bucket: 'dead', kind: 'invalid_url', active: false };
  if (r.error === 'NXDOMAIN') return { bucket: 'dead', kind: 'nxdomain', active: false };
  const s = r.status;
  if (s != null && s >= 200 && s < 400) return { bucket: 'validated_true', kind: 'ok', active: true };
  if ([401, 403, 405, 429].includes(s)) return { bucket: 'validated_true', kind: 'gated', active: true };
  if ([502, 503].includes(s)) return { bucket: 'validated_true', kind: 'gateway_soft', active: true };
  if (s === 404 || s === 410) return { bucket: 'dead', kind: 'gone', active: false };
  if (r.error === 'TimeoutError' || r.error === 'TLSError') {
    return { bucket: 'uncertain', kind: r.error, active: true }; // keep active: false-negative risk
  }
  if (s != null && s >= 500) return { bucket: 'uncertain', kind: 'server_error', active: true };
  return { bucket: 'uncertain', kind: r.error || 'unreachable', active: true };
}

async function checkUrl(item, doSniff) {
  let r = await requestOnce(item.url, 'HEAD', { followBody: false });
  // Prefer GET when HEAD fails / gated / method-not-allowed / missing status
  if (!r.status || r.status === 405 || r.status === 403 || r.status >= 400 || r.error) {
    const g = await requestOnce(item.url, 'GET', { followBody: doSniff });
    if (g.status || g.error) r = g;
  } else if (doSniff) {
    r = await requestOnce(item.url, 'GET', { followBody: true });
  }

  const cls = classifyBucket({ ...r, url: item.url });
  const host = hostMismatch(item, r.finalUrl || item.url);
  let sniff = null;
  if (doSniff && r.body) sniff = sniffHtml(r.body);

  return {
    key: item.key,
    state: item.state,
    county: item.county,
    url: item.url,
    finalUrl: r.finalUrl || item.url,
    source: item.source,
    status: r.status,
    error: r.error,
    ms: r.ms,
    redirects: r.redirects || 0,
    bucket: cls.bucket,
    kind: cls.kind,
    activeShould: cls.active,
    hostCheck: host,
    sniff,
  };
}

async function mapPool(list, concurrency, fn) {
  const out = new Array(list.length);
  let i = 0;
  async function worker() {
    while (i < list.length) {
      const idx = i++;
      out[idx] = await fn(list[idx], idx);
      if ((idx + 1) % 100 === 0 || idx + 1 === list.length) {
        process.stdout.write(`  … ${idx + 1}/${list.length}\n`);
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return out;
}

function csvEscape(v) {
  const s = String(v ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCountiesExport(index, resultsByKey) {
  // Include no-URL jurisdictions from existing export if present
  let noUrlRows = [];
  if (fs.existsSync(EXPORT_CSV)) {
    const lines = fs.readFileSync(EXPORT_CSV, 'utf8').trim().split(/\r?\n/);
    const header = lines[0].split(',');
    const idxUrl = header.indexOf('primary_search_url');
    const idxKey = header.indexOf('key');
    for (const line of lines.slice(1)) {
      // naive parse via regex for empty url rows only
      const cols = [];
      let cur = '';
      let inQ = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') inQ = !inQ;
        else if (ch === ',' && !inQ) {
          cols.push(cur);
          cur = '';
        } else cur += ch;
      }
      cols.push(cur);
      if (idxUrl >= 0 && !(cols[idxUrl] || '').trim()) {
        noUrlRows.push({
          state: cols[0],
          county: cols[1],
          key: cols[idxKey],
          primary_search_url: '',
          source: cols[4] || '',
          active: 'false',
          confidence_base: cols[6] || '0',
          quality: cols[7] || 'no_url',
          version: cols[8] || '1',
        });
      }
    }
  }

  const rows = index.items.map((item) => {
    const r = resultsByKey.get(item.key);
    return {
      state: item.state,
      county: item.county,
      key: item.key,
      primary_search_url: item.url || '',
      source: item.source || '',
      active: item.active ? 'true' : 'false',
      confidence_base: item.confidenceBase != null ? item.confidenceBase : '',
      quality: item.quality || 'ok',
      version: item.version != null ? item.version : 1,
      validate_bucket: r ? r.bucket : '',
      validate_kind: r ? r.kind : '',
      http_status: r && r.status != null ? r.status : '',
    };
  });

  // Keep export schema stable (original columns) for counties-export.csv
  const header = [
    'state',
    'county',
    'key',
    'primary_search_url',
    'source',
    'active',
    'confidence_base',
    'quality',
    'version',
  ];
  const all = [
    ...rows.map((r) => ({
      state: r.state,
      county: r.county,
      key: r.key,
      primary_search_url: r.primary_search_url,
      source: r.source,
      active: r.active,
      confidence_base: r.confidence_base,
      quality: r.quality,
      version: r.version,
    })),
    ...noUrlRows.filter((n) => !rows.some((r) => r.key === n.key)),
  ].sort((a, b) => a.key.localeCompare(b.key));

  const csv = [
    header.join(','),
    ...all.map((r) => header.map((h) => csvEscape(r[h])).join(',')),
  ].join('\n');
  fs.writeFileSync(EXPORT_CSV, csv + '\n');

  const withUrl = all.filter((r) => (r.primary_search_url || '').trim()).length;
  const active = all.filter((r) => r.active === 'true').length;
  const summary = {
    generatedAt: new Date().toISOString(),
    jurisdictions: all.length,
    withUrl,
    active,
    noUrl: all.length - withUrl,
    note: 'Hybrid revalidate 2026-09-13; DeepShake not_run',
  };
  fs.writeFileSync(EXPORT_SUMMARY, JSON.stringify(summary, null, 2));
  return { all, summary, enriched: rows };
}

async function main() {
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  const items = (index.items || []).filter((i) => i.url && !isGoogle(i.url));
  const googleItems = (index.items || []).filter((i) => i.url && isGoogle(i.url));

  // Prefer sniffing Search-source rows first
  const sniffKeys = new Set();
  const searchFirst = items.filter((i) => i.source === 'Search');
  for (const i of searchFirst) {
    if (sniffKeys.size >= SNIFF_LIMIT) break;
    sniffKeys.add(i.key);
  }
  for (const i of items) {
    if (sniffKeys.size >= SNIFF_LIMIT) break;
    sniffKeys.add(i.key);
  }

  console.log(
    `Hybrid revalidate: ${items.length} URLs, concurrency=${CONCURRENCY}, sniff=${sniffKeys.size}`
  );
  console.log('DeepShake: not_run (no /Volumes/T7, no Mac worker on this cloud VM)');

  const results = await mapPool(items, CONCURRENCY, async (item) =>
    checkUrl(item, sniffKeys.has(item.key))
  );

  // Google placeholders → dead
  for (const g of googleItems) {
    results.push({
      key: g.key,
      state: g.state,
      county: g.county,
      url: g.url,
      finalUrl: g.url,
      source: g.source,
      status: null,
      error: 'google_placeholder',
      ms: 0,
      redirects: 0,
      bucket: 'dead',
      kind: 'google_placeholder',
      activeShould: false,
      hostCheck: { mismatch: false, reason: 'skipped' },
      sniff: null,
    });
  }

  const byKey = new Map(results.map((r) => [r.key, r]));
  let flippedInactive = 0;
  let flippedActive = 0;
  for (const item of index.items) {
    const r = byKey.get(item.key);
    if (!r) {
      if (!item.url) item.active = false;
      continue;
    }
    const prev = item.active !== false;
    // Clear wins only: dead → inactive; validated_true → active
    // uncertain: keep previous active (usually true) per false-negative policy
    if (r.bucket === 'dead') {
      item.active = false;
    } else if (r.bucket === 'validated_true') {
      item.active = true;
    } else {
      // uncertain — keep active unless previously false and we have no new evidence
      item.active = prev ? true : false;
      if (r.activeShould && !prev) {
        // soft promote timeouts? No — leave inactive if was inactive
        item.active = false;
      }
    }
    if (prev && !item.active) flippedInactive++;
    if (!prev && item.active) flippedActive++;
  }

  const validated = results.filter((r) => r.bucket === 'validated_true');
  const dead = results.filter((r) => r.bucket === 'dead');
  const uncertain = results.filter((r) => r.bucket === 'uncertain');
  const mismatches = results.filter((r) => r.hostCheck && r.hostCheck.mismatch);
  const softHost = results.filter((r) => r.hostCheck && r.hostCheck.soft);
  const sniffOk = results.filter((r) => r.sniff && (r.sniff.taxish || r.sniff.hasForm));
  const sniffLogin = results.filter((r) => r.sniff && r.sniff.loginWall);

  const activeCount = index.items.filter((i) => i.active !== false).length;
  const meta = {
    generatedAt: new Date().toISOString(),
    method: 'hybrid_A_B_C',
    deepShake: 'not_run',
    deepShakeNote:
      'DeepShake unavailable: cloud Linux VM has no /Volumes/T7 and no connected Mac self-hosted worker. Mac path: bash scripts/deepshake-hunt-mac.sh then cursor worker start.',
    checked: results.length,
    validatedTrue: validated.length,
    dead: dead.length,
    uncertain: uncertain.length,
    gated: results.filter((r) => r.kind === 'gated').length,
    hostMismatches: mismatches.length,
    hostSoftNoLocalToken: softHost.length,
    sniffSample: sniffKeys.size,
    sniffTaxOrForm: sniffOk.length,
    sniffLoginWall: sniffLogin.length,
    flippedInactive,
    flippedActive,
    indexActiveCount: activeCount,
    indexSearchable: index.items.filter((i) => i.url && !isGoogle(i.url)).length,
    concurrency: CONCURRENCY,
  };

  index.meta = index.meta || {};
  index.meta.hybridRevalidate = meta;
  index.meta.activeCount = activeCount;
  index.meta.healthFull = {
    ...(index.meta.healthFull || {}),
    ...meta,
    mode: 'hybrid_full',
  };

  fs.writeFileSync(INDEX_PATH, JSON.stringify(index));
  fs.writeFileSync(
    OUT_JSON,
    JSON.stringify({ meta, results, mismatches, dead: dead.slice(0, 200) }, null, 2)
  );

  // Validated-true CSV companion
  const vHeader = ['state', 'county', 'key', 'url', 'source', 'status', 'kind', 'finalUrl'];
  const vCsv = [
    vHeader.join(','),
    ...validated
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((r) =>
        [r.state, r.county, r.key, r.url, r.source, r.status, r.kind, r.finalUrl]
          .map(csvEscape)
          .join(',')
      ),
  ].join('\n');
  fs.writeFileSync(OUT_VALIDATED_CSV, vCsv + '\n');

  // Sync jurisdictions
  for (const name of ['jurisdictions.json', 'jurisdictions.min.json']) {
    const p = path.join(DATA, name);
    if (!fs.existsSync(p)) continue;
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    const list = j.jurisdictions || j.items || [];
    for (const row of list) {
      const r = byKey.get(row.key);
      const item = index.items.find((i) => i.key === row.key);
      if (item) {
        row.active = item.active;
        row.url = item.url;
      }
      if (r) {
        row.validate_bucket = r.bucket;
        row.validate_kind = r.kind;
      }
    }
    j.meta = j.meta || {};
    j.meta.hybridRevalidate = meta;
    fs.writeFileSync(p, JSON.stringify(j));
  }

  const { summary } = writeCountiesExport(index, byKey);

  const md = [
    '# URL Hybrid Revalidate (2026-09-13)',
    '',
    `**Generated:** ${meta.generatedAt}`,
    `**DeepShake:** **not_run** — ${meta.deepShakeNote}`,
    '',
    '## Method',
    '',
    '- **A:** HTTP HEAD then GET; follow redirects (≤4); timeout 12s',
    '- **A class:** 200–399 / 401 / 403 / 405 / 429 / 502 / 503 → validated_true; 404/410/NXDOMAIN/InvalidURL/google → dead; timeout/TLS/other 5xx → uncertain (keep active)',
    '- **B:** Registry already prefers Search URL over Base; google placeholders skipped/dead',
    '- **C:** Redirect follow; sample title/form sniff; host vs state+county soft cross-check',
    '',
    '## Counts',
    '',
    `| Metric | Count |`,
    `|---|---:|`,
    `| Listed (export jurisdictions) | ${summary.jurisdictions} |`,
    `| With URL | ${summary.withUrl} |`,
    `| Checked this run | ${meta.checked} |`,
    `| Validated-true | ${meta.validatedTrue} |`,
    `| Dead | ${meta.dead} |`,
    `| Uncertain | ${meta.uncertain} |`,
    `| Index active after write-back | ${meta.indexActiveCount} |`,
    `| Flipped inactive | ${flippedInactive} |`,
    `| Flipped active | ${flippedActive} |`,
    `| Host hard mismatches | ${mismatches.length} |`,
    `| Sniff sample (tax/form) | ${sniffOk.length}/${sniffKeys.size} |`,
    '',
    '## Host mismatches (flagged)',
    '',
    ...(mismatches.length
      ? mismatches.map(
          (m) =>
            `- \`${m.key}\` → \`${m.finalUrl || m.url}\` — ${m.hostCheck.reason}`
        )
      : ['- none']),
    '',
    '## Dead sample (first 60)',
    '',
    ...dead
      .slice(0, 60)
      .map(
        (f) =>
          `- \`${f.key}\` → \`${f.url}\` — status=${f.status} kind=${f.kind} error=${f.error || ''}`
      ),
    '',
  ].join('\n');
  fs.writeFileSync(REPORT_MD, md);

  console.log(JSON.stringify(meta, null, 2));
  console.log(`Wrote ${OUT_JSON}`);
  console.log(`Wrote ${OUT_VALIDATED_CSV}`);
  console.log(`Wrote ${EXPORT_CSV}`);
  console.log(`Wrote ${REPORT_MD}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
