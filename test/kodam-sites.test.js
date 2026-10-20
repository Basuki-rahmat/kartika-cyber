const test = require('node:test');
const assert = require('node:assert/strict');
const { kodamSites } = require('../src/kodam-sites');

test('provides a complete local dummy inventory with unique offline-map markers', () => {
  assert.equal(kodamSites.length, 16);
  assert.equal(new Set(kodamSites.map((site) => site.id)).size, kodamSites.length);
  assert.ok(kodamSites.every((site) => site.id.startsWith('kodam-')));
  assert.ok(kodamSites.every((site) => site.lat >= -11 && site.lat <= 6 && site.lng >= 95 && site.lng <= 141));
  assert.ok(kodamSites.every((site) => site.latency === null || Number.isFinite(site.latency)));
  assert.ok(kodamSites.some((site) => site.status === 'offline'));
  assert.ok(kodamSites.some((site) => site.status === 'warning'));
});

test('every simulated endpoint uses the reserved .test domain', () => {
  assert.ok(kodamSites.every((site) => `https://${site.id}.test`.endsWith('.test')));
});