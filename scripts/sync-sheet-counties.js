#!/usr/bin/env node
'use strict';

/**
 * Fetch the WPT Production Log Google Sheet, canonicalize jurisdictions,
 * merge missing rows into data/counties.json, and apply golden_overrides last.
 *
 * Never invent collector URLs. Missing sheet counties are stored as
 * coverageStatus: needs_correction with an empty searchURL.
 *
 * Usage:
 *   node scripts/sync-sheet-counties.js [--dry-run] [--offline]
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  COUNTIES_PATH,
  isCountiesJsonLocked,
  loadCountiesFile,
  loadGoldenOverrides,
  applyGoldenOverride,
  dedupeKey,
  masterKey,
  compactName,
  isRealHttpUrl
} = require('./import-lib');
const {
  loadSheetHits,
  buildCatalog,
  writeCatalogArtifacts,
  stubCountyFromCatalog
} = require('./sheet-counties-lib');

const DRY_RUN = process.argv.includes('--dry-run');
const OFFLINE = process.argv.includes('--offline');

function sortCounties(list) {
  return list.sort((a, b) => `${a.state}-${a.county}`.localeCompare(`${b.state}-${b.county}`));
}

async function main() {
  if (isCountiesJsonLocked()) {
    console.error('SKIP: data/counties.json is locked by another lane (.agent-coord/LOCK).');
    process.exit(3);
  }

  const cacheDir = path.join(os.tmpdir(), 'sheet-tabs');
  const { hits, fetchErrors } = await loadSheetHits({ cacheDir, offline: OFFLINE });
  if (!hits.length) {
    console.error('No sheet rows parsed. Check network or --offline cache at', cacheDir);
    if (fetchErrors.length) console.error(fetchErrors);
    process.exit(2);
  }

  const existing = loadCountiesFile();
  const catalog = buildCatalog(hits, existing);
  const artifacts = DRY_RUN ? { catalogPath: '(dry-run)', aliasesPath: '(dry-run)' } : writeCatalogArtifacts(catalog);

  const byKey = new Map();
  for (const c of existing) {
    byKey.set(dedupeKey(c.state, c.county), { ...c });
  }

  const stats = {
    fileHits: hits.length,
    uniqueSheet: catalog.jurisdictions.length,
    alreadyPresent: 0,
    taggedExisting: 0,
    addedStubs: 0,
    goldenApplied: 0,
    fetchErrors: fetchErrors.length
  };

  for (const j of catalog.jurisdictions) {
    const dk = dedupeKey(j.state, j.county);
    const prev = byKey.get(dk);
    if (prev) {
      stats.alreadyPresent++;
      const tagged = {
        ...prev,
        wptProductionLog: true,
        wptFileHits: j.fileHits,
        key: prev.key || j.key
      };
      if (isRealHttpUrl(prev.searchURL)) {
        tagged.coverageStatus = prev.verified ? 'verified' : 'needs_correction';
      } else {
        tagged.coverageStatus = 'needs_correction';
      }
      byKey.set(dk, tagged);
      stats.taggedExisting++;
      continue;
    }
    byKey.set(dk, stubCountyFromCatalog(j));
    stats.addedStubs++;
  }

  const goldenMap = loadGoldenOverrides();
  for (const [mk, override] of goldenMap.entries()) {
    const state = (override.state || mk.split('-')[0] || '').toUpperCase();
    const county = override.county || mk.split('-').slice(1).join('-');
    const dk = dedupeKey(state, county);
    const prev = byKey.get(dk) || { state, county, key: masterKey(state, county) };
    byKey.set(dk, applyGoldenOverride(prev, override));
    stats.goldenApplied++;
  }

  const merged = sortCounties(Array.from(byKey.values()));
  const json = JSON.stringify(merged, null, 2) + '\n';

  console.log('WPT Production Log sync:');
  console.log(`  sheet file hits:          ${stats.fileHits}`);
  console.log(`  unique jurisdictions:     ${stats.uniqueSheet}`);
  console.log(`  already in counties.json: ${catalog.counts.alreadyInCountiesJson}`);
  console.log(`  added stubs (no URL):     ${stats.addedStubs}`);
  console.log(`  tagged existing rows:     ${stats.taggedExisting}`);
  console.log(`  golden overrides:         ${stats.goldenApplied}`);
  console.log(`  fetch errors:             ${stats.fetchErrors}`);
  console.log(`  total counties.json:      ${merged.length}`);
  console.log(`  catalog:                  ${artifacts.catalogPath}`);
  console.log(`  aliases:                  ${artifacts.aliasesPath}`);
  if (fetchErrors.length) console.log('  fetch:', fetchErrors);

  const chippewa = merged.find((c) => c.state === 'WI' && compactName(c.county) === 'chippewa');
  if (chippewa) {
    console.log(`  Chippewa WI URL:          ${chippewa.searchURL}`);
  }

  if (DRY_RUN) {
    console.log('(dry-run — no counties.json written)');
    return;
  }

  fs.writeFileSync(COUNTIES_PATH, json);
  console.log(`Wrote ${COUNTIES_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
