'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const store = require('../src/db/store');
const { app } = require('../src/server');

let server;
let base;

describe('HTTP API', () => {
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

  it('health reports TCS modules and Chippewa first county', async () => {
    const res = await fetch(`${base}/api/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.deepEqual(body.modules, ['TCS', 'TPA', 'RDS', 'SPUL']);
    assert.equal(body.firstCounty.county, 'Chippewa');
    assert.equal(body.db, 'memory');
    assert.equal(body.workplace.found, false);
  });

  it('lookup returns the Chippewa LandNav URL', async () => {
    const res = await fetch(`${base}/api/lookup?q=${encodeURIComponent('Chippewa County WI')}`);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.match(body.url, /landnav\.com/i);
  });

  it('rejects batches over 10 parcels', async () => {
    const parcels = Array.from({ length: 11 }, (_, i) => ({ parcel_id: 'P' + i }));
    const res = await fetch(`${base}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ county: 'Chippewa', state: 'WI', parcels })
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /10/);
  });

  it('issues a TCS draft for a Chippewa parcel', async () => {
    const res = await fetch(`${base}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product: 'TCS',
        file_number: 'TEST-1',
        county: 'Chippewa',
        state: 'WI',
        parcels: [{ parcel_id: '12-345-6-789', owner_name: 'Doe, Jane', address_line: '100 Bridge St' }]
      })
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.order.status, 'issued');
    assert.equal(body.certificates.length, 1);
    assert.match(body.certificates[0].collector_url, /landnav\.com/i);
  });

  it('database-mode chat returns locked SPUL fields without Groq', async () => {
    const res = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Session-Id': 'test-session' },
      body: JSON.stringify({ message: 'Chippewa County WI pay property taxes' })
    });
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.mode, 'database');
    assert.match(body.content, /SPUL_URL: https:\/\/pp-chippewa-co-wi-fb\.app\.landnav\.com/i);
  });
});
