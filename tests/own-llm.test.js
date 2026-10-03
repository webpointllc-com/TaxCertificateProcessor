'use strict';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const llm = require('../src/services/llm');
const store = require('../src/db/store');
const accounts = require('../src/db/accounts');
const training = require('../src/db/training');
const { app } = require('../src/server');

const ENV_KEYS = [
  'WEBPOINT_LLM_URL',
  'WEBPOINT_LLM_KEY',
  'WEBPOINT_MODEL',
  'WEBPOINT_TIMEOUT_MS',
  'GROQ_API_KEY',
  'GROQ_BASE_URL',
  'ANTHROPIC_API_KEY',
  'MODEL_PROVIDER'
];

function withEnv(vars, fn) {
  const saved = {};
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  for (const k of ENV_KEYS) delete process.env[k];
  Object.assign(process.env, vars);
  const restore = () => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  };
  let out;
  try {
    out = fn();
  } catch (err) {
    restore();
    throw err;
  }
  if (out && typeof out.then === 'function') return out.finally(restore);
  restore();
  return out;
}

// Minimal OpenAI-compatible server: mode 'ok' answers, 'fail' returns 500, 'stream' sends SSE.
function fakeOpenAI(mode, reply) {
  const calls = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const parsed = body ? JSON.parse(body) : {};
      calls.push({ path: req.url, body: parsed, auth: req.headers.authorization });
      if (mode === 'fail') {
        res.writeHead(500, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ error: { message: 'worker down' } }));
      }
      if (parsed.stream) {
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        for (const word of reply.split(' ')) {
          res.write(`data: ${JSON.stringify({ id: 'x', object: 'chat.completion.chunk', created: 0, model: parsed.model, choices: [{ index: 0, delta: { content: word + ' ' }, finish_reason: null }] })}\n\n`);
        }
        res.write('data: [DONE]\n\n');
        return res.end();
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          id: 'x',
          object: 'chat.completion',
          created: 0,
          model: parsed.model,
          choices: [{ index: 0, message: { role: 'assistant', content: reply }, finish_reason: 'stop' }]
        })
      );
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, calls, url: `http://127.0.0.1:${server.address().port}/v1` });
    });
  });
}

describe('own model provider chain', () => {
  it('puts our model first when the endpoint is configured', () => {
    withEnv({ WEBPOINT_LLM_URL: 'http://x/v1', WEBPOINT_LLM_KEY: 'rp_test', GROQ_API_KEY: 'gsk', ANTHROPIC_API_KEY: 'sk-ant' }, () => {
      assert.deepEqual(llm.providerChain(), ['webpoint', 'groq', 'anthropic']);
      assert.equal(llm.pickProvider(), 'webpoint');
      assert.equal(llm.status().model, 'webpoint');
      assert.equal(llm.pickProvider({ heavy: true }), 'anthropic');
    });
  });

  it('MODEL_PROVIDER=webpoint keeps heavy work on our model too', () => {
    withEnv({ WEBPOINT_LLM_URL: 'http://x/v1', WEBPOINT_LLM_KEY: 'rp_test', ANTHROPIC_API_KEY: 'sk-ant', MODEL_PROVIDER: 'webpoint' }, () => {
      assert.equal(llm.pickProvider({ heavy: true }), 'webpoint');
    });
  });

  it('needs both URL and key before it counts as configured', () => {
    withEnv({ WEBPOINT_LLM_URL: 'http://x/v1', GROQ_API_KEY: 'gsk' }, () => {
      assert.equal(llm.webpointEnabled(), false);
      assert.equal(llm.pickProvider(), 'groq');
    });
  });

  it('answers from our model and sends the adapter name as the model', async () => {
    const own = await fakeOpenAI('ok', 'Chippewa uses LandNav guest sign in.');
    try {
      await withEnv({ WEBPOINT_LLM_URL: own.url, WEBPOINT_LLM_KEY: 'rp_test', WEBPOINT_MODEL: 'webpoint-v3' }, async () => {
        const out = await llm.complete({ messages: [{ role: 'user', content: 'Chippewa WI' }] });
        assert.equal(out.ok, true);
        assert.equal(out.provider, 'webpoint');
        assert.equal(out.model, 'webpoint-v3');
        assert.match(out.text, /LandNav/);
        assert.equal(own.calls[0].body.model, 'webpoint-v3');
        assert.equal(own.calls[0].auth, 'Bearer rp_test');
      });
    } finally {
      own.server.close();
    }
  });

  it('falls back to Groq when our endpoint fails, so users never see the outage', async () => {
    const own = await fakeOpenAI('fail');
    const groq = await fakeOpenAI('ok', 'fallback answer');
    try {
      await withEnv(
        { WEBPOINT_LLM_URL: own.url, WEBPOINT_LLM_KEY: 'rp_test', GROQ_API_KEY: 'gsk', GROQ_BASE_URL: groq.url },
        async () => {
          const out = await llm.complete({ messages: [{ role: 'user', content: 'hi' }] });
          assert.equal(out.ok, true);
          assert.equal(out.provider, 'groq');
          assert.equal(out.text, 'fallback answer');
          assert.equal(own.calls.length, 1);
        }
      );
    } finally {
      own.server.close();
      groq.server.close();
    }
  });

  it('streams from our model', async () => {
    const own = await fakeOpenAI('stream', 'one two three');
    try {
      await withEnv({ WEBPOINT_LLM_URL: own.url, WEBPOINT_LLM_KEY: 'rp_test' }, async () => {
        assert.equal(llm.streamEnabled(), true);
        const opened = await llm.stream({ messages: [{ role: 'user', content: 'hi' }] });
        assert.equal(opened.provider, 'webpoint');
        let text = '';
        for await (const chunk of opened.stream) text += chunk.choices[0]?.delta?.content || '';
        assert.equal(text.trim(), 'one two three');
      });
    } finally {
      own.server.close();
    }
  });

  it('stream fails over to Groq at open time', async () => {
    const own = await fakeOpenAI('fail');
    const groq = await fakeOpenAI('stream', 'groq words');
    try {
      await withEnv(
        { WEBPOINT_LLM_URL: own.url, WEBPOINT_LLM_KEY: 'rp_test', GROQ_API_KEY: 'gsk', GROQ_BASE_URL: groq.url },
        async () => {
          const opened = await llm.stream({ messages: [{ role: 'user', content: 'hi' }] });
          assert.equal(opened.provider, 'groq');
        }
      );
    } finally {
      own.server.close();
      groq.server.close();
    }
  });
});

describe('consent-gated training data', () => {
  let n = 0;
  async function makeAccount(consent) {
    n += 1;
    const res = await accounts.signup({
      email: `train${n}-${Date.now()}@example.com`,
      password: 'correct-horse-9',
      display_name: 'Train Tester'
    });
    assert.equal(res.ok, true);
    await accounts.updateAccount(res.account.id, { learn_consent: consent });
    return accounts.findById(res.account.id);
  }
  const sample = {
    route: 'chat',
    jurisdictionKey: 'WI-Chippewa',
    messages: [
      { role: 'system', content: 'You are the WebPoint operator.' },
      { role: 'user', content: 'Chippewa County WI taxes' }
    ],
    reply: 'Use the LandNav guest sign in.',
    model: 'webpoint'
  };

  before(async () => {
    await store.init();
  });
  beforeEach(() => training.resetMemory());

  it('captures nothing for anonymous users or accounts without consent', async () => {
    assert.equal(await training.capture({ ...sample, account: null }), null);
    const noConsent = await makeAccount(false);
    assert.equal(await training.capture({ ...sample, account: noConsent }), null);
    assert.equal((await training.stats()).total, 0);
  });

  it('captures and exports for consenting accounts', async () => {
    const yes = await makeAccount(true);
    const row = await training.capture({ ...sample, account: yes });
    assert.ok(row && row.id);
    assert.equal((await training.exportExamples()).length, 0, 'unreviewed rows never train');
    assert.equal((await training.review({ exampleId: row.id, action: 'approve', reviewer: 'bill' })).ok, true);
    const rows = await training.exportExamples();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].reply, sample.reply);
    assert.equal(rows[0].account_id, undefined, 'export must not carry account ids');
  });

  it('drops an account from export the moment it turns learning off', async () => {
    const acct = await makeAccount(true);
    const row = await training.capture({ ...sample, account: acct });
    await training.review({ exampleId: row.id, action: 'approve', reviewer: 'bill' });
    assert.equal((await training.exportExamples()).length, 1);
    await accounts.updateAccount(acct.id, { learn_consent: false });
    assert.equal((await training.exportExamples()).length, 0);
  });

  it('keeps thumbs-down answers out of training', async () => {
    const acct = await makeAccount(true);
    const row = await training.capture({ ...sample, account: acct });
    await training.review({ exampleId: row.id, action: 'approve', reviewer: 'bill' });
    assert.equal(await training.rate({ accountId: acct.id, exampleId: row.id, rating: -1 }), true);
    assert.equal((await training.exportExamples()).length, 0);
  });

  it('will not let one account rate another account answer', async () => {
    const a = await makeAccount(true);
    const b = await makeAccount(true);
    const row = await training.capture({ ...sample, account: a });
    assert.equal(await training.rate({ accountId: b.id, exampleId: row.id, rating: -1 }), false);
  });

  it('forgetAccount removes every row for that account', async () => {
    const acct = await makeAccount(true);
    await training.capture({ ...sample, account: acct });
    await training.capture({ ...sample, account: acct });
    assert.equal(await training.forgetAccount(acct.id), 2);
    assert.equal((await training.stats()).total, 0);
  });

  it('drops 90-day-old examples when retention is 90d', async () => {
    const acct = await makeAccount(true);
    await accounts.updateAccount(acct.id, { training_retention: '90d' });
    const aged = await accounts.findById(acct.id);
    const old = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
    await training.capture({ ...sample, account: aged, createdAt: old });
    const fresh = await training.capture({ ...sample, account: aged });
    await training.review({ exampleId: fresh.id, action: 'approve', reviewer: 'bill' });
    assert.equal(await training.purgeExpired(), 1);
    assert.equal((await training.stats()).total, 1);
    assert.equal((await training.exportExamples()).length, 1);
  });

  it('drops 1-year-old examples when retention is 1y and keeps newer ones', async () => {
    const acct = await makeAccount(true);
    await accounts.updateAccount(acct.id, { training_retention: '1y' });
    const aged = await accounts.findById(acct.id);
    const ancient = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString();
    const mid = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString();
    await training.capture({ ...sample, account: aged, createdAt: ancient });
    const kept = await training.capture({ ...sample, account: aged, createdAt: mid });
    await training.review({ exampleId: kept.id, action: 'approve', reviewer: 'bill' });
    assert.equal(await training.purgeExpired(), 1);
    assert.equal((await training.exportExamples()).length, 1);
  });

  it('keeps old examples when retention is until_delete', async () => {
    const acct = await makeAccount(true);
    await accounts.updateAccount(acct.id, { training_retention: 'until_delete' });
    const aged = await accounts.findById(acct.id);
    const old = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString();
    const oldRow = await training.capture({ ...sample, account: aged, createdAt: old });
    await training.review({ exampleId: oldRow.id, action: 'approve', reviewer: 'bill' });
    assert.equal(await training.purgeExpired(), 0);
    assert.equal((await training.exportExamples()).length, 1);
  });
});

describe('training rate route', () => {
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

  async function signedIn() {
    const created = await (
      await fetch(`${base}/api/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `rate.${Date.now()}.${Math.random().toString(16).slice(2)}@example.com`,
          password: 'correct-horse-9'
        })
      })
    ).json();
    const verified = await (
      await fetch(`${base}/api/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: created.confirm_token })
      })
    ).json();
    const token = verified.token;
    await fetch(`${base}/api/consent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Auth-Token': token },
      body: JSON.stringify({ learn_consent: true })
    });
    return {
      token,
      account: verified.account,
      headers: { 'Content-Type': 'application/json', 'X-Auth-Token': token }
    };
  }

  it('requires sign in', async () => {
    const res = await fetch(`${base}/v1/training/rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ training_example_id: 'x', rating: 1 })
    });
    assert.equal(res.status, 401);
  });

  it('health reports training counts', async () => {
    const body = await (await fetch(`${base}/v1/health`)).json();
    assert.equal(typeof body.training.total, 'number');
    assert.equal(body.llm.webpoint, false);
  });

  it('search JSON carries training_example_id', async () => {
    const { headers } = await signedIn();
    const res = await fetch(`${base}/api/intelligence`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ q: 'Chippewa County WI' })
    });
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.ok('training_example_id' in body);
  });

  it('chat JSON carries training_example_id for a consenting member', async () => {
    training.resetMemory();
    const { headers } = await signedIn();
    const res = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ message: 'Chippewa County WI pay property taxes' })
    });
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.mode, 'database');
    assert.ok(body.training_example_id);
    const rate = await fetch(`${base}/v1/training/rate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ training_example_id: body.training_example_id, rating: 1 })
    });
    const rated = await rate.json();
    assert.equal(rate.status, 200);
    assert.equal(rated.ok, true);
    assert.equal(rated.training_example_id, body.training_example_id);
    assert.equal(rated.rating, 1);
  });

  it('chat SSE done event carries training_example_id', async () => {
    training.resetMemory();
    const own = await fakeOpenAI('stream', 'Use LandNav guest sign in');
    const { headers } = await signedIn();
    try {
      await withEnv({ WEBPOINT_LLM_URL: own.url, WEBPOINT_LLM_KEY: 'rp_test' }, async () => {
        const res = await fetch(`${base}/api/chat`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ message: 'Chippewa County WI' })
        });
        assert.match(res.headers.get('content-type') || '', /text\/event-stream/);
        const text = await res.text();
        const events = text
          .split('\n')
          .filter((line) => line.startsWith('data: '))
          .map((line) => JSON.parse(line.slice(6)));
        const done = events.find((ev) => ev.type === 'done');
        assert.ok(done);
        assert.ok(done.training_example_id);
      });
    } finally {
      own.server.close();
    }
  });

  it('Delete my data calls training.forgetAccount for that account', async () => {
    training.resetMemory();
    const { headers, token } = await signedIn();
    const me = await (await fetch(`${base}/api/me`, { headers: { 'X-Auth-Token': token } })).json();
    const acct = await accounts.findById(me.account.id);
    acct.learn_consent = true;
    await training.capture({
      account: acct,
      route: 'chat',
      jurisdictionKey: 'WI-Chippewa',
      messages: [{ role: 'user', content: 'Chippewa WI' }],
      reply: 'LandNav guest sign in.'
    });
    assert.equal((await training.stats()).total, 1);
    const res = await fetch(`${base}/api/account/delete-data`, { method: 'POST', headers });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.forgotten, 1);
    assert.equal((await training.stats()).total, 0);
  });
});

describe('training export', () => {
  const { scrub, isEval, toExample } = require('../scripts/export-training');

  it('masks emails, phones and SSN-shaped strings', () => {
    const out = scrub('Call 715-726-7920 or (715) 726 7920, mail jo.smith@county.gov, ssn 123-45-6789');
    assert.doesNotMatch(out, /726|county\.gov|6789/);
    assert.match(out, /\[phone\].*\[phone\].*\[email\].*\[ssn\]/);
  });

  it('keeps parcel numbers and collector URLs intact', () => {
    const text = 'Parcel 022-1234-5678 at https://pp-chippewa-co-wi-fb.app.landnav.com/login/index/';
    assert.equal(scrub(text), text);
  });

  it('puts the same row in the same split every run, about 5% eval', () => {
    assert.equal(isEval('abc'), isEval('abc'));
    let evalCount = 0;
    for (let i = 0; i < 4000; i += 1) if (isEval(`row-${i}`)) evalCount += 1;
    assert.ok(evalCount > 120 && evalCount < 280, `eval share off: ${evalCount}`);
  });

  it('appends the reply as the assistant turn', () => {
    const ex = toExample({
      id: '1',
      route: 'chat',
      jurisdiction_key: 'WI-Chippewa',
      messages: [{ role: 'user', content: 'hi' }],
      reply: 'hello'
    });
    assert.deepEqual(ex.messages.map((m) => m.role), ['user', 'assistant']);
    assert.equal(ex.meta.jurisdiction_key, 'WI-Chippewa');
  });
});


describe('editor protocol', () => {
  let n = 0;
  async function consenting() {
    n += 1;
    const res = await accounts.signup({ email: `editor${n}-${Date.now()}@example.com`, password: 'correct-horse-9', display_name: 'Ed Tester' });
    await accounts.updateAccount(res.account.id, { learn_consent: true });
    return accounts.findById(res.account.id);
  }
  const base = {
    route: 'chat',
    jurisdictionKey: 'WI-Chippewa',
    messages: [{ role: 'user', content: 'How do I search Chippewa County WI?' }],
    reply: 'Go to https://made-up.example.com',
    model: 'webpoint'
  };

  before(async () => { await store.init(); });
  beforeEach(() => training.resetMemory());

  it('an edited answer trains with the fix, not the original', async () => {
    const row = await training.capture({ ...base, account: await consenting() });
    const out = await training.review({ exampleId: row.id, action: 'edit', correctedReply: 'Use the LandNav guest sign in.', reviewer: 'bill' });
    assert.equal(out.ok, true);
    const rows = await training.exportExamples();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].reply, 'Use the LandNav guest sign in.');
  });

  it('a fix can rescue a thumbs-down answer', async () => {
    const acct = await consenting();
    const row = await training.capture({ ...base, account: acct });
    await training.rate({ accountId: acct.id, exampleId: row.id, rating: -1 });
    await training.review({ exampleId: row.id, action: 'edit', correctedReply: 'Use the LandNav guest sign in.', reviewer: 'bill' });
    assert.equal((await training.exportExamples()).length, 1);
  });

  it('rejected answers never train', async () => {
    const row = await training.capture({ ...base, account: await consenting() });
    await training.review({ exampleId: row.id, action: 'reject', reviewer: 'bill' });
    assert.equal((await training.exportExamples()).length, 0);
  });

  it('Claude can flag with a suggested fix but cannot approve', async () => {
    const row = await training.capture({ ...base, account: await consenting() });
    const denied = await training.review({ exampleId: row.id, action: 'approve', role: 'claude' });
    assert.equal(denied.ok, false);
    assert.equal(denied.status, 403);
    const flagged = await training.review({ exampleId: row.id, action: 'flag', correctedReply: 'Use LandNav.', note: 'invented URL', role: 'claude' });
    assert.equal(flagged.ok, true);
    assert.equal(flagged.example.review_status, 'flagged');
    assert.equal((await training.exportExamples()).length, 0, 'a flag never trains');
    const queue = await training.reviewQueue({ status: 'open' });
    assert.equal(queue[0].corrected_reply, 'Use LandNav.');
    assert.equal(queue[0].account_id, undefined, 'editors never see account ids');
  });

  it('thumbs-down and flagged answers come first in the queue', async () => {
    const acct = await consenting();
    const a = await training.capture({ ...base, account: acct });
    const b = await training.capture({ ...base, account: acct });
    await training.rate({ accountId: acct.id, exampleId: b.id, rating: -1 });
    const queue = await training.reviewQueue({ status: 'open' });
    assert.equal(queue[0].id, b.id);
    assert.equal(queue[1].id, a.id);
  });

  it('stats count what is ready to train', async () => {
    const row = await training.capture({ ...base, account: await consenting() });
    await training.review({ exampleId: row.id, action: 'approve', reviewer: 'bill' });
    const s = await training.reviewStats();
    assert.equal(s.approved, 1);
    assert.equal(s.trainable, 1);
  });
});

describe('editor routes', () => {
  let server;
  let baseUrl;
  const saved = {};
  before(async () => {
    for (const k of ['EDITOR_KEY', 'CLAUDE_REVIEW_KEY', 'EDITOR_EMAILS']) saved[k] = process.env[k];
    process.env.EDITOR_KEY = 'human-test-key';
    process.env.CLAUDE_REVIEW_KEY = 'claude-test-key';
    delete process.env.EDITOR_EMAILS;
    await store.init();
    server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });
  after(async () => {
    for (const k of Object.keys(saved)) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
    if (server) await new Promise((r) => server.close(r));
    await store.close();
  });

  it('is closed without a key', async () => {
    const res = await fetch(`${baseUrl}/v1/editor/queue`);
    assert.equal(res.status, 403);
  });

  it('rejects a wrong key', async () => {
    const res = await fetch(`${baseUrl}/v1/editor/queue`, { headers: { 'x-editor-key': 'nope' } });
    assert.equal(res.status, 403);
  });

  it('tells the page which role the key has', async () => {
    const human = await (await fetch(`${baseUrl}/v1/editor/queue`, { headers: { 'x-editor-key': 'human-test-key' } })).json();
    assert.equal(human.role, 'human');
    const claude = await (await fetch(`${baseUrl}/v1/editor/queue`, { headers: { 'x-editor-key': 'claude-test-key' } })).json();
    assert.equal(claude.role, 'claude');
  });

  it('blocks Claude from approving over HTTP', async () => {
    const res = await fetch(`${baseUrl}/v1/editor/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-editor-key': 'claude-test-key' },
      body: JSON.stringify({ example_id: 'x', action: 'approve' })
    });
    assert.equal(res.status, 403);
  });

  it('serves the editor page', async () => {
    const res = await fetch(`${baseUrl}/editor.html`);
    assert.equal(res.status, 200);
    assert.match(await res.text(), /WebPoint Editor/);
  });
});
