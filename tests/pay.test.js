'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const store = require('../src/db/store');
const { app } = require('../src/server');
const { launchPlan } = require('../src/launchPlan');

const publicDir = path.join(__dirname, '..', 'public');
const html = fs.readFileSync(path.join(publicDir, 'pay.html'), 'utf8');
const css = fs.readFileSync(path.join(publicDir, 'pay.css'), 'utf8');
const js = fs.readFileSync(path.join(publicDir, 'pay.js'), 'utf8');
const ru = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'ru.sh'), 'utf8');
const handoff = fs.readFileSync(path.join(publicDir, 'CLAUDE_PASTE.txt'), 'utf8');
const embedPreview = fs.readFileSync(path.join(publicDir, 'embed-preview.html'), 'utf8');
const sqEmbed = fs.readFileSync(path.join(publicDir, 'SQUARESPACE_EMBED.html'), 'utf8');
const arch = fs.readFileSync(path.join(publicDir, 'architecture.html'), 'utf8');
const index = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');

function assertNoLeftStripe(label, text) {
  assert.doesNotMatch(text, /border-left\s*:/, `${label} must not use border-left`);
  assert.doesNotMatch(text, /border-left\s+/, `${label} must not use border-left`);
}

describe('launch pay page', () => {
  it('uses a 1280x800 ScaleToFit canvas', () => {
    assert.match(html, /id="scale-outer"/);
    assert.match(html, /id="design-canvas"/);
    assert.match(js, /DESIGN_WIDTH = 1280/);
    assert.match(js, /DESIGN_HEIGHT = 800/);
    assert.match(html, /prep-toggle/);
    assert.match(html, /Open Render billing/);
  });

  it('does not use left accent stripes', () => {
    assertNoLeftStripe('pay.html', html);
    assertNoLeftStripe('pay.css', css);
    assertNoLeftStripe('embed-preview.html', embedPreview);
  });

  it('selects Starter web + Postgres Basic 256MB and names the pay URLs', () => {
    assert.equal(launchPlan.monthly, 14);
    assert.equal(launchPlan.selected[0].plan, 'starter');
    assert.equal(launchPlan.selected[1].plan, 'basic-256mb');
    assert.match(launchPlan.billingUrl, /dashboard\.render\.com\/billing/);
    assert.match(launchPlan.blueprintUrl, /blueprint\/new\?repo=/);
    assert.match(js, /wp_prep_to_pay/);
    assert.match(html, /Prep to pay/);
  });

  it('ships ru.sh with chmod, E0F pay block, and 0.0.0.0 bind', () => {
    assert.match(ru, /chmod \+x/);
    assert.match(ru, /cat <<E0F/);
    assert.match(ru, /dashboard\.render\.com\/billing/);
    assert.match(ru, /HOST:-\$\{HOST:-0\.0\.0\.0\}|0\.0\.0\.0/);
    assert.match(ru, /exec node src\/server\.js/);
    assert.match(ru, /pbcopy|xclip/);
  });

  it('ships a paste-ready Claude handoff without secrets', () => {
    assert.match(handoff, /Twin1 → Twin2 HANDOFF/);
    assert.match(handoff, /1280×800|1280x800/);
    assert.match(handoff, /dashboard\.render\.com\/billing/);
    assert.match(handoff, /SQUARESPACE_EMBED/);
    assert.doesNotMatch(handoff, /sk-|gsk_|password|passcode/i);
  });

  it('keeps the Squarespace 62.5% embed and a local preview of it', () => {
    assert.match(sqEmbed, /padding-top:\s*62\.5%/);
    assert.match(sqEmbed, /tax-certificate-processor\.onrender\.com/);
    assert.match(embedPreview, /padding-top: 62\.5%/);
    assert.match(embedPreview, /src="\/"/);
    assert.match(arch, /href="\/pay\.html/);
    assert.match(index, /href="\/pay\.html/);
  });
});

describe('launch pay HTTP', () => {
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

  it('serves pay.html and launch-plan with selected DB needs', async () => {
    const page = await fetch(`${base}/pay.html`);
    assert.equal(page.status, 200);
    const body = await page.text();
    assert.match(body, /id="prep-toggle"/);
    assert.match(body, /id="scale-outer"/);

    const plan = await fetch(`${base}/api/launch-plan`);
    assert.equal(plan.status, 200);
    const json = await plan.json();
    assert.equal(json.ok, true);
    assert.equal(json.monthly, 14);
    assert.equal(json.selected[0].plan, 'starter');
    assert.equal(json.selected[1].plan, 'basic-256mb');
    assert.equal(json.selected[1].required, true);
    assert.match(json.billingUrl, /dashboard\.render\.com\/billing/);
    assert.match(json.blueprintUrl, /TaxCertificateProcessor/);
  });

  it('serves the Claude paste and embed preview', async () => {
    const paste = await fetch(`${base}/CLAUDE_PASTE.txt`);
    assert.equal(paste.status, 200);
    assert.match(await paste.text(), /Prep to pay|PREP TO PAY|dashboard\.render\.com\/billing/);

    const preview = await fetch(`${base}/embed-preview.html`);
    assert.equal(preview.status, 200);
    assert.match(await preview.text(), /padding-top: 62\.5%/);
  });
});
