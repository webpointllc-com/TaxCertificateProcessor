'use strict';

const crypto = require('crypto');
const { promisify } = require('util');
const scrypt = promisify(crypto.scrypt);

const memory = {
  accounts: [],
  sessions: [],
  recents: [],
  messages: [],
  invites: []
};

let pool = null;

function id() {
  return crypto.randomUUID();
}

function publicAccount(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    display_name: row.display_name,
    company: row.company || '',
    activity_on: row.activity_on !== false && row.activity_on !== 0,
    initial: (row.display_name || row.email || 'U').trim().charAt(0).toUpperCase(),
    created_at: row.created_at
  };
}

async function hashPassword(password, salt) {
  const buf = await scrypt(password, salt, 64);
  return buf.toString('hex');
}

function attachPool(p) {
  pool = p;
}

function usingPostgres() {
  return Boolean(pool);
}

async function signup({ email, password, display_name, company }) {
  email = String(email || '').trim().toLowerCase();
  display_name = String(display_name || '').trim();
  password = String(password || '');
  company = String(company || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'Enter a valid work email' };
  }
  if (display_name.length < 2) return { ok: false, error: 'Enter the name on the account' };
  if (password.length < 8) return { ok: false, error: 'Password must be at least 8 characters' };

  const salt = crypto.randomBytes(16).toString('hex');
  const password_hash = await hashPassword(password, salt);
  const row = {
    id: id(),
    email,
    display_name,
    company,
    password_salt: salt,
    password_hash,
    activity_on: false,
    created_at: new Date().toISOString()
  };

  try {
    if (usingPostgres()) {
      await pool.query(
        `INSERT INTO accounts (id, email, display_name, company, password_salt, password_hash, activity_on)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [row.id, row.email, row.display_name, row.company, row.password_salt, row.password_hash, row.activity_on]
      );
    } else {
      if (memory.accounts.some((a) => a.email === email)) {
        return { ok: false, error: 'That email already has an account' };
      }
      memory.accounts.push(row);
    }
  } catch (err) {
    if (String(err.message).includes('unique') || err.code === '23505') {
      return { ok: false, error: 'That email already has an account' };
    }
    throw err;
  }
  const session = await createSession(row.id);
  return { ok: true, account: publicAccount(row), token: session.token };
}

async function findByEmail(email) {
  email = String(email || '').trim().toLowerCase();
  if (usingPostgres()) {
    const { rows } = await pool.query(`SELECT * FROM accounts WHERE email = $1`, [email]);
    return rows[0] || null;
  }
  return memory.accounts.find((a) => a.email === email) || null;
}

async function findById(accountId) {
  if (usingPostgres()) {
    const { rows } = await pool.query(`SELECT * FROM accounts WHERE id = $1`, [accountId]);
    return rows[0] || null;
  }
  return memory.accounts.find((a) => a.id === accountId) || null;
}

async function login({ email, password }) {
  const row = await findByEmail(email);
  if (!row) return { ok: false, error: 'Email or password is incorrect' };
  const hash = await hashPassword(String(password || ''), row.password_salt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(row.password_hash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, error: 'Email or password is incorrect' };
  }
  const session = await createSession(row.id);
  return { ok: true, account: publicAccount(row), token: session.token };
}

async function createSession(accountId) {
  const token = crypto.randomBytes(24).toString('hex');
  const row = { token, account_id: accountId, created_at: new Date().toISOString() };
  if (usingPostgres()) {
    await pool.query(`INSERT INTO auth_sessions (token, account_id) VALUES ($1,$2)`, [token, accountId]);
  } else {
    memory.sessions.push(row);
  }
  return row;
}

async function accountForToken(token) {
  if (!token) return null;
  if (usingPostgres()) {
    const { rows } = await pool.query(
      `SELECT a.* FROM accounts a JOIN auth_sessions s ON s.account_id = a.id WHERE s.token = $1`,
      [token]
    );
    return rows[0] ? publicAccount(rows[0]) : null;
  }
  const session = memory.sessions.find((s) => s.token === token);
  if (!session) return null;
  return publicAccount(await findById(session.account_id));
}

async function logout(token) {
  if (!token) return;
  if (usingPostgres()) {
    await pool.query(`DELETE FROM auth_sessions WHERE token = $1`, [token]);
  } else {
    memory.sessions = memory.sessions.filter((s) => s.token !== token);
  }
}

async function updateAccount(accountId, patch) {
  const row = await findById(accountId);
  if (!row) return { ok: false, error: 'Account not found' };
  if (patch.display_name) row.display_name = String(patch.display_name).trim();
  if (patch.company !== undefined) row.company = String(patch.company).trim();
  if (typeof patch.activity_on === 'boolean') row.activity_on = patch.activity_on;
  if (usingPostgres()) {
    await pool.query(
      `UPDATE accounts SET display_name = $2, company = $3, activity_on = $4 WHERE id = $1`,
      [accountId, row.display_name, row.company, row.activity_on]
    );
  }
  return { ok: true, account: publicAccount(row) };
}

async function addRecent(accountId, { kind, label, detail }) {
  const row = {
    id: id(),
    account_id: accountId,
    kind: kind || 'search',
    label: String(label || '').slice(0, 200),
    detail: String(detail || '').slice(0, 400),
    created_at: new Date().toISOString()
  };
  if (usingPostgres()) {
    await pool.query(
      `INSERT INTO recents (id, account_id, kind, label, detail) VALUES ($1,$2,$3,$4,$5)`,
      [row.id, row.account_id, row.kind, row.label, row.detail]
    );
  } else {
    memory.recents.unshift(row);
  }
  return row;
}

async function listRecents(accountId, limit = 30) {
  if (usingPostgres()) {
    const { rows } = await pool.query(
      `SELECT * FROM recents WHERE account_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [accountId, limit]
    );
    return rows;
  }
  return memory.recents.filter((r) => r.account_id === accountId).slice(0, limit);
}

async function addMessage(accountId, body) {
  body = String(body || '').trim();
  if (!body) return { ok: false, error: 'Type a message' };
  const row = { id: id(), account_id: accountId, body, created_at: new Date().toISOString() };
  if (usingPostgres()) {
    await pool.query(
      `INSERT INTO account_messages (id, account_id, body) VALUES ($1,$2,$3)`,
      [row.id, accountId, body]
    );
  } else {
    memory.messages.unshift(row);
  }
  return { ok: true, message: row };
}

async function listMessages(accountId, limit = 50) {
  if (usingPostgres()) {
    const { rows } = await pool.query(
      `SELECT * FROM account_messages WHERE account_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [accountId, limit]
    );
    return rows;
  }
  return memory.messages.filter((m) => m.account_id === accountId).slice(0, limit);
}

async function addInvite(accountId, email) {
  email = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'Enter a valid email' };
  }
  const row = { id: id(), account_id: accountId, email, created_at: new Date().toISOString() };
  if (usingPostgres()) {
    await pool.query(`INSERT INTO invites (id, account_id, email) VALUES ($1,$2,$3)`, [row.id, accountId, email]);
  } else {
    memory.invites.unshift(row);
  }
  return { ok: true, invite: row };
}

async function listInvites(accountId) {
  if (usingPostgres()) {
    const { rows } = await pool.query(
      `SELECT * FROM invites WHERE account_id = $1 ORDER BY created_at DESC`,
      [accountId]
    );
    return rows;
  }
  return memory.invites.filter((i) => i.account_id === accountId);
}

function resetMemory() {
  memory.accounts.length = 0;
  memory.sessions.length = 0;
  memory.recents.length = 0;
  memory.messages.length = 0;
  memory.invites.length = 0;
}

module.exports = {
  attachPool,
  signup,
  login,
  logout,
  accountForToken,
  updateAccount,
  addRecent,
  listRecents,
  addMessage,
  listMessages,
  addInvite,
  listInvites,
  publicAccount,
  resetMemory
};
