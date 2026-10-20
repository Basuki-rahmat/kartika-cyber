const test = require('node:test');
const assert = require('node:assert/strict');
const { detectEvents } = require('../src/detector');

function event(overrides) {
  return {
    id: 'event-1',
    assetId: 'IT-WS-01',
    occurredAt: '2026-10-20T09:00:00.000Z',
    eventType: 'login_success',
    source: '10.20.1.10',
    ...overrides
  };
}

test('detects five failed logins for one account within ten minutes', () => {
  const events = Array.from({ length: 5 }, (_, index) => event({
    id: `login-${index}`,
    account: 'operator',
    eventType: 'login_failed',
    occurredAt: new Date(Date.parse('2026-10-20T09:00:00.000Z') + index * 60_000).toISOString()
  }));

  const alerts = detectEvents(events);

  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].ruleId, 'AUTH-001');
  assert.equal(alerts[0].evidence.length, 5);
});

test('ignores normal events and approved IT-to-OT connections', () => {
  const alerts = detectEvents([
    event(),
    event({ id: 'approved', sourceZone: 'IT', targetZone: 'OT', approved: true })
  ]);

  assert.deepEqual(alerts, []);
});

test('flags unapproved IT-to-OT connections and OT writes outside maintenance', () => {
  const alerts = detectEvents([
    event({ id: 'bridge', sourceZone: 'IT', targetZone: 'OT', approved: false }),
    event({ id: 'write', assetId: 'OT-PLC-01', zone: 'OT', eventType: 'protocol_write' })
  ]);

  assert.deepEqual(alerts.map((alert) => alert.ruleId), ['NET-004', 'OT-007']);
});