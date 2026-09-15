#!/usr/bin/env node
/**
 * S-PUL Continuity Wall — local static + wall/memory API.
 * Bind 127.0.0.1 only (desktop widget on Bill’s Mac, not a public service).
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const HOST = process.env.WIDGET_HOST || '127.0.0.1';
const PORT = Number(process.env.WIDGET_PORT || 3847);
const ROOT = __dirname;
const MEMORY_PATH = path.join(ROOT, 'PROJECT_MEMORY.json');
const WALL_DIR = path.join(ROOT, 'wall');
const POSTS_PATH = path.join(WALL_DIR, 'posts.jsonl');
const IMPORTS_DIR = path.join(WALL_DIR, 'imports');

const AUTHORS = new Set(['cursor', 'claude-desktop', 'bill', 'system']);
const TYPES = new Set(['change', 'snapshot', 'note']);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jsonl': 'application/x-ndjson; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.sh': 'text/plain; charset=utf-8',
  '.py': 'text/plain; charset=utf-8',
};

function ensureDirs() {
  if (!fs.existsSync(WALL_DIR)) fs.mkdirSync(WALL_DIR, { recursive: true });
  if (!fs.existsSync(IMPORTS_DIR)) fs.mkdirSync(IMPORTS_DIR, { recursive: true });
  if (!fs.existsSync(POSTS_PATH)) fs.writeFileSync(POSTS_PATH, '', 'utf8');
}

function readMemory() {
  const raw = fs.readFileSync(MEMORY_PATH, 'utf8');
  return JSON.parse(raw);
}

function writeMemory(data) {
  fs.writeFileSync(MEMORY_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function parseJsonl(text) {
  const posts = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    try {
      posts.push(JSON.parse(t));
    } catch (_) {
      /* skip corrupt line */
    }
  }
  return posts;
}

function readPosts() {
  ensureDirs();
  if (!fs.existsSync(POSTS_PATH)) return [];
  return parseJsonl(fs.readFileSync(POSTS_PATH, 'utf8'));
}

function appendPost(post) {
  ensureDirs();
  fs.appendFileSync(POSTS_PATH, JSON.stringify(post) + '\n', 'utf8');
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 512 * 1024) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function serveStatic(req, res, pathname) {
  let rel = pathname === '/' ? '/index.html' : pathname;
  rel = decodeURIComponent(rel);
  if (rel.includes('..')) {
    res.writeHead(400).end('bad path');
    return;
  }
  const filePath = path.join(ROOT, rel);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403).end('forbidden');
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404).end('not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
}

function normalizeAuthor(raw) {
  const a = String(raw || 'bill').trim().toLowerCase();
  if (AUTHORS.has(a)) return a;
  if (a === 'agent' || a === 'cursor-agent') return 'cursor';
  if (a === 'claude' || a === 'claude.ai' || a === 'twin') return 'claude-desktop';
  return a.slice(0, 64) || 'bill';
}

function normalizeLinks(links) {
  if (!Array.isArray(links)) return [];
  return links
    .slice(0, 12)
    .map((l) => {
      if (typeof l === 'string') {
        return { label: l, url: l };
      }
      return {
        label: String((l && l.label) || (l && l.url) || '').slice(0, 200),
        url: String((l && l.url) || '').slice(0, 2000),
      };
    })
    .filter((l) => l.url);
}

function buildPost(body) {
  const title = String(body.title || '').trim();
  const text = String(body.body || body.text || '').trim();
  if (!title && !text) {
    const err = new Error('title or body required');
    err.status = 400;
    throw err;
  }
  const typeRaw = String(body.type || 'change').trim().toLowerCase();
  const type = TYPES.has(typeRaw) ? typeRaw : 'change';
  const post = {
    id: body.id || `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    ts: body.ts || new Date().toISOString(),
    author: normalizeAuthor(body.author),
    type,
    title: (title || text.slice(0, 80)).slice(0, 200),
    body: text.slice(0, 8000),
    outcome: String(body.outcome || '').trim().slice(0, 2000) || undefined,
    links: normalizeLinks(body.links),
  };
  if (body.snapshot && typeof body.snapshot === 'object') {
    post.snapshot = body.snapshot;
  }
  if (!post.outcome) delete post.outcome;
  if (!post.links.length) delete post.links;
  return post;
}

function twinPack(posts) {
  const recent = posts.slice(-12);
  return [
    'S-PUL Continuity Twin Pack',
    '==========================',
    'Meeting place: Continuity Wall (Bill + Cursor + Claude Desktop)',
    'Product: spul/ only (TaxCertificateProcessor Day 0)',
    'Branch (Day 0 product): s-pul-front_end-Betasearchpages-best-55de',
    'PR #8: https://github.com/webpointllc-com/TaxCertificateProcessor/pull/8',
    'Widget wall file: spul/widget/wall/posts.jsonl',
    'AI contract: spul/widget/README.md',
    'Twin protocol: spul/widget/TWIN_SYNC.md',
    'Manifest: docs/DAY0_MANIFEST.md',
    'Stats: 2062 listed / 2055 with URL / 1866 active / 7 no URL / 1675 validated-true',
    'OUT: voice-first product, Central Intelligence, DEP Highlighter, kata_deploy, invented URLs',
    'Bridge: paste this pack + append wall posts — no MCP telepathy.',
    '',
    'Recent wall posts (oldest → newest of last 12):',
    ...recent.map((p) => {
      const refs = (p.links || []).map((l) => l.url).join(' | ') || '(no refs)';
      const out = p.outcome ? ` → ${p.outcome}` : '';
      return `- [${p.ts}] (${p.author}/${p.type}) ${p.title}${out}\n  ${refs}\n  ${(p.body || '').slice(0, 280)}`;
    }),
    '',
    'After your next S-PUL change: POST /api/wall or append one JSONL line to posts.jsonl with GitHub or local refs.',
  ].join('\n');
}

/** Parse EF_EE_CHECKPOINT_LOG.jsonl for a calendar day (default 2026-09-10). */
function extractCheckpointDay(jsonlText, dayIso) {
  const day = dayIso || '2026-09-10';
  const rows = parseJsonl(jsonlText);
  const matched = rows.filter((r) => {
    const ts = String(r.ts || r.timestamp || r.time || r.date || '');
    return ts.startsWith(day) || ts.includes(day.replace(/-/g, '.')) || ts.includes(day.replace(/-/g, '/'));
  });
  const series = [];
  for (const r of matched) {
    if (typeof r.value === 'number') {
      series.push({
        label: String(r.label || r.key || r.name || r.metric || r.ts || 'point').slice(0, 40),
        value: r.value,
      });
    } else if (r.data && typeof r.data === 'object') {
      for (const [k, v] of Object.entries(r.data)) {
        if (typeof v === 'number') series.push({ label: String(k).slice(0, 40), value: v });
      }
    } else if (typeof r.count === 'number') {
      series.push({ label: String(r.label || r.event || 'count').slice(0, 40), value: r.count });
    }
  }
  return { day, matched, series, totalLines: rows.length };
}

ensureDirs();

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url || '/', `http://${HOST}:${PORT}`);
  const { pathname } = u;

  if (req.method === 'OPTIONS' && pathname.startsWith('/api/')) {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  if (pathname === '/api/health') {
    sendJson(res, 200, {
      ok: true,
      service: 'spul-continuity-wall',
      wall: 'wall/posts.jsonl',
      memory: 'PROJECT_MEMORY.json',
    });
    return;
  }

  if (pathname === '/api/wall' && req.method === 'GET') {
    try {
      let posts = readPosts();
      const author = (u.searchParams.get('author') || '').trim().toLowerCase();
      const type = (u.searchParams.get('type') || '').trim().toLowerCase();
      if (author) posts = posts.filter((p) => String(p.author || '').toLowerCase() === author);
      if (type) posts = posts.filter((p) => String(p.type || '').toLowerCase() === type);
      posts.sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
      sendJson(res, 200, { posts, count: posts.length, path: 'spul/widget/wall/posts.jsonl' });
    } catch (e) {
      sendJson(res, 500, { error: String(e.message || e) });
    }
    return;
  }

  if (pathname === '/api/wall' && req.method === 'POST') {
    try {
      const body = JSON.parse((await readBody(req)) || '{}');
      const post = buildPost(body);
      appendPost(post);
      // Mirror a short line into PROJECT_MEMORY for older agents
      try {
        const mem = readMemory();
        if (!Array.isArray(mem.entries)) mem.entries = [];
        mem.entries.push({
          id: post.id,
          ts: post.ts,
          author: post.author,
          text: `[wall/${post.type}] ${post.title}${post.outcome ? ' — ' + post.outcome : ''}`,
        });
        if (mem.entries.length > 200) mem.entries = mem.entries.slice(-200);
        writeMemory(mem);
      } catch (_) {
        /* memory mirror best-effort */
      }
      sendJson(res, 200, { ok: true, post, count: readPosts().length });
    } catch (e) {
      sendJson(res, e.status || 500, { error: String(e.message || e) });
    }
    return;
  }

  if (pathname === '/api/twin-pack' && req.method === 'GET') {
    try {
      const posts = readPosts().sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
      const text = twinPack(posts);
      sendJson(res, 200, { ok: true, text, postCount: posts.length });
    } catch (e) {
      sendJson(res, 500, { error: String(e.message || e) });
    }
    return;
  }

  if (pathname === '/api/checkpoint-import' && req.method === 'POST') {
    try {
      const body = JSON.parse((await readBody(req)) || '{}');
      const day = String(body.day || '2026-09-10');
      let raw = body.jsonl || body.content || '';
      if (!raw && body.path) {
        const p = String(body.path);
        // Only allow reading under known EF_EE or wall/imports — never arbitrary secrets paths
        const allowed =
          p.includes('EF_EE_CHECKPOINT_LOG.jsonl') ||
          p.startsWith(IMPORTS_DIR) ||
          p.includes(`${path.sep}wall${path.sep}imports${path.sep}`);
        if (!allowed) {
          sendJson(res, 400, { error: 'path not allowed; paste jsonl or use wall/imports/' });
          return;
        }
        raw = fs.readFileSync(p, 'utf8');
      }
      if (!raw) {
        sendJson(res, 400, { error: 'jsonl content or allowed path required' });
        return;
      }
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const importPath = path.join(IMPORTS_DIR, `ef-ee-${day}-${stamp}.jsonl`);
      fs.writeFileSync(importPath, raw, 'utf8');
      const extracted = extractCheckpointDay(raw, day);
      const post = buildPost({
        author: body.author || 'claude-desktop',
        type: 'snapshot',
        title: `EF_EE checkpoint · ${day}`,
        body:
          `Imported EF_EE_CHECKPOINT_LOG snapshot for ${day}. ` +
          `Matched ${extracted.matched.length} of ${extracted.totalLines} log lines. ` +
          (extracted.series.length
            ? `Numeric series: ${extracted.series.map((s) => `${s.label}=${s.value}`).join(', ')}.`
            : 'No numeric series found — raw match count posted; open import file for detail.'),
        outcome: extracted.matched.length
          ? `Visualized ${extracted.series.length || extracted.matched.length} datapoint(s) for ${day}.`
          : `No rows matched ${day}; import saved for manual review.`,
        links: [
          { label: 'EF_EE_PORT (Mac)', url: '/Users/billmccreary/Library/Mobile Documents/com~apple~CloudDocs/EF_EE_PORT' },
          { label: 'EF_EE_CHECKPOINT_LOG.jsonl', url: '/Users/billmccreary/Library/Mobile Documents/com~apple~CloudDocs/EF_EE_PORT/EF_EE_CHECKPOINT_LOG.jsonl' },
          { label: 'Imported copy', url: path.relative(path.join(ROOT, '..', '..'), importPath).replace(/\\/g, '/') || `spul/widget/wall/imports/${path.basename(importPath)}` },
        ],
        snapshot: {
          kind: 'checkpoint',
          label: `EF_EE · ${day}`,
          day,
          matchCount: extracted.matched.length,
          series: extracted.series.length
            ? extracted.series.slice(0, 24)
            : [{ label: 'matched rows', value: extracted.matched.length }],
        },
      });
      appendPost(post);
      sendJson(res, 200, { ok: true, post, extracted: { day: extracted.day, matchCount: extracted.matched.length, series: extracted.series.slice(0, 24) }, importPath });
    } catch (e) {
      sendJson(res, 500, { error: String(e.message || e) });
    }
    return;
  }

  // Backward-compatible memory API
  if (pathname === '/api/memory' && req.method === 'GET') {
    try {
      sendJson(res, 200, readMemory());
    } catch (e) {
      sendJson(res, 500, { error: String(e.message || e) });
    }
    return;
  }

  if (pathname === '/api/memory' && req.method === 'POST') {
    try {
      const body = JSON.parse((await readBody(req)) || '{}');
      const text = String(body.text || '').trim();
      if (!text) {
        sendJson(res, 400, { error: 'text required' });
        return;
      }
      if (text.length > 4000) {
        sendJson(res, 400, { error: 'text too long (max 4000)' });
        return;
      }
      const author = normalizeAuthor(body.author);
      const mem = readMemory();
      if (!Array.isArray(mem.entries)) mem.entries = [];
      const entry = {
        id: `e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        ts: new Date().toISOString(),
        author,
        text,
      };
      mem.entries.push(entry);
      if (mem.entries.length > 200) mem.entries = mem.entries.slice(-200);
      writeMemory(mem);
      // Also append a wall note so the blog stays canonical
      appendPost(
        buildPost({
          author,
          type: 'note',
          title: text.slice(0, 80),
          body: text,
        })
      );
      sendJson(res, 200, { ok: true, entry, count: mem.entries.length });
    } catch (e) {
      sendJson(res, 500, { error: String(e.message || e) });
    }
    return;
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    serveStatic(req, res, pathname);
    return;
  }

  res.writeHead(405).end('method not allowed');
});

server.listen(PORT, HOST, () => {
  console.log(`S-PUL Continuity Wall → http://${HOST}:${PORT}/`);
  console.log(`Wall file → ${POSTS_PATH}`);
  console.log(`Memory file → ${MEMORY_PATH}`);
  console.log('Press Ctrl+C to stop. Run mac/open-widget.sh on Bill’s MacBook (not cloud VM).');
});
