'use strict';

require('dotenv').config();
const store = require('../src/db/store');
const { scanWorkplaceClone, inventoryRepo } = require('./workplace-scan');

async function run() {
  const db = await store.init();
  const scan = scanWorkplaceClone();
  console.log(JSON.stringify({ db: db.mode, scan }, null, 2));
  if (!scan.found) {
    console.error('\nPassport clone not visible on this machine.');
    console.error('Plug in the WD Passport and either:');
    console.error('  1. Start a Cursor self-hosted worker on that Mac, or');
    console.error('  2. Copy the clone to ./imports/workplace, or');
    console.error('  3. Set WORKPLACE_CLONE_PATH to the repo root.');
    await store.close();
    process.exit(2);
  }
  const inventories = scan.roots.map((root) => inventoryRepo(root));
  const filesSeen = inventories.reduce((n, inv) => n + inv.files_seen, 0);
  await store.recordImport({
    path: scan.roots.join(' | '),
    kind: 'passport-scan',
    files_seen: filesSeen,
    notes: JSON.stringify(inventories.map((i) => ({ root: i.root, kinds: i.kinds, sample: i.sample.slice(0, 15) })))
  });
  console.log(JSON.stringify({ imported: true, inventories }, null, 2));
  await store.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
