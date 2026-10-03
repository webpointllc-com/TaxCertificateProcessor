#!/usr/bin/env node
'use strict';

// Export consented training data to JSONL for a LoRA run.
//
//   DATABASE_URL=... node scripts/export-training.js --out training/data [--since 2026-10-01]
//
// Writes:
//   train.jsonl   {"messages":[...]} one example per line, chat format
//   eval.jsonl    ~5% held out, chosen by a stable hash of the row id (same row, same split, every run)
//   manifest.json counts, date range, sha256 of each file
//
// Only rows from accounts whose learn_consent is true RIGHT NOW are exported (see src/db/training.js).
// Emails, phone numbers and SSN-shaped strings are masked before anything touches disk.

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const EVAL_PERCENT = 5;

function scrub(text) {
  return String(text || '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[ssn]')
    .replace(/(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g, '[phone]');
}

function isEval(id) {
  const n = parseInt(crypto.createHash('sha256').update(String(id)).digest('hex').slice(0, 8), 16);
  return n % 100 < EVAL_PERCENT;
}

function toExample(row) {
  const messages = row.messages.map((m) => ({ role: m.role, content: scrub(m.content) }));
  messages.push({ role: 'assistant', content: scrub(row.reply) });
  return { messages, meta: { id: row.id, route: row.route, jurisdiction_key: row.jurisdiction_key || null } };
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function parseArgs(argv) {
  const args = { out: path.join('training', 'data'), since: null };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--out') args.out = argv[++i];
    else if (argv[i] === '--since') args.since = argv[++i];
  }
  return args;
}

async function main() {
  const store = require('../src/db/store');
  const training = require('../src/db/training');
  const args = parseArgs(process.argv);
  const db = await store.init();
  if (db.mode !== 'postgres') {
    console.error('export-training: DATABASE_URL is not set. Point it at the production Postgres (read-only is fine).');
    process.exitCode = 1;
    return;
  }
  const rows = await training.exportExamples({ since: args.since });
  fs.mkdirSync(args.out, { recursive: true });
  const trainPath = path.join(args.out, 'train.jsonl');
  const evalPath = path.join(args.out, 'eval.jsonl');
  const train = fs.createWriteStream(trainPath);
  const evalOut = fs.createWriteStream(evalPath);
  let nTrain = 0;
  let nEval = 0;
  for (const row of rows) {
    const line = JSON.stringify(toExample(row)) + '\n';
    if (isEval(row.id)) {
      evalOut.write(line);
      nEval += 1;
    } else {
      train.write(line);
      nTrain += 1;
    }
  }
  await Promise.all([new Promise((r) => train.end(r)), new Promise((r) => evalOut.end(r))]);
  const manifest = {
    exported_at: new Date().toISOString(),
    since: args.since,
    total: rows.length,
    train: nTrain,
    eval: nEval,
    first: rows[0] ? rows[0].created_at : null,
    last: rows.length ? rows[rows.length - 1].created_at : null,
    sha256: { 'train.jsonl': sha256File(trainPath), 'eval.jsonl': sha256File(evalPath) }
  };
  fs.writeFileSync(path.join(args.out, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify(manifest));
  await store.close();
}

if (require.main === module) {
  main().catch((err) => {
    console.error('export-training', err);
    process.exitCode = 1;
  });
}

module.exports = { scrub, isEval, toExample };
