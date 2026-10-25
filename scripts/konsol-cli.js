#!/usr/bin/env node
/*
 * KONSOL PENYERANG — GARUDA SHIELD (simulasi)
 *
 * Aplikasi baris perintah (CLI) untuk meluncurkan serangan simulasi dari
 * localhost ke server GARUDA SHIELD di hosting (subdomain) ataupun localhost.
 * Tanpa dependensi tambahan: memakai fetch bawaan Node.js >= 22.5.
 *
 * Contoh:
 *   node scripts/konsol-cli.js
 *   node scripts/konsol-cli.js server https://gs.kartikacyber.example
 *   node scripts/konsol-cli.js target
 *   node scripts/konsol-cli.js metode
 *   node scripts/konsol-cli.js serang kodam-jaya zdd --ip 103.22.188.7
 *   node scripts/konsol-cli.js serang kodam-jaya smart-ids --preset shanghai
 *   node scripts/konsol-cli.js status
 *   node scripts/konsol-cli.js pulihkan <attackId>
 *
 * Variabel lingkungan:
 *   KONSOL_SERVER   alamat server API, mis. https://gs.domain-anda.com
 *   KONSOL_API_KEY  kunci konsol bila server mengatur KONSOL_API_KEY
 */

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline/promises');
const { stdin, stdout, exit } = require('node:process');

const configFile = path.join(__dirname, '..', '.konsol.json');

/* ---------- utilitas tampilan ---------- */
const ansi = { reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m' };
const paint = (code, text) => `${code}${text}${ansi.reset}`;
const bold = (text) => paint(ansi.bold, text);
const dim = (text) => paint(ansi.dim, text);
const green = (text) => paint(ansi.green, text);
const yellow = (text) => paint(ansi.yellow, text);
const red = (text) => paint(ansi.red, text);
const cyan = (text) => paint(ansi.cyan, text);

function heading(text) {
  console.log('');
  console.log(bold(text));
  console.log(dim('─'.repeat(Math.min(72, text.length + 4))));
}

function severityColor(severity) {
  if (severity === 'critical') return red;
  if (severity === 'high') return yellow;
  return green;
}

function severityLabel(severity) {
  return severityLabelMap[severity] || String(severity).toUpperCase();
}

const severityLabelMap = { critical: 'KRITIS', high: 'TINGGI', medium: 'SEDANG', low: 'RENDAH' };

/* ---------- konfigurasi ---------- */
let config = { server: '', apiKey: '' };
try {
  const stored = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  if (typeof stored.server === 'string') config.server = stored.server;
  if (typeof stored.apiKey === 'string') config.apiKey = stored.apiKey;
} catch (error) {
  // Konsol belum pernah dikonfigurasi — masih bisa dipakai lewat parameter.
}

function readFlag(argv, name) {
  const index = argv.indexOf(name);
  if (index === -1 || index + 1 >= argv.length) return null;
  return argv[index + 1];
}

function configuredServer() {
  return process.env.KONSOL_SERVER || config.server || 'http://localhost:3000';
}

function configuredApiKey() {
  return process.env.KONSOL_API_KEY || config.apiKey || '';
}

function saveConfig() {
  try {
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
  } catch (error) {
    // Bila gagal menulis, konfigurasi tetap berlaku untuk sesi ini saja.
  }
}

/* ---------- panggilan API ---------- */
async function api(pathname, options = {}) {
  const base = configuredServer().replace(/\/+$/, '');
  const headers = { ...(options.headers || {}) };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const key = configuredApiKey();
  if (key) headers['x-konsol-key'] = key;

  let response;
  try {
    response = await fetch(`${base}${pathname}`, {
      method: options.method || 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined
    });
  } catch (error) {
    throw new Error(`Server tidak dapat dihubungi di ${base}. Periksa koneksi atau perintah 'server'.`);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Server menjawab ${response.status}.`);
  }
  return data;
}

function verifyServer(url) {
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Alamat server harus http:// atau https://.');
  return parsed.origin + (parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/+$/, ''));
}

/* ---------- profiler profil penyerang ---------- */
const attackerPresets = {
  default: null,
  shanghai: { ip: '103.22.188.7', location: 'Shanghai, Tiongkok', lat: 31.23, lng: 121.47, provider: 'AS4134 · China Telecom', vpn: false, tor: false, confidence: 78 },
  moskow: { ip: '185.22.59.10', location: 'Moskow, Rusia', lat: 55.75, lng: 37.62, provider: 'AS12389 · Rostelecom', vpn: false, tor: false, confidence: 74 },
  frankfurt: { ip: '203.0.113.77', location: 'Frankfurt, Jerman (exit node)', lat: 50.11, lng: 8.68, provider: 'AS64500 · Jaringan anonim', vpn: true, tor: false, confidence: 38 },
  amsterdam: { ip: '198.51.100.44', location: 'Amsterdam, Belanda (relay)', lat: 52.37, lng: 4.9, provider: 'AS64501 · Relay anonim', vpn: false, tor: true, confidence: 31 }
};

function buildAttackerPayload(overrides) {
  const presetName = overrides.preset || 'default';
  if (presetName === 'default' && !overrides.ip) {
    if (overrides.location) throw new Error('Profil lokasi hanya boleh dipakai bersama IP ayat melalui --ip.');
    return {};
  }
  const preset = attackerPresets[presetName];
  if (presetName !== 'default' && !preset) {
    throw new Error(`Preset tidak dikenal: ${presetName}. Pilihan: ${Object.keys(attackerPresets).join(', ')}.`);
  }
  const base = preset ? { ...preset } : {};
  if (overrides.ip) base.ip = overrides.ip;
  if (!base.ip) throw new Error('Profil penyerang memerlukan alamat IP melalui --ip atau --preset.');
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  if (!ipv4.test(base.ip) || base.ip.split('.').some((part) => Number(part) > 255)) {
    throw new Error(`Alamat IP tidak valid: ${base.ip}`);
  }
  if (overrides.location) {
    base.location = overrides.location;
    if (overrides.lat) base.lat = Number(overrides.lat);
    if (overrides.lng) base.lng = Number(overrides.lng);
  }
  if (!base.location) delete base.lat;
  if (!base.location) delete base.lng;
  if (!base.location) delete base.provider;
  if (overrides.confidence !== null) {
    const confidenceValue = Number(overrides.confidence);
    if (!Number.isFinite(confidenceValue) || confidenceValue < 0 || confidenceValue > 100) {
      throw new Error('--keyakinan harus angka 0-100.');
    }
    base.confidence = confidenceValue;
  }
  const payload = { attackerIp: base.ip };
  if (base.location) {
    payload.attackerLocation = { location: base.location };
    if (base.lat !== undefined) payload.attackerLocation.lat = base.lat;
    if (base.lng !== undefined) payload.attackerLocation.lng = base.lng;
    if (base.provider) payload.attackerLocation.provider = base.provider;
    if (base.confidence !== undefined) payload.attackerLocation.confidence = base.confidence;
    if (base.vpn) payload.attackerLocation.vpn = true;
    if (base.tor) payload.attackerLocation.tor = true;
  }
  return payload;
}

function parseOverrides(argv) {
  return {
    ip: readFlag(argv, '--ip') || null,
    preset: readFlag(argv, '--preset') || 'default',
    location: readFlag(argv, '--lokasi') || null,
    lat: readFlag(argv, '--lat') || null,
    lng: readFlag(argv, '--lng') || null,
    confidence: readFlag(argv, '--keyakinan')
  };
}

/* ---------- perintah ---------- */
async function commandTargets() {
  const { sites } = await api('/api/targets');
  heading(`TARGET (${sites.length} situs) · ${dim(configuredServer())}`);
  const statusLabel = { online: green('ONLINE'), warning: yellow('WARNING'), offline: red('OFFLINE'), maintenance: yellow('PEMELIHARAAN') };
  for (const [index, site] of sites.entries()) {
    const marker = String(index + 1).padStart(2, ' ');
    const status = statusLabel[site.status] || site.status;
    console.log(`${dim(marker)}  ${bold(site.code.padEnd(9))} ${site.name.padEnd(24)} ${dim(site.city.padEnd(22))} ${status}`);
    console.log(`${dim(' ') + dim('  ')}${dim(`id: `)}${site.id}`);
  }
  console.log(dim('Gunakan id setelah perintah "serang", mis. serang kodam-jaya smart-ids'));
}

async function commandMethods() {
  const { methods } = await api('/api/metode');
  heading(`METODE SERANGAN (${methods.length})`);
  for (const [index, method] of methods.entries()) {
    const marker = String(index + 1).padStart(2, ' ');
    console.log(`${dim(marker)}  ${bold(method.code.padEnd(9))} ${method.name}`);
    console.log(`${dim('          ')}${method.tagline}`);
    console.log(`${dim('          ')}${dim(`vektor: ${method.vector} · id: ${method.id}`)}`);
  }
}

async function commandAttack(argv) {
  const [siteId, methodId] = argv.filter((item) => !item.startsWith('--'));
  if (!siteId || !methodId) throw new Error('Pemakaian: serang <targetId> <metodeId> [--ip x] [--preset shanghai] [--lokasi "..."]');

  const overrides = parseOverrides(argv);
  const payload = {
    siteId,
    methodId,
    attackId: `atk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    ...buildAttackerPayload(overrides)
  };

  console.log(dim(`Meluncurkan serangan simulasi ke ${configuredServer()} ...`));
  const result = await api('/api/serangan', { method: 'POST', body: payload });

  heading('SERANGAN DILUNCURKAN');
  console.log(`${bold(result.method.name)} ${dim(`(${result.method.code})`)} ${dim('→')} ${bold(result.site.name)} ${dim(`· ${result.site.city}`)}`);
  console.log(`${dim('attackId:')} ${result.id}`);
  console.log(`${dim('event:')} ${result.eventCount}${result.sources.length ? `${dim(' · sumber:')} ${result.sources.join(', ')}` : ''}`);
  if (result.attacker) {
    console.log(`${dim('asal:')} ${result.attacker.location || result.attacker.ip}${result.attacker.vpn ? dim(' · VPN') : ''}${result.attacker.tor ? dim(' · Tor') : ''}`);
  }

  if (result.detections.length === 0) {
    console.log(yellow('Tidak ada aturan deteksi yang terpicu.'));
  } else {
    heading(`ALERT TERPICU (${result.detections.length})`);
    for (const detection of result.detections) {
      const label = severityColor(detection.severity)(severityLabel(detection.severity).padEnd(7));
      console.log(`${label} ${detection.ruleId} ${detection.title}`);
    }
  }

  heading('RESPONS OTOMATIS');
  for (const step of result.responses) console.log(`  · ${step}`);

  const base = configuredServer().replace(/\/+$/, '');
  console.log('');
  console.log(`Laporan        : ${cyan(`${base}/laporan/${result.id}`)}`);
  console.log(`Situs target   : ${cyan(`${base}/situs-dummy/${result.site.id}`)}`);
  console.log(`Dashboard      : ${cyan(`${base}/?attack=${result.id}#map`)} ${dim('(buka di browser untuk melihat peta)')}`);
}

async function commandStatus() {
  const { active } = await api('/api/insiden-aktif');
  if (!active) {
    console.log(green('Tidak ada insiden aktif di dashboard.'));
    return;
  }
  heading('INSIDEN AKTIF');
  console.log(`${bold(active.method.name)} ${dim(`(${active.method.code})`)} → ${bold(active.site.name)}`);
  console.log(`${dim('attackId:')} ${active.id}`);
  console.log(`${dim('mulai:')} ${new Date(active.createdAt).toLocaleString('id-ID')}`);
  console.log(`${dim('event:')} ${active.eventCount} ${dim('· alert:')} ${active.detections.length}`);
}

async function commandRecover(argv) {
  const attackId = argv[0];
  if (!attackId) throw new Error('Pemakaian: pulihkan <attackId>');
  await api('/api/pulihkan', { method: 'POST', body: { attackId } });
  console.log(green(`Insiden ${attackId} ditandai pulih.`));
}

function commandServer(argv) {
  const rawUrl = argv[0];
  if (!rawUrl) {
    console.log(`Server saat ini : ${bold(configuredServer())}`);
    console.log(`Kunci API       : ${configuredApiKey() ? dim('diatur') : dim('(tidak, tanpa header x-konsol-key)')}`);
    return;
  }
  const url = verifyServer(rawUrl);
  config.server = url;
  saveConfig();
  console.log(green(`Server konsol diarahkan ke ${url}`));
  if (!configuredApiKey()) console.log(dim('Catatan: bila server mengatur KONSOL_API_KEY, atur dengan perintah "key <kunci>".'));
}

function commandKey(argv) {
  const key = argv[0];
  if (!key) {
    console.log(`Kunci saat ini  : ${config.apiKey ? dim('(diatur di .konsol.json)') : dim('(kosong)')}`);
    return;
  }
  config.apiKey = key;
  saveConfig();
  console.log(green('Kunci konsol disimpan ke .konsol.json'));
}

function showHelp() {
  heading('KONSOL PENYERANG — GARUDA SHIELD (simulasi)');
  console.log(`Server  : ${bold(configuredServer())}`);
  console.log(`Kunci   : ${configuredApiKey() ? dim('diatur') : dim('(tidak)')}`);
  console.log('');
  console.log('Perintah:', dim('(boleh dipakai langsung dari terminal atau di dalam mode interaktif)'));
  console.log(`  ${bold('target')}                              daftar situs target`);
  console.log(`  ${bold('metode')}                              daftar metode serangan`);
  console.log(`  ${bold('serang')} <targetId> <metodeId> [opsi]  luncurkan serangan simulasi`);
  console.log(`  ${dim('           opsi: --ip 1.2.3.4 --preset shanghai --lokasi "Kota, Negara" --lat --lng')}`);
  console.log(`  ${bold('status')}                              insiden aktif di dashboard`);
  console.log(`  ${bold('pulihkan')} <attackId>                  tandai insiden pulih`);
  console.log(`  ${bold('server')} [url]                         lihat atau atur alamat server API`);
  console.log(`  ${bold('key')} [kunci]                         lihat atau atur kunci konsol (header x-konsol-key)`);
  console.log(`  ${bold('keluar')}                               tutup konsol interaktif`);
  console.log('');
  console.log(dim('Berjalan tanpa argumen membuka mode interaktif. Seluruh data merupakan simulasi demo.'));
}

/* ---------- mode interaktif ---------- */
function commandName(line) {
  const parts = line.trim().split(/\s+/).filter(Boolean);
  return parts.length ? { name: parts[0].toLowerCase(), argv: parts.slice(1) } : null;
}

async function runCommand(line) {
  const called = commandName(line);
  if (!called) return true;
  switch (called.name) {
    case 'target':
    case 'targets':
      await commandTargets();
      return true;
    case 'metode':
    case 'metod':
    case 'methods':
      await commandMethods();
      return true;
    case 'serang':
    case 'attack':
      await commandAttack(called.argv);
      return true;
    case 'status':
      await commandStatus();
      return true;
    case 'pulihkan':
    case 'pulih':
      await commandRecover(called.argv);
      return true;
    case 'server':
      commandServer(called.argv);
      return true;
    case 'key':
    case 'kunci':
      commandKey(called.argv);
      return true;
    case 'bantuan':
    case 'help':
      showHelp();
      return true;
    case 'keluar':
    case 'exit':
    case 'quit':
      return false;
    default:
      console.log(red(`Perintah tidak dikenal: ${called.name}${dim(' · ketik "bantuan"')}`));
      return true;
  }
}

async function interactive() {
  const prompt = readline.createInterface({ input: stdin, output: stdout });
  showHelp();
  prompt.on('close', () => exit(0));
  for (;;) {
    let line;
    try {
      line = await prompt.question(cyan('konsol> '));
    } catch (error) {
      break; // Ctrl+D / akhir input
    }
    let keepGoing = true;
    try {
      keepGoing = await runCommand(line);
    } catch (error) {
      console.log(red(error.message || 'Perintah gagal.'));
    }
    if (!keepGoing) break;
  }
  prompt.close();
}

/* ---------- masuk program ---------- */
const argv = process.argv.slice(2);
const configFlagServer = argv.includes('--server') ? readFlag(argv, '--server') : null;
if (configFlagServer) config.server = verifyServer(configFlagServer);
const configFlagKey = argv.includes('--key') ? readFlag(argv, '--key') : null;
if (configFlagKey) config.apiKey = configFlagKey;

(async () => {
  try {
    /* --server / --key sudah diterapkan ke config; buang keduanya dari argv langsung. */
    const trimmed = [];
    for (let index = 0; index < argv.length; index += 1) {
      if (argv[index] === '--server' || argv[index] === '--key') { index += 1; continue; }
      trimmed.push(argv[index]);
    }
    if (trimmed.length === 0) {
      await interactive();
      return;
    }
    const keepGoing = await runCommand(trimmed.join(' '));
    if (!keepGoing) return;
  } catch (error) {
    console.log(red(error.message || 'Perintah gagal.'));
    exit(1);
  }
})();
