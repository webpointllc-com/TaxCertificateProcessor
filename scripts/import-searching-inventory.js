#!/usr/bin/env node
/**
 * Merge the live S-PUL Searching inventory into counties.json.
 *
 * Source: data/spul_searching_inventory.json (searchpages-best jurisdictions)
 * plus data/spul_searching_operator_locks.json (Squarespace Searching screenshot).
 *
 * Golden overrides always win. Existing collector_search rows are not replaced.
 * Playbook counties with empty search_url stay unlocked until confirmed.
 *
 * Usage: node scripts/import-searching-inventory.js [--dry-run]
 */
'use strict';

const fs = require('fs');
const path = require('path');
const {
  COUNTIES_PATH,
  GOLDEN_PATH,
  compactName,
  dedupeKey,
  humanizeCounty,
  loadGoldenOverrides,
  applyGoldenOverride,
  detectVendor,
  isRealHttpUrl,
  loadCountiesFile
} = require('./import-lib');
const { isGoogleFallbackUrl, isGenericCountyHomepage } = require('../src/services/spulTruth');

const DRY_RUN = process.argv.includes('--dry-run');
const REPO_ROOT = path.join(__dirname, '..');
const INVENTORY_PATH = path.join(REPO_ROOT, 'data', 'spul_searching_inventory.json');
const OPERATOR_LOCKS_PATH = path.join(REPO_ROOT, 'data', 'spul_searching_operator_locks.json');

const SKIP_EMPTY_PLAYBOOK = new Set(['OH-Hamilton', 'CT-HartfordCity', 'IL-Sangamon']);

const ASSESSOR_HOST =
  /qpublic\.net|\bqpublic\b|beacon\.|schneidercorp|countygovservices|capturecama|\/assessor|assessor\.|arcc\.|propertyappraiser|\/appraisal|\/cad\b|\bcad\.org\b|pcpao\.|hcpafl\.|scpafl\.|appraisal.?district|actdatascout/i;

const COLLECTOR_HOST =
  /ecclix\.com|properlytaxes\.com|snstaxpayments\.com|csiky\.com|celky\.com|bossiersheriff|landnav\.com|spatialest\.com|sdttc\.com|webpayments|taxbill\.|myharriscountytax|catalis|county-taxes|eproptax|qpaybill|g-uts\.com|eztaxonline|stpsopayments|pay-jeffersonky-sheriff|fayettesheriff|jessaminesheriff|hopkinscountysheriff|municipalonlinepayments|jpso\.com|ebrso\.org|tpso\.net|ptax1\.csiky|govern\.com|pontemsoftware|americanlandrecords|compuaid|invoicecloud|govtechtaxpro|texaspayments|mytaxbill|county-taxes|devnetwedge|altags\.com|propertytax\.ark|nhtaxkiosk|iowataxandtags|accessmygov|municipaltaxpayments|kenner\.la\.us|parishapso|lpso\.org|nola\.gov\/services|taxlookup|deltacomputersystems|opaldata|bsaonline|signatureinfo|trueautomation|mptsweb|edmundsassoc|edmundsgovtech|wps\.sdttc|setsearchparameters/i;

function classifySearchingUrl(url) {
  if (!isRealHttpUrl(url) || isGoogleFallbackUrl(url)) return 'empty';
  if (/\{[a-z0-9]+\}/i.test(url) || /\{0\}/.test(url)) return 'template';
  if (ASSESSOR_HOST.test(url) && !COLLECTOR_HOST.test(url)) return 'assessor_search';
  if (COLLECTOR_HOST.test(url)) return 'collector_search';
  if (isGenericCountyHomepage(url, { vendor: detectVendor(url) })) return 'homepage';
  try {
    const u = new URL(url);
    const hay = `${u.hostname}${u.pathname}${u.search}`;
    if (/tax|pay|sheriff|treasur|parcel|property|clerk|bill/i.test(hay) && (u.pathname || '/') !== '/') {
      return 'collector_search';
    }
  } catch {
    return 'homepage';
  }
  return 'homepage';
}

function mergeReject(prev, incoming) {
  const out = [];
  const seen = new Set();
  for (const u of [...(prev || []), ...(incoming || [])]) {
    const s = String(u || '').trim();
    if (!s) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

function main() {
  const inventory = JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8'));
  const operator = JSON.parse(fs.readFileSync(OPERATOR_LOCKS_PATH, 'utf8'));
  const goldenMap = loadGoldenOverrides();
  const byKey = new Map();

  for (const c of loadCountiesFile()) {
    byKey.set(dedupeKey(c.state, c.county), { ...c });
  }

  const stats = {
    inventory: (inventory.rows || []).length,
    upgraded: 0,
    added: 0,
    skippedGolden: 0,
    skippedCollector: 0,
    skippedHomepage: 0,
    skippedDead: 0,
    skippedPlaybook: 0,
    skippedTemplate: 0,
    operatorLocks: 0,
    goldenApplied: 0
  };

  for (const row of inventory.rows || []) {
    const url = (row.url || '').trim();
    const state = (row.state || '').toUpperCase();
    const county = row.county || '';
    if (!state || !county) continue;
    if (!row.active || row.validate_bucket === 'dead') {
      stats.skippedDead++;
      continue;
    }
    const kind = classifySearchingUrl(url);
    if (kind === 'empty' || kind === 'template') {
      stats.skippedTemplate++;
      continue;
    }
    if (kind === 'homepage') {
      stats.skippedHomepage++;
      continue;
    }

    const dk = dedupeKey(state, county);
    const mk = row.key || `${state}-${String(county).replace(/\s+/g, '')}`;
    if (SKIP_EMPTY_PLAYBOOK.has(mk)) {
      stats.skippedPlaybook++;
      continue;
    }

    let golden = goldenMap.get(mk);
    if (!golden) {
      for (const [, val] of goldenMap) {
        if (val.state === state && compactName(val.county) === compactName(county)) {
          golden = val;
          break;
        }
      }
    }
    if (golden) {
      stats.skippedGolden++;
      continue;
    }

    const prev = byKey.get(dk);
    if (prev && prev.probeStatus === 'collector_search' && isRealHttpUrl(prev.searchURL)) {
      stats.skippedCollector++;
      continue;
    }

    if (kind === 'assessor_search') {
      if (prev && prev.probeStatus === 'assessor_search' && prev.searchURL === url) continue;
      const next = {
        ...(prev || {
          state,
          county: humanizeCounty(county),
          key: mk
        }),
        searchURL: url,
        vendor: detectVendor(url) || prev?.vendor || '',
        entityType: 'appraisal_district',
        verified: false,
        coverageStatus: 'needs_correction',
        importSource: 'spul_searching',
        lastChecked: '2026-09-29',
        probeStatus: 'assessor_search',
        probeReason: 'searching_inventory_assessor',
        howFound: 'S-PUL Searching inventory (searchpages-best jurisdictions).'
      };
      if (prev && prev.searchURL && prev.searchURL !== url) {
        next.rejectURLs = mergeReject(prev.rejectURLs, [prev.searchURL]);
      }
      byKey.set(dk, next);
      if (prev) stats.upgraded++;
      else stats.added++;
      continue;
    }

    const next = {
      ...(prev || {
        state,
        county: humanizeCounty(county),
        key: mk
      }),
      searchURL: url,
      vendor: detectVendor(url) || '',
      entityType: 'tax_collector',
      verified: true,
      coverageStatus: 'verified',
      importSource: 'spul_searching',
      lastChecked: '2026-09-29',
      probeStatus: 'collector_search',
      probeReason: 'searching_inventory',
      howFound: 'S-PUL Searching inventory (searchpages-best jurisdictions + Squarespace Searching).'
    };
    if (!next.entity || /county site|WPT production-log/i.test(next.entity || '')) {
      next.entity = `${county}, ${state} — Searching collector portal`;
    }
    if (prev && prev.searchURL && prev.searchURL !== url) {
      next.rejectURLs = mergeReject(prev.rejectURLs, [prev.searchURL]);
      next.entityNote = `S-PUL Searching inventory replaced homepage/dead catalog URL ${prev.searchURL} with the live collector portal.`;
    } else {
      next.entityNote =
        next.entityNote || 'S-PUL Searching inventory — locked collector/search URL from the live Searching registry.';
    }
    byKey.set(dk, next);
    if (prev) stats.upgraded++;
    else stats.added++;
  }

  const goldenRaw = JSON.parse(fs.readFileSync(GOLDEN_PATH, 'utf8'));
  const goldenObj =
    goldenRaw && typeof goldenRaw === 'object' && !Array.isArray(goldenRaw) && goldenRaw.overrides
      ? goldenRaw.overrides
      : goldenRaw;

  for (const [key, lock] of Object.entries(operator.locks || {})) {
    goldenObj[key] = { ...lock };
    goldenMap.set(key, lock);
    stats.operatorLocks++;
  }

  for (const [mk, override] of goldenMap.entries()) {
    const state = (override.state || mk.split('-')[0] || '').toUpperCase();
    const county = override.county || humanizeCounty(mk.split('-').slice(1).join('-'));
    const dk = dedupeKey(state, county);
    const prev = byKey.get(dk) || { state, county, key: mk };
    byKey.set(dk, applyGoldenOverride(prev, override));
    stats.goldenApplied++;
  }

  const merged = Array.from(byKey.values()).sort((a, b) => {
    const ka = `${a.state}-${a.county}`;
    const kb = `${b.state}-${b.county}`;
    return ka.localeCompare(kb);
  });

  console.log('Searching import:');
  console.log(`  inventory rows:     ${stats.inventory}`);
  console.log(`  upgraded:           ${stats.upgraded}`);
  console.log(`  added:              ${stats.added}`);
  console.log(`  skip golden:        ${stats.skippedGolden}`);
  console.log(`  skip collector:     ${stats.skippedCollector}`);
  console.log(`  skip homepage:      ${stats.skippedHomepage}`);
  console.log(`  skip dead:          ${stats.skippedDead}`);
  console.log(`  skip playbook:      ${stats.skippedPlaybook}`);
  console.log(`  skip template:      ${stats.skippedTemplate}`);
  console.log(`  operator locks:     ${stats.operatorLocks}`);
  console.log(`  golden applied:     ${stats.goldenApplied}`);
  console.log(`  total counties:     ${merged.length}`);

  if (DRY_RUN) {
    console.log('(dry-run — no file written)');
    return;
  }

  fs.writeFileSync(GOLDEN_PATH, JSON.stringify(goldenObj, null, 2) + '\n');
  fs.writeFileSync(COUNTIES_PATH, JSON.stringify(merged, null, 2) + '\n');
  console.log(`Wrote ${GOLDEN_PATH}`);
  console.log(`Wrote ${COUNTIES_PATH}`);
}

main();
