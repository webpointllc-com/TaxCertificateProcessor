'use strict';

/**
 * PAT agreement for a county portal session.
 * Same shape as a scoped personal-access token: prefix, secret shown once, SHA-256 at rest,
 * expiry, scopes. Issued only after a signed-in user clicks Open official tax search.
 * This is presence proof for /api/extractors/session — not a Cloudflare bypass,
 * and not a forged biometric / WebAuthn assertion.
 */

const crypto = require('crypto');

const PREFIX = 'wptpat_';
const SCOPES = ['portal_session', 'look_for'];
const TTL_MS = 24 * 60 * 60 * 1000;

function hash(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function mint({ sessionId, accountId, jurisdictionKey, familyId, lookFor } = {}) {
  const nonce = crypto.randomBytes(18).toString('base64url');
  const exp = Date.now() + TTL_MS;
  const claims = {
    v: 1,
    sid: String(sessionId || '').slice(0, 80),
    aid: accountId || null,
    key: jurisdictionKey || '',
    fam: familyId || '',
    lf: Array.isArray(lookFor) ? lookFor.slice(0, 8) : [],
    exp
  };
  const packed = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const token = `${PREFIX}${packed}.${nonce}`;
  return {
    token,
    token_hash: hash(token),
    prefix: PREFIX,
    scopes: SCOPES,
    expires_at: new Date(exp).toISOString(),
    claims
  };
}

function publicHandle(issued) {
  if (!issued) return null;
  return {
    prefix: issued.prefix || PREFIX,
    token: issued.token,
    expires_at: issued.expires_at,
    scopes: issued.scopes || SCOPES,
    family: issued.claims && issued.claims.fam,
    jurisdictionKey: issued.claims && issued.claims.key,
    openIn: 'user_chrome_tab',
    note: 'Signed-in user opened the collector in their own Chrome tab. Store the token for this tab only. Do not mint a fake biometric.'
  };
}

function matchesHash(token, tokenHash) {
  if (!token || !tokenHash || !String(token).startsWith(PREFIX)) return false;
  const got = Buffer.from(hash(token), 'hex');
  const want = Buffer.from(String(tokenHash), 'hex');
  if (got.length !== want.length) return false;
  return crypto.timingSafeEqual(got, want);
}

module.exports = {
  PREFIX,
  SCOPES,
  hash,
  mint,
  publicHandle,
  matchesHash
};
