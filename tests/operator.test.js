'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const store = require('../src/db/store');
const accounts = require('../src/db/accounts');
const extractors = require('../src/db/extractors');
const operator = require('../src/services/operator');
const { app } = require('../src/server');

describe('central operator and shared county agents', () => {
  let server;
  let base;

  before(async () => {
    await store.init();
    extractors.resetMemory();
    accounts.resetMemory();
    server = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    base = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    if (server) await new Promise((r) => server.close(r));
    await store.close();
  });

  async function confirmedToken(email) {
    const res = await fetch(`${base}/api/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        display_name: 'Agent User',
        email,
        password: 'webpoint1'
      })
    });
    const created = await res.json();
    const ver = await fetch(`${base}/api/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: created.confirm_token })
    });
    return (await ver.json()).token;
  }

  it('routes Chippewa to a persistent county agent', async () => {
    const routed = await operator.dispatch({ q: 'Chippewa County WI parcel 12-345-6-789' });
    assert.equal(routed.ok, true);
    assert.equal(routed.operator, 'central');
    assert.match(routed.routed_to, /WI-Chippewa/i);
    assert.equal(routed.agent.role, 'county_agent');
    assert.ok(routed.agent.parcel_format);
  });

  it('shares a discovered parcel format with the next user of that county', async () => {
    const a = await confirmedToken(`bill.op.a.${Date.now()}@webpointllc.com`);
    const first = await fetch(`${base}/api/intelligence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Auth-Token': a },
      body: JSON.stringify({ q: 'Chippewa County WI APN 12-345-6-789' })
    });
    const one = await first.json();
    assert.equal(one.ok, true, JSON.stringify(one));
    assert.ok(one.agent.parcel_format);

    const b = await confirmedToken(`bill.op.b.${Date.now()}@webpointllc.com`);
    const second = await fetch(`${base}/api/intelligence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Auth-Token': b },
      body: JSON.stringify({ q: 'Chippewa County WI' })
    });
    const two = await second.json();
    assert.equal(two.ok, true, JSON.stringify(two));
    assert.equal(two.agent.parcel_format, one.agent.parcel_format);
    assert.equal(two.operator.routed_to, one.operator.routed_to);
  });
});
