'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parseSearchQuery } = require('../src/services/searchIntelligence');
const { parseJurisdiction, lookupForApi } = require('../src/services/urlFinder');
const operator = require('../src/services/operator');

describe('casual parcel-in-place parser', () => {
  it('routes a chatty San Diego parcel question to the Treasurer-Tax Collector', () => {
    const q =
      'Hey i need to find parcel 325-061-08-00 in San Diego CA can you search the parcel for me and pull up the tax info';
    const parsed = parseSearchQuery(q);
    assert.equal(parsed.apn, '325-061-08-00');
    assert.match(parsed.county, /san diego/i);
    assert.equal(parsed.state, 'CA');
    assert.equal(parsed.address, '');
    const lookup = lookupForApi(parsed.county, parsed.state);
    assert.equal(lookup.urlLocked, true);
    assert.match(lookup.officialUrl, /wps\.sdttc\.com\/WebPayments\/CoSDTreasurer2\/search/i);
    assert.doesNotMatch(lookup.officialUrl, /arcc/i);
  });

  it('does not treat xxx-xxx-xxx as a real APN', () => {
    const parsed = parseSearchQuery('Hey i need to find parcel xxx-xxx-xxx in San Diego CA');
    assert.equal(parsed.apn, '');
    assert.match(parsed.county, /san diego/i);
    assert.equal(parsed.state, 'CA');
  });

  it('does not steal the APN tail as an address', () => {
    const parsed = parseSearchQuery('parcel 325-061-08-00 in San Diego CA');
    assert.equal(parsed.apn, '325-061-08-00');
    assert.equal(parsed.address, '');
    assert.match(parsed.county, /san diego/i);
    assert.equal(parsed.state, 'CA');
  });

  it('does not treat the preposition in as Indiana', () => {
    const parsed = parseSearchQuery('Hey search parcel 12-345-6-789 in Chippewa WI');
    assert.equal(parsed.apn, '12-345-6-789');
    assert.match(parsed.county, /chippewa/i);
    assert.equal(parsed.state, 'WI');
    assert.notEqual(parsed.state, 'IN');
  });

  it('still parses a bare place', () => {
    const parsed = parseJurisdiction('San Diego CA');
    assert.match(parsed.county, /san diego/i);
    assert.equal(parsed.state, 'CA');
  });
});

describe('only present a collector link when sure', () => {
  it('keeps Chippewa LandNav locked', () => {
    const lookup = lookupForApi('Chippewa', 'WI');
    assert.equal(lookup.urlLocked, true);
    assert.match(lookup.officialUrl, /landnav\.com/i);
    assert.ok(lookup.layout);
    assert.match(JSON.stringify(lookup.layout), /GuestLoginForm/);
  });

  it('locks Harris to the Tax Assessor-Collector pay portal, not the county homepage', () => {
    const lookup = lookupForApi('Harris', 'TX');
    assert.equal(lookup.urlLocked, true);
    assert.match(lookup.officialUrl, /myharriscountytax\.com/i);
    assert.doesNotMatch(lookup.officialUrl || '', /harriscountytx\.gov/i);
  });

  it('locks Cook to the Treasurer PIN search, not propertyinfo', () => {
    const lookup = lookupForApi('Cook', 'IL');
    assert.equal(lookup.urlLocked, true);
    assert.match(lookup.officialUrl, /cookcountytreasurer\.com\/setsearchparameters/i);
    assert.doesNotMatch(lookup.officialUrl || '', /cookcountypropertyinfo/i);
    assert.match(JSON.stringify(lookup.layout.fields.map((f) => f.xpath).join(' ')), /txtPIN1/);
  });

  it('does not present Maricopa’s 404 catalog URL', () => {
    const lookup = lookupForApi('Maricopa', 'AZ');
    assert.equal(lookup.urlLocked, false);
    assert.equal(lookup.officialUrl, null);
    assert.match(String(lookup.rejectURLs || []), /5524\/Property-Search/);
  });

  it('locks Alachua to the county-taxes search/pay portal, not the office homepage', () => {
    const lookup = lookupForApi('Alachua', 'FL');
    assert.equal(lookup.urlLocked, true);
    assert.match(lookup.officialUrl, /alachua\.county-taxes\.com\/public/i);
    assert.doesNotMatch(lookup.officialUrl || '', /alachuacollector\.com\/?$/i);
  });

  it('does not present a generic county homepage as the collector search', () => {
    const lookup = lookupForApi('King', 'WA');
    assert.equal(lookup.urlLocked, false);
    assert.equal(lookup.officialUrl, null);
  });
});

describe('operator casual dispatch', () => {
  it('hands a San Diego chat query to the county agent with the APN', async () => {
    const routed = await operator.dispatch({
      q: 'Hey i need to find parcel 325-061-08-00 in San Diego CA can you search the parcel for me and pull up the tax info'
    });
    assert.equal(routed.ok, true);
    assert.match(routed.routed_to, /CA-SanDiego|CA-San Diego/i);
    assert.equal(routed.parsed.apn, '325-061-08-00');
    assert.equal(routed.lookup.urlLocked, true);
    assert.match(routed.handoff.to.badge, /San Diego/i);
    assert.ok(routed.agent.layout);
  });

  it('asks for county and state when only a parcel is given', async () => {
    const routed = await operator.dispatch({ q: 'parcel 325-061-08-00' });
    assert.equal(routed.ok, false);
    assert.equal(routed.collaborate, true);
    assert.match(routed.error, /325-061-08-00/);
    assert.match(routed.error, /San Diego CA/i);
  });
});
