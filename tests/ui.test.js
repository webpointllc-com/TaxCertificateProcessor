'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'styles.css'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
const embed = fs.readFileSync(path.join(__dirname, '..', 'public', 'SQUARESPACE_EMBED.html'), 'utf8');

describe('embeddable scaled UI', () => {
  it('uses a 1280x800 design canvas', () => {
    assert.match(js, /DESIGN_WIDTH = 1280/);
    assert.match(js, /DESIGN_HEIGHT = 800/);
    assert.match(css, /--design-w: 1280px/);
    assert.match(css, /--design-h: 800px/);
  });

  it('does not use left accent stripes', () => {
    assert.doesNotMatch(css, /border-left\s*:/);
    assert.doesNotMatch(css, /border-left\s+/);
  });

  it('ships a Squarespace iframe that preserves 800/1280 aspect', () => {
    assert.match(embed, /padding-top:\s*62\.5%/);
    assert.match(embed, /width:\s*100%/);
    assert.match(js, /MAX_PARCELS = 10/);
    assert.match(js, /Max 10 parcels/);
  });

  it('has a hero search that only opens locked collector URLs', () => {
    assert.match(html, /id="hero-input"/);
    assert.match(html, /id="hero-form"/);
    assert.match(js, /officialUrlOf/);
    assert.match(js, /\/api\/suggest/);
    assert.match(js, /googleFallback/);
  });

  it('gates the app on email signup plus Google/Apple, then a confirmation link', () => {
    assert.match(html, /id="signup-form"/);
    assert.match(html, /id="login-form"/);
    assert.match(html, /id="auth-gate"/);
    assert.match(html, /id="confirm-panel"/);
    assert.match(html, /id="member-form"/);
    assert.match(html, /id="su-password"/);
    assert.match(html, /id="li-password"/);
    assert.match(html, /id="member-skip"/);
    assert.match(html, /Continue with Google/);
    assert.match(html, /Continue with Apple/);
    assert.match(js, /\/api\/signup/);
    assert.match(js, /\/api\/confirm/);
    assert.match(js, /\/api\/auth\/' \+ provider \+ '\/start/);
    assert.match(js, /\/api\/member-code/);
    assert.doesNotMatch(html, /Email me a code|6-digit/);
    assert.doesNotMatch(js, /\/api\/verify/);
  });

  it('ships the generative search home matching the Property Tax Intelligence window', () => {
    assert.match(html, /Search county, parcel number, or address/);
    assert.match(html, /id="view-home"/);
    assert.match(html, /id="view-results"/);
    assert.match(html, /Key Property Tax Insights/);
    assert.match(html, /id="perm-overlay"/);
    assert.match(html, /id="heal-form"/);
    assert.match(js, /\/api\/intelligence/);
    assert.match(js, /\/api\/extractors\/heal/);
  });

  it('ships the mobile account sheet plus a desktop account workspace', () => {
    assert.match(html, /id="account-sheet"/);
    assert.match(html, /id="acct-recents"/);
    assert.match(html, /Your Updates/);
    assert.match(html, /Settings and privacy/);
    assert.match(html, /Invite Friends/);
    assert.match(html, /New message/);
    assert.match(html, /id="view-desktop"/);
    assert.match(css, /account-sheet/);
    assert.match(css, /width: 390px/);
  });
});
