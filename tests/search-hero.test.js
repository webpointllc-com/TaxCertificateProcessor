'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const store = require('../src/db/store');
const { app } = require('../src/server');
const { suggestJurisdictions, lookupForApi } = require('../src/services/urlFinder');

describe('hero search + official URL lock', () => {
  it('suggests Chippewa WI for a partial county query', () => {
    const hits = suggestJurisdictions('chip', 8);
    assert.ok(hits.length > 0);
    assert.ok(
      hits.some((h) => h.state === 'WI' && /chippewa/i.test(h.county)),
      JSON.stringify(hits)
    );
    const chip = hits.find((h) => h.state === 'WI' && /chippewa/i.test(h.county));
    assert.equal(chip.urlLocked, true);
  });

  it('exposes officialUrl for Chippewa and never a Google fallback', () => {
    const lookup = lookupForApi('Chippewa', 'WI');
    assert.equal(lookup.urlLocked, true);
    assert.equal(lookup.googleFallback, false);
    assert.match(lookup.officialUrl, /landnav\.com/i);
    assert.equal(lookup.officialUrl, lookup.lockedUrl);
  });
});

describe('hero search HTTP', () => {
  let server;
  let base;

  before(async () => {
    await store.init();
    server = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    base = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    if (server) await new Promise((r) => server.close(r));
    await store.close();
  });

  it('GET /api/suggest returns Chippewa for q=chippewa', async () => {
    const res = await fetch(`${base}/api/suggest?q=chippewa`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.ok(body.suggestions.some((s) => s.state === 'WI' && /chippewa/i.test(s.county)));
  });

  it('GET /api/hero-examples includes Chippewa', async () => {
    const res = await fetch(`${base}/api/hero-examples`);
    const body = await res.json();
    assert.ok(Array.isArray(body.examples));
    assert.ok(body.examples.some((ex) => /chippewa/i.test(ex)));
  });

  it('GET /api/lookup Chippewa includes officialUrl', async () => {
    const res = await fetch(`${base}/api/lookup?q=${encodeURIComponent('Chippewa County WI')}`);
    const body = await res.json();
    assert.equal(body.urlLocked, true);
    assert.match(body.officialUrl, /landnav\.com/i);
    assert.equal(body.googleFallback, false);
    assert.equal(body.jurisdiction.county, 'Chippewa');
    assert.equal(body.jurisdiction.state, 'WI');
  });
});
