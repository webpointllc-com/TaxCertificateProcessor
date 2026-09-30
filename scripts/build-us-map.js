#!/usr/bin/env node
/**
 * Pre-render Albers US states from us-atlas 10m so the iframe never loads D3.
 * Spec: viewBox="-62 8 1023 602", clickable per-state paths + nation mesh.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { geoPath } = require('d3-geo');
const topojson = require('topojson-client');

const OUT = path.join(__dirname, '..', 'public', 'us-map.svg');
const ATLAS = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-albers-10m.json';

const FIPS = {
  '01': 'AL',
  '02': 'AK',
  '04': 'AZ',
  '05': 'AR',
  '06': 'CA',
  '08': 'CO',
  '09': 'CT',
  '10': 'DE',
  '11': 'DC',
  '12': 'FL',
  '13': 'GA',
  '15': 'HI',
  '16': 'ID',
  '17': 'IL',
  '18': 'IN',
  '19': 'IA',
  '20': 'KS',
  '21': 'KY',
  '22': 'LA',
  '23': 'ME',
  '24': 'MD',
  '25': 'MA',
  '26': 'MI',
  '27': 'MN',
  '28': 'MS',
  '29': 'MO',
  '30': 'MT',
  '31': 'NE',
  '32': 'NV',
  '33': 'NH',
  '34': 'NJ',
  '35': 'NM',
  '36': 'NY',
  '37': 'NC',
  '38': 'ND',
  '39': 'OH',
  '40': 'OK',
  '41': 'OR',
  '42': 'PA',
  '44': 'RI',
  '45': 'SC',
  '46': 'SD',
  '47': 'TN',
  '48': 'TX',
  '49': 'UT',
  '50': 'VT',
  '51': 'VA',
  '53': 'WA',
  '54': 'WV',
  '55': 'WI',
  '56': 'WY'
};

const NAMES = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  DC: 'District of Columbia',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming'
};

async function main() {
  const res = await fetch(ATLAS);
  if (!res.ok) throw new Error(`us-atlas fetch ${res.status}`);
  const us = await res.json();
  const pathGen = geoPath();
  const features = topojson.feature(us, us.objects.states).features;
  const mesh = topojson.mesh(us, us.objects.states, (a, b) => a !== b);
  const nation = topojson.merge(us, us.objects.states.geometries);

  const statePaths = features
    .map((feat) => {
      const id = String(feat.id).padStart(2, '0');
      const st = FIPS[id];
      if (!st) return '';
      const d = pathGen(feat);
      if (!d) return '';
      const name = NAMES[st] || st;
      return `    <path class="us-state" data-st="${st}" data-fips="${id}" data-name="${name}" d="${d}"><title>${name}</title></path>`;
    })
    .filter(Boolean)
    .join('\n');

  const nationD = pathGen(nation);
  const meshD = pathGen(mesh);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-62 8 1023 602" role="img" aria-label="Map of the United States. Select a state to narrow your search.">
  <defs>
    <radialGradient id="us-map-glow" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="rgba(59,130,246,0.06)"/>
      <stop offset="70%" stop-color="rgba(59,130,246,0)"/>
    </radialGradient>
  </defs>
  <rect x="-62" y="8" width="1023" height="602" fill="url(#us-map-glow)"/>
  <path class="us-nation" d="${nationD}" fill="rgba(240,244,255,0.7)" stroke="#94A3B8" stroke-width="1"/>
  <g class="us-states" fill="transparent" stroke="none">
${statePaths}
  </g>
  <path class="us-mesh" d="${meshD}" fill="none" stroke="rgba(203,213,225,0.5)" stroke-width="0.4" pointer-events="none"/>
</svg>
`;
  fs.writeFileSync(OUT, svg);
  console.log(`Wrote ${OUT} (${Math.round(svg.length / 1024)} KB, ${features.length} features)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
