'use strict';

/**
 * Process-of-elimination vendor matrix.
 * One family verdict fans out to every county on that host.
 * Shared homepages are hubs, not 296 locks. Assessor SaaS never becomes collector.
 * Cloudflare collector families wait for a signed-in user Chrome tab — no bypass.
 */

const KNOWN = [
  { id: 'nj_signature_lots', test: /lots\.signatureinfo\.com$/i, kind: 'hub', chrome: 'user_session' },
  { id: 'ne_taxes_online', test: /nebraskataxesonline\.us$/i, kind: 'collector', chrome: 'sample' },
  { id: 'ar_countydata', test: /arcountydata\.com$/i, kind: 'collector', chrome: 'sample' },
  { id: 'al_delta', test: /deltacomputersystems\.com$/i, kind: 'collector', chrome: 'sample' },
  { id: 'ky_ecclix', test: /ecclix\.com$/i, kind: 'collector', chrome: 'user_session' },
  { id: 'ky_csi', test: /csiky\.com$/i, kind: 'collector', chrome: 'user_session' },
  { id: 'la_sns', test: /snstaxpayments\.com$/i, kind: 'collector', chrome: 'user_session' },
  { id: 'pvdnet', test: /properlytaxes\.com$/i, kind: 'collector', chrome: 'user_session' },
  { id: 'govos_county_taxes', test: /county-taxes\.(com|net)$/i, kind: 'collector', chrome: 'user_session' },
  { id: 'catalis_landnav', test: /landnav\.com$/i, kind: 'collector', chrome: 'user_session' },
  { id: 'mi_bsa_is', test: /bsasoftware\.com$/i, kind: 'collector', chrome: 'sample' },
  { id: 'bsaonline', test: /bsaonline\.com$/i, kind: 'collector', chrome: 'sample' },
  { id: 'taxlookup_net', test: /taxlookup\.net$/i, kind: 'collector', chrome: 'sample' },
  { id: 'opaldata', test: /opaldata\.net$/i, kind: 'collector', chrome: 'sample' },
  { id: 'nhtaxkiosk', test: /nhtaxkiosk\.com$/i, kind: 'collector', chrome: 'sample' },
  { id: 'acttax', test: /acttax\.com$/i, kind: 'collector', chrome: 'sample' },
  { id: 'devnet_wedge', test: /devnetwedge\.com$/i, kind: 'collector', chrome: 'sample' },
  { id: 'edmunds_wipp', test: /edmundsassoc\.com$|edmundsgovtech/i, kind: 'collector', chrome: 'user_session' },
  { id: 'ncpts', test: /ncptscloud\.com$/i, kind: 'collector', chrome: 'user_session' },
  { id: 'accessmygov', test: /accessmygov\.com$/i, kind: 'collector', chrome: 'sample' },
  { id: 'myeasygov', test: /myeasygov/i, kind: 'collector', chrome: 'sample' },
  { id: 'spatialest', test: /spatialest\.com$/i, kind: 'collector', chrome: 'sample' },
  { id: 'sdttc_webpayments', test: /sdttc\.com$/i, kind: 'collector', chrome: 'sample' },
  { id: 'itricity', test: /itricityfreedomdata\.com$/i, kind: 'collector', chrome: 'sample' },
  { id: 'isouthwestdata', test: /isouthwestdata\.com$/i, kind: 'collector', chrome: 'sample' },
  { id: 'infotaxonline', test: /infotaxonline\.com$/i, kind: 'collector', chrome: 'sample' },
  { id: 'propertytaxonline', test: /propertytaxonline\.org$/i, kind: 'collector', chrome: 'sample' },
  { id: 'lowtaxinfo', test: /lowtaxinfo\.com$/i, kind: 'collector', chrome: 'sample' },
  { id: 'totalcollection', test: /totalcollectionsolution\.com$/i, kind: 'collector', chrome: 'sample' },
  { id: 'guts', test: /g-uts\.com$/i, kind: 'collector', chrome: 'sample' },
  { id: 'eztaxonline', test: /eztaxonline/i, kind: 'collector', chrome: 'sample' },
  { id: 'schneider_beacon', test: /schneidercorp\.com$|^beacon\./i, kind: 'assessor', chrome: 'never' },
  { id: 'qpublic', test: /qpublic/i, kind: 'assessor', chrome: 'never' },
  { id: 'tx_trueautomation', test: /trueautomation\.com$/i, kind: 'assessor', chrome: 'never' },
  { id: 'tyler_munis', test: /munisselfservice\.com$/i, kind: 'hub', chrome: 'user_session' },
  { id: 'tyler_itax', test: /tylertech\.com$|^itax\./i, kind: 'hub', chrome: 'user_session' },
  { id: 'invoicecloud', test: /invoicecloud\.com$/i, kind: 'payment_hub', chrome: 'never' },
  { id: 'texaspayments_home', test: /texaspayments\.com$/i, kind: 'payment_hub', chrome: 'never' },
  { id: 'forte_billpay', test: /forte\.net$/i, kind: 'payment_hub', chrome: 'never' },
  { id: 'govpay', test: /govpaynow|paygov\.us|municipalonlinepayments/i, kind: 'payment_hub', chrome: 'never' },
  { id: 'google_skip', test: /google\.com$/i, kind: 'skip', chrome: 'never' }
];

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return '';
  }
}

function familyIdFromHost(host) {
  const h = String(host || '');
  for (const row of KNOWN) {
    if (row.test.test(h)) return row.id;
  }
  if (!h) return 'none';
  const parts = h.split('.').filter(Boolean);
  if (parts.length >= 2) return `host:${parts.slice(-2).join('.')}`;
  return `host:${h}`;
}

function knownOf(id) {
  return KNOWN.find((row) => row.id === id) || null;
}

function pathSearch(url) {
  try {
    const u = new URL(url);
    return `${u.pathname || ''}${u.search || ''}`;
  } catch {
    return '';
  }
}

function isBareOrigin(url) {
  try {
    const u = new URL(url);
    const path = (u.pathname || '/').replace(/\/+$/, '') || '/';
    return path === '/' && !u.search;
  } catch {
    return false;
  }
}

function hasCountyDiscriminator(url) {
  const blob = String(url || '');
  if (/[?&](county|c|parish|wippid|client|agency|taxdistrict)=/i.test(blob)) return true;
  if (/county-taxes\.(com|net)\/[a-z0-9-]+/i.test(blob)) return true;
  if (/\/[A-Z]{2}\/[A-Z]{2}\d{2,}\/?/i.test(blob)) return true;
  if (/pp-[a-z0-9-]+\.app\.landnav/i.test(blob)) return true;
  if (/\/(property-tax|public|tax\/search|propsearch)/i.test(blob)) return true;
  return false;
}

/**
 * 0 hub homepage shared by many keys
 * 1 shared vendor login/search (county picked in-session)
 * 2 county-specific path or unique host
 * 3 explicit county query / govos path
 */
function specificity(url, siblingCount = 1) {
  if (!url) return 0;
  if (isBareOrigin(url) && siblingCount >= 8) return 0;
  if (hasCountyDiscriminator(url)) return 3;
  const path = pathSearch(url).replace(/\/+$/, '');
  if (siblingCount >= 8 && path.length <= 1) return 0;
  if (siblingCount >= 8) return 1;
  if (path.length > 1) return 2;
  return 1;
}

function classify(url, siblingCount = 1) {
  const host = hostOf(url);
  const id = familyIdFromHost(host);
  const known = knownOf(id);
  const kind = known ? known.kind : 'unknown';
  const spec = specificity(url, siblingCount);
  const lockable = kind === 'collector' && spec >= 2;
  return {
    family: id,
    host,
    kind,
    chrome: known ? known.chrome : spec >= 2 ? 'sample' : 'user_session',
    specificity: spec,
    lockable,
    lookFor: require('./siteValidator').lookForHeaders()
  };
}

function pickSample(urls) {
  const list = (urls || []).filter(Boolean);
  if (!list.length) return '';
  return list.slice().sort((a, b) => {
    const sa = specificity(a, list.filter((u) => u === a).length);
    const sb = specificity(b, list.filter((u) => u === b).length);
    if (sb !== sa) return sb - sa;
    return b.length - a.length;
  })[0];
}

function groupRows(rows) {
  const byFamily = new Map();
  const urlCounts = new Map();
  for (const row of rows || []) {
    const url = String(row.url || '').trim();
    if (!url) continue;
    urlCounts.set(url, (urlCounts.get(url) || 0) + 1);
  }
  for (const row of rows || []) {
    const url = String(row.url || '').trim();
    if (!url) continue;
    const hit = classify(url, urlCounts.get(url) || 1);
    const bucket = byFamily.get(hit.family) || {
      family: hit.family,
      kind: hit.kind,
      chrome: hit.chrome,
      keys: [],
      urls: new Set(),
      lockable: 0,
      hub: 0
    };
    if (row.key && !bucket.keys.includes(row.key)) bucket.keys.push(row.key);
    bucket.urls.add(url);
    if (hit.lockable) bucket.lockable += 1;
    if (hit.specificity === 0) bucket.hub += 1;
    byFamily.set(hit.family, bucket);
  }
  return [...byFamily.values()].map((b) => {
    const urls = [...b.urls];
    return {
      family: b.family,
      kind: b.kind,
      chrome: b.chrome,
      keys: b.keys.length,
      uniqueUrls: urls.length,
      lockable: b.lockable,
      hub: b.hub,
      sample: pickSample(urls)
    };
  });
}

module.exports = {
  KNOWN,
  hostOf,
  familyIdFromHost,
  classify,
  specificity,
  pickSample,
  groupRows,
  hasCountyDiscriminator
};
