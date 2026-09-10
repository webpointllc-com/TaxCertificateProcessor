'use strict';

/**
 * Apply curated URL fixes + reclassify health flags after cloud crawl.
 * DeepShake Mac dork is preferred; this is the cloud substitute.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const HEALTH = path.join(DATA, 'health-full.json');

const CURATED = {
  // Alabama google placeholders → revenue / search portals
  'AL-Chambers': {
    url: 'https://www.ingproperty.com/Chambers_Revenue/property.aspx',
    source: 'Search',
    note: 'replaced google placeholder with Chambers Revenue search',
  },
  'AL-Coffee': {
    url: 'https://www.coffeecountyrevenue.com/property.html',
    source: 'Base',
    note: 'replaced google placeholder with Coffee County Revenue',
  },
  'AL-Russell': {
    url: 'https://russell.capturecama.com/propsearch',
    source: 'Search',
    note: 'replaced google placeholder with Russell CaptureCAMA propsearch',
  },
  'VA-LynchburgCity': {
    url: 'https://webapps.lynchburgva.gov/citylink',
    source: 'Search',
    note: 'empty URL → Lynchburg CityLink tax portal',
  },
  // Arkansas — encode spaces; Benton collector site
  'AR-Benton': {
    url: 'https://bentoncountyar.gov/collector/',
    source: 'Base',
    note: 'arcountydata blocked/fragile → Benton County Collector',
  },
  'AR-LittleRiver': {
    url: 'https://www.arcountydata.com/propsearch.asp?county=Little%20River&s=T',
    source: 'Search',
    note: 'URL-encoded county name (was InvalidURL)',
  },
  // Florida dead paths
  'FL-MiamiDade': {
    url: 'https://www.miamidade.gov/taxcollector/',
    source: 'Base',
    note: 'old online-services.asp 404 → tax collector home',
  },
  'FL-Orange': {
    url: 'https://www.octaxcol.com/taxes/',
    source: 'Search',
    note: 'old Search.aspx 404 → /taxes/',
  },
  // Marshall was broken_fixed to bad cgi path
  'AL-Marshall': {
    url: 'https://marshall.capturecama.com/propsearch',
    source: 'Search',
    note: 'deltacomputersystems cgi-lra2 404 → Marshall CaptureCAMA propsearch',
  },
};

function mptsPublicSearch(url) {
  // https://common3.mptsweb.com/MBC/api/search/calaveras/0000-CURR/feeparcel/{parcel}
  const m = String(url || '').match(
    /^(https?:\/\/common[123]\.mptsweb\.com)\/MBC\/api\/search\/([a-z0-9]+)\/[^/]+\/feeparcel\/\{parcel\}/i
  );
  if (!m) return null;
  return `${m[1]}/MBC/${m[2].toLowerCase()}/tax/search`;
}

function fetchStatus(url) {
  return new Promise((resolve) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      resolve({ status: null, error: 'InvalidURL' });
      return;
    }
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'GET',
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) S-PUL-url-fix/1.0',
          Accept: 'text/html,*/*',
        },
        rejectUnauthorized: false,
      },
      (res) => {
        res.resume();
        resolve({ status: res.statusCode || null, error: null });
      }
    );
    req.on('timeout', () => {
      req.destroy();
      resolve({ status: null, error: 'TimeoutError' });
    });
    req.on('error', (err) => resolve({ status: null, error: err.name || 'Error' }));
    req.end();
  });
}

function classifyActive(healthRow) {
  if (!healthRow) return true; // unchecked → keep searchable
  if (healthRow.ok) return true;
  const s = healthRow.status;
  // Bot / method / rate-limit — host is alive
  if ([401, 403, 405, 429].includes(s)) return true;
  // Transient gateway — don't nuke from index
  if ([502, 503].includes(s)) return true;
  // Hard dead
  if (s === 404 || healthRow.error === 'InvalidURL') return false;
  // Timeouts / TLS — leave active but lower confidence later
  if (healthRow.error === 'TimeoutError' || healthRow.error === 'Error') return true;
  return Boolean(healthRow.ok);
}

async function main() {
  const index = JSON.parse(fs.readFileSync(path.join(DATA, 'search-index.json'), 'utf8'));
  const health = fs.existsSync(HEALTH) ? JSON.parse(fs.readFileSync(HEALTH, 'utf8')) : [];
  const healthByKey = new Map(health.map((h) => [h.key, h]));

  const fixes = [];
  for (const item of index.items) {
    const before = item.url;

    // 1) curated
    if (CURATED[item.key]) {
      const c = CURATED[item.key];
      item.url = c.url;
      if (c.source) item.source = c.source;
      item.quality = 'broken_fixed';
      item.flags = Array.isArray(item.flags) ? item.flags : [];
      if (!item.flags.includes('url_fixed_cloud')) item.flags.push('url_fixed_cloud');
      fixes.push({ key: item.key, from: before, to: item.url, how: c.note });
      continue;
    }

    // 2) MPTS API template → public tax search
    const mpts = mptsPublicSearch(item.url);
    if (mpts) {
      item.url = mpts;
      item.source = 'Search';
      item.quality = 'broken_fixed';
      item.flags = Array.isArray(item.flags) ? item.flags : [];
      if (!item.flags.includes('mpts_api_to_search')) item.flags.push('mpts_api_to_search');
      fixes.push({ key: item.key, from: before, to: item.url, how: 'MPTS api template → /tax/search' });
      continue;
    }

    // 3) encode spaces in query
    if (item.url && / /.test(item.url)) {
      try {
        const u = new URL(item.url);
        u.search = u.search.replace(/ /g, '%20');
        item.url = u.toString();
        if (item.url !== before) {
          item.quality = 'broken_fixed';
          fixes.push({ key: item.key, from: before, to: item.url, how: 'encode spaces' });
        }
      } catch {
        /* ignore */
      }
    }
  }

  // Verify curated + mpts fixes quickly (concurrency 8)
  const toVerify = fixes.map((f) => f.key);
  const byKey = new Map(index.items.map((i) => [i.key, i]));
  console.log(`Verifying ${toVerify.length} fixed URLs…`);
  let verifiedOk = 0;
  for (let i = 0; i < toVerify.length; i += 8) {
    const chunk = toVerify.slice(i, i + 8);
    const results = await Promise.all(
      chunk.map(async (key) => {
        const item = byKey.get(key);
        const r = await fetchStatus(item.url);
        const softOk =
          (r.status && r.status >= 200 && r.status < 400) ||
          [401, 403, 405, 429, 502, 503].includes(r.status);
        return { key, softOk, ...r };
      })
    );
    for (const r of results) {
      const item = byKey.get(r.key);
      item.active = r.softOk;
      if (r.softOk) verifiedOk++;
      const hx = healthByKey.get(r.key) || {};
      healthByKey.set(r.key, {
        ...hx,
        key: r.key,
        url: item.url,
        status: r.status,
        error: r.error,
        ok: r.softOk,
        fixed: true,
      });
    }
  }

  // Reclassify all active flags from health (post-fix)
  let activeN = 0;
  let inactiveN = 0;
  for (const item of index.items) {
    if (!item.url || /google\.com/i.test(item.url)) {
      item.active = false;
      inactiveN++;
      continue;
    }
    item.active = classifyActive(healthByKey.get(item.key));
    if (item.active) activeN++;
    else inactiveN++;
  }

  index.meta = index.meta || {};
  index.meta.urlFixes = {
    generatedAt: new Date().toISOString(),
    fixCount: fixes.length,
    verifiedOk,
    activeAfter: activeN,
    inactiveAfter: inactiveN,
    deepShake: 'not_run',
    note: 'Cloud substitute for DeepShake. MPTS templates rewritten; placeholders replaced; health reclassified (403/429/503 = alive).',
  };
  index.meta.healthFull = {
    ...(index.meta.healthFull || {}),
    reclassifiedAt: index.meta.urlFixes.generatedAt,
    activeAfterReclass: activeN,
    inactiveAfterReclass: inactiveN,
  };

  fs.writeFileSync(path.join(DATA, 'search-index.json'), JSON.stringify(index));
  fs.writeFileSync(path.join(DATA, 'url-fixes.json'), JSON.stringify({ meta: index.meta.urlFixes, fixes }, null, 2));

  // Sync jurisdictions*
  for (const name of ['jurisdictions.json', 'jurisdictions.min.json']) {
    const p = path.join(DATA, name);
    if (!fs.existsSync(p)) continue;
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    const list = j.jurisdictions || [];
    const map = new Map(index.items.map((i) => [i.key, i]));
    for (const row of list) {
      const i = map.get(row.key);
      if (!i) continue;
      row.url = i.url;
      row.source = i.source;
      row.active = i.active;
      row.quality = i.quality;
      if (i.flags) row.flags = i.flags;
    }
    j.meta = j.meta || {};
    j.meta.urlFixes = index.meta.urlFixes;
    j.meta.healthFull = index.meta.healthFull;
    fs.writeFileSync(p, JSON.stringify(j));
  }

  const md = [
    '# URL Fixes (cloud substitute for DeepShake)',
    '',
    `**Generated:** ${index.meta.urlFixes.generatedAt}`,
    `**DeepShake:** not run on this cloud VM`,
    '',
    `| Metric | Count |`,
    `|---|---:|`,
    `| Fixes applied | ${fixes.length} |`,
    `| Soft-verified OK | ${verifiedOk} |`,
    `| Active after reclass | ${activeN} |`,
    `| Inactive after reclass | ${inactiveN} |`,
    '',
    '## Sample wins',
    '',
    ...fixes.slice(0, 30).map((f) => `- \`${f.key}\`: ${f.how} → \`${f.to}\``),
    '',
    '## Classification rules',
    '',
    '- HTTP 200–399 → active',
    '- 401/403/405/429/502/503 → active (host alive; bot/rate-limit)',
    '- 404 / InvalidURL / google.com → inactive until replaced',
    '- Timeout / TLS Error → keep active (false-negative risk)',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(ROOT, '..', 'docs', 'prototype-best-practice', 'URL_FIXES.md'), md);

  console.log(JSON.stringify(index.meta.urlFixes, null, 2));
  console.log('Sample:', fixes.slice(0, 12));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
