'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { lookupForApi } = require('../src/services/urlFinder');
const { isGoogleFallbackUrl } = require('../src/services/spulTruth');
const { enrichSystemPrompt } = require('../src/services/taxIntelligence');
const drProduction = require('../src/services/drProduction');
const { parseDump } = require('../scripts/import-extractor-urls');

const dumpPath = path.join(__dirname, '..', 'data', 'extractor_urls.txt');
const jsonPath = path.join(__dirname, '..', 'data', 'extractor_urls.json');

describe('Development Extractor table dump', () => {
  it('keeps the ExtractorUrls seed and prefers Search over google/templates', () => {
    const text = fs.readFileSync(dumpPath, 'utf8');
    assert.match(text, /Total extractors:\s*2085/);
    const parsed = parseDump(text);
    assert.equal(parsed.length, 2085);
    const logan = parsed.find((r) => r.key === 'KY-Logan' && r.source === 'Search');
    assert.equal(logan.url, 'https://ecclix.com/ecclix/login.aspx');
    const google = parsed.filter((r) => /google\.com/i.test(r.url));
    assert.ok(google.length >= 1);
    for (const row of google) assert.equal(isGoogleFallbackUrl(row.url), true);

    const index = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    assert.ok(index.stats.usablePicked >= 2000);
    assert.ok(index.stats.overlapSearching >= 2000);
    assert.ok(index.rows.every((r) => !isGoogleFallbackUrl(r.url)));
    assert.ok(index.rows.every((r) => !/\{parcel\}/i.test(r.url)));
    assert.ok(index.rows.some((r) => r.key === 'KY-Logan' && /ecclix\.com/.test(r.url)));
  });

  it('does not lock Hamilton OH from the treasurer default.asp dump row', () => {
    const lookup = lookupForApi('Hamilton', 'OH');
    assert.equal(lookup.urlLocked, false);
    assert.equal(drProduction.headers().length, 40);
    assert.equal(drProduction.parcelFormatFor('OH-Hamilton'), '###-####-####-##');
    const block = drProduction.llmBlock({
      lookupKey: 'OH-Hamilton',
      county: 'Hamilton',
      state: 'OH',
      parcel: '224-0001-0166-00',
      message: 'Hamilton OH production row'
    });
    assert.equal(block.on_file, true);
    assert.equal(block.isolated_field, null);
    assert.equal(block.columns.length, 40);
  });

  it('tells the LLM the extractor dump, Searching overlay, 40 columns, and live feedback', () => {
    const prompt = enrichSystemPrompt('Hamilton', 'OH');
    assert.match(prompt, /Extractor table dump/);
    assert.match(prompt, /DR Production Results/);
    assert.match(prompt, /40 columns|1,?675/);
    assert.match(prompt, /feedback/);
    assert.match(prompt, /webpointllc\.com\/searching/);
    const page = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'data', 'searching_page.json'), 'utf8')
    );
    assert.ok(page.seeds.some((s) => /Extractor table dump/i.test(s)));
    assert.ok(page.seeds.some((s) => /feedback/i.test(s)));
  });

  it('draws the 2k dump row for Chippewa as a candidate and keeps LandNav locked', () => {
    const lookup = lookupForApi('Chippewa', 'WI');
    assert.equal(lookup.urlLocked, true);
    assert.match(lookup.officialUrl, /landnav\.com/i);
    assert.ok(lookup.dumpUrl);
    assert.match(lookup.dumpUrl, /chippewa/i);
    const prompt = enrichSystemPrompt('Chippewa', 'WI');
    assert.match(prompt, /landnav\.com/i);
    assert.match(prompt, /Guest Sign In/);
    assert.match(prompt, /candidate/i);
    assert.match(prompt, /cctax\.co\.chippewa|Dump WI-Chippewa/);
    assert.match(prompt, /COUNTY EXTRACTOR CATALOG/);
  });
});
