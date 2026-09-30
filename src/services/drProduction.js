'use strict';

const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '../../finale/schema.json');
const samplesPath = path.join(__dirname, '../../finale/samples.json');

let schemaCache = null;
let samplesCache = null;

function loadSchema() {
  if (!schemaCache) {
    schemaCache = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  }
  return schemaCache;
}

function loadSamples() {
  if (!samplesCache) {
    if (!fs.existsSync(samplesPath)) {
      samplesCache = { rows: [], files: {} };
    } else {
      samplesCache = JSON.parse(fs.readFileSync(samplesPath, 'utf8'));
    }
  }
  return samplesCache;
}

function invalidateFinaleCache() {
  schemaCache = null;
  samplesCache = null;
}

function columns() {
  return loadSchema().columns || [];
}

function headers() {
  return columns().map((c) => c.header);
}

function emptyRow() {
  const row = {};
  for (const col of columns()) row[col.header] = null;
  return row;
}

function compactKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function agencyForLookupKey(lookupKey) {
  const schema = loadSchema();
  const wanted = compactKey(lookupKey);
  for (const [agency, meta] of Object.entries(schema.agency_to_jurisdiction || {})) {
    const keys = [agency, ...(meta.keys || [])];
    if (keys.some((k) => compactKey(k) === wanted)) return agency;
    if (compactKey(`${meta.state}-${meta.county}`) === wanted) return agency;
  }
  return '';
}

function parcelFormatFor(lookupKey) {
  const agency = agencyForLookupKey(lookupKey);
  const formats = loadSchema().parcel_formats || {};
  return formats[agency] || '';
}

function attachLayout(lookupKey) {
  return {
    document: loadSchema().name,
    talk: loadSchema().talk,
    columns: headers(),
    agency: agencyForLookupKey(lookupKey) || null,
    parcel_format: parcelFormatFor(lookupKey) || null,
    source: 'finale/'
  };
}

function normalizeParcel(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[\s.]/g, '');
}

function rowFor({ lookupKey, county, state, parcel, taxId }) {
  const agency = agencyForLookupKey(lookupKey || `${state}-${county}`);
  const wantParcel = normalizeParcel(parcel);
  const wantTax = normalizeParcel(taxId || parcel);
  const rows = loadSamples().rows || [];
  const pool = agency
    ? rows.filter((r) => compactKey(r['Agency Name']) === compactKey(agency))
    : rows;
  if (!wantParcel && !wantTax) return null;
  return (
    pool.find((r) => normalizeParcel(r['Parcel Number']) === wantParcel) ||
    pool.find((r) => normalizeParcel(r['Tax Id']) === wantTax) ||
    null
  );
}

function filledHeaders(row) {
  if (!row) return [];
  return headers().filter((h) => row[h] !== null && row[h] !== undefined && row[h] !== '');
}

function namedField(message) {
  const text = String(message || '').toLowerCase();
  if (!text.trim()) return null;
  const hits = [];
  for (const col of columns()) {
    const names = [col.header, ...(col.aliases || [])]
      .map((n) => String(n).toLowerCase())
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);
    for (const name of names) {
      const isHeader = name === String(col.header).toLowerCase();
      if (!isHeader && name.length < 8 && !/\s/.test(name)) continue;
      const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')}\\b`, 'i');
      if (re.test(text)) {
        hits.push({ col, name });
        break;
      }
    }
  }
  const unique = [];
  const seen = new Set();
  for (const hit of hits) {
    if (seen.has(hit.col.header)) continue;
    seen.add(hit.col.header);
    unique.push(hit);
  }
  if (unique.length !== 1) return null;
  return unique[0].col;
}

function isolate(row, field) {
  if (!field) return null;
  const value = row ? (Object.prototype.hasOwnProperty.call(row, field.header) ? row[field.header] : null) : null;
  return {
    header: field.header,
    key: field.key,
    value: value === undefined ? null : value,
    meaning: field.meaning,
    empty: value === null || value === undefined || value === ''
  };
}

function speak({ county, state, parcel, row, isolated }) {
  const place = [county, state].filter(Boolean).join(', ') || 'this jurisdiction';
  const parcelLabel = parcel || row?.['Parcel Number'] || 'this parcel';
  if (isolated) {
    if (isolated.empty) {
      return `${isolated.header} is empty on the DR Production Results row for ${parcelLabel} in ${place}. We do not invent it.`;
    }
    return `${isolated.header} for ${parcelLabel} in ${place} is ${isolated.value}.`;
  }
  if (!row) {
    return `No finale production row is on file yet for ${parcelLabel} in ${place}. The extractor still knows the 40-column DR document. Empty cells stay empty; confirm amounts on the locked collector when we have one.`;
  }
  const bits = [];
  if (row['Bill Year'] != null) bits.push(`bill year ${row['Bill Year']}`);
  if (row['Bill Amount'] != null) bits.push(`bill amount ${row['Bill Amount']}`);
  if (row['Balance Due'] != null) bits.push(`balance due ${row['Balance Due']}`);
  const filled = filledHeaders(row).length;
  const summary = bits.length ? bits.join(', ') : 'see the production row';
  return `DR Production Results for ${parcelLabel} in ${place}: ${summary}. ${filled} of 40 columns have values. Ask about a named field to isolate it.`;
}

function llmBlock({ lookupKey, county, state, parcel, message }) {
  const schema = loadSchema();
  const row = rowFor({ lookupKey, county, state, parcel });
  const field = namedField(message);
  const isolated = field ? isolate(row, field) : null;
  return {
    document: schema.name,
    talk: schema.talk,
    columns: headers(),
    agency: agencyForLookupKey(lookupKey || `${state}-${county}`) || null,
    parcel_format: parcelFormatFor(lookupKey || `${state}-${county}`) || null,
    row: row || emptyRow(),
    on_file: Boolean(row),
    isolated_field: isolated,
    speak: speak({ county, state, parcel, row, isolated })
  };
}

function productionPrompt(block) {
  if (!block) return '';
  const isolateLine = block.isolated_field
    ? `The user named one column: ${block.isolated_field.header}. Answer only that field. Value: ${
        block.isolated_field.empty ? '(empty — do not invent)' : block.isolated_field.value
      }. Meaning: ${block.isolated_field.meaning}`
    : 'Do not walk the columns one by one. Speak about the production document as one row for this parcel in this county/state. Isolate a column only if the user names it.';
  return [
    '--- DR PRODUCTION RESULTS (finale/) ---',
    `Document: ${block.document}. ${headers().length} columns. Parcel format for this extractor: ${
      block.parcel_format || 'learn from this county, do not copy another county'
    }.`,
    isolateLine,
    `On file: ${block.on_file ? 'yes' : 'no'}. ${block.speak}`,
    'Seeds for this row: finale/ workbooks, Searching inventory, Extractor table dump, then user/live feedback on this county extractor. Parcel format is per county.',
    'Empty cells stay empty. Never invent a collector URL or a dollar amount.'
  ].join('\n');
}

module.exports = {
  loadSchema,
  loadSamples,
  invalidateFinaleCache,
  columns,
  headers,
  emptyRow,
  agencyForLookupKey,
  parcelFormatFor,
  attachLayout,
  rowFor,
  namedField,
  isolate,
  speak,
  llmBlock,
  productionPrompt
};
