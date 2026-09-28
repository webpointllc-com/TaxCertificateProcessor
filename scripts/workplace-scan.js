'use strict';

const fs = require('fs');
const path = require('path');

const VOLUME_NAMES = [
  'My Passport',
  'Passport',
  'WD Passport',
  'WD_PASSPORT',
  'MyPassport',
  'PASSPORT'
];

function candidateRoots() {
  const roots = [];
  if (process.env.WORKPLACE_CLONE_PATH) roots.push(process.env.WORKPLACE_CLONE_PATH);
  roots.push(path.join(process.cwd(), 'imports', 'workplace'));
  roots.push(path.join(process.cwd(), 'imports', 'workplace-technologies'));
  for (const vol of VOLUME_NAMES) {
    roots.push(path.join('/Volumes', vol));
    roots.push(path.join('/media', vol));
    roots.push(path.join('/mnt', vol));
  }
  roots.push('/Volumes');
  return roots;
}

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function looksLikeWorkplaceRepo(dir) {
  if (!exists(dir) || !fs.statSync(dir).isDirectory()) return false;
  const gitConfig = path.join(dir, '.git', 'config');
  if (exists(gitConfig)) {
    const cfg = fs.readFileSync(gitConfig, 'utf8');
    if (/workplace-technologies/i.test(cfg)) return true;
  }
  const names = fs.readdirSync(dir);
  const hit = names.some((n) =>
    /tcs|tpa|rds|tax.?cert|realtime-tax|workplace/i.test(n)
  );
  return hit;
}

function walkLimited(dir, depth, acc) {
  if (depth < 0 || acc.length > 400) return;
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (ent.name.startsWith('.') && ent.name !== '.git') continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (looksLikeWorkplaceRepo(full)) acc.push(full);
      if (depth > 0) walkLimited(full, depth - 1, acc);
    }
  }
}

function scanWorkplaceClone() {
  const tried = [];
  const found = [];
  for (const root of candidateRoots()) {
    tried.push(root);
    if (!exists(root)) continue;
    if (looksLikeWorkplaceRepo(root)) found.push(root);
    const stat = fs.statSync(root);
    if (stat.isDirectory()) walkLimited(root, root === '/Volumes' ? 2 : 3, found);
  }
  const unique = [...new Set(found)];
  return {
    found: unique.length > 0,
    roots: unique,
    tried,
    note: unique.length
      ? 'Workplace clone located. Run npm run import:workplace to ingest.'
      : 'WD Passport is not mounted on this host. Plug in the drive, set WORKPLACE_CLONE_PATH, or copy the clone into ./imports/workplace.'
  };
}

function classifyFile(filePath) {
  const lower = filePath.toLowerCase();
  if (/\.(sql|dump|backup)$/.test(lower)) return 'sql_dump';
  if (/\.(csv|tsv)$/.test(lower)) return 'csv';
  if (/\.json$/.test(lower)) return 'json';
  if (/schema|migration/.test(lower)) return 'schema';
  if (/package\.json$/.test(lower)) return 'node_app';
  if (/requirements\.txt$|pyproject/.test(lower)) return 'python_app';
  return 'other';
}

function inventoryRepo(root, maxFiles = 250) {
  const files = [];
  function walk(dir, depth) {
    if (depth < 0 || files.length >= maxFiles) return;
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (ent.name === 'node_modules' || ent.name === '.git') continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full, depth - 1);
      else {
        files.push({
          path: path.relative(root, full),
          kind: classifyFile(full),
          bytes: (() => {
            try { return fs.statSync(full).size; } catch { return 0; }
          })()
        });
      }
    }
  }
  walk(root, 5);
  const kinds = files.reduce((m, f) => {
    m[f.kind] = (m[f.kind] || 0) + 1;
    return m;
  }, {});
  return { root, files_seen: files.length, kinds, sample: files.slice(0, 40) };
}

module.exports = {
  candidateRoots,
  scanWorkplaceClone,
  inventoryRepo,
  looksLikeWorkplaceRepo
};
