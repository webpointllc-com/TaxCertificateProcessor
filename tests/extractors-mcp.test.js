'use strict';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const store = require('../src/db/store');
const validation = require('../src/services/extractorValidation');
const locks = require('../src/db/extractorLocks');
const urlFinder = require('../src/services/urlFinder');
const extractors = require('../src/db/extractors');
const { app } = require('../src/server');
const { buildServer } = require('../mcp/extractors-server');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { InMemoryTransport } = require('@modelcontextprotocol/sdk/inMemory.js');

const COLLECTOR_HTML =
  '<html><head><title>Property Tax Search - Treasurer</title></head><body>' +
  '<form><label for="p">Parcel Number</label><input id="p" name="parcelNumber" placeholder="Parcel Number">' +
  '<input name="ownerName" placeholder="Owner Name"></form>Bill Amount Balance Due Bill Year</body></html>';

function fakeFetch(map) {
  return async (url) => {
    const hit = map[url] || map['*'];
    if (!hit) return { status: 0, finalUrl: url, html: '', bytes: 0, error: 'dns' };
    return { status: hit.status || 200, finalUrl: hit.finalUrl || url, html: hit.html || '', bytes: (hit.html || '').length, error: null };
  };
}

// A county that is NOT verified in the catalog today, so an approved lock visibly changes lookups.
function unverifiedCounty() {
  const row = urlFinder.loadCounties().find((r) => !r.verified && r.probeStatus === 'unknown_live' && r.searchURL);
  assert.ok(row, 'need an unverified county in data/counties.json');
  return row;
}

describe('extractor validation core', () => {
  before(async () => {
    locks.resetMemory();
    await store.init();
  });
  after(() => validation.setFetcher(null));

  it('reports coverage across the whole catalog', () => {
    const s = validation.stats();
    assert.ok(s.total > 3000);
    assert.ok(s.verified > 1000);
    assert.equal(typeof s.by_status.collector_search, 'number');
  });

  it('looks up a county by key and by name', () => {
    assert.equal(validation.lookup({ key: 'WI-Chippewa' }).extractor.key, 'WI-Chippewa');
    assert.equal(validation.lookup({ county: 'Chippewa County', state: 'WI' }).extractor.key, 'WI-Chippewa');
    assert.equal(validation.lookup({ key: 'ZZ-Nowhere' }).ok, false);
  });

  it('pages through a filtered list', () => {
    const first = validation.list({ state: 'WI', limit: 5 });
    assert.equal(first.count, 5);
    assert.equal(first.has_more, true);
    const next = validation.list({ state: 'WI', limit: 5, offset: first.next_offset });
    assert.notEqual(next.items[0].key, first.items[0].key);
  });

  it('classifies a collector search page and marks it lock-eligible', async () => {
    const row = unverifiedCounty();
    const url = 'https://pp-test-co.app.landnav.com/search';
    validation.setFetcher(fakeFetch({ [url]: { html: COLLECTOR_HTML } }));
    const out = await validation.validate({ key: row.key, url });
    assert.equal(out.ok, true);
    assert.equal(out.verdict, 'collector_search');
    assert.equal(out.lock_eligible, true);
    assert.ok(out.dr_fields.includes('Parcel Number'));
  });

  it('marks a dead page as not lock-eligible', async () => {
    validation.setFetcher(fakeFetch({}));
    const out = await validation.validate({ key: unverifiedCounty().key, url: 'https://gone.example.gov/' });
    assert.equal(out.verdict, 'dead');
    assert.equal(out.lock_eligible, false);
  });
});

describe('lock proposals and approval', () => {
  beforeEach(async () => {
    locks.resetMemory();
    await store.init();
  });

  it('refuses Google fallback URLs', async () => {
    const out = await locks.propose({ jurisdictionKey: 'TX-Bell', url: 'https://www.google.com/search?q=bell+county+tax', role: 'claude' });
    assert.equal(out.ok, false);
  });

  it('collapses a repeat proposal of the same URL into one row', async () => {
    await locks.propose({ jurisdictionKey: 'TX-Bell', url: 'https://example.gov/tax', role: 'claude' });
    const again = await locks.propose({ jurisdictionKey: 'TX-Bell', url: 'https://example.gov/tax', role: 'claude' });
    assert.equal(again.refreshed, true);
    assert.equal((await locks.list({ status: 'pending' })).length, 1);
  });

  it('Claude cannot approve or reject', async () => {
    const p = await locks.propose({ jurisdictionKey: 'TX-Bell', url: 'https://example.gov/tax', role: 'claude' });
    const out = await locks.decide({ id: p.proposal.id, action: 'approve', role: 'claude' });
    assert.equal(out.ok, false);
    assert.equal(out.status, 403);
  });

  it('a human approval locks the URL for members right away and saves an extractor version', async () => {
    const row = unverifiedCounty();
    const url = 'https://pp-approved.app.landnav.com/search';
    assert.equal(urlFinder.lookupForApi(row.county, row.state).urlLocked, false);
    const p = await locks.propose({ jurisdictionKey: row.key, state: row.state, county: row.county, url, verdict: 'collector_search', role: 'claude' });
    const out = await locks.decide({ id: p.proposal.id, action: 'approve', reviewer: 'bill', role: 'human' });
    assert.equal(out.ok, true);
    const after = urlFinder.lookupForApi(row.county, row.state);
    assert.equal(after.urlLocked, true);
    assert.equal(after.officialUrl, url);
    assert.equal(after.lockSource, 'editor_approved');
    const active = await extractors.findActive(row.key);
    assert.equal(active.search_url, url);
    assert.equal(active.source, 'editor_lock');
    assert.equal(validation.lookup({ key: row.key }).extractor.lock_source, 'editor_approved');
    urlFinder.setRuntimeLocks([]);
  });

  it('a decided proposal cannot be decided twice', async () => {
    const p = await locks.propose({ jurisdictionKey: 'TX-Bell', url: 'https://example.gov/tax', role: 'claude' });
    await locks.decide({ id: p.proposal.id, action: 'reject', reviewer: 'bill', role: 'human' });
    const again = await locks.decide({ id: p.proposal.id, action: 'approve', reviewer: 'bill', role: 'human' });
    assert.equal(again.status, 409);
  });
});

describe('internal MCP server', () => {
  let client;
  before(async () => {
    locks.resetMemory();
    await store.init();
    const server = buildServer();
    const [a, b] = InMemoryTransport.createLinkedPair();
    await server.connect(a);
    client = new Client({ name: 'test', version: '1.0.0' });
    await client.connect(b);
  });
  after(async () => {
    validation.setFetcher(null);
    await client.close();
  });

  it('exposes read, probe and propose tools, and no approve tool', async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    assert.deepEqual(names, [
      'extractor_list',
      'extractor_lock_queue',
      'extractor_lookup',
      'extractor_propose_lock',
      'extractor_stats',
      'extractor_validate',
      'extractor_validate_batch'
    ]);
    assert.ok(!names.some((n) => /approve|decide/.test(n)));
    const ro = tools.find((t) => t.name === 'extractor_validate').annotations;
    assert.equal(ro.readOnlyHint, true);
  });

  it('answers extractor_stats with structured content', async () => {
    const res = await client.callTool({ name: 'extractor_stats', arguments: {} });
    assert.ok(res.structuredContent.total > 3000);
    assert.equal(typeof res.structuredContent.lock_proposals.pending, 'number');
  });

  it('refuses to propose a lock when the probe is not a collector page', async () => {
    validation.setFetcher(fakeFetch({}));
    const res = await client.callTool({ name: 'extractor_propose_lock', arguments: { key: unverifiedCounty().key, url: 'https://gone.example.gov/' } });
    assert.equal(res.isError, true);
    assert.match(res.content[0].text, /Not proposed: probe says dead/);
  });

  it('proposes a lock when the probe passes, and it lands in the queue as pending', async () => {
    const row = unverifiedCounty();
    const url = 'https://pp-mcp.app.landnav.com/search';
    validation.setFetcher(fakeFetch({ [url]: { html: COLLECTOR_HTML } }));
    const res = await client.callTool({ name: 'extractor_propose_lock', arguments: { key: row.key, url, note: 'treasurer portal' } });
    assert.notEqual(res.isError, true);
    assert.equal(res.structuredContent.proposal.status, 'pending');
    assert.equal(res.structuredContent.proposal.proposer_role, 'claude');
    const q = await client.callTool({ name: 'extractor_lock_queue', arguments: { status: 'pending', key: row.key } });
    assert.equal(q.structuredContent.items.length, 1);
  });
});

describe('lock editor routes', () => {
  let server;
  let base;
  const saved = {};
  before(async () => {
    for (const k of ['EDITOR_KEY', 'CLAUDE_REVIEW_KEY']) saved[k] = process.env[k];
    process.env.EDITOR_KEY = 'human-k';
    process.env.CLAUDE_REVIEW_KEY = 'claude-k';
    locks.resetMemory();
    await store.init();
    server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    base = `http://127.0.0.1:${server.address().port}`;
  });
  after(async () => {
    for (const k of Object.keys(saved)) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
    validation.setFetcher(null);
    urlFinder.setRuntimeLocks([]);
    if (server) await new Promise((r) => server.close(r));
    await store.close();
  });

  async function post(path, key, body) {
    const res = await fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-editor-key': key }, body: JSON.stringify(body) });
    return { status: res.status, body: await res.json() };
  }

  it('Claude proposes over HTTP, cannot decide, and Bill locks it', async () => {
    const row = unverifiedCounty();
    const url = 'https://pp-http.app.landnav.com/search';
    validation.setFetcher(fakeFetch({ [url]: { html: COLLECTOR_HTML } }));
    const proposed = await post('/v1/editor/locks/propose', 'claude-k', { key: row.key, url });
    assert.equal(proposed.status, 200);
    const id = proposed.body.proposal.id;
    assert.equal((await post('/v1/editor/locks/decide', 'claude-k', { id, action: 'approve' })).status, 403);
    const ok = await post('/v1/editor/locks/decide', 'human-k', { id, action: 'approve', note: 'checked' });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.proposal.status, 'approved');
    const list = await (await fetch(`${base}/v1/editor/locks?status=approved`, { headers: { 'x-editor-key': 'human-k' } })).json();
    assert.equal(list.items.length, 1);
    assert.ok(list.coverage.editor_locked >= 1);
  });

  it('rejects a non-collector page unless force_review is set', async () => {
    validation.setFetcher(fakeFetch({}));
    const row = unverifiedCounty();
    const res = await post('/v1/editor/locks/propose', 'claude-k', { key: row.key, url: 'https://gone.example.gov/' });
    assert.equal(res.status, 422);
  });
});
