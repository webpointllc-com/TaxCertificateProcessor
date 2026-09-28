'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const store = require('../src/db/store');
const accounts = require('../src/db/accounts');
const { app } = require('../src/server');
const { parseSearchQuery, resolveHealedUrl } = require('../src/services/searchIntelligence');
const { lookupForApi } = require('../src/services/urlFinder');

describe('search query parser', () => {
  it('reads Los Angeles County, CA, and an APN', () => {
    const parsed = parseSearchQuery('Los Angeles County · CA · APN 5587-012-034');
    assert.match(parsed.county, /los angeles/i);
    assert.equal(parsed.state, 'CA');
    assert.equal(parsed.apn, '5587-012-034');
  });
});

describe('extractor self-heal', () => {
  let server;
  let base;
  let token;

  before(async () => {
    await store.init();
    server = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    base = `http://127.0.0.1:${server.address().port}`;
    const res = await fetch(`${base}/api/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        display_name: 'Bill McCreary',
        email: `bill.heal.${Date.now()}@webpointllc.com`,
        password: 'webpoint1'
      })
    });
    const created = await res.json();
    const verified = await fetch(`${base}/api/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: created.confirm_token })
    });
    const body = await verified.json();
    token = body.token;
    const issued = await accounts.issueMemberCode({ label: 'heal shop', seats: 5 });
    await fetch(`${base}/api/member-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Auth-Token': token },
      body: JSON.stringify({ code: issued.code })
    });
  });

  after(async () => {
    if (server) await new Promise((r) => server.close(r));
    await store.close();
  });

  function auth(json) {
    const h = { 'X-Auth-Token': token };
    if (json) h['Content-Type'] = 'application/json';
    return h;
  }

  it('keeps a locked Chippewa URL when a different link is proposed', () => {
    const lookup = lookupForApi('Chippewa', 'WI');
    lookup.urlLocked = true;
    lookup.officialUrl = lookup.url;
    const decided = resolveHealedUrl(lookup, 'https://example.com/fake');
    assert.equal(decided.url, lookup.url);
    assert.equal(decided.rejected, true);
  });

  it('refuses heal until session learning is allowed', async () => {
    const res = await fetch(`${base}/api/extractors/heal`, {
      method: 'POST',
      headers: auth(true),
      body: JSON.stringify({
        q: 'Chippewa County WI',
        feedback: 'Use Guest Sign In on the LandNav portal'
      })
    });
    assert.equal(res.status, 403);
  });

  it('returns generative intelligence for a locked county and saves a healed extractor', async () => {
    await fetch(`${base}/api/consent`, {
      method: 'POST',
      headers: auth(true),
      body: JSON.stringify({ learn_consent: true })
    });
    const intel = await fetch(`${base}/api/intelligence`, {
      method: 'POST',
      headers: auth(true),
      body: JSON.stringify({ q: 'Los Angeles County CA APN 5587-012-034' })
    });
    const card = await intel.json();
    assert.equal(card.ok, true);
    assert.equal(card.parsed.apn, '5587-012-034');
    assert.match(card.lookup.officialUrl || card.lookup.url, /lacounty\.gov/i);
    assert.equal(card.card.verified, true);
    assert.equal(card.extractor.version, 1);

    const heal = await fetch(`${base}/api/extractors/heal`, {
      method: 'POST',
      headers: auth(true),
      body: JSON.stringify({
        q: 'Los Angeles County CA APN 5587-012-034',
        feedback: 'Search by APN on the LA County property tax portal; confirm amounts there.',
        proposed_url: 'https://evil.example/not-the-collector'
      })
    });
    const saved = await heal.json();
    assert.equal(saved.ok, true);
    assert.equal(saved.healed, true);
    assert.equal(saved.extractor.version, 2);
    assert.equal(saved.urlRejected, true);
    assert.match(saved.extractor.search_url, /lacounty\.gov/i);
  });
});
