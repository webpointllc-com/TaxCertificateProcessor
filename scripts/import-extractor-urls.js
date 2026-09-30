#!/usr/bin/env node
/**
 * Parse the Development Extractor table dump (ExtractorUrls.txt) into JSON.
 *
 * This dump is a seed, not a lock. Searching inventory, golden overrides, and
 * operator locks win. Google homepages, {parcel} templates, and "(none recorded)"
 * never become collector URLs.
 *
 * Usage: node scripts/import-extractor-urls.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { isGoogleFallbackUrl, isRealHttpUrl } = require('../src/services/spulTruth');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'data', 'extractor_urls.txt');
const OUT = path.join(ROOT, 'data', 'extractor_urls.json');
const INVENTORY = path.join(ROOT, 'data', 'spul_searching_inventory.json');

const LINE =
  /^(\S+)\s+(\d+)\s+(Yes|No)\s+(Search|Base|-)\s+(\S.*)$/;

function parseKey(token) {
  const raw = String(token || '');
  const m = raw.match(/^(USVI|DC|[A-Z]{2})-(.+)$/);
  if (!m) return { state: '', countyToken: raw, county: raw };
  const state = m[1] === 'USVI' ? 'VI' : m[1];
  const countyToken = m[2];
  const county = countyToken
    .replace(/Parish$/i, ' Parish')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .trim();
  return { state, countyToken, county };
}

function isTemplate(url) {
  return /\{[a-z0-9]+\}|\{0\}/i.test(url || '');
}

function usable(row) {
  const url = row.url || '';
  if (!row.active) return false;
  if (!isRealHttpUrl(url) || isGoogleFallbackUrl(url) || isTemplate(url)) return false;
  if (/^https?:\/\/https?:\/\//i.test(url)) return false;
  return true;
}

function parseDump(text) {
  const rows = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    const m = LINE.exec(line);
    if (!m) continue;
    const key = m[1];
    const { state, countyToken, county } = parseKey(key);
    const url = m[5].trim();
    rows.push({
      key,
      state,
      county,
      countyToken,
      version: Number(m[2]),
      active: m[3] === 'Yes',
      source: m[4],
      url: url === '(none recorded)' || url === '-' ? '' : url
    });
  }
  return rows;
}

function pickForKey(rows) {
  const search = rows.filter((r) => r.source === 'Search' && usable(r));
  if (search.length) return search[0];
  const base = rows.filter((r) => r.source === 'Base' && usable(r));
  if (base.length) return base[0];
  return null;
}

function main() {
  if (!fs.existsSync(SRC)) {
    console.error('missing', SRC);
    process.exit(1);
  }
  const text = fs.readFileSync(SRC, 'utf8');
  const header = text.split('\n').slice(0, 8).join('\n');
  const generated = (header.match(/Generated\s+(\d{4}-\d{2}-\d{2}[^\n]*)/) || [])[1] || '';
  const totalLine = (header.match(/Total extractors:\s+(\d+)/i) || [])[1];
  const rows = parseDump(text);
  const byKey = new Map();
  for (const row of rows) {
    if (!byKey.has(row.key)) byKey.set(row.key, []);
    byKey.get(row.key).push(row);
  }
  const picked = [];
  const empty = [];
  for (const [key, group] of byKey) {
    const choice = pickForKey(group);
    if (choice) picked.push(choice);
    else empty.push(key);
  }

  const inventory = fs.existsSync(INVENTORY)
    ? JSON.parse(fs.readFileSync(INVENTORY, 'utf8'))
    : { rows: [] };
  const invKeys = new Set((inventory.rows || []).map((r) => r.key));
  const onlyDump = picked.filter((r) => !invKeys.has(r.key)).map((r) => r.key);
  const onlyInventory = [...invKeys].filter((k) => !byKey.has(k));

  const out = {
    source: {
      file: 'data/extractor_urls.txt',
      environment: 'Development',
      generated,
      declaredTotal: totalLine ? Number(totalLine) : rows.length,
      note: 'Raw Extractor table dump. Searching inventory + golden overrides + operator locks win. Do not lock google.com, templates, or empty rows.'
    },
    stats: {
      parsedRows: rows.length,
      uniqueKeys: byKey.size,
      usablePicked: picked.length,
      googleOrEmpty: empty.length,
      overlapSearching: picked.filter((r) => invKeys.has(r.key)).length,
      onlyInDump: onlyDump,
      onlyInSearchingInventory: onlyInventory
    },
    rows: picked
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        out: path.relative(ROOT, OUT),
        parsedRows: rows.length,
        uniqueKeys: byKey.size,
        usablePicked: picked.length,
        overlapSearching: out.stats.overlapSearching,
        onlyInDump: onlyDump,
        logan: picked.find((r) => r.key === 'KY-Logan')?.url || null
      },
      null,
      2
    ) + '\n'
  );
}

module.exports = { parseDump, pickForKey, usable, parseKey };

if (require.main === module) main();
