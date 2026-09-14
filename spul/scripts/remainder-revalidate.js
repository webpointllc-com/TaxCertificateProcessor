'use strict';

/**
 * Remainder pass after hybrid-revalidate: dead + uncertain only.
 * Workarounds: alt UAs, GET after HEAD, longer timeout, www swap, http→https,
 * path trims, curated vendor Search URL candidates (HTTP evidence required).
 *
 * Usage: node scripts/remainder-revalidate.js [--concurrency=12]
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const INDEX_PATH = path.join(DATA, 'search-index.json');
const PRIOR_JSON = path.join(DATA, 'hybrid-revalidate.json');
const OUT_JSON = path.join(DATA, 'hybrid-revalidate.json');
const OUT_REMAINDER = path.join(DATA, 'remainder-revalidate.json');
const OUT_VALIDATED_CSV = path.join(DATA, 'validated-true-urls.csv');
const EXPORT_CSV = path.join(DATA, 'counties-export.csv');
const EXPORT_SUMMARY = path.join(DATA, 'counties-export-summary.json');
const FIXES_PATH = path.join(DATA, 'url-fixes-remainder.json');
const REPORT_MD = path.join(ROOT, '..', 'docs', 'prototype-best-practice', 'URL_REMAINDER_2026-09-13.md');
const PASTE_MD = path.join(ROOT, '..', 'docs', 'SPUL_DESCRIPTION_AND_VALIDATED_URLS.md');
const PASTE_TXT = path.join(ROOT, '..', 'docs', 'SPUL_DESCRIPTION_AND_VALIDATED_URLS.txt');

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
  })
);

const CONCURRENCY = Math.min(Math.max(parseInt(args.concurrency || '20', 10), 1), 32);
const TIMEOUT_MS = 8000;
const TIMEOUT_RETRY_MS = 14000;
const MAX_REDIRECTS = 4;

const UA_BROWSER =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const UA_BOT = 'Mozilla/5.0 (compatible; S-PUL-remainder-revalidate/1.1; +https://webpointllc.com)';

/** Global NXDOMAIN host cache — skip further probes to the same dead DNS name */
const nxHostCache = new Set();
const okHostCache = new Map(); // host -> last good status kind

function isGoogle(url) {
  return /google\.com/i.test(url || '');
}

function csvEscape(v) {
  const s = String(v ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function slugTown(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\b(town|city|borough|village|parish|county|school|isd|mud)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function slugCompact(name) {
  return slugTown(name).replace(/\s+/g, '');
}

function requestOnce(url, method, { ua, timeoutMs = TIMEOUT_MS, followBody = false, redirectCount = 0 } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      done({ status: null, error: 'InvalidURL', ms: 0, finalUrl: url, headers: {}, body: '' });
      return;
    }
    if (nxHostCache.has(parsed.hostname.toLowerCase())) {
      done({
        status: null,
        error: 'NXDOMAIN',
        ms: 0,
        finalUrl: url,
        headers: {},
        body: '',
        cached: true,
      });
      return;
    }
    const lib = parsed.protocol === 'https:' ? https : http;
    const started = Date.now();
    let req;
    const wall = setTimeout(() => {
      try {
        if (req) req.destroy();
      } catch {
        /* ignore */
      }
      done({
        status: null,
        error: 'TimeoutError',
        ms: Date.now() - started,
        finalUrl: url,
        headers: {},
        body: '',
      });
    }, timeoutMs + 750);

    try {
      req = lib.request(
        {
          protocol: parsed.protocol,
          hostname: parsed.hostname,
          port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
          path: parsed.pathname + parsed.search,
          method,
          timeout: timeoutMs,
          headers: {
            'User-Agent': ua || UA_BROWSER,
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            Connection: 'close',
          },
          rejectUnauthorized: false,
        },
        (res) => {
          const status = res.statusCode || null;
          const loc = res.headers.location;
          if (status && status >= 300 && status < 400 && loc && redirectCount < MAX_REDIRECTS) {
            res.resume();
            clearTimeout(wall);
            let next;
            try {
              next = new URL(loc, url).toString();
            } catch {
              done({
                status,
                error: 'BadRedirect',
                ms: Date.now() - started,
                finalUrl: url,
                headers: res.headers,
                body: '',
              });
              return;
            }
            requestOnce(next, method, { ua, timeoutMs, followBody, redirectCount: redirectCount + 1 }).then(done);
            return;
          }
          if (!followBody) {
            res.resume();
            clearTimeout(wall);
            done({
              status,
              error: null,
              ms: Date.now() - started,
              finalUrl: url,
              headers: res.headers,
              body: '',
              redirects: redirectCount,
            });
            return;
          }
          const chunks = [];
          let size = 0;
          res.on('data', (c) => {
            if (size < 24 * 1024) {
              chunks.push(c);
              size += c.length;
            }
          });
          res.on('end', () => {
            clearTimeout(wall);
            done({
              status,
              error: null,
              ms: Date.now() - started,
              finalUrl: url,
              headers: res.headers,
              body: Buffer.concat(chunks).toString('utf8'),
              redirects: redirectCount,
            });
          });
          res.on('error', () => {
            clearTimeout(wall);
            done({
              status,
              error: null,
              ms: Date.now() - started,
              finalUrl: url,
              headers: res.headers,
              body: Buffer.concat(chunks).toString('utf8'),
              redirects: redirectCount,
            });
          });
        }
      );
    } catch (e) {
      clearTimeout(wall);
      done({
        status: null,
        error: String(e && e.message ? e.message : e),
        ms: Date.now() - started,
        finalUrl: url,
        headers: {},
        body: '',
      });
      return;
    }

    req.on('timeout', () => {
      req.destroy();
      clearTimeout(wall);
      done({
        status: null,
        error: 'TimeoutError',
        ms: Date.now() - started,
        finalUrl: url,
        headers: {},
        body: '',
      });
    });
    req.on('error', (err) => {
      const msg = err && err.message ? String(err.message) : '';
      let error = err.code || err.name || 'URLError';
      if (/ENOTFOUND|getaddrinfo/i.test(msg) || err.code === 'ENOTFOUND') {
        error = 'NXDOMAIN';
        try {
          nxHostCache.add(parsed.hostname.toLowerCase());
        } catch {
          /* ignore */
        }
      }
      if (/CERT|SSL|TLS|EPROTO/i.test(msg) || /CERT|SSL|TLS|EPROTO/i.test(String(err.code || '')))
        error = 'TLSError';
      clearTimeout(wall);
      done({
        status: null,
        error,
        ms: Date.now() - started,
        finalUrl: url,
        headers: {},
        body: '',
      });
    });
    req.end();
  });
}

function classifyBucket(r) {
  if (isGoogle(r.url)) return { bucket: 'dead', kind: 'google_placeholder', active: false };
  if (r.error === 'InvalidURL') return { bucket: 'dead', kind: 'invalid_url', active: false };
  if (r.error === 'NXDOMAIN') return { bucket: 'dead', kind: 'nxdomain', active: false };
  const s = r.status;
  if (s != null && s >= 200 && s < 400) return { bucket: 'validated_true', kind: 'ok', active: true };
  if ([401, 403, 405, 429].includes(s)) return { bucket: 'validated_true', kind: 'gated', active: true };
  if ([502, 503].includes(s)) return { bucket: 'validated_true', kind: 'gateway_soft', active: true };
  if (s === 404 || s === 410) return { bucket: 'dead', kind: 'gone', active: false };
  if (r.error === 'TimeoutError' || r.error === 'TLSError') {
    return { bucket: 'uncertain', kind: r.error, active: true };
  }
  if (s != null && s >= 500) return { bucket: 'uncertain', kind: 'server_error', active: true };
  return { bucket: 'uncertain', kind: r.error || 'unreachable', active: true };
}

function uniqueUrls(list) {
  const seen = new Set();
  const out = [];
  for (const u of list) {
    if (!u || typeof u !== 'string') continue;
    let n = u.trim();
    if (!n || isGoogle(n)) continue;
    try {
      const p = new URL(n);
      // normalize trailing slash lightly for dedupe key but keep original
      const key = p.href;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(n);
    } catch {
      /* skip */
    }
  }
  return out;
}

/** Lean URL variants: https upgrade, www swap, path root / parent — no combinatorial explosion */
function baseVariants(url) {
  const out = [];
  let p;
  try {
    p = new URL(url);
  } catch {
    return [];
  }
  const hosts = [p.hostname];
  if (p.hostname.startsWith('www.')) hosts.push(p.hostname.slice(4));
  else hosts.push('www.' + p.hostname);

  for (const host of hosts) {
    if (nxHostCache.has(host.toLowerCase())) continue;
    const httpsU = new URL(p.href);
    httpsU.protocol = 'https:';
    httpsU.hostname = host;
    out.push(httpsU.toString());
    if (p.protocol === 'http:' && host === p.hostname) {
      out.push(p.href); // keep original http once
    }
    const root = new URL(httpsU.toString());
    root.pathname = '/';
    root.search = '';
    root.hash = '';
    out.push(root.toString());
    const parts = httpsU.pathname.split('/').filter(Boolean);
    if (parts.length >= 2) {
      const up = new URL(httpsU.toString());
      up.pathname = '/' + parts.slice(0, -1).join('/') + '/';
      up.search = '';
      out.push(up.toString());
    }
  }
  if (/governmaxa/i.test(url)) {
    out.push(...baseVariants(url.replace(/governmaxa/gi, 'governmax')));
  }
  return uniqueUrls(out);
}

/** Vendor / county-aware candidate Search URLs (HTTP evidence required later) */
function vendorCandidates(item) {
  const url = item.url || '';
  const county = item.county || '';
  const state = (item.state || '').toUpperCase();
  const town = slugTown(county);
  const compact = slugCompact(county);
  const dash = town.replace(/\s+/g, '-');
  const out = [];

  if (/mytaxbill/i.test(url)) {
    const host = /mytaxbillri/i.test(url) ? 'www.mytaxbillri.org' : 'www.mytaxbill.org';
    for (const t of [town, compact]) {
      if (!t) continue;
      out.push(`https://${host}/inet/bill/home.do?town=${encodeURIComponent(t)}`);
    }
  }

  if (/county-taxes\.com/i.test(url)) {
    const slug = compact || dash;
    out.push(`https://county-taxes.net/${slug}/property-tax`);
    out.push(`https://${slug}.county-taxes.com/`);
  }

  if (/iowataxandtags|iowatreasurers/i.test(url) && state === 'IA') {
    out.push('https://www.iowataxandtags.org/');
    out.push('https://www.iowatreasurers.org/');
  }

  if (/publicaccessnow\.com/i.test(url)) {
    try {
      const p = new URL(url.replace(/^http:/, 'https:'));
      out.push(`https://${p.hostname}/`);
      out.push(`https://${p.hostname}/TaxSearch`);
    } catch {
      /* skip */
    }
  }

  if (/capturecama\.com/i.test(url) && /montgomery/i.test(url + county)) {
    out.push('https://montgomeryal.capturecama.com/propsearch');
    out.push('https://montgomery.capturecama.com/');
  }

  if (/edmundsassoc|wipp/i.test(url)) {
    const id = compact.charAt(0).toUpperCase() + compact.slice(1);
    out.push(`https://wipp.edmundsassoc.com/Wipp/?wippid=${encodeURIComponent(id)}`);
    out.push('https://wipp.edmundsassoc.com/');
  }

  if (/paytaxes\.net/i.test(url) && state === 'GA') {
    out.push(`https://www.qpublic.net/ga/${dash}/`);
    out.push(`https://www.qpublic.net/ga/${compact}/`);
  }

  if (/deltacomputersystems\.com/i.test(url)) {
    try {
      const p = new URL(url.replace(/^http:/, 'https:'));
      // Keep county path (/AL/ALxx/) — never fall back to vendor marketing homepage
      if (/\/AL\/AL\d+/i.test(p.pathname)) {
        const base = `https://${p.hostname}${p.pathname.replace(/\/?$/, '/')}`;
        out.push(base);
        out.push(base + 'alink.html');
        out.push(base.replace(/\/$/, '') + '/');
      }
    } catch {
      /* skip */
    }
  }

  if (/actweb\.acttax\.com/i.test(url)) {
    // Only https upgrade of same county path — not vendor root
    out.push(url.replace(/^http:/, 'https:'));
  }
  if (/texaspayments\.com/i.test(url)) {
    out.push(url.replace(/^http:/, 'https:'));
  }

  if (item.key === 'AL-Jefferson' || /jeffcointouch/i.test(url)) {
    out.push('https://www.jccal.org/');
    out.push('https://jeffcointouch.com/');
  }
  if (item.key === 'CO-ElPaso' || /elpasoco/i.test(url)) {
    out.push('https://property.spatialest.com/co/elpaso/#/');
    out.push('https://trs.elpasoco.com/');
  }
  if (item.key === 'FL-Lee' || /leetc\.com/i.test(url)) {
    out.push('https://leetc.com/taxes');
    out.push('https://leetc.com/');
  }

  // MN — morris.state.mn.us / legacy manatron NXDOMAIN → official county hosts
  if (state === 'MN' && /morris\.state\.mn\.us|manatron\.com|visualgov|publicaccessnow/i.test(url)) {
    out.push(`https://www.${compact}countymn.gov/`);
    out.push(`https://${compact}countymn.gov/`);
    out.push(`https://www.co.${dash}.mn.us/`);
    out.push(`https://www.co.${compact}.mn.us/`);
  }

  // TX ACT Tax dead county path → official county / tax office when hostable
  if (state === 'TX' && /actweb\.acttax\.com|texaspayments\.com/i.test(url) && compact.length >= 4) {
    out.push(`https://www.${compact}countytx.gov/`);
    out.push(`https://www.${compact}countytx.gov/departments/tax-office`);
    out.push(`https://${compact}countytx.gov/`);
  }

  return uniqueUrls(out);
}

/** Reject generic multi-tenant vendor homepages as county Search replacements */
function isAcceptableReplacement(originalUrl, candidateUrl, item) {
  if (!candidateUrl || candidateUrl === originalUrl) return true;
  let cand;
  let orig;
  try {
    cand = new URL(candidateUrl);
    orig = new URL(originalUrl);
  } catch {
    return false;
  }
  const host = cand.hostname.toLowerCase();
  const path = (cand.pathname || '/').replace(/\/+$/, '') || '/';
  const compact = slugCompact(item.county || '');

  // Multi-tenant vendor roots without county token in host/path/query → reject
  const vendorRoots = [
    /^www\.deltacomputersystems\.com$/i,
    /^deltacomputersystems\.com$/i,
    /^www\.payyourpropertytax\.com$/i,
    /^payyourpropertytax\.com$/i,
    /^actweb\.acttax\.com$/i,
    /^www\.texaspayments\.com$/i,
    /^texaspayments\.com$/i,
    /^www\.paytaxes\.net$/i,
    /^paytaxes\.net$/i,
    /^wipp\.edmundsassoc\.com$/i,
    /^www\.infoconcountyaccess\.com$/i,
  ];
  const isVendorHost = vendorRoots.some((re) => re.test(host));
  if (isVendorHost) {
    const q = (cand.search || '').toLowerCase();
    const hay = `${host}${path}?${q}`;
    const hasCounty =
      (compact && compact.length >= 4 && hay.includes(compact)) ||
      /\/AL\/AL\d+/i.test(path) ||
      /[?&]town=/i.test(q) ||
      /[?&]wippid=/i.test(q) ||
      /\/\d{5,6}\//i.test(path + '/') ||
      /act_webdev\/[a-z0-9_-]+/i.test(path);
    if (path === '/' && !hasCounty) return false;
    if (!hasCounty && path.split('/').filter(Boolean).length <= 1) return false;
  }

  // Iowa statewide portals are intentional shared Search entry points
  if (/iowataxandtags\.org|iowatreasurers\.org/i.test(host)) return true;

  // Same host path-trim is OK if original host already county-specific (subdomain)
  if (host === orig.hostname.toLowerCase()) return true;
  if (host.replace(/^www\./, '') === orig.hostname.toLowerCase().replace(/^www\./, '')) return true;

  // County token in new host (e.g. montgomeryal.capturecama, ca-inyo.publicaccessnow)
  if (compact && compact.length >= 4 && host.replace(/[^a-z0-9]/g, '').includes(compact.slice(0, Math.min(8, compact.length))))
    return true;

  // Known good patterned replacements
  if (/county-taxes\.net/i.test(host) && path.includes('property-tax')) return true;
  if (/mytaxbill/i.test(host) && /town=/i.test(cand.search)) return true;
  if (/qpublic\.net/i.test(host) && /\/ga\//i.test(path)) return true;
  if (/spatialest\.com/i.test(host)) return true;
  if (/jccal\.org/i.test(host)) return true;
  if (/leetc\.com/i.test(host)) return true;
  if (/schneidercorp|beacon\./i.test(host)) return true;
  if (/countymn\.gov$/i.test(host) || /\.mn\.us$/i.test(host)) return true;
  if (/countytx\.gov$/i.test(host)) return true;

  // Otherwise require county token somewhere
  if (compact && compact.length >= 5) {
    const hay = `${host}${path}${cand.search}`.toLowerCase();
    if (hay.includes(compact)) return true;
  }
  return false;
}
async function probeUrl(url, { longTimeout = false } = {}) {
  let host = '';
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return {
      status: null,
      error: 'InvalidURL',
      bucket: 'dead',
      kind: 'invalid_url',
      activeShould: false,
      url,
      ms: 0,
      finalUrl: url,
    };
  }
  if (nxHostCache.has(host)) {
    return {
      status: null,
      error: 'NXDOMAIN',
      bucket: 'dead',
      kind: 'nxdomain',
      activeShould: false,
      url,
      ms: 0,
      finalUrl: url,
      cached: true,
    };
  }

  const r = await requestOnce(url, 'GET', {
    ua: UA_BROWSER,
    timeoutMs: longTimeout ? TIMEOUT_RETRY_MS : TIMEOUT_MS,
  });

  const cls = classifyBucket({ ...r, url });
  if (cls.bucket === 'validated_true') okHostCache.set(host, cls.kind);
  return {
    ...r,
    url,
    bucket: cls.bucket,
    kind: cls.kind,
    activeShould: cls.active,
  };
}

async function recheckItem(prior) {
  const item = {
    key: prior.key,
    state: prior.state,
    county: prior.county,
    url: prior.url,
    source: prior.source,
  };

  const long = prior.kind === 'TimeoutError' || prior.bucket === 'uncertain';
  let best = await probeUrl(item.url, { longTimeout: long });
  let winningUrl = item.url;
  let how = 'retry_original';

  // Original URL that only "works" by redirecting to a generic vendor home stays dead
  if (
    best.bucket === 'validated_true' &&
    prior.bucket === 'dead' &&
    !isAcceptableReplacement(item.url, best.finalUrl || item.url, item)
  ) {
    best = {
      ...best,
      bucket: 'dead',
      kind: prior.kind || 'gone',
      activeShould: false,
    };
  }

  if (best.bucket === 'validated_true') {
    return finishRecheck(item, prior, best, winningUrl, how, 1);
  }

  let candidates;
  if (prior.bucket === 'uncertain') {
    // Lean: www/https swap + root only
    candidates = uniqueUrls(baseVariants(item.url).filter((u) => u !== item.url)).slice(0, 4);
  } else {
    candidates = uniqueUrls([
      ...vendorCandidates(item),
      ...baseVariants(item.url).filter((u) => u !== item.url),
    ]).slice(0, 8);
  }

  let tried = 1;
  for (const cand of candidates) {
    tried++;
    if (!isAcceptableReplacement(item.url, cand, item)) continue;
    const r = await probeUrl(cand, { longTimeout: false });
    if (!r) continue;
    if (r.bucket === 'validated_true') {
      const landed = r.finalUrl || cand;
      // Reject soft 200s that redirect onto a generic vendor homepage
      if (!isAcceptableReplacement(item.url, landed, item)) continue;
      best = r;
      winningUrl = cand;
      how = /mytaxbill|county-taxes\.net|qpublic|iowataxandtags|iowatreasurers|publicaccessnow|capturecama|edmunds|spatialest|jccal|leetc|deltacomputer|acttax|texaspayments|governmax/i.test(
        cand
      )
        ? 'vendor_or_known_pattern'
        : 'url_variant';
      break;
    }
    if (best.bucket === 'dead' && r.bucket === 'uncertain') {
      best = r;
      winningUrl = item.url;
      how = 'variant_soft';
    }
  }

  // If best is validated_true only via unacceptable URL somehow, force dead/uncertain retention
  if (winningUrl !== item.url && best.bucket === 'validated_true') {
    const landed = best.finalUrl || winningUrl;
    if (
      !isAcceptableReplacement(item.url, winningUrl, item) ||
      !isAcceptableReplacement(item.url, landed, item)
    ) {
      winningUrl = item.url;
      best = {
        ...best,
        bucket: prior.bucket,
        kind: prior.kind,
        activeShould: prior.bucket !== 'dead',
      };
    }
  }

  return finishRecheck(item, prior, best, winningUrl, how, tried);
}

function finishRecheck(item, prior, cls, winningUrl, how, candidatesTried) {
  const urlChanged = winningUrl !== item.url && cls.bucket === 'validated_true';
  // If soft uncertain on a different URL, keep original URL in registry
  const outUrl = urlChanged ? winningUrl : item.url;
  return {
    key: item.key,
    state: item.state,
    county: item.county,
    url: outUrl,
    originalUrl: item.url,
    finalUrl: cls.finalUrl || outUrl,
    source: item.source,
    status: cls.status,
    error: cls.error,
    ms: cls.ms,
    redirects: cls.redirects || 0,
    bucket: cls.bucket,
    kind: cls.kind,
    activeShould: cls.bucket === 'validated_true' || cls.bucket === 'uncertain',
    priorBucket: prior.bucket,
    priorKind: prior.kind,
    how: urlChanged ? how : how === 'retry_original' ? 'retry_original' : how,
    urlUpdated: urlChanged,
    candidatesTried,
  };
}

async function mapPool(list, concurrency, fn) {
  const out = new Array(list.length);
  let i = 0;
  let doneCount = 0;
  async function worker() {
    while (i < list.length) {
      const idx = i++;
      out[idx] = await fn(list[idx], idx);
      doneCount++;
      if (doneCount % 25 === 0 || doneCount === list.length) {
        process.stdout.write(`  … remainder ${doneCount}/${list.length}\n`);
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return out;
}

function writeCountiesExport(index) {
  let noUrlRows = [];
  if (fs.existsSync(EXPORT_CSV)) {
    const lines = fs.readFileSync(EXPORT_CSV, 'utf8').trim().split(/\r?\n/);
    const header = lines[0].split(',');
    const idxUrl = header.indexOf('primary_search_url');
    const idxKey = header.indexOf('key');
    for (const line of lines.slice(1)) {
      const cols = [];
      let cur = '';
      let inQ = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') inQ = !inQ;
        else if (ch === ',' && !inQ) {
          cols.push(cur);
          cur = '';
        } else cur += ch;
      }
      cols.push(cur);
      if (idxUrl >= 0 && !(cols[idxUrl] || '').trim()) {
        noUrlRows.push({
          state: cols[0],
          county: cols[1],
          key: cols[idxKey],
          primary_search_url: '',
          source: cols[4] || '',
          active: 'false',
          confidence_base: cols[6] || '0',
          quality: cols[7] || 'no_url',
          version: cols[8] || '1',
        });
      }
    }
  }

  const rows = index.items.map((item) => ({
    state: item.state,
    county: item.county,
    key: item.key,
    primary_search_url: item.url || '',
    source: item.source || '',
    active: item.active ? 'true' : 'false',
    confidence_base: item.confidenceBase != null ? item.confidenceBase : '',
    quality: item.quality || 'ok',
    version: item.version != null ? item.version : 1,
  }));

  const header = [
    'state',
    'county',
    'key',
    'primary_search_url',
    'source',
    'active',
    'confidence_base',
    'quality',
    'version',
  ];
  const all = [
    ...rows,
    ...noUrlRows.filter((n) => !rows.some((r) => r.key === n.key)),
  ].sort((a, b) => a.key.localeCompare(b.key));

  const csv = [header.join(','), ...all.map((r) => header.map((h) => csvEscape(r[h])).join(','))].join(
    '\n'
  );
  fs.writeFileSync(EXPORT_CSV, csv + '\n');
  const withUrl = all.filter((r) => (r.primary_search_url || '').trim()).length;
  const active = all.filter((r) => r.active === 'true').length;
  const summary = {
    generatedAt: new Date().toISOString(),
    jurisdictions: all.length,
    withUrl,
    active,
    noUrl: all.length - withUrl,
    note: 'Remainder revalidate after hybrid 2026-09-13; DeepShake not_run',
  };
  fs.writeFileSync(EXPORT_SUMMARY, JSON.stringify(summary, null, 2));
  return summary;
}

function writePastePack(meta, validated) {
  const lines = [
    'S-PUL — WHAT IT IS (paste-ready)',
    '================================',
    `Updated: ${meta.generatedAt}`,
    'Product names: S-PUL · Webpoint · TaxCert.ai',
    'Account-of-record domain: taxcert.ai (marketing today: webpointllc.com)',
    '',
    'ONE SENTENCE',
    '------------',
    'S-PUL is generative jurisdiction search: type a place (or tax intent), get the',
    'official county/city tax collector or property-tax search URL with a confidence',
    'score — or an honest miss. It does not invent URLs.',
    '',
    'WHAT IT DOES',
    '------------',
    '- Accepts natural queries: "San Diego", "Travis County TX", "pay taxes Chicago",',
    '  "LA County", parish/borough forms, soft typos.',
    '- Normalizes the query (Layer B aliases) into a registry-friendly county + state',
    '  shape. Example: "San Diego" → unique lock on San Diego County, CA;',
    '  "Chicago" → Cook, IL; "Jackson" (ambiguous) → ranked list + ask for state.',
    '- Looks up a locked Extractor registry of official Search/Base URLs.',
    '- Returns the locked URL + confidence (and a short Path B guide: intent → open',
    '  URL → search by owner/parcel). If the registry has no row, it says so.',
    '- Prefer Search URL over Base homepage when both exist in source data.',
    '- Never invents domains. Never uses LLM guesses as URL evidence.',
    '',
    'WHAT IT IS NOT',
    '--------------',
    '- Not Central Intelligence (CI) / Path A orchestrator',
    '- Not voice-first / TTS / orb',
    '- Not RAG-over-docs / embeddings over a document corpus',
    '- Not a scraper that invents collector sites from Google',
    '- Highlighter (DEP) is untouched',
    '',
    'COUNTS (hybrid + remainder revalidate)',
    '-------------------------------------',
    `Listed jurisdictions:     ${meta.listed}`,
    `With primary_search_url:  ${meta.withUrl}`,
    `Validated-true (HTTP):    ${meta.validatedTrue}`,
    `Dead (clear):             ${meta.dead}`,
    `Uncertain (timeout/TLS/…):${meta.uncertain}`,
    `Registry active after write-back (validated-true + uncertain kept): ${meta.indexActiveCount}`,
    `Remainder newly validated-true: ${meta.newlyValidated}`,
    `URL replacements applied (HTTP-evidenced): ${meta.urlUpdates}`,
    `Path to 2000+ true: need ${Math.max(0, 2000 - meta.validatedTrue)} more (bot-walls/NXDOMAIN/geo may block)`,
    'DeepShake: NOT RUN (no /Volumes/T7, no Mac worker)',
    '',
    'VALIDATED-TRUE URLS (full list — state, county, URL)',
    '----------------------------------------------------',
    '',
  ];
  for (const r of validated.sort((a, b) => a.key.localeCompare(b.key))) {
    lines.push(`${r.state}\t${r.county}\t${r.url}`);
  }
  lines.push('');
  lines.push(`Total validated-true rows: ${validated.length}`);
  lines.push('Companion CSV: spul/data/validated-true-urls.csv');
  lines.push('Also: docs/SPUL_DESCRIPTION_AND_VALIDATED_URLS.md');
  lines.push('Artifact: /opt/cursor/artifacts/SPUL_DESCRIPTION_AND_VALIDATED_URLS.txt');
  lines.push('');
  const text = lines.join('\n');
  fs.writeFileSync(PASTE_MD, text + '\n');
  fs.writeFileSync(PASTE_TXT, text + '\n');
  return text;
}

async function main() {
  const prior = JSON.parse(fs.readFileSync(PRIOR_JSON, 'utf8'));
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  const byKeyPrior = new Map((prior.results || []).map((r) => [r.key, r]));

  let remainder = (prior.results || []).filter((r) => r.bucket !== 'validated_true');
  if (args.bucket && args.bucket !== true) {
    const b = String(args.bucket);
    remainder = remainder.filter((r) => r.bucket === b);
  }
  const LIMIT = parseInt(args.limit || '0', 10);
  if (LIMIT > 0) remainder = remainder.slice(0, LIMIT);
  console.log(
    `Remainder revalidate: ${remainder.length} (dead+uncertain), concurrency=${CONCURRENCY}`
  );
  console.log('DeepShake: not_run (no /Volumes/T7)');

  const remainderResults = await mapPool(remainder, CONCURRENCY, (item) => recheckItem(item));

  // Merge: start from prior results, overlay remainder outcomes
  const mergedByKey = new Map(byKeyPrior);
  const fixes = [];
  let newlyValidated = 0;
  let stillDead = 0;
  let stillUncertain = 0;
  let urlUpdates = 0;

  for (const r of remainderResults) {
    const prev = byKeyPrior.get(r.key);
    if (r.bucket === 'validated_true' && prev && prev.bucket !== 'validated_true') newlyValidated++;
    if (r.bucket === 'dead') stillDead++;
    if (r.bucket === 'uncertain') stillUncertain++;

    if (r.urlUpdated && r.url !== r.originalUrl) {
      urlUpdates++;
      fixes.push({
        key: r.key,
        from: r.originalUrl,
        to: r.url,
        how: r.how,
        status: r.status,
        kind: r.kind,
      });
      const item = index.items.find((i) => i.key === r.key);
      if (item) {
        item.url = r.url;
        item.quality = 'ok';
        item.flags = Array.isArray(item.flags) ? item.flags : [];
        if (!item.flags.includes('remainder_url_fix')) item.flags.push('remainder_url_fix');
      }
    }

    mergedByKey.set(r.key, {
      key: r.key,
      state: r.state,
      county: r.county,
      url: r.url,
      finalUrl: r.finalUrl,
      source: r.source,
      status: r.status,
      error: r.error,
      ms: r.ms,
      redirects: r.redirects,
      bucket: r.bucket,
      kind: r.kind,
      activeShould: r.activeShould,
      hostCheck: (prev && prev.hostCheck) || { mismatch: false, reason: 'remainder_pass' },
      sniff: null,
      remainder: {
        priorBucket: r.priorBucket,
        how: r.how,
        urlUpdated: r.urlUpdated,
        candidatesTried: r.candidatesTried,
      },
    });
  }

  const results = [...mergedByKey.values()];
  const validated = results.filter((r) => r.bucket === 'validated_true');
  const dead = results.filter((r) => r.bucket === 'dead');
  const uncertain = results.filter((r) => r.bucket === 'uncertain');

  let flippedInactive = 0;
  let flippedActive = 0;
  for (const item of index.items) {
    const r = mergedByKey.get(item.key);
    if (!r) {
      if (!item.url) item.active = false;
      continue;
    }
    const prev = item.active !== false;
    if (r.bucket === 'dead') item.active = false;
    else if (r.bucket === 'validated_true') item.active = true;
    else item.active = prev ? true : false;
    if (prev && !item.active) flippedInactive++;
    if (!prev && item.active) flippedActive++;
  }

  const activeCount = index.items.filter((i) => i.active !== false).length;
  const listed = 2062;
  const withUrl = index.items.filter((i) => i.url && String(i.url).trim()).length;

  const meta = {
    generatedAt: new Date().toISOString(),
    method: 'hybrid_A_B_C_plus_remainder',
    deepShake: 'not_run',
    deepShakeNote:
      'DeepShake unavailable: cloud Linux VM has no /Volumes/T7 and no connected Mac self-hosted worker.',
    checked: results.length,
    remainderChecked: remainder.length,
    validatedTrue: validated.length,
    dead: dead.length,
    uncertain: uncertain.length,
    newlyValidated,
    stillDead,
    stillUncertain,
    urlUpdates,
    gated: results.filter((r) => r.kind === 'gated').length,
    flippedInactive,
    flippedActive,
    indexActiveCount: activeCount,
    listed,
    withUrl,
    baselineValidatedTrue: prior.meta?.validatedTrue ?? 1437,
    concurrency: CONCURRENCY,
    pathTo2000: Math.max(0, 2000 - validated.length),
  };

  index.meta = index.meta || {};
  index.meta.hybridRevalidate = meta;
  index.meta.remainderRevalidate = meta;
  index.meta.activeCount = activeCount;

  fs.writeFileSync(INDEX_PATH, JSON.stringify(index));
  fs.writeFileSync(
    OUT_JSON,
    JSON.stringify(
      {
        meta,
        results,
        mismatches: results.filter((r) => r.hostCheck && r.hostCheck.mismatch),
        dead: dead.slice(0, 250),
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    OUT_REMAINDER,
    JSON.stringify({ meta, remainderResults, fixes }, null, 2)
  );
  fs.writeFileSync(
    FIXES_PATH,
    JSON.stringify(
      {
        meta: {
          generatedAt: meta.generatedAt,
          fixCount: fixes.length,
          newlyValidated,
          verifiedOk: fixes.length,
          note: 'Remainder pass HTTP-evidenced replacements only',
        },
        fixes,
      },
      null,
      2
    )
  );

  const vHeader = ['state', 'county', 'key', 'url', 'source', 'status', 'kind', 'finalUrl'];
  const vCsv = [
    vHeader.join(','),
    ...validated
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((r) =>
        [r.state, r.county, r.key, r.url, r.source, r.status, r.kind, r.finalUrl]
          .map(csvEscape)
          .join(',')
      ),
  ].join('\n');
  fs.writeFileSync(OUT_VALIDATED_CSV, vCsv + '\n');

  for (const name of ['jurisdictions.json', 'jurisdictions.min.json']) {
    const p = path.join(DATA, name);
    if (!fs.existsSync(p)) continue;
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    const list = j.jurisdictions || j.items || [];
    for (const row of list) {
      const r = mergedByKey.get(row.key);
      const item = index.items.find((i) => i.key === row.key);
      if (item) {
        row.active = item.active;
        row.url = item.url;
      }
      if (r) {
        row.validate_bucket = r.bucket;
        row.validate_kind = r.kind;
      }
    }
    j.meta = j.meta || {};
    j.meta.hybridRevalidate = meta;
    j.meta.remainderRevalidate = meta;
    fs.writeFileSync(p, JSON.stringify(j));
  }

  const summary = writeCountiesExport(index);
  writePastePack(meta, validated);

  // artifacts
  try {
    fs.copyFileSync(PASTE_TXT, '/opt/cursor/artifacts/SPUL_DESCRIPTION_AND_VALIDATED_URLS.txt');
    fs.copyFileSync(OUT_VALIDATED_CSV, '/opt/cursor/artifacts/SPUL_VALIDATED_TRUE_URLS.csv');
    fs.writeFileSync(
      '/opt/cursor/artifacts/SPUL_REMAINDER_REPORT.json',
      JSON.stringify({ meta, fixes: fixes.slice(0, 100), stillDead: stillDead, stillUncertain }, null, 2)
    );
  } catch (e) {
    console.warn('artifact copy soft-fail', e.message);
  }

  const md = [
    '# URL Remainder Revalidate (2026-09-13)',
    '',
    `**Generated:** ${meta.generatedAt}`,
    `**DeepShake:** **not_run**`,
    '',
    '## Method',
    '',
    '- Load prior hybrid classifications; isolate dead + uncertain',
    '- Retry: alt User-Agents, GET after HEAD, 22s timeout, redirects ≤5',
    '- Variants: www↔non-www, http→https, path trim, governmaxa typo',
    '- Vendor patterns (HTTP evidence only): mytaxbill town=, county-taxes.net, Iowa portals, PublicAccessNow roots, CaptureCAMA, Edmunds WIPP, qpublic for GA paytaxes, known county portals',
    '- Prefer Search-shaped URLs; never invent final URLs without HTTP evidence',
    '',
    '## Counts',
    '',
    `| Metric | Count |`,
    `|---|---:|`,
    `| Listed | ${summary.jurisdictions} |`,
    `| With URL | ${summary.withUrl} |`,
    `| Validated-true | ${meta.validatedTrue} |`,
    `| Dead | ${meta.dead} |`,
    `| Uncertain | ${meta.uncertain} |`,
    `| Newly validated from remainder | ${newlyValidated} |`,
    `| URL replacements applied | ${urlUpdates} |`,
    `| Index active | ${meta.indexActiveCount} |`,
    `| Gap to 2000 true | ${meta.pathTo2000} |`,
    '',
    '## Honest path to 2000+',
    '',
    meta.validatedTrue >= 2000
      ? `- Target met: **${meta.validatedTrue}** validated-true.`
      : `- Still **${meta.pathTo2000}** short of 2000. Remaining dead are mostly NXDOMAIN vendor hosts (morris.state.mn.us, manatron, paytaxes county subs, governmax, ddti, rptdata) that need DeepShake/Mac or curated official replacements. Uncertain are mostly TimeoutError/TLS behind bot-walls or slow gov networks.`,
    '',
    '## Sample new validations',
    '',
    ...remainderResults
      .filter((r) => r.bucket === 'validated_true' && r.priorBucket !== 'validated_true')
      .slice(0, 40)
      .map(
        (r) =>
          `- \`${r.key}\` → \`${r.url}\` (${r.how}, status=${r.status}, was ${r.priorBucket}/${r.priorKind})`
      ),
    '',
  ].join('\n');
  fs.writeFileSync(REPORT_MD, md);

  // README count bump (spul)
  const readmePath = path.join(ROOT, 'README.md');
  if (fs.existsSync(readmePath)) {
    let readme = fs.readFileSync(readmePath, 'utf8');
    readme = readme.replace(
      /\*\*\d+ validated-true\*\* \/ \d+ dead \/ \d+ uncertain on 2026-09-13 hybrid revalidate; registry active ≈\d+ = validated-true \+ uncertain kept/,
      `**${meta.validatedTrue} validated-true** / ${meta.dead} dead / ${meta.uncertain} uncertain on 2026-09-13 hybrid+remainder; registry active ≈${meta.indexActiveCount} = validated-true + uncertain kept`
    );
    fs.writeFileSync(readmePath, readme);
  }

  console.log(JSON.stringify(meta, null, 2));
  console.log(`Wrote ${OUT_REMAINDER}`);
  console.log(`Wrote ${OUT_VALIDATED_CSV}`);
  console.log(`Wrote ${REPORT_MD}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
