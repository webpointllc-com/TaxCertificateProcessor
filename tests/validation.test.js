'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const store = require('../src/db/store');
const extractors = require('../src/db/extractors');
const { app } = require('../src/server');
const siteValidator = require('../src/services/siteValidator');
const { lookupForApi } = require('../src/services/urlFinder');
const { handshake } = require('../src/services/siteValidator');
const { pickTargets } = require('../scripts/validate-extractors');

describe('site validator + DR look-for heads', () => {
  it('looks for DR Production Results column heads on every county portal', () => {
    const heads = siteValidator.lookForHeaders();
    assert.ok(heads.includes('Parcel Number'));
    assert.ok(heads.includes('Tax Id'));
    assert.ok(heads.includes('Owner 1 Name'));
    assert.ok(heads.includes('Balance Due'));
    const html =
      '<form><input id="parcel" name="parcel" placeholder="Parcel Number"><input name="owner" placeholder="Owner last name"></form>';
    const found = siteValidator.sniffDrFields(html);
    assert.ok(found.includes('Parcel Number'));
    assert.ok(found.includes('Owner 1 Name'));
  });

  it('queues Cloudflare for a real Chrome session instead of bypassing it', () => {
    assert.equal(
      siteValidator.cloudflareGated({
        html: 'Just a moment... cf-ray checking your browser',
        title: 'Attention Required',
        status: 403
      }),
      true
    );
    const shake = handshake({
      lookup: {
        key: 'FL-Clay',
        officialUrl: 'https://clay.county-taxes.com/public',
        urlLocked: true
      },
      sessionId: 's1',
      hit: { reason: 'collector_host_cloudflare', status: 403, html: 'cf-ray' }
    });
    assert.equal(shake.recommended, true);
    assert.equal(shake.openIn, 'user_chrome_tab');
    assert.equal(shake.reason, 'cloudflare_js_challenge');
    assert.doesNotMatch(JSON.stringify(shake), /bypass|spoof|solve/i);
  });

  it('unions the 2k+ extractor dump without google or templates', () => {
    const dump = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'data', 'extractor_urls.json'), 'utf8')
    );
    assert.ok(dump.stats.usablePicked >= 2000, dump.stats.usablePicked);
    const targets = pickTargets();
    const keys = targets.reduce((n, t) => n + (t.keys ? t.keys.length : 1), 0);
    assert.ok(targets.length >= 1400, targets.length);
    assert.ok(keys >= 2000, keys);
    assert.ok(targets.every((t) => /^https?:/i.test(t.url)));
    assert.ok(targets.every((t) => !/google\.com/i.test(t.url)));
    assert.ok(targets.every((t) => !/\{parcel\}/i.test(t.url)));
  });

  it('keeps Hamilton OH unlocked and Chippewa locked', () => {
    assert.equal(lookupForApi('Hamilton', 'OH').urlLocked, false);
    assert.equal(lookupForApi('Chippewa', 'WI').urlLocked, true);
    assert.equal(siteValidator.skipPlaybookKey('OH-Hamilton'), true);
  });

  it('documents the repeatable update path', () => {
    const md = fs.readFileSync(path.join(__dirname, '..', 'docs', 'VALIDATION.md'), 'utf8');
    assert.match(md, /validate:extractors/);
    assert.match(md, /validate:apply/);
    assert.match(md, /28 days/);
    assert.match(md, /extractor\/session|extractors\/session/);
    assert.match(md, /keep_lock/);
    assert.doesNotMatch(md, /bypass Cloudflare/i);
  });

  it('keeps verified collectors locked after the 2k+ apply and records how', () => {
    const apply = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'data', 'validation_apply.json'), 'utf8')
    );
    const run = siteValidator.loadLastRun();
    assert.ok(run.probed >= 1400, run.probed);
    assert.equal(run.lookFor.includes('Parcel Number'), true);
    assert.ok(apply.keptLocked >= 1000, apply.keptLocked);
    assert.ok(apply.probed >= 2000, apply.probed);
    assert.equal(lookupForApi('King', 'WA').urlLocked, true);
    assert.equal(lookupForApi('Hamilton', 'OH').urlLocked, false);
    const applySrc = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'apply-validation.js'), 'utf8');
    assert.match(applySrc, /keep_lock/);
    assert.match(applySrc, /wasVerified/);
  });

  it('prefers a newer Postgres validation run over the file report', async () => {
    const file = siteValidator.loadLastRun();
    const newer = {
      generatedAt: '2099-01-01T00:00:00.000Z',
      probed: 1,
      counts: { collector_search: 1 },
      lookForHits: {},
      how: ['test']
    };
    assert.equal(siteValidator.fresherRun(file, newer), newer);
    await extractors.recordValidationRun(file);
    const latest = await extractors.latestValidationRun();
    assert.ok(latest.probed >= 1400);
    assert.equal(siteValidator.staleRun(file, 28), false);
  });
});

describe('validation HTTP', () => {
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

  it('serves /api/validation with the look-for heads', async () => {
    const res = await fetch(`${base}/api/validation`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.ok, true);
    assert.ok(body.lookFor.includes('Parcel Number'));
  });
});
