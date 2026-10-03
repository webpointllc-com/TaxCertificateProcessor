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
    assert.match(allen.officialUrl, /snstaxpayments\.com\/allen/i);
    assert.doesNotMatch(allen.officialUrl, /allenparishpolicejury/i);
    assert.doesNotMatch(allen.officialUrl, /:\/\/sntaxpayments\.com/i);

    const bossier = lookupForApi('Bossier Parish', 'LA');
    assert.equal(bossier.urlLocked, true);
    assert.match(bossier.officialUrl, /bossiersheriff\.com\/property-details/i);
    assert.doesNotMatch(bossier.officialUrl, /bossierparishla\.gov/i);
  });

  it('ships the Bill Validated Searching HTML with Logan ECCLIX', () => {
    const html = fs.readFileSync(
      path.join(__dirname, '..', 'public', 'County_Names_Urls_BillValidated.html'),
      'utf8'
    );
    assert.match(html, /County Tax Collector Index — Bill Validated/);
    assert.match(html, /Logan/i);
    assert.match(html, /ecclix\.com/i);
    assert.doesNotMatch(html, /border-left\s*:/);
  });

  it('gives Logan KY an ECCLIX extractor the LLM can follow', () => {
    const lookup = lookupForApi('Logan', 'KY');
    assert.equal(lookup.urlLocked, true);
    assert.ok(lookup.method);
    assert.ok(lookup.method.steps.some((s) => /ecclix|ECCLIX|Clerk/i.test(s)));
    const prompt = require('../src/services/taxIntelligence').enrichSystemPrompt('Logan', 'KY');
    assert.match(prompt, /EXTRACTOR/);
    assert.match(prompt, /ecclix\.com/i);
    assert.match(prompt, /ctl00_Content_UserName|County Clerk/i);
    assert.match(prompt, /webpointllc\.com\/searching/);
    assert.match(prompt, /tax-certificate-processor\.onrender\.com/);
  });

  it('teaches the LLM the Searching index and Render top iframe without secrets', async () => {
    const page = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'data', 'searching_page.json'), 'utf8')
    );
    assert.equal(page.canonicalUrl, 'https://webpointllc.com/searching');
    assert.equal(page.topSlot.class, 'wp-tcs-frame');
    assert.equal(page.topSlot.src, 'https://tax-certificate-processor.onrender.com/');
    assert.equal(page.index.validatedEntries, 1675);
    assert.match(page.gates.squarespaceSitePassword, /never store/i);
    assert.match(page.gates.restrictedIndexAccessCode, /never store/i);

    const prompt = require('../src/services/taxIntelligence').enrichSystemPrompt('', '');
    assert.match(prompt, /CANONICAL OPERATOR INDEX/);
    assert.match(prompt, /webpointllc\.com\/searching/);
    assert.match(prompt, /wp-tcs-frame/);
    assert.match(prompt, /tax-certificate-processor\.onrender\.com/);
    assert.match(prompt, /1,?675/);
    assert.doesNotMatch(prompt, /SQS_SITE|SQS_INDEX/);

    const store = require('../src/db/store');
    await store.init();
    const chunks = await store.searchKnowledge('searching index render iframe');
    const blob = chunks.map((c) => `${c.title} ${c.body}`).join('\n');
    assert.match(blob, /webpointllc\.com\/searching/);
    assert.match(blob, /wp-tcs-frame/);
  });

  it('ships DeepShake Mac hunt and the cloud HTTP substitute', () => {
    const hunt = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'deepshake-hunt-mac.sh'), 'utf8');
    const hybrid = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'hybrid-revalidate.js'), 'utf8');
    const validate = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'validate-extractors.js'), 'utf8');
    const sniff = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'searching-chrome-sniff.mjs'), 'utf8');
    assert.match(hunt, /Darwin/);
    assert.match(hunt, /revalidate:searching/);
    assert.match(hybrid, /validate-extractors/);
    assert.match(validate, /extractor_urls\.json/);
    assert.match(validate, /DR Production Results/);
    assert.match(sniff, /SQS_SITE/);
    assert.match(sniff, /Do not pass them as argv/);
    assert.doesNotMatch(sniff, /process\.argv\[2\]/);
  });

  it('does not steal Chippewa LandNav or unlock Maricopa', () => {
    const chip = lookupForApi('Chippewa', 'WI');
    assert.match(chip.officialUrl, /landnav\.com/i);
    const mar = lookupForApi('Maricopa', 'AZ');
    assert.equal(mar.urlLocked, false);
    assert.equal(mar.officialUrl, null);
  });
});
