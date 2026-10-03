#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const finale = path.join(root, 'finale');
fs.mkdirSync(finale, { recursive: true });

const downloads = process.env.HOME
  ? [
      [
        path.join(process.env.HOME, 'Downloads', 'OH-Hamilton -DR-Production Results09042026 (4).xlsx'),
        path.join(finale, 'OH-Hamilton-DR-ProductionResults09042026.xlsx')
      ],
      [
        path.join(process.env.HOME, 'Downloads', 'OH-Hamilton -DR-Production Results09042026 (1).xlsx'),
        path.join(finale, 'OH-Hamilton-DR-ProductionResults09042026.xlsx')
      ],
      [
        path.join(process.env.HOME, 'Downloads', 'CT-HartfordCity-DR-ProductionResults09042026.xlsx'),
        path.join(finale, 'CT-HartfordCity-DR-ProductionResults09042026.xlsx')
      ]
    ]
  : [];

let copied = 0;
for (const [from, to] of downloads) {
  if (fs.existsSync(from)) {
    fs.copyFileSync(from, to);
    copied += 1;
    console.log(`copied ${path.basename(from)} → finale/`);
  }
}

const py = path.join(__dirname, 'refresh-finale-samples.py');
if (fs.existsSync(py)) {
  const run = spawnSync('python3', [py], { cwd: root, stdio: 'inherit' });
  if (run.status) process.exit(run.status);
}

console.log(JSON.stringify({ ok: true, copied, finale }, null, 2));
