'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const store = require('../src/db/store');
const { app } = require('../src/server');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'architecture.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'architecture.css'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'architecture.js'), 'utf8');
const embed = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'SQUARESPACE_ARCHITECTURE_EMBED.html'),
  'utf8'
);
const mermaid = fs.readFileSync(path.join(__dirname, '..', 'docs', 'ARCHITECTURE.md'), 'utf8');
const prompt = fs.readFileSync(
  path.join(__dirname, '..', 'docs', 'AGENT_PROMPT_GOOGLE_CLASS_SEARCH.md'),
  'utf8'
);

describe('architecture diagram', () => {
  it('uses a 1280x800 design canvas', () => {
    assert.match(js, /DESIGN_WIDTH = 1280/);
    assert.match(js, /DESIGN_HEIGHT = 800/);
    assert.match(html, /id="scale-outer"/);
    assert.match(html, /id="design-canvas"/);
  });

  it('does not use left accent stripes', () => {
    assert.doesNotMatch(css, /border-left\s*:/);
    assert.doesNotMatch(css, /border-left\s+/);
  });

  it('names the paid Render surface and the $0 pieces honestly', () => {
    assert.match(html, /Render web service/);
    assert.match(html, /Render PostgreSQL/);
    assert.match(html, /0\.0\.0\.0:\$PORT/);
    assert.match(html, /Squarespace/);
    assert.match(html, /LandNav/);
    assert.match(html, /WD Passport/);
    assert.match(html, /We do not buy/);
    assert.match(html, /Pinecone/);
  });

  it('ships a Squarespace iframe that preserves 800/1280 aspect', () => {
    assert.match(embed, /padding-top:\s*62\.5%/);
    assert.match(embed, /architecture\.html/);
    assert.match(embed, /width:\s*100%/);
  });

  it('includes mermaid of the live graph', () => {
    assert.match(mermaid, /```mermaid/);
    assert.match(mermaid, /Render web service/);
    assert.match(mermaid, /PostgreSQL/);
    assert.match(mermaid, /LandNav/);
  });
});

describe('paste-ready agent prompt', () => {
  it('tells a future agent to diagram, search, hunt Passport, and stay on cheap Render', () => {
    assert.match(prompt, /PASTE-READY PROMPT/);
    assert.match(prompt, /architecture\.html/);
    assert.match(prompt, /WORKPLACE_CLONE_PATH/);
    assert.match(prompt, /import:workplace/);
    assert.match(prompt, /list-self-hosted-workers/);
    assert.match(prompt, /Chippewa/);
    assert.match(prompt, /LandNav/);
    assert.match(prompt, /do not overwrite/i);
    assert.match(prompt, /Pinecone/);
    assert.match(prompt, /PR #2|pull\/2/);
  });
});

describe('architecture HTTP', () => {
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

  it('serves architecture.html as a live page', async () => {
    const res = await fetch(`${base}/architecture.html`);
    assert.equal(res.status, 200);
    const body = await res.text();
    assert.match(body, /id="scale-outer"/);
    assert.match(body, /Render PostgreSQL/);
    assert.doesNotMatch(body, /id="run-order"/);
  });
});
