'use strict';

// Consent-gated training data for the WebPoint own model.
//
// Rules this module enforces (tests cover each one):
//   1. Nothing is captured unless the signed-in account has learn_consent === true.
//   2. Export re-checks CURRENT consent. An account that turns learning off drops out
//      of every future export, even for rows captured while it was on.
//   3. Rows rated -1 (thumbs down) never train the model.
//   4. forgetAccount() removes every row for an account (Delete my data).
//   5. Retention 90d / 1y / until_delete on the account is applied to training_examples.
//   6. EDITOR PROTOCOL: only rows a human editor approved (or approved with a correction)
//      are exported. Claude may flag rows with a suggested fix, but a flag never trains.
//      Corrected replies replace the original answer in the training data.

const crypto = require('crypto');
const accounts = require('./accounts');

const MAX_CONTENT = 8000;
const RETENTION_POLICIES = ['90d', '1y', 'until_delete'];
const RETENTION_MS = {
  '90d': 90 * 24 * 60 * 60 * 1000,
  '1y': 365 * 24 * 60 * 60 * 1000,
  until_delete: null
};
const memory = { examples: [] };
let pool = null;

function normalizeRetention(value) {
  const v = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (v === '90d' || v === '90' || v === '90_days' || v === '90days') return '90d';
  if (v === '1y' || v === '1_year' || v === 'year' || v === '365d' || v === '12m') return '1y';
  if (v === 'until_delete' || v === 'untildelete' || v === 'keep' || v === 'forever') return 'until_delete';
  return null;
}

function policyOf(account) {
  return normalizeRetention(account && account.training_retention) || 'until_delete';
}

function isExpired(createdAt, policy, nowMs = Date.now()) {
  const windowMs = RETENTION_MS[policy];
  if (!windowMs) return false;
  const t = new Date(createdAt).getTime();
  if (!Number.isFinite(t)) return false;
  return t < nowMs - windowMs;
}

function attachPool(p) {
  pool = p;
}

function usingPostgres() {
  return Boolean(pool);
}

function clip(text) {
  return String(text == null ? '' : text).slice(0, MAX_CONTENT);
}

function cleanMessages(messages) {
  return (Array.isArray(messages) ? messages : [])
    .filter((m) => m && ['system', 'user', 'assistant'].includes(m.role) && m.content)
    .map((m) => ({ role: m.role, content: clip(m.content) }));
}

async function capture({ account, route, jurisdictionKey, messages, reply, model, createdAt }) {
  if (!account || account.learn_consent !== true) return null;
  const msgs = cleanMessages(messages);
  const text = clip(reply).trim();
  if (!msgs.length || !text) return null;
  const row = {
    id: crypto.randomUUID(),
    account_id: account.id,
    route: route || 'chat',
    jurisdiction_key: jurisdictionKey || null,
    messages: msgs,
    reply: text,
    model: model || null,
    rating: null,
    review_status: 'pending',
    corrected_reply: null,
    review_note: null,
    reviewer: null,
    reviewed_at: null,
    created_at: createdAt ? new Date(createdAt).toISOString() : new Date().toISOString()
  };
  try {
    if (usingPostgres()) {
      await pool.query(
        `INSERT INTO training_examples (id, account_id, route, jurisdiction_key, messages, reply, model, created_at)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8::timestamptz)`,
        [row.id, row.account_id, row.route, row.jurisdiction_key, JSON.stringify(row.messages), row.reply, row.model, row.created_at]
      );
    } else {
      memory.examples.push(row);
    }
  } catch (err) {
    // Training capture must never break a user request.
    console.error('training capture', err.message);
    return null;
  }
  return row;
}

async function rate({ accountId, exampleId, rating }) {
  const value = rating > 0 ? 1 : rating < 0 ? -1 : 0;
  if (usingPostgres()) {
    const { rowCount } = await pool.query(
      `UPDATE training_examples SET rating = $3 WHERE id = $1 AND account_id = $2`,
      [exampleId, accountId, value]
    );
    return rowCount > 0;
  }
  const row = memory.examples.find((r) => r.id === exampleId && r.account_id === accountId);
  if (!row) return false;
  row.rating = value;
  return true;
}

const REVIEW_STATUSES = ['pending', 'flagged', 'approved', 'edited', 'rejected'];
const TRAINABLE = ['approved', 'edited'];

function finalReply(row) {
  return row.review_status === 'edited' && row.corrected_reply ? row.corrected_reply : row.reply;
}

async function exportExamples({ since = null, limit = 50000, now = Date.now() } = {}) {
  await purgeExpired({ now });
  if (usingPostgres()) {
    const { rows } = await pool.query(
      `SELECT t.id, t.route, t.jurisdiction_key, t.messages, t.reply, t.corrected_reply, t.review_status,
              t.model, t.rating, t.created_at
         FROM training_examples t
         JOIN accounts a ON a.id = t.account_id
        WHERE a.learn_consent = true
          AND t.review_status IN ('approved','edited')
          AND (t.rating IS NULL OR t.rating >= 0 OR t.review_status = 'edited')
          AND ($1::timestamptz IS NULL OR t.created_at >= $1::timestamptz)
          AND (
            COALESCE(a.training_retention, 'until_delete') = 'until_delete'
            OR (COALESCE(a.training_retention, 'until_delete') = '90d' AND t.created_at >= now() - interval '90 days')
            OR (COALESCE(a.training_retention, 'until_delete') = '1y' AND t.created_at >= now() - interval '1 year')
          )
        ORDER BY t.created_at ASC
        LIMIT $2`,
      [since, limit]
    );
    return rows.map((r) => {
      const messages = typeof r.messages === 'string' ? JSON.parse(r.messages) : r.messages;
      const { corrected_reply, ...rest } = r;
      return { ...rest, messages, reply: finalReply(r) };
    });
  }
  const out = [];
  for (const row of memory.examples) {
    if (!TRAINABLE.includes(row.review_status)) continue;
    if (row.rating != null && row.rating < 0 && row.review_status !== 'edited') continue;
    if (since && row.created_at < new Date(since).toISOString()) continue;
    const acct = await accounts.findById(row.account_id);
    if (!acct || !(acct.learn_consent === true || acct.learn_consent === 1)) continue;
    if (isExpired(row.created_at, policyOf(acct), now)) continue;
    const { account_id, corrected_reply, review_note, reviewer, reviewed_at, ...rest } = row;
    out.push({ ...rest, reply: finalReply(row) });
    if (out.length >= limit) break;
  }
  return out;
}

// Editor queue. Never returns account ids or emails: editors judge answers, not people.
function queueView(row) {
  const messages = typeof row.messages === 'string' ? JSON.parse(row.messages) : row.messages;
  return {
    id: row.id,
    route: row.route,
    jurisdiction_key: row.jurisdiction_key,
    question: (messages.filter((m) => m.role === 'user').pop() || {}).content || '',
    messages,
    reply: row.reply,
    corrected_reply: row.corrected_reply || null,
    model: row.model,
    rating: row.rating,
    review_status: row.review_status,
    review_note: row.review_note || null,
    reviewer: row.reviewer || null,
    reviewed_at: row.reviewed_at || null,
    created_at: row.created_at
  };
}

async function reviewQueue({ status = 'pending', limit = 50 } = {}) {
  const want = status === 'open' ? ['pending', 'flagged'] : [status];
  if (!want.every((s) => REVIEW_STATUSES.includes(s))) return [];
  const n = Math.max(1, Math.min(Number(limit) || 50, 200));
  if (usingPostgres()) {
    const { rows } = await pool.query(
      `SELECT * FROM training_examples WHERE review_status = ANY($1::text[])
        ORDER BY (rating = -1) DESC NULLS LAST, (review_status = 'flagged') DESC, created_at ASC LIMIT $2`,
      [want, n]
    );
    return rows.map(queueView);
  }
  return memory.examples
    .filter((r) => want.includes(r.review_status))
    .sort((a, b) => (b.rating === -1) - (a.rating === -1) || (b.review_status === 'flagged') - (a.review_status === 'flagged') || (a.created_at < b.created_at ? -1 : 1))
    .slice(0, n)
    .map(queueView);
}

// action: approve | edit | reject | flag | reopen
// role: 'human' can do everything; 'claude' can only flag (suggest), never approve.
async function review({ exampleId, action, correctedReply, note, reviewer, role = 'human' }) {
  const map = { approve: 'approved', edit: 'edited', reject: 'rejected', flag: 'flagged', reopen: 'pending' };
  const status = map[action];
  if (!status) return { ok: false, status: 400, error: 'action must be approve, edit, reject, flag or reopen' };
  if (role !== 'human' && action !== 'flag') {
    return { ok: false, status: 403, error: 'Claude can flag and suggest a fix. Only a human editor can approve, edit, reject or reopen.' };
  }
  const fix = correctedReply == null ? null : clip(correctedReply).trim();
  if ((action === 'edit') && !fix) {
    return { ok: false, status: 400, error: 'An edit needs the corrected answer' };
  }
  const fields = {
    review_status: status,
    corrected_reply: action === 'edit' || action === 'flag' ? fix : null,
    review_note: note ? clip(note).slice(0, 2000) : null,
    reviewer: String(reviewer || role).slice(0, 120),
    reviewed_at: action === 'reopen' ? null : new Date().toISOString()
  };
  if (usingPostgres()) {
    const { rows } = await pool.query(
      `UPDATE training_examples
          SET review_status = $2,
              corrected_reply = CASE WHEN $3::text IS NULL AND $2 = 'flagged' THEN corrected_reply ELSE $3 END,
              review_note = $4, reviewer = $5, reviewed_at = $6
        WHERE id = $1 RETURNING *`,
      [exampleId, fields.review_status, fields.corrected_reply, fields.review_note, fields.reviewer, fields.reviewed_at]
    );
    if (!rows[0]) return { ok: false, status: 404, error: 'No answer with that id' };
    return { ok: true, example: queueView(rows[0]) };
  }
  const row = memory.examples.find((r) => r.id === exampleId);
  if (!row) return { ok: false, status: 404, error: 'No answer with that id' };
  const keepFix = fields.corrected_reply == null && status === 'flagged' ? row.corrected_reply : fields.corrected_reply;
  Object.assign(row, fields, { corrected_reply: keepFix });
  return { ok: true, example: queueView(row) };
}

async function reviewStats() {
  const base = Object.fromEntries(REVIEW_STATUSES.map((s) => [s, 0]));
  if (usingPostgres()) {
    const { rows } = await pool.query(`SELECT review_status, count(*)::int AS n FROM training_examples GROUP BY review_status`);
    for (const r of rows) base[r.review_status] = r.n;
  } else {
    for (const r of memory.examples) base[r.review_status] = (base[r.review_status] || 0) + 1;
  }
  base.trainable = base.approved + base.edited;
  return base;
}

async function purgeExpired({ now = Date.now() } = {}) {
  if (usingPostgres()) {
    const { rowCount } = await pool.query(
      `DELETE FROM training_examples t
        USING accounts a
        WHERE t.account_id = a.id
          AND (
            (COALESCE(a.training_retention, 'until_delete') = '90d' AND t.created_at < now() - interval '90 days')
            OR (COALESCE(a.training_retention, 'until_delete') = '1y' AND t.created_at < now() - interval '1 year')
          )`
    );
    return rowCount;
  }
  const before = memory.examples.length;
  const keep = [];
  for (const row of memory.examples) {
    const acct = await accounts.findById(row.account_id);
    if (isExpired(row.created_at, policyOf(acct), now)) continue;
    keep.push(row);
  }
  memory.examples = keep;
  return before - keep.length;
}

async function forgetAccount(accountId) {
  if (usingPostgres()) {
    const { rowCount } = await pool.query(`DELETE FROM training_examples WHERE account_id = $1`, [accountId]);
    return rowCount;
  }
  const before = memory.examples.length;
  memory.examples = memory.examples.filter((r) => r.account_id !== accountId);
  return before - memory.examples.length;
}

async function stats() {
  if (usingPostgres()) {
    const { rows } = await pool.query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE rating = 1)::int AS thumbs_up,
              count(*) FILTER (WHERE rating = -1)::int AS thumbs_down
         FROM training_examples`
    );
    return rows[0];
  }
  return {
    total: memory.examples.length,
    thumbs_up: memory.examples.filter((r) => r.rating === 1).length,
    thumbs_down: memory.examples.filter((r) => r.rating === -1).length
  };
}

function resetMemory() {
  memory.examples = [];
}

module.exports = {
  REVIEW_STATUSES,
  reviewQueue,
  review,
  reviewStats,
  attachPool,
  capture,
  rate,
  exportExamples,
  forgetAccount,
  purgeExpired,
  stats,
  resetMemory,
  normalizeRetention,
  isExpired,
  RETENTION_POLICIES
};
