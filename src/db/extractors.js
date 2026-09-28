'use strict';

const crypto = require('crypto');

const memory = {
  extractors: [],
  versions: [],
  feedback: []
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
    updated_at: row.updated_at,
    created_at: row.created_at
  };
}

function defaultMethod(lookup) {
  const entity = lookup.entity || 'the tax collecting entity';
  return {
    steps: [
      `Open the official ${entity} tax search page`,
      'Search by parcel / APN / account number',
      'Search by owner last name (entering less is more)',
      'Confirm current and delinquent amounts on that collector page before closing'
    ],
    search_by: ['parcel', 'owner', 'address'],
    notes: lookup.entityNote || lookup.source || ''
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
    notes: lookup.urlLocked ? 'Seeded from locked Search Spul URL' : 'No locked collector URL — waiting for a validated extractor',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  if (usingPostgres()) {
    await pool.query(
      `INSERT INTO extractors
        (id, jurisdiction_key, county, state, entity, search_url, method, version, status, source, validated, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12)`,
      [
        row.id, row.jurisdiction_key, row.county, row.state, row.entity, row.search_url,
        JSON.stringify(row.method), row.version, row.status, row.source, row.validated, row.notes
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
    account_id: accountId || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (usingPostgres()) {
    await pool.query(`UPDATE extractors SET status = 'superseded', updated_at = now() WHERE jurisdiction_key = $1 AND status = 'active'`, [key]);
    await pool.query(
      `INSERT INTO extractors
        (id, jurisdiction_key, county, state, entity, search_url, method, version, status, source, validated, notes, account_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13)`,
      [
        row.id, row.jurisdiction_key, row.county, row.state, row.entity, row.search_url,
        JSON.stringify(row.method), row.version, row.status, row.source, row.validated, row.notes, row.account_id
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

function resetMemory() {
  memory.extractors.length = 0;
  memory.versions.length = 0;
  memory.feedback.length = 0;
}

module.exports = {
  attachPool,
  ensureSlot,
  findActive,
  saveNewVersion,
  markBroken,
  addFeedback,
  listActive,
  stats,
  defaultMethod,
  publicExtractor,
  resetMemory
};
