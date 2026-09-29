'use strict';

const STATE_MAP = {
  tx: 'TX', fl: 'FL', ga: 'GA', il: 'IL', ca: 'CA',
  ny: 'NY', nc: 'NC', sc: 'SC', va: 'VA', pa: 'PA',
  oh: 'OH', mi: 'MI', az: 'AZ', co: 'CO', wa: 'WA',
  or: 'OR', tn: 'TN', al: 'AL', ms: 'MS', mo: 'MO',
  la: 'LA', ar: 'AR', ok: 'OK', nm: 'NM', nv: 'NV',
  ut: 'UT', id: 'ID', mt: 'MT', wy: 'WY', nd: 'ND',
  sd: 'SD', ne: 'NE', ks: 'KS', mn: 'MN', ia: 'IA',
  wi: 'WI', in: 'IN', ky: 'KY', wv: 'WV', md: 'MD',
  de: 'DE', nj: 'NJ', ct: 'CT', ri: 'RI', ma: 'MA',
  vt: 'VT', nh: 'NH', me: 'ME', hi: 'HI', ak: 'AK',
  dc: 'DC', pr: 'PR'
};

const STATE_NAMES = {
  texas: 'TX', florida: 'FL', georgia: 'GA', illinois: 'IL',
  california: 'CA', 'new york': 'NY', 'north carolina': 'NC',
  'south carolina': 'SC', virginia: 'VA', pennsylvania: 'PA',
  ohio: 'OH', michigan: 'MI', arizona: 'AZ', colorado: 'CO',
  washington: 'WA', oregon: 'OR', tennessee: 'TN', alabama: 'AL',
  mississippi: 'MS', missouri: 'MO', louisiana: 'LA', arkansas: 'AR',
  oklahoma: 'OK', 'new mexico': 'NM', nevada: 'NV', utah: 'UT',
  'new jersey': 'NJ', maryland: 'MD', minnesota: 'MN', wisconsin: 'WI',
  indiana: 'IN', kentucky: 'KY', kansas: 'KS', nebraska: 'NE',
  'district of columbia': 'DC', 'puerto rico': 'PR', 'rhode island': 'RI',
  massachusetts: 'MA', connecticut: 'CT', delaware: 'DE', alaska: 'AK',
  hawaii: 'HI', idaho: 'ID', montana: 'MT', wyoming: 'WY',
  'north dakota': 'ND', 'south dakota': 'SD', 'west virginia': 'WV',
  'new hampshire': 'NH', vermont: 'VT', maine: 'ME', iowa: 'IA'
};

const AMBIGUOUS_ABBR = new Set(['in', 'or', 'me', 'ok', 'hi', 'oh', 'id']);
const BAD_COUNTY = /^(hey|hi|hello|please|search|find|need|parcel|tax|info|the|a|an|my|your|can|you|for|me|pull|up|and)$/i;
const STATE_NAME_ALT = Object.keys(STATE_NAMES).sort((a, b) => b.length - a.length).join('|');

function stripChatFiller(message) {
  let msg = String(message || '').toLowerCase().trim();
  msg = msg.replace(/[·|]+/g, ' ');
  msg = msg.replace(/^(hey|hi|hello|please)[,!.]?\s+/g, '');
  msg = msg.replace(/\b(can you|could you|would you|please)\s+/g, ' ');
  msg = msg.replace(/\b(i need to find|i need|help me|go ahead and|where do i|how do i)\s+/g, ' ');
  msg = msg.replace(/\b(search(?:\s+the|\s+for)?|look up|lookup|pull up|find)\s+/g, ' ');
  msg = msg.replace(/\b(?:the )?(?:tax (?:info|information|bill|bills|certificate)?)\b/g, ' ');
  msg = msg.replace(/\b(for me|thanks|thank you)\b/g, ' ');
  msg = msg.replace(/\b(search by last name|search by owner|tax bill lookup|bill lookup)\b.*$/i, '');
  msg = msg.replace(/\b(property tax|property taxes)\b/gi, ' property taxes ');
  return msg.replace(/\s+/g, ' ').trim();
}

function cleanCountyName(name) {
  let n = String(name || '').trim();
  n = n.replace(/\s*county\s*$/i, '').trim();
  n = n.replace(/^(?:pay|property)\s+taxes?\s+/i, '').trim();
  n = n.replace(/^(?:in|the|find|search|for|at|near|of|and)\s+/i, '').trim();
  n = n.replace(/^(?:in|the)\s+/i, '').trim();
  if (!n || BAD_COUNTY.test(n) || n.split(/\s+/).length > 5) return '';
  return n;
}

function resolveStateToken(token) {
  const t = String(token || '').toLowerCase().trim();
  if (STATE_MAP[t]) return STATE_MAP[t];
  if (STATE_NAMES[t]) return STATE_NAMES[t];
  return null;
}

function lastRegexMatch(re, text) {
  let last = null;
  const copy = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
  let m;
  while ((m = copy.exec(text))) last = m;
  return last;
}

function parseJurisdictionRaw(message) {
  const original = String(message || '').toLowerCase().trim();
  const msg = stripChatFiller(original);

  const cadMatch = /([a-z][a-z\s\-]+?)\s+(?:county\s+)?(?:cad|central appraisal district|appraisal district)/i.exec(msg);
  if (cadMatch) {
    const county = cleanCountyName(cadMatch[1]);
    if (county) return { county, state: 'TX' };
  }

  const inPlace = lastRegexMatch(
    new RegExp(
      `\\bin\\s+(?:the\\s+(?:city|county)\\s+of\\s+)?([a-z][a-z\\s\\-']{1,40}?)\\s*,?\\s+(${STATE_NAME_ALT}|[a-z]{2})\\b`,
      'i'
    ),
    msg
  );
  if (inPlace) {
    const state = resolveStateToken(inPlace[2]);
    const county = cleanCountyName(inPlace[1]);
    if (state && county) return { county, state };
  }

  const withState = /([a-z][a-z\s\-]+?)\s+county[\s,]+([a-z]{2})\b/i.exec(msg);
  if (withState) {
    const state = resolveStateToken(withState[2]);
    const county = cleanCountyName(withState[1]);
    if (state && county) return { county, state };
  }

  const commaState = lastRegexMatch(/([a-z][a-z\s\-]+?),\s*([a-z]{2})\b/i, msg);
  if (commaState) {
    const state = resolveStateToken(commaState[2]);
    const county = cleanCountyName(commaState[1]);
    if (state && county) return { county, state };
  }

  const payTaxes = /(?:pay\s+)?property taxes?\s+([a-z][a-z\s\-]+?)\s+([a-z]{2})\b/i.exec(msg);
  if (payTaxes && resolveStateToken(payTaxes[2])) {
    const county = cleanCountyName(payTaxes[1]);
    if (county) return { county, state: resolveStateToken(payTaxes[2]) };
  }

  for (const [name, abbr] of Object.entries(STATE_NAMES)) {
    const payFullState = new RegExp(
      `(?:pay\\s+)?property taxes?\\s+([a-z][a-z\\s\\-]+?)\\s+${name}\\b`,
      'i'
    ).exec(msg);
    if (payFullState) {
      const county = cleanCountyName(payFullState[1]);
      if (county) return { county, state: abbr };
    }
  }

  const trailingState = /\b([a-z][a-z\s\-]{1,48}?)\s+([a-z]{2})\s*$/i.exec(msg);
  if (trailingState && resolveStateToken(trailingState[2])) {
    const county = cleanCountyName(trailingState[1]);
    const abbr = trailingState[2].toLowerCase();
    if (county && (!AMBIGUOUS_ABBR.has(abbr) || /\bcounty\b/i.test(trailingState[1]))) {
      return { county, state: resolveStateToken(trailingState[2]) };
    }
    if (county && msg.endsWith(abbr) && trailingState[1].split(/\s+/).length <= 3) {
      return { county, state: resolveStateToken(trailingState[2]) };
    }
  }

  const countyOnly = /([a-z][a-z\s\-]+?)\s+county/i.exec(msg);
  if (countyOnly) {
    let state = null;
    for (const [name, abbr] of Object.entries(STATE_NAMES)) {
      if (msg.includes(name)) {
        state = abbr;
        break;
      }
    }
    const county = cleanCountyName(countyOnly[1]);
    if (county) return { county, state };
  }

  for (const [name, abbr] of Object.entries(STATE_NAMES)) {
    if (msg.includes(name)) {
      const before = msg
        .split(name)[0]
        .trim()
        .split(/\s+/)
        .slice(-3)
        .join(' ')
        .replace(/[,]+$/, '')
        .replace(/\bcounty\b/i, '')
        .trim();
      const county = cleanCountyName(before);
      if (county) return { county, state: abbr };
    }
  }

  const bare = msg.replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (STATE_NAMES[bare]) return { county: null, state: STATE_NAMES[bare] };
  if (/^[a-z]{2}$/.test(bare) && STATE_MAP[bare] && !AMBIGUOUS_ABBR.has(bare)) {
    return { county: null, state: STATE_MAP[bare] };
  }

  return { county: null, state: null };
}

module.exports = {
  parseJurisdictionRaw,
  stripChatFiller,
  cleanCountyName
};
