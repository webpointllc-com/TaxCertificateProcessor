'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');
const store = require('./db/store');
const accounts = require('./db/accounts');
const extractors = require('./db/extractors');
const oauth = require('./services/oauth');
const mailer = require('./services/mailer');
const llm = require('./services/llm');
const {
  parseSearchQuery,
  buildCard,
  buildCertificate,
  formatMoney,
  resolveHealedUrl,
  methodFromFeedback
} = require('./services/searchIntelligence');
const operator = require('./services/operator');
const { enrichSystemPrompt, enforceLockedSpulUrl } = require('./services/taxIntelligence');
const { parseJurisdiction, lookupForApi, suggestJurisdictions, catalogCoverage } = require('./services/urlFinder');
const { buildLockedUrlPrefix } = require('./services/spulTruth');
const { matchScenario } = require('./services/scenarioRouter');
const { scanWorkplaceClone, inventoryRepo } = require('../scripts/workplace-scan');
const { launchPlan } = require('./launchPlan');
const drProduction = require('./services/drProduction');

const PORT = process.env.PORT || 3000;
const FRAME_ANCESTORS = [
  "'self'",
  'https://*.squarespace.com',
  'https://*.squarespace-cdn.com',
  'https://webpointllc.com',
  'https://*.webpointllc.com'
].join(' ');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false }));
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', `frame-ancestors ${FRAME_ANCESTORS}`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
app.use(express.static(path.join(__dirname, '..', 'public')));

function sessionIdOf(req) {
  return (
    req.get('x-session-id') ||
    req.body?.sessionId ||
    req.query.sessionId ||
    'anon'
  ).slice(0, 80);
}

function memberOk(req) {
  const need = process.env.MEMBER_EMBED_KEY;
  if (!need) return { ok: true, gated: false };
  const got = req.get('x-member-key') || req.query.k || req.body?.memberKey;
  return { ok: got === need, gated: true };
}

function tokenOf(req) {
  const auth = req.get('authorization') || '';
  if (/^bearer\s+/i.test(auth)) return auth.replace(/^bearer\s+/i, '').trim();
  return (req.get('x-auth-token') || req.body?.token || req.query.token || '').trim();
}

async function resolveAccount(req) {
  return accounts.accountForToken(tokenOf(req));
}

async function requireAccount(req, res) {
  const account = await resolveAccount(req);
  if (!account) {
    res.status(401).json({ ok: false, gate: 'account', error: 'Sign in to continue' });
    return null;
  }
  return account;
}

function lookupBundle(message, county, state) {
  let jurisdiction = { county: county || null, state: state || null };
  const scenarioMatch = message ? matchScenario(message) : null;
  if (message) {
    const parsed = parseJurisdiction(message);
    if (parsed.county) jurisdiction = parsed;
  }
  if (!jurisdiction.county) return { ok: false, error: 'Provide a county and state, e.g. Chippewa County WI' };
  const result = lookupForApi(jurisdiction.county, jurisdiction.state);
  const key = `${(result.canonicalState || jurisdiction.state || '').toUpperCase()}-${result.canonicalCounty || jurisdiction.county}`;
  return {
    ok: true,
    jurisdiction: {
      county: result.canonicalCounty || jurisdiction.county,
      state: result.canonicalState || jurisdiction.state
    },
    key,
    scenarioId: scenarioMatch?.scenarioId || null,
    intent: scenarioMatch?.intent || null,
    ...result
  };
}

function synthesizeSpul(lookup) {
  const url = lookup.officialUrl || lookup.lockedUrl || '';
  const conf = lookup.urlLocked ? (lookup.confidence || 'verified') : 'not_found';
  return [
    `SPUL_URL: ${url || '(none — do not invent a link)'}`,
    `SPUL_ENTITY: ${lookup.entity || 'Property tax search'}`,
    `SPUL_CONFIDENCE: ${conf}`,
    'SPUL_ACTIONS:',
    '- Search by owner last name',
    '- Search by parcel / account number',
    '- View tax payment history',
    `SPUL_CONTEXT: ${lookup.entityNote || lookup.source || 'Locked from the Search Spul jurisdiction database.'}`
  ].join('\n');
}

app.get(['/api/health', '/v1/health', '/healthz'], async (req, res) => {
  const scan = scanWorkplaceClone();
  const lastImport = await store.latestImport();
  const models = llm.status();
  res.json({
    ok: true,
    product: 'WebPoint Tax Certificate Processor',
    modules: ['TCS', 'TPA', 'RDS', 'SPUL'],
    firstCounty: { county: 'Chippewa', state: 'WI' },
    db: store.usingPostgres() ? 'postgres' : 'memory',
    groq: models.groq,
    model: models.model,
    llm: models,
    extractors: await extractors.stats(),
    operator: { central: true },
    oauth: oauth.oauthStatus(),
    swap: {
      ready: true,
      public_origin: process.env.PUBLIC_ORIGIN || null,
      pool: store.poolStats(),
      bind: `0.0.0.0:${PORT}`
    },
    workplace: scan,
    lastImport
  });
});

app.get('/api/hero-examples', (req, res) => {
  const { getHeroExamples } = require('./services/scenarioRouter');
  res.json({
    examples: [
      'Chippewa County WI tax certificate',
      'Pay property taxes Chippewa WI',
      ...getHeroExamples(3)
    ]
  });
});

async function deliverConfirm(req, result) {
  if (!result?.needs_confirm || !result.email) return result;
  const origin = oauth.originOf(req);
  const token = result.confirm_token;
  const path = result.confirm_path || (token ? `/api/confirm-email?token=${token}` : '');
  if (!path) return result;
  try {
    await mailer.sendConfirmEmail({ to: result.email, confirmUrl: origin + path });
  } catch (err) {
    console.error('confirm email', err.message);
  }
  return result;
}

app.post('/api/signup', async (req, res) => {
  try {
    const result = await accounts.signup({ ...(req.body || {}), sessionId: sessionIdOf(req) });
    if (!result.ok) return res.status(400).json(result);
    await deliverConfirm(req, result);
    res.status(201).json(result);
  } catch (err) {
    console.error('signup', err.message);
    res.status(500).json({ ok: false, error: 'Could not create the account' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const result = await accounts.loginWithPassword(req.body || {});
    if (!result.ok) {
      if (result.needs_confirm) await deliverConfirm(req, result);
      return res.status(result.needs_confirm ? 403 : 401).json(result);
    }
    res.json(result);
  } catch (err) {
    console.error('login', err.message);
    res.status(500).json({ ok: false, error: 'Could not sign in' });
  }
});

app.post('/api/confirm', async (req, res) => {
  try {
    const result = await accounts.consumeConfirmToken(req.body?.token || req.query.token);
    if (!result.ok) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error('confirm', err.message);
    res.status(500).json({ ok: false, error: 'Could not confirm that email' });
  }
});

app.post('/api/confirm/resend', async (req, res) => {
  try {
    const result = await accounts.resendConfirm({ email: req.body?.email });
    if (!result.ok) return res.status(400).json(result);
    await deliverConfirm(req, result);
    res.json(result);
  } catch (err) {
    console.error('confirm resend', err.message);
    res.status(500).json({ ok: false, error: 'Could not resend the confirmation link' });
  }
});

app.get('/api/confirm-email', async (req, res) => {
  try {
    const result = await accounts.consumeConfirmToken(req.query.token);
    if (!result.ok) {
      return res.redirect('/?confirm=failed');
    }
    res.redirect(`/?auth=${encodeURIComponent(result.token)}&confirmed=1`);
  } catch (err) {
    console.error('confirm-email', err.message);
    res.redirect('/?confirm=failed');
  }
});

function wantsJson(req) {
  return /json/i.test(req.get('accept') || '') || req.query.format === 'json';
}

app.get('/api/auth/google/start', (req, res) => {
  if (!oauth.googleEnabled()) {
    return res.status(501).json({
      ok: false,
      error: 'Google sign-in is not connected on this host yet. Use email and password.'
    });
  }
  const url = oauth.googleAuthUrl(req, req.query.state || sessionIdOf(req));
  if (wantsJson(req)) return res.json({ ok: true, url });
  res.redirect(url);
});

app.get('/api/auth/google/callback', async (req, res) => {
  try {
    if (!oauth.googleEnabled()) return res.redirect('/?oauth=unavailable');
    const profile = await oauth.exchangeGoogleCode(req, req.query.code);
    const result = await accounts.upsertOAuth({
      email: profile.email,
      display_name: profile.display_name,
      provider: 'google',
      sessionId: req.query.state || sessionIdOf(req)
    });
    if (!result.ok) return res.redirect('/?oauth=failed');
    res.redirect(`/?auth=${encodeURIComponent(result.token)}&oauth=google`);
  } catch (err) {
    console.error('google oauth', err.message);
    res.redirect('/?oauth=failed');
  }
});

app.get('/api/auth/apple/start', (req, res) => {
  if (!oauth.appleEnabled()) {
    return res.status(501).json({
      ok: false,
      error: 'Apple sign-in is not connected on this host yet. Use email and password.'
    });
  }
  const url = oauth.appleAuthUrl(req, req.query.state || sessionIdOf(req));
  if (wantsJson(req)) return res.json({ ok: true, url });
  res.redirect(url);
});

app.post('/api/auth/apple/callback', async (req, res) => {
  return res.redirect('/?oauth=unavailable');
});

app.post('/api/member-code', async (req, res) => {
  const account = await requireAccount(req, res);
  if (!account) return;
  const result = await accounts.redeemMemberCode(account.id, req.body?.code || req.body?.member_code);
  if (!result.ok) return res.status(400).json(result);
  res.json(result);
});

app.post('/api/member-codes', async (req, res) => {
  const need = process.env.MEMBER_ISSUE_KEY;
  if (!need) return res.status(404).json({ ok: false, error: 'Not found' });
  const got = req.get('x-issue-key') || req.body?.issue_key;
  if (got !== need) return res.status(404).json({ ok: false, error: 'Not found' });
  const result = await accounts.issueMemberCode({
    label: req.body?.label,
    seats: req.body?.seats
  });
  res.status(201).json(result);
});

app.post('/api/logout', async (req, res) => {
  await accounts.logout(tokenOf(req));
  res.json({ ok: true });
});

app.get('/api/me', async (req, res) => {
  const account = await resolveAccount(req);
  if (!account) return res.status(401).json({ ok: false, error: 'Sign in to continue' });
  res.json({ ok: true, account });
});

app.patch('/api/me', async (req, res) => {
  const account = await requireAccount(req, res);
  if (!account) return;
  const result = await accounts.updateAccount(account.id, req.body || {});
  if (!result.ok) return res.status(400).json(result);
  res.json(result);
});

app.get('/api/account', async (req, res) => {
  const account = await requireAccount(req, res);
  if (!account) return;
  const [recents, messages, invites, orders] = await Promise.all([
    accounts.listRecents(account.id),
    accounts.listMessages(account.id),
    accounts.listInvites(account.id),
    store.listOrders(40, account.id)
  ]);
  res.json({ ok: true, account, recents, messages, invites, updates: orders });
});

app.get('/api/recents', async (req, res) => {
  const account = await requireAccount(req, res);
  if (!account) return;
  res.json({ ok: true, recents: await accounts.listRecents(account.id) });
});

app.post('/api/recents', async (req, res) => {
  const account = await requireAccount(req, res);
  if (!account) return;
  const row = await accounts.addRecent(account.id, req.body || {});
  res.status(201).json({ ok: true, recent: row });
});

app.get('/api/messages', async (req, res) => {
  const account = await requireAccount(req, res);
  if (!account) return;
  res.json({ ok: true, messages: await accounts.listMessages(account.id) });
});

app.post('/api/messages', async (req, res) => {
  const account = await requireAccount(req, res);
  if (!account) return;
  const result = await accounts.addMessage(account.id, req.body?.body);
  if (!result.ok) return res.status(400).json(result);
  res.status(201).json(result);
});

app.get('/api/invites', async (req, res) => {
  const account = await requireAccount(req, res);
  if (!account) return;
  res.json({ ok: true, invites: await accounts.listInvites(account.id) });
});

app.post('/api/invites', async (req, res) => {
  const account = await requireAccount(req, res);
  if (!account) return;
  const result = await accounts.addInvite(account.id, req.body?.email);
  if (!result.ok) return res.status(400).json(result);
  res.status(201).json(result);
});

app.post('/api/consent', async (req, res) => {
  const account = await requireAccount(req, res);
  if (!account) return;
  const allow = req.body?.learn_consent !== false;
  const result = await accounts.updateAccount(account.id, { learn_consent: allow });
  res.json(result);
});

app.get('/api/extractors/stats', async (req, res) => {
  const { loadCounties } = require('./services/urlFinder');
  const slots = await extractors.stats();
  slots.catalog = loadCounties().length;
  const working = await extractors.listActive(12);
  res.json({ ok: true, slots, working, model: llm.status().model });
});

app.get('/api/extractors', async (req, res) => {
  const account = await requireAccount(req, res);
  if (!account) return;
  const q = (req.query.q || '').trim();
  const parsed = parseSearchQuery(q);
  if (!parsed.county) return res.status(400).json({ ok: false, error: 'Provide a county and state' });
  const lookup = lookupBundle(parsed.raw, parsed.county, parsed.state);
  if (!lookup.ok) return res.status(400).json(lookup);
  const slot = await extractors.ensureSlot(lookup);
  res.json({ ok: true, extractor: slot, lookup });
});

app.post('/api/intelligence', async (req, res) => {
  const account = await resolveAccount(req);
  const q = String(req.body?.q || req.body?.query || '').trim();
  if (!q) return res.status(400).json({ ok: false, error: 'What property are you researching today?' });
  const access = await accounts.consumeSearch({ account, taskId: req.body?.task_id });
  if (!access.ok) return res.status(access.status || 401).json(access);
  const routedQ = access.follow_up && access.task?.prompt ? `${q}\n${access.task.prompt}` : q;
  const routed = await operator.dispatch({ q: routedQ, accountId: account?.id });
  if (!routed.ok) return res.status(400).json(routed);
  const { parsed, lookup, agent, discoveries } = routed;
  let task = access.task || null;
  if (!access.follow_up && account) {
    task = await accounts.startTask({
      accountId: account.id,
      prompt: q,
      jurisdictionKey: lookup.key
    });
  }
  const card = buildCard({ parsed, lookup, extractor: agent, amounts: req.body?.amounts });
  const production = drProduction.llmBlock({
    lookupKey: lookup.key,
    county: lookup.jurisdiction?.county || parsed.county,
    state: lookup.jurisdiction?.state || parsed.state,
    parcel: parsed.apn,
    message: q
  });
  if (account && !access.follow_up) {
    await accounts.addRecent(account.id, {
      kind: 'search',
      label: card.label,
      detail: lookup.urlLocked ? 'County agent · locked collector URL' : 'County agent · no locked URL'
    });
  }
  if (account && account.learn_consent) {
    await extractors.addFeedback({
      accountId: account.id,
      jurisdictionKey: lookup.key,
      extractorId: agent.id,
      kind: access.follow_up ? 'follow_up' : 'search',
      body: q
    });
  }
  let talk = production.isolated_field
    ? production.speak
    : production.on_file
      ? `${production.speak} ${card.summary}`
      : card.summary;
  const memoryBits = [
    agent.parcel_format ? `Parcel format: ${agent.parcel_format}` : '',
    Array.isArray(agent.exceptions) && agent.exceptions.length
      ? `Known exceptions: ${agent.exceptions.slice(-3).map((e) => e.value || e.kind).join('; ')}`
      : '',
    production.isolated_field
      ? `User named field: ${production.isolated_field.header} = ${production.isolated_field.empty ? '(empty)' : production.isolated_field.value}`
      : 'Talk about the whole DR Production Results row. Do not lecture columns unless named.'
  ]
    .filter(Boolean)
    .join('\n');
  const spoken = await llm.complete({
    temperature: 0.1,
    max_tokens: 280,
    messages: [
      {
        role: 'system',
        content:
          'You are the WebPoint central operator talking through a county agent. Use only the locked tax collecting entity. NEVER invent URLs or dollar amounts. Present a collector link only when it is locked and verified. If it is not locked, ask the user to confirm the tax collecting entity search page. Speak about the DR Production Results document as one row for this parcel. Isolate a single column only when the user named that field. Empty cells stay empty. Parcel formats are per county on the extractor.'
      },
      {
        role: 'user',
        content: `Query: ${q}\nCounty agent: ${lookup.key}\nEntity: ${lookup.entity}\nLocked URL: ${lookup.officialUrl || '(none)'}\nExtractor v${agent.version}\n${memoryBits}\nProduction: ${production.speak}\nWrite 2 short sentences.`
      }
    ]
  });
  if (spoken.ok && spoken.text) talk = spoken.text;
  card.summary = talk;
  await store.addConversation(sessionIdOf(req), 'user', q, null);
  await store.addConversation(sessionIdOf(req), 'assistant', talk, spoken.model || llm.status().model);
  res.json({
    ok: true,
    query: q,
    task_id: task?.id || null,
    follow_up: Boolean(access.follow_up),
    format: req.body?.format === 'pdf' ? 'pdf' : 'html',
    parsed,
    lookup,
    extractor: agent,
    agent,
    operator: {
      role: 'central',
      routed_to: routed.routed_to,
      shared: true,
      discoveries: discoveries || [],
      handoff: routed.handoff
    },
    handoff: routed.handoff,
    plan: access.plan,
    continue_gate: access.plan === 'member' ? null : 'member',
    card,
    certificate: buildCertificate({
      parsed,
      lookup,
      extractor: agent,
      amounts: req.body?.amounts,
      card,
      query: q
    }),
    money: {
      assessed: formatMoney(card.assessed),
      land: formatMoney(card.land),
      improvement: formatMoney(card.improvement),
      total_tax: formatMoney(card.total_tax)
    }
  });
});

app.post('/api/extractors/heal', async (req, res) => {
  const account = await requireAccount(req, res);
  if (!account) return;
  const member = accounts.memberRequired(account);
  if (!member.ok) return res.status(member.status).json(member);
  if (!account.learn_consent) {
    return res.status(403).json({
      ok: false,
      error: 'Allow session learning in the permissions dialog so this extractor can be saved for the tax collecting entity.'
    });
  }
  const feedback = String(req.body?.feedback || req.body?.body || '').trim();
  if (feedback.length < 8) {
    return res.status(400).json({ ok: false, error: 'Describe what changed on the collector page' });
  }
  const q = String(req.body?.q || req.body?.query || '').trim();
  const parsed = parseSearchQuery(q || feedback);
  const lookup = lookupBundle(parsed.raw || q, parsed.county, parsed.state);
  if (!lookup.ok) return res.status(400).json(lookup);
  const previous = await extractors.ensureSlot(lookup);
  const urlDecision = resolveHealedUrl(lookup, req.body?.proposed_url);
  let method = methodFromFeedback(feedback, lookup, previous);
  const repaired = await llm.complete({
    heavy: true,
    temperature: 0,
    max_tokens: 400,
    messages: [
      {
        role: 'system',
        content:
          'Return JSON only: {"steps":["..."],"search_by":["parcel","owner"],"notes":"..."}. You are repairing a tax-collector EXTRACTOR. Never invent a URL. The search_url is locked if provided.'
      },
      {
        role: 'user',
        content: `Entity: ${lookup.entity}\nLocked URL: ${lookup.officialUrl || '(none)'}\nPrior method: ${JSON.stringify(previous.method)}\nUser feedback: ${feedback}`
      }
    ]
  });
  if (repaired.ok && repaired.text) {
    try {
      const jsonMatch = repaired.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsedMethod = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsedMethod.steps) && parsedMethod.steps.length) method = parsedMethod;
      }
    } catch (err) {
      console.error('heal llm parse', err.message);
    }
  }
  const saved = await extractors.saveNewVersion({
    previous,
    lookup,
    method,
    notes: feedback,
    source: 'user_session',
    accountId: account.id,
    searchUrl: urlDecision.url || previous.search_url
  });
  await extractors.addFeedback({
    accountId: account.id,
    jurisdictionKey: lookup.key,
    extractorId: saved.id,
    kind: 'heal',
    body: feedback
  });
  const card = buildCard({ parsed, lookup: { ...lookup, officialUrl: saved.search_url || lookup.officialUrl }, extractor: saved });
  res.json({
    ok: true,
    healed: true,
    urlRejected: urlDecision.rejected,
    urlReason: urlDecision.reason,
    extractor: saved,
    lookup,
    card,
    money: {
      assessed: formatMoney(card.assessed),
      land: formatMoney(card.land),
      improvement: formatMoney(card.improvement),
      total_tax: formatMoney(card.total_tax)
    },
    message: `Saved extractor v${saved.version} for ${saved.entity || saved.county + ' County'} (${saved.state}). Working search page: ${saved.search_url || 'not locked'}.`
  });
});

app.get('/api/lookup', (req, res) => {
  const message = (req.query.q || req.query.message || '').trim();
  const county = (req.query.county || '').trim();
  const state = (req.query.state || '').trim();
  const result = lookupBundle(message, county, state);
  if (!result.ok) return res.status(400).json(result);
  res.json(result);
});

app.get('/api/suggest', (req, res) => {
  const q = (req.query.q || req.query.query || '').trim();
  const limit = Number(req.query.limit) || 8;
  res.json({ ok: true, q, suggestions: suggestJurisdictions(q, limit) });
});

app.get('/api/coverage', (req, res) => {
  const coverage = catalogCoverage();
  res.json({
    ok: true,
    ...coverage,
    badge: `${coverage.rows.toLocaleString('en-US')} catalog slots`,
    locked_badge: `${coverage.locked.toLocaleString('en-US')} locked collector portals`
  });
});

app.get('/api/production', async (req, res) => {
  const account = await requireAccount(req, res);
  if (!account) return;
  const q = String(req.query.q || req.query.query || '').trim();
  const parsed = parseSearchQuery(q || `${req.query.county || ''} ${req.query.state || ''} ${req.query.parcel || ''}`);
  const county = parsed.county || req.query.county;
  const state = parsed.state || req.query.state;
  if (!county || !state) {
    return res.status(400).json({ ok: false, error: 'Name a county and state, e.g. Hamilton OH or Sangamon, IL' });
  }
  const lookup = lookupForApi(county, state);
  const key = `${(lookup.canonicalState || state).toUpperCase()}-${lookup.canonicalCounty || county}`;
  const block = drProduction.llmBlock({
    lookupKey: key,
    county: lookup.canonicalCounty || county,
    state: lookup.canonicalState || state,
    parcel: parsed.apn || req.query.parcel,
    message: q || req.query.field || ''
  });
  res.json({
    ok: true,
    lookup: { key, urlLocked: Boolean(lookup.urlLocked), officialUrl: lookup.officialUrl || null },
    production: block
  });
});

app.get('/api/launch-plan', (req, res) => {
  res.json({
    ok: true,
    ...launchPlan
  });
});

app.post(['/api/chat', '/v1/chat'], async (req, res) => {
  const message = (req.body?.message || '').trim();
  if (!message) return res.status(400).json({ error: 'Message is required' });
  const sid = sessionIdOf(req);

  const scenarioMatch = matchScenario(message);
  const parsed = parseSearchQuery(message);
  const jurisdiction = parsed.county ? { county: parsed.county, state: parsed.state } : { county: null, state: null };
  const lookup = jurisdiction.county
    ? lookupForApi(jurisdiction.county, jurisdiction.state)
    : null;
  const urlLocked = Boolean(lookup && lookup.urlLocked);
  const lockedUrl = (lookup && lookup.officialUrl) || '';
  const jurKey = jurisdiction.county
    ? `${(jurisdiction.state || '').toUpperCase()}-${jurisdiction.county}`
    : null;
  const chunks = await store.searchKnowledge(message, jurKey);
  const ragBlock = chunks.length
    ? `\n--- RAG (internal knowledge, cite as WebPoint playbook — never invent URLs) ---\n${chunks
        .map((c) => `[${c.kind}] ${c.title}: ${c.body}`)
        .join('\n')}`
    : '';

  const systemContent =
    enrichSystemPrompt(jurisdiction.county, jurisdiction.state, {
      scenarioMatch,
      message,
      parcel: parsed.apn
    }) +
    ragBlock +
    `\nYou may also draft TCS/TPA/RDS workflow steps. Still never invent collector URLs.`;

  let fullResponse = urlLocked && lockedUrl
    ? buildLockedUrlPrefix(lockedUrl, lookup.confidence, lookup.entity)
    : '';

  const finish = async () => {
    if (urlLocked && lockedUrl) {
      fullResponse = enforceLockedSpulUrl(fullResponse, lockedUrl, lookup.confidence);
    }
    await store.addConversation(sid, 'user', message, null);
    await store.addConversation(sid, 'assistant', fullResponse, llm.status().model);
  };

  if (!llm.groqEnabled()) {
    fullResponse = synthesizeSpul(lookup || { confidence: 'not_found', entityNote: 'No jurisdiction detected.' });
    if (chunks.length) {
      fullResponse += `\n\nPLAYBOOK:\n- ${chunks[0].title}`;
    }
    await finish();
    res.json({
      ok: true,
      mode: 'database',
      scenarioId: scenarioMatch.scenarioId,
      urlLocked: Boolean(urlLocked),
      content: fullResponse
    });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });
  if (urlLocked && lockedUrl) {
    res.write(`data: ${JSON.stringify({ type: 'meta', scenarioId: scenarioMatch.scenarioId, urlLocked: true })}\n\n`);
  }

  try {
    const history = await store.historyFor(sid);
    const userContent =
      urlLocked && lockedUrl
        ? `${message}\n\n[URL already verified in SPUL database. Output SPUL_ENTITY, SPUL_CONFIDENCE, SPUL_ACTIONS, SPUL_CONTEXT only — SPUL_URL is locked to: ${lockedUrl}]`
        : message;
    const stream = await llm.streamGroq({
      messages: [
        { role: 'system', content: systemContent },
        ...history.slice(-12),
        { role: 'user', content: userContent }
      ]
    });
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || '';
      if (delta) {
        fullResponse += delta;
        res.write(`data: ${JSON.stringify({ type: 'chunk', content: delta })}\n\n`);
      }
    }
    await finish();
    res.write(`data: ${JSON.stringify({ type: 'done', scenarioId: scenarioMatch.scenarioId })}\n\n`);
    res.end();
  } catch (err) {
    console.error('Groq error:', err.message);
    if (!fullResponse) fullResponse = synthesizeSpul(lookup || {});
    await finish();
    res.write(`data: ${JSON.stringify({ type: 'error', content: fullResponse })}\n\n`);
    res.end();
  }
});

app.post(['/v1/feedback', '/api/feedback'], async (req, res) => {
  const body = String(req.body?.feedback || req.body?.body || req.body?.message || '').trim();
  if (body.length < 4) {
    return res.status(400).json({ ok: false, error: 'Feedback is empty' });
  }
  const account = await resolveAccount(req);
  let jurisdictionKey = String(req.body?.jurisdiction_key || req.body?.county_key || '').trim();
  let lookup = null;
  if (!jurisdictionKey) {
    const bundled = lookupBundle(req.body?.q || body, req.body?.county, req.body?.state);
    if (bundled.ok) {
      jurisdictionKey = bundled.key;
      lookup = bundled;
    }
  }
  const row = await extractors.addFeedback({
    accountId: account?.id || null,
    jurisdictionKey,
    kind: req.body?.kind || 'tjos',
    body,
    extractorId: req.body?.extractor_id
  });
  let discoveries = [];
  if (jurisdictionKey) {
    try {
      const routed = await operator.dispatch({
        q: req.body?.q || body,
        accountId: account?.id,
        feedback: body
      });
      discoveries = routed.discoveries || [];
    } catch (err) {
      console.error('feedback dispatch', err.message);
    }
  }
  res.json({
    ok: true,
    persisted: true,
    db: store.usingPostgres() ? 'postgres' : 'memory',
    feedback: row,
    jurisdiction_key: jurisdictionKey || null,
    lookup,
    discoveries
  });
});

app.post('/api/orders', async (req, res) => {
  const account = await requireAccount(req, res);
  if (!account) return;
  const member = accounts.memberRequired(account);
  if (!member.ok) return res.status(member.status).json(member);
  const body = req.body || {};
  const parcels = Array.isArray(body.parcels) ? body.parcels : [];
  if (!parcels.length) return res.status(400).json({ ok: false, error: 'Add at least one parcel' });
  if (parcels.length > store.MAX_PARCELS) {
    return res.status(400).json({
      ok: false,
      error: `Demo / LandNav batch cap is ${store.MAX_PARCELS} parcels. Split the order.`
    });
  }
  const county = (body.county || 'Chippewa').trim();
  const state = (body.state || 'WI').toUpperCase().trim();
  const lookup = lookupForApi(county, state);
  const product = ['TCS', 'TPA', 'RDS'].includes(body.product) ? body.product : 'TCS';
  const { order, parcels: rows } = await store.createOrder({
    product,
    file_number: body.file_number,
    client_name: body.client_name,
    county,
    state,
    closing_date: body.closing_date || null,
    source: 'squarespace-embed',
    notes: body.notes || '',
    account_id: account.id,
    parcels
  });
  await accounts.addRecent(account.id, {
    kind: 'order',
    label: `${product} · ${county} County ${state}`,
    detail: `${parcels.length} parcel${parcels.length === 1 ? '' : 's'}${body.file_number ? ' · ' + body.file_number : ''}`
  });

  const asOf = new Date().toISOString().slice(0, 10);
  const certs = rows.map((p) => {
    const label = p.parcel_id || p.owner_name || p.address_line || 'parcel';
    const collectorUrl =
      product === 'RDS'
        ? lookup.rdsURL || lookup.url
        : lookup.url;
    const narrative = [
      `${product} draft for ${label} in ${county} County, ${state}.`,
      `As of ${asOf}. Collector search: ${collectorUrl || 'not locked'}.`,
      lookup.entityNote || '',
      product === 'TCS'
        ? 'This is a collector-sourced certificate draft. Confirm amounts on the official portal before closing.'
        : product === 'TPA'
          ? 'Targeted portfolio analysis row. Compare status across the batch; flag delinquencies for review.'
          : 'Recorded document search pointer. Use the county RDS portal for title instruments.'
    ]
      .filter(Boolean)
      .join(' ');
    return {
      id: store.id(),
      order_id: order.id,
      parcel_row_id: p.id,
      parcel_id: p.parcel_id,
      as_of: asOf,
      tax_status: 'unknown',
      current_due: null,
      delinquent_due: null,
      collector_url: collectorUrl,
      narrative
    };
  });
  await store.saveCertificates(certs);
  const packed = await store.getOrder(order.id);
  res.status(201).json({
    ok: true,
    lookup: { ...lookup, jurisdiction: { county, state } },
    ...packed
  });
});

app.get('/api/orders/:id', async (req, res) => {
  const account = await requireAccount(req, res);
  if (!account) return;
  const packed = await store.getOrder(req.params.id);
  if (!packed.order) return res.status(404).json({ ok: false, error: 'Order not found' });
  if (packed.order.account_id && packed.order.account_id !== account.id) {
    return res.status(404).json({ ok: false, error: 'Order not found' });
  }
  res.json({ ok: true, ...packed });
});

app.get('/api/orders', async (req, res) => {
  const account = await requireAccount(req, res);
  if (!account) return;
  const rows = await store.listOrders(50, account.id);
  res.json({ ok: true, orders: rows });
});

app.get('/api/workplace', (req, res) => {
  res.json({ ok: true, ...scanWorkplaceClone() });
});

app.post('/api/workplace/import', async (req, res) => {
  const scan = scanWorkplaceClone();
  if (!scan.found) {
    return res.status(404).json({
      ok: false,
      error: scan.note,
      tried: scan.tried
    });
  }
  const inventories = scan.roots.map((root) => inventoryRepo(root));
  const filesSeen = inventories.reduce((n, inv) => n + inv.files_seen, 0);
  const row = await store.recordImport({
    path: scan.roots.join(' | '),
    kind: 'passport-scan',
    files_seen: filesSeen,
    notes: JSON.stringify(inventories.map((i) => ({ root: i.root, kinds: i.kinds })))
  });
  res.json({ ok: true, import: row, inventories });
});

app.get('/embed.js', (req, res) => {
  res.type('text/javascript');
  const origin = `${req.protocol}://${req.get('host')}`;
  res.send(`(function(){
    var d=document.currentScript;
    var k=d && d.getAttribute('data-key') || '';
    var src=${JSON.stringify(origin)}+'/'+(k?('?k='+encodeURIComponent(k)):'');
    var wrap=document.createElement('div');
    wrap.className='wp-tcs-embed-root';
    wrap.innerHTML='<iframe class="wp-tcs-frame" title="WebPoint Tax Certificate Processor" src="'+src+'" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="clipboard-read; clipboard-write"></iframe>';
    var st=document.createElement('style');
    st.textContent='.wp-tcs-embed-root{box-sizing:border-box;width:100%;margin:0 auto;position:relative;padding-top:62.5%}.wp-tcs-frame{position:absolute;inset:0;width:100%;height:100%;border:0;border-radius:16px;background:#cfeaf8}';
    d.parentNode.insertBefore(st,d);
    d.parentNode.insertBefore(wrap,d);
  })();`);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

async function main() {
  const db = await store.init();
  const scan = scanWorkplaceClone();
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Tax Certificate Processor on 0.0.0.0:${PORT} db=${db.mode} llm=${llm.status().model} workplace=${scan.found}`);
  });
  const drain = (signal) => {
    console.log(signal, 'draining');
    server.close(async () => {
      try {
        await store.close();
      } catch (err) {
        console.error(err);
      }
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 15000).unref();
  };
  process.on('SIGTERM', () => drain('SIGTERM'));
  process.on('SIGINT', () => drain('SIGINT'));
  return server;
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { app, main };
