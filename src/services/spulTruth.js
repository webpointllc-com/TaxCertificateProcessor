function compactJurisdictionName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/saint\b/g, 'st')
    .replace(/[^a-z0-9]/g, '');
}

function isGoogleFallbackUrl(url) {
  return typeof url === 'string' && /google\.com\/search/i.test(url);
}

function isRealHttpUrl(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url) && !isGoogleFallbackUrl(url);
}

const SEARCH_PAGE_HINT =
  /search|propertytax|property-tax|taxbill|webpayments|landnav|spatialest|esearch|qpublic|treasurer|taxcollector|tax-collector|taxoffice|paytax|payments|parcel|setsearchparameters|myharris|hctax|beacon|countygovservices|catalis/i;

function isGenericCountyHomepage(url, meta = {}) {
  if (!isRealHttpUrl(url)) return true;
  const vendor = `${meta.vendor || ''} ${url}`;
  if (/landnav|spatialest|sdttc|esearch|qpublic|beacon|countygovservices|tyler|catalis|webpayments/i.test(vendor)) {
    return false;
  }
  const blob = `${meta.entity || ''} ${meta.entityNote || ''}`;
  const entitySaysHomepage = /\b(county site|municipal site|county hub|official .* government)\b/i.test(blob);
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./i, '');
    const path = (u.pathname || '/').replace(/\/+$/, '') || '/';
    const hay = `${host}${path}${u.hash || ''}`;
    if (SEARCH_PAGE_HINT.test(hay)) return false;
    if (entitySaysHomepage && (path === '/' || path.split('/').filter(Boolean).length <= 1)) return true;
  } catch {
    return true;
  }
  return false;
}

function hasUrlLock(confidence, url, meta = {}) {
  if (!isRealHttpUrl(url)) return false;
  if (confidence !== 'verified' && confidence !== 'pattern_matched') return false;
  if (meta.allowHomepage) return true;
  if (meta.source && /golden_override/i.test(String(meta.source))) return true;
  if (isGenericCountyHomepage(url, meta)) return false;
  return true;
}

function enforceLockedSpulUrl(responseText, lockedUrl, confidence) {
  if (!lockedUrl || !responseText) return responseText;
  let out = responseText;
  if (/SPUL_URL:/i.test(out)) {
    out = out.replace(/SPUL_URL:\s*.+/i, `SPUL_URL: ${lockedUrl}`);
  } else {
    out = `SPUL_URL: ${lockedUrl}\n` + out;
  }
  if (confidence && /SPUL_CONFIDENCE:/i.test(out)) {
    out = out.replace(/SPUL_CONFIDENCE:\s*.+/i, `SPUL_CONFIDENCE: ${confidence}`);
  }
  return out;
}

/** When URL is locked, Groq should only fill ACTIONS + CONTEXT (no duplicate URL line). */
function buildLockedUrlPrefix(lockedUrl, confidence, entity) {
  return [
    `SPUL_URL: ${lockedUrl}`,
    `SPUL_ENTITY: ${entity || 'Property tax search'}`,
    `SPUL_CONFIDENCE: ${confidence || 'verified'}`,
    'SPUL_ACTIONS:'
  ].join('\n');
}

module.exports = {
  compactJurisdictionName,
  isGoogleFallbackUrl,
  isRealHttpUrl,
  isGenericCountyHomepage,
  hasUrlLock,
  enforceLockedSpulUrl,
  buildLockedUrlPrefix
};
