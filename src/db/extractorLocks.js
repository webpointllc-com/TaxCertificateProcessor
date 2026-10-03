'use strict';

// Extractor lock proposals and approvals.
//
// Rules (tests cover each):
//   1. Anyone with editor access (human or Claude) may PROPOSE a lock with probe evidence.
//   2. Only a HUMAN editor may approve or reject. Claude never locks a URL by itself.
//   3. Only http(s) URLs that are not Google fallbacks can be proposed.
//   4. An approval takes effect at once: urlFinder.setRuntimeLocks() is refreshed, and the
//      county's extractor slot gets a new version with the approved search_url.

const crypto = require('crypto');
const { isRealHttpUrl, isGoogleFallbackUrl } = require('../services/spulTruth');

const memory = { proposals: [] };
let pool = null;

function attachPool(p) {
  pool = p;
}

function usingPostgres() {
  return Boolean(pool);
}

function view(row) {
  if (!row) return null;
  const parse = (v, d) => (typeof v === 'string' ? JSON.parse(v) : v || d);
  return {
    id: row.id,
    jurisdiction_key: row.jurisdiction_key,
    state: row.state,
    county: row.county,
    url: row.url,
    verdict: row.verdict,
    reason: row.reason,
    dr_fields: parse(row.dr_fields, []),
    evidence: parse(row.evidence, {}),
    proposer: row.proposer,
    proposer_role: row.proposer_role,
    status: row.status,
    reviewer: row.reviewer || null,
    review_note: row.review_note || null,
    created_at: row.created_at,
    reviewed_at: row.reviewed_at || null
  };
}

async function propose({ jurisdictionKey, state, county, url, verdict, reason, drFields, evidence, proposer, role }) {
  const key = String(jurisdictionKey || '').trim();
  if (!key) return { ok: false, status: 400, error: 'jurisdiction_key is required, e.g. WI-Chippewa' };
  if (!isRealHttpUrl(url) || isGoogleFallbackUrl(url)) {
    return { ok: false, status: 400, error: 'Propose a real http(s) collector search URL, not a Google fallback' };
  }
  const row = {
    id: crypto.randomUUID(),
    jurisdiction_key: key,
    state: state || key.split('-')[0] || null,
    county: county || key.split('-').slice(1).join('-') || null,
    url: String(url).trim(),
    verdict: verdict || null,
    reason: reason || null,
    dr_fields: Array.isArray(drFields) ? drFields.slice(0, 40) : [],
    evidence: evidence && typeof evidence === 'object' ? evidence : {},
    proposer: String(proposer || role || 'unknown').slice(0, 120),
    proposer_role: role || 'human',
    status: 'pending',
    reviewer: null,
    review_note: null,
    created_at: new Date().toISOString(),
    reviewed_at: null
  };
  if (usingPostgres()) {
    // One open proposal per key + URL; a repeat refreshes the evidence instead of piling up.
    const { rows: open } = await pool.query(
      `SELECT id FROM extractor_lock_proposals WHERE jurisdiction_key = $1 AND url = $2 AND status = 'pending' LIMIT 1`,
      [row.jurisdiction_key, row.url]
    );
    if (open[0]) {
      const { rows } = await pool.query(
        `UPDATE extractor_lock_proposals SET verdict=$2, reason=$3, dr_fields=$4::jsonb, evidence=$5::jsonb, proposer=$6, proposer_role=$7
          WHERE id=$1 RETURNING *`,
        [open[0].id, row.verdict, row.reason, JSON.stringify(row.dr_fields), JSON.stringify(row.evidence), row.proposer, row.proposer_role]
      );
      return { ok: true, refreshed: true, proposal: view(rows[0]) };
    }
    const { rows } = await pool.query(
      `INSERT INTO extractor_lock_proposals
         (id, jurisdiction_key, state, county, url, verdict, reason, dr_fields, evidence, proposer, proposer_role, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11,'pending') RETURNING *`,
      [row.id, row.jurisdiction_key, row.state, row.county, row.url, row.verdict, row.reason,
        JSON.stringify(row.dr_fields), JSON.stringify(row.evidence), row.proposer, row.proposer_role]
    );
    return { ok: true, proposal: view(rows[0]) };
  }
  const existing = memory.proposals.find((p) => p.jurisdiction_key === row.jurisdiction_key && p.url === row.url && p.status === 'pending');
  if (existing) {
    Object.assign(existing, { verdict: row.verdict, reason: row.reason, dr_fields: row.dr_fields, evidence: row.evidence, proposer: row.proposer, proposer_role: row.proposer_role });
    return { ok: true, refreshed: true, proposal: view(existing) };
  }
  memory.proposals.push(row);
  return { ok: true, proposal: view(row) };
}

async function list({ status = 'pending', key = null, limit = 50 } = {}) {
  const n = Math.max(1, Math.min(Number(limit) || 50, 200));
  if (usingPostgres()) {
    const { rows } = await pool.query(
      `SELECT * FROM extractor_lock_proposals
        WHERE ($1::text = 'all' OR status = $1) AND ($2::text IS NULL OR jurisdiction_key = $2)
        ORDER BY created_at ASC LIMIT $3`,
      [status, key, n]
    );
    return rows.map(view);
  }
  return memory.proposals
    .filter((p) => (status === 'all' || p.status === status) && (!key || p.jurisdiction_key === key))
    .slice(0, n)
    .map(view);
}

async function find(id) {
  if (usingPostgres()) {
    const { rows } = await pool.query(`SELECT * FROM extractor_lock_proposals WHERE id = $1`, [id]);
    return view(rows[0]);
  }
  return view(memory.proposals.find((p) => p.id === id));
}

// Latest approved proposal per key; this is what overrides the file catalog.
async function approvedLocks() {
  if (usingPostgres()) {
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (jurisdiction_key) * FROM extractor_lock_proposals
        WHERE status = 'approved' ORDER BY jurisdiction_key, reviewed_at DESC`
    );
    return rows.map(view);
  }
  const latest = new Map();
  for (const p of memory.proposals.filter((x) => x.status === 'approved')) {
    const cur = latest.get(p.jurisdiction_key);
    if (!cur || String(p.reviewed_at) > String(cur.reviewed_at)) latest.set(p.jurisdiction_key, p);
  }
  return [...latest.values()].map(view);
}

async function refreshRuntimeLocks() {
  const urlFinder = require('../services/urlFinder');
  return urlFinder.setRuntimeLocks(await approvedLocks());
}

async function decide({ id, action, reviewer, note, role = 'human' }) {
  if (role !== 'human') {
    return { ok: false, status: 403, error: 'Only a human editor can approve or reject a lock. Claude can propose.' };
  }
  const status = { approve: 'approved', reject: 'rejected' }[action];
  if (!status) return { ok: false, status: 400, error: 'action must be approve or reject' };
  const current = await find(id);
  if (!current) return { ok: false, status: 404, error: 'No lock proposal with that id' };
  if (current.status !== 'pending') return { ok: false, status: 409, error: `Already ${current.status}` };
  const reviewedAt = new Date().toISOString();
  const who = String(reviewer || 'editor').slice(0, 120);
  const why = note ? String(note).slice(0, 2000) : null;
  if (usingPostgres()) {
    await pool.query(
      `UPDATE extractor_lock_proposals SET status=$2, reviewer=$3, review_note=$4, reviewed_at=$5 WHERE id=$1`,
      [id, status, who, why, reviewedAt]
    );
  } else {
    Object.assign(memory.proposals.find((p) => p.id === id), { status, reviewer: who, review_note: why, reviewed_at: reviewedAt });
  }
  let extractor = null;
  if (status === 'approved') {
    await refreshRuntimeLocks();
    extractor = await writeExtractorVersion(current, who);
  }
  return { ok: true, proposal: await find(id), extractor };
}

async function writeExtractorVersion(proposal, reviewer) {
  try {
    const extractors = require('./extractors');
    const urlFinder = require('../services/urlFinder');
    const base = urlFinder.lookupForApi(proposal.county, proposal.state);
    const lookup = {
      ...base,
      key: proposal.jurisdiction_key,
      jurisdiction: { county: base.canonicalCounty || proposal.county, state: base.canonicalState || proposal.state }
    };
    const previous = await extractors.ensureSlot(lookup);
    return await extractors.saveNewVersion({
      previous,
      lookup,
      method: previous && previous.method,
      notes: `Editor-approved lock by ${reviewer}. Probe: ${proposal.verdict || 'n/a'} (${proposal.reason || 'n/a'}); DR fields: ${(proposal.dr_fields || []).join(', ') || 'none seen'}.`,
      source: 'editor_lock',
      searchUrl: proposal.url
    });
  } catch (err) {
    console.error('editor lock extractor version', err.message);
    return null;
  }
}

async function stats() {
  const base = { pending: 0, approved: 0, rejected: 0 };
  if (usingPostgres()) {
    const { rows } = await pool.query(`SELECT status, count(*)::int AS n FROM extractor_lock_proposals GROUP BY status`);
    for (const r of rows) base[r.status] = r.n;
    return base;
  }
  for (const p of memory.proposals) base[p.status] = (base[p.status] || 0) + 1;
  return base;
}

function resetMemory() {
  memory.proposals = [];
}

module.exports = { attachPool, propose, list, find, decide, approvedLocks, refreshRuntimeLocks, stats, resetMemory };
