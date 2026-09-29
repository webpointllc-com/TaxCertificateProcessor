'use strict';

const { isRealHttpUrl, isGoogleFallbackUrl } = require('../src/services/spulTruth');

const COLLECTOR_HOST =
  /landnav\.com|spatialest\.com|sdttc\.com|webpayments|(?:^|[/.])taxbill\.|myharriscountytax|catalis|govpaynow|paygov\.us|pay\.paygov|propertytax\.ark\.org|propertytax\.lacounty|propertytax\.alameda|propertytax\.knoxcounty|propertytax\.vi\.gov|eproptax|setsearchparameters|county-taxes\.com|county-taxes\.net|myeasygov|dekalbtax|mptsweb\.com\/.+\/tax\/search|devnetwedge|qpaybill|cit-e\.net\/.+taxbill|altags\.com\/.+(property|proptax)|tax\.[a-z0-9.-]+\/.+commonsearch|pp-[a-z0-9-]+\.app\.landnav/i;

const ASSESSOR_HOST =
  /qpublic\.net|\bqpublic\b|beacon\.|schneidercorp|countygovservices|capturecama|\/assessor|assessor\.|arcc\.|propertyappraiser|\/appraisal|\/cad\b|\bcad\.org\b|pcpao\.|hcpafl\.|scpafl\.|appraisal.?district/i;

const COLLECTOR_TITLE =
  /\b(tax(es)? (search|bill|payment)|webpayments?|pay (your )?propert(y|ies) tax(es)?|property tax(es)? (search|portal|inquiry|bill)|tax payment portal|landnav|catalis|search or pay|property tax inquiry)\b/i;

const CLOUDFLARE =
  /just a moment|attention required|cf-ray|cdn-cgi\/challenge|checking your browser/i;

const SITE_SEARCH_NAME =
  /^(s|q|query|search|search_query|keywords|sitesearch|site_search)$/i;

const ASSESSOR_TITLE =
  /\b(assessor|property appraiser|appraisal district|\bcad\b|assessor-recorder|arcc)\b/i;

const SEARCH_FIELD =
  /\b(parcel|apn|ain|pin|folio|account\s*(no|number|#)?|tax\s*id|owner|last\s*name|situs|address)\b/i;

function extractTitle(html) {
  const m = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return '';
  return m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 180);
}

function extractFields(html) {
  const fields = [];
  const seen = new Set();
  const re = /<(input|select|textarea)([^>]*)>/gi;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[2];
    const type = (attrs.match(/\btype=["']([^"']+)/i) || [])[1] || m[1];
    if (/hidden|submit|button|image|file|checkbox|radio|reset/i.test(type)) continue;
    const name = (attrs.match(/\bname=["']([^"']+)/i) || [])[1] || '';
    const id = (attrs.match(/\bid=["']([^"']+)/i) || [])[1] || '';
    const ph = (attrs.match(/\bplaceholder=["']([^"']+)/i) || [])[1] || '';
    const aria = (attrs.match(/\baria-label=["']([^"']+)/i) || [])[1] || '';
    if (SITE_SEARCH_NAME.test(name) || SITE_SEARCH_NAME.test(id)) continue;
    const blob = `${name} ${id} ${ph} ${aria}`;
    if (!SEARCH_FIELD.test(blob) && !SEARCH_FIELD.test(ph)) continue;
    const key = `${name}|${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const role = /parcel|apn|ain|pin|folio/i.test(blob)
      ? 'parcel'
      : /owner|last\s*name|name/i.test(blob)
        ? 'owner'
        : /address|situs|street/i.test(blob)
          ? 'address'
          : /account|tax\s*id/i.test(blob)
            ? 'account'
            : 'search';
    const fieldsXpath = id
      ? `//${m[1].toLowerCase()}[@id='${id}']`
      : name
        ? `//${m[1].toLowerCase()}[@name='${name}']`
        : '';
    fields.push({
      role,
      label: aria || ph || id || name,
      name,
      id,
      xpath: fieldsXpath
    });
    if (fields.length >= 12) break;
  }
  return fields;
}

function pathOf(url) {
  try {
    const u = new URL(url);
    return (u.pathname || '/').replace(/\/+$/, '') || '/';
  } catch {
    return '/';
  }
}

function classifyProbe({ url, finalUrl, status, html, error, entity, entityNote, entityType, vendor }) {
  const href = finalUrl || url || '';
  const hrefs = `${url || ''} ${finalUrl || ''}`;
  const redirectedOffVendor =
    /county-taxes\.(com|net)/i.test(url || '') &&
    finalUrl &&
    !/county-taxes\.(com|net)/i.test(finalUrl);
  const hostHay = redirectedOffVendor ? finalUrl : hrefs;
  if (isGoogleFallbackUrl(href)) {
    return { verdict: 'dead', reason: 'google_fallback' };
  }
  if (!isRealHttpUrl(url)) {
    return { verdict: 'empty', reason: 'no_http_url' };
  }
  if (error === 'timeout') return { verdict: 'dead', reason: 'timeout' };
  if (error === 'enotfound' || error === 'dns') return { verdict: 'dead', reason: 'dns' };
  const bodyPreview = String(html || '').slice(0, 4000);
  const collectorHostEarly = COLLECTOR_HOST.test(hostHay);
  if (
    (status === 403 || status === 401) &&
    collectorHostEarly &&
    (CLOUDFLARE.test(`${extractTitle(html)} ${bodyPreview}`) || /county-taxes\.(com|net)/i.test(hostHay))
  ) {
    return {
      verdict: 'collector_search',
      reason: 'collector_host_cloudflare',
      title: extractTitle(html),
      fields: []
    };
  }
  if (status === 404 || status === 410 || status === 403 || status === 401) {
    return { verdict: 'dead', reason: `http_${status}` };
  }
  if (status >= 400) return { verdict: 'dead', reason: `http_${status}` };
  if (status === 0 && error) return { verdict: 'dead', reason: error };

  const title = extractTitle(html);
  const fields = extractFields(html || '');
  const blob = `${title} ${entity || ''} ${entityNote || ''} ${vendor || ''} ${href} ${entityType || ''}`.toLowerCase();
  const body = String(html || '').slice(0, 80000).toLowerCase();

  if (/custom404|\b404\b.*not found|page not found|cannot find the page/i.test(`${title} ${body.slice(0, 2000)}`)) {
    if (status >= 400 || /custom404/i.test(title)) {
      return { verdict: 'dead', reason: '404_page', title, fields };
    }
  }

  const path = pathOf(href);
  const collectorHost = COLLECTOR_HOST.test(hostHay) || COLLECTOR_HOST.test(vendor || '');
  const assessorHost = ASSESSOR_HOST.test(hrefs);
  const hasSearchFields = fields.length > 0;
  const hasParcelOrAccount = fields.some((f) => f.role === 'parcel' || f.role === 'account');
  const collectorTitle = COLLECTOR_TITLE.test(title);
  const assessorish = assessorHost || ASSESSOR_TITLE.test(title) || ASSESSOR_TITLE.test(blob);
  const payish = /\b(pay|payment|tax bill|webpayments|treasurer|tax collector|tax office)\b/i.test(blob + title);
  const homepageEntity = /\b(county site|municipal site|county hub)\b/i.test(`${entity || ''} ${entityNote || ''}`);
  const howToPayPage = /how (do i )?pay|faq-items|payment-information|payment options|voter\/registration/i.test(`${href} ${title}`);
  const googleRedirect = /google\.com\/url/i.test(hrefs);

  if (googleRedirect) {
    return { verdict: 'dead', reason: 'google_redirect', title, fields };
  }

  if (assessorHost && !collectorHost) {
    return { verdict: 'assessor_search', reason: 'assessor_host', title, fields };
  }

  if (howToPayPage && !collectorHost && !hasParcelOrAccount) {
    return { verdict: 'unknown_live', reason: 'howto_pay_page', title, fields };
  }

  if (collectorHost || collectorTitle || (hasParcelOrAccount && (collectorTitle || payish))) {
    if (assessorish && !collectorHost) {
      return { verdict: 'assessor_search', reason: 'assessor_form', title, fields };
    }
    return { verdict: 'collector_search', reason: collectorHost ? 'known_collector_host' : 'search_form', title, fields };
  }

  if (hasSearchFields && assessorish) {
    return { verdict: 'assessor_search', reason: 'assessor_form', title, fields };
  }

  if (assessorish && !payish) {
    return { verdict: 'assessor_search', reason: 'assessor_page', title, fields };
  }

  if (homepageEntity && (path === '/' || path.split('/').filter(Boolean).length <= 1) && !hasSearchFields) {
    return { verdict: 'homepage', reason: 'county_site_homepage', title, fields };
  }

  if (path === '/' && !hasSearchFields && !collectorTitle && !COLLECTOR_HOST.test(href)) {
    return { verdict: 'homepage', reason: 'root_no_search_form', title, fields };
  }

  if (status >= 200 && status < 400) {
    return { verdict: 'unknown_live', reason: 'live_but_not_sure', title, fields };
  }

  if (status >= 400) return { verdict: 'dead', reason: `http_${status}`, title, fields };
  return { verdict: 'unknown_live', reason: error || 'unsure', title, fields };
}

function fieldsToHtml(fields) {
  return (fields || [])
    .map((f) => {
      const id = f.id ? ` id="${f.id}"` : '';
      const name = f.name ? ` name="${f.name}"` : '';
      const ph = f.label ? ` placeholder="${f.label}"` : '';
      return `<input${id}${name}${ph}>`;
    })
    .join('');
}

function reclassifyStored(hit, row = {}) {
  const html = `<title>${hit.title || ''}</title>${fieldsToHtml(hit.fields)}`;
  return classifyProbe({
    url: hit.url || hit.finalUrl,
    finalUrl: hit.finalUrl || hit.url,
    status: hit.status,
    html,
    error: hit.error,
    entity: row.entity,
    entityNote: row.entityNote,
    entityType: row.entityType,
    vendor: row.vendor
  });
}

function shouldLock(verdict) {
  return verdict === 'collector_search';
}

const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function fetchOne(url, timeoutMs = 12000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: ac.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': DEFAULT_UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    const buf = Buffer.from(await res.arrayBuffer());
    const html = buf.slice(0, 400000).toString('utf8');
    return {
      status: res.status,
      finalUrl: String(res.url || url),
      html,
      bytes: buf.length,
      error: null
    };
  } catch (err) {
    const msg = String(err && err.message ? err.message : err);
    let error = 'fetch_error';
    if (/abort|timeout/i.test(msg)) error = 'timeout';
    else if (/ENOTFOUND|getaddrinfo|dns/i.test(msg)) error = 'dns';
    else if (/ECONNREFUSED/i.test(msg)) error = 'refused';
    else if (/certificate|SSL|TLS/i.test(msg)) error = 'tls';
    return { status: 0, finalUrl: url, html: '', bytes: 0, error };
  } finally {
    clearTimeout(t);
  }
}

async function pool(items, n, worker) {
  let i = 0;
  const runners = Array.from({ length: Math.min(n, items.length || 1) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
}

const VENDOR_HREF =
  /county-taxes\.(com|net)|landnav\.com|spatialest\.com|webpayments|taxbill\.|myharriscountytax|setsearchparameters|myeasygov|govpay|paygov|propertytax\.|eproptax|catalis|sdttc|wps\.sdttc|hctax\.net/i;

const PAY_SEARCH_CTA =
  /search or pay|pay (your )?(property )?tax|view\/?\s*pay|property tax search|tax bill search|search (property )?tax(es)?|pay online/i;

function extractCollectorLinks(html, baseUrl) {
  const out = [];
  const seen = new Set();
  const re = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(String(html || '')))) {
    const raw = m[1].trim();
    if (!raw || raw.startsWith('#') || raw.startsWith('mailto:') || raw.startsWith('javascript:')) continue;
    let abs;
    try {
      abs = new URL(raw, baseUrl).href;
    } catch {
      continue;
    }
    if (!/^https?:/i.test(abs)) continue;
    const text = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
    const blob = `${abs} ${text}`;
    let reason = '';
    if (VENDOR_HREF.test(blob)) reason = 'vendor_link';
    else if (PAY_SEARCH_CTA.test(text) && !/assessor|appraiser|cad\b/i.test(blob)) reason = 'pay_search_cta';
    if (!reason) continue;
    if (seen.has(abs)) continue;
    seen.add(abs);
    out.push({ href: abs, text, reason });
    if (out.length >= 20) break;
  }
  return out;
}

function flCountySlugs(county) {
  const raw = String(county || '').trim();
  const compact = raw.toLowerCase().replace(/[^a-z]/g, '');
  const hyphen = raw
    .toLowerCase()
    .replace(/st\.?\s+/g, 'st-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const slugs = new Set([compact, hyphen]);
  if (compact === 'indianriver') slugs.add('indian-river');
  if (compact === 'miamidade') slugs.add('miami-dade');
  if (compact === 'stjohns') slugs.add('st-johns');
  if (compact === 'stlucie') slugs.add('st-lucie');
  if (compact === 'santarosa') slugs.add('santa-rosa');
  if (compact === 'palmbeach') slugs.add('palm-beach');
  if (compact === 'desoto') slugs.add('de-soto');
  return [...slugs].filter(Boolean);
}

module.exports = {
  extractTitle,
  extractFields,
  classifyProbe,
  reclassifyStored,
  shouldLock,
  COLLECTOR_HOST,
  fetchOne,
  pool,
  extractCollectorLinks,
  flCountySlugs,
  CLOUDFLARE
};
