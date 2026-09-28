'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parseJurisdiction, lookupForApi } = require('../src/services/urlFinder');
const { hasUrlLock } = require('../src/services/spulTruth');
const { matchScenario } = require('../src/services/scenarioRouter');
const { enrichSystemPrompt } = require('../src/services/taxIntelligence');

describe('Search Spul jurisdiction brain', () => {
  it('parses Chippewa County WI', () => {
    const parsed = parseJurisdiction('Chippewa County WI tax certificate');
    assert.equal(parsed.county.toLowerCase(), 'chippewa');
    assert.equal(parsed.state, 'WI');
  });

  it('locks Chippewa WI to the LandNav Catalis portal, not the dead .gov host', () => {
    const lookup = lookupForApi('Chippewa', 'WI');
    assert.equal(lookup.confidence, 'verified');
    assert.match(lookup.url, /landnav\.com/i);
    assert.doesNotMatch(lookup.url, /chippewacounty\.gov/i);
    assert.equal(hasUrlLock(lookup.confidence, lookup.url), true);
    assert.match(lookup.rdsURL, /chippewacountywi\.gov/);
  });

  it('injects locked URL into the RAG system prompt', () => {
    const prompt = enrichSystemPrompt('Chippewa', 'WI', {
      scenarioMatch: matchScenario('pay property taxes Chippewa WI')
    });
    assert.match(prompt, /landnav\.com/i);
    assert.match(prompt, /HARD LOCK/i);
    assert.match(prompt, /Wis\. Stat/);
  });
});
