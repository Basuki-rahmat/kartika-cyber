const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { detectEvents } = require('./detector');

const dataDirectory = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDirectory, { recursive: true });

const database = new DatabaseSync(path.join(dataDirectory, 'garuda-shield.sqlite'));
database.exec(`
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    asset_id TEXT NOT NULL,
    zone TEXT NOT NULL,
    source_zone TEXT,
    target_zone TEXT,
    source TEXT NOT NULL,
    account TEXT,
    event_type TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    approved INTEGER NOT NULL DEFAULT 0,
    maintenance_window INTEGER NOT NULL DEFAULT 0,
    payload TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fingerprint TEXT NOT NULL UNIQUE,
    rule_id TEXT NOT NULL,
    title TEXT NOT NULL,
    severity TEXT NOT NULL,
    recommendation TEXT NOT NULL,
    asset_id TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    evidence TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new'
  );
  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_id INTEGER NOT NULL REFERENCES alerts(id),
    action TEXT NOT NULL,
    actor TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS events_occurred_at_idx ON events(occurred_at);
  CREATE INDEX IF NOT EXISTS alerts_status_idx ON alerts(status);
`);

function toDetectorEvent(row) {
  return {
    id: row.id,
    assetId: row.asset_id,
    zone: row.zone,
    sourceZone: row.source_zone,
    targetZone: row.target_zone,
    source: row.source,
    account: row.account,
    eventType: row.event_type,
    occurredAt: row.occurred_at,
    approved: Boolean(row.approved),
    inMaintenanceWindow: Boolean(row.maintenance_window)
  };
}

function insertEvent(event) {
  database.prepare(`
    INSERT INTO events (id, asset_id, zone, source_zone, target_zone, source, account, event_type, occurred_at, approved, maintenance_window, payload)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    event.id,
    event.assetId,
    event.zone,
    event.sourceZone || null,
    event.targetZone || null,
    event.source,
    event.account || null,
    event.eventType,
    event.occurredAt,
    event.approved ? 1 : 0,
    event.inMaintenanceWindow ? 1 : 0,
    JSON.stringify(event)
  );
}

function refreshAlerts() {
  const events = database.prepare('SELECT * FROM events ORDER BY occurred_at').all().map(toDetectorEvent);
  const insert = database.prepare(`
    INSERT OR IGNORE INTO alerts (fingerprint, rule_id, title, severity, recommendation, asset_id, occurred_at, evidence)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const created = [];

  for (const alert of detectEvents(events)) {
    const result = insert.run(
      alert.fingerprint,
      alert.ruleId,
      alert.title,
      alert.severity,
      alert.recommendation,
      alert.assetId,
      alert.occurredAt,
      JSON.stringify(alert.evidence)
    );

    if (result.changes > 0) created.push(Number(result.lastInsertRowid));
  }

  return created;
}

function loadDemoEvents() {
  const demoEvents = JSON.parse(fs.readFileSync(path.join(dataDirectory, 'demo-events.json'), 'utf8'));
  const insert = database.prepare(`
    INSERT INTO events (id, asset_id, zone, source_zone, target_zone, source, account, event_type, occurred_at, approved, maintenance_window, payload)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  database.exec('BEGIN');
  try {
    for (const event of demoEvents) {
      const seededEvent = {
        ...event,
        occurredAt: new Date(Date.now() - event.minutesAgo * 60_000).toISOString()
      };
      insertEvent(seededEvent);
    }
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }

  refreshAlerts();
}

function getDashboardData(filters = {}) {
  const eventConditions = [];
  const eventParameters = [];

  if (filters.zone && filters.zone !== 'all') {
    eventConditions.push('zone = ?');
    eventParameters.push(filters.zone);
  }
  if (filters.query) {
    eventConditions.push('(asset_id LIKE ? OR source LIKE ? OR event_type LIKE ?)');
    const query = `%${filters.query}%`;
    eventParameters.push(query, query, query);
  }

  const where = eventConditions.length ? `WHERE ${eventConditions.join(' AND ')}` : '';
  const events = database.prepare(`SELECT * FROM events ${where} ORDER BY occurred_at DESC LIMIT 30`).all(...eventParameters);
  const alertConditions = [];
  const alertParameters = [];
  if (filters.severity && filters.severity !== 'all') {
    alertConditions.push('severity = ?');
    alertParameters.push(filters.severity);
  }
  const alertWhere = alertConditions.length ? `WHERE ${alertConditions.join(' AND ')}` : '';
  const alerts = database.prepare(`SELECT * FROM alerts ${alertWhere} ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, occurred_at DESC LIMIT 12`).all(...alertParameters);
  const stats = database.prepare(`
    SELECT
      (SELECT COUNT(*) FROM events) AS event_count,
      (SELECT COUNT(DISTINCT asset_id) FROM events) AS asset_count,
      (SELECT COUNT(*) FROM alerts WHERE status != 'resolved') AS active_alert_count,
      (SELECT COUNT(*) FROM alerts WHERE severity = 'critical' AND status != 'resolved') AS critical_count
  `).get();
  const audit = database.prepare(`
    SELECT audit_log.*, alerts.title AS alert_title
    FROM audit_log JOIN alerts ON alerts.id = audit_log.alert_id
    ORDER BY audit_log.created_at DESC LIMIT 6
  `).all();

  return {
    events: events.map((row) => ({
      id: row.id,
      assetId: row.asset_id,
      zone: row.zone,
      source: row.source,
      account: row.account,
      eventType: row.event_type,
      occurredAt: row.occurred_at
    })),
    alerts: alerts.map((row) => ({
      id: row.id,
      ruleId: row.rule_id,
      title: row.title,
      severity: row.severity,
      recommendation: row.recommendation,
      assetId: row.asset_id,
      occurredAt: row.occurred_at,
      evidence: JSON.parse(row.evidence),
      status: row.status
    })),
    stats,
    audit,
    filters
  };
}

function getAlertsByIds(ids) {
  const unique = [...new Set(ids)].filter((id) => Number.isSafeInteger(id));
  if (unique.length === 0) return [];
  const placeholders = unique.map(() => '?').join(', ');
  return database.prepare(`
    SELECT * FROM alerts WHERE id IN (${placeholders})
    ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, occurred_at DESC
  `).all(...unique).map((row) => ({
    id: row.id,
    ruleId: row.rule_id,
    title: row.title,
    severity: row.severity,
    recommendation: row.recommendation,
    assetId: row.asset_id,
    occurredAt: row.occurred_at,
    evidence: JSON.parse(row.evidence),
    status: row.status
  }));
}

function updateAlertStatus(alertId, status) {
  const validStatuses = ['new', 'acknowledged', 'in_progress', 'resolved'];
  if (!validStatuses.includes(status)) return false;

  const update = database.prepare('UPDATE alerts SET status = ? WHERE id = ?').run(status, alertId);
  if (update.changes === 0) return false;

  database.prepare('INSERT INTO audit_log (alert_id, action, actor, created_at) VALUES (?, ?, ?, ?)')
    .run(alertId, `status:${status}`, 'operator-demo', new Date().toISOString());
  return true;
}

function resetDemo() {
  database.exec('DELETE FROM audit_log; DELETE FROM alerts; DELETE FROM events; DELETE FROM sqlite_sequence WHERE name = \'alerts\';');
  loadDemoEvents();
}

if (database.prepare('SELECT COUNT(*) AS count FROM events').get().count === 0) loadDemoEvents();

module.exports = { database, getAlertsByIds, getDashboardData, insertEvent, refreshAlerts, resetDemo, updateAlertStatus };