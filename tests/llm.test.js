'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const llm = require('../src/services/llm');
const store = require('../src/db/store');
const { app } = require('../src/server');

describe('tiered LLM router', () => {
  it('stays on the locked database when no vendor keys are set', () => {
    assert.equal(llm.groqEnabled(), false);
    assert.equal(llm.anthropicEnabled(), false);
    assert.equal(llm.pickProvider(), 'none');
    assert.equal(llm.status().model, 'spul-db');
  });

  it('prefers Groq Llama 3.3 as the workhorse when MODEL_PROVIDER is auto', () => {
    const prevG = process.env.GROQ_API_KEY;
    const prevA = process.env.ANTHROPIC_API_KEY;
    const prevP = process.env.MODEL_PROVIDER;
    try {
      process.env.GROQ_API_KEY = 'gsk_test';
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
      process.env.MODEL_PROVIDER = 'auto';
      assert.equal(llm.pickProvider(), 'groq');
      assert.equal(llm.pickProvider({ heavy: true }), 'anthropic');
      process.env.MODEL_PROVIDER = 'groq';
      assert.equal(llm.pickProvider({ heavy: true }), 'groq');
    } finally {
      if (prevG) process.env.GROQ_API_KEY = prevG; else delete process.env.GROQ_API_KEY;
      if (prevA) process.env.ANTHROPIC_API_KEY = prevA; else delete process.env.ANTHROPIC_API_KEY;
      if (prevP) process.env.MODEL_PROVIDER = prevP; else delete process.env.MODEL_PROVIDER;
    }
  });
});

describe('TJOS v1 chat and feedback', () => {
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

  it('aliases /v1/chat onto the locked Chippewa database reply', async () => {
    const res = await fetch(`${base}/v1/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Session-Id': 'tjos-test' },
      body: JSON.stringify({ message: 'Chippewa County WI pay property taxes' })
    });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.mode, 'database');
    assert.match(body.content, /landnav\.com/i);
  });

  it('persists /v1/feedback for a testing conversation', async () => {
    const res = await fetch(`${base}/v1/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Session-Id': 'tjos-test' },
      body: JSON.stringify({
        q: 'Chippewa County WI',
        county: 'Chippewa',
        state: 'WI',
        kind: 'tjos',
        feedback: 'Parcel format on LandNav is XXX-XXXX-XXXX for this county.'
      })
    });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.persisted, true);
    assert.equal(body.jurisdiction_key, 'WI-Chippewa');
    assert.match(body.feedback.body, /Parcel format/);
  });

  it('health reports the model stack and oauth flags', async () => {
    const res = await fetch(`${base}/v1/health`);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.llm.provider, 'none');
    assert.equal(body.llm.model, 'spul-db');
    assert.equal(body.oauth.google, false);
    assert.equal(body.oauth.apple, false);
  });
});
