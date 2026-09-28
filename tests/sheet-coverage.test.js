'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  parseJurisdiction,
  lookupForApi,
  countyInDatabase,
  compactName,
  resolveAlias
} = require('../src/services/urlFinder');
const { hasUrlLock, isGoogleFallbackUrl } = require('../src/services/spulTruth');

const catalogPath = path.join(__dirname, '..', 'data', 'wpt_production_counties.json');
const countiesPath = path.join(__dirname, '..', 'data', 'counties.json');
const aliasesPath = path.join(__dirname, '..', 'data', 'sheet_aliases.json');

function compactKey(state, county) {
  return `${(state || '').toUpperCase()}:${compactName(county)}`;
}

describe('WPT Production Log county coverage', () => {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const counties = JSON.parse(fs.readFileSync(countiesPath, 'utf8'));
  const aliases = JSON.parse(fs.readFileSync(aliasesPath, 'utf8'));
  const dbKeys = new Set(counties.map((c) => compactKey(c.state, c.county)));

  it('has a committed catalog from the public WPT sheet', () => {
    assert.equal(catalog.source.spreadsheetId, '1yOKyy5NqJHVKiuVO1kYvSIf7s_R7gCGJ2cyfcCz2zcM');
    assert.ok(catalog.jurisdictions.length >= 2000, `expected 2000+ sheet jurisdictions, got ${catalog.jurisdictions.length}`);
    assert.ok(catalog.source.tabs.some((t) => t.name === 'Master Log'));
  });

  it('represents every catalog jurisdiction in counties.json', () => {
    const missing = catalog.jurisdictions.filter((j) => !dbKeys.has(compactKey(j.state, j.county)));
    assert.equal(
      missing.length,
      0,
      missing
        .slice(0, 12)
        .map((j) => `${j.state}-${j.county}`)
        .join(', ')
    );
  });

  it('keeps Chippewa WI locked to LandNav (not the dead .gov host)', () => {
    const lookup = lookupForApi('Chippewa', 'WI');
    assert.equal(lookup.confidence, 'verified');
    assert.match(lookup.url, /landnav\.com/i);
    assert.doesNotMatch(lookup.url, /chippewacounty\.gov/i);
    assert.equal(hasUrlLock(lookup.confidence, lookup.url), true);
    const row = counties.find((c) => c.state === 'WI' && compactName(c.county) === 'chippewa');
    assert.ok(row);
    assert.match(row.searchURL, /landnav\.com/i);
  });

  it('aliases the sheet mislabel WI-Horry to SC Horry', () => {
    const aliased = resolveAlias('Horry', 'WI');
    assert.equal(aliased.state, 'SC');
    assert.equal(compactName(aliased.county), 'horry');
    const parsed = parseJurisdiction('Horry County WI tax certificate');
    assert.equal(parsed.state, 'SC');
    const lookup = lookupForApi('Horry', 'WI');
    assert.ok(lookup.url);
    assert.equal(isGoogleFallbackUrl(lookup.url), false);
  });

  it('knows high-volume sheet counties including those previously absent (PA, NV)', () => {
    assert.equal(countyInDatabase('Allegheny', 'PA'), true);
    assert.equal(countyInDatabase('Philadelphia', 'PA'), true);
    assert.equal(countyInDatabase('Clark', 'NV'), true);
    assert.equal(countyInDatabase('St. Clair', 'AL'), true);
    assert.equal(countyInDatabase('St Clair', 'AL'), true);
    assert.equal(countyInDatabase('Baltimore City', 'MD'), true);
    assert.equal(countyInDatabase('Baltimore', 'MD'), true);
  });

  it('does not invent a URL for sheet counties that still need correction', () => {
    const lookup = lookupForApi('Allegheny', 'PA');
    if (!lookup.url) {
      assert.equal(lookup.confidence, 'not_found');
      assert.match(lookup.source, /operator correction/i);
    } else {
      assert.equal(isGoogleFallbackUrl(lookup.url), false);
    }
  });

  it('distinguishes Baltimore County from Baltimore City', () => {
    const county = lookupForApi('Baltimore', 'MD');
    const city = lookupForApi('Baltimore City', 'MD');
    assert.ok(county.url);
    assert.ok(city.url);
    assert.notEqual(county.url, city.url);
  });

  it('stores sheet typo aliases without dropping the canonical row', () => {
    assert.ok(aliases['WI:horry']);
    assert.equal(aliases['WI:horry'].state, 'SC');
    assert.ok(aliases['AL:balwin']);
    assert.equal(compactName(aliases['AL:balwin'].county), 'baldwin');
  });
});
