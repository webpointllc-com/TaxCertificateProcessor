'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const accounts = require('./accounts');
const extractors = require('./extractors');
const training = require('./training');

const SCHEMA_PATH = path.join(__dirname, 'schema.sql');
const MAX_PARCELS = 10;

const memory = {
  orders: [],
  parcels: [],
  certs: [],
  convos: [],
  imports: [],
  chunks: []
};

let pool = null;

function id() {
  return crypto.randomUUID();
}

function usingPostgres() {
  return Boolean(pool);
}

function postgresSslConfig(url) {
  const mode = String(process.env.DATABASE_SSL || 'auto').toLowerCase();
  if (mode === '0' || mode === 'false' || mode === 'disable' || mode === 'off') return undefined;
  if (mode === '1' || mode === 'true' || mode === 'require') return { rejectUnauthorized: false };
  const u = String(url || '');
  if (/render\.com|rds\.amazonaws\.com|amazonaws\.com|sslmode=require/i.test(u)) {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

function poolOptions(url) {
  const max = Math.max(1, Math.min(Number(process.env.PGPOOL_MAX) || 10, 80));
  return {
    connectionString: url,
    max,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 8000,
    ssl: postgresSslConfig(url)
  };
}

function poolStats() {
  if (!pool) return { attached: false, max: 0 };
  return {
    attached: true,
    max: pool.options?.max || 0,
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount
  };
}

async function init() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    seedMemoryKnowledge();
    accounts.attachPool(null);
    extractors.attachPool(null);
    training.attachPool(null);
    return { mode: 'memory' };
  }
  const { Pool } = require('pg');
  pool = new Pool(poolOptions(url));
  const sql = fs.readFileSync(SCHEMA_PATH, 'utf8');
  await pool.query(sql);
  accounts.attachPool(pool);
  extractors.attachPool(pool);
  training.attachPool(pool);
  await seedPostgresKnowledge();
  return { mode: 'postgres' };
}

function seedMemoryKnowledge() {
  if (memory.chunks.length) return;
  for (const chunk of defaultChunks()) {
    memory.chunks.push({ ...chunk, id: chunk.id || id() });
  }
}

async function seedPostgresKnowledge() {
  for (const chunk of defaultChunks()) {
    await pool.query(
      `INSERT INTO knowledge_chunks (id, jurisdiction_key, kind, title, body)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body`,
      [chunk.id, chunk.jurisdiction_key, chunk.kind, chunk.title, chunk.body]
    );
  }
}

function defaultChunks() {
  return [
    {
      id: 'playbook-wi-chippewa-tcs',
      jurisdiction_key: 'WI-Chippewa',
      kind: 'playbook',
      title: 'Chippewa County WI — TCS tax certificate playbook',
      body: [
        'Product: Tax Certification System (TCS). Generate a tax certificate using collector-current data.',
        'Official tax search: https://pp-chippewa-co-wi-fb.app.landnav.com/login/index/ (Catalis/LandNav). Use Guest Sign In.',
        'Search methods: parcel number, owner last + first name, or house number + street. Entering less is more.',
        'Treasurer: Patricia Schimmel, 711 N Bridge Street Room 105, Chippewa Falls, WI 54729, 715-726-7960, TR-Web@chippewacountywi.gov.',
        'County treasurer collects postponed and delinquent real estate taxes, tax settlements, lottery credit, tax deed.',
        'Current December/January installments are paid to the LOCAL municipal treasurer, not always the county portal.',
        'LandNav payment cart max is 10 parcels per transaction — same batch cap as the WebPoint demo.',
        'Do not use chippewacounty.gov (dead host). Official county site is chippewacountywi.gov.',
        'RDS: Chippewa County Online Real Estate Search https://www.chippewacountywi.gov/451/Online-Real-Estate-Search',
        'GIS: https://mapping.chippewacountywi.gov/ (informational, not a legal survey).',
        'Wisconsin: Wis. Stat. ch. 74 (collection) and ch. 75 (land sold for taxes).'
      ].join(' ')
    },
    {
      id: 'playbook-ca-sandiego-ttc',
      jurisdiction_key: 'CA-SanDiego',
      kind: 'playbook',
      title: 'San Diego County CA — Treasurer-Tax Collector WebPayments',
      body: [
        'Tax collecting entity: San Diego County Treasurer-Tax Collector.',
        'Search: https://wps.sdttc.com/WebPayments/CoSDTreasurer2/search',
        'Reject: arcc.sandiegocounty.gov (Assessor/Recorder/County Clerk — not the pay/search page).',
        'SPA search options: Parcel Number (###-###-##-##), Owner, Mailing Address, Unsecured Bill Number. Button Begin Search.',
        'Casual queries like “parcel 325-061-08-00 in San Diego CA” route here. Present the link only because this URL is locked.'
      ].join(' ')
    },
    {
      id: 'playbook-il-cook-treasurer',
      jurisdiction_key: 'IL-Cook',
      kind: 'playbook',
      title: 'Cook County IL — Treasurer PIN search',
      body: [
        'Illinois: County Treasurer collects. Assessor/propertyinfo is values.',
        'Search: https://www.cookcountytreasurer.com/setsearchparameters.aspx',
        'PIN is five inputs txtPIN1–txtPIN5 (##-##-###-###-####).',
        'Reject cookcountypropertyinfo.com as the pay-taxes URL.'
      ].join(' ')
    },
    {
      id: 'playbook-tx-harris-tac',
      jurisdiction_key: 'TX-Harris',
      kind: 'playbook',
      title: 'Harris County TX — Tax Assessor-Collector',
      body: [
        'Texas: Tax Assessor-Collector collects. CAD does not.',
        'Search/pay: https://myharriscountytax.com/',
        'Office hub: https://www.hctax.net/Property/PropertyTax',
        'Reject harriscountytx.gov (county homepage, not a parcel search).'
      ].join(' ')
    },
    {
      id: 'playbook-workplace-tcs',
      jurisdiction_key: null,
      kind: 'workplace',
      title: 'Workplace Technologies TCS / TPA / RDS',
      body: [
        'Workplace Technologies (now evolving as WebPoint LLC) mined live municipal and county data for tax service and mortgage companies.',
        'TCS Tax Certification System: generate a tax certificate using data as current as the collectors.',
        'TPA Targeted Portfolio Analysis: bulk parcel tax searches that make offshore searching obsolete.',
        'RDS Recorded Document Search: compile and filter property title transactions.',
        'Inputs typically required: Address, City, State, Zip, County, Parcel ID, Owner Name(s), File Number, Closing Date.',
        'Bulk: 10 or more parcels related to the same closing. WebPoint public demo caps a batch at 10.',
        'Reports carry an as-of date. Updates are a first-class order type.',
        'Canonical clone of the original org lived on the WD Passport after workplace-technologies GitHub repos were emptied.'
      ].join(' ')
    },
    {
      id: 'playbook-spul-rules',
      jurisdiction_key: null,
      kind: 'spul',
      title: 'Search Spul URL lock rules',
      body: [
        'SPUL finds the official real property TAX SEARCH PAGE — where residents look up and pay taxes.',
        'TAX COLLECTOR / TREASURER is the payment search page. ASSESSOR / CAD is values only unless the DB says otherwise.',
        'Never invent URLs. Use the locked URL from golden_overrides or counties.json.',
        'When confidence is verified and the URL is a real collector search page, the URL is HARD LOCKED and may be shown.',
        'Do not present a link for a county homepage, a 404 catalog row, an assessor/CAD brochure, or a pattern that is not sure.',
        'If the lock is missing, work with the user to name the tax collecting entity and the search page. Never invent a host.',
        'Chippewa WI is locked to the LandNav Catalis portal, not chippewacounty.gov.',
        'San Diego CA is locked to Treasurer-Tax Collector WebPayments, not ARCC.',
        'Harris TX is locked to myharriscountytax.com, not harriscountytx.gov.',
        'Cook IL is locked to the County Treasurer PIN search, not cookcountypropertyinfo.com.',
        'The live Squarespace Searching page https://webpointllc.com/searching is the canonical operator index. Top of that page is the Tax Certificate Processor iframe (class wp-tcs-frame, src https://tax-certificate-processor.onrender.com/) — same public/SQUARESPACE_EMBED.html snippet. Render billing and OTP are operator-owned. Below the iframe is the County Tax Collecting Entity Index (~1,675 validated entries). That index, Bill Validated HTML (County_Names_Urls_BillValidated.html), and data/spul_searching_inventory.json are the same S-PUL URL registry. KY clerk/sheriff tax is ECCLIX at ecclix.com, not parked eclix.com. LaRue/Marshall KY use view.properlytaxes.com (PVDNet). Oldham KY uses ptax1.csiky.com. LA parishes use snstaxpayments.com parish paths or the sheriff property-details page. Never echo site passwords or index access codes.',
        'DR Production Results (finale/) is the output document: 40 columns, one row per parcel in a county/state.',
        'Talk about that whole row. Isolate a single column only when the user names that field.',
        'Parcel formats differ by county and live on the county extractor (self-heal / user feedback). Empty cells stay empty.'
      ].join(' ')
    },
    {
      id: 'playbook-searching-index',
      jurisdiction_key: null,
      kind: 'spul',
      title: 'webpointllc.com/searching — operator index + Render TCS iframe',
      body: [
        'Canonical operator page: https://webpointllc.com/searching (Squarespace Searching).',
        'The top slot is not a second product: it is the Tax Certificate Processor iframe class wp-tcs-frame src https://tax-certificate-processor.onrender.com/ with 1280×800 ScaleToFit (padding-top 62.5%). That is public/SQUARESPACE_EMBED.html.',
        'Render Starter web + Postgres billing, OTP, and Squarespace membership gates are operator-owned. The model does not invent a paywall or store site passwords.',
        'Under the iframe: County Tax Collecting Entity Index, 1,675 validated collector URLs. Same registry as data/spul_searching_inventory.json and public/County_Names_Urls_BillValidated.html.',
        'When a county is named, copy the locked collector URL from JURISDICTION DATA. Do not send users to assessor/CAD homepages when a collector search URL is locked.',
        'Vendor hosts: ecclix.com (not eclix.com), view.properlytaxes.com (not propertytaxes.com), ptax1.csiky.com (not celky.com), snstaxpayments.com (not sntaxpayments.com).'
      ].join(' ')
    },
    {
      id: 'playbook-extractor-table',
      jurisdiction_key: null,
      kind: 'spul',
      title: 'Extractor table dump + DR Production Results + live feedback',
      body: [
        'Workplace extractors live as one row per ST-CountyToken. The Development dump ExtractorUrls.txt (data/extractor_urls.txt) lists SearchUrl vs BaseUrl. Search wins. google.com, {parcel} templates, and blank URLs are not locks.',
        'Squarespace Searching / data/spul_searching_inventory.json is the cleaned overlay of that table. Golden overrides and operator locks still win.',
        'OH-Hamilton, CT-HartfordCity, IL-Sangamon keep empty search_url until the collector search page is confirmed even if the dump has a treasurer/homepage path.',
        'The document those extractors fill is DR Production Results in finale/ — 40 columns, same headers every county. Talk whole-row unless the user names a field. Empty cells stay empty.',
        'User and live session feedback (/v1/feedback) heals that county extractor: parcel_format variants, layout notes, exceptions. A locked collector URL is not replaced by a guessed host.'
      ].join(' ')
    },
    {
      id: 'playbook-site-validator',
      jurisdiction_key: null,
      kind: 'spul',
      title: 'Monthly + per-county site validator',
      body: [
        'Monthly work is a vendor-family matrix (npm run validate:families): one sample per host family, not 2k Chrome tabs. Shared homepages (lots.signatureinfo.com × 296) are hubs, not mass locks. Assessor SaaS stays assessor.',
        'Cloudflare JS challenges are not bypassed. Those families wait for the signed-in user\'s real Chrome tab. That click mints a wptpat_ portal access token (prefix, hash at rest, 24h, scopes portal_session + look_for). Biometrics are not forged.',
        'npm run validate:families then, before a release, npm run validate:extractors && npm run validate:apply. Golden overrides win. OH-Hamilton, CT-HartfordCity, IL-Sangamon stay unlocked until a collector search page is confirmed.',
        'Monthly: Render Starter re-runs validate-families.js when the last report is older than 28 days. Per-county: Open official tax search posts /api/extractors/session and stores wptpat_ in the tab. Apply to counties.json is the git catalog step — already-verified collectors stay locked on a flaky GET.'
      ].join(' ')
    },
    {
      id: 'playbook-dr-production',
      jurisdiction_key: null,
      kind: 'playbook',
      title: 'DR Production Results — finale folder',
      body: [
        'Workplace/WebPoint production workbooks live in finale/. Same columns for OH-Hamilton, CT-HartfordCity, IL-Sangamon.',
        'Columns: Agency Name, Reference, Tax Id, Parcel Number, CYR Dlq, PYR Dlq, Tax Sale, Parcel Notes, As Of, Bill Year, Bill Type, Bill Number, Bill Notes, Bill Amount, Balance Due, four installment date/amount/balance sets, redemption fields, Total Assessed Value, Improvement Value, Land Value, Owner 1 Name, Legal Description.',
        'Sangamon CR/Orig and PIN/Acq on older screenshots map to CYR Dlq and PYR Dlq.',
        'The LLM may discuss the meaning of the document. It only singles out a field when the user asks about that field for the parcel in that county/state.',
        'Extractors heal from session feedback: parcel_format variants, layout notes, locked URL stays locked.'
      ].join(' ')
    }
  ];
}

async function searchKnowledge(query, jurisdictionKey) {
  const q = (query || '').trim();
  if (usingPostgres()) {
    try {
      const { rows } = await pool.query(
        `SELECT id, jurisdiction_key, kind, title, body,
                ts_rank(tsv, plainto_tsquery('english', $1)) AS rank
         FROM knowledge_chunks
         WHERE tsv @@ plainto_tsquery('english', $1)
            OR ($2::text IS NOT NULL AND jurisdiction_key = $2)
         ORDER BY rank DESC NULLS LAST
         LIMIT 8`,
        [q || 'tax certificate', jurisdictionKey || null]
      );
      if (rows.length) return rows;
    } catch (_) {
      /* fall through */
    }
    const { rows } = await pool.query(
      `SELECT id, jurisdiction_key, kind, title, body FROM knowledge_chunks
       WHERE body ILIKE '%' || $1 || '%' OR title ILIKE '%' || $1 || '%'
          OR ($2::text IS NOT NULL AND jurisdiction_key = $2)
       LIMIT 8`,
      [q, jurisdictionKey || null]
    );
    return rows;
  }
  seedMemoryKnowledge();
  const needle = q.toLowerCase();
  return memory.chunks
    .filter((c) => {
      if (jurisdictionKey && c.jurisdiction_key === jurisdictionKey) return true;
      const hay = `${c.title} ${c.body}`.toLowerCase();
      return !needle || hay.includes(needle) || needle.split(/\s+/).some((w) => w.length > 3 && hay.includes(w));
    })
    .slice(0, 8);
}

async function createOrder(input) {
  const order = {
    id: id(),
    product: input.product || 'TCS',
    file_number: input.file_number || '',
    client_name: input.client_name || '',
    county: input.county || '',
    state: (input.state || '').toUpperCase(),
    closing_date: input.closing_date || null,
    status: 'researching',
    source: input.source || 'embed',
    notes: input.notes || '',
    account_id: input.account_id || null,
    created_at: new Date().toISOString()
  };
  const parcels = (input.parcels || []).map((p, i) => ({
    id: id(),
    order_id: order.id,
    parcel_id: p.parcel_id || p.parcel || '',
    owner_name: p.owner_name || p.owner || '',
    address_line: p.address_line || p.address || '',
    city: p.city || '',
    zip: p.zip || '',
    legal_description: p.legal_description || '',
    amounts: p.amounts || {},
    collector_payload: p.collector_payload || {},
    status: 'researching',
    sort_order: i
  }));

  if (usingPostgres()) {
    await pool.query(
      `INSERT INTO orders (id, product, file_number, client_name, county, state, closing_date, status, source, notes, account_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        order.id, order.product, order.file_number, order.client_name, order.county,
        order.state, order.closing_date, order.status, order.source, order.notes, order.account_id
      ]
    );
    for (const p of parcels) {
      await pool.query(
        `INSERT INTO order_parcels
          (id, order_id, parcel_id, owner_name, address_line, city, zip, legal_description, amounts, collector_payload, status, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12)`,
        [
          p.id, p.order_id, p.parcel_id, p.owner_name, p.address_line, p.city, p.zip,
          p.legal_description, JSON.stringify(p.amounts), JSON.stringify(p.collector_payload),
          p.status, p.sort_order
        ]
      );
    }
  } else {
    memory.orders.unshift(order);
    memory.parcels.push(...parcels);
  }
  return { order, parcels };
}

async function saveCertificates(certs) {
  if (usingPostgres()) {
    for (const c of certs) {
      await pool.query(
        `INSERT INTO certificates
          (id, order_id, parcel_row_id, parcel_id, as_of, tax_status, current_due, delinquent_due, collector_url, narrative)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          c.id, c.order_id, c.parcel_row_id, c.parcel_id, c.as_of, c.tax_status,
          c.current_due, c.delinquent_due, c.collector_url, c.narrative
        ]
      );
    }
    if (certs[0]) {
      await pool.query(`UPDATE orders SET status = 'issued' WHERE id = $1`, [certs[0].order_id]);
    }
  } else {
    memory.certs.push(...certs);
    const order = memory.orders.find((o) => o.id === certs[0]?.order_id);
    if (order) order.status = 'issued';
  }
  return certs;
}

async function getOrder(orderId) {
  if (usingPostgres()) {
    const { rows: orders } = await pool.query(`SELECT * FROM orders WHERE id = $1`, [orderId]);
    const { rows: parcels } = await pool.query(
      `SELECT * FROM order_parcels WHERE order_id = $1 ORDER BY sort_order`,
      [orderId]
    );
    const { rows: certs } = await pool.query(`SELECT * FROM certificates WHERE order_id = $1`, [orderId]);
    return { order: orders[0] || null, parcels, certificates: certs };
  }
  const order = memory.orders.find((o) => o.id === orderId) || null;
  const parcels = memory.parcels.filter((p) => p.order_id === orderId);
  const certificates = memory.certs.filter((c) => c.order_id === orderId);
  return { order, parcels, certificates };
}

async function listOrders(limit = 20, accountId) {
  if (usingPostgres()) {
    if (accountId) {
      const { rows } = await pool.query(
        `SELECT * FROM orders WHERE account_id = $1 ORDER BY created_at DESC LIMIT $2`,
        [accountId, limit]
      );
      return rows;
    }
    const { rows } = await pool.query(`SELECT * FROM orders ORDER BY created_at DESC LIMIT $1`, [limit]);
    return rows;
  }
  const rows = accountId
    ? memory.orders.filter((o) => o.account_id === accountId)
    : memory.orders;
  return rows.slice(0, limit);
}

async function addConversation(sessionId, role, content, model) {
  const row = { id: id(), session_id: sessionId, role, content, model: model || null, created_at: new Date().toISOString() };
  if (usingPostgres()) {
    await pool.query(
      `INSERT INTO conversations (id, session_id, role, content, model) VALUES ($1,$2,$3,$4,$5)`,
      [row.id, row.session_id, row.role, row.content, row.model]
    );
  } else {
    memory.convos.push(row);
  }
  return row;
}

async function historyFor(sessionId) {
  if (usingPostgres()) {
    const { rows } = await pool.query(
      `SELECT role, content FROM conversations WHERE session_id = $1 ORDER BY created_at ASC LIMIT 20`,
      [sessionId]
    );
    return rows;
  }
  return memory.convos.filter((c) => c.session_id === sessionId).slice(-20);
}

async function recordImport(info) {
  const row = {
    id: id(),
    path: info.path || '',
    kind: info.kind || 'scan',
    files_seen: info.files_seen || 0,
    notes: info.notes || '',
    created_at: new Date().toISOString()
  };
  if (usingPostgres()) {
    await pool.query(
      `INSERT INTO workplace_imports (id, path, kind, files_seen, notes) VALUES ($1,$2,$3,$4,$5)`,
      [row.id, row.path, row.kind, row.files_seen, row.notes]
    );
  } else {
    memory.imports.unshift(row);
  }
  return row;
}

async function latestImport() {
  if (usingPostgres()) {
    const { rows } = await pool.query(`SELECT * FROM workplace_imports ORDER BY created_at DESC LIMIT 1`);
    return rows[0] || null;
  }
  return memory.imports[0] || null;
}

async function close() {
  if (pool) {
    await pool.end();
    pool = null;
  }
  accounts.attachPool(null);
  extractors.attachPool(null);
  training.attachPool(null);
}

module.exports = {
  MAX_PARCELS,
  init,
  usingPostgres,
  postgresSslConfig,
  poolOptions,
  poolStats,
  searchKnowledge,
  createOrder,
  saveCertificates,
  getOrder,
  listOrders,
  addConversation,
  historyFor,
  recordImport,
  latestImport,
  close,
  id
};
