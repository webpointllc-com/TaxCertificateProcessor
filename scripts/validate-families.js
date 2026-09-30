#!/usr/bin/env node
/**
 * Replicable validator: one sample per vendor family, then fan-out.
 * Optional Chrome (--chrome) opens a real browser for non-Cloudflare samples.
 * Cloudflare families stay user_chrome_tab / PAT — never spoofed.
 *
 *   node scripts/validate-families.js
 *   node scripts/validate-families.js --chrome --limit=12
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const vendorFamily = require('../src/services/vendorFamily');
const siteValidator = require('../src/services/siteValidator');
const { fetchOne, classifyProbe, pool, extractFields } = require('./probe-lib');
const { isGoogleFallbackUrl, isRealHttpUrl } = require('../src/services/spulTruth');

const ROOT = path.join(__dirname, '..');
const EXTRACTORS = path.join(ROOT, 'data', 'extractor_urls.json');
const INVENTORY = path.join(ROOT, 'data', 'spul_searching_inventory.json');
const OUT = path.join(ROOT, 'data', 'family_matrix.json');

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
  })
);

const WANT_CHROME = Boolean(args.chrome);
const LIMIT = args.limit ? Math.max(parseInt(args.limit, 10), 1) : 0;
const CHROME =
  process.env.CHROME ||
  ['/usr/bin/google-chrome', '/usr/local/bin/google-chrome', '/usr/bin/google-chrome-stable'].find((p) =>
    fs.existsSync(p)
  );

function loadJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function allRows() {
  const dump = loadJson(EXTRACTORS, { rows: [] });
  const inventory = loadJson(INVENTORY, { rows: [] });
  const seen = new Set();
  const out = [];
  for (const row of [...(dump.rows || []), ...(inventory.rows || [])]) {
    const url = String(row.url || '').trim();
    if (!isRealHttpUrl(url) || isGoogleFallbackUrl(url)) continue;
    const id = `${row.key || ''}|${url}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(row);
  }
  return out;
}

function chromeDump(url) {
  return new Promise((resolve) => {
    if (!CHROME) return resolve({ ok: false, error: 'no_chrome' });
    const dir = `/tmp/wpt-chrome-fam-${process.pid}-${Math.random().toString(16).slice(2)}`;
    fs.mkdirSync(dir, { recursive: true });
    const child = spawn(
      'timeout',
      [
        '12',
        CHROME,
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        `--user-data-dir=${dir}`,
        '--dump-dom',
        '--virtual-time-budget=8000',
        url
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );
    let html = '';
    child.stdout.on('data', (buf) => {
      html += buf;
      if (html.length > 400000) html = html.slice(0, 400000);
    });
    const timer = setTimeout(() => child.kill('SIGKILL'), 14000);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0 && html.length > 80, html, error: code === 0 ? '' : `chrome_${code}` });
    });
  });
}

async function probeSample(fam) {
  if (!fam.sample) return { verdict: 'empty', reason: 'no_sample', skipped: true };
  if (fam.kind === 'assessor' || fam.kind === 'skip' || fam.kind === 'payment_hub' || fam.kind === 'hub') {
    return { verdict: fam.kind === 'assessor' ? 'assessor_search' : 'hub', reason: `family_${fam.kind}`, skipped: true };
  }
  if (fam.chrome === 'user_session' || fam.kind === 'unknown') {
    return {
      verdict: fam.kind === 'collector' ? 'collector_search' : 'unknown_live',
      reason: 'family_user_chrome_pat',
      skipped: true,
      needsDeepShake: true
    };
  }
  const fetched = await fetchOne(fam.sample, 8000);
  const fields = extractFields(fetched.html || '');
  let verdict = classifyProbe({
    url: fam.sample,
    finalUrl: fetched.finalUrl,
    status: fetched.status,
    html: fetched.html,
    error: fetched.error
  });
  let html = fetched.html || '';
  if (
    WANT_CHROME &&
    fam.chrome === 'sample' &&
    (verdict.verdict === 'unknown_live' || verdict.verdict === 'dead' || siteValidator.cloudflareGated(verdict))
  ) {
    const dumped = await chromeDump(fam.sample);
    if (dumped.ok) {
      html = dumped.html;
      verdict = classifyProbe({
        url: fam.sample,
        finalUrl: fam.sample,
        status: 200,
        html,
        error: ''
      });
      verdict.via = 'chrome_dump';
    }
  }
  const drFields = siteValidator.sniffDrFields(html, fields);
  return {
    verdict: verdict.verdict,
    reason: verdict.reason,
    title: verdict.title || '',
    drFields,
    status: fetched.status,
    via: verdict.via || 'http_get'
  };
}

async function main() {
  const rows = allRows();
  let families = vendorFamily.groupRows(rows).sort((a, b) => b.keys - a.keys);
  if (LIMIT) families = families.slice(0, LIMIT);
  const probes = {};
  const todo = families.filter((f) => f.kind === 'collector' && f.chrome === 'sample');
  await pool(todo, 6, async (fam) => {
    probes[fam.family] = await probeSample(fam);
  });
  for (const fam of families) {
    if (!probes[fam.family]) probes[fam.family] = await probeSample(fam);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    method: 'vendor_family_matrix + PAT user session',
    how: [
      'Collapse ExtractorUrls + Searching inventory by vendor family (host rules).',
      'One sample URL per family. Shared bare homepages are hubs (specificity 0), not mass locks.',
      'Assessor / payment-hub families never become collector_search.',
      'Cloudflare collector families wait for a signed-in user Chrome tab and a wptpat_ portal access token.',
      'Optional --chrome dump-dom for non-CF samples only. No fingerprint spoof. No biometric forge.',
      'Fan-out the family verdict onto every county key that shares that host. County-specific paths stay on that county.'
    ],
    rows: rows.length,
    familyCount: families.length,
    known: vendorFamily.KNOWN.length,
    families: families.map((f) => ({
      ...f,
      probe: probes[f.family] || null
    }))
  };

  const counts = { collector: 0, assessor: 0, hub: 0, payment_hub: 0, unknown: 0, skip: 0, lockableKeys: 0 };
  for (const f of report.families) {
    counts[f.kind] = (counts[f.kind] || 0) + 1;
    counts.lockableKeys += f.lockable;
  }
  report.counts = counts;

  fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');
  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        families: report.families.length,
        rows: report.rows,
        counts,
        out: path.relative(ROOT, OUT)
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

module.exports = { main, allRows };
