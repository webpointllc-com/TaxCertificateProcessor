#!/usr/bin/env node
/**
 * Merge validated jurisdiction URLs from optional local WebpointSearch master
 * files into data/counties.json. Applies data/golden_overrides.json LAST.
 *
 * Local Desktop/Passport sources are optional — when missing, this still
 * reapplies golden locks (Chippewa LandNav, San Diego, Denver).
 *
 * Usage:
 *   node scripts/import-master-counties.js [--dry-run]
 */
const fs = require('fs');
const path = require('path');
const {
  COUNTIES_PATH,
  dedupeKey,
  humanizeCounty,
  masterKey,
  readNdjson,
  loadGoldenOverrides,
  applyGoldenOverride,
  isCountiesJsonLocked,
  detectVendor,
  inferEntityType,
  isBadAssessorPick,
  loadCountiesFile,
  REPO_ROOT
} = require('./import-lib');

const DRY_RUN = process.argv.includes('--dry-run');
const reportIdx = process.argv.indexOf('--report');
const REPORT_PATH =
  reportIdx >= 0 && process.argv[reportIdx + 1]
    ? path.resolve(process.argv[reportIdx + 1])
    : path.join(REPO_ROOT, 'data', 'bad-assessor-picks.json');

const SOURCES = {
  masterNdjson: process.env.MASTER_VALIDATED_NDJSON ||
    path.join(
      process.env.HOME || '',
      'Desktop/everything/1. Apps & Web Builds/WebpointSearch/kata_deploy/data/MASTER_VALIDATED_STATIC_URLS.ndjson'
    ),
  seedJsonl: process.env.SPUL_SEED_JSONL ||
    path.join(
      process.env.HOME || '',
      'Desktop/everything/1. Apps & Web Builds/WebpointSearch/kata_deploy/SPUL_SEED_VALIDATED_URLS.jsonl'
    )
};

function rowToCounty(row, sourceTag) {
  const url = (row.url || row.serve_url || '').trim();
  if (!url || !/^https?:\/\//i.test(url)) return null;
  const state = (row.state || '').toUpperCase().trim();
  const county = humanizeCounty(row.county || '');
  if (!state || !county) return null;

  const label = row.label || row.query || '';
  const notes = row.resolution_notes || '';
  const verified =
    row.validated === true ||
    row.validated === 'true' ||
    row.verdict === 'confident';

  return {
    state,
    county,
    key: row.key || masterKey(state, county),
    entityType: inferEntityType(label, notes, url),
    entity: label || `${county}, ${state} property tax search`,
    entityNote: notes ? String(notes).slice(0, 240) : '',
    vendor: detectVendor(url),
    searchURL: url,
    verified: Boolean(verified),
    lastChecked: new Date().toISOString().slice(0, 10),
    importSource: sourceTag
  };
}

function main() {
  if (isCountiesJsonLocked()) {
    console.error('SKIP: data/counties.json is locked by another lane (.agent-coord/LOCK).');
    process.exit(3);
  }

  const stats = {
    imported: 0,
    updated: 0,
    alreadyPresent: 0,
    goldenApplied: 0,
    invalid: 0,
    masterRows: 0,
    seedRows: 0,
    badAssessor: 0,
    missingSources: 0
  };

  const badAssessorPicks = [];
  const goldenMap = loadGoldenOverrides();
  const byKey = new Map();

  for (const c of loadCountiesFile()) {
    byKey.set(dedupeKey(c.state, c.county), { ...c });
  }

  const incoming = [];
  if (fs.existsSync(SOURCES.masterNdjson)) {
    const masterRows = readNdjson(SOURCES.masterNdjson);
    stats.masterRows = masterRows.length;
    for (const row of masterRows) {
      const county = rowToCounty(row, 'MASTER_VALIDATED');
      if (!county) {
        stats.invalid++;
        continue;
      }
      if (isBadAssessorPick(county.searchURL)) {
        stats.badAssessor++;
        badAssessorPicks.push({
          key: row.key || masterKey(county.state, row.county),
          state: county.state,
          county: county.county,
          searchURL: county.searchURL,
          label: row.label || '',
          reason: 'assessor_or_arcc_without_search_path'
        });
      }
      incoming.push(county);
    }
  } else {
    stats.missingSources++;
    console.log('No MASTER_VALIDATED ndjson (Passport / Desktop path not mounted).');
  }

  if (fs.existsSync(SOURCES.seedJsonl)) {
    const seedRows = readNdjson(SOURCES.seedJsonl);
    stats.seedRows = seedRows.length;
    for (const row of seedRows) {
      const county = rowToCounty(row, 'SPUL_SEED');
      if (!county) continue;
      const dk = dedupeKey(county.state, county.county);
      if (!incoming.some((c) => dedupeKey(c.state, c.county) === dk)) {
        incoming.push(county);
      }
    }
  }

  for (const county of incoming) {
    const mk = county.key || masterKey(county.state, county.county);
    const dk = dedupeKey(county.state, county.county);
    const prev = byKey.get(dk);

    if (prev) {
      const sameUrl = prev.searchURL === county.searchURL;
      if (sameUrl && prev.verified === county.verified && !goldenMap.has(mk)) {
        stats.alreadyPresent++;
        continue;
      }
    }

    byKey.set(dk, { ...(prev || {}), ...county });
    if (prev) stats.updated++;
    else stats.imported++;
  }

  for (const [mk, override] of goldenMap.entries()) {
    const state = (override.state || mk.split('-')[0] || '').toUpperCase();
    const county = override.county || humanizeCounty(mk.split('-').slice(1).join('-'));
    const dk = dedupeKey(state, county);
    const prev = byKey.get(dk) || { state, county };
    byKey.set(dk, applyGoldenOverride(prev, override));
    stats.goldenApplied++;
  }

  const merged = Array.from(byKey.values()).sort((a, b) => {
    const ka = `${a.state}-${a.county}`;
    const kb = `${b.state}-${b.county}`;
    return ka.localeCompare(kb);
  });

  const json = JSON.stringify(merged, null, 2) + '\n';
  const bytes = Buffer.byteLength(json, 'utf8');

  console.log('Import summary:');
  console.log(`  master rows read:       ${stats.masterRows}`);
  console.log(`  seed rows read:         ${stats.seedRows}`);
  console.log(`  new rows:               ${stats.imported}`);
  console.log(`  updated rows:           ${stats.updated}`);
  console.log(`  already present:        ${stats.alreadyPresent}`);
  console.log(`  golden overrides:       ${stats.goldenApplied}`);
  console.log(`  invalid skipped:        ${stats.invalid}`);
  console.log(`  bad assessor picks:     ${stats.badAssessor}`);
  console.log(`  missing local sources:  ${stats.missingSources}`);
  console.log(`  total in counties.json: ${merged.length}`);
  console.log(`  output size:            ${(bytes / 1024 / 1024).toFixed(2)} MB`);

  if (!DRY_RUN && badAssessorPicks.length) {
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(REPORT_PATH, JSON.stringify(badAssessorPicks, null, 2) + '\n');
    console.log(`  wrote report:           ${REPORT_PATH}`);
  }

  if (DRY_RUN) {
    console.log('(dry-run — no file written)');
    return;
  }

  fs.writeFileSync(COUNTIES_PATH, json);
  console.log(`Wrote ${COUNTIES_PATH}`);
}

main();
