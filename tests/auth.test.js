'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const store = require('../src/db/store');
const accounts = require('../src/db/accounts');
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
      body: JSON.stringify({ display_name: 'B', email: 'nope' })
    });
    assert.equal(res.status, 400);
    assert.equal(body.ok, false);
  });

  it('creates an account and requires the emailed 6-digit code', async () => {
    const { res, body } = await json('/api/signup', {
      method: 'POST',
      body: JSON.stringify({
        display_name: 'Bill McCreary',
        email,
        company: 'WebPoint LLC'
      })
    });
    assert.equal(res.status, 201);
    assert.equal(body.ok, true);
    assert.equal(body.needs_code, true);
    assert.equal(body.account.email, email);
    assert.equal(body.account.display_name, 'Bill McCreary');
    assert.equal(body.account.initial, 'B');
    assert.equal(body.account.plan, 'free');
    assert.equal(body.token, undefined);
    assert.equal(body.account.password_hash, undefined);
    assert.match(String(body.code || ''), /^\d{6}$/);

    const verified = await json('/api/verify', {
      method: 'POST',
      body: JSON.stringify({ email, code: body.code, purpose: 'signup' })
    });
    assert.equal(verified.body.ok, true);
    assert.ok(verified.body.token);
    assert.equal(verified.body.account.email_verified, true);
    token = verified.body.token;
  });

  it('refuses a duplicate email', async () => {
    const { res, body } = await json('/api/signup', {
      method: 'POST',
      body: JSON.stringify({
        display_name: 'Bill McCreary',
        email
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

  it('logs in by emailing a 6-digit code, not a magic link', async () => {
    const { res, body } = await json('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
    assert.equal(res.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.needs_code, true);
    assert.ok(body.code);
    const verified = await json('/api/verify', {
      method: 'POST',
      body: JSON.stringify({ email, code: body.code, purpose: 'login' })
    });
    assert.equal(verified.body.ok, true);
    assert.ok(verified.body.token);
    token = verified.body.token;
  });

  it('rejects a wrong verification code', async () => {
    await json('/api/login', { method: 'POST', body: JSON.stringify({ email }) });
    const { res, body } = await json('/api/verify', {
      method: 'POST',
      body: JSON.stringify({ email, code: '000000', purpose: 'login' })
    });
    assert.equal(res.status, 400);
    assert.match(body.error, /match|code/i);
  });

  it('lets a guest run one intelligence search, then asks for an account', async () => {
    const sid = `guest-${Date.now()}`;
    const first = await json('/api/intelligence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Session-Id': sid },
      body: JSON.stringify({ q: 'Chippewa County WI' })
    });
    assert.equal(first.body.ok, true, JSON.stringify(first.body));
    assert.equal(first.body.plan, 'guest');
    assert.equal(first.body.continue_gate, 'account');

    const second = await json('/api/intelligence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Session-Id': sid },
      body: JSON.stringify({ q: 'Los Angeles County CA' })
    });
    assert.equal(second.res.status, 402);
    assert.equal(second.body.gate, 'account');
  });

  it('requires a member code for certificate batches', async () => {
    const { res } = await json('/api/orders', {
      method: 'POST',
      headers: { 'X-Auth-Token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        county: 'Chippewa',
        state: 'WI',
        parcels: [{ parcel_id: '1' }]
      })
    });
    assert.equal(res.status, 402);
  });

  it('unlocks members with a shop code and issues a TCS draft', async () => {
    const issued = await accounts.issueMemberCode({ label: 'WebPoint test shop', seats: 5 });
    assert.match(issued.code, /^WP-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    const redeemed = await json('/api/member-code', {
      method: 'POST',
      headers: { 'X-Auth-Token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: issued.code })
    });
    assert.equal(redeemed.body.ok, true, JSON.stringify(redeemed.body));
    assert.equal(redeemed.body.account.plan, 'member');

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
