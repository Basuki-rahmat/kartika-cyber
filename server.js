// GARUDA SHIELD LITE - 1 port 3000, Node.js native, low-spec (i7/16GB/VGA 4GB)
// Tanpa DB berat, tanpa build. Run: npm install && npm start
require('dotenv').config();
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const geoip = require('geoip-lite');

const app = express();
const PORT = process.env.PORT || 3000;
const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ---------- DATA DUMMY KODAM (peta) ----------
let sites = [
  { id: 'kodam-im', name: 'Kodam Iskandar Muda', lat: 5.55, lng: 95.32, status: 'UP', isolated: false, localIp: '10.14.1.10', waf: true },
  { id: 'kodam-bb', name: 'Kodam Bukit Barisan', lat: 3.59, lng: 98.67, status: 'UP', isolated: false, localIp: '10.14.2.10', waf: true },
  { id: 'kodam-slw', name: 'Kodam Siliwangi', lat: -6.90, lng: 107.61, status: 'UP', isolated: false, localIp: '10.14.3.10', waf: true },
  { id: 'kodam-dip', name: 'Kodam Diponegoro', lat: -7.00, lng: 110.42, status: 'UP', isolated: false, localIp: '10.14.4.10', waf: true },
  { id: 'kodam-brw', name: 'Kodam Brawijaya', lat: -7.25, lng: 112.75, status: 'UP', isolated: false, localIp: '10.14.5.10', waf: true },
  { id: 'kodam-udayana', name: 'Kodam Udayana', lat: -8.65, lng: 115.21, status: 'UP', isolated: false, localIp: '10.14.6.10', waf: true },
  { id: 'kodam-hasanuddin', name: 'Kodam Hasanuddin', lat: -5.14, lng: 119.42, status: 'UP', isolated: false, localIp: '10.14.7.10', waf: true },
  { id: 'kodam-cenderawasih', name: 'Kodam Cenderawasih', lat: -2.53, lng: 140.71, status: 'UP', isolated: false, localIp: '10.14.8.10', waf: true },
  { id: 'pussansiad', name: 'Pussansiad (Pusat)', lat: -6.23, lng: 106.84, status: 'UP', isolated: false, localIp: '10.14.0.1', waf: true },
  { id: 'kartika-csirt', name: 'Kartika CSIRT', lat: -6.23, lng: 106.85, status: 'UP', isolated: false, localIp: '10.14.0.2', waf: true },
];

let logs = [];
let blockedIPs = new Set();
let rateMap = new Map(); // ip -> {count, resetAt}
let audit = []; // jejak akuntabilitas: siapa memerintah apa
let requests = []; // eskalasi operator → persetujuan komandan (rantai komando)
// Portal per-situs: tiap Kodam punya konten + baseline sendiri → bisa diserang
// dan dipulihkan satu per satu (target skenario bisa dipilih).
const PORTAL_INNER = '<h1>Portal Resmi TNI AD - Situs Dummy</h1><p>Kondisi NORMAL. Kedaulatan siber terjaga.</p>';
let siteWeb = {};
function webInit(id) { siteWeb[id] = { content: PORTAL_INNER, baseline: sha256(PORTAL_INNER), defaced: false }; }
function webLive(id) { return sha256(siteWeb[id].content).slice(0, 12); }
function defacedSites() { return Object.keys(siteWeb).filter(id => siteWeb[id].defaced); }
// MESH TAKTIS (store-and-forward): saat uplink ke Kartika CSIRT putus,
// seluruh peristiwa antre di outbox lokal, lalu tersinkron otomatis saat pulih.
const NODE_ID = process.env.NODE_ID || 'NODE-TAKTIS-01';
let uplinkUp = true;
let outbox = [];
let lastSync = null;
sites.forEach(s => webInit(s.id));

function sha256(s) { return crypto.createHash('sha256').update(s).digest('hex'); }
function nowWIB() { return new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }); }
function addLog(type, ip, detail, siteId = 'pussansiad') {
  const e = { id: Date.now() + Math.random(), time: nowWIB(), type, ip, detail, siteId };
  logs.unshift(e);
  if (logs.length > 200) logs.pop();
  if (!uplinkUp && outbox.length < 500) outbox.push({ kind: 'log', at: e.time, data: e });
}
// Jejak akuntabilitas militer: setiap perintah tercatat siapa–apa–kapan.
function addAudit(actor, action, target, detail) {
  const e = { id: Date.now() + Math.random(), time: nowWIB(), actor, action, target, detail: detail || '' };
  audit.unshift(e);
  if (audit.length > 100) audit.pop();
  if (!uplinkUp && outbox.length < 500) outbox.push({ kind: 'audit', at: e.time, data: e });
}
function drainOutbox(why) {
  const n = outbox.length;
  outbox = [];
  lastSync = nowWIB();
  if (n > 0) {
    logs.unshift({ id: Date.now() + Math.random(), time: lastSync, type: 'Mesh', ip: 'system', detail: `TERSINKRON ke Kartika CSIRT (${why}): ${n} paket peristiwa`, siteId: 'kartika-csirt' });
    if (logs.length > 200) logs.pop();
  }
  return n;
}

// ---------- WAF LITE MIDDLEWARE ----------
const SQLI = [/union\s+select/i, /or\s+1\s*=\s*1/i, /information_schema/i, /sleep\s*\(/i, /drop\s+table/i];
const XSS = [/<script/i, /onerror\s*=/i, /onload\s*=/i, /javascript:/i];
const TRAVERSAL = [/\.\.\//, /etc\/passwd/i];
const WEBSHELL = [/\.php[3457]?(\?|$|["'\s])/i, /\.phtml/i, /\.phar/i, /c99|r57|webshell|pasword/i, /<\?php\s*(system|exec|shell_exec|passthru|eval)/i];

// ---------- KANAL DECEPTION (TACTICAL HONEYPOT) ----------
// Direktori umpan yang tidak pernah ditautkan dari mana pun: pengunjungnya
// pasti pemindai/musuh. Sekali sentuh → sidik jari direkam, IP dikunci permanen.
const HONEYPOT_PATHS = ['/dokumen-rahasia-kodam', '/login-bais', '/admin-backup'];
function roughGeo(ip) {
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip)) return 'JARINGAN DALAM (latihan)';
  if (/^(203\.0\.113\.|198\.51\.100\.|192\.0\.2\.)/.test(ip)) return 'BOGON — simulasi eksternal (perlu lookup Kartika CSIRT)';
  return 'EKSTERNAL — antre lookup geolokasi via uplink';
}
function honeypotTripwire(ip, path, fp) {
  fp = fp || {};
  const a = attribute(ip, [String(fp.ua || 'scanner').slice(0, 60), 'honeypot'], 'Honeypot');
  addLog('Honeypot', ip, `[T1595][${a.id}] Tripwire ${path} tersentuh! Sidik: UA="${String(fp.ua || '-').slice(0, 60)}" | Geo: ${roughGeo(ip)}`);
  if (!blockedIPs.has(ip)) {
    blockedIPs.add(ip);
    addLog('Honeypot', ip, `[T1595] KUNCI PERMANEN — ${ip} dilarang menyentuh server inti`);
    addAudit('SISTEM HONEYPOT (otomatis)', 'KUNCI PERMANEN', ip, `Menyentuh umpan ${path}`);
  }
  return { trapped: true, path };
}

// ---------- MESIN DETEKSI TUNGGAL ----------
// Dipakai oleh 2 jalur: (1) trafik HTTP asli via middleware,
// (2) generator uji taktis via /api/simulate/*.
// Artinya skenario uji dievaluasi MESIN YANG SAMA, bukan log karangan.
function evaluateThreat(ip, raw, opts = {}, fpParts) {
  const fp = fpParts || ['unknown', 'net'];
  if (blockedIPs.has(ip) && !opts.skipBlock) {
    const a0 = attribute(ip, fp, 'Block', opts.siteId);
    addLog('Block', ip, `[${a0.id}] Request dari IP terblokir ditolak`, opts.siteId);
    return { allowed: false, reason: 'BLOCKED_IP', actor: a0.id };
  }
  // rate-limit 60 req/menit (dilewati untuk management plane & otoritas komandan)
  if (!opts.skipRate) {
    const now = Date.now();
    let e = rateMap.get(ip) || { count: 0, resetAt: now + 60000 };
    if (now > e.resetAt) e = { count: 0, resetAt: now + 60000 };
    e.count++;
    rateMap.set(ip, e);
    if (e.count > 60) {
      blockedIPs.add(ip);
      const a1 = attribute(ip, fp, 'DDoS', opts.siteId);
      addLog('DDoS', ip, `[${opts.scenario || 'NET'}][T1498][${a1.id}] Rate-limit terlampaui (${e.count} req/menit) - IP diblokir otomatis`, opts.siteId);
      markSiteDown(opts.siteId || 'pussansiad', opts.scenario || 'NET');
      return { allowed: false, reason: 'DDOS_FLOOD', actor: a1.id };
    }
  }
  if (SQLI.some(r => r.test(raw))) {
    const a = attribute(ip, fp, 'SQLi', opts.siteId);
    addLog('SQLi', ip, `[${opts.scenario || 'NET'}][T1190][${a.id}] Payload SQL Injection diblokir: ${String(raw).slice(0, 100)}`, opts.siteId);
    return { allowed: false, reason: 'SQLI', actor: a.id };
  }
  if (XSS.some(r => r.test(raw))) {
    const a = attribute(ip, fp, 'XSS', opts.siteId);
    addLog('XSS', ip, `[${opts.scenario || 'NET'}][T1189][${a.id}] Payload XSS diblokir: ${String(raw).slice(0, 100)}`, opts.siteId);
    return { allowed: false, reason: 'XSS', actor: a.id };
  }
  if (TRAVERSAL.some(r => r.test(raw))) {
    const a = attribute(ip, fp, 'Traversal', opts.siteId);
    addLog('Traversal', ip, `[${opts.scenario || 'NET'}][T1083][${a.id}] Path traversal diblokir: ${String(raw).slice(0, 100)}`, opts.siteId);
    return { allowed: false, reason: 'TRAVERSAL', actor: a.id };
  }
  if (WEBSHELL.some(r => r.test(raw))) {
    const a = attribute(ip, fp, 'Upload', opts.siteId);
    addLog('Upload', ip, `[${opts.scenario || 'NET'}][T1505][${a.id}] Unggahan webshell diblokir: ${String(raw).slice(0, 100)}`, opts.siteId);
    return { allowed: false, reason: 'WEBSHELL', actor: a.id };
  }
  return { allowed: true, reason: 'ALLOW' };
}

// ---------- PENJAGA OTENTIKASI & PEMINDAIAN ----------
// Satu-satunya jalan menilai S-05/S-06 — dipakai trafik nyata DAN skenario.
let authMap = new Map(); // ip -> {count, resetAt}
function authAttempt(ip, user, fpParts, siteId, scenario) {
  const fp = fpParts || ['unknown', 'net'];
  const now = Date.now();
  let e = authMap.get(ip) || { count: 0, resetAt: now + 60000 };
  if (now > e.resetAt) e = { count: 0, resetAt: now + 60000 };
  e.count++;
  authMap.set(ip, e);
  if (e.count > 5) {
    blockedIPs.add(ip);
    const a = attribute(ip, fp, 'BruteForce', siteId);
    addLog('BruteForce', ip, `[${scenario || 'NET'}][T1110][${a.id}] Semprotan kredensial (${e.count} upaya/menit, user "${String(user).slice(0, 30)}") - IP diblokir`, siteId);
    markSiteDown(siteId || 'pussansiad', scenario || 'NET');
    return { allowed: false, reason: 'BRUTEFORCE', actor: a.id, attempt: e.count };
  }
  return { allowed: true, reason: 'TRY', attempt: e.count };
}
let scanMap = new Map(); // ip -> {count, resetAt, paths:[]}
function scanProbe(ip, path, fpParts, siteId, scenario) {
  const fp = fpParts || ['unknown', 'net'];
  const now = Date.now();
  let e = scanMap.get(ip) || { count: 0, resetAt: now + 120000, paths: [] };
  if (now > e.resetAt) e = { count: 0, resetAt: now + 120000, paths: [] };
  e.count++;
  if (!e.paths.includes(path)) e.paths.push(path);
  scanMap.set(ip, e);
  if (e.count > 10) {
    blockedIPs.add(ip);
    const a = attribute(ip, fp, 'Scan', siteId);
    addLog('Scan', ip, `[${scenario || 'NET'}][T1595][${a.id}] Pemindaian kerentanan (${e.count} jalur samar) - IP diblokir. Contoh: ${e.paths.slice(0, 3).join(', ')}`, siteId);
    markSiteDown(siteId || 'pussansiad', scenario || 'NET');
    return { allowed: false, reason: 'SCANNING', actor: a.id, probes: e.count };
  }
  return { allowed: true, reason: 'PROBE', probes: e.count };
}

// ---------- ATRIBUSI AKTOR & INDIKASI VPN ----------
// Kejujuran taktis: tak ada alat pasif yang bisa melihat IP asli di balik VPN.
// Yang dilakukan mesin: sidik perilaku (UA + bahasa + pola) → SATU aktor walau
// IP berganti. 3 IP satu sidik = indikasi VPN/proxy → blokir serentak.
let actors = new Map();
let actorSeq = 0;
let lastQuarantine = null;
// Geolokasi luring (basis GeoLite, tanpa API key). Jujur: IP latihan/lokal
// memang TIDAK BISA dipetakan — hanya IP publik asli yang ada koordinatnya.
const geoCache = new Map();
function geoLookup(ip) {
  if (geoCache.has(ip)) return geoCache.get(ip);
  let r;
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|127\.)/.test(ip)) {
    r = { label: 'JARINGAN LOKAL (latihan)', ll: null };
  } else if (/^(203\.0\.113\.|198\.51\.100\.|192\.0\.2\.)/.test(ip)) {
    r = { label: 'IP LATIHAN TEST-NET — bukan IP publik, tak dapat dipetakan', ll: null };
  } else {
    try {
      const g = geoip.lookup(ip);
      r = (g && g.ll)
        ? { label: [g.city, g.region, g.country].filter(Boolean).join(', '), ll: g.ll, country: g.country }
        : { label: 'Tidak terdaftar di basis GeoIP', ll: null };
    } catch (e) { r = { label: 'Lookup gagal', ll: null }; }
  }
  geoCache.set(ip, r);
  return r;
}
function gmapsLink(ll) { return `https://www.google.com/maps/search/?api=1&query=${ll[0]},${ll[1]}`; }
function attribute(ip, fpParts, threat, siteId) {
  const fp = crypto.createHash('sha1').update(fpParts.join('|')).digest('hex').slice(0, 10);
  let a = actors.get(fp);
  if (!a) {
    actorSeq++;
    a = { id: 'AKTOR-' + String(actorSeq).padStart(2, '0'), fp, ips: [], firstSeen: nowWIB(), hits: 0, threats: [], quarantined: false };
    actors.set(fp, a);
  }
  if (!a.ips.includes(ip)) {
    if (a.ips.length > 0) addLog('Intel', ip, `[${a.id}][VPN?] GANTI IP ${a.ips[a.ips.length - 1]} → ${ip} — sidik perilaku sama, indikasi VPN/proxy`, siteId);
    a.ips.push(ip);
    if (!a.geo) {
      a.geo = geoLookup(ip);
      if (a.geo.ll) addLog('Intel', ip, `[${a.id}][GEO] Lokasi terpetakan: ${a.geo.label} (${a.geo.ll.join(', ')})`, siteId);
      else addLog('Intel', ip, `[${a.id}][GEO] ${a.geo.label}`, siteId);
    }
  }
  a.hits++;
  if (!a.threats.includes(threat)) a.threats.push(threat);
  if (a.ips.length >= 3 && !a.quarantined) {
    a.quarantined = true;
    a.ips.forEach(x => blockedIPs.add(x));
    addLog('Intel', ip, `[${a.id}][VPN?] SIDIK SAMA di ${a.ips.length} IP — indikasi VPN/proxy. SELURUH IP DIBLOKIR SERENTAK`, siteId);
    addAudit('MESIN ATRIBUSI (otomatis)', 'BLOKIR LINTAS-IP', a.id, a.ips.join(', '));
    if (siteId) markSiteDown(siteId, 'VPN');
    lastQuarantine = a.id;
  }
  return a;
}
let xffSeen = new Set();

app.use((req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
  const raw = JSON.stringify(req.query) + JSON.stringify(req.body) + req.url;
  // Management plane (out-of-band): dashboard, auth, dan laporan TIDAK ikut
  // rate-limit / penolakan IP-blokir agar komando tetap jalan saat serangan.
  // Ini praktik SOC asli. Inspeksi muatan (SQLi/XSS/traversal) TETAP berlaku di semua jalur.
  const EXEMPT = ['/', '/api/status', '/api/logs', '/api/me', '/api/ai-status', '/api/login', '/api/logout', '/api/report', '/api/report.pdf', '/api/analyze-hoaks', '/api/audit', '/api/iocs', '/api/mesh/status', '/api/requests'];
  const token = req.headers['x-token'] || req.query.token;
  const sess = token ? sessions.get(token) : null;
  const isKomandan = sess && sess.role === 'komandan';
  const exempt = EXEMPT.includes(req.path) || req.path.startsWith('/api/simulate/');
  // Konsol sel-merah adalah mekanisme latihan (mendorong trafik sintetis ber-IP
  // bogon ke mesin deteksi), bukan permukaan serangan — ia kebal blokir IP.
  // Umpan honeypot: siapa pun yang menyentuh direktori terlarang langsung didata,
  // walau muatannya akhirnya diblokir WAF sekalipun.
  const isHoney = HONEYPOT_PATHS.some(p => req.path === p || req.path.startsWith(p + '/') || req.path.startsWith(p + '?'));
  const ua = req.headers['user-agent'] || '-';
  const xff = req.headers['x-forwarded-for'];
  if (xff && !xffSeen.has(ip + '|' + xff)) {
    xffSeen.add(ip + '|' + xff);
    const hops = String(xff).split(',').length;
    addLog('Intel', ip, `[VPN?] X-Forwarded-For ${hops} hop (${String(xff).slice(0, 60)}) — indikasi proxy/VPN di depan IP ini`);
  }
  const v = evaluateThreat(ip, raw, { skipRate: exempt || isKomandan, skipBlock: exempt || !!sess }, [ua.slice(0, 80), req.headers['accept-language'] || '-', 'net']);
  if (isHoney) honeypotTripwire(ip, req.path, { ua: req.headers['user-agent'], lang: req.headers['accept-language'] });
  if (!v.allowed) return res.status(v.reason === 'DDOS_FLOOD' ? 429 : 403).send('Blocked by GARUDA SHIELD [' + v.reason + ']');
  next();
});

// ---------- MONITOR INTEGRITAS (deteksi deface beneran, tiap 5 detik) ----------
// Tidak menunggu laporan; hash tiap situs dibandingkan baseline-nya terus-menerus.
setInterval(() => {
  Object.keys(siteWeb).forEach(id => {
    const w = siteWeb[id];
    if (sha256(w.content) !== w.baseline && !w.defaced) {
      w.defaced = true;
      const s = sites.find(x => x.id === id);
      addLog('Defacement', '203.0.113.99', '[S-01][T1491] Integritas berubah! hash tidak cocok baseline - rollback 10 detik', id);
      markSiteDown(id, 'S-01');
      setTimeout(() => {
        w.content = PORTAL_INNER;
        w.defaced = false;
        addLog('Recovery', 'system', 'Auto-rollback: konten pulih, hash kembali cocok baseline', id);
        if (s && !s.isolated) { s.status = 'UP'; s.hitBy = null; }
      }, 10000);
    }
  });
}, 5000);

function markSiteDown(id, sc) {
  const s = sites.find(x => x.id === id);
  if (s) { s.status = 'ATTACK'; if (sc) s.hitBy = sc; }
  setTimeout(() => { if (s && !s.isolated) { s.status = 'UP'; s.hitBy = null; } }, 30000);
}

// ---------- AUTH KOMANDAN / OPERATOR (in-memory, ringan) ----------
const USERS = {
  komandan: { pass: 'garuda123', role: 'komandan', name: 'Komandan' },
  operator: { pass: 'kodam123', role: 'operator', name: 'Operator Kodam' },
};
const sessions = new Map(); // token -> {username, role, name, loginAt}
function getUser(req) {
  const t = req.headers['x-token'] || req.query.token;
  return t ? sessions.get(t) : null;
}
function requireKomandan(req, res, next) {
  const u = getUser(req);
  if (!u) return res.status(401).json({ error: 'Belum login' });
  if (u.role !== 'komandan') return res.status(403).json({ error: 'Hanya KOMANDAN yang boleh. Operator hanya view + lapor.' });
  req.user = u; next();
}
// Tombol merah = sel merah (musuh latihan): bebas menyerang tanpa login.
// Sisi biru (isolasi, reset, blokir, sinkron) tetap kewenangan komando.
function actorOf(req) {
  const u = getUser(req);
  return u ? `${u.name} (${u.role})` : 'SEL MERAH (red-team eksternal)';
}

function requireLogin(req, res, next) {
  const u = getUser(req);
  if (!u) return res.status(401).json({ error: 'Harus login untuk melihat data ini' });
  req.user = u; next();
}

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const u = USERS[(username || '').toLowerCase()];
  if (!u || u.pass !== password) return res.status(401).json({ error: 'Username / password salah' });
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, { username: username.toLowerCase(), role: u.role, name: u.name, loginAt: nowWIB() });
  addLog('Login', req.ip, `${u.name} (${u.role}) login`);
  addAudit(`${u.name} (${u.role})`, 'LOGIN', '-', 'Masuk konsol komando');
  res.json({ ok: true, token, role: u.role, name: u.name });
});
app.post('/api/logout', (req, res) => {
  const t = req.headers['x-token'];
  const u = t ? sessions.get(t) : null;
  if (u) addAudit(`${u.name} (${u.role})`, 'LOGOUT', '-', 'Keluar konsol komando');
  if (t) sessions.delete(t);
  res.json({ ok: true });
});
app.get('/api/me', (req, res) => {
  const u = getUser(req);
  res.json(u ? { login: true, ...u } : { login: false });
});
app.get('/api/audit', requireLogin, (req, res) => {
  res.json(audit.slice(0, 50));
});

// ESKALASI: operator (mata di lapangan) mengajukan, komandan (otoritas) memutuskan.
// Operator TIDAK PERNAH bisa mengeksekusi isolasi langsung — pemisahan tugas.
app.post('/api/requests', requireLogin, (req, res) => {
  if (req.user.role !== 'operator') return res.status(403).json({ error: 'Komandan mengeksekusi langsung, tidak perlu mengajukan' });
  const s = sites.find(x => x.id === req.body.siteId);
  if (!s) return res.status(404).json({ error: 'Situs tidak dikenal' });
  if (requests.some(r => r.siteId === s.id && r.status === 'PENDING')) return res.status(409).json({ error: 'Sudah ada pengajuan pending untuk situs ini' });
  const r = { id: 'REQ-' + Date.now().toString(36).toUpperCase(), time: nowWIB(), by: `${req.user.name} (${req.user.role})`, siteId: s.id, site: s.name, reason: String(req.body.reason || '-').slice(0, 200), status: 'PENDING' };
  requests.unshift(r);
  addAudit(r.by, 'AJUKAN ISOLASI', s.name, r.reason);
  res.json({ ok: true, req: r });
});
app.get('/api/requests', requireLogin, (req, res) => {
  res.json(requests.slice(0, 20));
});
app.post('/api/requests/:id/approve', requireKomandan, (req, res) => {
  const r = requests.find(x => x.id === req.params.id);
  if (!r || r.status !== 'PENDING') return res.status(404).json({ error: 'Pengajuan tidak ditemukan / sudah diproses' });
  const s = sites.find(x => x.id === r.siteId);
  if (s) { s.isolated = true; s.status = 'ISOLATED'; addLog('Isolasi', 'komandan', `${s.name} diisolasi — disetujui dari ${r.id}`); }
  r.status = 'DISETUJUI';
  r.decidedBy = `${req.user.name} (${req.user.role})`;
  addAudit(r.decidedBy, 'SETUJUI ' + r.id, r.site, `Pengaju: ${r.by} — "${r.reason}"`);
  res.json({ ok: true });
});
app.post('/api/requests/:id/reject', requireKomandan, (req, res) => {
  const r = requests.find(x => x.id === req.params.id);
  if (!r || r.status !== 'PENDING') return res.status(404).json({ error: 'Pengajuan tidak ditemukan / sudah diproses' });
  r.status = 'DITOLAK';
  r.decidedBy = `${req.user.name} (${req.user.role})`;
  addAudit(r.decidedBy, 'TOLAK ' + r.id, r.site, `Pengaju: ${r.by} — "${r.reason}"`);
  res.json({ ok: true });
});

// MESH NODE TAKTIS — pos bawah tetap bertempur saat uplink putus
app.get('/api/mesh/status', (req, res) => {
  res.json({ nodeId: NODE_ID, uplinkUp, outbox: outbox.length, lastSync, mode: uplinkUp ? 'TERSAMBUNG — sinkron real-time' : 'MANDIRI — antre lokal, siap sinkron' });
});
app.post('/api/mesh/uplink', requireKomandan, (req, res) => {
  uplinkUp = !!req.body.up;
  addAudit(`${req.user.name} (${req.user.role})`, uplinkUp ? 'UPLINK PULIH' : 'UPLINK PUTUS (SIMULASI)', 'Satelit Kartika CSIRT', uplinkUp ? 'Node kembali tersambung' : 'Node beralih ke mode mandiri taktis');
  let synced = 0;
  if (uplinkUp) synced = drainOutbox('uplink pulih');
  res.json({ ok: true, uplinkUp, synced });
});
app.post('/api/mesh/sync', requireKomandan, (req, res) => {
  if (!uplinkUp) return res.status(409).json({ error: 'Uplink putus — paket tetap antre aman di node lokal' });
  const synced = drainOutbox('manual');
  addAudit(`${req.user.name} (${req.user.role})`, 'SINKRON MANUAL', 'Kartika CSIRT', `${synced} paket`);
  res.json({ ok: true, synced, lastSync });
});

// ---------- ROUTES ----------
function portalChrome(inner, hacked, siteName, hash) {
  const theme = hacked
    ? { bg: '#120606', head: '#7f1d1d', gold: '#ef4444', card: '#2a0d0d', txt: '#fecaca', sub: '#fca5a5' }
    : { bg: '#0a0f0d', head: '#0b3d2e', gold: '#d4af37', card: '#101815', txt: '#e7ece9', sub: '#9fb3a8' };
  const t = theme;
  return `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Portal ${siteName} - TNI AD</title>
<style>*{box-sizing:border-box}body{margin:0;font-family:'Segoe UI',Arial,sans-serif;background:${t.bg};color:${t.txt}}
.topbar{background:#050807;color:${t.sub};font-size:12px;padding:6px 24px;display:flex;justify-content:space-between}
header{background:linear-gradient(120deg,${t.head},#050807 70%);padding:18px 24px;display:flex;gap:14px;align-items:center;border-bottom:3px solid ${t.gold}}
.star{width:52px;height:52px;border-radius:50%;background:radial-gradient(circle at 35% 35%,${t.gold},#7a5c14);display:flex;align-items:center;justify-content:center;font-size:28px;color:#0a0f0d;font-weight:bold}
nav{background:#050807;padding:0 24px;display:flex;gap:4px;flex-wrap:wrap;border-bottom:1px solid #1e2a24}
nav a{color:${t.sub};text-decoration:none;font-size:13px;font-weight:bold;padding:12px 14px;letter-spacing:.5px}
nav a.on,nav a:hover{color:${t.gold};border-bottom:3px solid ${t.gold}}
.hero{margin:20px 24px;border-radius:14px;padding:34px 28px;background:linear-gradient(100deg,rgba(11,61,46,.92),rgba(5,8,7,.4)),repeating-linear-gradient(45deg,#0d1512 0 18px,#0a0f0d 18px 36px);border:1px solid #1e2a24}
.hero h1{margin:0 0 8px;font-size:30px;letter-spacing:1px}
.hero h1 span{color:${t.gold}}
.hero p{margin:0 0 14px;color:${t.sub};max-width:640px}
.btn{display:inline-block;background:${t.gold};color:#0a0f0d;font-weight:bold;font-size:13px;padding:10px 20px;border-radius:8px;text-decoration:none;margin-right:8px}
.btn.ghost{background:transparent;color:${t.gold};border:1px solid ${t.gold}}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin:0 24px 20px}
.stat{background:${t.card};border:1px solid #1e2a24;border-top:3px solid ${t.gold};border-radius:10px;padding:14px;text-align:center}
.stat b{font-size:24px;color:${t.gold}}
.stat small{color:${t.sub}}
.grid2{display:grid;grid-template-columns:2fr 1fr;gap:12px;margin:0 24px 20px}
@media(max-width:700px){.grid2{grid-template-columns:1fr}.hero h1{font-size:22px}}
.card{background:${t.card};border:1px solid #1e2a24;border-radius:12px;padding:18px}
.card h3{margin:0 0 4px;color:${t.gold};font-size:13px;letter-spacing:1px}
.news{display:flex;gap:12px;margin-top:12px;padding-top:12px;border-top:1px solid #1e2a24}
.thumb{width:86px;height:64px;border-radius:8px;flex:none;background:linear-gradient(135deg,${t.head},#050807);display:flex;align-items:center;justify-content:center;font-size:26px}
.news b{font-size:14px}
.news small{color:${t.sub}}
.tag{display:inline-block;font-size:10px;font-weight:bold;background:${t.gold};color:#0a0f0d;border-radius:4px;padding:2px 8px;margin-bottom:6px}
.ag li{margin-bottom:10px;font-size:13px;list-style:none}
.ag ul{padding:0;margin:10px 0 0}
.ag .d{color:${t.gold};font-weight:bold}
footer{background:#050807;border-top:3px solid ${t.gold};margin-top:8px;padding:22px 24px;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;font-size:12px;color:${t.sub}}
footer b{color:${t.txt}}
.shield{position:fixed;right:14px;bottom:12px;background:#050807;border:1px solid ${t.gold};color:${t.gold};font-size:11px;border-radius:20px;padding:6px 14px;font-family:monospace}</style></head><body>
<div class="topbar"><span id="tgl">PORTAL RESMI SATUAN TNI AD</span><span>☎ Hotline Siber: 0821-2316-7076 • kartikacsirt@tni-ad.mil.id</span></div>
<header><div class="star">★</div><div><div style="font-size:20px;font-weight:800;letter-spacing:1px">PORTAL ${siteName}</div><div style="font-size:12px;color:${t.sub}">TENTARA NASIONAL INDONESIA ANGKATAN DARAT • KARTIKA EKA PAKSI</div></div></header>
<nav><a class="on" href="#">BERANDA</a><a href="#">PROFIL</a><a href="#">SATUAN</a><a href="#">BERITA</a><a href="#">LAYANAN</a><a href="#">KONTAK</a><a href="#masuk" style="color:#d4af37">🔒 MASUK</a></nav>
${inner}
<footer><div><b>MARKAS ${siteName}</b><br>Jl. Merdeka Selatan No. 1<br>Jakarta Pusat 10110</div><div><b>TAUTAN RESMI</b><br>tni.mil.id<br>tniad.mil.id<br>kartikacsirt.tni-ad.mil.id</div><div><b>INTEGRITAS SISTEM</b><br>Diawasi GARUDA SHIELD<br>Hash: <span style="font-family:monospace">${hash}</span></div></footer>
<div class="shield">🛡️ GARUDA SHIELD ACTIVE</div>
<script>document.getElementById('tgl').textContent = new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).toUpperCase() + ' — PORTAL RESMI SATUAN TNI AD';</script></body></html>`;
}
app.get('/situs-dummy', (req, res) => {
  const id = sites.some(s => s.id === req.query.site) ? req.query.site : 'pussansiad';
  const s = sites.find(x => x.id === id);
  const w = siteWeb[id];
  const body = w.defaced
    ? `<div class="hero"><h1><span>⚠ HACKED BY RED-TEAM</span></h1><p>Situs ini telah diambil alih dalam rangka uji taktis S-01. Tim siber sedang memulihkan.</p><span class="btn">DALAM PEMULIHAN…</span></div>`
    : `<div class="hero"><h1>MENGABDI UNTUK <span>NEGERI</span>, SETIA SAMPAI <span>MATI</span></h1><p>Portal layanan digital ${s.name} — informasi satuan, berita kegiatan, dan layanan personel dalam satu genggaman.</p><a class="btn" href="#">LAYANAN PERSONEL</a><a class="btn ghost" href="#">PROFIL SATUAN</a></div>
<div class="stats"><div class="stat"><b>312Rb+</b><br><small>Prajurit Aktif</small></div><div class="stat"><b>15</b><br><small>Kodam & Balakpus</small></div><div class="stat"><b>98%</b><br><small>Kesiapan Alutsista</small></div><div class="stat"><b>24/7</b><br><small>Siaga Siber</small></div></div>
<div class="grid2"><div class="card"><h3>■ BERITA SATUAN TERKINI</h3>
<div class="news"><div class="thumb">🎖️</div><div><span class="tag">LATIHAN</span><br><b>Latihan Gabungan Kartika Yudha 2026 digelar di tiga Kodam</b><br><small>2 jam lalu • Penerangan ${s.name}</small></div></div>
<div class="news"><div class="thumb">🛡️</div><div><span class="tag">SIBER</span><br><b>Kartika CSIRT gagalkan 1.200 upaya intrusi pekan ini</b><br><small>5 jam lalu • Pussansiad</small></div></div>
<div class="news"><div class="thumb">🤝</div><div><span class="tag">SOSIAL</span><br><b>TMMD ke-124 bangun 42 titik infrastruktur desa</b><br><small>kemarin • Staf Teritorial</small></div></div></div>
<div class="card ag"><h3>■ AGENDA & PENGUMUMAN</h3><ul>
<li><span class="d">SENIN</span> — Apel gabungan kesiapsiagaan satuan</li>
<li><span class="d">RABU</span> — Simulasi tanggap insiden siber Kodam</li>
<li><span class="d">JUMAT</span> — Bakti sosial dan donor darah serentak</li></ul>
<div class="card" style="margin-top:12px"><h3>■ SERUAN KOMANDO</h3><small>Waspadai forward-an hoaks mengatasnamakan satuan. Verifikasi selalu ke Penerangan resmi sebelum meneruskan.</small></div></div></div>
<div class="card" id="masuk" style="margin:0 24px 20px"><h3>■ MASUK PERSONEL — AREA TERBATAS</h3><small>Seluruh upaya masuk dicatat dan dinilai risikonya oleh GARUDA SHIELD.</small>
<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><input id="nrp" placeholder="NRP" style="flex:1;min-width:140px;padding:9px;border-radius:8px;border:1px solid #1e2a24;background:#0a0f0d;color:#e7ece9"><input id="ks" type="password" placeholder="Kata sandi" style="flex:1;min-width:140px;padding:9px;border-radius:8px;border:1px solid #1e2a24;background:#0a0f0d;color:#e7ece9"><button onclick="masuk()" style="padding:9px 22px;border-radius:8px;border:0;background:#d4af37;color:#0a0f0d;font-weight:bold;cursor:pointer">MASUK</button></div>
<p id="msg" style="font-size:13px"></p>
<div id="arsip" style="display:none;margin-top:8px;font-size:13px">Unduh arsip (butuh sesi bersih):<br>
<button onclick="dl('renops-2026.pdf')" style="margin:4px 4px 0 0;padding:7px 14px;border-radius:8px;border:1px solid #d4af37;background:transparent;color:#d4af37;cursor:pointer">renops-2026.pdf</button>
<button onclick="dl('daftar-personel.xlsx')" style="margin:4px 4px 0 0;padding:7px 14px;border-radius:8px;border:1px solid #d4af37;background:transparent;color:#d4af37;cursor:pointer">daftar-personel.xlsx</button>
<button onclick="dl('peta-gelar.pdf')" style="margin:4px 4px 0 0;padding:7px 14px;border-radius:8px;border:1px solid #d4af37;background:transparent;color:#d4af37;cursor:pointer">peta-gelar.pdf</button>
<p id="dlmsg" style="font-size:12px"></p></div></div>
<script>let PTOK=null;async function masuk(){const m=document.getElementById('msg');m.textContent='Memeriksa…';try{const r=await fetch('/masuk',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({u:document.getElementById('nrp').value,p:document.getElementById('ks').value})});const j=await r.json();m.style.color=j.ok?(j.restricted?'#fbbf24':'#4ade80'):'#f87171';m.textContent=(j.ok?'✔ ':'✖ ')+j.msg+(j.restricted?' Skor risiko: '+j.risk+'.':'');if(j.ok&&j.token){PTOK=j.token;document.getElementById('arsip').style.display='block';}}catch(e){m.textContent='Jaringan terputus.';}}async function dl(f){const m=document.getElementById('dlmsg');try{const r=await fetch('/arsip/'+f,{headers:{'x-portal':PTOK}});const t=await r.text();m.style.color=r.ok?'#4ade80':'#f87171';m.textContent=(r.ok?'✔ ':'✖ '+r.status+' ')+t.slice(0,140);}catch(e){m.textContent='Jaringan terputus.';}}</script>`;
  res.send(portalChrome(body, w.defaced, s.name.toUpperCase(), sha256(w.content).slice(0, 12)));
});

// Halaman umpan — tampak meyakinkan bagi pemindai, tak bertuan bagi personel.
app.get('/dokumen-rahasia-kodam', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Arsip - TERBATAS</title></head><body style="font-family:monospace;background:#0b0f14;color:#cbd5e1;padding:32px">
<h3>ARSIP INTERNAL KODAM [TERBATAS]</h3><p>Index of /dokumen-rahasia-kodam/</p><hr>
<p><a href="/dokumen-rahasia-kodam/renops-2026.pdf" style="color:#7dd3fc">renops-2026.pdf</a> — 2,4 MB</p>
<p><a href="/dokumen-rahasia-kodam/daftar-personel.xlsx" style="color:#7dd3fc">daftar-personel.xlsx</a> — 890 KB</p>
<p><a href="/dokumen-rahasia-kodam/peta-gelar.pdf" style="color:#7dd3fc">peta-gelar.pdf</a> — 5,1 MB</p>
<hr><small>akses dicatat satuan siber</small></body></html>`);
});
app.get('/login-bais', (req, res) => {
  res.send(`<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><title>Portal Masuk Personel</title></head><body style="font-family:sans-serif;background:#0f172a;color:#e2e8f0;display:flex;justify-content:center;padding-top:80px">
<form method="POST" action="/login-bais" style="background:#1e293b;padding:28px;border-radius:12px;width:300px">
<h3 style="margin-top:0">MASUK PERSONEL</h3>
<p style="font-size:12px;color:#94a3b8">Otentikasi ganda dinonaktifkan sementara (pemeliharaan).</p>
<input name="u" placeholder="NRP / username" style="width:100%;margin-bottom:8px;padding:8px"><br>
<input name="p" type="password" placeholder="Kata sandi" style="width:100%;margin-bottom:12px;padding:8px"><br>
<button style="width:100%;padding:10px;background:#166534;color:#fff;border:0;border-radius:8px">MASUK</button></form></body></html>`);
});
app.post('/login-bais', (req, res) => {
  const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
  const u = String((req.body && (req.body.u || req.body.username)) || '-').slice(0, 40);
  const chk = authAttempt(ip, u, [req.headers['user-agent'] || '-', 'honeypot'], undefined, 'NET');
  if (!chk.allowed) return res.status(403).send('Terlalu banyak upaya masuk - IP diblokir [BRUTEFORCE]');
  addLog('Honeypot', ip, `[T1078] Kredensial umpan ditangkap: "${u}" / *** — akun tidak pernah ada, penyerang teridentifikasi`);
  honeypotTripwire(ip, '/login-bais', { ua: req.headers['user-agent'] });
  res.send('<p style="font-family:sans-serif">NRP atau kata sandi salah. Sisa percobaan: 2.</p>');
});
app.get('/admin-backup', (req, res) => {
  res.status(200).send('<pre style="background:#000;color:#4ade80;padding:24px">phpMyAdmin 4.8.1 — backup node\n#2002 - No such file or directory — retrying…</pre>');
});

let alarmArmed = true;
let lastAlarmAt = null;
let alarmLog = [];

app.get('/api/alarm', (req, res) => {
  res.json({ armed: alarmArmed, lastAlarmAt, recent: alarmLog.slice(-10) });
});

app.post('/api/alarm/toggle', (req, res) => {
  alarmArmed = !alarmArmed;
  addAudit('KONSOL KOMANDAN', alarmArmed ? 'ALARM AKTIF' : 'ALARM NONAKTIF', '-', 'Alarm ' + (alarmArmed ? 'diaktifkan' : 'dinonaktifkan'));
  res.json({ ok: true, armed: alarmArmed });
});

app.get('/api/status', (req, res) => {
  const up = sites.filter(s => s.status === 'UP').length;
  const minute = new Date().getMinutes();
  const enriched = sites.map((s, i) => ({
    ...s,
    cpu: Math.min(98, 18 + ((i * 7 + minute) % 15) + (s.status !== 'UP' ? 45 : 0)),
    ram: Math.min(96, 30 + ((i * 11 + minute) % 12) + (s.status !== 'UP' ? 25 : 0)),
    defaced: !!siteWeb[s.id].defaced,
    live: webLive(s.id),
  }));
  const ds = defacedSites();
  res.json({
    sites: enriched,
    stats: {
      total: sites.length, up, down: sites.length - up,
      blocked: blockedIPs.size, attacksToday: logs.length,
      defaced: ds.length > 0, defacedSites: ds,
      baseline: siteWeb.pussansiad.baseline.slice(0, 12), live: webLive('pussansiad'),
    }
  });
});

app.get('/api/logs', (req, res) => {
  res.json(logs.slice(0, parseInt(req.query.limit || '50')));
});

// IOC (Indicators of Compromise) — dirangkum dari log mesin + status, khusus personel login
app.get('/api/iocs', requireLogin, (req, res) => {
  const byIp = {};
  logs.forEach(l => {
    if (!l.ip || l.ip === 'system' || l.ip === 'komandan') return;
    byIp[l.ip] = byIp[l.ip] || { ip: l.ip, count: 0, firstSeen: l.time, lastSeen: l.time, reasons: new Set() };
    byIp[l.ip].count++;
    byIp[l.ip].lastSeen = byIp[l.ip].lastSeen || l.time;
    byIp[l.ip].reasons.add(l.type);
  });
  Object.values(byIp).forEach(o => {
    o.reasons = [...o.reasons]; o.blocked = blockedIPs.has(o.ip);
    const a = [...actors.values()].find(x => x.ips.includes(o.ip));
    o.actor = a ? a.id : '-'; o.vpn = a ? a.ips.length > 1 : false;
    const g = geoLookup(o.ip);
    o.geo = g.label; o.ll = g.ll; o.gmaps = g.ll ? gmapsLink(g.ll) : null;
  });
  const patterns = {};
  logs.forEach(l => {
    const m = String(l.detail).match(/\[(T\d+)\]/);
    const k = m ? `${l.type} ${m[1]}` : l.type;
    patterns[k] = patterns[k] || { pattern: k, count: 0, example: '' };
    patterns[k].count++;
    if (!patterns[k].example) patterns[k].example = String(l.detail).slice(0, 100);
  });
  res.json({
    ips: Object.values(byIp).sort((a, b) => b.count - a.count),
    actors: [...actors.values()].map(a => ({ id: a.id, ips: a.ips, hits: a.hits, threats: a.threats, vpn: a.ips.length > 1, quarantined: !!a.quarantined, firstSeen: a.firstSeen, geo: a.geo ? a.geo.label : '-', ll: a.geo ? a.geo.ll : null, gmaps: a.geo && a.geo.ll ? gmapsLink(a.geo.ll) : null })),
    hashes: [{ hash: siteWeb.pussansiad.baseline.slice(0, 16) + '…', status: 'BASELINE', note: 'Acuan integritas portal' },
      ...defacedSites().map(id => ({ hash: webLive(id), status: 'TERCEMAR', note: `${id} menyimpang — rollback berjalan` }))],
    payloads: Object.values(patterns).sort((a, b) => b.count - a.count),
    generatedAt: nowWIB(),
  });
});

// UJI TAKTIS — sel merah bebas menyerang target mana pun (siteId), dengan atau
// tanpa VPN (rotasi IP, sidik sama). DETEKSI tetap milik mesin, bukan karangan.
function pickSite(req) {
  const id = req.body && req.body.siteId;
  return sites.some(s => s.id === id) ? id : 'pussansiad';
}
function siteName(id) { const s = sites.find(x => x.id === id); return s ? s.name : id; }
app.post('/api/simulate/deface', (req, res) => {
  // Red-team: merusak konten (seperti deface asli). DETEKSI dilakukan monitor, bukan di sini.
  const target = pickSite(req);
  siteWeb[target].content = '<h1 style="color:red">HACKED BY RED-TEAM</h1><p>Uji taktis S-01: perusakan tampilan situs.</p>';
  addAudit(actorOf(req), 'SERANGAN S-01', siteName(target), 'Defacement oleh sel merah');
  res.json({ ok: true, scenario: 'S-01', target, msg: `Muatan S-01 disuntikkan ke ${siteName(target)}. Monitor integritas mendeteksi <5 detik, rollback 10 detik.` });
});

app.post('/api/simulate/sqli', (req, res) => {
  // Red-team: 3 muatan injeksi ASLI dilewatkan ke MESIN DETEKSI yang sama dengan trafik nyata.
  const target = pickSite(req);
  const viaVpn = !!(req.body && req.body.viaVpn);
  const ips = viaVpn ? ['198.51.100.23', '198.51.100.87', '198.51.100.201'] : ['198.51.100.23'];
  const fp = viaVpn ? ['RedTeam/1.0 (VPN sim)', 'id-ID', 'S-02'] : ['RedTeam/1.0', 'id-ID', 'S-02'];
  const payloads = [
    '/situs-dummy?id=1 UNION SELECT password FROM users--',
    '/situs-dummy?q=<script>alert(1)</script>',
    '/situs-dummy?f=../../etc/passwd',
  ];
  const verdicts = [];
  ips.forEach(attacker => payloads.forEach(p => verdicts.push({ attacker, payload: p, ...evaluateThreat(attacker, p, { siteId: target, scenario: 'S-02' }, fp) })));
  markSiteDown(target, 'S-02');
  addAudit(actorOf(req), 'SERANGAN S-02', siteName(target), `Injeksi web oleh sel merah${viaVpn ? ' via VPN (rotasi 3 IP, 9 muatan)' : ' (3 muatan)'}`);
  const q = lastQuarantine; lastQuarantine = null;
  res.json({ ok: true, scenario: 'S-02', target, attacker: ips, viaVpn, verdicts, quarantined: q });
});

app.post('/api/simulate/ddos', (req, res) => {
  // Red-team: banjir ke MESIN rate-limit ASLI. Mode VPN = rotasi 3 IP (25 request
  // per IP, lolos limiter per-IP) → ditangkap MESIN ATRIBUSI lintas-IP.
  const target = pickSite(req);
  const viaVpn = !!(req.body && req.body.viaVpn);
  const ips = viaVpn ? ['192.0.2.44', '192.0.2.71', '192.0.2.132'] : ['192.0.2.44'];
  const fp = viaVpn ? ['RedTeam/1.0 (VPN sim)', 'id-ID', 'S-03'] : ['RedTeam/1.0', 'id-ID', 'S-03'];
  const perIp = viaVpn ? 25 : 75;
  let blockedAtRequest = null, total = 0;
  for (let i = 1; i <= perIp; i++) {
    for (const attacker of ips) {
      total++;
      const v = evaluateThreat(attacker, '/situs-dummy?burst=' + i, { siteId: target, scenario: 'S-03' }, fp);
      if (!v.allowed && blockedAtRequest === null) blockedAtRequest = total;
    }
  }
  markSiteDown(target, 'S-03');
  addAudit(actorOf(req), 'SERANGAN S-03', siteName(target), `Banjir trafik oleh sel merah${viaVpn ? ' via VPN' : ''} (putus di #${blockedAtRequest})`);
  const q = lastQuarantine; lastQuarantine = null;
  res.json({ ok: true, scenario: 'S-03', target, attacker: ips, viaVpn, requests: total, blockedAtRequest, quarantined: q });
});

app.post('/api/simulate/honeypot', (req, res) => {
  // Red-team S-04: pemindai musuh menyentuh 3 umpan + mencoba 1 kredensial curian.
  const target = pickSite(req);
  const ip = '203.0.113.77';
  const probes = ['/dokumen-rahasia-kodam/daftar-personel.xlsx', '/login-bais', '/admin-backup'];
  const trail = probes.map(p => {
    const v = evaluateThreat(ip, 'GET ' + p, { siteId: target, scenario: 'S-04' }, ['Nmap/7.94 (red-team latihan)', 'S-04']);
    const t = honeypotTripwire(ip, p, { ua: 'Nmap/7.94 (red-team latihan)' });
    return { probe: p, verdict: v.reason, trapped: t.trapped };
  });
  evaluateThreat(ip, 'POST /login-bais u=admin p=kodam123', { siteId: target, scenario: 'S-04' }, ['Nmap/7.94 (red-team latihan)', 'S-04']);
  addLog('Honeypot', ip, '[S-04][T1078] Kredensial umpan ditangkap: "admin" / *** — penyerang teridentifikasi', target);
  honeypotTripwire(ip, '/login-bais', { ua: 'Nmap/7.94 (red-team latihan)' });
  markSiteDown(target, 'S-04');
  addAudit(actorOf(req), 'SERANGAN S-04', siteName(target), 'Pemindaian sel merah (3 umpan + 1 kredensial)');
  res.json({ ok: true, scenario: 'S-04', target, attacker: [ip], trail });
});

// S-05 SEMPROTAN KREDENSIAL (password spraying, T1110): 8 sandi umum dicoba ke
// /login-bais lewat PENJAGA OTENTIKASI yang sama dengan trafik nyata. Upaya ke-6
// mengunci IP — mesin yang menilai, bukan karangan.
app.post('/api/simulate/spray', (req, res) => {
  const target = pickSite(req);
  const viaVpn = !!(req.body && req.body.viaVpn);
  const ips = viaVpn ? ['203.0.113.91', '203.0.113.92', '203.0.113.93'] : ['203.0.113.91'];
  const fp = viaVpn ? ['Hydra/9.5 (VPN sim)', 'S-05'] : ['Hydra/9.5', 'S-05'];
  const pwlist = ['kodam123', 'tni1945', 'garuda1', 'indonesia', 'admin123', 'kartika1', 'merdeka45', 'sandi123'];
  const attempts = [];
  if (viaVpn) {
    ips.forEach(attacker => pwlist.slice(0, 3).forEach(pw => attempts.push({ attacker, user: 'admin', ...authAttempt(attacker, 'admin', fp, target, 'S-05') })));
  } else {
    pwlist.forEach(pw => attempts.push({ attacker: ips[0], user: 'admin', ...authAttempt(ips[0], 'admin', fp, target, 'S-05') }));
  }
  markSiteDown(target, 'S-05');
  addAudit(actorOf(req), 'SERANGAN S-05', siteName(target), `Semprotan kredensial oleh sel merah (${attempts.length} upaya${viaVpn ? ', VPN 3 IP' : ''})`);
  const q = lastQuarantine; lastQuarantine = null;
  res.json({ ok: true, scenario: 'S-05', target, attacker: ips, viaVpn, attempts, quarantined: q });
});

// S-06 PENGINTAIAN KERENTANAN (vulnerability scanning, T1595): 12 jalur samar
// diraba lewat RADAR 404 yang sama dengan trafik nyata. Raba ke-11 mengunci IP.
app.post('/api/simulate/scan', (req, res) => {
  const target = pickSite(req);
  const viaVpn = !!(req.body && req.body.viaVpn);
  const ips = viaVpn ? ['198.51.100.140', '198.51.100.141', '198.51.100.142'] : ['198.51.100.140'];
  const fp = viaVpn ? ['Nmap/7.94 (VPN sim)', 'S-06'] : ['Nmap/7.94', 'S-06'];
  const paths = ['/.git/config', '/.env', '/wp-admin', '/phpmyadmin', '/server-status', '/backup.zip', '/db.sql', '/api/users', '/console', '/actuator', '/.svn/entries', '/config.php'];
  const probes = [];
  if (viaVpn) {
    ips.forEach(attacker => paths.slice(0, 4).forEach(p => probes.push({ attacker, probe: p, ...scanProbe(attacker, p, fp, target, 'S-06') })));
  } else {
    paths.forEach(p => probes.push({ attacker: ips[0], probe: p, ...scanProbe(ips[0], p, fp, target, 'S-06') }));
  }
  markSiteDown(target, 'S-06');
  addAudit(actorOf(req), 'SERANGAN S-06', siteName(target), `Pemindaian kerentanan oleh sel merah (${probes.length} rabaan${viaVpn ? ', VPN 3 IP' : ''})`);
  const q = lastQuarantine; lastQuarantine = null;
  res.json({ ok: true, scenario: 'S-06', target, attacker: ips, viaVpn, probes, quarantined: q });
});

// S-07 UNGGAH WEBSHELL (T1505): muatan cangkang disimpan di SERVER (template),
// konsol hanya mengirim indeks — sel merah asli pun tak perlu membawa shell hidup.
const SHELL_PAYLOADS = [
  'POST /upload foto.php4 <?php system($_GET["c"]); ?>',
  'POST /media/upload shell.phtml <?php eval($_POST["x"]); ?>',
];
app.post('/api/simulate/shell', (req, res) => {
  const target = pickSite(req);
  const viaVpn = !!(req.body && req.body.viaVpn);
  const ips = viaVpn ? ['192.0.2.200', '192.0.2.201'] : ['192.0.2.200'];
  const fp = viaVpn ? ['Burp/2.0 (VPN sim)', 'S-07'] : ['Burp/2.0', 'S-07'];
  const payloads = SHELL_PAYLOADS;
  const verdicts = [];
  ips.forEach(attacker => payloads.forEach(p => verdicts.push({ attacker, payload: p, ...evaluateThreat(attacker, p, { siteId: target, scenario: 'S-07' }, fp) })));
  markSiteDown(target, 'S-07');
  addAudit(actorOf(req), 'SERANGAN S-07', siteName(target), `Unggahan webshell oleh sel merah (${verdicts.length} muatan${viaVpn ? ', VPN 2 IP' : ''})`);
  const q = lastQuarantine; lastQuarantine = null;
  res.json({ ok: true, scenario: 'S-07', target, attacker: ips, viaVpn, verdicts, quarantined: q });
});

app.post('/api/simulate/reset', requireKomandan, (req, res) => {
  logs = []; blockedIPs.clear(); rateMap.clear(); authMap.clear(); scanMap.clear(); actors.clear(); actorSeq = 0; lastQuarantine = null; xffSeen.clear(); geoCache.clear(); portalTokens.clear(); portalSessions = [];
  sites.forEach(s => { webInit(s.id); s.status = 'UP'; s.isolated = false; s.hitBy = null; });
  addAudit(`${req.user.name} (${req.user.role})`, 'RESET ARENA', '-', 'Seluruh status, blokir, aktor, dan log dinolkan');
  res.json({ ok: true });
});

app.post('/api/block-ip', requireKomandan, (req, res) => {
  blockedIPs.add(req.body.ip); addLog('Manual-Block', req.body.ip, 'Diblokir manual via dashboard');
  addAudit(`${req.user.name} (${req.user.role})`, 'BLOKIR IP', req.body.ip, 'Blokir manual via dashboard');
  res.json({ ok: true });
});
app.post('/api/isolate', requireKomandan, (req, res) => {
  const s = sites.find(x => x.id === req.body.id);
  if (s) { s.isolated = true; s.status = 'ISOLATED'; addLog('Isolasi', 'komandan', `${s.name} diisolasi dari jaringan`); addAudit(`${req.user.name} (${req.user.role})`, 'ISOLASI JARINGAN', s.name, 'Segmen jaringan diputus dari gelar'); }
  res.json({ ok: true });
});
app.post('/api/restore', requireKomandan, (req, res) => {
  const s = sites.find(x => x.id === req.body.id);
  if (s) { s.isolated = false; s.status = 'UP'; addLog('Recovery', 'komandan', `${s.name} dipulihkan`); addAudit(`${req.user.name} (${req.user.role})`, 'PULIHKAN JARINGAN', s.name, 'Segmen jaringan digelar kembali'); }
  res.json({ ok: true });
});

// ---------- OTENTIKASI PORTAL + RISIKO SESI ----------
// IP koneksi (edge) vs IP klaim di balik proxy — praktik umum bayangan reverse-proxy.
function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.ip || req.connection.remoteAddress || '127.0.0.1';
}
const DEMO_AKUN = { u: '310102', p: 'garuda1945', nama: 'Personel asli (rahasia, tak pernah bocor)' };
// AKUN KENARI: kredensial yang "bocor" di OSINT konsol merah. Siapa pun memakainya
// otomatis dicap musuh: disambut seolah berhasil, diberi DOKUMEN MADU (palsu yang
// tampak asli), dan alarm diam-diam dibunyikan ke biru. Token tetap diterbitkan —
// justru agar musuh merasa menang dan betah, sementara tak satu byte asli pun keluar.
const CANARY_AKUN = { u: '310101', p: 'kartika1945' };
let portalSessions = [];
const portalTokens = new Map(); // token -> sess (termasuk flag restricted)
// Login boleh BERHASIL namun SESI DIKARANTINA bila konteksnya mencurigakan.
// Inilah jawaban "penyerang memegang kredensial asli": kredensial bukan kepercayaan.
function riskLogin(ip, user, ua) {
  let score = 0; const why = [];
  const hit = [...actors.values()].find(a => a.ips.includes(ip));
  if (hit) { score += 50; why.push('IP berafiliasi ' + hit.id); }
  const fails = (authMap.get(ip) || { count: 0 }).count;
  if (fails >= 3) { score += 50; why.push(`pola tebakan (${fails}x gagal sebelum berhasil)`); }
  const hour = new Date().getHours();
  if (hour < 5 || hour >= 23) { score += 10; why.push('jam tak lazim'); }
  if (!/Mozilla|Chrome|Safari|Edge|Firefox/i.test(ua || '')) { score += 15; why.push('peramban tak lazim'); }
  return { score, why };
}
app.post('/masuk', (req, res) => {
  const ip = clientIp(req);
  const ua = req.headers['user-agent'] || '-';
  const u = String((req.body && req.body.u) || '').slice(0, 40);
  const p = String((req.body && req.body.p) || '').slice(0, 80);
  const chk = authAttempt(ip, u, [ua, 'portal'], undefined, 'NET');
  if (!chk.allowed) return res.status(403).json({ ok: false, reason: 'BRUTEFORCE', msg: 'Terlalu banyak upaya — IP dikunci penjaga otentikasi.' });
  if (u === CANARY_AKUN.u && p === CANARY_AKUN.p) {
    const sess = { user: u + ' [KENARI]', ip, time: nowWIB(), risk: 100, restricted: true, canary: true, why: ['akun kenari — kredensial bocor di OSINT'] };
    portalSessions.unshift(sess);
    if (portalSessions.length > 50) portalSessions.pop();
    const pt = crypto.randomBytes(16).toString('hex');
    portalTokens.set(pt, sess);
    addLog('Sesi', ip, `[T1078][KENARI] Akun umpan dipakai — musuh disambut + diberi dokumen madu. Alarm diam-diam ke Komandan`);
    addAudit('MESIN KENARI (otomatis)', 'UMPAN DIMAKAN', u, `IP ${ip} memakai kredensial bocor`);
    return res.json({ ok: true, token: pt, restricted: false, risk: 0, why: [], msg: 'Selamat datang di portal satuan.' });
  }
  if (u === DEMO_AKUN.u && p === DEMO_AKUN.p) {
    const r = riskLogin(ip, u, ua);
    const sess = { user: u, ip, time: nowWIB(), risk: r.score, restricted: r.score >= 50, why: r.why };
    portalSessions.unshift(sess);
    if (portalSessions.length > 50) portalSessions.pop();
    const pt = crypto.randomBytes(16).toString('hex');
    portalTokens.set(pt, sess);
    if (sess.restricted) {
      addLog('Sesi', ip, `[T1078] LOGIN BERHASIL namun DIKARANTINA (skor ${r.score}): ${r.why.join('; ')} — token baca-saja, Komandan dialert`);
      addAudit('MESIN RISIKO (otomatis)', 'KARANTINA SESI', u, `IP ${ip}, skor ${r.score}: ${r.why.join('; ')}`);
    } else {
      addLog('Sesi', ip, `Login portal berhasil: ${u} (risiko rendah, skor ${r.score})`);
    }
    return res.json({ ok: true, token: pt, restricted: sess.restricted, risk: r.score, why: r.why, msg: sess.restricted ? 'Masuk dibatasi: sesi karantina baca-saja, menunggu verifikasi Komandan.' : `Selamat datang di portal satuan. (Skor risiko: ${r.score} — rendah${r.why.length ? ': ' + r.why.join('; ') : ''})` });
  }
  addLog('Auth', ip, `Gagal masuk portal: "${u}" (upaya #${chk.attempt})`);
  res.status(401).json({ ok: false, msg: 'NRP atau kata sandi salah.' });
});
// Gerbang fisik karantina: arsip sensitif HANYA untuk sesi bersih bertoken.
// Sesi karantina (kredensial benar, konteks salah) DITOLAK di sini — 403 tercatat.
function portalAuth(req, res, next) {
  const t = req.headers['x-portal'] || req.query.portal;
  const s = t ? portalTokens.get(t) : null;
  if (!s) return res.status(401).send('Butuh sesi portal. Masuk dulu lewat form MASUK PERSONEL.');
  if (s.restricted && !s.canary) {
    addLog('Sesi', s.ip, `[T1078] SESI KARANTINA "${s.user}" mencoba membuka ${req.path} — DITOLAK 403 (menunggu verifikasi Komandan)`);
    return res.status(403).send('SESI DIKARANTINA: akses arsip ditolak. Menunggu verifikasi Komandan.');
  }
  req.portalSess = s; next();
}
const ARSIP_OK = ['renops-2026.pdf', 'daftar-personel.xlsx', 'peta-gelar.pdf'];
app.get('/arsip/:file', portalAuth, (req, res) => {
  if (!ARSIP_OK.includes(req.params.file)) return res.status(404).send('Tidak ada.');
  if (req.portalSess.canary) {
    addLog('Sesi', req.portalSess.ip, `[KENARI] Musuh mengunduh DOKUMEN MADU ${req.params.file} — data palsu, yang asli aman tak tersentuh`);
    res.setHeader('Content-Type', 'text/plain');
    return res.send(`ARSIP ${req.params.file}\n[RENCANA OPS DERAJAT KUNING — revisi 7]\nJadwal geser pasukan: Kodam-IM → sektor 4B, 03.00.\nKontak lap: frekuensi 77.2 MHz, sandi "cendana".\nDiakses oleh ${req.portalSess.user} pada ${nowWIB()}`);
  }
  addLog('Sesi', req.portalSess.ip, `Unduhan arsip oleh ${req.portalSess.user}: ${req.params.file} (sesi bersih)`);
  res.setHeader('Content-Type', 'text/plain');
  res.send(`ARSIP ${req.params.file}\n[ISI SIMULASI LATIHAN - bukan dokumen asli]\nDiakses oleh ${req.portalSess.user} pada ${nowWIB()}`);
});

// Pemanggil Groq tunggal: toleran terhadap model reasoning (konten kosong,
// JSON terselip di reasoning_content, jawaban terpotong). Gagal → lempar agar
// pemanggil jatuh ke fallback offline. Keandalan panggung di atas segalanya.
async function groqJSON(msgs, maxTokens) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('no-key');
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
    body: JSON.stringify({ model: GROQ_MODEL, temperature: 0.3, max_tokens: maxTokens || 1500, messages: msgs })
  });
  if (!r.ok) throw new Error('groq-' + r.status);
  const j = await r.json();
  const msg = (j.choices && j.choices[0] && j.choices[0].message) || {};
  const raw = String(msg.content || msg.reasoning_content || '').trim();
  if (!raw) throw new Error('groq-empty');
  const m = raw.match(/\{[\s\S]*\}/);
  return JSON.parse(m ? m[0] : raw);
}
// AI hoaks: Groq (online) + fallback rule-based offline (0 VRAM)
function ruleBasedHoaks(text) {
  const t = (text || '').toLowerCase();
  const red = ['kodam diserang', 'panglima ditangkap', 'perang besok', 'transfer sekarang', 'klik link ini', 'darurat militer', 'bantuan dana'];
  const hit = red.filter(k => t.includes(k));
  const score = Math.min(95, hit.length * 35 + (t.includes('http') ? 20 : 0));
  return {
    verdict: hit.length ? 'INDIKASI HOAKS / DISINFORMASI' : 'BELUM ADA INDIKASI KUAT',
    score, keywords: hit, engine: 'offline-lite',
    saran: hit.length
      ? 'Jangan forward. Verifikasi ke Kartika CSIRT / Penerangan TNI AD sebelum bertindak.'
      : 'Tetap verifikasi ke sumber resmi Penerangan TNI AD.'
  };
}
async function groqHoaks(text) {
  const p = await groqJSON([
    { role: 'system', content: 'Kamu analis siber TNI AD. Klasifikasikan teks forward-an sebagai HOAKS/DISINFORMASI atau AMAN. Balas HANYA JSON: {"verdict":"HOAKS"|"AMAN"|"WASPADA","score":0-100,"keywords":[],"saran":"..."}. Bahasa Indonesia singkat, gaya militer.' },
    { role: 'user', content: text.slice(0, 1500) }
  ], 800);
  return {
    verdict: p.verdict === 'HOAKS' ? 'INDIKASI HOAKS / DISINFORMASI' : (p.verdict === 'AMAN' ? 'BELUM ADA INDIKASI KUAT' : 'WASPADA - PERLU VERIFIKASI'),
    score: Number(p.score) || 50, keywords: p.keywords || [], engine: 'groq:' + GROQ_MODEL,
    saran: p.saran || 'Verifikasi ke Kartika CSIRT / Penerangan TNI AD.'
  };
}
app.post('/api/analyze-hoaks', async (req, res) => {
  const text = req.body.text || '';
  if (!text.trim()) return res.status(400).json({ error: 'Teks kosong' });
  try {
    res.json(await groqHoaks(text));
  } catch (e) {
    res.json({ ...ruleBasedHoaks(text), fallback: true });
  }
});
app.get('/api/ai-status', (req, res) => {
  res.json({ groq: !!process.env.GROQ_API_KEY, model: GROQ_MODEL });
});

// ANALIS AI MEDAN LAGA — narasi taktis pasca skenario uji (Groq + fallback)
app.post('/api/ai-analyst', async (req, res) => {
  const scenario = req.body.scenario || 'S-00';
  const ringkas = logs.slice(0, 12).map(l => `[${l.type}] ${l.ip}: ${l.detail}`).join('\n');
  const statusSitus = sites.map(s => `${s.name}=${s.status}`).join('; ');
  const fallback = {
    engine: 'offline-lite', fallback: true,
    narasi: `Skenario ${scenario} selesai. ${logs.length} peristiwa tercatat, ${blockedIPs.size} IP diblokir. Status situs: ${statusSitus}. Pertahanan menahan seluruh muatan; tidak ada penetrasi ke sistem. Rekomendasi: pertahankan pemantauan, putar kunci akses portal, laporkan ke Kartika CSIRT.`,
    aktor: 'Red-team latihan (IP bogon dokumentasi)', rekomendasi: ['Putar kredensial portal', 'Naikkan ambang siaga 24 jam', 'Teruskan log ke Kartika CSIRT']
  };
  try {
    const p = await groqJSON([
      { role: 'system', content: 'Kamu analis intelijen siber TNI AD di ruang operasi. Terima ringkasan pertempuran uji taktis, balas HANYA JSON: {"narasi":"2-4 kalimat gaya laporan militer Indonesia: apa yang terjadi, bagaimana pertahanan menahan, kondisi akhir","aktor":"profil pelaku 1 kalimat","rekomendasi":["3 langkah konkret"]}.' },
      { role: 'user', content: `Skenario: ${scenario}\nStatus situs: ${statusSitus}\nLog:\n${ringkas}`.slice(0, 2000) }
    ], 1500);
    res.json({ engine: 'groq:' + GROQ_MODEL, narasi: p.narasi, aktor: p.aktor, rekomendasi: p.rekomendasi || [] });
  } catch (e) {
    res.json(fallback);
  }
});

// PENASIHAT TAKTIS AI — membaca log mentah, mengelompokkan MITRE, memerintah.
// Dipanggil otomatis pasca skenario; juga bisa diminta manual oleh perwira jaga.
app.post('/api/ai-advisor', async (req, res) => {
  const scenario = req.body.scenario || 'S-00';
  const groups = {};
  logs.slice(0, 30).forEach(l => {
    const m = String(l.detail).match(/\[(T\d+)\]/);
    const k = m ? `${l.type} ${m[1]}` : l.type;
    groups[k] = groups[k] || { ttp: k, count: 0, ips: new Set() };
    groups[k].count++;
    groups[k].ips.add(l.ip);
  });
  const daftar = Object.values(groups).map(g => ({ ttp: g.ttp, count: g.count, ips: [...g.ips].slice(0, 3) }));
  const statusSitus = sites.map(s => `${s.name}=${s.status}`).join('; ');
  const fallback = {
    engine: 'offline-lite', fallback: true,
    ringkasan: `Skenario ${scenario}: ${daftar.map(d => `${d.count}x ${d.ttp}`).join(', ') || 'belum ada kontak'}. Gelar: ${statusSitus}.`,
    perintah: [
      { aksi: 'Pertahankan pemantauan baseline dan putar kredensial portal', target: 'seluruh situs', tenggat: '30 menit' },
      { aksi: 'Blokir IP penyerang di perimeter dan teruskan IOC ke Kartika CSIRT', target: 'firewall tepi', tenggat: '10 menit' },
      { aksi: 'Siapkan rollback dan gelar ulang bila status menjadi MERAH', target: 'posko', tenggat: 'siaga' },
    ],
    eskalasi: 'KUNING — lapor Dantim CSIRT tiap 30 menit (Perpres 82/2022 IIV).'
  };
  try {
    const p = await groqJSON([
      { role: 'system', content: 'Kamu kepala analis siber TNI AD. Terima kelompok TTP MITRE ATT&CK + status gelar, balas HANYA JSON: {"ringkasan":"2 kalimat situasi","perintah":[{"aksi":"perintah konkret 1 kalimat","target":"sasaran","tenggat":"mis. 2 menit"}],"eskalasi":"HIJAU/KUNING/MERAH + alasan + rujukan Perpres 82/2022 IIV"}. Maksimal 3 perintah, bahasa komando Indonesia.' },
      { role: 'user', content: `Skenario: ${scenario}\nTTP: ${JSON.stringify(daftar)}\nGelar: ${statusSitus}\nDiblokir: ${[...blockedIPs].join(', ') || 'nihil'}`.slice(0, 2000) }
    ], 2000);
    res.json({ engine: 'groq:' + GROQ_MODEL, ringkasan: p.ringkasan, perintah: p.perintah || [], eskalasi: p.eskalasi });
  } catch (e) {
    res.json(fallback);
  }
});

app.get('/api/report', (req, res) => {
  const txt =
`LAPORAN INSIDEN SIBER - KARTIKA CSIRT
Waktu: ${nowWIB()}
Pelapor: Dashboard GARUDA SHIELD LITE (Operator Kodam)
----------------------------------------
Ringkasan: ${logs.length} peristiwa, ${blockedIPs.size} IP diblokir, situs-tercemar=[${defacedSites().join(', ') || 'nihil'}]
Situs: ${sites.map(s => `${s.name}:${s.status}`).join(', ')}
----------------------------------------
Log 10 terakhir:
${logs.slice(0, 10).map(l => `[${l.time}] ${l.type} ${l.ip} - ${l.detail}`).join('\n')}
----------------------------------------
Tindakan: isolasi otomatis + rollback + blokir IP
Tindak lanjut: forward ke kartikacsirt@tni-ad.mil.id / Mil-CSIRT TNI
Sesuai Perpres 82/2022 Pelindungan Infrastruktur Informasi Vital.`;
  res.setHeader('Content-Type', 'text/plain');
  res.send(txt);
});

app.get('/api/report.pdf', (req, res) => {
  const u = getUser(req);
  const klas = ['RAHASIA', 'TERBATAS', 'BIASA'].includes((req.query.klas || '').toUpperCase()) ? req.query.klas.toUpperCase() : 'TERBATAS';
  const doc = new PDFDocument({ margin: 45, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Lapinsiber-Kartika-CSIRT-${klas}.pdf"`);
  doc.pipe(res);
  // Kop dinas
  doc.fontSize(11).text('TENTARA NASIONAL INDONESIA ANGKATAN DARAT', { align: 'center' });
  doc.fontSize(11).text('PUSAT SANDI DAN SIBER (PUSSANSIAD)', { align: 'center' });
  doc.fontSize(13).text('KARTIKA CSIRT — TIM TANGGAP INSIDEN SIBER', { align: 'center', underline: true });
  doc.moveDown(0.5);
  // Cap klasifikasi
  doc.rect(doc.x + 170, doc.y, 200, 26).stroke();
  doc.fontSize(14).text(`KLASIFIKASI: ${klas}`, doc.x + 170, doc.y + 5, { width: 200, align: 'center' });
  doc.moveDown(1.2);
  doc.fontSize(13).text('LAPORAN INSIDEN SIBER (LAPINSIBER)', { align: 'center' });
  doc.fontSize(9).text(`Waktu: ${nowWIB()} | Penyusun: ${u ? u.name + ' (' + u.role + ')' : 'Anonim'} | Sistem: GARUDA SHIELD LITE`, { align: 'center' });
  doc.moveDown();
  doc.fontSize(10).text(`1. RINGKASAN: ${logs.length} peristiwa, ${blockedIPs.size} IP diblokir, tercemar=[${defacedSites().join(', ') || 'nihil'}].`);
  doc.moveDown(0.4);
  doc.fontSize(10).text('2. STATUS GELAR SITUS:');
  sites.forEach(s => doc.fontSize(8).text(`- ${s.name} [${s.localIp}]: ${s.status}${s.isolated ? ' (ISOLATED)' : ''}`));
  doc.moveDown(0.4);
  doc.fontSize(10).text('3. IOC AKTIF:');
  const iocIps = [...blockedIPs];
  const dsPdf = defacedSites();
  if (!iocIps.length && !dsPdf.length) doc.fontSize(8).text('- Nihil.');
  iocIps.forEach(ip => doc.fontSize(8).text(`- IP ${ip}: DIBLOKIR (masukkan ke daftar blokir perimeter)`));
  doc.fontSize(8).text(`- Hash baseline portal: ${siteWeb.pussansiad.baseline.slice(0, 24)}…`);
  dsPdf.forEach(id => doc.fontSize(8).text(`- ${id} TERCEMAR: ${webLive(id)}… (rollback berjalan)`));
  doc.moveDown(0.4);
  doc.fontSize(10).text('4. JEJAK AKUNTABILITAS (siapa memerintah apa):');
  if (!audit.length) doc.fontSize(8).text('- Belum ada perintah tercatat.');
  audit.slice(0, 15).forEach(a => doc.fontSize(8).text(`- [${a.time}] ${a.actor}: ${a.action} → ${a.target}`));
  doc.moveDown(0.4);
  doc.fontSize(10).text('5. LOG 15 TERAKHIR:');
  logs.slice(0, 15).forEach(l => doc.fontSize(7).text(`[${l.time}] ${l.type} | ${l.ip} | ${String(l.detail).slice(0, 110)}`));
  doc.moveDown();
  doc.fontSize(8).text('6. TINDAK LANJUT: teruskan ke kartikacsirt@tni-ad.mil.id dan Mil-CSIRT TNI sesuai Perpres 82/2022 tentang Pelindungan IIV.');
  doc.moveDown(2);
  doc.fontSize(9).text('Mengetahui,', { align: 'right' });
  doc.fontSize(9).text('Komandan Tim Siber', { align: 'right' });
  doc.moveDown(3);
  doc.fontSize(9).text('( ............................................ )', { align: 'right' });
  doc.end();
});

app.get('/favicon.ico', (req, res) => res.status(204).end());

// Penangkap 404 = radar pemindaian: penyusup yang meraba-raba jalur samar
// (fuzzing direktori) terdeteksi dari rintihannya sendiri, tanpa sensor tambahan.
app.use((req, res) => {
  const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
  if (blockedIPs.has(ip)) return res.status(403).send('Blocked by GARUDA SHIELD [BLOCKED_IP]');
  scanProbe(ip, req.path, [req.headers['user-agent'] || '-', 'net']);
  res.status(404).send('Tidak ditemukan.');
});

app.listen(PORT, () => console.log(`GARUDA SHIELD LITE jalan di http://localhost:${PORT}`));
