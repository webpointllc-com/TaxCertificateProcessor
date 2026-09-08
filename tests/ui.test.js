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
    assert.match(html, /Tax Certificate Processor/);
  });
});
