'use strict';

/**
 * Site validator: DR Production Results column heads are the fields we look for
 * on each county portal. Cloudflare JS challenges are queued for a real Chrome
 * user session (DeepShake). This module does not bypass Cloudflare.
 */

const fs = require('fs');
const path = require('path');
const drProduction = require('./drProduction');
const { CLOUDFLARE, extractFields, extractTitle } = require('../../scripts/probe-lib');

const RUN_PATH = path.join(__dirname, '../../data/validation_run.json');
const QUEUE_PATH = path.join(__dirname, '../../data/deepshake_queue.json');
const PLAYBOOK_SKIP = new Set(['OH-Hamilton', 'CT-HartfordCity', 'IL-Sangamon']);

function lookForSpec() {
  const schema = drProduction.loadSchema();
  return schema.portal_look_for || [];
}

function lookForHeaders() {
  return lookForSpec().map((row) => row.header);
}

function sniffDrFields(html, probeFields) {
  const hay = String(html || '').toLowerCase();
  const found = [];
  const seen = new Set();
  const probe = Array.isArray(probeFields) ? probeFields : extractFields(html);
  for (const spec of lookForSpec()) {
    const hitRole = probe.some((f) => spec.roles && spec.roles.includes(f.role));
    const hitHint = (spec.hints || []).some((h) => hay.includes(String(h).toLowerCase()));
    if (hitRole || hitHint) {
      if (seen.has(spec.header)) continue;
      seen.add(spec.header);
      found.push(spec.header);
    }
  }
  return found;
}

function cloudflareGated({ html, title, reason, status }) {
  const blob = `${title || ''} ${String(html || '').slice(0, 4000)}`;
  if (reason === 'collector_host_cloudflare') return true;
  if (CLOUDFLARE.test(blob)) return true;
  if ((status === 403 || status === 401) && /county-taxes\.(com|net)/i.test(blob)) return true;
  return false;
}

function needsDeepShake(hit) {
  if (!hit) return false;
  if (hit.needsDeepShake) return true;
  if (hit.cloudflare) return true;
  if (cloudflareGated(hit)) return true;
  if (hit.verdict === 'collector_search' && !(hit.drFields && hit.drFields.length)) return true;
  if (hit.verdict === 'unknown_live') return true;
  if (hit.reason === 'timeout' || hit.error === 'timeout') return true;
  return false;
}

function handshake({ lookup, extractor, sessionId, hit } = {}) {
  const portal = (lookup && (lookup.officialUrl || lookup.lockedUrl || lookup.candidateUrl)) || '';
  const gated = Boolean(hit && needsDeepShake(hit)) || Boolean(lookup && !lookup.urlLocked);
  const recommended = Boolean(portal) && (gated || (hit && cloudflareGated(hit)));
  return {
    recommended,
    reason: hit && cloudflareGated(hit)
      ? 'cloudflare_js_challenge'
      : lookup && lookup.urlLocked
        ? 'open_locked_portal'
        : 'confirm_collector_search',
    portalUrl: portal || null,
    openIn: 'user_chrome_tab',
    sessionId: sessionId || null,
    countyKey: lookup?.key || extractor?.jurisdiction_key || null,
    lookFor: lookForHeaders(),
    note: 'Open the tax collecting entity in the signed-in user\'s real Chrome tab. Cloudflare challenges need that session. Do not invent a URL. Fill the DR Production Results row from what the collector shows.'
  };
}

function loadLastRun() {
  if (!fs.existsSync(RUN_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(RUN_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function loadQueue() {
  if (!fs.existsSync(QUEUE_PATH)) return { generatedAt: null, rows: [] };
  try {
    return JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf8'));
  } catch {
    return { generatedAt: null, rows: [] };
  }
}

function runTime(run) {
  const then = Date.parse(run && run.generatedAt);
  return Number.isFinite(then) ? then : 0;
}

function fresherRun(fileRun, dbRun) {
  if (!fileRun) return dbRun || null;
  if (!dbRun) return fileRun;
  return runTime(dbRun) > runTime(fileRun) ? dbRun : fileRun;
}

function staleRun(run, days = 28) {
  if (!run || !run.generatedAt) return true;
  const then = runTime(run);
  if (!then) return true;
  return Date.now() - then > days * 24 * 60 * 60 * 1000;
}

function skipPlaybookKey(key) {
  return PLAYBOOK_SKIP.has(key);
}

module.exports = {
  PLAYBOOK_SKIP,
  lookForSpec,
  lookForHeaders,
  sniffDrFields,
  cloudflareGated,
  needsDeepShake,
  handshake,
  loadLastRun,
  loadQueue,
  fresherRun,
  staleRun,
  skipPlaybookKey,
  RUN_PATH,
  QUEUE_PATH
};
