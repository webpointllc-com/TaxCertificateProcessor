#!/usr/bin/env node
/**
 * Apply the last validation_hits.json onto counties.json.
 * Golden overrides and finale playbook-empty counties never change URL.
 * Dead HTTP on an already-locked collector does not unlock it — it queues DeepShake.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { COUNTIES_PATH, loadGoldenOverrides } = require('./import-lib');
const { compactJurisdictionName } = require('../src/services/spulTruth');
const siteValidator = require('../src/services/siteValidator');
const { invalidateCountiesCache } = require('../src/services/urlFinder');

const ROOT = path.join(__dirname, '..');
const DEFAULT_HITS = path.join(ROOT, 'data', 'validation_hits.json');
const DEFAULT_LOG = path.join(ROOT, 'data', 'validation_apply.json');
const TODAY = new Date().toISOString().slice(0, 10);

const argv = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
  })
);
const DRY = Boolean(argv['dry-run']);
const UPGRADES_ONLY = Boolean(argv['upgrades-only']);
const HITS_PATH = argv.hits
  ? path.resolve(ROOT, argv.hits)
  : DEFAULT_HITS;
const APPLY_LOG = argv.log ? path.resolve(ROOT, argv.log) : DEFAULT_LOG;

function compact(s) {
  return compactJurisdictionName(s);
}

function goldenKeys(map) {
  const keys = new Set();
  for (const [k, val] of map.entries()) {
    keys.add(k);
    if (val.state && val.county) {
      keys.add(`${val.state}-${String(val.county).replace(/\s+/g, '')}`);
      keys.add(`${val.state}-${val.county}`);
    }
  }
  return keys;
}

function rowMatchKey(row) {
  return [
    row.key,
    `${row.state}-${String(row.county || '').replace(/\s+/g, '')}`,
    compact(row.state) + compact(row.county)
  ];
}

function indexCounties(counties) {
  const by = new Map();
  for (const row of counties) {
    for (const k of rowMatchKey(row)) {
      if (k && !by.has(k)) by.set(k, row);
    }
  }
  return by;
}

function main() {
  if (!fs.existsSync(HITS_PATH)) {
    console.error('missing', HITS_PATH, '— run npm run validate:extractors first');
    process.exit(1);
  }
  const bundle = JSON.parse(fs.readFileSync(HITS_PATH, 'utf8'));
  const hits = bundle.hits || [];
  const counties = JSON.parse(fs.readFileSync(COUNTIES_PATH, 'utf8'));
  const lockedGolden = goldenKeys(loadGoldenOverrides());
  const by = indexCounties(counties);
  const stats = {
    generatedAt: new Date().toISOString(),
    sourceRun: bundle.generatedAt || null,
    hits: hits.length,
    upgraded: 0,
    probed: 0,
    skippedGolden: 0,
    skippedPlaybook: 0,
    keptLocked: 0,
    queuedDeadLocked: 0
  };

  for (const hit of hits) {
    const hitKeys = Array.isArray(hit.keys) && hit.keys.length ? hit.keys : [hit.key];
    for (const key of hitKeys) {
      const row = by.get(key) || by.get(hit.key) || by.get(compact(hit.state) + compact(hit.county));
      if (!row) continue;
      const aliases = rowMatchKey(row);
      if (aliases.some((k) => lockedGolden.has(k))) {
        stats.skippedGolden += 1;
        continue;
      }
      if (siteValidator.skipPlaybookKey(row.key) || siteValidator.skipPlaybookKey(hit.key)) {
        stats.skippedPlaybook += 1;
        continue;
      }

      const wasVerified = Boolean(row.verified);
      if (UPGRADES_ONLY && hit.verdict !== 'collector_search') continue;
      row.lastProbed = TODAY;
      if (hit.title) row.probeTitle = String(hit.title).slice(0, 160);
      row.layout = {
        ...(row.layout || {}),
        search_by: hit.drFields && hit.drFields.length ? hit.drFields : (row.layout && row.layout.search_by) || [],
        lookFor: siteValidator.lookForHeaders(),
        drFields: hit.drFields || [],
        deepshake_handshake_recommended: Boolean(hit.needsDeepShake)
      };
      stats.probed += 1;

      if (hit.verdict === 'collector_search') {
        row.probeStatus = 'collector_search';
        row.probeReason = hit.reason || row.probeReason;
        if (!wasVerified) {
          row.verified = true;
          row.coverageStatus = 'verified';
          row.entityType = 'tax_collector';
          stats.upgraded += 1;
        }
        if (hit.finalUrl && /^https?:/i.test(hit.finalUrl) && row.searchURL === hit.url) {
          row.searchURL = hit.finalUrl;
        }
      } else if (wasVerified) {
        row.probeStatus = 'collector_search';
        row.probeReason = `keep_lock:${hit.verdict}:${hit.reason || hit.status || ''}`;
        row.layout.deepshake_handshake_recommended = true;
        stats.keptLocked += 1;
        if (hit.verdict === 'dead') stats.queuedDeadLocked += 1;
      } else {
        row.probeStatus = hit.verdict;
        row.probeReason = hit.reason || row.probeReason;
      }
    }
  }

  fs.writeFileSync(APPLY_LOG, JSON.stringify(stats, null, 2) + '\n');
  if (!DRY) {
    fs.writeFileSync(COUNTIES_PATH, JSON.stringify(counties, null, 2) + '\n');
    invalidateCountiesCache();
  }
  process.stdout.write(JSON.stringify({ ok: true, dry: DRY, ...stats }, null, 2) + '\n');
}

main();
