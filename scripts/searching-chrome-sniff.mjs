#!/usr/bin/env node
/**
 * Optional Chrome pass against https://webpointllc.com/searching.
 * Secrets stay in the environment for this process only — never argv logs, never git.
 *
 *   SQS_SITE   Squarespace site password (operator-owned)
 *   SQS_INDEX  Restricted Index access code (operator-owned)
 *
 * Writes screenshots and DATA JSON under /tmp only.
 */

import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const SITE = process.env.SQS_SITE || '';
const INDEX = process.env.SQS_INDEX || '';
const OUT_DIR = process.env.SEARCHING_SNIFF_DIR || '/tmp';
const CHROME =
  process.env.CHROME ||
  ['/usr/bin/google-chrome', '/usr/local/bin/google-chrome', '/usr/bin/chromium'].find((p) =>
    fs.existsSync(p)
  );

function die(msg, code = 2) {
  console.error(msg);
  process.exit(code);
}

if (!CHROME) die('No Chrome binary. Set CHROME= or install google-chrome.');
if (!SITE || !INDEX) die('Set SQS_SITE and SQS_INDEX in the environment. Do not pass them as argv.');

let puppeteer;
try {
  puppeteer = require('puppeteer-core');
} catch {
  die('puppeteer-core is not installed in this tree. Cloud agents use /tmp/chrome-unlock.');
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1400,1100']
});
const page = await browser.newPage();
page.setDefaultTimeout(30000);
await page.setViewport({ width: 1400, height: 1100 });
await page.goto('https://webpointllc.com/searching', { waitUntil: 'domcontentloaded' });

const pwd = await page.$('input[type="password"], input.password-input, input[name="password"]');
if (pwd) {
  await pwd.type(SITE, { delay: 12 });
  await Promise.all([
    page.keyboard.press('Enter'),
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => null)
  ]);
}
await new Promise((r) => setTimeout(r, 1600));

const visibleInputs = await page.$$('input');
for (const el of visibleInputs) {
  const box = await el.boundingBox();
  if (!box) continue;
  const t = await el.evaluate((e) => ({ type: e.type, ph: e.placeholder, name: e.name, cls: e.className }));
  if (t.type === 'password' && !/password-input/i.test(t.cls || '')) {
    await el.click({ clickCount: 3 });
    await el.type(INDEX, { delay: 12 });
    break;
  }
  if (/code|pin|access/i.test(`${t.ph} ${t.name}`)) {
    await el.click({ clickCount: 3 });
    await el.type(INDEX, { delay: 12 });
    break;
  }
}

await page.evaluate(() => {
  const nodes = [...document.querySelectorAll('button, input[type="submit"], a, [role="button"]')];
  const hit = nodes.find((n) => /unlock/i.test((n.innerText || n.value || '').trim()));
  if (hit) hit.click();
});
await page.keyboard.press('Enter');
await new Promise((r) => setTimeout(r, 3500));

const html = await page.content();
fs.writeFileSync(`${OUT_DIR}/searching-index.html`, html);
await page.screenshot({ path: `${OUT_DIR}/searching-index.png`, fullPage: true });

const snapshot = await page.evaluate(() => {
  const iframes = [...document.querySelectorAll('iframe')].map((e) => ({
    src: e.src,
    title: e.title,
    cls: e.className
  }));
  let data = [];
  const scripts = [...document.querySelectorAll('script')].map((s) => s.textContent || '');
  for (const src of scripts) {
    const m = src.match(/const\s+DATA\s*=\s*(\[[\s\S]*?\]);/);
    if (m) {
      try {
        data = JSON.parse(m[1]);
      } catch {
        data = [];
      }
      break;
    }
  }
  return {
    title: document.title,
    url: location.href,
    text: (document.body.innerText || '').slice(0, 4000),
    iframes,
    dataCount: Array.isArray(data) ? data.length : 0,
    dataSample: Array.isArray(data) ? data.slice(0, 8) : []
  };
});

fs.writeFileSync(`${OUT_DIR}/searching-chrome-sniff.json`, JSON.stringify(snapshot, null, 2));
await browser.close();

const tcs = (snapshot.iframes || []).find((f) => /tax-certificate-processor\.onrender\.com/i.test(f.src || ''));
console.log(
  JSON.stringify(
    {
      ok: Boolean(tcs) && snapshot.dataCount > 0,
      url: snapshot.url,
      iframeSrc: tcs ? tcs.src : null,
      iframeClass: tcs ? tcs.cls : null,
      dataCount: snapshot.dataCount,
      wrote: [`${OUT_DIR}/searching-index.png`, `${OUT_DIR}/searching-chrome-sniff.json`]
    },
    null,
    2
  )
);
