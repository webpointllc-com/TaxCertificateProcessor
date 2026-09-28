'use strict';

const { parseJurisdiction, lookupForApi } = require('./urlFinder');
const { isRealHttpUrl, isGoogleFallbackUrl } = require('./spulTruth');

function parseSearchQuery(q) {
  const raw = String(q || '').trim();
  const apnMatch =
    raw.match(/\b(?:APN|PIN|parcel(?:\s*(?:id|number|#))?)\s*[:#·.\-]*\s*([A-Za-z0-9][A-Za-z0-9\-]{4,})/i) ||
    raw.match(/\b(\d{2,4}[-–]\d{2,4}[-–]\d{2,4}(?:[-–]\d{2,4})?)\b/);
  const apn = apnMatch ? apnMatch[1].replace(/[–]/g, '-') : '';
  const withoutApn = raw
    .replace(/\b(?:APN|PIN|parcel(?:\s*(?:id|number|#))?)\s*[:#·.\-]*\s*[A-Za-z0-9\-]{4,}/gi, ' ')
    .replace(/[·|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  let jur = parseJurisdiction(withoutApn);
  if (!jur.county) jur = parseJurisdiction(raw);
  const addrMatch = raw.match(/\b(\d{1,6}\s+[A-Za-z0-9][A-Za-z0-9 .,'#-]{6,80})/);
  return {
    raw,
    apn,
    address: addrMatch && !/county|apn|parcel/i.test(addrMatch[1]) ? addrMatch[1].trim() : '',
    county: jur.county || null,
    state: jur.state || null
  };
}

function money(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatMoney(n) {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function buildInsights(lookup, extractor) {
  const locked = Boolean(lookup.urlLocked && lookup.officialUrl);
  return [
    {
      id: 'trend',
      title: 'Assessment Trend',
      value: locked ? 'Confirm on collector' : 'No locked collector URL',
      detail: locked
        ? 'Year-over-year figures are taken only from the tax collecting entity.'
        : 'This jurisdiction still needs a validated extractor.'
    },
    {
      id: 'payment',
      title: 'Tax Payment Status',
      value: locked ? 'Open official search page' : 'Not found',
      detail: locked
        ? 'No invented delinquencies. Status is whatever the collector page shows today.'
        : 'This jurisdiction still needs a validated extractor.'
    },
    {
      id: 'zoning',
      title: 'Zoning',
      value: 'Not on the tax collector page',
      detail: 'Zoning is not a Search Spul field. We do not invent it.'
    },
    {
      id: 'comps',
      title: 'Nearby Comparable Value',
      value: 'Not on the tax collector page',
      detail: 'Comparables are not stored unless a saved extractor returns them.'
    }
  ];
}

function buildSummary({ parsed, lookup, extractor }) {
  const entity = lookup.entity || `${parsed.county || ''} County ${parsed.state || ''}`.trim();
  const url = lookup.officialUrl || '';
  const apn = parsed.apn ? ` Parcel ${parsed.apn}.` : '';
  if (!lookup.urlLocked) {
    return `${entity || 'This jurisdiction'} is in the catalog but has no locked collector URL. We will not invent a search page. Use Fix extractor after you confirm the official tax collecting entity page.`;
  }
  const version = extractor?.version ? ` Extractor v${extractor.version} is the working slot for ${lookup.jurisdiction?.county || parsed.county} County, ${lookup.jurisdiction?.state || parsed.state}.` : '';
  return `${entity} is the locked tax collecting entity.${apn} Search and pay on the official page (${url}). Confirm amounts there before closing.${version}`;
}

function buildCard({ parsed, lookup, extractor, amounts }) {
  const county = lookup.jurisdiction?.county || parsed.county || '';
  const state = lookup.jurisdiction?.state || parsed.state || '';
  const apn = parsed.apn || '';
  const a = amounts || {};
  return {
    county,
    state,
    apn,
    label: apn ? `APN ${apn}` : county ? `${county} County, ${state}` : parsed.raw,
    address: parsed.address || '',
    verified: Boolean(lookup.urlLocked),
    tax_year: String(new Date().getFullYear()),
    tax_status: a.tax_status || (lookup.urlLocked ? 'Confirm on collector' : 'unknown'),
    assessed: money(a.assessed),
    land: money(a.land),
    improvement: money(a.improvement),
    total_tax: money(a.total_tax),
    summary: buildSummary({ parsed, lookup, extractor }),
    insights: buildInsights(lookup, extractor),
    collector_url: lookup.officialUrl || '',
    entity: lookup.entity || '',
    extractor_version: extractor?.version || 1,
    extractor_status: extractor?.status || 'active'
  };
}

function resolveHealedUrl(lookup, proposedUrl) {
  const locked = lookup.officialUrl || lookup.lockedUrl || '';
  const proposed = String(proposedUrl || '').trim();
  if (lookup.urlLocked && locked) {
    return {
      url: locked,
      rejected: Boolean(proposed && proposed !== locked),
      reason: proposed && proposed !== locked
        ? 'Locked Search Spul URL was kept. We do not replace a verified collector page with a different link.'
        : ''
    };
  }
  if (!proposed) return { url: '', rejected: false, reason: '' };
  if (!isRealHttpUrl(proposed) || isGoogleFallbackUrl(proposed)) {
    return { url: '', rejected: true, reason: 'That is not a usable collector URL. Google search links are not saved.' };
  }
  return { url: proposed, rejected: false, reason: '' };
}

function methodFromFeedback(feedback, lookup, previous) {
  const text = String(feedback || '').trim();
  const steps = previous?.method?.steps ? previous.method.steps.slice() : [];
  if (text) {
    steps.unshift(`User-validated update: ${text.slice(0, 280)}`);
  }
  if (!steps.length) {
    steps.push(
      'Open the locked collector search page',
      'Search by parcel / APN',
      'Search by owner last name',
      'Confirm amounts on the collector before closing'
    );
  }
  return {
    steps: steps.slice(0, 12),
    search_by: previous?.method?.search_by || ['parcel', 'owner', 'address'],
    notes: text || previous?.method?.notes || lookup.entityNote || ''
  };
}

module.exports = {
  parseSearchQuery,
  buildCard,
  buildSummary,
  formatMoney,
  resolveHealedUrl,
  methodFromFeedback
};
