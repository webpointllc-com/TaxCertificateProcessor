'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const store = require('../src/db/store');
const { app } = require('../src/server');

let server;
let base;
let token;
const stamp = Date.now();
const email = `bill.auth.${stamp}@webpointllc.com`;

async function json(path, opts) {
  const headers = Object.assign({ 'Content-Type': 'application/json' }, opts && opts.headers);
  const res = await fetch(`${base}${path}`, Object.assign({}, opts, { headers }));
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

describe('signup, session, account', () => {
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

  it('rejects a weak signup', async () => {
    const { res, body } = await json('/api/signup', {
      method: 'POST',
      body: JSON.stringify({ display_name: 'B', email: 'nope', password: 'short' })
    });
    assert.equal(res.status, 400);
    assert.equal(body.ok, false);
  });

  it('creates an account with email and password (no Apple)', async () => {
    const { res, body } = await json('/api/signup', {
      method: 'POST',
      body: JSON.stringify({
        display_name: 'Bill McCreary',
        email,
        company: 'WebPoint LLC',
        password: 'correct-horse-battery'
      })
    });
    assert.equal(res.status, 201);
    assert.equal(body.ok, true);
    assert.equal(body.account.email, email);
    assert.equal(body.account.display_name, 'Bill McCreary');
    assert.equal(body.account.initial, 'B');
    assert.ok(body.token);
    assert.equal(body.account.password_hash, undefined);
    token = body.token;
  });

  it('refuses a duplicate email', async () => {
    const { res, body } = await json('/api/signup', {
      method: 'POST',
      body: JSON.stringify({
        display_name: 'Bill McCreary',
        email,
        password: 'correct-horse-battery'
      })
    });
    assert.equal(res.status, 400);
    assert.match(body.error, /already/i);
  });

  it('returns the session on /api/me', async () => {
    const { res, body } = await json('/api/me', {
      headers: { 'X-Auth-Token': token }
    });
    assert.equal(res.status, 200);
    assert.equal(body.account.email, email);
  });

  it('logs in with the same email', async () => {
    const { res, body } = await json('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: 'correct-horse-battery' })
    });
    assert.equal(res.status, 200);
    assert.equal(body.ok, true);
    assert.ok(body.token);
    token = body.token;
  });

  it('rejects a wrong password without leaking which field failed', async () => {
    const { res, body } = await json('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: 'wrong-password-xx' })
    });
    assert.equal(res.status, 401);
    assert.match(body.error, /email or password/i);
  });

  it('requires auth to process a certificate batch', async () => {
    const { res } = await json('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        county: 'Chippewa',
        state: 'WI',
        parcels: [{ parcel_id: '1' }]
      })
    });
    assert.equal(res.status, 401);
  });

  it('issues a TCS draft for the signed-in account', async () => {
    const { res, body } = await json('/api/orders', {
      method: 'POST',
      headers: { 'X-Auth-Token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product: 'TCS',
        file_number: 'AUTH-1',
        county: 'Chippewa',
        state: 'WI',
        parcels: [{ parcel_id: '12-345-6-789', owner_name: 'Doe, Jane' }]
      })
    });
    assert.equal(res.status, 201);
    assert.equal(body.ok, true);
    const me = await json('/api/me', { headers: { 'X-Auth-Token': token } });
    assert.equal(body.order.account_id, me.body.account.id);
    assert.equal(body.certificates.length, 1);
  });

  it('stores recents, messages, and invites on the account', async () => {
    const auth = { 'X-Auth-Token': token, 'Content-Type': 'application/json' };
    const rec = await json('/api/recents', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ kind: 'search', label: 'Chippewa County WI', detail: 'Locked collector URL' })
    });
    assert.equal(rec.res.status, 201);

    const msg = await json('/api/messages', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ body: 'Need Chippewa certs for file AUTH-1' })
    });
    assert.equal(msg.res.status, 201);

    const inv = await json('/api/invites', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ email: 'colleague@titleco.com' })
    });
    assert.equal(inv.res.status, 201);

    const boot = await json('/api/account', { headers: { 'X-Auth-Token': token } });
    assert.equal(boot.body.ok, true);
    assert.ok(boot.body.recents.length >= 1);
    assert.ok(boot.body.messages.length >= 1);
    assert.ok(boot.body.invites.length >= 1);
    assert.ok(boot.body.updates.length >= 1);
  });

  it('saves settings including activity', async () => {
    const { body } = await json('/api/me', {
      method: 'PATCH',
      headers: { 'X-Auth-Token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ company: 'WebPoint Tax', activity_on: false })
    });
    assert.equal(body.ok, true);
    assert.equal(body.account.company, 'WebPoint Tax');
    assert.equal(body.account.activity_on, false);
  });
});
