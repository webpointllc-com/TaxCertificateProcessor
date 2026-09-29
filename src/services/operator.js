'use strict';

const { parseSearchQuery } = require('./searchIntelligence');
const { lookupForApi } = require('./urlFinder');
const extractors = require('../db/extractors');

function inferParcelPattern(apn) {
  const raw = String(apn || '').trim();
  if (raw.length < 5) return '';
  return raw.replace(/\d/g, '#').replace(/[A-Za-z]/g, 'A');
}

function lookupOf(parsed) {
  const result = lookupForApi(parsed.county, parsed.state);
  const county = result.canonicalCounty || parsed.county;
  const state = (result.canonicalState || parsed.state || '').toUpperCase();
  return {
    ok: true,
    key: `${state}-${county}`,
    jurisdiction: { county, state },
    ...result
  };
}

function detectDiscoveries({ parsed, lookup, agent }) {
  const discoveries = [];
  const pattern = inferParcelPattern(parsed.apn);
  if (pattern) {
    discoveries.push({
      kind: 'parcel_format',
      value: pattern,
      sample: parsed.apn
    });
  }
  const locked = lookup.officialUrl || lookup.lockedUrl || '';
  if (lookup.urlLocked && locked && agent.search_url && agent.search_url !== locked) {
    discoveries.push({
      kind: 'url_change_detected',
      value: locked,
      kept: agent.search_url
    });
  }
  return discoveries;
}

function handoffOf(lookup, agent) {
  const county = lookup.jurisdiction?.county || lookup.canonicalCounty || '';
  const state = lookup.jurisdiction?.state || lookup.canonicalState || '';
  const place = [county, state].filter(Boolean).join(', ');
  const entity = lookup.entity || agent.entity || 'tax collecting entity';
  const badge = place ? `${place} · ${entity}` : entity;
  return {
    seamless: true,
    from: { role: 'central', label: 'WebPoint' },
    to: {
      role: 'county_agent',
      key: lookup.key,
      label: place || lookup.key,
      entity,
      badge
    }
  };
}

async function dispatch({ q, accountId, feedback }) {
  const parsed = parseSearchQuery(q);
  if (!parsed.county) {
    return {
      ok: false,
      error: 'Name a county and state, e.g. Chippewa County WI'
    };
  }
  const lookup = lookupOf(parsed);
  const agent = await extractors.ensureSlot(lookup);
  const discoveries = detectDiscoveries({ parsed, lookup, agent });
  if (feedback) {
    discoveries.push({ kind: 'exception', value: String(feedback).slice(0, 500) });
  }
  const next = discoveries.length
    ? await extractors.rememberDiscovery({ agent, lookup, discoveries, accountId })
    : agent;
  const handoff = handoffOf(lookup, next);
  return {
    ok: true,
    operator: 'central',
    routed_to: lookup.key,
    parsed,
    lookup,
    agent: next,
    discoveries,
    shared: true,
    handoff
  };
}

module.exports = {
  inferParcelPattern,
  detectDiscoveries,
  lookupOf,
  handoffOf,
  dispatch
};
