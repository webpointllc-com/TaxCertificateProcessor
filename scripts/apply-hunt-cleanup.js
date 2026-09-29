#!/usr/bin/env node
/**
 * Rebuild counties.json from the last committed catalog plus hunt
 * discoveries that still classify as collector_search under tight vendor rules.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { COUNTIES_PATH, loadGoldenOverrides, detectVendor } = require('./import-lib');
const { isRealHttpUrl } = require('../src/services/spulTruth');
const { classifyProbe, reclassifyStored, shouldLock, flCountySlugs } = require('./probe-lib');

const ROOT = path.join(__dirname, '..');
const PROBE_PATH = path.join(ROOT, 'data', 'seed_probe_results.json');
const HUNT_PATH = path.join(ROOT, 'data', 'seed_hunt_results.json');
const TODAY = new Date().toISOString().slice(0, 10);

function loadJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

function compact(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/saint\b/g, 'st')
    .replace(/[^a-z0-9]/g, '');
}

function rowKey(row) {
  return row.key || `${row.state}-${row.county}`;
}

function goldenKeySet(map) {
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

function applyVerdict(row, hit, verdict) {
  const out = { ...row };
  out.lastProbed = TODAY;
  out.probeStatus = verdict;
  out.probeReason = (hit && hit.reason) || out.probeReason || '';
  if (hit && hit.title) out.probeTitle = String(hit.title).slice(0, 160);
  if (hit && Array.isArray(hit.fields) && hit.fields.length) {
    out.layout = { search_by: [...new Set(hit.fields.map((f) => f.role))], fields: hit.fields };
  }
  if (verdict === 'collector_search') {
    out.verified = true;
    out.coverageStatus = 'verified';
    out.entityType = 'tax_collector';
  } else {
    out.verified = false;
    out.coverageStatus = 'needs_correction';
    if (verdict === 'assessor_search') {
      out.entityType = out.entityType === 'tax_collector' ? 'appraisal_district' : out.entityType;
    }
  }
  return out;
}

function main() {
  const golden = loadGoldenOverrides();
  const lockedKeys = goldenKeySet(golden);
  const origCounties = JSON.parse(execSync('git show 2bb35f2:data/counties.json', { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }));
  const current = loadJson(COUNTIES_PATH, []);
  const probe = loadJson(PROBE_PATH, { byUrl: {} });
  const hunt = loadJson(HUNT_PATH, { upgrades: [], added: [] });
  const byUrl = probe.byUrl || {};

  let reclassified = 0;
  for (const hit of Object.values(byUrl)) {
    const next = reclassifyStored(hit, {});
    if (next.verdict && next.verdict !== hit.verdict) {
      hit.verdict = next.verdict;
      hit.reason = next.reason;
      reclassified++;
    }
  }

  const bestByCounty = new Map();
  function consider(state, county, rec) {
    if (!shouldLock(rec.verdict) || !isRealHttpUrl(rec.url)) return;
    const k = `${state}:${compact(county)}`;
    const prev = bestByCounty.get(k);
    const vendorish = /county-taxes|landnav|spatialest|webpayments|eproptax|setsearchparameters|myharris|mptsweb|devnetwedge|dekalbtax|propertytax\.(ark|lacounty|alameda|knoxcounty)|taxbill\./i.test(
      rec.url
    );
    if (!prev) {
      bestByCounty.set(k, { ...rec, vendorish });
      return;
    }
    if (vendorish && !prev.vendorish) bestByCounty.set(k, { ...rec, vendorish });
  }

  for (const [url, hit] of Object.entries(byUrl)) {
    const next = { url, verdict: hit.verdict, reason: hit.reason, title: hit.title, fields: hit.fields, status: hit.status, source: hit.source };
    const key = hit.sampleKey || '';
    const m = String(key).match(/^([A-Z]{2})-(.+)$/);
    if (m) consider(m[1], m[2], next);
    const host = (() => {
      try {
        return new URL(url).hostname;
      } catch {
        return '';
      }
    })();
    const slug = host.split('.')[0];
    if (/county-taxes\.com/i.test(url) && slug) consider('FL', slug, next);
  }

  const origByKey = new Map(origCounties.map((r) => [rowKey(r), r]));
  const addedKeys = new Set((hunt.added || []).map((a) => `FL-${String(a.county).replace(/\s+/g, '')}`));
  const extra = current.filter((r) => addedKeys.has(rowKey(r)) && !origByKey.has(rowKey(r)));

  const nextRows = [];
  const kept = [];
  const restored = [];

  for (const row of origCounties) {
    const key = rowKey(row);
    if (lockedKeys.has(key) || lockedKeys.has(`${row.state}-${String(row.county).replace(/\s+/g, '')}`)) {
      nextRows.push({ ...row, lastProbed: TODAY });
      continue;
    }
    const found = bestByCounty.get(`${row.state}:${compact(row.county)}`);
    if (found && shouldLock(found.verdict)) {
      const out = applyVerdict({ ...row }, found, 'collector_search');
      out.searchURL = found.url;
      out.vendor = detectVendor(found.url) || out.vendor || '';
      if (isRealHttpUrl(row.searchURL) && row.searchURL !== found.url) {
        if (/assessor|appraiser|\/cad\b|qpublic|beacon|countygovservices/i.test(row.searchURL)) {
          out.rdsURL = out.rdsURL || row.searchURL;
        }
        out.howFound = `Live hunt ${TODAY}: ${found.source || found.reason} → ${found.url} (HTTP ${found.status}). Catalog seed was not the collector search.`;
        kept.push({ key, to: found.url, reason: found.reason });
      } else {
        kept.push({ key, to: found.url, reason: found.reason });
      }
      nextRows.push(out);
      continue;
    }

    const url = String(row.searchURL || '').trim();
    const hit = isRealHttpUrl(url) ? byUrl[url] : null;
    const classified = hit
      ? classifyProbe({
          url,
          finalUrl: hit.finalUrl,
          status: hit.status,
          html: `<title>${hit.title || ''}</title>`,
          error: hit.error,
          entity: row.entity,
          entityNote: row.entityNote,
          entityType: row.entityType,
          vendor: row.vendor
        })
      : { verdict: isRealHttpUrl(url) ? row.probeStatus || 'unknown_live' : 'empty', reason: 'no_http_url' };
    let verdict = classified.verdict || 'empty';
    if (verdict === 'collector_search' && !shouldLock(verdict)) verdict = 'unknown_live';
    if (row.probeStatus === 'assessor_search' && verdict !== 'collector_search') {
      verdict = 'assessor_search';
    }
    const origHit = hit ? { ...hit, reason: classified.reason, title: classified.title || hit.title } : null;
    nextRows.push(applyVerdict(row, origHit, verdict));
    if (row.probeStatus === 'collector_search' && verdict !== 'collector_search') restored.push(key);
  }

  for (const row of extra) {
    const found = bestByCounty.get(`${row.state}:${compact(row.county)}`);
    if (found && shouldLock(found.verdict)) {
      nextRows.push(
        applyVerdict(
          {
            ...row,
            searchURL: found.url,
            vendor: 'county_taxes',
            importSource: 'live_hunt_2026-09-29'
          },
          found,
          'collector_search'
        )
      );
      kept.push({ key: rowKey(row), to: found.url, reason: found.reason, added: true });
    }
  }

  const summary = {};
  for (const row of nextRows) {
    const v = row.probeStatus || 'none';
    summary[v] = (summary[v] || 0) + 1;
  }

  saveJson(COUNTIES_PATH, nextRows);
  saveJson(PROBE_PATH, { ...probe, byUrl, probedAt: new Date().toISOString() });
  console.log('Reclassified stored hits', reclassified);
  console.log('Kept collector locks', kept.length);
  console.log('Unlocked false collector flags', restored.length);
  console.log('Verdicts', summary, 'rows', nextRows.length);
}

main();
