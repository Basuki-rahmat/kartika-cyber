#!/usr/bin/env node
const fs = require('node:fs');
const s = fs.readFileSync('public/vendor/leaflet/leaflet.css', 'utf8');
const re = /-(?:webkit|moz|ms)-([a-z-]+)\s*:/g;
const skip = new Set(['tap-highlight-color', 'touch-action', 'print-color-adjust', 'filter', 'user-drag']);
let m; const issues = [];
while ((m = re.exec(s))) {
  if (skip.has(m[1])) continue;
  const stdRe = new RegExp('(^|[{;\\s])' + m[1] + '\\s*:');
  if (!stdRe.test(s.slice(Math.max(0, m.index - 500), m.index + 500))) issues.push(m[0].trim());
}
console.log('isue tanpa properti standar:', issues.length);
issues.forEach((i) => console.log(' -', i));
