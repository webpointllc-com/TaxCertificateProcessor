'use strict';

// Consent-gated training data for the WebPoint own model.
//
// Rules this module enforces (tests cover each one):
//   1. Nothing is captured unless the signed-in account has learn_consent === true.
//   2. Export re-checks CURRENT consent. An account that turns learning off drops out
//      of every future export, even for rows captured while it was on.
//   3. Rows rated -1 (thumbs down) never train the model.
//   4. forgetAccount() removes every row for an account (Delete my data).

const crypto = require('crypto');
const accounts = require('./accounts');

const MAX_CONTENT = 8000;
const memory = { examples: [] };
let pool = null;

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

async function capture({ account, route, jurisdictionKey, messages, reply, model }) {
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
    created_at: new Date().toISOString()
  };
  try {
    if (usingPostgres()) {
      await pool.query(
        `INSERT INTO training_examples (id, account_id, route, jurisdiction_key, messages, reply, model)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7)`,
        [row.id, row.account_id, row.route, row.jurisdiction_key, JSON.stringify(row.messages), row.reply, row.model]
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

async function exportExamples({ since = null, limit = 50000 } = {}) {
  if (usingPostgres()) {
    const { rows } = await pool.query(
      `SELECT t.id, t.route, t.jurisdiction_key, t.messages, t.reply, t.model, t.rating, t.created_at
         FROM training_examples t
         JOIN accounts a ON a.id = t.account_id
        WHERE a.learn_consent = true
          AND (t.rating IS NULL OR t.rating >= 0)
          AND ($1::timestamptz IS NULL OR t.created_at >= $1::timestamptz)
        ORDER BY t.created_at ASC
        LIMIT $2`,
      [since, limit]
    );
    return rows.map((r) => ({ ...r, messages: typeof r.messages === 'string' ? JSON.parse(r.messages) : r.messages }));
  }
  const out = [];
  for (const row of memory.examples) {
    if (row.rating != null && row.rating < 0) continue;
    if (since && row.created_at < new Date(since).toISOString()) continue;
    const acct = await accounts.findById(row.account_id);
    if (!acct || !(acct.learn_consent === true || acct.learn_consent === 1)) continue;
    const { account_id, ...rest } = row;
    out.push(rest);
    if (out.length >= limit) break;
  }
  return out;
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

module.exports = { attachPool, capture, rate, exportExamples, forgetAccount, stats, resetMemory };
