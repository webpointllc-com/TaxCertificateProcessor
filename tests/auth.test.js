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

  it('derives the account name from email when signup is email and password only', async () => {
    const fresh = `jane.doe.${Date.now()}@webpointllc.com`;
    const { res, body } = await json('/api/signup', {
      method: 'POST',
      body: JSON.stringify({
        email: fresh,
        password: 'webpoint1'
      })
    });
    assert.equal(res.status, 201);
    assert.equal(body.ok, true);
    assert.equal(body.account.display_name, fresh.split('@')[0]);
    assert.equal(body.account.email_verified, false);
  });

  it('requires a password of 8+ characters', async () => {
    const { res, body } = await json('/api/signup', {
      method: 'POST',
      body: JSON.stringify({
        display_name: 'Bill McCreary',
        email: `bill.short.${Date.now()}@webpointllc.com`,
        password: 'short'
      })
    });
    assert.equal(res.status, 400);
    assert.match(body.error, /password/i);
  });

  it('creates an account and requires the emailed confirmation link', async () => {
    const { res, body } = await json('/api/signup', {
      method: 'POST',
      body: JSON.stringify({
        display_name: 'Bill McCreary',
        email,
        password: 'webpoint1',
        company: 'WebPoint LLC'
      })
    });
    assert.equal(res.status, 201);
    assert.equal(body.ok, true);
    assert.equal(body.needs_confirm, true);
    assert.equal(body.account.email, email);
    assert.equal(body.account.display_name, 'Bill McCreary');
    assert.equal(body.account.initial, 'B');
    assert.equal(body.account.plan, 'free');
    assert.equal(body.token, undefined);
    assert.equal(body.account.password_hash, undefined);
    assert.equal(body.account.email_verified, false);
    assert.match(String(body.confirm_token || ''), /^[a-f0-9]{32,}$/);
    assert.match(String(body.confirm_path || ''), /\/api\/confirm-email\?token=/);

    const verified = await json('/api/confirm', {
      method: 'POST',
      body: JSON.stringify({ token: body.confirm_token })
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
        email,
        password: 'webpoint1'
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

  it('logs in with email and password after the confirmation link', async () => {
    const { res, body } = await json('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: 'webpoint1' })
    });
    assert.equal(res.status, 200);
    assert.equal(body.ok, true);
    assert.ok(body.token);
    assert.equal(body.account.email, email);
    token = body.token;
  });

  it('rejects a wrong password', async () => {
    const { res, body } = await json('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: 'nope-nope' })
    });
    assert.equal(res.status, 401);
    assert.match(body.error, /incorrect/i);
  });

  it('redirects the confirmation link onto the app with a session', async () => {
    const fresh = `bill.link.${Date.now()}@webpointllc.com`;
    const created = await json('/api/signup', {
      method: 'POST',
      body: JSON.stringify({
        display_name: 'Link User',
        email: fresh,
        password: 'webpoint1'
      })
    });
    const res = await fetch(`${base}${created.body.confirm_path}`, { redirect: 'manual' });
    assert.equal(res.status, 302);
    const location = res.headers.get('location') || '';
    assert.match(location, /[?&]auth=/);
    assert.match(location, /confirmed=1/);
  });

  it('reports Google and Apple as unconnected until those keys are set', async () => {
    const google = await fetch(`${base}/api/auth/google/start`, { headers: { Accept: 'application/json' } });
    const apple = await fetch(`${base}/api/auth/apple/start`, { headers: { Accept: 'application/json' } });
    assert.equal(google.status, 501);
    assert.equal(apple.status, 501);
    const health = await json('/api/health');
    assert.equal(health.body.oauth.google, false);
    assert.equal(health.body.oauth.apple, false);
  });

  it('marks Google/Apple accounts verified without a confirmation link', async () => {
    const result = await accounts.upsertOAuth({
      email: `bill.oauth.${Date.now()}@gmail.com`,
      display_name: 'Bill Google',
      provider: 'google'
    });
    assert.equal(result.ok, true);
    assert.equal(result.account.email_verified, true);
    assert.ok(result.token);
  });

  it('requires sign-in before an intelligence search', async () => {
    const sid = `guest-${Date.now()}`;
    const first = await json('/api/intelligence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Session-Id': sid },
      body: JSON.stringify({ q: 'Chippewa County WI' })
    });
    assert.equal(first.res.status, 401);
    assert.equal(first.body.gate, 'account');
  });

  it('gives a confirmed account one free search, then asks for a shop code', async () => {
    const usedEmail = `bill.used.${Date.now()}@webpointllc.com`;
    const created = await json('/api/signup', {
      method: 'POST',
      body: JSON.stringify({
        display_name: 'Used Guest',
        email: usedEmail,
        password: 'webpoint1'
      })
    });
    const confirmed = await json('/api/confirm', {
      method: 'POST',
      body: JSON.stringify({ token: created.body.confirm_token })
    });
    assert.equal(confirmed.body.ok, true);
    const first = await json('/api/intelligence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Auth-Token': confirmed.body.token },
      body: JSON.stringify({ q: 'Chippewa County WI' })
    });
    assert.equal(first.body.ok, true, JSON.stringify(first.body));
    assert.equal(first.body.plan, 'free');
    assert.ok(first.body.task_id);
    assert.equal(first.body.operator.role, 'central');
    const follow = await json('/api/intelligence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Auth-Token': confirmed.body.token },
      body: JSON.stringify({ q: 'How do I search by owner?', task_id: first.body.task_id })
    });
    assert.equal(follow.body.ok, true, JSON.stringify(follow.body));
    assert.equal(follow.body.follow_up, true);
    const next = await json('/api/intelligence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Auth-Token': confirmed.body.token },
      body: JSON.stringify({ q: 'Los Angeles County CA' })
    });
    assert.equal(next.res.status, 402);
    assert.equal(next.body.gate, 'member');
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
