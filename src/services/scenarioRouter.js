const fs = require('fs');
const path = require('path');
const { parseJurisdiction } = require('./urlFinder');

const scenariosPath = path.join(__dirname, '../../data/training_scenarios.json');
let scenariosCache = null;

const INTENT_PATTERNS = [
  { intent: 'pay_taxes', re: /\b(pay|payment|payable|bill|due)\b.*\b(property\s+)?tax/i },
  { intent: 'pay_taxes_search_by_name', re: /\b(last\s*name|owner\s*name|by\s+name)\b/i },
  { intent: 'search_by_parcel', re: /\b(parcel|pin|apn|folio)\b/i },
  { intent: 'search_by_account', re: /\b(account\s*(#|number)?|tax\s*id)\b/i },
  { intent: 'tx_cad_property_search', re: /\b(cad|central appraisal|appraisal district)\b/i },
  { intent: 'tx_tax_office_not_cad', re: /\b(tax\s+office|tax\s+collector|not\s+the\s+cad|treasurer)\b/i },
  { intent: 'off_topic', re: /\b(weather|emergency|hospital|recipe|football)\b/i }
];

function loadScenarios() {
  if (!scenariosCache) {
    const raw = JSON.parse(fs.readFileSync(scenariosPath, 'utf8'));
    scenariosCache = raw.scenarios || raw;
  }
  return scenariosCache;
}

function detectIntent(message) {
  const msg = (message || '').trim();
  for (const { intent, re } of INTENT_PATTERNS) {
    if (re.test(msg)) return intent;
  }
  if (/\bproperty\s+tax/i.test(msg)) return 'pay_taxes_search_by_name';
  return 'locate_tax_search_page';
}

function matchScenario(message) {
  const msg = (message || '').trim().toLowerCase();
  const scenarios = loadScenarios();
  let best = null;
  let bestScore = 0;

  for (const s of scenarios) {
    if (s.expectNoUrl) continue;
    const needle = (s.userMessage || '').toLowerCase();
    const words = needle.split(/\s+/).filter((w) => w.length > 3);
    let score = 0;
    for (const w of words) {
      if (msg.includes(w)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }

  const parsed = parseJurisdiction(message);
  const intent = best?.intent || detectIntent(message);

  return {
    intent,
    scenarioId: best && bestScore >= 3 ? best.id : null,
    scenarioLabel: best && bestScore >= 3 ? best.userMessage : null,
    county: parsed.county,
    state: parsed.state,
    parsed
  };
}

function intentGuidance(intent) {
  const map = {
    pay_taxes: 'User wants to PAY property taxes or open the official tax payment/search portal — not an assessor brochure.',
    pay_taxes_search_by_name: 'User wants the page where they search by OWNER LAST NAME and pay/view tax bills — not property value-only assessor sites.',
    search_by_parcel: 'User will search by parcel / PIN / APN on the tax collector search page.',
    search_by_account: 'User will search by tax account number on the collector portal.',
    tx_cad_property_search: 'Texas CAD query: appraisal district property search (values). If user asked to PAY taxes, prefer Tax Assessor-Collector over CAD.',
    tx_tax_office_not_cad: 'Texas: route to Tax Assessor-Collector / tax office URL. Do NOT substitute a CAD homepage when user asked for tax office.',
    locate_tax_search_page: 'Locate the official property tax search page for the jurisdiction.',
    off_topic: 'Not a property tax URL request — refuse briefly per SPUL rules.'
  };
  return map[intent] || map.locate_tax_search_page;
}

function buildScenarioContext(county, state, urlResult, scenarioMatch) {
  const intent = scenarioMatch?.intent || 'locate_tax_search_page';
  const lines = [
    '--- SCENARIO CONTEXT ---',
    `Detected intent: ${intent}`,
    `Guidance: ${intentGuidance(intent)}`
  ];

  if (scenarioMatch?.scenarioId) {
    lines.push(`Matched training scenario: ${scenarioMatch.scenarioId}`);
  }

  if (urlResult?.rejectURLs?.length) {
    lines.push(`Forbidden hosts/URLs (never use): ${urlResult.rejectURLs.join(', ')}`);
  }

  if (intent === 'tx_tax_office_not_cad' || (state === 'TX' && intent === 'pay_taxes')) {
    lines.push(
      'Texas rule: Tax Assessor-Collector collects taxes. CAD sets values only — do not send pay-tax users to CAD unless that is the only DB URL and note it in SPUL_CONTEXT.'
    );
  }

  if (county && state && urlResult?.url) {
    lines.push(
      'User-facing goal: give the exact Official Search URL below in SPUL_URL — never invent alternates.'
    );
  }

  return lines.join('\n');
}

function getHeroExamples(limit = 4) {
  const scenarios = loadScenarios();
  const picks = scenarios.filter((s) => !s.expectNoUrl && !s.optional).slice(0, limit);
  return picks.map((s) => s.userMessage);
}

function getFewShotExamples(count = 4) {
  const scenarios = loadScenarios().filter((s) => !s.expectNoUrl && !s.optional);
  const day = new Date().getDate();
  const start = day % Math.max(1, scenarios.length - count);
  return scenarios.slice(start, start + count).map((s) => ({
    user: s.userMessage,
    intent: s.intent,
    jurisdiction: `${s.expectedCounty || '?'}, ${s.expectedState || '?'}`
  }));
}

module.exports = {
  matchScenario,
  buildScenarioContext,
  intentGuidance,
  getHeroExamples,
  getFewShotExamples,
  loadScenarios
};
