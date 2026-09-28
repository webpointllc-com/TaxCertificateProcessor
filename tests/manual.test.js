'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const manualPath = path.join(publicDir, 'manual.html');
const manualCssPath = path.join(publicDir, 'manual.css');
const manualJsPath = path.join(publicDir, 'manual.js');
const embedPath = path.join(publicDir, 'SQUARESPACE_MANUAL_EMBED.html');
const indexPath = path.join(publicDir, 'index.html');
const figmaPromptPath = path.join(__dirname, '..', 'docs', 'FIGMA_USER_MANUAL_PROMPT.md');

const manual = fs.readFileSync(manualPath, 'utf8');
const manualCss = fs.readFileSync(manualCssPath, 'utf8');
const manualJs = fs.readFileSync(manualJsPath, 'utf8');
const embed = fs.readFileSync(embedPath, 'utf8');
const index = fs.readFileSync(indexPath, 'utf8');
const figma = fs.readFileSync(figmaPromptPath, 'utf8');

function assertNoLeftStripe(label, text) {
  assert.doesNotMatch(text, /border-left\s*:/, `${label} must not use border-left`);
  assert.doesNotMatch(text, /border-left\s+/, `${label} must not use border-left`);
}

describe('end-user manual page', () => {
  it('exists at public/manual.html', () => {
    assert.equal(fs.existsSync(manualPath), true);
  });

  it('uses a 1280x800 ScaleToFit canvas', () => {
    assert.match(manual, /id="scale-outer"/);
    assert.match(manual, /id="design-canvas"/);
    assert.match(manualJs, /DESIGN_WIDTH = 1280/);
    assert.match(manualJs, /DESIGN_HEIGHT = 800/);
    assert.match(manualJs, /scaleToFit/);
    assert.match(manual, /manual\.js/);
  });

  it('does not use left accent stripes', () => {
    assertNoLeftStripe('manual.html', manual);
    assertNoLeftStripe('manual.css', manualCss);
    assertNoLeftStripe('SQUARESPACE_MANUAL_EMBED.html', embed);
  });

  it('has an iframe embed snippet with 800/1280 aspect', () => {
    assert.match(embed, /<iframe/);
    assert.match(embed, /padding-top:\s*62\.5%/);
    assert.match(embed, /width:\s*100%/);
    assert.match(embed, /manual\.html/);
    assert.match(manual, /iframe/);
    assert.match(manual, /padding-top: 62\.5%/);
    assert.match(manual, /tax-certificate-processor\.onrender\.com\/manual\.html/);
  });

  it('includes SVG diagrams', () => {
    const svgCount = (manual.match(/<svg\b/g) || []).length;
    assert.ok(svgCount >= 4, `expected at least 4 svg diagrams, found ${svgCount}`);
    assert.match(manual, /Paid members page/);
    assert.match(manual, /max 10/);
    assert.match(manual, /OFFICIAL PAGE ONLY|Official page only/i);
  });

  it('matches live product labels and Chippewa lock', () => {
    assert.match(manual, /Tax Certification System/);
    assert.match(manual, /Targeted Portfolio Analysis/);
    assert.match(manual, /Recorded Document Search/);
    assert.match(manual, /Search Page URL Locator/);
    assert.match(manual, /Process batch/);
    assert.match(manual, /Open collector portal/);
    assert.match(manual, /Guest Sign In/);
    assert.match(manual, /https:\/\/pp-chippewa-co-wi-fb\.app\.landnav\.com\/login\/index\//);
    assert.doesNotMatch(manual, /Passport/i);
    assert.doesNotMatch(manual, /GROQ_API_KEY/);
  });

  it('is linked from the tool header', () => {
    assert.match(index, /User guide/);
    assert.match(index, /href="\/manual\.html"/);
  });
});

describe('Figma user-manual prompt', () => {
  it('is paste-ready with brand tokens and required frames', () => {
    assert.equal(fs.existsSync(figmaPromptPath), true);
    assert.match(figma, /1280 × 800|1280 x 800|1280×800/);
    assert.match(figma, /#050B20/i);
    assert.match(figma, /#3EC4FF/i);
    assert.match(figma, /DM Sans/);
    assert.match(figma, /Cover/);
    assert.match(figma, /Members access/);
    assert.match(figma, /TCS flow/);
    assert.match(figma, /TPA flow/);
    assert.match(figma, /RDS flow/);
    assert.match(figma, /S-PUL/);
    assert.match(figma, /Batch of 10/);
    assert.match(figma, /Certificate result/);
    assert.match(figma, /FAQ/);
    assert.match(figma, /border-left/);
    assert.match(figma, /62\.5%/);
    assert.match(figma, /pp-chippewa-co-wi-fb\.app\.landnav\.com/);
  });
});
