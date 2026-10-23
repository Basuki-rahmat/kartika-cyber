const path = require('node:path');
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const express = require('express');

try {
  for (const line of fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
} catch (error) {
  // .env belum tersedia — jalankan dengan heuristic lokal.
}
const { kodamSites } = require('./kodam-sites');
const {
  getAlertsByIds,
  getAuditByAlertIds,
  getDashboardData,
  insertEvent,
  refreshAlerts,
  resetDemo,
  updateAlertStatus
} = require('./db');
const { findMethod, listMethods } = require('./threats');
const { trackSources } = require('./geoip');

const app = express();
const port = Number(process.env.PORT) || 3000;
const recentAttacks = new Map();
const analysisCache = new Map();
let activeIncidentId = null;
const attackIdPattern = /^[A-Za-z0-9_-]{6,64}$/;
const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const groqApiKey = process.env.GROQ_API_KEY || '';
const groqModel = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
const groqEndpoint = 'https://api.groq.com/openai/v1/chat/completions';
const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
const severityLabels = { critical: 'kritis', high: 'tinggi', medium: 'sedang', low: 'rendah' };
const eventTypes = new Set([
  'login_success',
  'login_failed',
  'connection_open',
  'protocol_write',
  'telemetry_read',
  'backup_complete',
  'heartbeat'
]);

app.disable('x-powered-by');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: false, limit: '20kb' }));
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/favicon.ico', (request, response) => response.status(204).end());
app.use((request, response, next) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'same-origin');
  response.setHeader('X-Frame-Options', 'DENY');
  next();
});

const conditionLabels = { online: 'NORMAL', warning: 'LATENSI TINGGI', offline: 'TIDAK MERESPONS', maintenance: 'PEMELIHARAAN' };

function buildProbeRows(sites) {
  return sites.map((site) => ({
    id: site.id,
    code: site.code,
    name: site.name,
    city: site.city,
    status: site.status,
    latency: site.latency,
    uptime: site.uptime,
    checkedSeconds: Number.parseInt(site.checked, 10) || 0,
    responseCode: site.status === 'offline' ? 'TIMEOUT' : site.status === 'warning' ? '503' : '200',
    tls: site.status === 'offline' ? '\u2014' : site.status === 'warning' ? 'TLS 1.2' : 'TLS 1.3',
    packetLoss: site.status === 'offline' ? 100 : site.status === 'warning' ? 6 : 0,
    maintenance: site.status === 'maintenance',
    condition: conditionLabels[site.status] || site.status.toUpperCase()
  }));
}

app.get('/', (request, response) => {
  response.render('index', {
    ...getDashboardData(),
    kodamSites,
    probeRows: buildProbeRows(kodamSites),
    totals: {
      sites: kodamSites.length,
      online: kodamSites.filter((site) => site.status === 'online').length,
      attention: kodamSites.filter((site) => ['warning', 'offline'].includes(site.status)).length,
      averageLatency: Math.round(kodamSites.filter((site) => site.latency).reduce((sum, site) => sum + site.latency, 0) / kodamSites.filter((site) => site.latency).length)
    },
    checkedAt: new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date())
  });
});

app.get('/situs-dummy/:siteId', (request, response) => {
  const site = kodamSites.find((item) => item.id === request.params.siteId);
  if (!site) return response.status(404).render('dummy-site', { site: null, attack: null });

  let attack = null;
  for (const record of recentAttacks.values()) {
    if (record.resolved || record.site.id !== site.id) continue;
    if (!attack || record.createdAt > attack.createdAt) attack = record;
  }
  if (attack && attack.createdAt < Date.now() - 1000 * 60 * 60) attack = null;

  return response.render('dummy-site', {
    site,
    attack,
    updatedAt: new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'long',
      timeStyle: 'short'
    }).format(new Date())
  });
});

app.post('/alerts/:id/status', (request, response) => {
  const alertId = Number(request.params.id);
  const status = typeof request.body.status === 'string' ? request.body.status : '';
  if (!Number.isSafeInteger(alertId) || !updateAlertStatus(alertId, status)) {
    return response.status(400).send('Status alert tidak valid.');
  }
  return response.redirect('/#alerts');
});

app.post('/demo/reset', (request, response) => {
  resetDemo();
  response.redirect('/');
});

app.post('/api/events', (request, response) => {
  const input = request.body;
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return response.status(400).json({ error: 'Payload harus berupa objek JSON.' });
  }

  const requiredStrings = ['assetId', 'zone', 'source', 'eventType'];
  if (requiredStrings.some((field) => typeof input[field] !== 'string' || input[field].length === 0 || input[field].length > 100)) {
    return response.status(400).json({ error: 'assetId, zone, source, dan eventType wajib berupa teks maksimal 100 karakter.' });
  }
  if (!['IT', 'OT'].includes(input.zone) || !eventTypes.has(input.eventType)) {
    return response.status(400).json({ error: 'Zona atau jenis event tidak didukung.' });
  }
  if (input.account !== undefined && (typeof input.account !== 'string' || input.account.length > 100)) {
    return response.status(400).json({ error: 'account harus berupa teks maksimal 100 karakter.' });
  }
  if (input.approved !== undefined && typeof input.approved !== 'boolean') {
    return response.status(400).json({ error: 'approved harus berupa boolean.' });
  }
  if (input.inMaintenanceWindow !== undefined && typeof input.inMaintenanceWindow !== 'boolean') {
    return response.status(400).json({ error: 'inMaintenanceWindow harus berupa boolean.' });
  }
  if (input.occurredAt !== undefined && typeof input.occurredAt !== 'string') {
    return response.status(400).json({ error: 'occurredAt harus berupa teks waktu ISO-8601.' });
  }

  const parsedTime = input.occurredAt === undefined ? new Date() : new Date(input.occurredAt);
  if (!Number.isFinite(parsedTime.getTime()) || parsedTime.getTime() > Date.now() + 5 * 60_000) {
    return response.status(400).json({ error: 'occurredAt tidak valid atau terlalu jauh di masa depan.' });
  }
  const occurredAt = parsedTime.toISOString();

  const event = {
    id: randomUUID(),
    assetId: input.assetId,
    zone: input.zone,
    sourceZone: input.sourceZone === 'IT' || input.sourceZone === 'OT' ? input.sourceZone : null,
    targetZone: input.targetZone === 'IT' || input.targetZone === 'OT' ? input.targetZone : null,
    source: input.source,
    account: input.account || null,
    eventType: input.eventType,
    occurredAt,
    approved: input.approved === true,
    inMaintenanceWindow: input.inMaintenanceWindow === true
  };

  try {
    insertEvent(event);
    const createdAlertIds = refreshAlerts();
    return response.status(201).json({ id: event.id, detectedAlertIds: createdAlertIds });
  } catch (error) {
    if (error.code === 'ERR_SQLITE_CONSTRAINT_PRIMARYKEY') {
      return response.status(409).json({ error: 'Event duplikat.' });
    }
    return response.status(400).json({ error: 'Event tidak dapat disimpan.' });
  }
});

app.get('/konsol', (request, response) => {
  response.render('konsol', {
    kodamSites,
    methods: listMethods(),
    checkedAt: new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date())
  });
});

app.get('/perbaikan', (request, response) => {
  const conditionOf = (status) => ({ online: 'NORMAL', warning: 'LATENSI TINGGI', offline: 'TIDAK MERESPONS', maintenance: 'PEMELIHARAAN' }[status] || String(status).toUpperCase());

  /* Kelompokkan situs nyata berdasarkan kondisi yang perlu petunjuk perbaikan. */
  const groups = {
    offline: kodamSites.filter((site) => site.status === 'offline'),
    warning: kodamSites.filter((site) => site.status === 'warning')
  };

  const mapSite = (site) => ({
    id: site.id,
    code: site.code,
    name: site.name,
    city: site.city,
    status: site.status,
    condition: conditionOf(site.status),
    latency: site.latency,
    uptime: site.uptime
  });

  return response.render('perbaikan', {
    groups: {
      offline: groups.offline.map(mapSite),
      warning: groups.warning.map(mapSite)
    },
    checkedAt: new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date())
  });
});

app.post('/api/serangan', (request, response) => {
  const input = request.body;
  if (!input || typeof input !== 'object') {
    return response.status(400).json({ error: 'Payload harus berupa objek JSON.' });
  }

  const site = kodamSites.find((item) => item.id === input.siteId);
  const method = typeof input.methodId === 'string' ? findMethod(input.methodId) : null;
  if (!site || !method) {
    return response.status(400).json({ error: 'Target atau metode serangan tidak dikenali.' });
  }

  const [attackerProfile, attackerError] = buildAttackerProfile(input);
  if (attackerError) return response.status(400).json({ error: attackerError });

  const events = method.build(site, attackerProfile ? attackerProfile.ip : null);
  try {
    for (const event of events) insertEvent(event);
  } catch (error) {
    return response.status(400).json({ error: 'Event serangan tidak dapat disimpan.' });
  }

  const createdIds = refreshAlerts();
  const testIds = new Set(events.map((event) => event.id));
  const detections = getAlertsByIds(createdIds)
    .filter((alert) => alert.evidence.some((item) => testIds.has(item.id)))
    .map((alert) => ({
      id: alert.id,
      ruleId: alert.ruleId,
      title: alert.title,
      severity: alert.severity,
      recommendation: alert.recommendation
    }));

  const attackId = typeof input.attackId === 'string' && attackIdPattern.test(input.attackId)
    ? input.attackId
    : randomUUID();

  const record = {
    id: attackId,
    createdAt: new Date().toISOString(),
    resolved: false,
    site: { id: site.id, name: site.name, code: site.code, city: site.city, lat: site.lat, lng: site.lng },
    method: {
      id: method.id,
      code: method.code,
      name: method.name,
      tagline: method.tagline,
      description: method.description,
      vector: method.vector
    },
    url: `/situs-dummy/${site.id}`,
    window: `https://${site.id}.test`,
    eventCount: events.length,
    sources: [...new Set(events.map((event) => event.source).filter(Boolean))],
    attacker: attackerProfile || null,
    detections,
    responses: method.response
  };

  recentAttacks.set(attackId, record);
  if (recentAttacks.size > 60) recentAttacks.delete(recentAttacks.keys().next().value);
  activeIncidentId = attackId;

  return response.status(201).json(record);
});

app.get('/api/insiden-aktif', (request, response) => {
  const record = activeIncidentId ? recentAttacks.get(activeIncidentId) : null;
  if (!record || record.resolved) {
    return response.json({ active: null });
  }
  return response.json({ active: record });
});

app.post('/api/pulihkan', (request, response) => {
  const input = request.body;
  const attackId = input && typeof input.attackId === 'string' ? input.attackId : '';
  const record = recentAttacks.get(attackId);
  if (!record) {
    return response.status(404).json({ error: 'Data serangan tidak ditemukan.' });
  }
  record.resolved = true;
  if (activeIncidentId === attackId) activeIncidentId = null;
  return response.json({ attackId, resolved: true });
});

app.get('/api/serangan/:id', (request, response) => {
  const record = recentAttacks.get(request.params.id);
  if (!record) {
    return response.status(404).json({ error: 'Data serangan tidak ditemukan atau sudah kedaluwarsa.' });
  }
  return response.json(record);
});

function buildAttackerProfile(input) {
  if (input.attackerIp === undefined && input.attackerLocation === undefined) return [null, null];
  const location = input.attackerLocation;
  if (location !== undefined && (typeof location !== 'object' || location === null || Array.isArray(location))) {
    return [null, 'attackerLocation harus berupa objek profil lokasi.'];
  }
  if (location && input.attackerIp === undefined) {
    return [null, 'attackerLocation hanya boleh dipakai bersama attackerIp.'];
  }
  const ip = typeof input.attackerIp === 'string' ? input.attackerIp : '';
  if (input.attackerIp !== undefined && !ipv4Pattern.test(ip)) {
    return [null, 'attackerIp harus berupa alamat IPv4 yang valid, mis. 103.22.188.7.'];
  }
  const octets = ip.split('.').map(Number);
  if (octets.length === 4 && octets.some((octet) => octet > 255)) {
    return [null, 'Setiap oktet attackerIp harus bernilai 0-255.'];
  }
  if (location) {
    if (typeof location.location !== 'string' || !location.location.trim() || location.location.length > 120) {
      return [null, 'attackerLocation.location wajib berupa teks 1-120 karakter.'];
    }
    const lat = Number(location.lat);
    const lng = Number(location.lng);
    if (location.lat !== undefined && (!Number.isFinite(lat) || lat < -90 || lat > 90)) {
      return [null, 'attackerLocation.lat harus berupa angka antara -90 dan 90.'];
    }
    if (location.lng !== undefined && (!Number.isFinite(lng) || lng < -180 || lng > 180)) {
      return [null, 'attackerLocation.lng harus berupa angka antara -180 dan 180.'];
    }
    if (location.confidence !== undefined && (!Number.isFinite(Number(location.confidence)) || Number(location.confidence) < 0 || Number(location.confidence) > 100)) {
      return [null, 'attackerLocation.confidence harus berupa angka 0-100.'];
    }
    for (const field of ['provider', 'asn', 'countryCode']) {
      if (location[field] !== undefined && (typeof location[field] !== 'string' || location[field].length > 120)) {
        return [null, `attackerLocation.${field} harus berupa teks maksimal 120 karakter.`];
      }
    }
    if (['vpn', 'tor', 'proxy'].some((field) => location[field] !== undefined && typeof location[field] !== 'boolean')) {
      return [null, 'attackerLocation.vpn, tor, dan proxy harus berupa boolean.'];
    }
  }
  return [{ ip, ...(location ? {
    location: location.location.trim(),
    lat: Number.isFinite(location.lat === undefined ? NaN : Number(location.lat)) ? Number(location.lat) : undefined,
    lng: Number.isFinite(location.lng === undefined ? NaN : Number(location.lng)) ? Number(location.lng) : undefined,
    provider: typeof location.provider === 'string' ? location.provider.trim().slice(0, 120) : '',
    asn: typeof location.asn === 'string' ? location.asn.trim().slice(0, 40) : '',
    countryCode: typeof location.countryCode === 'string' ? location.countryCode.trim().slice(0, 3).toUpperCase() : '',
    vpn: location.vpn === true,
    tor: location.tor === true,
    proxy: location.proxy === true,
    confidence: Number(location.confidence)
  } : {}) }, null];
}

function originOverrides(attack) {
  return attack && attack.attacker ? { [attack.attacker.ip]: attack.attacker } : {};
}

function worstSeverity(detections) {  return detections.reduce((worst, detection) => (
    (severityOrder[detection.severity] ?? 9) < (severityOrder[worst] ?? 9) ? detection.severity : worst
  ), 'low');
}

function analyzeLocally(attack) {
  const worst = worstSeverity(attack.detections);
  const criticalCount = attack.detections.filter((detection) => detection.severity === 'critical').length;
  const safe = worst === 'low' || worst === 'medium';
  const actions = attack.detections
    .map((detection) => `${detection.ruleId}: ${detection.recommendation}`)
    .slice(0, 4);
  return {
    source: 'lokal',
    status: safe ? 'aman' : 'perlu_tindakan',
    recovered: safe,
    severity: severityLabels[worst] || 'sedang',
    confidence: 62,
    summary: `Analisis heuristik lokal: metode ${attack.method.name} terhadap ${attack.site.name} memicu ${attack.detections.length} alert (${criticalCount} kritis). ${safe ? 'Tidak ada indikasi kompromi berat, situs dinilai aman.' : 'Perlu tindakan penanganan pada aset terdampak sebelum dinilai aman.'}`,
    actions: actions.length ? actions : attack.responses
  };
}

function normalizeAnalysis(raw) {
  const source = raw && raw.source === 'groq' ? 'groq' : 'lokal';
  const status = raw && raw.status === 'aman' ? 'aman' : 'perlu_tindakan';
  const confidenceNumber = Number(raw && raw.confidence);
  const severity = Object.values(severityLabels).includes(raw && raw.severity) ? raw.severity : 'sedang';
  return {
    source,
    status,
    recovered: typeof (raw && raw.recovered) === 'boolean' ? raw.recovered : status === 'aman',
    severity,
    confidence: Number.isFinite(confidenceNumber) ? Math.max(0, Math.min(100, Math.round(confidenceNumber))) : 70,
    summary: typeof (raw && raw.summary) === 'string' && raw.summary.trim() ? raw.summary.trim().slice(0, 700) : 'Analisis tidak tersedia.',
    actions: Array.isArray(raw && raw.actions)
      ? raw.actions.filter((item) => typeof item === 'string' && item.trim()).slice(0, 6).map((item) => item.trim().slice(0, 220))
      : [],
    attribution: typeof (raw && raw.attribution) === 'string' ? raw.attribution.trim().slice(0, 400) : ''
  };
}

async function analyzeWithGroq(attack, origins) {
  const detectionLines = attack.detections
    .map((detection) => `${detection.ruleId} (${detection.severity}): ${detection.title}`)
    .join('; ');
  const originLines = origins
    .map((origin) => `${origin.ip} -> ${origin.apparentLocation}${origin.vpn ? ' [VPN]' : ''}${origin.tor ? ' [TOR]' : ''}${origin.kind === 'internal' ? ' [INTERNAL]' : ''} (keyakinan ${origin.confidence}%)`)
    .join('; ') || 'tidak ada metadata alamat';
  const systemPrompt = 'Kamu adalah analis pertahanan siber untuk purwarupa GARUDA SHIELD kategori penangkalan. Tugasmu menilai insiden simulasi: apakah situs target AMAN atau BUTUH TINDAKAN, apakah insiden sudah tertangani/pulih, rekomendasi singkat, dan penilaian asal serangan. Balas HANYA JSON valid tanpa markdown dengan skema: {"status":"aman"|"perlu_tindakan","recovered":true|false,"severity":"kritis"|"tinggi"|"sedang"|"rendah","confidence":0-100,"summary":"ringkasan 1-2 kalimat","actions":["langkah singkat","..."],"attribution":"penilaian singkat asal penyerang beserta keterbatasannya"}. Seluruh teks dalam Bahasa Indonesia. Jujur: alamat asli di balik VPN/Tor tidak dapat dipastikan; sampaikan keterbatasan ini.';
  const userPrompt = `Insiden simulasi:\nTarget: ${attack.site.name} (${attack.site.code}), ${attack.site.city}\nMetode: ${attack.method.name} (${attack.method.code}) - vektor ${attack.method.vector}\nDeteksi: ${detectionLines || 'tidak ada'}\nRespons otomatis: ${(attack.responses || []).join('; ') || '-'}\nPelacakan asal (metadata simulasi): ${originLines}`;

  const groqResponse = await fetch(groqEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqApiKey}` },
    body: JSON.stringify({
      model: groqModel,
      temperature: 0.2,
      max_tokens: 700,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    }),
    signal: AbortSignal.timeout(15000)
  });

  if (!groqResponse.ok) throw new Error(`Groq merespons ${groqResponse.status}`);
  const payload = await groqResponse.json();
  const content = payload.choices && payload.choices[0] && payload.choices[0].message ? payload.choices[0].message.content : '';
  return normalizeAnalysis({ ...JSON.parse(content), source: 'groq' });
}

app.post('/api/analisis', async (request, response) => {
  const input = request.body;
  const attackId = input && typeof input.attackId === 'string' ? input.attackId : '';
  const attack = recentAttacks.get(attackId);
  if (!attack) {
    return response.status(404).json({ error: 'Data serangan tidak ditemukan.' });
  }

  const force = Boolean(input && input.force);
  if (!force && analysisCache.has(attackId)) {
    return response.json(analysisCache.get(attackId));
  }

  const origins = trackSources(attack.sources, originOverrides(attack));

  let analysis;
  let note = '';
  if (groqApiKey) {
    try {
      analysis = await analyzeWithGroq(attack, origins);
    } catch (error) {
      analysis = analyzeLocally(attack);
      note = `Groq tidak tersedia (${error.message}); memakai analisis lokal.`;
    }
  } else {
    analysis = analyzeLocally(attack);
    note = 'GROQ_API_KEY belum diisi; memakai analisis lokal.';
  }

  const result = {
    attackId,
    model: analysis.source === 'groq' ? groqModel : 'heuristik-lokal',
    source: analysis.source,
    note,
    createdAt: new Date().toISOString(),
    status: analysis.status,
    recovered: analysis.recovered,
    severity: analysis.severity,
    confidence: analysis.confidence,
    summary: analysis.summary,
    actions: analysis.actions,
    attribution: analysis.attribution,
    origins,
    site: { id: attack.site.id, name: attack.site.name, code: attack.site.code },
    alerts: (attack.detections || []).map((detection) => detection.id)
  };

  analysisCache.set(attackId, result);
  return response.json(result);
});

app.get('/laporan/:attackId', (request, response) => {
  const attackId = request.params.attackId;
  const record = recentAttacks.get(attackId);
  if (!record) {
    return response.status(404).render('laporan', { laporan: null });
  }

  const cached = analysisCache.get(attackId);
  const analysis = cached
    ? { model: cached.model, source: cached.source, status: cached.status, recovered: cached.recovered, severity: cached.severity, confidence: cached.confidence, summary: cached.summary, actions: cached.actions, attribution: cached.attribution, origins: cached.origins, note: cached.note }
    : { ...analyzeLocally(record), model: 'heuristik-lokal', origins: trackSources(record.sources, originOverrides(record)), note: '', attribution: '' };

  const alerts = getAlertsByIds(record.detections.map((detection) => detection.id));
  const audit = getAuditByAlertIds(alerts.map((alert) => alert.id));
  const reportCode = `LPR/${new Date().toISOString().slice(0, 10).replaceAll('-', '')}/${attackId.slice(0, 8).toUpperCase()}`;

  const networkSites = kodamSites.map((site) => ({
    id: site.id,
    code: site.code,
    name: site.name,
    city: site.city,
    status: site.status,
    latency: site.latency,
    uptime: site.uptime,
    underAttack: site.id === record.site.id && !record.resolved,
    wasTarget: site.id === record.site.id
  }));
  const incidents = [...recentAttacks.values()]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((entry) => ({
      id: entry.id,
      createdAt: entry.createdAt,
      site: entry.site,
      method: entry.method,
      eventCount: entry.eventCount,
      resolved: entry.resolved,
      current: entry.id === attackId,
      attacker: entry.attacker ? (entry.attacker.location || entry.attacker.ip || '') : '',
      provider: entry.attacker ? entry.attacker.provider : '',
      vpn: Boolean(entry.attacker && entry.attacker.vpn),
      tor: Boolean(entry.attacker && entry.attacker.tor)
    }));

  return response.render('laporan', {
    laporan: {
      record,
      analysis,
      alerts,
      audit,
      reportCode,
      networkSites,
      incidents,
      createdAt: new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(record.createdAt))
    }
  });
});

app.listen(port, '127.0.0.1', () => {
  console.log(`GARUDA SHIELD berjalan di http://localhost:${port}`);
});