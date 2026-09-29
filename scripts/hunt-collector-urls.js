#!/usr/bin/env node
/**
 * Hunt real tax-collector search/pay URLs for every catalog seed.
 *
 * Does not invent URLs: only keeps live collector_search (including known
 * vendor hosts that answer Cloudflare 403 while non-participants 404).
 *
 *   node scripts/hunt-collector-urls.js
 *   node scripts/hunt-collector-urls.js --apply
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { COUNTIES_PATH, CENSUS_PATH, loadGoldenOverrides, detectVendor } = require('./import-lib');
const { isRealHttpUrl } = require('../src/services/spulTruth');
const {
  classifyProbe,
  reclassifyStored,
  fetchOne,
  pool,
  extractCollectorLinks,
  flCountySlugs,
  shouldLock
} = require('./probe-lib');

const ROOT = path.join(__dirname, '..');
const PROBE_PATH = path.join(ROOT, 'data', 'seed_probe_results.json');
const HUNT_PATH = path.join(ROOT, 'data', 'seed_hunt_results.json');
const APPLY = process.argv.includes('--apply');
const CONCURRENCY = 16;
const TODAY = new Date().toISOString().slice(0, 10);

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

function loadJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

function rowKey(row) {
  return row.key || `${row.state}-${row.county}`;
}

function compact(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/saint\b/g, 'st')
    .replace(/[^a-z0-9]/g, '');
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

function hitFromRaw(url, raw, extra = {}) {
  const classified = classifyProbe({
    url,
    finalUrl: raw.finalUrl,
    status: raw.status,
    html: raw.html,
    error: raw.error,
    entity: extra.entity,
    entityNote: extra.entityNote,
    entityType: extra.entityType,
    vendor: extra.vendor
  });
  return {
    url,
    sampleKey: extra.sampleKey || '',
    status: raw.status,
    finalUrl: raw.finalUrl,
    error: raw.error,
    bytes: raw.bytes,
    title: classified.title || '',
    verdict: classified.verdict,
    reason: classified.reason,
    fields: classified.fields || [],
    source: extra.source || 'hunt',
    probedAt: new Date().toISOString()
  };
}

async function main() {
  const counties = loadJson(COUNTIES_PATH, []);
  const census = loadJson(CENSUS_PATH, []);
  const golden = loadGoldenOverrides();
  const lockedKeys = goldenKeySet(golden);
  const probe = loadJson(PROBE_PATH, { byUrl: {}, byKey: {}, summary: {} });
  const byUrl = probe.byUrl && typeof probe.byUrl === 'object' ? probe.byUrl : {};

  let reclassified = 0;
  for (const [url, hit] of Object.entries(byUrl)) {
    const row = counties.find((c) => c.searchURL === url) || {};
    const next = reclassifyStored(hit, row);
    if (next.verdict && next.verdict !== hit.verdict) {
      hit.verdict = next.verdict;
      hit.reason = next.reason;
      if (next.title) hit.title = next.title;
      if (next.fields) hit.fields = next.fields;
      reclassified++;
    }
  }
  console.log(`Reclassified ${reclassified} stored probe hits with tightened rules`);

  const jobs = [];
  const seen = new Set();
  function queue(url, meta) {
    const href = String(url || '').trim();
    if (!isRealHttpUrl(href)) return;
    if (seen.has(href)) return;
    seen.add(href);
    jobs.push({ url: href, ...meta });
  }

  for (const row of census.filter((c) => c.state === 'FL')) {
    for (const slug of flCountySlugs(row.county)) {
      queue(`https://${slug}.county-taxes.com/public`, {
        sampleKey: `FL-${String(row.county).replace(/\s+/g, '')}`,
        source: 'fl_county_taxes_pattern',
        entity: `${row.county} County FL Tax Collector`,
        entityType: 'tax_collector',
        vendor: 'county_taxes'
      });
    }
  }
  for (const row of counties.filter((c) => c.state === 'FL')) {
    for (const slug of flCountySlugs(row.county)) {
      queue(`https://${slug}.county-taxes.com/public`, {
        sampleKey: rowKey(row),
        source: 'fl_county_taxes_pattern',
        entity: row.entity || `${row.county} County FL Tax Collector`,
        entityType: 'tax_collector',
        vendor: 'county_taxes'
      });
    }
  }

  const crawlQueue = [];
  for (const row of counties) {
    const url = String(row.searchURL || '').trim();
    if (!isRealHttpUrl(url)) continue;
    const verdict = row.probeStatus || (byUrl[url] && byUrl[url].verdict) || '';
    if (
      verdict === 'homepage' ||
      verdict === 'unknown_live' ||
      verdict === 'assessor_search' ||
      verdict === 'collector_search' ||
      verdict === 'dead' ||
      ['FL', 'CA', 'AL', 'NC', 'IL', 'TX', 'WI', 'AR'].includes(row.state)
    ) {
      crawlQueue.push(row);
    }
  }
  console.log(`Probe queue ${jobs.length} pattern URLs; crawl ${crawlQueue.length} catalog pages for collector links`);

  let done = 0;
  await pool(jobs, CONCURRENCY, async (job) => {
    if (byUrl[job.url] && byUrl[job.url].verdict && job.source !== 'fl_county_taxes_pattern') return;
    if (byUrl[job.url] && byUrl[job.url].source === 'fl_county_taxes_pattern' && byUrl[job.url].verdict) return;
    const raw = await fetchOne(job.url);
    byUrl[job.url] = hitFromRaw(job.url, raw, job);
    done += 1;
    if (done % 20 === 0 || done === jobs.length) {
      console.log(`  pattern ${done}/${jobs.length} last=${job.sampleKey} ${byUrl[job.url].verdict} http=${raw.status}`);
      saveJson(PROBE_PATH, { ...probe, probedAt: new Date().toISOString(), byUrl });
    }
  });

  const discovered = [];
  let crawled = 0;
  await pool(crawlQueue, CONCURRENCY, async (row) => {
    const url = String(row.searchURL || '').trim();
    const raw = await fetchOne(url);
    const links = extractCollectorLinks(raw.html, raw.finalUrl || url);
    crawled += 1;
    if (links.length) {
      for (const link of links) {
        discovered.push({
          fromKey: rowKey(row),
          fromUrl: url,
          href: link.href,
          text: link.text,
          reason: link.reason,
          state: row.state,
          county: row.county
        });
        queue(link.href, {
          sampleKey: rowKey(row),
          source: `crawl:${link.reason}`,
          entity: row.entity,
          entityNote: row.entityNote,
          entityType: row.entityType,
          vendor: detectVendor(link.href) || row.vendor
        });
      }
    }
    if (crawled % 40 === 0 || crawled === crawlQueue.length) {
      console.log(`  crawl ${crawled}/${crawlQueue.length} last=${rowKey(row)} links=${links.length}`);
    }
  });

  const follow = jobs.filter((j) => j.source && String(j.source).startsWith('crawl:'));
  console.log(`Follow ${follow.length} discovered collector-looking links`);
  done = 0;
  await pool(follow, CONCURRENCY, async (job) => {
    if (byUrl[job.url] && byUrl[job.url].verdict && byUrl[job.url].source === job.source) {
      done += 1;
      return;
    }
    const raw = await fetchOne(job.url);
    byUrl[job.url] = hitFromRaw(job.url, raw, job);
    done += 1;
    if (done % 20 === 0 || done === follow.length) {
      console.log(`  follow ${done}/${follow.length} last=${job.sampleKey} ${byUrl[job.url].verdict} http=${raw.status}`);
      saveJson(PROBE_PATH, { ...probe, probedAt: new Date().toISOString(), byUrl });
    }
  });

  const byCounty = new Map();
  function remember(state, county, rec) {
    const k = `${state}:${compact(county)}`;
    const prev = byCounty.get(k);
    if (!prev || (shouldLock(rec.verdict) && !shouldLock(prev.verdict))) byCounty.set(k, rec);
  }

  for (const [url, hit] of Object.entries(byUrl)) {
    if (!shouldLock(hit.verdict)) continue;
    const key = hit.sampleKey || '';
    const m = String(key).match(/^([A-Z]{2})-(.+)$/);
    if (!m) continue;
    remember(m[1], m[2], {
      url: hit.finalUrl && isRealHttpUrl(hit.finalUrl) && /county-taxes\.(com|net)/i.test(url) ? url : url,
      verdict: hit.verdict,
      reason: hit.reason,
      title: hit.title,
      fields: hit.fields,
      source: hit.source || 'probe',
      status: hit.status
    });
  }

  const upgrades = [];
  const added = [];
  const nextRows = counties.map((row) => {
    const key = rowKey(row);
    if (lockedKeys.has(key) || lockedKeys.has(`${row.state}-${String(row.county).replace(/\s+/g, '')}`)) {
      return { ...row, lastProbed: TODAY };
    }
    const catalogUrl = String(row.searchURL || '').trim();
    const catalogHit = isRealHttpUrl(catalogUrl) ? byUrl[catalogUrl] : null;
    const found = byCounty.get(`${row.state}:${compact(row.county)}`);
    const out = { ...row, lastProbed: TODAY };

    if (found && shouldLock(found.verdict) && found.url && found.url !== catalogUrl) {
      if (catalogUrl && /assessor|appraiser|\/cad\b|qpublic|beacon|countygovservices/i.test(catalogUrl)) {
        out.rdsURL = out.rdsURL || catalogUrl;
      }
      out.searchURL = found.url;
      out.verified = true;
      out.coverageStatus = 'verified';
      out.entityType = 'tax_collector';
      out.vendor = detectVendor(found.url) || out.vendor || '';
      out.probeStatus = 'collector_search';
      out.probeReason = found.reason;
      out.probeTitle = (found.title || '').slice(0, 160);
      out.howFound = `Live hunt ${TODAY}: ${found.source} → ${found.url} (${found.reason}, HTTP ${found.status}). Catalog seed was not the collector search.`;
      if (found.fields && found.fields.length) {
        out.layout = { search_by: [...new Set(found.fields.map((f) => f.role))], fields: found.fields };
      }
      upgrades.push({ key, from: catalogUrl, to: found.url, reason: found.reason });
      return out;
    }

    const verdict = catalogHit ? catalogHit.verdict : isRealHttpUrl(catalogUrl) ? row.probeStatus : 'empty';
    out.probeStatus = verdict || 'empty';
    out.probeReason = catalogHit ? catalogHit.reason : isRealHttpUrl(catalogUrl) ? row.probeReason : 'no_http_url';
    if (catalogHit && catalogHit.title) out.probeTitle = catalogHit.title.slice(0, 160);
    if (catalogHit && Array.isArray(catalogHit.fields) && catalogHit.fields.length) {
      out.layout = { search_by: [...new Set(catalogHit.fields.map((f) => f.role))], fields: catalogHit.fields };
    }
    if (verdict === 'collector_search') {
      out.verified = true;
      out.coverageStatus = 'verified';
    } else {
      out.verified = false;
      out.coverageStatus = 'needs_correction';
    }
    return out;
  });

  const existing = new Set(nextRows.map((r) => `${r.state}:${compact(r.county)}`));
  for (const row of census.filter((c) => c.state === 'FL')) {
    const k = `FL:${compact(row.county)}`;
    if (existing.has(k)) continue;
    const found = byCounty.get(k);
    if (!found || !shouldLock(found.verdict)) continue;
    added.push({ county: row.county, url: found.url });
    nextRows.push({
      state: 'FL',
      county: row.county,
      key: `FL-${String(row.county).replace(/\s+/g, '')}`,
      entityType: 'tax_collector',
      entity: `${row.county} County FL Tax Collector`,
      entityNote: 'Live hunt: county-taxes.com public search/pay portal (same vendor Alachua/Brevard official collector pages label Search or Pay Online).',
      vendor: 'county_taxes',
      searchURL: found.url,
      verified: true,
      coverageStatus: 'verified',
      importSource: 'live_hunt_2026-09-29',
      lastChecked: TODAY,
      lastProbed: TODAY,
      probeStatus: 'collector_search',
      probeReason: found.reason,
      probeTitle: (found.title || '').slice(0, 160),
      howFound: `Live hunt ${TODAY}: ${found.source} → ${found.url} (${found.reason}, HTTP ${found.status}). Missing from catalog; added only after collector portal responded.`
    });
    existing.add(k);
  }

  const byKey = {};
  const summary = {
    uniqueUrls: Object.keys(byUrl).length,
    probed: 0,
    collector_search: 0,
    assessor_search: 0,
    homepage: 0,
    dead: 0,
    unknown_live: 0,
    empty: 0,
    rows: nextRows.length,
    upgrades: upgrades.length,
    added: added.length,
    reclassified
  };
  for (const row of nextRows) {
    const key = rowKey(row);
    const url = String(row.searchURL || '').trim();
    if (!isRealHttpUrl(url)) {
      byKey[key] = { verdict: 'empty', url: '' };
      summary.empty++;
      continue;
    }
    const hit = byUrl[url];
    const verdict = row.probeStatus || (hit && hit.verdict) || 'unknown_live';
    byKey[key] = {
      verdict,
      url,
      status: hit && hit.status,
      reason: row.probeReason || (hit && hit.reason),
      title: row.probeTitle || (hit && hit.title),
      golden: lockedKeys.has(key)
    };
    summary.probed++;
    summary[verdict] = (summary[verdict] || 0) + 1;
  }

  const huntReport = {
    huntedAt: new Date().toISOString(),
    method:
      'Reclassify stored probes; live-GET Florida county-taxes.com/public (403 Cloudflare on a host that 404s for non-participants = portal exists); crawl catalog pages for vendor/pay-search links; lock only collector_search. Empty rows stay empty.',
    summary,
    upgrades: upgrades.slice(0, 400),
    added,
    discovered: discovered.slice(0, 800)
  };
  saveJson(HUNT_PATH, huntReport);
  saveJson(PROBE_PATH, {
    probedAt: new Date().toISOString(),
    method:
      'Live GET with desktop Chrome UA. Collector search vs assessor vs homepage vs dead. Cloudflare 403 on known collector hosts is collector_search, not a dead lock.',
    summary,
    byUrl,
    byKey
  });
  console.log('Hunt summary', summary);
  console.log(`Upgrades ${upgrades.length}; added missing FL ${added.length}`);

  if (!APPLY) {
    console.log('Dry catalog apply skipped (pass --apply to write counties.json).');
    return;
  }
  saveJson(COUNTIES_PATH, nextRows);
  console.log(`Applied hunt to ${nextRows.length} rows → ${COUNTIES_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
