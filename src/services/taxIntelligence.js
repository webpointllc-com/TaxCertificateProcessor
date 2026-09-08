const fs = require('fs');
const path = require('path');
const { findPropertyURL } = require('./urlFinder');
const { hasUrlLock, enforceLockedSpulUrl, isGoogleFallbackUrl } = require('./spulTruth');
const { buildScenarioContext, getFewShotExamples } = require('./scenarioRouter');

const statutesPath = path.join(__dirname, '../../data/statutes.json');
let statutesCache = null;

function loadStatutes() {
  if (!statutesCache) {
    statutesCache = JSON.parse(fs.readFileSync(statutesPath, 'utf8'));
  }
  return statutesCache;
}

function formatFewShots() {
  const shots = getFewShotExamples(4);
  if (!shots.length) return '';
  const lines = shots.map(
    (s, i) =>
      `Example ${i + 1} — User: "${s.user}" → Intent: ${s.intent}; jurisdiction: ${s.jurisdiction}. Respond with SPUL_* fields only; URL from JURISDICTION DATA.`
  );
  return `\n--- FEW-SHOT (style only — URLs must come from JURISDICTION DATA) ---\n${lines.join('\n')}`;
}

function enrichSystemPrompt(county, state, options = {}) {
  const scenarioMatch = options.scenarioMatch || null;

  const STRICT_BASE = `You are SPUL — Search Page URL Locator. Single-purpose: find the official real property TAX SEARCH PAGE for U.S. jurisdictions — the page where residents look up and pay property taxes.

USER INTENT (always apply):
- Residents want to PAY or SEARCH property tax bills — typically by owner last name, parcel/account number, or address.
- Do NOT send them to assessor marketing pages, CAD homepages, or property-value-only tools when they asked to pay or search tax bills.

CRITICAL DISTINCTION — know this before every response:
- TAX COLLECTOR / TAX OFFICE / TREASURER = where residents PAY taxes → this is what SPUL finds
- APPRAISAL DISTRICT / ASSESSOR = where property VALUES are set → NOT the payment/search page unless DB says otherwise
- In Texas: the CAD does NOT collect taxes. NEVER send a pay-taxes user to a CAD URL when JURISDICTION DATA lists a tax office URL.
- In Illinois: the County Treasurer collects taxes; the Assessor sets values. SPUL finds the Treasurer.
- Always prefer the TAX COLLECTOR URL over the appraisal/assessment URL.

ABSOLUTE RULES:
1. ONLY respond to property tax search page queries.
2. Off-topic queries (emergencies, health, weather, general): respond only with: "SPUL only locates property tax search pages. Try: 'Travis County TX' or 'Cook County IL'"
3. NEVER narrate reasoning. No "Let me...", "I'll look...", "Analyzing...", "Thinking...".
4. NEVER fabricate or invent URLs. Use only the URL provided in JURISDICTION DATA below.
5. The SPUL_URL field MUST contain exactly the URL from JURISDICTION DATA — do not substitute.
6. No paragraphs. Use the exact output format.
${formatFewShots()}

OUTPUT FORMAT (use every time):
SPUL_URL: [URL from JURISDICTION DATA — copy exactly, do not modify]
SPUL_ENTITY: [full official name of the tax collecting entity]
SPUL_CONFIDENCE: [verified|pattern_matched|not_found]
SPUL_ACTIONS:
- Search by owner last name
- Search by parcel / account number
- View tax payment history
SPUL_CONTEXT:
[One sentence: entity type, tax type, redemption period. Nothing else.]`;

  if (!county || !state) {
    return (
      STRICT_BASE +
      `

No jurisdiction detected. Ask the user to provide county name and state (e.g., "Travis County TX").`
    );
  }

  const statutes = loadStatutes();
  const stateData = statutes[state.toUpperCase()];
  const urlResult = findPropertyURL(county, state);
  const entityType = urlResult.entityType || 'tax_collector';
  const entityNote = urlResult.entityNote || '';
  const scenarioBlock = buildScenarioContext(county, state, urlResult, scenarioMatch);

  let injection = `

${scenarioBlock}

--- JURISDICTION DATA — use these values exactly ---
County: ${county}, ${state}
Entity type: ${entityType}
Entity note: ${entityNote || 'none'}
Official Search URL: ${urlResult.url || '(none — tell user SPUL needs operator correction)'}
Confidence: ${urlResult.confidence}
Source: ${urlResult.source}`;

  if (stateData) {
    injection += `
Statutes: ${stateData.statutes}
Tax type: ${stateData.saleProcess.split('.')[0]}
Redemption: ${stateData.redemptionPeriodDays} days
Interest: ${stateData.interestRateCap}`;
  }

  if (urlResult.rejectURLs && urlResult.rejectURLs.length) {
    injection += `
FORBIDDEN (never put in SPUL_URL): ${urlResult.rejectURLs.join(', ')}`;
  }

  const locked = hasUrlLock(urlResult.confidence, urlResult.url);
  if (locked) {
    injection += `

HARD LOCK (mandatory — database source of truth):
SPUL_URL MUST be exactly: ${urlResult.url}
Any other URL is forbidden. Do not substitute assessor homepages, CAD sites, or Google links.
SPUL_CONFIDENCE MUST be: ${urlResult.confidence}
When URL is locked, output SPUL_URL first exactly as shown, then SPUL_ENTITY, SPUL_CONFIDENCE, SPUL_ACTIONS, SPUL_CONTEXT only.`;
  } else if (urlResult.url && !isGoogleFallbackUrl(urlResult.url)) {
    injection += `

DB URL present (pattern_matched): use this URL in SPUL_URL exactly: ${urlResult.url}
Do not invent a different host.`;
  } else if (isGoogleFallbackUrl(urlResult.url)) {
    injection += `

No verified DB URL — SPUL_CONFIDENCE must be not_found. Do not invent county URLs.`;
  }

  injection += `

REMINDER: Copy the URL above exactly into SPUL_URL. Do not use any other URL.
${entityType === 'appraisal_district' ? 'NOTE: This entry is an appraisal district search (not the tax collector). State this clearly in SPUL_CONTEXT.' : ''}`;

  return STRICT_BASE + injection;
}

module.exports = { enrichSystemPrompt, enforceLockedSpulUrl, hasUrlLock };
