'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { classifyProbe, shouldLock } = require('../scripts/probe-lib');

describe('live seed probe classifier', () => {
  it('locks a treasurer search form', () => {
    const html =
      '<title>Tax Search | OC Treasurer</title><form><input id="parcel" name="parcel" placeholder="Parcel Number"></form>';
    const hit = classifyProbe({
      url: 'https://taxbill.octreasurer.gov/',
      status: 200,
      html,
      entity: 'Orange County Treasurer-Tax Collector'
    });
    assert.equal(hit.verdict, 'collector_search');
    assert.equal(shouldLock(hit.verdict), true);
    assert.ok(hit.fields.some((f) => f.role === 'parcel'));
  });

  it('unlocks a 404 catalog URL', () => {
    const hit = classifyProbe({
      url: 'https://www.maricopa.gov/5524/Property-Search',
      status: 404,
      html: '<title>Custom404</title>',
      entity: 'Maricopa County — Property search'
    });
    assert.equal(hit.verdict, 'dead');
    assert.equal(shouldLock(hit.verdict), false);
  });

  it('unlocks a county homepage with no search form', () => {
    const hit = classifyProbe({
      url: 'https://kingcounty.gov/',
      status: 200,
      html: '<title>King County</title><p>Welcome</p>',
      entity: 'King County WA — county site'
    });
    assert.equal(hit.verdict, 'homepage');
    assert.equal(shouldLock(hit.verdict), false);
  });

  it('treats countygovservices assessment hosts as assessor, not collector', () => {
    const hit = classifyProbe({
      url: 'https://baldwinproperty.countygovservices.com/Assessment/SearchAddress',
      status: 200,
      html: '<title>Search - AssuranceWeb Property</title>',
      entity: 'Baldwin County — Revenue / assessment search'
    });
    assert.equal(hit.verdict, 'assessor_search');
    assert.equal(shouldLock(hit.verdict), false);
  });

  it('does not lock a tax collector office homepage that only has a CMS site search', () => {
    const hit = classifyProbe({
      url: 'https://www.alachuacollector.com/',
      status: 200,
      html:
        '<title>Alachua County Tax Collector &#8211; Integrity. Innovation. Fiscal Responsibility. Respect.</title><form><input name="search_query" placeholder="Name, address, or account #:"></form>',
      entity: 'Alachua County, FL — Tax Collector'
    });
    assert.equal(hit.verdict, 'homepage');
    assert.equal(shouldLock(hit.verdict), false);
  });

  it('locks Florida county-taxes.com public portals even behind Cloudflare', () => {
    const hit = classifyProbe({
      url: 'https://alachua.county-taxes.com/public',
      status: 403,
      html: '<title>Just a moment...</title>',
      entity: 'Alachua County FL Tax Collector',
      vendor: 'county_taxes'
    });
    assert.equal(hit.verdict, 'collector_search');
    assert.equal(hit.reason, 'collector_host_cloudflare');
    assert.equal(shouldLock(hit.verdict), true);
  });

  it('locks the Sacramento eProptax host behind Cloudflare, not as dead', () => {
    const hit = classifyProbe({
      url: 'https://eproptax.saccounty.gov/',
      status: 403,
      html: '<title>Just a moment...</title>'
    });
    assert.equal(hit.verdict, 'collector_search');
    assert.equal(shouldLock(hit.verdict), true);
  });

  it('does not lock a CAD appraisal site as the collector', () => {
    const hit = classifyProbe({
      url: 'https://www.hayscad.org/',
      status: 200,
      html: '<title>Hays County, Texas Appraisal District Property Record Search</title><form><input name="parcel" placeholder="Parcel"></form>'
    });
    assert.equal(hit.verdict, 'assessor_search');
    assert.equal(shouldLock(hit.verdict), false);
  });

  it('does not treat HowdoIPayMyTaxBill on an assessor host as a collector search', () => {
    const hit = classifyProbe({
      url: 'https://assessor.santacruzcountyca.gov/PropertyTaxInformation/HowdoIPayMyTaxBill.aspx',
      status: 200,
      html: '<title>How do I Pay My Tax Bill?</title>'
    });
    assert.notEqual(hit.verdict, 'collector_search');
    assert.equal(shouldLock(hit.verdict), false);
  });

  it('does not lock a county-taxes URL that redirected off the vendor onto a news page', () => {
    const hit = classifyProbe({
      url: 'https://pinellas.county-taxes.com/public',
      finalUrl: 'https://pinellastaxcollector.gov/news/2026closure/',
      status: 200,
      html: '<title>Pinellas Tax Collector Closure 2026</title>'
    });
    assert.notEqual(hit.verdict, 'collector_search');
    assert.equal(shouldLock(hit.verdict), false);
  });

  it('keeps a 404 county-taxes host dead so we do not invent portals', () => {
    const hit = classifyProbe({
      url: 'https://nosuchflcounty.county-taxes.com/public',
      status: 404,
      html: '<title>Not Found</title>'
    });
    assert.equal(hit.verdict, 'dead');
    assert.equal(shouldLock(hit.verdict), false);
  });
});
