'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const vendorFamily = require('../src/services/vendorFamily');
const portalAccessToken = require('../src/services/portalAccessToken');
const { handshake } = require('../src/services/siteValidator');
const { pickTargets } = require('../scripts/validate-extractors');

describe('vendor family matrix', () => {
  it('treats 296 shared SignatureInfo homepages as a hub, not mass locks', () => {
    const hit = vendorFamily.classify('https://lots.signatureinfo.com/', 296);
    assert.equal(hit.family, 'nj_signature_lots');
    assert.equal(hit.kind, 'hub');
    assert.equal(hit.specificity, 0);
    assert.equal(hit.lockable, false);
  });

  it('locks Delta AL county paths and Benton AR county query, not the AR homepage', () => {
    const delta = vendorFamily.classify('http://www.deltacomputersystems.com/AL/AL08/', 1);
    assert.equal(delta.family, 'al_delta');
    assert.equal(delta.kind, 'collector');
    assert.ok(delta.specificity >= 2);
    assert.equal(delta.lockable, true);
    const benton = vendorFamily.classify('https://www.arcountydata.com/propsearch.asp?county=Benton', 1);
    assert.equal(benton.lockable, true);
    const hub = vendorFamily.classify('http://www.arcountydata.com/', 50);
    assert.equal(hub.lockable, false);
  });

  it('never promotes assessor SaaS to collector', () => {
    const beacon = vendorFamily.classify('https://beacon.schneidercorp.com/', 8);
    const cad = vendorFamily.classify('http://propaccess.trueautomation.com/clientdb/', 40);
    assert.equal(beacon.kind, 'assessor');
    assert.equal(cad.kind, 'assessor');
    assert.equal(beacon.lockable, false);
    assert.equal(cad.lockable, false);
  });

  it('collapses thousands of extractor rows into far fewer families', () => {
    const dump = require('../data/extractor_urls.json');
    const groups = vendorFamily.groupRows(dump.rows);
    assert.ok(groups.length < dump.rows.length / 2, groups.length);
    const sig = groups.find((g) => g.family === 'nj_signature_lots');
    assert.ok(sig.keys >= 200);
    assert.equal(sig.uniqueUrls, 1);
  });
});

describe('portal access token PAT agreement', () => {
  it('mints a hashed wptpat_ token and does not pretend to be a biometric', () => {
    const issued = portalAccessToken.mint({
      sessionId: 's1',
      accountId: 'a1',
      jurisdictionKey: 'FL-Clay',
      familyId: 'govos_county_taxes',
      lookFor: ['Parcel Number']
    });
    assert.match(issued.token, /^wptpat_/);
    assert.equal(portalAccessToken.matchesHash(issued.token, issued.token_hash), true);
    assert.equal(portalAccessToken.matchesHash('wptpat_nope.nope', issued.token_hash), false);
    const pub = portalAccessToken.publicHandle(issued);
    assert.deepEqual(pub.scopes, ['portal_session', 'look_for']);
    assert.equal(pub.openIn, 'user_chrome_tab');
    assert.doesNotMatch(JSON.stringify({ issued, pub }), /webauthn|passkey|fingerprint|cf_clearance|bypass/i);
  });

  it('handshake still opens a real user Chrome tab', () => {
    const shake = handshake({
      lookup: {
        key: 'FL-Clay',
        officialUrl: 'https://clay.county-taxes.com/public',
        urlLocked: true
      },
      sessionId: 's1'
    });
    assert.equal(shake.openIn, 'user_chrome_tab');
    assert.equal(shake.pat.prefix, 'wptpat_');
    assert.equal(shake.family, 'govos_county_taxes');
    assert.doesNotMatch(JSON.stringify(shake), /bypass|spoof|solve/i);
  });

  it('unique-URL validator still covers the 2k+ dump', () => {
    const targets = pickTargets();
    const keys = targets.reduce((n, t) => n + (t.keys ? t.keys.length : 1), 0);
    assert.ok(keys >= 2000, keys);
  });
});
