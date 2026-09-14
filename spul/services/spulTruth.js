'use strict';

function isGoogleFallbackUrl(url) {
  return typeof url === 'string' && (/google\.com\/search/i.test(url) || /\/\/www\.google\.com\/?$/i.test(url));
}

function isRealHttpUrl(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url) && !isGoogleFallbackUrl(url);
}

function hasUrlLock(confidence, url) {
  return (
    (confidence === 'high' || confidence === 'medium' || confidence === 'verified' || confidence === 'pattern_matched') &&
    isRealHttpUrl(url)
  );
}

/**
 * Hard-lock: rewrite any invented SPUL_URL back to the registry URL.
 */
function enforceLockedSpulUrl(responseText, lockedUrl, confidence) {
  if (!lockedUrl || !responseText) return responseText;
  let out = String(responseText);
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

function buildLockedUrlPrefix(lockedUrl, confidence, entity) {
  return [
    `SPUL_URL: ${lockedUrl}`,
    `SPUL_ENTITY: ${entity || 'Property tax search'}`,
    `SPUL_CONFIDENCE: ${confidence || 'verified'}`,
    'SPUL_ACTIONS:',
  ].join('\n');
}

module.exports = {
  isGoogleFallbackUrl,
  isRealHttpUrl,
  hasUrlLock,
  enforceLockedSpulUrl,
  buildLockedUrlPrefix,
};
