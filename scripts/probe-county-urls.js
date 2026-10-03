#!/usr/bin/env node
/**
 * Live-probe every catalog searchURL. Dedupes hosts. Resumable.
 *
 *   node scripts/probe-county-urls.js
 *   node scripts/probe-county-urls.js --apply
 *   node scripts/probe-county-urls.js --limit 50
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { COUNTIES_PATH, loadGoldenOverrides } = require('./import-lib');
const { isRealHttpUrl } = require('../src/services/spulTruth');
const { classifyProbe } = require('./probe-lib');

const ROOT = path.join(__dirname, '..');
const OUT_PATH = path.join(ROOT, 'data', 'seed_probe_results.json');
const APPLY = process.argv.includes('--apply');
const limitIdx = process.argv.indexOf('--limit');
const LIMIT = limitIdx >= 0 ? Number(process.argv[limitIdx + 1]) : 0;
const CONCURRENCY = 18;
const TIMEOUT_MS = 12000;
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

function loadJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

function normalizeUrl(url) {
  return String(url || '').trim();
}

async function fetchOne(url) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: ac.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    const buf = Buffer.from(await res.arrayBuffer());
    const html = buf.slice(0, 400000).toString('utf8');
    return {
      status: res.status,
      finalUrl: String(res.url || url),
      html,
      bytes: buf.length,
      error: null
    };
  } catch (err) {
    const msg = String(err && err.message ? err.message : err);
    let error = 'fetch_error';
    if (/abort|timeout/i.test(msg)) error = 'timeout';
    else if (/ENOTFOUND|getaddrinfo|dns/i.test(msg)) error = 'dns';
    else if (/ECONNREFUSED/i.test(msg)) error = 'refused';
    else if (/certificate|SSL|TLS/i.test(msg)) error = 'tls';
    return { status: 0, finalUrl: url, html: '', bytes: 0, error };
  } finally {
    clearTimeout(t);
  }
}

async function pool(items, n, worker) {
  let i = 0;
  const runners = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
}

function goldenKeys(map) {
  const keys = new Set();
  for (const [k, val] of map.entries()) {
    keys.add(k);
    if (val.county && val.state) {
      keys.add(`${val.state}-${String(val.county).replace(/\s+/g, '')}`);
      keys.add(`${val.state}-${val.county}`);
    }
  }
  return keys;
}

async function main() {
  const counties = loadJson(COUNTIES_PATH, []);
  const golden = loadGoldenOverrides();
  const lockedKeys = goldenKeys(golden);
  const existing = loadJson(OUT_PATH, { probedAt: '', byUrl: {}, byKey: {}, summary: {} });
  const byUrl = existing.byUrl && typeof existing.byUrl === 'object' ? existing.byUrl : {};

  const jobs = [];
  const seen = new Set();
  for (const row of counties) {
    const url = normalizeUrl(row.searchURL);
    if (!isRealHttpUrl(url)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    jobs.push({
      url,
      sampleKey: row.key || `${row.state}-${row.county}`,
      entity: row.entity,
      entityNote: row.entityNote,
      entityType: row.entityType,
      vendor: row.vendor
    });
  }
  const queue = LIMIT > 0 ? jobs.slice(0, LIMIT) : jobs.filter((j) => !byUrl[j.url] || !byUrl[j.url].verdict);
  console.log(`Probe queue ${queue.length} of ${jobs.length} unique URLs (already have ${Object.keys(byUrl).length})`);

  let done = 0;
  await pool(queue, CONCURRENCY, async (job) => {
    const raw = await fetchOne(job.url);
    const classified = classifyProbe({
      url: job.url,
      finalUrl: raw.finalUrl,
      status: raw.status,
      html: raw.html,
      error: raw.error,
      entity: job.entity,
      entityNote: job.entityNote,
      entityType: job.entityType,
      vendor: job.vendor
    });
    byUrl[job.url] = {
      url: job.url,
      sampleKey: job.sampleKey,
      status: raw.status,
      finalUrl: raw.finalUrl,
      error: raw.error,
      bytes: raw.bytes,
      title: classified.title || '',
      verdict: classified.verdict,
      reason: classified.reason,
      fields: classified.fields || [],
      probedAt: new Date().toISOString()
    };
    done += 1;
    if (done % 25 === 0 || done === queue.length) {
      console.log(`  ${done}/${queue.length} last=${job.sampleKey} ${classified.verdict} http=${raw.status}`);
      saveJson(OUT_PATH, { probedAt: new Date().toISOString(), byUrl, byKey: {}, summary: {} });
    }
  });

  const byKey = {};
  const summary = {
    uniqueUrls: jobs.length,
    probed: 0,
    collector_search: 0,
    assessor_search: 0,
    homepage: 0,
    dead: 0,
    unknown_live: 0,
    empty: 0,
    rows: counties.length
  };
  for (const row of counties) {
    const key = row.key || `${row.state}-${row.county}`;
    const url = normalizeUrl(row.searchURL);
    if (!isRealHttpUrl(url)) {
      byKey[key] = { verdict: 'empty', url: '' };
      summary.empty++;
      continue;
    }
    const hit = byUrl[url];
    if (!hit) {
      byKey[key] = { verdict: 'unknown_live', url, pending: true };
      continue;
    }
    byKey[key] = {
      verdict: hit.verdict,
      url,
      status: hit.status,
      reason: hit.reason,
      title: hit.title,
      fields: hit.fields,
      golden: lockedKeys.has(key) || lockedKeys.has(`${row.state}-${String(row.county).replace(/\s+/g, '')}`)
    };
    summary.probed++;
    summary[hit.verdict] = (summary[hit.verdict] || 0) + 1;
  }

  const report = {
    probedAt: new Date().toISOString(),
    method:
      'Live GET with desktop Chrome UA, 12s timeout, TLS verify off for county certs. Collector search vs assessor vs homepage vs dead. Link presented only for collector_search (plus golden locks).',
    summary,
    byUrl,
    byKey
  };
  saveJson(OUT_PATH, report);
  console.log('Summary', summary);

  if (!APPLY) {
    console.log('Dry catalog apply skipped (pass --apply to write counties.json).');
    return;
  }

  let changed = 0;
  const next = counties.map((row) => {
    const key = row.key || `${row.state}-${row.county}`;
    if (lockedKeys.has(key) || lockedKeys.has(`${row.state}-${String(row.county).replace(/\s+/g, '')}`)) {
      return { ...row, lastProbed: new Date().toISOString().slice(0, 10) };
    }
    const url = normalizeUrl(row.searchURL);
    const hit = isRealHttpUrl(url) ? byUrl[url] : null;
    if (!hit && isRealHttpUrl(url)) return row;
    const verdict = hit ? hit.verdict : 'empty';
    const out = { ...row };
    out.lastProbed = new Date().toISOString().slice(0, 10);
    out.probeStatus = verdict;
    out.probeReason = hit ? hit.reason : 'no_http_url';
    if (hit && hit.title) out.probeTitle = hit.title.slice(0, 160);
    if (hit && Array.isArray(hit.fields) && hit.fields.length) {
      out.layout = { search_by: [...new Set(hit.fields.map((f) => f.role))], fields: hit.fields };
    }
    if (verdict === 'collector_search') {
      out.verified = true;
      out.coverageStatus = 'verified';
    } else if (verdict === 'assessor_search') {
      out.entityType = out.entityType === 'tax_collector' ? 'appraisal_district' : out.entityType;
      out.verified = false;
      out.coverageStatus = 'needs_correction';
      out.entityNote = [
        out.entityNote,
        'Live probe: this looks like an assessor/appraisal search, not the tax collecting entity pay page. Do not present as the collector link.'
      ]
        .filter(Boolean)
        .join(' ')
        .slice(0, 400);
    } else if (verdict === 'homepage' || verdict === 'dead' || verdict === 'unknown_live' || verdict === 'empty') {
      out.verified = false;
      out.coverageStatus = 'needs_correction';
      if (verdict === 'dead') {
        out.entityNote = [
          out.entityNote,
          `Live probe ${hit && hit.status ? 'HTTP ' + hit.status : hit && hit.error}: not a usable collector search page.`
        ]
          .filter(Boolean)
          .join(' ')
          .slice(0, 400);
      } else if (verdict === 'homepage') {
        out.entityNote = [
          out.entityNote,
          'Live probe: county/municipality homepage, not a parcel tax search form.'
        ]
          .filter(Boolean)
          .join(' ')
          .slice(0, 400);
      } else if (verdict === 'unknown_live') {
        out.entityNote = [
          out.entityNote,
          'Live probe: page loaded but we are not sure it is the tax collecting entity search. Do not present a link until confirmed.'
        ]
          .filter(Boolean)
          .join(' ')
          .slice(0, 400);
      }
    }
    changed++;
    return out;
  });

  saveJson(COUNTIES_PATH, next);
  console.log(`Applied probe verdicts to ${changed} rows → ${COUNTIES_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
