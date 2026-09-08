'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

async function init() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    seedMemoryKnowledge();
    return { mode: 'memory' };
  }
  const { Pool } = require('pg');
  pool = new Pool({
    connectionString: url,
    ssl: /render\.com/i.test(url) ? { rejectUnauthorized: false } : undefined
  });
  const sql = fs.readFileSync(SCHEMA_PATH, 'utf8');
  await pool.query(sql);
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
        'When confidence is verified or pattern_matched and the URL is real http(s), the URL is HARD LOCKED.',
        'Chippewa WI is locked to the LandNav Catalis portal, not chippewacounty.gov.'
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
      `INSERT INTO orders (id, product, file_number, client_name, county, state, closing_date, status, source, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        order.id, order.product, order.file_number, order.client_name, order.county,
        order.state, order.closing_date, order.status, order.source, order.notes
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

async function listOrders(limit = 20) {
  if (usingPostgres()) {
    const { rows } = await pool.query(`SELECT * FROM orders ORDER BY created_at DESC LIMIT $1`, [limit]);
    return rows;
  }
  return memory.orders.slice(0, limit);
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
}

module.exports = {
  MAX_PARCELS,
  init,
  usingPostgres,
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
