'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { lookupForApi } = require('../src/services/urlFinder');
const { hasUrlLock } = require('../src/services/spulTruth');

const inventory = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'data', 'spul_searching_inventory.json'), 'utf8')
);
const locks = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'data', 'spul_searching_operator_locks.json'), 'utf8')
);

describe('S-PUL Searching inventory fusion', () => {
  it('keeps the live Searching registry in-repo', () => {
    assert.ok(inventory.rows.length >= 1600);
    assert.ok(inventory.rows.some((r) => /ecclix\.com/i.test(r.url)));
    assert.ok(inventory.rows.some((r) => /properlytaxes\.com/i.test(r.url)));
    assert.ok(inventory.rows.some((r) => /snstaxpayments\.com/i.test(r.url)));
    assert.equal(Object.keys(locks.locks).length, 21);
  });

  it('locks Logan KY to ECCLIX, not the county homepage', () => {
    const lookup = lookupForApi('Logan', 'KY');
    assert.equal(lookup.urlLocked, true);
    assert.match(lookup.officialUrl, /ecclix\.com\/ecclix\/login\.aspx/i);
    assert.doesNotMatch(lookup.officialUrl, /logancountyky\.gov/i);
    assert.doesNotMatch(lookup.officialUrl, /:\/\/(www\.)?eclix\.com/i);
    assert.equal(hasUrlLock(lookup.confidence, lookup.url, lookup), true);
  });

  it('locks LaRue KY to PVDNet Properly Taxes', () => {
    const lookup = lookupForApi('La Rue', 'KY');
    assert.equal(lookup.urlLocked, true);
    assert.match(lookup.officialUrl, /view\.properlytaxes\.com\/index\?id=192/i);
    assert.doesNotMatch(lookup.officialUrl, /laruecounty\.org/i);
    assert.doesNotMatch(lookup.officialUrl, /propertytaxes\.com/i);
  });

  it('locks Muhlenberg, Oldham, and Warren KY to Searching collector hosts', () => {
    const muh = lookupForApi('Muhlenberg', 'KY');
    assert.equal(muh.urlLocked, true);
    assert.match(muh.officialUrl, /ecclix\.com/i);

    const oldham = lookupForApi('Oldham', 'KY');
    assert.equal(oldham.urlLocked, true);
    assert.match(oldham.officialUrl, /ptax1\.csiky\.com\/oldham_current/i);
    assert.doesNotMatch(oldham.officialUrl, /oldhamcountyky\.gov/i);
    assert.doesNotMatch(oldham.officialUrl, /celky\.com/i);

    const warren = lookupForApi('Warren', 'KY');
    assert.equal(warren.urlLocked, true);
    assert.match(warren.officialUrl, /ecclix\.com/i);
    assert.doesNotMatch(warren.officialUrl, /warrencountyky\.gov/i);
  });

  it('locks Allen and Bossier Parish LA to sheriff pay portals', () => {
    const allen = lookupForApi('Allen Parish', 'LA');
    assert.equal(allen.urlLocked, true);
    assert.match(allen.officialUrl, /snstaxpayments\.com/i);
    assert.doesNotMatch(allen.officialUrl, /allenparishpolicejury/i);
    assert.doesNotMatch(allen.officialUrl, /:\/\/sntaxpayments\.com/i);

    const bossier = lookupForApi('Bossier Parish', 'LA');
    assert.equal(bossier.urlLocked, true);
    assert.match(bossier.officialUrl, /bossiersheriff\.com\/property-details/i);
    assert.doesNotMatch(bossier.officialUrl, /bossierparishla\.gov/i);
  });

  it('does not steal Chippewa LandNav or unlock Maricopa', () => {
    const chip = lookupForApi('Chippewa', 'WI');
    assert.match(chip.officialUrl, /landnav\.com/i);
    const mar = lookupForApi('Maricopa', 'AZ');
    assert.equal(mar.urlLocked, false);
    assert.equal(mar.officialUrl, null);
  });
});
