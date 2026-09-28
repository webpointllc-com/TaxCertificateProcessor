'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');
const { OpenAI } = require('openai');
const store = require('./db/store');
const accounts = require('./db/accounts');
const extractors = require('./db/extractors');
const {
  parseSearchQuery,
  buildCard,
  formatMoney,
  resolveHealedUrl,
  methodFromFeedback
} = require('./services/searchIntelligence');
const { enrichSystemPrompt, enforceLockedSpulUrl } = require('./services/taxIntelligence');
const { parseJurisdiction, lookupForApi, suggestJurisdictions } = require('./services/urlFinder');
const { hasUrlLock, buildLockedUrlPrefix } = require('./services/spulTruth');
const { matchScenario } = require('./services/scenarioRouter');
const { scanWorkplaceClone, inventoryRepo } = require('../scripts/workplace-scan');

const PORT = process.env.PORT || 3000;
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const FRAME_ANCESTORS = [
  "'self'",
  'https://*.squarespace.com',
  'https://*.squarespace-cdn.com',
  'https://webpointllc.com',
  'https://*.webpointllc.com'
].join(' ');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '10mb' }));
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', `frame-ancestors ${FRAME_ANCESTORS}`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
app.use(express.static(path.join(__dirname, '..', 'public')));

const groq = process.env.GROQ_API_KEY
  ? new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' })
  : null;

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
  const url = lookup.url || lookup.lockedUrl || '';
  return [
    `SPUL_URL: ${url}`,
    `SPUL_ENTITY: ${lookup.entity || 'Property tax search'}`,
    `SPUL_CONFIDENCE: ${lookup.confidence || 'not_found'}`,
    'SPUL_ACTIONS:',
    '- Search by owner last name',
    '- Search by parcel / account number',
    '- View tax payment history',
    `SPUL_CONTEXT: ${lookup.entityNote || lookup.source || 'Locked from the Search Spul jurisdiction database.'}`
  ].join('\n');
}

app.get('/api/health', async (req, res) => {
  const scan = scanWorkplaceClone();
  const lastImport = await store.latestImport();
  res.json({
    ok: true,
    product: 'WebPoint Tax Certificate Processor',
    modules: ['TCS', 'TPA', 'RDS', 'SPUL'],
    firstCounty: { county: 'Chippewa', state: 'WI' },
    db: store.usingPostgres() ? 'postgres' : 'memory',
    groq: Boolean(groq),
    model: groq ? GROQ_MODEL : 'spul-db',
    extractors: await extractors.stats(),
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

app.post('/api/signup', async (req, res) => {
  try {
    const result = await accounts.signup({ ...(req.body || {}), sessionId: sessionIdOf(req) });
    if (!result.ok) return res.status(400).json(result);
    res.status(201).json(result);
  } catch (err) {
    console.error('signup', err.message);
    res.status(500).json({ ok: false, error: 'Could not create the account' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const result = await accounts.requestLoginCode(req.body || {});
    if (!result.ok) return res.status(401).json(result);
    res.json(result);
  } catch (err) {
    console.error('login', err.message);
    res.status(500).json({ ok: false, error: 'Could not sign in' });
  }
});

app.post('/api/verify', async (req, res) => {
  try {
    const result = await accounts.verifyOtp(req.body || {});
    if (!result.ok) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error('verify', err.message);
    res.status(500).json({ ok: false, error: 'Could not confirm that code' });
  }
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
  res.json({ ok: true, slots, working, model: groq ? GROQ_MODEL : 'spul-db' });
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
  if (!q) return res.status(400).json({ ok: false, error: 'Search county, parcel number, or address' });
  const parsed = parseSearchQuery(q);
  const lookup = lookupBundle(parsed.raw, parsed.county, parsed.state);
  if (!lookup.ok) return res.status(400).json(lookup);
  const access = await accounts.consumeSearch({ account, sessionId: sessionIdOf(req) });
  if (!access.ok) return res.status(access.status || 402).json(access);
  const slot = await extractors.ensureSlot(lookup);
  const card = buildCard({ parsed, lookup, extractor: slot, amounts: req.body?.amounts });
  if (account) {
    await accounts.addRecent(account.id, {
      kind: 'search',
      label: card.label,
      detail: lookup.urlLocked ? 'Locked collector URL' : 'No locked collector URL'
    });
  }
  if (account && account.learn_consent) {
    await extractors.addFeedback({
      accountId: account.id,
      jurisdictionKey: lookup.key,
      extractorId: slot.id,
      kind: 'search',
      body: q
    });
  }
  let talk = card.summary;
  if (groq) {
    try {
      const locked = lookup.officialUrl || '';
      const completion = await groq.chat.completions.create({
        model: GROQ_MODEL,
        temperature: 0.1,
        max_tokens: 280,
        messages: [
          {
            role: 'system',
            content:
              'You are WebPoint Property Tax Intelligence. Talk the user through the locked tax collecting entity only. NEVER invent URLs or dollar amounts. If amounts are unknown, say to confirm on the collector page. Cite the entity name and the locked URL exactly.'
          },
          {
            role: 'user',
            content: `Query: ${q}\nEntity: ${lookup.entity}\nLocked URL: ${locked || '(none)'}\nExtractor v${slot.version} status ${slot.status}\nURL locked: ${Boolean(lookup.urlLocked)}\nWrite 2 short sentences for the Property Tax Summary.`
          }
        ]
      });
      const text = completion.choices?.[0]?.message?.content?.trim();
      if (text) talk = text;
    } catch (err) {
      console.error('intelligence llm', err.message);
    }
  }
  card.summary = talk;
  res.json({
    ok: true,
    query: q,
    format: req.body?.format === 'pdf' ? 'pdf' : 'html',
    parsed,
    lookup,
    extractor: slot,
    plan: access.plan,
    continue_gate: access.plan === 'member' ? null : access.plan === 'free' ? 'member' : 'account',
    card,
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
  if (groq) {
    try {
      const completion = await groq.chat.completions.create({
        model: GROQ_MODEL,
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
      const text = completion.choices?.[0]?.message?.content || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsedMethod = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsedMethod.steps) && parsedMethod.steps.length) method = parsedMethod;
      }
    } catch (err) {
      console.error('heal llm', err.message);
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

app.post('/api/chat', async (req, res) => {
  const message = (req.body?.message || '').trim();
  if (!message) return res.status(400).json({ error: 'Message is required' });
  const sid = sessionIdOf(req);

  const scenarioMatch = matchScenario(message);
  const parsed = parseJurisdiction(message);
  const jurisdiction = parsed.county ? parsed : { county: null, state: null };
  const lookup = jurisdiction.county
    ? lookupForApi(jurisdiction.county, jurisdiction.state)
    : null;
  const urlLocked = lookup && hasUrlLock(lookup.confidence, lookup.url);
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
    enrichSystemPrompt(jurisdiction.county, jurisdiction.state, { scenarioMatch }) +
    ragBlock +
    `\nYou may also draft TCS/TPA/RDS workflow steps. Still never invent collector URLs.`;

  let fullResponse = urlLocked && lookup.url
    ? buildLockedUrlPrefix(lookup.url, lookup.confidence, lookup.entity)
    : '';

  const finish = async () => {
    if (urlLocked && lookup.url) {
      fullResponse = enforceLockedSpulUrl(fullResponse, lookup.url, lookup.confidence);
    }
    await store.addConversation(sid, 'user', message, null);
    await store.addConversation(sid, 'assistant', fullResponse, groq ? GROQ_MODEL : 'spul-db');
  };

  if (!groq) {
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
  if (urlLocked && lookup.url) {
    res.write(`data: ${JSON.stringify({ type: 'meta', scenarioId: scenarioMatch.scenarioId, urlLocked: true })}\n\n`);
  }

  try {
    const history = await store.historyFor(sid);
    const userContent =
      urlLocked && lookup.url
        ? `${message}\n\n[URL already verified in SPUL database. Output SPUL_ENTITY, SPUL_CONFIDENCE, SPUL_ACTIONS, SPUL_CONTEXT only — SPUL_URL is locked to: ${lookup.url}]`
        : message;
    const stream = await groq.chat.completions.create({
      model: GROQ_MODEL,
      temperature: 0.1,
      max_tokens: 700,
      stream: true,
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
    console.log(`Tax Certificate Processor on 0.0.0.0:${PORT} db=${db.mode} groq=${Boolean(groq)} workplace=${scan.found}`);
  });
  return server;
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { app, main };
