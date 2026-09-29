'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const store = require('../src/db/store');
const oauth = require('../src/services/oauth');
const { app } = require('../src/server');

describe('host swap prep', () => {
  it('ships a production Docker image that starts the same Node process', () => {
    const docker = fs.readFileSync(path.join(__dirname, '..', 'Dockerfile'), 'utf8');
    assert.match(docker, /FROM node:20/);
    assert.match(docker, /npm ci --omit=dev/);
    assert.match(docker, /CMD \["node", "src\/server\.js"\]/);
    assert.match(
      fs.readFileSync(path.join(__dirname, '..', 'docs', 'HOST_SWAP.md'), 'utf8'),
      /DATABASE_URL/
    );
    assert.match(
      fs.readFileSync(path.join(__dirname, '..', 'deploy', 'ecs-task-definition.example.json'), 'utf8'),
      /healthz/
    );
  });

  it('turns on Postgres TLS for Render and RDS URLs without a code change', () => {
    assert.ok(store.postgresSslConfig('postgres://u:p@dpg-x.render.com/db'));
    assert.ok(store.postgresSslConfig('postgres://u:p@foo.rds.amazonaws.com:5432/db'));
    assert.ok(store.postgresSslConfig('postgres://u:p@localhost/db?sslmode=require'));
    const prev = process.env.DATABASE_SSL;
    try {
      process.env.DATABASE_SSL = 'disable';
      assert.equal(store.postgresSslConfig('postgres://u:p@foo.rds.amazonaws.com/db'), undefined);
    } finally {
      if (prev) process.env.DATABASE_SSL = prev;
      else delete process.env.DATABASE_SSL;
    }
    assert.equal(store.poolOptions('postgres://u:p@localhost/db').max, 10);
  });

  it('lets PUBLIC_ORIGIN override confirm and OAuth URLs behind an ALB', () => {
    const prev = process.env.PUBLIC_ORIGIN;
    try {
      process.env.PUBLIC_ORIGIN = 'https://tax.webpointllc.com/';
      const req = { get: () => 'internal:3000' };
      assert.equal(oauth.originOf(req), 'https://tax.webpointllc.com');
    } finally {
      if (prev) process.env.PUBLIC_ORIGIN = prev;
      else delete process.env.PUBLIC_ORIGIN;
    }
  });
});

describe('host swap HTTP', () => {
  let server;
  let base;

  before(async () => {
    await store.init();
    server = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    base = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    if (server) await new Promise((r) => server.close(r));
    await store.close();
  });

  it('exposes /healthz for ALB and App Runner', async () => {
    const res = await fetch(`${base}/healthz`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.swap.ready, true);
    assert.match(body.swap.bind, /0\.0\.0\.0:/);
  });
});
