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
    const rows = await training.exportExamples();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].reply, sample.reply);
    assert.equal(rows[0].account_id, undefined, 'export must not carry account ids');
  });

  it('drops an account from export the moment it turns learning off', async () => {
    const acct = await makeAccount(true);
    await training.capture({ ...sample, account: acct });
    assert.equal((await training.exportExamples()).length, 1);
    await accounts.updateAccount(acct.id, { learn_consent: false });
    assert.equal((await training.exportExamples()).length, 0);
  });

  it('keeps thumbs-down answers out of training', async () => {
    const acct = await makeAccount(true);
    const row = await training.capture({ ...sample, account: acct });
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

  it('requires sign in', async () => {
    const res = await fetch(`${base}/v1/training/rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ example_id: 'x', rating: 1 })
    });
    assert.equal(res.status, 401);
  });

  it('health reports training counts', async () => {
    const body = await (await fetch(`${base}/v1/health`)).json();
    assert.equal(typeof body.training.total, 'number');
    assert.equal(body.llm.webpoint, false);
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
