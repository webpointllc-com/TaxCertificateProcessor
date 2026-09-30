'use strict';

const crypto = require('crypto');
const drProduction = require('../services/drProduction');

const memory = {
  extractors: [],
  versions: [],
  feedback: [],
  validationRuns: []
};

let pool = null;

function id() {
  return crypto.randomUUID();
}

function attachPool(p) {
  pool = p;
}

function usingPostgres() {
  return Boolean(pool);
}

function publicExtractor(row) {
  if (!row) return null;
  let method = row.method;
  if (typeof method === 'string') {
    try {
      method = JSON.parse(method);
    } catch {
      method = { steps: [], search_by: [], notes: method };
    }
  }
  return {
    id: row.id,
    jurisdiction_key: row.jurisdiction_key,
    county: row.county,
    state: row.state,
    entity: row.entity,
    search_url: row.search_url || '',
    method: method || { steps: [], search_by: ['parcel', 'owner', 'address'], notes: '' },
    version: Number(row.version) || 1,
    status: row.status || 'active',
    source: row.source || 'seed',
    validated: row.validated !== false && row.validated !== 0,
    notes: row.notes || '',
    parcel_format: row.parcel_format || '',
    exceptions: parseJson(row.exceptions, []),
    layout: parseJson(row.layout, {}),
    role: 'county_agent',
    updated_at: row.updated_at,
    created_at: row.created_at
  };
}

function parseJson(value, fallback) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function defaultMethod(lookup) {
  if (lookup.method && Array.isArray(lookup.method.steps) && lookup.method.steps.length) {
    return {
      steps: lookup.method.steps.slice(0, 12),
      search_by: lookup.method.search_by || lookup.layout?.search_by || ['parcel', 'owner', 'address'],
      notes: lookup.method.notes || lookup.entityNote || lookup.howFound || ''
    };
  }
  const entity = lookup.entity || 'the tax collecting entity';
  const fields = Array.isArray(lookup.layout?.fields)
    ? lookup.layout.fields.map((f) => f.label || f.role).filter(Boolean).join(', ')
    : '';
  return {
    steps: [
      `Open the official ${entity} tax search page`,
      fields ? `Target the search fields: ${fields}` : 'Search by parcel / APN / account number using this county\'s parcel format (do not reuse another county\'s hyphenation)',
      'Search by owner last name (entering less is more)',
      'Fill the DR Production Results row (finale/ 40-column document) for this parcel. Talk about the whole row unless the user names one field.',
      'Confirm current and delinquent amounts on that collector page before closing'
    ],
    search_by: lookup.layout?.search_by || ['parcel', 'owner', 'address'],
    notes: lookup.entityNote || lookup.howFound || lookup.source || ''
  };
}

async function findActive(jurisdictionKey) {
  if (!jurisdictionKey) return null;
  if (usingPostgres()) {
    const { rows } = await pool.query(
      `SELECT * FROM extractors WHERE jurisdiction_key = $1 AND status = 'active' ORDER BY version DESC LIMIT 1`,
      [jurisdictionKey]
    );
    return rows[0] ? publicExtractor(rows[0]) : null;
  }
  const rows = memory.extractors
    .filter((e) => e.jurisdiction_key === jurisdictionKey && e.status === 'active')
    .sort((a, b) => b.version - a.version);
  return rows[0] ? publicExtractor(rows[0]) : null;
}

async function ensureSlot(lookup) {
  const key = lookup.key || `${(lookup.jurisdiction?.state || lookup.canonicalState || '').toUpperCase()}-${lookup.jurisdiction?.county || lookup.canonicalCounty || ''}`;
  const existing = await findActive(key);
  if (existing) return existing;
  const county = lookup.jurisdiction?.county || lookup.canonicalCounty || '';
  const state = (lookup.jurisdiction?.state || lookup.canonicalState || '').toUpperCase();
  const url = lookup.officialUrl || lookup.lockedUrl || lookup.url || '';
  const production = drProduction.attachLayout(key);
  const layout =
    lookup.layout && typeof lookup.layout === 'object'
      ? { ...lookup.layout, production }
      : { production };
  const row = {
    id: id(),
    jurisdiction_key: key,
    county,
    state,
    entity: lookup.entity || `${county} County ${state}`,
    search_url: lookup.urlLocked ? url : '',
    method: defaultMethod(lookup),
    version: 1,
    status: 'active',
    source: 'seed',
    validated: Boolean(lookup.urlLocked),
    notes: lookup.urlLocked
      ? (lookup.howFound || 'Seeded from locked Search Spul URL')
      : 'No locked collector URL — waiting for a validated extractor. Output document is DR Production Results (finale/).',
    parcel_format: lookup.parcelFormat || drProduction.parcelFormatFor(key) || '',
    exceptions: [],
    layout,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  if (usingPostgres()) {
    await pool.query(
      `INSERT INTO extractors
        (id, jurisdiction_key, county, state, entity, search_url, method, version, status, source, validated, notes, parcel_format, exceptions, layout)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13,$14::jsonb,$15::jsonb)`,
      [
        row.id, row.jurisdiction_key, row.county, row.state, row.entity, row.search_url,
        JSON.stringify(row.method), row.version, row.status, row.source, row.validated, row.notes,
        row.parcel_format || '', JSON.stringify(row.exceptions || []), JSON.stringify(row.layout || {})
      ]
    );
  } else {
    memory.extractors.push(row);
  }
  return publicExtractor(row);
}

async function saveNewVersion({ previous, lookup, method, notes, source, accountId, searchUrl }) {
  const key = previous?.jurisdiction_key || lookup.key;
  const nextVersion = (previous?.version || 0) + 1;
  const url = searchUrl || previous?.search_url || lookup.officialUrl || '';
  const row = {
    id: id(),
    jurisdiction_key: key,
    county: previous?.county || lookup.jurisdiction?.county || '',
    state: previous?.state || lookup.jurisdiction?.state || '',
    entity: previous?.entity || lookup.entity || '',
    search_url: url,
    method: method || previous?.method || defaultMethod(lookup || {}),
    version: nextVersion,
    status: 'active',
    source: source || 'heal',
    validated: true,
    notes: notes || '',
    parcel_format: previous?.parcel_format || '',
    exceptions: previous?.exceptions || [],
    layout: previous?.layout || {},
    account_id: accountId || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (usingPostgres()) {
    await pool.query(`UPDATE extractors SET status = 'superseded', updated_at = now() WHERE jurisdiction_key = $1 AND status = 'active'`, [key]);
    await pool.query(
      `INSERT INTO extractors
        (id, jurisdiction_key, county, state, entity, search_url, method, version, status, source, validated, notes, account_id, parcel_format, exceptions, layout)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16::jsonb)`,
      [
        row.id, row.jurisdiction_key, row.county, row.state, row.entity, row.search_url,
        JSON.stringify(row.method), row.version, row.status, row.source, row.validated, row.notes, row.account_id,
        row.parcel_format || '', JSON.stringify(row.exceptions || []), JSON.stringify(row.layout || {})
      ]
    );
    await pool.query(
      `INSERT INTO extractor_versions (id, extractor_id, jurisdiction_key, version, search_url, method, source, notes, account_id)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9)`,
      [id(), row.id, key, row.version, row.search_url, JSON.stringify(row.method), row.source, row.notes, row.account_id]
    );
  } else {
    memory.extractors.forEach((e) => {
      if (e.jurisdiction_key === key && e.status === 'active') e.status = 'superseded';
    });
    memory.extractors.push(row);
    memory.versions.push({
      id: id(),
      extractor_id: row.id,
      jurisdiction_key: key,
      version: row.version,
      search_url: row.search_url,
      method: row.method,
      source: row.source,
      notes: row.notes,
      account_id: row.account_id,
      created_at: row.created_at
    });
  }
  return publicExtractor(row);
}

async function markBroken(jurisdictionKey, notes) {
  const active = await findActive(jurisdictionKey);
  if (!active) return null;
  if (usingPostgres()) {
    await pool.query(
      `UPDATE extractors SET status = 'broken', notes = $2, updated_at = now() WHERE id = $1`,
      [active.id, notes || active.notes]
    );
  } else {
    const row = memory.extractors.find((e) => e.id === active.id);
    if (row) {
      row.status = 'broken';
      row.notes = notes || row.notes;
    }
  }
  return findActive(jurisdictionKey);
}

async function rememberDiscovery({ agent, lookup, discoveries, accountId }) {
  const key = agent?.jurisdiction_key || lookup?.key;
  if (!key) return agent;
  const current = (await findActive(key)) || agent;
  let parcel_format = current.parcel_format || '';
  let exceptions = Array.isArray(current.exceptions) ? current.exceptions.slice() : [];
  const layout = current.layout && typeof current.layout === 'object' ? { ...current.layout } : {};
  let changed = false;
  for (const d of discoveries || []) {
    if (d.kind === 'parcel_format' && d.value) {
      if (!parcel_format) {
        parcel_format = d.value;
        changed = true;
      } else if (d.value !== parcel_format) {
        const already = exceptions.some((e) => e.kind === 'parcel_format_variant' && e.value === d.value);
        if (!already) {
          exceptions.push({
            kind: 'parcel_format_variant',
            value: d.value,
            sample: d.sample || '',
            at: new Date().toISOString()
          });
          changed = true;
        }
      }
    }
    if (d.kind === 'url_change_detected') {
      exceptions.push({
        kind: 'url_mismatch',
        observed: d.value,
        kept: d.kept,
        at: new Date().toISOString()
      });
      changed = true;
    }
    if (d.kind === 'exception' || d.kind === 'layout') {
      exceptions.push({
        kind: d.kind,
        value: d.value,
        account_id: accountId || null,
        at: new Date().toISOString()
      });
      changed = true;
    }
  }
  exceptions = exceptions.slice(-40);
  if (!changed) return current;
  const mem = memory.extractors.find((e) => e.id === current.id);
  if (mem) {
    mem.parcel_format = parcel_format;
    mem.exceptions = exceptions;
    mem.layout = layout;
    mem.updated_at = new Date().toISOString();
  } else {
    current.parcel_format = parcel_format;
    current.exceptions = exceptions;
    current.layout = layout;
  }
  if (usingPostgres()) {
    await pool.query(
      `UPDATE extractors
       SET parcel_format = $2, exceptions = $3::jsonb, layout = $4::jsonb, updated_at = now()
       WHERE id = $1`,
      [current.id, parcel_format, JSON.stringify(exceptions), JSON.stringify(layout)]
    );
  }
  return findActive(key);
}

async function addFeedback({ accountId, jurisdictionKey, kind, body, extractorId }) {
  const row = {
    id: id(),
    account_id: accountId || null,
    jurisdiction_key: jurisdictionKey || '',
    extractor_id: extractorId || null,
    kind: kind || 'session',
    body: String(body || '').slice(0, 4000),
    created_at: new Date().toISOString()
  };
  if (usingPostgres()) {
    await pool.query(
      `INSERT INTO session_feedback (id, account_id, jurisdiction_key, extractor_id, kind, body)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [row.id, row.account_id, row.jurisdiction_key, row.extractor_id, row.kind, row.body]
    );
  } else {
    memory.feedback.unshift(row);
  }
  return row;
}

async function listActive(limit = 40) {
  const cap = Math.max(1, Math.min(Number(limit) || 40, 200));
  if (usingPostgres()) {
    const { rows } = await pool.query(
      `SELECT * FROM extractors WHERE status = 'active' ORDER BY updated_at DESC LIMIT $1`,
      [cap]
    );
    return rows.map(publicExtractor);
  }
  return memory.extractors
    .filter((e) => e.status === 'active')
    .sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))
    .slice(0, cap)
    .map(publicExtractor);
}

async function stats() {
  if (usingPostgres()) {
    const { rows } = await pool.query(
      `SELECT status, COUNT(*)::int AS n FROM extractors GROUP BY status`
    );
    const by = Object.fromEntries(rows.map((r) => [r.status, r.n]));
    return {
      active: by.active || 0,
      broken: by.broken || 0,
      superseded: by.superseded || 0,
      pending: by.pending || 0
    };
  }
  const tally = { active: 0, broken: 0, superseded: 0, pending: 0 };
  for (const e of memory.extractors) {
    tally[e.status] = (tally[e.status] || 0) + 1;
  }
  return tally;
}

async function recordPortalSession({ accountId, sessionId, jurisdictionKey, event, fields, notes }) {
  const headers = Array.isArray(fields) ? fields.filter(Boolean).slice(0, 40) : [];
  const vendorFamily = require('../services/vendorFamily');
  const portalAccessToken = require('../services/portalAccessToken');
  const siteValidator = require('../services/siteValidator');
  const agent = await findActive(jurisdictionKey);
  const family = vendorFamily.classify(agent && agent.search_url, 1);
  const issued = portalAccessToken.mint({
    sessionId,
    accountId,
    jurisdictionKey,
    familyId: family.family,
    lookFor: headers.length ? headers : siteValidator.lookForHeaders()
  });
  const row = {
    id: id(),
    account_id: accountId || null,
    session_id: sessionId || null,
    jurisdiction_key: jurisdictionKey || '',
    event: String(event || 'opened_portal').slice(0, 80),
    fields: headers,
    notes: String(notes || '').slice(0, 1000),
    family_id: family.family,
    token_hash: issued.token_hash,
    expires_at: issued.expires_at,
    created_at: new Date().toISOString()
  };
  if (usingPostgres()) {
    await pool.query(
      `INSERT INTO extractor_portal_sessions
        (id, account_id, session_id, jurisdiction_key, event, fields, notes, token_hash, expires_at, family_id)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10)`,
      [
        row.id,
        row.account_id,
        row.session_id,
        row.jurisdiction_key,
        row.event,
        JSON.stringify(row.fields),
        row.notes,
        row.token_hash,
        row.expires_at,
        row.family_id
      ]
    );
  }
  if (agent) {
    await rememberDiscovery({
      agent,
      lookup: { key: jurisdictionKey },
      accountId,
      discoveries: [
        { kind: 'layout', value: `portal_session:${row.event}:${family.family}` },
        headers.length ? { kind: 'exception', value: `look_for ${headers.join(', ')}` } : null
      ].filter(Boolean)
    });
  }
  await addFeedback({
    accountId,
    jurisdictionKey,
    kind: 'portal_session',
    body: `${row.event} ${family.family} ${headers.join(', ')} ${row.notes}`.trim()
  });
  return {
    id: row.id,
    jurisdiction_key: row.jurisdiction_key,
    event: row.event,
    family: family.family,
    created_at: row.created_at,
    pat: portalAccessToken.publicHandle(issued)
  };
}

function mapValidationRow(row) {
  if (!row) return null;
  return {
    generatedAt: row.generated_at || row.generatedAt,
    probed: row.probed || 0,
    counts: row.counts || {},
    lookForHits: row.look_for_hits || row.lookForHits || {},
    method: row.method || '',
    how: row.how || [],
    lookFor: row.lookFor
  };
}

async function recordValidationRun(run) {
  const mapped = {
    generatedAt: run.generatedAt || new Date().toISOString(),
    probed: Number(run.probed) || 0,
    counts: run.counts || {},
    lookForHits: run.lookForHits || {},
    method: run.method || '',
    how: Array.isArray(run.how) ? run.how : [],
    lookFor: run.lookFor || []
  };
  memory.validationRuns.push(mapped);
  if (memory.validationRuns.length > 12) memory.validationRuns.splice(0, memory.validationRuns.length - 12);
  if (usingPostgres()) {
    const existing = await pool.query(
      `SELECT id FROM validation_runs WHERE generated_at = $1 LIMIT 1`,
      [mapped.generatedAt]
    );
    if (!existing.rows.length) {
      await pool.query(
        `INSERT INTO validation_runs
          (id, generated_at, probed, counts, look_for_hits, method, how, notes)
         VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7::jsonb,$8)`,
        [
          id(),
          mapped.generatedAt,
          mapped.probed,
          JSON.stringify(mapped.counts),
          JSON.stringify(mapped.lookForHits),
          mapped.method,
          JSON.stringify(mapped.how),
          mapped.how.join(' ')
        ]
      );
    }
  }
  return mapped;
}

async function latestValidationRun() {
  let dbRun = null;
  if (usingPostgres()) {
    const { rows } = await pool.query(
      `SELECT * FROM validation_runs ORDER BY generated_at DESC LIMIT 1`
    );
    dbRun = mapValidationRow(rows[0]);
  } else if (memory.validationRuns.length) {
    dbRun = memory.validationRuns[memory.validationRuns.length - 1];
  }
  const siteValidator = require('../services/siteValidator');
  return siteValidator.fresherRun(siteValidator.loadLastRun(), dbRun);
}

function resetMemory() {
  memory.extractors.length = 0;
  memory.versions.length = 0;
  memory.feedback.length = 0;
  memory.validationRuns.length = 0;
}

module.exports = {
  attachPool,
  ensureSlot,
  findActive,
  saveNewVersion,
  markBroken,
  rememberDiscovery,
  addFeedback,
  recordPortalSession,
  recordValidationRun,
  latestValidationRun,
  listActive,
  stats,
  defaultMethod,
  publicExtractor,
  resetMemory
};
