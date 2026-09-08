'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');
const { OpenAI } = require('openai');
const store = require('./db/store');
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
    parcels
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
  const packed = await store.getOrder(req.params.id);
  if (!packed.order) return res.status(404).json({ ok: false, error: 'Order not found' });
  res.json({ ok: true, ...packed });
});

app.get('/api/orders', async (req, res) => {
  const gate = memberOk(req);
  const rows = await store.listOrders(gate.ok ? 50 : 5);
  res.json({ ok: true, gated: gate.gated && !gate.ok, orders: rows });
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
    st.textContent='.wp-tcs-embed-root{box-sizing:border-box;width:100%;margin:0 auto;position:relative;padding-top:62.5%}.wp-tcs-frame{position:absolute;inset:0;width:100%;height:100%;border:0;border-radius:16px;background:#050b20}';
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
