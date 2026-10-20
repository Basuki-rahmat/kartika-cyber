const THREAT_INTEL_SOURCES = new Set(['203.0.113.66', '198.51.100.23']);
const KNOWN_ACCOUNT_PATTERN = /^(operator\.|svc-(maint|backup|telemetry))/;
const PORT_SCAN_WINDOW_MS = 5 * 60 * 1000;
const PORT_SCAN_THRESHOLD = 5;

const RULES = {
  failedLogins: {
    id: 'AUTH-001',
    title: 'Lonjakan login gagal',
    severity: 'high',
    recommendation: 'Verifikasi aktivitas akun melalui kanal terpisah dan tinjau kebijakan autentikasi.'
  },
  itToOt: {
    id: 'NET-004',
    title: 'Koneksi baru dari zona IT ke OT',
    severity: 'medium',
    recommendation: 'Konfirmasi pemilik aset dan validasi apakah jalur komunikasi ini sudah disetujui.'
  },
  otWrite: {
    id: 'OT-007',
    title: 'Perintah tulis OT di luar jadwal',
    severity: 'critical',
    recommendation: 'Eskalasi ke operator OT. Validasi perubahan pada lingkungan simulasi sebelum tindakan apa pun.'
  },
  portScan: {
    id: 'IDS-001',
    title: 'Pola pemindaian port (Smart IDS/IPS)',
    severity: 'high',
    recommendation: 'Blokir alamat sumber pada kebijakan IDS/IPS dan tinjau ulang aturan firewall.'
  },
  threatIntel: {
    id: 'TIP-002',
    title: 'Sumber cocok indikator ancaman (Threat Intelligence)',
    severity: 'high',
    recommendation: 'Cocokkan dengan feed intelijen, karantina host terkait, dan perbarui daftar blokir.'
  },
  killChain: {
    id: 'AIR-003',
    title: 'Rantai serangan multi-tahap (Auto-respons)',
    severity: 'critical',
    recommendation: 'Jalankan playbook isolasi otomatis pada segmen OT dan cabut sesi akun terkait.'
  },
  zeroDay: {
    id: 'ZDD-004',
    title: 'Aktivitas tulis aktor tak dikenal (Zero-Day)',
    severity: 'critical',
    recommendation: 'Isolasi aset terdampak, ambil sampel forensik, dan eskalasi ke analis tingkat lanjut.'
  },
  exfil: {
    id: 'ENC-005',
    title: 'Transfer data keluar mencurigakan (Encryption Tool)',
    severity: 'high',
    recommendation: 'Putus sesi keluar, periksa kanal terenkripsi, dan tinjau kebijakan DLP.'
  }
};

function timeOf(event) {
  return new Date(event.occurredAt).getTime();
}

function detectEvents(events) {
  const alerts = [];
  const sortedEvents = [...events].sort((left, right) => timeOf(left) - timeOf(right));
  const loginWindows = new Map();
  const scanWindows = new Map();
  const chain = new Map();

  for (const event of sortedEvents) {
    if (event.eventType === 'login_failed') {
      const key = `${event.assetId}:${event.account || 'unknown'}`;
      const window = loginWindows.get(key) || [];
      const timestamp = timeOf(event);
      const recent = window.filter((entry) => timestamp - entry.timestamp <= 10 * 60 * 1000);
      recent.push({ event, timestamp });
      loginWindows.set(key, recent);

      if (recent.length === 5) {
        alerts.push(makeAlert(RULES.failedLogins, `failed-logins:${key}:${event.occurredAt}`, recent.map((entry) => entry.event)));
      }
    }

    if (event.sourceZone === 'IT' && event.targetZone === 'OT' && event.approved !== true) {
      alerts.push(makeAlert(RULES.itToOt, `it-to-ot:${event.id}`, [event]));
      const state = chain.get(event.assetId) || {};
      state.bridge = event;
      chain.set(event.assetId, state);
    }

    if (event.zone === 'OT' && event.eventType === 'protocol_write' && event.inMaintenanceWindow !== true) {
      alerts.push(makeAlert(RULES.otWrite, `ot-write:${event.id}`, [event]));
      const state = chain.get(event.assetId) || {};
      state.write = event;
      chain.set(event.assetId, state);

      if (event.account && !KNOWN_ACCOUNT_PATTERN.test(event.account)) {
        alerts.push(makeAlert(RULES.zeroDay, `zero-day:${event.id}`, [event]));
      }
    }

    if (event.eventType === 'connection_open') {
      const key = event.source;
      const window = scanWindows.get(key) || [];
      const timestamp = timeOf(event);
      const recent = window.filter((entry) => timestamp - entry.timestamp <= PORT_SCAN_WINDOW_MS);
      recent.push({ event, timestamp });
      scanWindows.set(key, recent);

      if (recent.length === PORT_SCAN_THRESHOLD) {
        alerts.push(makeAlert(RULES.portScan, `port-scan:${key}:${event.occurredAt}`, recent.map((entry) => entry.event)));
      }
    }

    if (THREAT_INTEL_SOURCES.has(event.source)) {
      alerts.push(makeAlert(RULES.threatIntel, `threat-intel:${event.id}`, [event]));
    }

    if (event.eventType === 'bulk_transfer') {
      alerts.push(makeAlert(RULES.exfil, `exfil:${event.id}`, [event]));
    }
  }

  for (const [assetId, state] of chain) {
    if (state.bridge && state.write) {
      const evidence = [state.bridge, state.write].sort((left, right) => timeOf(left) - timeOf(right));
      alerts.push(makeAlert(RULES.killChain, `kill-chain:${assetId}:${state.write.id}`, evidence));
    }
  }

  return alerts;
}

function makeAlert(rule, fingerprint, evidence) {
  const last = evidence[evidence.length - 1];
  return {
    fingerprint,
    ruleId: rule.id,
    title: rule.title,
    severity: rule.severity,
    recommendation: rule.recommendation,
    assetId: last.assetId,
    occurredAt: last.occurredAt,
    evidence: evidence.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      occurredAt: event.occurredAt,
      source: event.source,
      account: event.account || null
    }))
  };
}

module.exports = { detectEvents, RULES, THREAT_INTEL_SOURCES, KNOWN_ACCOUNT_PATTERN };