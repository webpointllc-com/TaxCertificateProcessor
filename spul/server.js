'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');
const { guideTurn, maybeGroqNarrate } = require('./services/guide');
const { enforceLockedSpulUrl } = require('./services/spulTruth');

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
const DATA_PATH = path.join(__dirname, 'data', 'search-index.json');
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

const STATE_ALIASES = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA',
  hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
  kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
  massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS',
  missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH',
  'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC',
  'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA',
  'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN',
  texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA', washington: 'WA',
  'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY', 'district of columbia': 'DC',
};

function loadIndex() {
  const raw = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  return raw;
}

const index = loadIndex();
const items = index.items || [];

function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractState(q) {
  const n = normalize(q);
  const parts = n.split(' ');
  // trailing 2-letter code
  const last = parts[parts.length - 1];
  if (last && last.length === 2 && /^[a-z]{2}$/.test(last)) {
    return last.toUpperCase();
  }
  for (const [name, code] of Object.entries(STATE_ALIASES)) {
    if (n.includes(name)) return code;
  }
  return null;
}

function countyQuery(q, state) {
  let n = normalize(q);
  if (state) {
    n = n.replace(new RegExp(`\\b${state.toLowerCase()}\\b`, 'g'), ' ');
  }
  for (const name of Object.keys(STATE_ALIASES)) {
    n = n.replace(new RegExp(`\\b${name}\\b`, 'g'), ' ');
  }
  n = n
    .replace(/\b(county|parish|borough|municipality|city|of|the|pay|property|taxes?|tax|search|bill|parcel)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return n;
}

function scoreItem(item, qNorm, countyPart, state) {
  let score = 0;
  const tokens = item.tokens || [];
  const keyNorm = normalize(item.key);
  const countyNorm = normalize(item.county);
  const countyCompact = countyNorm.replace(/[\s-]+/g, '');
  const qCompact = qNorm.replace(/[\s-]+/g, '');
  const cCompact = (countyPart || '').replace(/[\s-]+/g, '');

  if (state && item.state === state) score += 40;
  else if (state && item.state !== state) score -= 120; // hard reject wrong state in ranking

  if (countyPart) {
    if (countyNorm === countyPart) score += 80;
    else if (countyCompact === cCompact) score += 75;
    else if (countyNorm.startsWith(countyPart) || countyPart.startsWith(countyNorm)) score += 55;
    else if (countyNorm.includes(countyPart) || countyPart.includes(countyNorm)) score += 35;
    else if (cCompact && countyCompact.includes(cCompact)) score += 25;
  }

  if (tokens.some((t) => normalize(t) === qNorm)) score += 50;
  if (keyNorm === qNorm || keyNorm.replace(/-/g, '') === qCompact) score += 60;
  if (qNorm && (countyNorm.includes(qNorm) || qNorm.includes(countyNorm))) score += 20;

  // Prefer Search source / higher base confidence
  score += (item.confidenceBase || 0) * 20;
  if (item.source === 'Search') score += 8;
  if (item.active === false) score -= 15;

  return score;
}

function confidenceLabel(item, score) {
  const base = item.confidenceBase || 0;
  let value = base;
  if (score >= 120) value = Math.min(0.99, base + 0.05);
  else if (score >= 90) value = base;
  else if (score >= 60) value = Math.max(0.45, base - 0.1);
  else value = Math.max(0.3, base - 0.25);

  let label = 'low';
  if (value >= 0.9) label = 'high';
  else if (value >= 0.75) label = 'medium';
  else if (value >= 0.55) label = 'fair';

  if (item.source === 'Search' && value >= 0.85) label = 'high';
  if (item.quality === 'broken_fixed') {
    label = 'fair';
    value = Math.min(value, 0.55);
  }

  return { label, value: Math.round(value * 100) };
}

function search(query, limit = 8) {
  const q = String(query || '').trim();
  if (!q) {
    return { ok: false, error: 'Query required', results: [] };
  }
  const qNorm = normalize(q);
  const state = extractState(q);
  const countyPart = countyQuery(q, state);

  let ranked = items
    .map((item) => {
      const score = scoreItem(item, qNorm, countyPart, state);
      return { item, score };
    })
    .filter((r) => r.score >= 55)
    .sort((a, b) => b.score - a.score);

  // When a county token is present, require a real name hit (not state-only noise).
  if (countyPart && countyPart.length >= 2) {
    const withCounty = ranked.filter((r) => {
      if (state && r.item.state !== state) return false;
      const c = normalize(r.item.county).replace(/[\s-]+/g, '');
      const k = normalize(r.item.key).replace(/[\s-]+/g, '');
      const needle = countyPart.replace(/[\s-]+/g, '');
      return (
        c === needle ||
        c.startsWith(needle) ||
        needle.startsWith(c) ||
        c.includes(needle) ||
        k.includes(needle)
      );
    });
    if (withCounty.length) ranked = withCounty;
    else ranked = []; // honest miss — state-only matches are not good enough
  } else if (state) {
    ranked = ranked.filter((r) => r.item.state === state);
  }

  if (ranked.length) {
    const top = ranked[0].score;
    ranked = ranked.filter((r) => r.score >= top - 35 && r.score >= 70);
  }

  ranked = ranked.slice(0, Math.min(Math.max(limit, 1), 20));

  if (!ranked.length) {
    return {
      ok: true,
      query: q,
      miss: true,
      message: 'No jurisdiction URL found in the Extractor index for that query.',
      results: [],
    };
  }

  const results = ranked.map(({ item, score }, i) => {
    const conf = confidenceLabel(item, score);
    return {
      rank: i + 1,
      key: item.key,
      state: item.state,
      county: item.county,
      jurisdiction: `${item.county}, ${item.state}`,
      url: item.url,
      source: item.source, // Search | Base
      active: item.active,
      confidence: conf.label,
      confidencePct: conf.value,
      score: Math.round(score),
      quality: item.quality,
    };
  });

  return {
    ok: true,
    query: q,
    miss: false,
    parsed: { state, county: countyPart || null },
    results,
  };
}

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'search-spul-minimal',
    jurisdictions: items.length,
    generatedAt: index.meta?.generatedAt || null,
    healthSample: index.meta?.healthSample || null,
    llmGuide: {
      deterministic: true,
      groqOptional: Boolean(GROQ_API_KEY),
      urlLock: 'registry_only',
    },
  });
});

app.get('/api/meta', (_req, res) => {
  res.json({ ok: true, meta: index.meta, count: items.length });
});

app.get('/api/suggest', (req, res) => {
  const q = normalize(req.query.q || '');
  if (!q || q.length < 2) return res.json({ ok: true, suggestions: [] });
  const out = [];
  const seen = new Set();
  for (const item of items) {
    const label = `${item.county}, ${item.state}`;
    const hay = `${item.county} ${item.state} ${item.key}`.toLowerCase();
    if (!hay.includes(q)) continue;
    if (seen.has(item.key)) continue;
    seen.add(item.key);
    out.push({ key: item.key, label, state: item.state, county: item.county });
    if (out.length >= 10) break;
  }
  res.json({ ok: true, suggestions: out });
});

app.get('/api/search', (req, res) => {
  const limit = parseInt(req.query.limit || '8', 10);
  res.json(search(req.query.q || req.query.query || '', limit));
});

app.post('/api/search', (req, res) => {
  const limit = parseInt((req.body && req.body.limit) || '8', 10);
  const q = (req.body && (req.body.q || req.body.query)) || '';
  res.json(search(q, limit));
});

/**
 * LLM Comm (flow) — registry-locked guide.
 * Deterministic by default; optional Groq narration when GROQ_API_KEY is set.
 * Hard rule: URLs only from Extractor index (never invented).
 */
async function handleGuide(req, res) {
  const message = (req.body && (req.body.message || req.body.q || req.body.query)) || '';
  const guide = guideTurn({ message, searchFn: search });
  if (!guide.ok) return res.status(400).json(guide);

  let narration = null;
  if (GROQ_API_KEY) {
    narration = await maybeGroqNarrate(guide, GROQ_API_KEY);
    if (narration && guide.lockedUrl) {
      narration = enforceLockedSpulUrl(
        `SPUL_URL: ${guide.lockedUrl}\n${narration}`,
        guide.lockedUrl,
        guide.spul?.SPUL_CONFIDENCE
      );
    }
  }

  res.json({
    ...guide,
    groq: Boolean(GROQ_API_KEY && narration),
    narration,
  });
}

app.post('/api/guide', handleGuide);
app.post('/api/chat', handleGuide); // alias — search-spul-test LLM Comm naming

// Static UI
app.use(express.static(path.join(__dirname, 'public'), {
  etag: true,
  maxAge: process.env.NODE_ENV === 'production' ? '5m' : 0,
}));

// Preserve boss briefing assets if present at repo root (deploy rootDir=spul skips them)
app.get('/briefing', (_req, res) => {
  res.redirect(302, '/');
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`S-PUL minimal listening on http://${HOST}:${PORT} (${items.length} jurisdictions)`);
});
