'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const store = require('../src/db/store');
const accounts = require('../src/db/accounts');
const extractors = require('../src/db/extractors');
const { app } = require('../src/server');
const {
  parseSearchQuery,
  buildCertificate
} = require('../src/services/searchIntelligence');
const { lookupForApi } = require('../src/services/urlFinder');
const drProduction = require('../src/services/drProduction');
const { parseJurisdictionRaw } = require('../src/services/parseJurisdiction');

const finale = path.join(__dirname, '..', 'finale');

describe('DR production finale sheets', () => {
  it('keeps the Hamilton and Hartford workbooks in finale/', () => {
    assert.equal(
      fs.existsSync(path.join(finale, 'OH-Hamilton-DR-ProductionResults09042026.xlsx')),
      true
    );
    assert.equal(
      fs.existsSync(path.join(finale, 'CT-HartfordCity-DR-ProductionResults09042026.xlsx')),
      true
    );
    assert.equal(drProduction.headers().length, 40);
    assert.ok(drProduction.headers().includes('Balance Due'));
    assert.ok(drProduction.headers().includes('Inst 1 Bal'));
  });

  it('treats Sangamon, IL the same as Sangamon IL', () => {
    const comma = parseJurisdictionRaw('Sangamon, IL');
    const space = parseJurisdictionRaw('Sangamon IL');
    assert.equal(comma.state, 'IL');
    assert.equal(space.state, 'IL');
    assert.match(comma.county, /sangamon/i);
    assert.match(space.county, /sangamon/i);
  });

  it('loads a Hamilton OH production row and does not lock the county homepage', () => {
    const lookup = lookupForApi('Hamilton', 'OH');
    assert.equal(lookup.urlLocked, false);
    assert.equal(lookup.homepageOnly || lookup.probeStatus === 'homepage', true);
    const parsed = parseSearchQuery('Hamilton OH 224-0001-0166-00');
    assert.equal(parsed.apn, '224-0001-0166-00');
    const cert = buildCertificate({ parsed, lookup, extractor: { parcel_format: '###-####-####-##' }, query: parsed.raw });
    assert.equal(cert.production.on_file, true);
    assert.equal(cert.production.row['Parcel Number'], '224-0001-0166-00');
    assert.equal(cert.total_tax, 2896.4);
    assert.equal(cert.search_url, null);
    assert.equal(cert.production.isolated_field, null);
    assert.match(cert.parcel_format, /#/);
  });

  it('isolates Balance Due only when the user names that field', () => {
    const general = drProduction.namedField('Hamilton OH parcel 224-0001-0166-00');
    assert.equal(general, null);
    const named = drProduction.namedField('what is the balance due on this parcel in Hamilton OH');
    assert.equal(named.header, 'Balance Due');
    const block = drProduction.llmBlock({
      lookupKey: 'OH-Hamilton',
      county: 'Hamilton',
      state: 'OH',
      parcel: '224-0001-0166-00',
      message: 'What is the Balance Due?'
    });
    assert.equal(block.isolated_field.header, 'Balance Due');
    assert.equal(block.isolated_field.value, 0);
    assert.match(block.speak, /Balance Due/i);
  });

  it('uses Hartford City numeric parcels and Sangamon tax-id-vs-parcel difference', () => {
    const hartford = parseSearchQuery('Hartford City CT 248461389');
    assert.equal(hartford.apn, '248461389');
    const hCert = buildCertificate({
      parsed: hartford,
      lookup: lookupForApi('Hartford City', 'CT'),
      extractor: {},
      query: hartford.raw
    });
    assert.equal(hCert.production.on_file, true);
    assert.equal(hCert.production.row['Agency Name'], 'CT-HartfordCity');
    assert.equal(lookupForApi('Hartford City', 'CT').urlLocked, false);

    const sangamon = parseSearchQuery('Sangamon IL parcel 221033704235');
    assert.equal(sangamon.apn, '221033704235');
    const sCert = buildCertificate({
      parsed: sangamon,
      lookup: lookupForApi('Sangamon', 'IL'),
      extractor: {},
      query: 'What is the Bill Amount for parcel 221033704235 Sangamon IL'
    });
    assert.equal(sCert.production.on_file, true);
    assert.equal(sCert.production.row['Tax Id'], '221030037');
    assert.equal(sCert.production.isolated_field.header, 'Bill Amount');
    assert.equal(sCert.total_tax, 19399.8);
  });

  it('seeds the county extractor with the DR document shape and county parcel format', async () => {
    extractors.resetMemory();
    const lookup = {
      ...lookupForApi('Hamilton', 'OH'),
      key: 'OH-Hamilton',
      jurisdiction: { county: 'Hamilton', state: 'OH' }
    };
    const slot = await extractors.ensureSlot(lookup);
    assert.equal(slot.parcel_format, '###-####-####-##');
    assert.equal(slot.layout.production.document, 'DR Production Results');
    assert.equal(slot.layout.production.columns.length, 40);
    assert.match(slot.method.steps.join(' '), /DR Production Results/);
  });
});

describe('DR production HTTP', () => {
  let server;
  let base;
  let token;

  before(async () => {
    extractors.resetMemory();
    await store.init();
    server = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    base = `http://127.0.0.1:${server.address().port}`;
    const res = await fetch(`${base}/api/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        display_name: 'Finale Review',
        email: `finale.${Date.now()}@webpointllc.com`,
        password: 'webpoint1'
      })
    });
    const created = await res.json();
    const verified = await fetch(`${base}/api/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: created.confirm_token })
    });
    token = (await verified.json()).token;
  });

  after(async () => {
    if (server) await new Promise((r) => server.close(r));
    await store.close();
  });

  it('returns a production row for Hartford CT and refuses to invent a collector URL', async () => {
    const res = await fetch(
      `${base}/api/production?q=${encodeURIComponent('Hartford CT 248461389')}`,
      { headers: { 'X-Auth-Token': token } }
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.lookup.urlLocked, false);
    assert.equal(body.production.on_file, true);
    assert.equal(body.production.row['Parcel Number'], '248461389');
  });
});
