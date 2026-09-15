#!/usr/bin/env node
/**
 * S-PUL Project Continuity Widget — local static + memory API.
 * Bind 127.0.0.1 only (desktop widget, not a public service).
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

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function readMemory() {
  const raw = fs.readFileSync(MEMORY_PATH, 'utf8');
  return JSON.parse(raw);
}

function writeMemory(data) {
  fs.writeFileSync(MEMORY_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
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
      if (size > 64 * 1024) {
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
    sendJson(res, 200, { ok: true, service: 'spul-continuity-widget', memory: 'PROJECT_MEMORY.json' });
    return;
  }

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
      const body = JSON.parse(await readBody(req) || '{}');
      const text = String(body.text || '').trim();
      if (!text) {
        sendJson(res, 400, { error: 'text required' });
        return;
      }
      if (text.length > 4000) {
        sendJson(res, 400, { error: 'text too long (max 4000)' });
        return;
      }
      const author = String(body.author || 'bill').trim().slice(0, 64) || 'bill';
      const mem = readMemory();
      if (!Array.isArray(mem.entries)) mem.entries = [];
      const entry = {
        id: `e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        ts: new Date().toISOString(),
        author,
        text,
      };
      mem.entries.push(entry);
      // Keep file bounded for agents
      if (mem.entries.length > 200) mem.entries = mem.entries.slice(-200);
      writeMemory(mem);
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
  console.log(`S-PUL Continuity Widget → http://${HOST}:${PORT}/`);
  console.log(`Memory file → ${MEMORY_PATH}`);
  console.log('Press Ctrl+C to stop.');
});
