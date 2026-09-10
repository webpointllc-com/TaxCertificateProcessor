'use strict';

/**
 * LLM Comm (flow) — deterministic guide.
 * Walks intent → county/state → presents registry-locked URLs + confidence.
 * Never invents URLs. Optional Groq only narrates around locked registry truth.
 */

const { isRealHttpUrl, hasUrlLock } = require('./spulTruth');

const INTENT_PATTERNS = [
  { id: 'pay_taxes', re: /\b(pay|payment|bill|owe|owing|delinquent)\b/i },
  { id: 'search_parcel', re: /\b(parcel|pin|account|apn|folio)\b/i },
  { id: 'search_owner', re: /\b(owner|last\s*name|surname)\b/i },
  { id: 'search_address', re: /\b(address|street|property\s+look\s*up)\b/i },
  { id: 'generic_search', re: /\b(search|lookup|look\s*up|find|tax)\b/i },
];

function detectIntent(message) {
  for (const p of INTENT_PATTERNS) {
    if (p.re.test(message)) return p.id;
  }
  return 'generic_search';
}

function intentActions(intent) {
  switch (intent) {
    case 'pay_taxes':
      return [
        'Open the locked collector/treasurer URL below',
        'Search by owner last name or parcel / account number',
        'View balance / pay online if the site offers it',
      ];
    case 'search_parcel':
      return [
        'Open the locked search URL',
        'Enter parcel / account / PIN exactly as on the tax bill',
        'Confirm the owner name matches before paying',
      ];
    case 'search_owner':
      return [
        'Open the locked search URL',
        'Search by owner last name (try exact spelling first)',
        'Narrow with address or account if multiple hits',
      ];
    case 'search_address':
      return [
        'Open the locked search URL',
        'Enter street address as the county formats it',
        'Confirm parcel / owner before payment',
      ];
    default:
      return [
        'Search by owner last name',
        'Search by parcel / account number',
        'View tax payment history if available',
      ];
  }
}

function clarifyingQuestions(parsed, results) {
  const qs = [];
  if (!parsed || !parsed.state) {
    qs.push('Which U.S. state? (e.g. TX, CA, IL)');
  }
  if (!parsed || !parsed.county) {
    qs.push('Which county, parish, or city jurisdiction?');
  }
  if (results && results.length > 1) {
    qs.push('Which of the listed jurisdictions is correct? Reply with the county name.');
  }
  if (results && results.length === 0) {
    qs.push('Try “County Name ST” — example: Travis County TX or Cook County IL.');
  }
  return qs;
}

/**
 * @param {object} opts
 * @param {string} opts.message
 * @param {function} opts.searchFn - (q, limit) => search result object from server
 */
function guideTurn({ message, searchFn }) {
  const text = String(message || '').trim();
  if (!text) {
    return {
      ok: false,
      error: 'Message required',
      guide: null,
    };
  }

  const intent = detectIntent(text);
  const lookup = searchFn(text, 6);
  const results = (lookup.results || []).filter((r) => isRealHttpUrl(r.url));
  const top = results[0] || null;
  const locked = top && hasUrlLock(top.confidence, top.url);

  const lines = [];
  lines.push('S-PUL guide (registry-locked — URLs never invented)');

  if (lookup.miss || !results.length) {
    lines.push('');
    lines.push('No jurisdiction URL in the Extractor index for that query.');
    const qs = clarifyingQuestions(lookup.parsed, results);
    if (qs.length) {
      lines.push('');
      lines.push('Clarify:');
      qs.forEach((q, i) => lines.push(`${i + 1}. ${q}`));
    }
    return {
      ok: true,
      mode: 'clarify',
      intent,
      miss: true,
      parsed: lookup.parsed || null,
      lockedUrl: null,
      results: [],
      questions: qs,
      message: lines.join('\n'),
      spul: {
        SPUL_URL: null,
        SPUL_ENTITY: null,
        SPUL_CONFIDENCE: 'not_found',
        SPUL_ACTIONS: intentActions(intent),
        SPUL_CONTEXT: 'Honest miss — ask for county + state.',
      },
    };
  }

  const entity = `${top.county}, ${top.state} (${top.source || 'URL'})`;
  const conf = top.confidence;
  const actions = intentActions(intent);

  lines.push('');
  lines.push(`Intent: ${intent.replace(/_/g, ' ')}`);
  if (lookup.parsed) {
    lines.push(`Parsed: ${lookup.parsed.county || '(county?)'} ${lookup.parsed.state || ''}`.trim());
  }
  lines.push('');
  lines.push(`SPUL_URL: ${top.url}`);
  lines.push(`SPUL_ENTITY: ${entity}`);
  lines.push(`SPUL_CONFIDENCE: ${conf} (${top.confidencePct}%)`);
  lines.push('SPUL_ACTIONS:');
  actions.forEach((a) => lines.push(`- ${a}`));
  lines.push('SPUL_CONTEXT:');
  lines.push(
    `Official ${top.source || 'registry'} URL from Extractor index` +
      (top.active === false ? ' (flagged inactive in last health sample)' : '') +
      '. Copy exactly — do not substitute assessor/CAD pages unless this is the indexed entry.'
  );

  if (results.length > 1) {
    lines.push('');
    lines.push('Also ranked (still registry-only):');
    results.slice(1, 4).forEach((r) => {
      lines.push(`- ${r.jurisdiction} · ${r.confidence} ${r.confidencePct}% · ${r.url}`);
    });
  }

  const qs = clarifyingQuestions(lookup.parsed, results);
  if (!locked || results.length > 1) {
    if (qs.length) {
      lines.push('');
      lines.push('If this is not the right jurisdiction:');
      qs.forEach((q, i) => lines.push(`${i + 1}. ${q}`));
    }
  }

  return {
    ok: true,
    mode: locked ? 'locked' : 'ranked',
    intent,
    miss: false,
    parsed: lookup.parsed || null,
    lockedUrl: locked ? top.url : null,
    results,
    questions: qs,
    message: lines.join('\n'),
    spul: {
      SPUL_URL: top.url,
      SPUL_ENTITY: entity,
      SPUL_CONFIDENCE: conf,
      SPUL_ACTIONS: actions,
      SPUL_CONTEXT: `Registry ${top.source} URL; confidence ${conf} ${top.confidencePct}%`,
    },
  };
}

/**
 * Optional Groq narration — still hard-locks URL from registry.
 * Returns null if GROQ_API_KEY missing or call fails (caller uses deterministic guide).
 */
async function maybeGroqNarrate(guide, groqApiKey) {
  if (!groqApiKey || !guide || !guide.ok || guide.miss) return null;
  if (!guide.spul || !guide.spul.SPUL_URL) return null;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.1,
        max_tokens: 280,
        messages: [
          {
            role: 'system',
            content:
              'You guide users to an official property-tax search page. ' +
              'NEVER invent or change URLs. SPUL_URL is hard-locked from JURISDICTION DATA. ' +
              'Reply in 3-5 short sentences: confirm jurisdiction, tell them to open the locked URL, ' +
              'list 2-3 search tips (owner / parcel / address). No markdown headings.',
          },
          {
            role: 'user',
            content:
              `JURISDICTION DATA (copy URL exactly):\n` +
              `SPUL_URL: ${guide.spul.SPUL_URL}\n` +
              `SPUL_ENTITY: ${guide.spul.SPUL_ENTITY}\n` +
              `SPUL_CONFIDENCE: ${guide.spul.SPUL_CONFIDENCE}\n` +
              `Intent: ${guide.intent}\n` +
              `User message already resolved to this registry row.`,
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) return null;
    return String(text).trim();
  } catch {
    return null;
  }
}

module.exports = {
  detectIntent,
  guideTurn,
  maybeGroqNarrate,
  intentActions,
  clarifyingQuestions,
};
