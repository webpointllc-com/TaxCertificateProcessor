'use strict';

const crypto = require('crypto');
const { promisify } = require('util');
const scrypt = promisify(crypto.scrypt);

const FREE_SEARCHES = 1;
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const memory = {
  accounts: [],
  sessions: [],
  recents: [],
  messages: [],
  invites: [],
  otps: [],
  memberCodes: [],
  guestUsage: [],
  tasks: []
};

let pool = null;

function id() {
  return crypto.randomUUID();
}

function shouldEchoOtp() {
  if (process.env.NODE_ENV === 'production') return false;
  if (process.env.RESEND_API_KEY || process.env.SMTP_URL) return false;
  return true;
}

function publicAccount(row) {
  if (!row) return null;
  const plan = row.plan === 'member' ? 'member' : 'free';
  const searchCount = Number(row.search_count) || 0;
  return {
    id: row.id,
    email: row.email,
    display_name: row.display_name,
    company: row.company || '',
    activity_on: row.activity_on !== false && row.activity_on !== 0,
    initial: (row.display_name || row.email || 'U').trim().charAt(0).toUpperCase(),
    created_at: row.created_at,
    learn_consent: row.learn_consent === true || row.learn_consent === 1,
    email_verified: row.email_verified === true || row.email_verified === 1,
    plan,
    is_member: plan === 'member',
    search_count: searchCount,
    searches_remaining: plan === 'member' ? null : Math.max(0, FREE_SEARCHES - searchCount)
  };
}

async function hashSecret(value, salt) {
  const buf = await scrypt(String(value), salt, 64);
  return buf.toString('hex');
}

function attachPool(p) {
  pool = p;
}

function usingPostgres() {
  return Boolean(pool);
}

function randomOtp() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function randomMemberCode() {
  const chunk = () =>
    Array.from({ length: 4 }, () => CODE_ALPHABET[crypto.randomInt(0, CODE_ALPHABET.length)]).join('');
  return `WP-${chunk()}-${chunk()}`;
}

function normalizeMemberCode(code) {
  return String(code || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/^WP/, 'WP');
}

function formatMemberCode(raw) {
  const compact = normalizeMemberCode(raw);
  if (compact.length === 10 && compact.startsWith('WP')) {
    return `WP-${compact.slice(2, 6)}-${compact.slice(6, 10)}`;
  }
  return String(raw || '').trim().toUpperCase();
}

function nameFromEmail(email) {
  const local = String(email || '').split('@')[0].trim();
  return local.length >= 2 ? local : 'Member';
}

async function signup({ email, password, display_name, company, sessionId }) {
  email = String(email || '').trim().toLowerCase();
  display_name = String(display_name || '').trim() || nameFromEmail(email);
  password = String(password || '');
  company = String(company || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'Enter a valid work email' };
  }
  if (display_name.length < 2) return { ok: false, error: 'Enter the name on the account' };
  if (password.length < 8) return { ok: false, error: 'Password must be at least 8 characters' };

  const salt = crypto.randomBytes(16).toString('hex');
  const password_hash = await hashSecret(password || crypto.randomBytes(16).toString('hex'), salt);
  let guestCount = 0;
  if (sessionId) guestCount = await guestSearchCount(sessionId);
  const row = {
    id: id(),
    email,
    display_name,
    company,
    password_salt: salt,
    password_hash,
    activity_on: false,
    learn_consent: false,
    email_verified: false,
    plan: 'free',
    search_count: guestCount > 0 ? 1 : 0,
    member_code_id: null,
    auth_provider: 'password',
    created_at: new Date().toISOString()
  };

  try {
    if (usingPostgres()) {
      await pool.query(
        `INSERT INTO accounts
          (id, email, display_name, company, password_salt, password_hash, activity_on, learn_consent,
           email_verified, plan, search_count, auth_provider)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          row.id, row.email, row.display_name, row.company, row.password_salt, row.password_hash,
          row.activity_on, row.learn_consent, row.email_verified, row.plan, row.search_count,
          row.auth_provider
        ]
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

  return confirmPayload(row, await issueConfirmLink(row.id, row.email));
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

async function loginWithPassword({ email, password }) {
  const row = await findByEmail(email);
  if (!row) return { ok: false, error: 'Email or password is incorrect' };
  if (row.auth_provider && row.auth_provider !== 'password') {
    return { ok: false, error: 'Use Google or Apple to sign in to this account' };
  }
  const hash = await hashSecret(String(password || ''), row.password_salt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(row.password_hash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, error: 'Email or password is incorrect' };
  }
  if (!(row.email_verified === true || row.email_verified === 1)) {
    return {
      ...confirmPayload(row, await issueConfirmLink(row.id, row.email)),
      ok: false,
      error: 'Confirm the link we emailed before signing in.'
    };
  }
  const session = await createSession(row.id);
  return { ok: true, account: publicAccount(row), token: session.token };
}

function shaToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function confirmPayload(accountRow, confirm) {
  const echo = shouldEchoOtp();
  return {
    ok: true,
    needs_confirm: true,
    email: accountRow.email,
    delivery: echo ? 'hold' : 'email',
    confirm_token: echo ? confirm.token : undefined,
    confirm_path: echo ? confirm.path : undefined,
    account: publicAccount(accountRow)
  };
}

async function issueConfirmLink(accountId, email) {
  const token = crypto.randomBytes(24).toString('hex');
  const row = {
    id: id(),
    email: String(email || '').trim().toLowerCase(),
    purpose: 'confirm',
    code_hash: shaToken(token),
    salt: '',
    account_id: accountId || null,
    attempts: 0,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString()
  };
  if (usingPostgres()) {
    await pool.query(`DELETE FROM email_otps WHERE account_id = $1 AND purpose = 'confirm'`, [accountId]);
    await pool.query(
      `INSERT INTO email_otps (id, email, purpose, code_hash, salt, account_id, attempts, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [row.id, row.email, row.purpose, row.code_hash, row.salt, row.account_id, row.attempts, row.expires_at]
    );
  } else {
    memory.otps = memory.otps.filter((o) => !(o.account_id === accountId && o.purpose === 'confirm'));
    memory.otps.push(row);
  }
  return { token, path: '/api/confirm-email?token=' + token };
}

async function consumeConfirmToken(token) {
  token = String(token || '').trim();
  if (token.length < 24) return { ok: false, error: 'That confirmation link is not valid' };
  const hashed = shaToken(token);
  let row;
  if (usingPostgres()) {
    const { rows } = await pool.query(
      `SELECT * FROM email_otps WHERE purpose = 'confirm' AND code_hash = $1 LIMIT 1`,
      [hashed]
    );
    row = rows[0];
  } else {
    row = memory.otps.find((o) => o.purpose === 'confirm' && o.code_hash === hashed);
  }
  if (!row) return { ok: false, error: 'That confirmation link is not valid' };
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, error: 'That confirmation link expired. Sign in to get a new one.' };
  }
  const accountRow = row.account_id ? await findById(row.account_id) : await findByEmail(row.email);
  if (!accountRow) return { ok: false, error: 'Account not found' };
  accountRow.email_verified = true;
  if (usingPostgres()) {
    await pool.query(`UPDATE accounts SET email_verified = true WHERE id = $1`, [accountRow.id]);
    await pool.query(`DELETE FROM email_otps WHERE id = $1`, [row.id]);
  } else {
    memory.otps = memory.otps.filter((o) => o.id !== row.id);
  }
  const session = await createSession(accountRow.id);
  return { ok: true, account: publicAccount(accountRow), token: session.token };
}

async function resendConfirm({ email }) {
  email = String(email || '').trim().toLowerCase();
  const row = await findByEmail(email);
  if (!row) {
    return { ok: true, sent: false, email };
  }
  if (row.email_verified === true || row.email_verified === 1) {
    return { ok: false, error: 'That email is already confirmed. Sign in.' };
  }
  return confirmPayload(row, await issueConfirmLink(row.id, row.email));
}

async function upsertOAuth({ email, display_name, provider, sessionId }) {
  email = String(email || '').trim().toLowerCase();
  display_name = String(display_name || email.split('@')[0] || 'Member').trim();
  provider = String(provider || 'google');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'That sign-in did not return an email' };
  }
  let row = await findByEmail(email);
  if (!row) {
    const salt = crypto.randomBytes(16).toString('hex');
    const password_hash = await hashSecret(crypto.randomBytes(16).toString('hex'), salt);
    const guestCount = sessionId ? await guestSearchCount(sessionId) : 0;
    row = {
      id: id(),
      email,
      display_name,
      company: '',
      password_salt: salt,
      password_hash,
      activity_on: false,
      learn_consent: false,
      email_verified: true,
      plan: 'free',
      search_count: guestCount > 0 ? 1 : 0,
      member_code_id: null,
      auth_provider: provider,
      created_at: new Date().toISOString()
    };
    if (usingPostgres()) {
      await pool.query(
        `INSERT INTO accounts
          (id, email, display_name, company, password_salt, password_hash, activity_on, learn_consent,
           email_verified, plan, search_count, auth_provider)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          row.id, row.email, row.display_name, row.company, row.password_salt, row.password_hash,
          row.activity_on, row.learn_consent, true, row.plan, row.search_count, provider
        ]
      );
    } else {
      memory.accounts.push(row);
    }
  } else {
    row.email_verified = true;
    row.auth_provider = row.auth_provider || provider;
    if (usingPostgres()) {
      await pool.query(`UPDATE accounts SET email_verified = true, auth_provider = COALESCE(auth_provider, $2) WHERE id = $1`, [
        row.id,
        provider
      ]);
    }
  }
  const session = await createSession(row.id);
  return { ok: true, account: publicAccount(row), token: session.token };
}

async function issueOtp({ email, purpose, accountId }) {
  email = String(email || '').trim().toLowerCase();
  const code = randomOtp();
  const salt = crypto.randomBytes(16).toString('hex');
  const code_hash = await hashSecret(code, salt);
  const row = {
    id: id(),
    email,
    purpose: purpose || 'login',
    code_hash,
    salt,
    account_id: accountId || null,
    attempts: 0,
    expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
    created_at: new Date().toISOString()
  };
  if (usingPostgres()) {
    await pool.query(`DELETE FROM email_otps WHERE email = $1 AND purpose = $2`, [email, row.purpose]);
    await pool.query(
      `INSERT INTO email_otps (id, email, purpose, code_hash, salt, account_id, attempts, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [row.id, row.email, row.purpose, row.code_hash, row.salt, row.account_id, row.attempts, row.expires_at]
    );
  } else {
    memory.otps = memory.otps.filter((o) => !(o.email === email && o.purpose === row.purpose));
    memory.otps.push(row);
  }
  return { ...row, code };
}

async function verifyOtp({ email, code, purpose }) {
  email = String(email || '').trim().toLowerCase();
  code = String(code || '').replace(/\D/g, '');
  purpose = purpose || 'login';
  if (!/^\d{6}$/.test(code)) return { ok: false, error: 'Enter the 6-digit code' };

  let row;
  if (usingPostgres()) {
    const { rows } = await pool.query(
      `SELECT * FROM email_otps WHERE email = $1 AND purpose = $2 ORDER BY created_at DESC LIMIT 1`,
      [email, purpose]
    );
    row = rows[0];
  } else {
    row = [...memory.otps].reverse().find((o) => o.email === email && o.purpose === purpose);
  }
  if (!row) return { ok: false, error: 'Request a new code' };
  if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false, error: 'That code expired. Request a new one.' };
  if ((Number(row.attempts) || 0) >= OTP_MAX_ATTEMPTS) {
    return { ok: false, error: 'Too many tries. Request a new code.' };
  }

  const hash = await hashSecret(code, row.salt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(row.code_hash, 'hex');
  const match = a.length === b.length && crypto.timingSafeEqual(a, b);
  const attempts = (Number(row.attempts) || 0) + 1;
  if (usingPostgres()) {
    await pool.query(`UPDATE email_otps SET attempts = $2 WHERE id = $1`, [row.id, attempts]);
  } else {
    row.attempts = attempts;
  }
  if (!match) return { ok: false, error: 'That code does not match' };

  const accountRow = row.account_id ? await findById(row.account_id) : await findByEmail(email);
  if (!accountRow) return { ok: false, error: 'Account not found' };
  accountRow.email_verified = true;
  if (usingPostgres()) {
    await pool.query(`UPDATE accounts SET email_verified = true WHERE id = $1`, [accountRow.id]);
    await pool.query(`DELETE FROM email_otps WHERE id = $1`, [row.id]);
  } else {
    memory.otps = memory.otps.filter((o) => o.id !== row.id);
  }
  const session = await createSession(accountRow.id);
  return { ok: true, account: publicAccount(accountRow), token: session.token };
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
  if (typeof patch.learn_consent === 'boolean') row.learn_consent = patch.learn_consent;
  if (usingPostgres()) {
    await pool.query(
      `UPDATE accounts SET display_name = $2, company = $3, activity_on = $4, learn_consent = $5 WHERE id = $1`,
      [accountId, row.display_name, row.company, row.activity_on, row.learn_consent === true]
    );
  }
  return { ok: true, account: publicAccount(row) };
}

async function guestSearchCount(sessionId) {
  const sid = String(sessionId || '').slice(0, 80);
  if (!sid) return 0;
  if (usingPostgres()) {
    const { rows } = await pool.query(`SELECT search_count FROM guest_usage WHERE session_id = $1`, [sid]);
    return Number(rows[0]?.search_count) || 0;
  }
  const row = memory.guestUsage.find((g) => g.session_id === sid);
  return Number(row?.search_count) || 0;
}

async function incrementGuestSearch(sessionId) {
  const sid = String(sessionId || '').slice(0, 80);
  if (!sid) return 1;
  const next = (await guestSearchCount(sid)) + 1;
  if (usingPostgres()) {
    await pool.query(
      `INSERT INTO guest_usage (session_id, search_count, updated_at)
       VALUES ($1,$2,now())
       ON CONFLICT (session_id) DO UPDATE SET search_count = EXCLUDED.search_count, updated_at = now()`,
      [sid, next]
    );
  } else {
    const row = memory.guestUsage.find((g) => g.session_id === sid);
    if (row) row.search_count = next;
    else memory.guestUsage.push({ session_id: sid, search_count: next });
  }
  return next;
}

async function incrementAccountSearch(accountId) {
  const row = await findById(accountId);
  if (!row) return 0;
  row.search_count = (Number(row.search_count) || 0) + 1;
  if (usingPostgres()) {
    await pool.query(`UPDATE accounts SET search_count = $2 WHERE id = $1`, [accountId, row.search_count]);
  }
  return row.search_count;
}

function searchDecision(account) {
  if (!account) {
    return {
      ok: false,
      gate: 'account',
      error: 'Sign in or create an account to search.',
      status: 401
    };
  }
  if (account.email_verified === false) {
    return {
      ok: false,
      gate: 'confirm',
      error: 'Confirm the link we emailed before searching.',
      status: 403
    };
  }
  if (account.is_member || account.plan === 'member') {
    return { ok: true, plan: 'member' };
  }
  const used = Number(account.search_count) || 0;
  if (used < FREE_SEARCHES) return { ok: true, plan: 'free' };
  return {
    ok: false,
    gate: 'member',
    error: 'Your complimentary search has been used. Continue with a shop code from your employer.',
    status: 402
  };
}

async function consumeSearch({ account, taskId }) {
  if (account && taskId) {
    const existing = await findTask(account.id, taskId);
    if (existing) return { ok: true, plan: account.plan === 'member' ? 'member' : 'free', follow_up: true, task: existing };
  }
  const decision = searchDecision(account);
  if (!decision.ok) return decision;
  if (account) await incrementAccountSearch(account.id);
  return decision;
}

async function startTask({ accountId, prompt, jurisdictionKey }) {
  const row = {
    id: id(),
    account_id: accountId,
    prompt: String(prompt || '').slice(0, 2000),
    jurisdiction_key: jurisdictionKey || '',
    created_at: new Date().toISOString()
  };
  if (usingPostgres()) {
    await pool.query(
      `INSERT INTO search_sessions (id, account_id, prompt, jurisdiction_key) VALUES ($1,$2,$3,$4)`,
      [row.id, row.account_id, row.prompt, row.jurisdiction_key]
    );
  } else {
    memory.tasks.push(row);
  }
  return row;
}

async function findTask(accountId, taskId) {
  if (!accountId || !taskId) return null;
  if (usingPostgres()) {
    const { rows } = await pool.query(
      `SELECT * FROM search_sessions WHERE id = $1 AND account_id = $2`,
      [taskId, accountId]
    );
    return rows[0] || null;
  }
  return memory.tasks.find((t) => t.id === taskId && t.account_id === accountId) || null;
}

function memberRequired(account) {
  if (account?.is_member || account?.plan === 'member') return { ok: true };
  return {
    ok: false,
    gate: account ? 'member' : 'account',
    error: account
      ? 'Members can run batches, extractor updates, and unlimited search.'
      : 'Create a free account, then enter a member code.',
    status: 402
  };
}

async function issueMemberCode({ label, seats } = {}) {
  const code = randomMemberCode();
  const salt = crypto.randomBytes(16).toString('hex');
  const code_hash = await hashSecret(code, salt);
  const row = {
    id: id(),
    code_hash,
    salt,
    code_hint: code.slice(-4),
    label: String(label || 'WebPoint members').slice(0, 80),
    seats: Math.max(1, Number(seats) || 25),
    redeemed: 0,
    active: true,
    created_at: new Date().toISOString()
  };
  if (usingPostgres()) {
    await pool.query(
      `INSERT INTO member_codes (id, code_hash, salt, code_hint, label, seats, redeemed, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [row.id, row.code_hash, row.salt, row.code_hint, row.label, row.seats, row.redeemed, row.active]
    );
  } else {
    memory.memberCodes.push(row);
  }
  return { ok: true, code, hint: row.code_hint, label: row.label, seats: row.seats, id: row.id };
}

async function listMemberCodeRows() {
  if (usingPostgres()) {
    const { rows } = await pool.query(`SELECT * FROM member_codes WHERE active = true`);
    return rows;
  }
  return memory.memberCodes.filter((c) => c.active !== false);
}

async function redeemMemberCode(accountId, rawCode) {
  const account = await findById(accountId);
  if (!account) return { ok: false, error: 'Account not found' };
  if (!(account.email_verified === true || account.email_verified === 1)) {
    return { ok: false, error: 'Confirm your email first' };
  }
  const formatted = formatMemberCode(rawCode);
  if (!/^WP-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(formatted)) {
    return { ok: false, error: 'Member codes look like WP-XXXX-XXXX' };
  }
  const rows = await listMemberCodeRows();
  let matched = null;
  for (const row of rows) {
    const hash = await hashSecret(formatted, row.salt);
    const a = Buffer.from(hash, 'hex');
    const b = Buffer.from(row.code_hash, 'hex');
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      matched = row;
      break;
    }
  }
  if (!matched) return { ok: false, error: 'That member code is not valid' };
  if ((Number(matched.redeemed) || 0) >= (Number(matched.seats) || 1)) {
    return { ok: false, error: 'That shop’s seats are full' };
  }
  matched.redeemed = (Number(matched.redeemed) || 0) + 1;
  account.plan = 'member';
  account.member_code_id = matched.id;
  if (usingPostgres()) {
    await pool.query(`UPDATE member_codes SET redeemed = $2 WHERE id = $1`, [matched.id, matched.redeemed]);
    await pool.query(`UPDATE accounts SET plan = 'member', member_code_id = $2 WHERE id = $1`, [
      accountId,
      matched.id
    ]);
  }
  return { ok: true, account: publicAccount(account) };
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
  memory.otps.length = 0;
  memory.memberCodes.length = 0;
  memory.guestUsage.length = 0;
  memory.tasks.length = 0;
}

module.exports = {
  FREE_SEARCHES,
  attachPool,
  signup,
  loginWithPassword,
  consumeConfirmToken,
  issueConfirmLink,
  resendConfirm,
  upsertOAuth,
  verifyOtp,
  issueOtp,
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
  consumeSearch,
  startTask,
  findTask,
  memberRequired,
  issueMemberCode,
  redeemMemberCode,
  guestSearchCount,
  resetMemory,
  login: loginWithPassword
};
