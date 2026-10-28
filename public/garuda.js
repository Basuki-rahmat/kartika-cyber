const siteData = JSON.parse(document.querySelector('#site-data').textContent);
const siteRows = [...document.querySelectorAll('.site-row')];
const siteById = new Map(siteData.map((site) => [site.id, site]));
const mapFrame = document.querySelector('#map-frame');
let activeFilter = 'all';
let activeRegion = 'all';
let searchTerm = '';
const markers = new Map();
const map = L.map('map', {
  attributionControl: true,
  zoomControl: false,
  scrollWheelZoom: false,
  zoomSnap: 0
}).setView([-2.5, 118], 4);
let pendingAttackView = null;
let provinceBounds = null;
let mapUserMoved = false;

/* Tepat memenuhi frame: pas 100% di tepi kanan & kiri (presisi), tanpa padding.
   zoomSnap: 0 membuat getBoundsZoom menghasilkan zoom pecahan → lebar peta
   benar-benar pas dengan frame, bukan dibulatkan ke bawah (terlihat kecil). */
function fitMapToEdges() {
  if (!provinceBounds || !map) return;
  const size = map.invalidateSize({ animate: false }).getSize();
  if (size.x === 0 || size.y === 0) return;
  const zoom = Math.min(map.getBoundsZoom(provinceBounds, false, [0, 0]), 9);
  mapUserMoved = false;
  map.setView(provinceBounds.getCenter(), zoom, { animate: false });
}

/* Hanya fit ulang selama pengguna belum menggeser/memperbesar manual. */
['dragstart', 'zoomstart', 'movestart'].forEach((type) => {
  map.on(type, (event) => { if (event.originalEvent) mapUserMoved = true; });
});

if (typeof ResizeObserver !== 'undefined') {
  const mapResizeObserver = new ResizeObserver(() => {
    map.invalidateSize({ animate: false });
    if (provinceBounds && !mapUserMoved) fitRegion(activeRegion, false);
  });
  mapResizeObserver.observe(mapFrame);
}

const statusNames = {
  online: 'NORMAL',
  warning: 'PERHATIAN',
  offline: 'OFFLINE',
  maintenance: 'MAINTENANCE'
};

/* Wilayah operasional diturunkan dari koordinat situs, bukan daftar tetap,
   sehingga tetap benar bila data situs berubah. */
const regionNames = {
  all: 'NASIONAL',
  sumatera: 'SUMATERA',
  jawa: 'JAWA',
  kalimantan: 'KALIMANTAN',
  sulawesi: 'SULAWESI',
  bali: 'BALI–NUSA',
  maluku: 'MALUKU',
  papua: 'PAPUA'
};

function regionOf(site) {
  const { lat, lng } = site;
  if (lng >= 130) return 'papua';
  if (lng >= 125.5) return 'maluku';
  if (lng >= 118.5 && lat > -6.5) return 'sulawesi';
  if (lng >= 114.5 && lat <= -8) return 'bali';
  if (lng >= 108.5 && lng < 118.5 && lat > -5) return 'kalimantan';
  if (lng >= 105 && lat <= -5.5) return 'jawa';
  return 'sumatera';
}

function selectSite(siteId) {
  const site = siteData.find((candidate) => candidate.id === siteId);
  if (!site) return;

  document.querySelector('#detail-code').textContent = site.code;
  document.querySelector('#detail-name').textContent = site.name;
  document.querySelector('#detail-city').textContent = `${site.city} · Dummy site`;
  document.querySelector('#detail-latency').innerHTML = site.latency === null ? '—' : `${site.latency} <small>ms</small>`;
  document.querySelector('#detail-uptime').textContent = site.uptime;
  document.querySelector('#detail-url').textContent = `https://${site.id}.test`;
  document.querySelector('#open-dummy-link').href = `/situs-dummy/${site.id}`;
  document.querySelector('#detail-checked').textContent = site.checked;
  const status = document.querySelector('#detail-status');
  status.className = `selected-status status-text-${site.status}`;
  status.innerHTML = `<i class="key-dot dot-${site.status}"></i> ${statusNames[site.status]}`;

  markers.forEach((marker, id) => {
    const element = marker.getElement();
    if (element) element.classList.toggle('site-marker-selected', id === siteId);
  });
  siteRows.forEach((row) => row.classList.toggle('selected', row.dataset.siteId === siteId));
}

function applyFilters() {
  let visibleCount = 0;
  siteRows.forEach((row) => {
    const status = row.dataset.status;
    const site = siteById.get(row.dataset.siteId);
    const matchesFilter = activeFilter === 'all'
      || (activeFilter === 'attention' && ['warning', 'offline'].includes(status))
      || status === activeFilter;
    const matchesSearch = row.dataset.name.toLowerCase().includes(searchTerm);
    const matchesRegion = activeRegion === 'all' || (site && regionOf(site) === activeRegion);
    const visible = matchesFilter && matchesSearch && matchesRegion;
    row.hidden = !visible;
    visibleCount += Number(visible);
  });

  markers.forEach((marker, siteId) => {
    const row = siteRows.find((candidate) => candidate.dataset.siteId === siteId);
    if (row && row.hidden) map.removeLayer(marker);
    else if (row && !map.hasLayer(marker)) marker.addTo(map);
  });
  document.querySelector('#list-empty').hidden = visibleCount !== 0;
}

function markerIcon(site) {
  const html = `<span class="site-marker site-marker-${site.status}" aria-hidden="true"><span class="site-marker-pulse"></span><span class="site-marker-core"></span><span class="site-marker-label">${site.code}</span></span>`;
  return L.divIcon({ className: 'garuda-site-icon', html, iconSize: [26, 26], iconAnchor: [13, 13] });
}

siteData.forEach((site) => {
  const marker = L.marker([site.lat, site.lng], { icon: markerIcon(site), title: `${site.name} · ${statusNames[site.status]}` });
  const thumb = `<img class="popup-thumb" src="/thumbs/${encodeURIComponent(site.id)}.jpg" alt="Pratinjau ${site.name}" loading="lazy" onerror="this.remove()">`;
  marker.bindPopup(`${thumb}<strong>${site.name}</strong><br>${site.city} · ${statusNames[site.status]}<br><span class="popup-dummy">SITUS DUMMY · ${site.latency === null ? 'TIDAK MERESPONS' : `${site.latency} ms SIM.`}</span>`);
  marker.on('click', () => selectSite(site.id));
  marker.addTo(map);
  markers.set(site.id, marker);
});

siteRows.forEach((row) => row.addEventListener('click', () => selectSite(row.dataset.siteId)));

document.querySelectorAll('.filter-button').forEach((button) => {
  button.addEventListener('click', () => {
    activeFilter = button.dataset.filter;
    document.querySelectorAll('.filter-button').forEach((item) => item.classList.toggle('active', item === button));
    applyFilters();
  });
});

document.querySelector('#site-search').addEventListener('input', (event) => {
  searchTerm = event.target.value.trim().toLowerCase();
  applyFilters();
});

document.addEventListener('keydown', (event) => {
  if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
    event.preventDefault();
    document.querySelector('#site-search').focus();
  }
  if (event.key === 'Escape') {
    document.querySelector('#site-search').blur();
    const root = document.querySelector('.cc-panels');
    if (root && root.classList.contains('map-focus')) setMapFocus(false);
  }
});

document.querySelector('#zoom-in').addEventListener('click', () => map.zoomIn());
document.querySelector('#zoom-out').addEventListener('click', () => map.zoomOut());
document.querySelector('#zoom-reset').addEventListener('click', () => {
  if (provinceBounds) { focusRegion('all'); return; }
  const visibleSites = siteData.filter((site) => {
    const row = siteRows.find((candidate) => candidate.dataset.siteId === site.id);
    return row && !row.hidden;
  });
  if (visibleSites.length) map.fitBounds(L.latLngBounds(visibleSites.map((site) => [site.lat, site.lng])), { padding: [22, 22], maxZoom: 5 });
});

/* --- Tab wilayah: pilih pandangan operasional (menggeser + memfilter peta) --- */
const mapTabs = [...document.querySelectorAll('.map-tab')];

function fitRegion(region, animate) {
  if (region === 'all') {
    if (provinceBounds) fitMapToEdges();
    return;
  }
  const points = siteData.filter((site) => regionOf(site) === region).map((site) => [site.lat, site.lng]);
  if (!points.length) return;
  mapUserMoved = false;
  map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 6, animate: Boolean(animate) });
}

function focusRegion(region) {
  activeRegion = region;
  mapTabs.forEach((tab) => {
    const on = tab.dataset.region === region;
    tab.classList.toggle('active', on);
    tab.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  applyFilters();
  fitRegion(region, true);
}

mapTabs.forEach((tab) => tab.addEventListener('click', () => focusRegion(tab.dataset.region)));

/* Jumlah posko per wilayah pada label tab (statis, tidak bergantung filter). */
(() => {
  const counts = { all: siteData.length };
  siteData.forEach((site) => {
    const region = regionOf(site);
    counts[region] = (counts[region] || 0) + 1;
  });
  mapTabs.forEach((tab) => {
    const badge = tab.querySelector('b');
    if (badge) badge.textContent = counts[tab.dataset.region] || 0;
  });
})();

/* --- Rail alat peta: mode fokus, label situs, legenda --- */
const panelsRoot = document.querySelector('.cc-panels');
const fullscreenButton = document.querySelector('#map-fullscreen');

function setMapFocus(on) {
  if (!panelsRoot) return;
  panelsRoot.classList.toggle('map-focus', on);
  if (fullscreenButton) {
    fullscreenButton.classList.toggle('is-active', on);
    fullscreenButton.setAttribute('aria-pressed', on ? 'true' : 'false');
    fullscreenButton.title = on ? 'Keluar mode fokus' : 'Mode fokus peta';
  }
  setTimeout(() => {
    map.invalidateSize({ animate: false });
    if (!mapUserMoved) fitRegion(activeRegion, false);
  }, 280);
}

if (fullscreenButton) {
  fullscreenButton.addEventListener('click', () => setMapFocus(!panelsRoot.classList.contains('map-focus')));
}

const labelsButton = document.querySelector('#map-labels');
if (labelsButton) {
  labelsButton.addEventListener('click', () => {
    const off = mapFrame.classList.toggle('labels-off');
    labelsButton.classList.toggle('is-off', off);
    labelsButton.setAttribute('aria-pressed', off ? 'false' : 'true');
    labelsButton.title = off ? 'Tampilkan label situs' : 'Sembunyikan label situs';
  });
}

const legendButton = document.querySelector('#map-legend-toggle');
if (legendButton) {
  legendButton.addEventListener('click', () => {
    const off = mapFrame.classList.toggle('legend-off');
    legendButton.classList.toggle('is-off', off);
    legendButton.setAttribute('aria-pressed', off ? 'false' : 'true');
    legendButton.title = off ? 'Tampilkan legenda' : 'Sembunyikan legenda';
  });
}

fetch('/data/indonesia-province-simple.json')
  .then((response) => {
    if (!response.ok) throw new Error('GeoJSON peta lokal tidak dapat dimuat.');
    return response.json();
  })
  .then((geojson) => {
    const provinceLayer = L.geoJSON(geojson, {
      style: {
        color: '#54804a',
        weight: 1.15,
        opacity: 0.85,
        fillColor: '#2f4a25',
        fillOpacity: 0.66
      },
      onEachFeature: (feature, layer) => {
        const provinceName = feature.properties.Propinsi || feature.properties.name || 'Provinsi';
        layer.bindTooltip(provinceName, { sticky: true, className: 'province-tooltip' });
      }
    }).addTo(map);
    provinceBounds = provinceLayer.getBounds();
    map.attributionControl.setPrefix('GARUDA SHIELD');
    fitMapToEdges();
    if (pendingAttackView) { mapUserMoved = true; map.setView(pendingAttackView, 6); }
  })
  .catch((error) => {
    document.querySelector('#map-error').hidden = false;
    console.error(error);
  });

const clock = document.querySelector('#clock');
function updateClock() {
  clock.textContent = new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(new Date());
}

updateClock();
setInterval(updateClock, 1000);
selectSite('kodam-jaya');

/* Attack visualization from the red team console (?attack=<id>) */
const initialAttackId = new URLSearchParams(window.location.search).get('attack');

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (character) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]
  ));
}

function severityLabel(severity) {
  return ({ critical: 'KRITIS', high: 'TINGGI', medium: 'SEDANG', low: 'RENDAH' })[severity] || String(severity).toUpperCase();
}

function severityLevel(detections) {
  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  const worst = detections.reduce((accumulator, detection) => (
    order[detection.severity] < order[accumulator] ? detection.severity : accumulator
  ), 'low');
  return worst === 'critical' ? 'critical' : worst === 'high' ? 'high' : 'medium';
}

/* Warna jejak serangan pada peta — samakan dengan token palet TNI AD di garuda.css
   (crimson bendera, kuning emas, hijau tentara). */
const attackColor = { critical: '#cc5b53', high: '#e0b95f', medium: '#88b06c' };
const recoveryPlaybook = [
  'Isolasi aset terdampak',
  'Blokir sumber serangan pada IDS/IPS',
  'Terapkan aturan threat intelligence',
  'Verifikasi layanan kembali normal',
  'Tutup insiden dan dokumentasi'
];
let activeAttack = null;
let activeAttackMarker = null;

function focusAttack(attack) {
  if (!attack.site || typeof attack.site.lat !== 'number') return;
  pendingAttackView = [attack.site.lat, attack.site.lng];
  map.setView(pendingAttackView, 6, { animate: true });
}

function showAttackAlert(attack, level) {
  const alertElement = document.querySelector('#attack-alert');
  if (!alertElement) return;
  alertElement.hidden = false;
  alertElement.className = `attack-alert attack-alert-${level}`;
  const titleElement = document.querySelector('#attack-alert-title');
  const subElement = document.querySelector('#attack-alert-sub');
  if (titleElement) titleElement.textContent = `Serangan simulasi: ${attack.method.name}`;
  if (subElement) subElement.textContent = `${attack.site.name} · ${attack.detections.length} alert · ${attack.method.code} · ${attack.method.vector}`;
  /* Rincian target untuk strip sirene di bawah topbar. */
  const stripMeta = document.querySelector('#alarm-strip-meta');
  if (stripMeta) stripMeta.textContent = `${attack.site.code} · ${attack.site.name} · ${attack.method.code}`;
  const closeButton = document.querySelector('#attack-alert-close');
  if (closeButton) closeButton.onclick = () => { alertElement.hidden = true; };
}

/* Trace serangan: asal penyerang → target, disertai lingkaran ketidakpastian
   sesuai tingkat keyakinan lokasi (permit alaiiha)? rendah = radius luas. */
let attackTraceGroup = null;

function arcPoints(from, to, samples = 40) {
  const [lat1, lng1] = from;
  const [lat2, lng2] = to;
  const points = [];
  for (let index = 0; index <= samples; index += 1) {
    const t = index / samples;
    const lat = lat1 + (lat2 - lat1) * t;
    const lng = lng1 + (lng2 - lng1) * t + Math.sin(Math.PI * t) * (Math.abs(lat2 - lat1) + 8) * 0.14;
    points.push([lat, lng]);
  }
  return points;
}

function drawAttackTrace(attack, level) {
  if (attackTraceGroup) {
    map.removeLayer(attackTraceGroup);
    attackTraceGroup = null;
  }
  const origin = attack.attacker || {};
  const originLat = Number(origin.lat);
  const originLng = Number(origin.lng);
  const originIp = typeof origin.ip === 'string' ? origin.ip : '';
  const target = [attack.site.lat, attack.site.lng];
  const color = attackColor[level] || '#cc5b53';

  if (!Number.isFinite(originLat) || !Number.isFinite(originLng) || !originIp) return;

  attackTraceGroup = L.layerGroup().addTo(map);
  const confidence = Math.max(0, Math.min(100, Number(origin.confidence) || 50));
  const uncertainRadius = (300 + (100 - confidence) * 9) * 1000;

  L.circle([originLat, originLng], {
    radius: uncertainRadius, color, weight: 1, opacity: 0.55,
    fillColor: color, fillOpacity: 0.12, dashArray: '4 6', interactive: false
  }).addTo(attackTraceGroup);

  const flags = [origin.vpn ? 'VPN' : '', origin.tor ? 'TOR' : '', origin.proxy ? 'PROXY' : ''].filter(Boolean).join(' · ');
  const originPopup = `<div class="attack-popup-inner">
      <span class="attack-popup-head">ASAL SERANGAN (SIMULASI)</span>
      <strong class="attack-popup-title">${escapeHtml(origin.location || originIp)}</strong>
      <div class="attack-popup-det"><span class="attack-sev attack-sev-medium">KEYAKINAN</span><span class="attack-popup-det-title">${confidence}% · radius ${Math.round(uncertainRadius / 1000)} km</span></div>
      ${origin.provider ? `<div class="attack-popup-det-title">${escapeHtml(origin.provider)}</div>` : ''}
      ${flags ? `<div class="attack-popup-det"><span class="attack-sev attack-sev-low">ANONIM</span><span class="attack-popup-det-title">${flags}</span></div>` : ''}
      <div class="attack-popup-det-title">Posisi tampak bersifat simulasi; alamat asli tidak dapat dipastikan.</div>
    </div>`;

  L.marker([originLat, originLng], {
    icon: L.divIcon({
      className: 'attack-origin-icon',
      html: `<span class="attack-origin-marker" style="--attack-color:${color}"><span class="attack-origin-dot"></span><span class="attack-origin-label">ASAL SERANGAN · ${escapeHtml(originIp)}</span></span>`,
      iconSize: [0, 0]
    }),
    zIndexOffset: 1100
  }).addTo(attackTraceGroup).bindPopup(originPopup, { className: 'attack-popup', maxWidth: 300, autoPan: true, offset: [0, -6] });

  L.polyline(arcPoints([originLat, originLng], target), {
    color, weight: 2, opacity: 0.9, dashArray: '6 8', interactive: false
  }).addTo(attackTraceGroup);
}

function renderAttack(attack) {
  const site = attack.site;
  if (!site || typeof site.lat !== 'number') return;
  const level = severityLevel(attack.detections);
  const frame = document.querySelector('#map-frame');
  if (frame) frame.style.setProperty('--attack-color', attackColor[level]);

  focusAttack(attack);
  if (siteData.some((candidate) => candidate.id === site.id)) selectSite(site.id);

  if (activeAttackMarker) map.removeLayer(activeAttackMarker);
  activeAttack = attack;
  activeAttackMarker = L.marker([site.lat, site.lng], {
    icon: L.divIcon({
      className: 'attack-icon',
      html: `<span class="attack-marker attack-marker-${level}"><span class="attack-ring"></span><span class="attack-ring"></span><span class="attack-ring"></span><span class="attack-core"></span><span class="attack-label">SERANGAN · ${escapeHtml(site.code)}</span></span>`,
      iconSize: [0, 0]
    }),
    zIndexOffset: 1200,
    interactive: false
  }).addTo(map);

  drawAttackTrace(attack, level);

  const detections = attack.detections.length
    ? attack.detections.map((detection) => `<div class="attack-popup-det"><span class="attack-sev attack-sev-${escapeHtml(detection.severity)}">${escapeHtml(severityLabel(detection.severity))}</span><span class="attack-popup-rule">${escapeHtml(detection.ruleId)}</span><span class="attack-popup-det-title">${escapeHtml(detection.title)}</span></div>`).join('')
    : '<div class="attack-popup-det-title">Tidak ada deteksi.</div>';
  const responses = (attack.responses || []).map((step) => `<li>${escapeHtml(step)}</li>`).join('');

  const popup = `<div class="attack-popup-inner">
      <img class="popup-thumb attack-popup-thumb" src="/thumbs/${encodeURIComponent(site.id)}.jpg" alt="" loading="lazy" onerror="this.remove()">
      <span class="attack-popup-head">SIMULASI SERANGAN · ${escapeHtml(attack.method.code)}</span>
      <strong class="attack-popup-title">${escapeHtml(attack.method.name)} → ${escapeHtml(site.name)}</strong>
      <div>${detections}</div>
      ${responses ? `<ul class="attack-popup-responses">${responses}</ul>` : ''}
      <a class="attack-popup-open" href="${escapeHtml(attack.url)}" target="_blank" rel="noopener">Buka situs dummy target  ↗</a>
    </div>`;

  L.popup({ className: 'attack-popup', maxWidth: 320, autoPan: true, offset: [0, -6], closeButton: true })
    .setLatLng([site.lat, site.lng])
    .setContent(popup)
    .openOn(map);

  showAttackAlert(attack, level);
  startAlarm();
  markProbeAttack(attack);
  runAiAnalysis(attack);
  notifyAttack(attack);
}

/* Incident alarm — file sirine serangan udara (mp3 loop); fallback Web Audio wail naik-turun */
const alarmAudio = document.querySelector('#alarm-audio');
const alarmButton = document.querySelector('#alarm-toggle');
let alarmMuted = false;
let alarmPrimed = false;
try { alarmMuted = localStorage.getItem('garuda-alarm-muted') === '1'; } catch (error) {}

let alarmCtx = null;
let alarmGain = null;
let sirenOscs = null;

/* Status wail Web Audio. Dicatat terpisah karena AudioParam.gain.value TIDAK
   mengikuti otomatisasi terjadwal (setTargetAtTime) — nilai statisnya tetap
   0.0001, sehingga pemeriksaan "apakah sirene sedang berbunyi" lewat nilai gain
   selalu mengembalikan false dan sirene cadangan tidak pernah terdeteksi. */
let sirenActive = false;

function openSiren() {
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return false;
  if (!alarmCtx) {
    alarmCtx = new AudioCtor();
    alarmGain = alarmCtx.createGain();
    alarmGain.gain.value = 0.0001;
    alarmGain.connect(alarmCtx.destination);
    const carrier = alarmCtx.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.value = 420;
    const sweep = alarmCtx.createOscillator();
    sweep.type = 'sine';
    sweep.frequency.value = 0.35;
    const sweepDepth = alarmCtx.createGain();
    sweepDepth.gain.value = 330;
    sweep.connect(sweepDepth).connect(carrier.frequency);
    carrier.connect(alarmGain);
    carrier.start();
    sweep.start();
    sirenOscs = [carrier, sweep];
  }
  return true;
}

/**
 * Whether the fallback wail is currently sounding.
 *
 * Must not inspect `alarmGain.gain.value`: AudioParam does not reflect
 * scheduled automation, so the static value stays at 0.0001 forever and the
 * wail would look silent even while it is playing.
 *
 * @returns {boolean}
 */
function sirenRunning() {
  return sirenActive && Boolean(alarmCtx && alarmCtx.state !== 'closed');
}

function startSiren() {
  if (!openSiren()) return false;
  if (alarmCtx.state === 'suspended' && typeof alarmCtx.resume === 'function') alarmCtx.resume().catch(() => {});
  const now = alarmCtx.currentTime;
  alarmGain.gain.cancelScheduledValues(now);
  alarmGain.gain.setTargetAtTime(0.12, now, 0.08);
  sirenActive = true;
  return true;
}

function stopSiren(hard) {
  if (!alarmCtx || !alarmGain) return;
  sirenActive = false;
  const now = alarmCtx.currentTime;
  alarmGain.gain.cancelScheduledValues(now);
  alarmGain.gain.setTargetAtTime(0.0001, now, 0.04);
  if (hard === true) setTimeout(cleanupSiren, 320);
}

function cleanupSiren() {
  sirenActive = false;
  if (sirenOscs) {
    for (const osc of sirenOscs) {
      try { osc.stop(); } catch (error) {}
    }
    sirenOscs = null;
  }
  if (alarmCtx) {
    try { alarmCtx.close(); } catch (error) {}
  }
  alarmCtx = null;
  alarmGain = null;
}

/* Indikator sirene yang lebih terlihat: strip peringatan di bawah topbar dan
   tanda "sirene dimatikan" pada banner serangan. */
const alarmStrip = document.querySelector('#alarm-strip');
const alarmStripMeta = document.querySelector('#alarm-strip-meta');
const alarmMuteTag = document.querySelector('#alarm-mute-tag');

/* Apakah sirene sedang berbunyi? Sumber kebenarannya hanya dua: file mp3 yang
   benar-benar diputar, atau wail Web Audio yang sudah dinyalakan.
   Volume 0 berarti audio hanya dipakai untuk membuka izin pemutaran (primer),
   bukan benar-benar berbunyi. */
function alarmSounding() {
  if (alarmMuted) return false;
  if (alarmAudio && !alarmAudio.paused && alarmAudio.volume > 0.01) return true;
  return sirenRunning();
}

function syncAlarmIndicators() {
  const sounding = alarmSounding();
  if (alarmStrip) alarmStrip.hidden = !sounding;
  if (alarmMuteTag) alarmMuteTag.hidden = !alarmMuted;
  document.body.classList.toggle('alarm-live', sounding);
}

function updateAlarmButton(active) {
  syncAlarmIndicators();
  if (!alarmButton) return;
  alarmButton.hidden = false;
  if (!active) {
    /* Standby: tombol tetap tampil — ALARM SIAP sebelum/ALARM NONAKTIF bila dimatikan. */
    alarmButton.classList.remove('blocked', 'on');
    alarmButton.classList.toggle('muted', alarmMuted);
    alarmButton.classList.toggle('ready', alarmPrimed && !alarmMuted);
    alarmButton.setAttribute('aria-pressed', String(!alarmMuted));
    alarmButton.textContent = alarmMuted ? 'ALARM NONAKTIF' : 'ALARM SIAP';
    return;
  }
  alarmButton.classList.toggle('muted', alarmMuted);
  alarmButton.classList.remove('blocked');
  alarmButton.classList.toggle('on', !alarmMuted);
  alarmButton.setAttribute('aria-pressed', String(!alarmMuted));
  alarmButton.textContent = alarmMuted ? 'ALARM OFF' : 'ALARM ON';
}

function startAlarm() {
  updateAlarmButton(true);
  if (alarmMuted) return;
  if (alarmAudio) {
    alarmAudio.volume = 0.85;
    alarmAudio.loop = true;
    const playback = alarmAudio.play();
    /* Pemutaran dimulai belakangan (promise), jadi indikator disinkronkan lagi
       tepat setelah sirene benar-benar berbunyi atau setelah cadangan wail
       dinyalakan — bukan di awal, saat audio masih diam. */
    if (playback && typeof playback.then === 'function') {
      playback.then(syncAlarmIndicators).catch(() => {
        if (!startSiren() && alarmButton) {
          alarmButton.classList.add('blocked');
          alarmButton.textContent = 'AKTIFKAN ALARM';
        }
        syncAlarmIndicators();
      });
    }
    return;
  }
  startSiren();
  syncAlarmIndicators();
}

function stopAlarm() {
  stopSiren(true);
  if (alarmAudio) {
    alarmAudio.pause();
    try { alarmAudio.currentTime = 0; } catch (error) {}
  }
  updateAlarmButton(false);
}

if (alarmButton) {
  alarmButton.addEventListener('click', () => {
    const playing = alarmSounding();
    if (playing) {
      /* Sirene berbunyi: klik menonaktifkan (mute, tersimpan antar sesi). */
      alarmMuted = true;
      try { localStorage.setItem('garuda-alarm-muted', '1'); } catch (error) {}
      stopAlarm();
      return;
    }
    if (alarmMuted) {
      /* Dari keadaan nonaktif: buka kembali jalur suara; saat insiden masih aktif langsung bunyi lagi. */
      alarmMuted = false;
      try { localStorage.setItem('garuda-alarm-muted', '0'); } catch (error) {}
      primeAlarm();
      if (activeAttack && !activeAttack.resolved) startAlarm();
      else updateAlarmButton(false);
      return;
    }
    if (!alarmPrimed) {
      /* Standby klik pertama: buka jalur suara tanpa bunyi. */
      primeAlarm();
      updateAlarmButton(false);
      return;
    }
    /* Primer terbuka: klik menyala-kan sirene uji manual; klik lagi untuk mute. */
    startAlarm();
  });
}

/* Unlock autoplay: kebijakan browser hanya mengizinkan suara setelah pengguna
   berinteraksi. Pada interaksi pertama (klik/sentuh/tekan), jika insiden masih
   aktif, sirine langsung dinyalakan oleh gestur tersebut. */
function primeAlarm() {
  if (alarmCtx) {
    if (alarmCtx.state === 'suspended') {
      alarmCtx.resume().then(() => { alarmPrimed = true; if (!sirenRunning()) updateAlarmButton(false); }).catch(() => {});
    } else alarmPrimed = true;
  }
  if (!alarmAudio || !alarmAudio.paused) return;
  const restoreVolume = alarmAudio.volume;
  alarmAudio.volume = 0;
  alarmAudio.play().then(() => {
    /* Izin pemutaran sudah terbuka. Periksa dulu sebelum mengembalikan volume:
       bila sirene justru baru dinyalakan kembali di antara keduanya (mis. tombol
       alarm diaktifkan lagi saat insiden masih berjalan), jangan diamkan — itu
       akan mematikan sirene yang baru saja hidup. */
    const soundingElsewhere = alarmSounding();
    alarmPrimed = true;
    alarmAudio.volume = restoreVolume;
    if (soundingElsewhere) return;
    alarmAudio.pause();
    alarmAudio.currentTime = 0;
    if (!sirenRunning()) updateAlarmButton(false);
  }).catch(() => { alarmAudio.volume = restoreVolume; });
}

function alarmUnlockAttempt() {
  primeAlarm();
  if (activeAttack && !activeAttack.resolved) startAlarm();
}

document.addEventListener('pointerdown', alarmUnlockAttempt, { once: true });
document.addEventListener('keydown', alarmUnlockAttempt, { once: true });

/* Gate izin demonstrasi: saat juri membuka halaman, sekali klik memakai gestur
   untuk membuka audio (prime), meminta GPS, dan meminta izin notifikasi. */
(() => {
  const overlay = document.querySelector('#perm-overlay');
  if (!overlay) return;
  const allowButton = document.querySelector('#perm-allow');
  const skipButton = document.querySelector('#perm-skip');
  const locBadge = document.querySelector('#cmd-loc');

  function closeOverlay(denied) {
    overlay.hidden = true;
    try { localStorage.setItem('garuda-perm-choice', denied ? 'skip' : 'allow'); } catch (error) {}
  }

  function confirmPermission() {
    closeOverlay(false);
    primeAlarm();
    if ('Notification' in window && Notification.permission === 'default') {
      try { Notification.requestPermission().catch(() => {}); } catch (error) {}
    }
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        if (locBadge) {
          locBadge.hidden = false;
          locBadge.textContent = `◈ POS KOMANDO · ${position.coords.latitude.toFixed(2)}, ${position.coords.longitude.toFixed(2)}`;
        }
        try {
          localStorage.setItem('garuda-command-location', JSON.stringify({
            lat: position.coords.latitude, lng: position.coords.longitude, at: Date.now()
          }));
        } catch (storageError) {}
      }, () => {}, { enableHighAccuracy: true, timeout: 9000, maximumAge: 60000 });
    }
  }

  function maybeShowOverlay() {
    let choice = '';
    try { choice = localStorage.getItem('garuda-perm-choice') || ''; } catch (error) {}
    if (choice) return;
    overlay.hidden = false;
  }

  if (allowButton) allowButton.addEventListener('click', confirmPermission);
  if (skipButton) skipButton.addEventListener('click', () => closeOverlay(true));
  maybeShowOverlay();
})();

/* Notifikasi serangan (butuh izin Notification di gate atas) */
function notifyAttack(attack) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification(`SERANGAN SIMULASI · ${attack.method.code}`, {
      body: `${attack.method.name} → ${attack.site.name} · ${attack.detections.length} alert`,
      tag: 'garuda-attack'
    });
  } catch (error) {}
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function renderRecovery(steps, done) {
  const list = document.querySelector('#ai-recovery');
  if (!list) return;
  list.innerHTML = '';
  steps.forEach((step) => {
    const item = document.createElement('li');
    if (done) item.classList.add('done');
    item.innerHTML = `<span class="step-mark">${done ? '✓' : '○'}</span><span>${escapeHtml(step)}</span>`;
    list.appendChild(item);
  });
}

function stopAttackAnimation() {
  stopAlarm();
  if (activeAttackMarker) {
    map.removeLayer(activeAttackMarker);
    activeAttackMarker = null;
  }
  if (attackTraceGroup) {
    map.removeLayer(attackTraceGroup);
    attackTraceGroup = null;
  }
  map.closePopup();
  const frame = document.querySelector('#map-frame');
  if (frame) frame.style.setProperty('--attack-color', '#88b06c');
  const alertElement = document.querySelector('#attack-alert');
  if (alertElement) {
    alertElement.className = 'attack-alert attack-alert-medium';
    const titleElement = document.querySelector('#attack-alert-title');
    const subElement = document.querySelector('#attack-alert-sub');
    if (titleElement) titleElement.textContent = 'Insiden tertangani · situs pulih';
    if (subElement) subElement.textContent = 'Situs dipulihkan · animasi serangan dihentikan';
  }
}

function completeRecovery() {
  const list = document.querySelector('#ai-recovery');
  if (list) list.querySelectorAll('li').forEach((item) => {
    item.classList.remove('active');
    item.classList.add('done');
    const mark = item.querySelector('.step-mark');
    if (mark) mark.textContent = '✓';
  });
  const statusElement = document.querySelector('#ai-status');
  if (statusElement) {
    statusElement.className = 'ai-status ai-status-safe';
    statusElement.innerHTML = '<i></i> AMAN · SITUS PULIH';
  }
  stopAttackAnimation();
  clearProbeAttack();
  if (activeAttack) {
    resolveAlerts(activeAttack);
    markRecovered(activeAttack);
  }
}

async function animateRecovery() {
  const items = [...document.querySelectorAll('#ai-recovery li')];
  const recoverButton = document.querySelector('#ai-recover');
  if (recoverButton) recoverButton.disabled = true;
  for (const item of items) {
    if (item.classList.contains('done')) continue;
    item.classList.add('active');
    await delay(520);
    item.classList.remove('active');
    item.classList.add('done');
    const mark = item.querySelector('.step-mark');
    if (mark) mark.textContent = '✓';
  }
  completeRecovery();
}

function resolveAlerts(attack) {
  (attack.detections || []).forEach((detection) => {
    if (!Number.isSafeInteger(detection.id)) return;
    fetch(`/alerts/${detection.id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'status=resolved'
    }).catch(() => {});
  });
}

function markRecovered(attack) {
  fetch('/api/pulihkan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ attackId: attack.id })
  }).catch(() => {});
}

function showAiLoading(attack) {
  const empty = document.querySelector('#ai-empty');
  const content = document.querySelector('#ai-content');
  if (empty) empty.hidden = true;
  if (content) content.hidden = false;
  const statusElement = document.querySelector('#ai-status');
  if (statusElement) {
    statusElement.className = 'ai-status ai-status-loading';
    statusElement.innerHTML = '<i></i> MENGANALISIS…';
  }
  const confidence = document.querySelector('#ai-confidence');
  if (confidence) confidence.textContent = '—';
  const target = document.querySelector('#ai-target');
  if (target) target.textContent = `${attack.site.code} · ${attack.method.code}`;
  const summary = document.querySelector('#ai-summary');
  if (summary) summary.textContent = 'AI menilai insiden dan langkah pemulihan pada koordinat target…';
  const actions = document.querySelector('#ai-actions');
  if (actions) actions.innerHTML = '';
  const recovery = document.querySelector('#ai-recovery');
  if (recovery) recovery.innerHTML = '';
  const originList = document.querySelector('#ai-origin-list');
  if (originList) originList.innerHTML = '';
  const originNote = document.querySelector('#ai-origin-note');
  if (originNote) originNote.textContent = 'Melacak asal koneksi dari metadata simulasi…';
  const recoverButton = document.querySelector('#ai-recover');
  if (recoverButton) recoverButton.disabled = true;
  const reportLink = document.querySelector('#ai-report');
  if (reportLink) reportLink.hidden = true;
  const runButton = document.querySelector('#ai-run');
  if (runButton) runButton.disabled = true;
}

function renderOrigins(analysis) {
  const list = document.querySelector('#ai-origin-list');
  const note = document.querySelector('#ai-origin-note');
  const origins = Array.isArray(analysis.origins) ? analysis.origins : [];
  if (list) {
    list.innerHTML = origins.length
      ? origins.map((origin) => {
        const flags = [];
        if (origin.kind === 'internal') flags.push('<span class="origin-flag flag-internal">INTERNAL</span>');
        if (origin.vpn) flags.push('<span class="origin-flag flag-vpn">VPN</span>');
        if (origin.tor) flags.push('<span class="origin-flag flag-tor">TOR</span>');
        if (origin.proxy) flags.push('<span class="origin-flag flag-proxy">PROXY</span>');
        if (origin.kind === 'unknown' || origin.kind === 'public') flags.push('<span class="origin-flag flag-unknown">LOKASI TAK PASTI</span>');
        const confidence = Math.max(0, Math.min(100, Number(origin.confidence) || 0));
        const provider = [origin.asn, origin.provider].filter(Boolean).join(' · ');
        return `<div class="origin-item">
          <div class="origin-head"><code>${escapeHtml(origin.ip || '—')}</code><span class="origin-flags">${flags.join('')}</span></div>
          <div class="origin-loc"><strong>${escapeHtml(origin.apparentLocation || 'Tidak diketahui')}</strong><small>${escapeHtml(provider || '—')}</small></div>
          <div class="origin-conf"><span class="origin-bar"><i style="width:${confidence}%"></i></span><span>${confidence}% keyakinan lokasi tampak</span></div>
          <p class="origin-note">${escapeHtml(origin.note || '')}</p>
        </div>`;
      }).join('')
      : '<div class="origin-empty">Tidak ada metadata alamat sumber pada insiden ini.</div>';
  }
  if (note) {
    const caveat = 'Pelacakan berbasis metadata koneksi. Alamat asli di balik VPN/Tor tidak dapat dipastikan tanpa data tambahan.';
    note.textContent = analysis.attribution ? `${analysis.attribution} ${caveat}` : caveat;
  }
}

function renderAi(analysis, attack) {
  const empty = document.querySelector('#ai-empty');
  const content = document.querySelector('#ai-content');
  if (empty) empty.hidden = true;
  if (content) content.hidden = false;

  const safe = analysis.status === 'aman';
  const statusElement = document.querySelector('#ai-status');
  if (statusElement) {
    statusElement.className = `ai-status ${safe ? 'ai-status-safe' : 'ai-status-action'}`;
    statusElement.innerHTML = `<i></i> ${safe ? 'AMAN' : 'BUTUH TINDAKAN'}`;
  }
  const confidence = document.querySelector('#ai-confidence');
  if (confidence) confidence.textContent = `KEYAKINAN ${analysis.confidence}%`;
  const target = document.querySelector('#ai-target');
  if (target) target.textContent = `${attack.site.code} · ${attack.method.code} · ${attack.site.name}`;
  const summary = document.querySelector('#ai-summary');
  if (summary) summary.textContent = analysis.summary;
  const actions = document.querySelector('#ai-actions');
  if (actions) {
    const list = analysis.actions && analysis.actions.length ? analysis.actions : ['Tidak ada tindakan tambahan.'];
    actions.innerHTML = list.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  }
  const model = document.querySelector('#ai-model');
  if (model) model.textContent = analysis.model;
  const meta = document.querySelector('#ai-meta');
  if (meta) meta.textContent = `Model: ${analysis.model} · Sumber: ${analysis.source === 'groq' ? 'Groq API' : 'Heuristik lokal'}${analysis.note ? ` · ${analysis.note}` : ''}`;

  const recoverButton = document.querySelector('#ai-recover');
  if (recoverButton) recoverButton.disabled = false;
  const recoveredNote = document.querySelector('#ai-recovered-note');
  if (recoveredNote) recoveredNote.hidden = !analysis.recovered;
  const reportLink = document.querySelector('#ai-report');
  if (reportLink && attack.id) {
    reportLink.href = `/laporan/${encodeURIComponent(attack.id)}`;
    reportLink.hidden = false;
  }
  const runButton = document.querySelector('#ai-run');
  if (runButton) runButton.disabled = false;

  renderRecovery(recoveryPlaybook, false);
  renderOrigins(analysis);
}

async function runAiAnalysis(attack, force = false) {
  showAiLoading(attack);
  const thinkingSteps = [
    'Mengumpulkan bukti event pada koordinat target…',
    'Mengorelasikan rantai serangan lintas zona…',
    'Memeriksa deteksi & menilai tingkat dampak…',
    'Melacak sidik jari asal koneksi dari metadata…',
    'Menyusun rekomendasi penanganan…'
  ];
  const summaryElement = document.querySelector('#ai-summary');
  if (summaryElement) summaryElement.classList.add('thinking');
  let stageIndex = 0;
  const stageTimer = summaryElement
    ? window.setInterval(() => {
      summaryElement.textContent = thinkingSteps[stageIndex % thinkingSteps.length];
      stageIndex += 1;
    }, 550)
    : null;
  const [response] = await Promise.all([
    fetch('/api/analisis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attackId: attack.id, force })
    }),
    delay(1100)
  ]);
  if (stageTimer) window.clearInterval(stageTimer);
  if (summaryElement) summaryElement.classList.remove('thinking');
  try {
    if (!response.ok) throw new Error('Analisis gagal.');
    renderAi(await response.json(), attack);
  } catch (error) {
    const statusElement = document.querySelector('#ai-status');
    if (statusElement) {
      statusElement.className = 'ai-status ai-status-action';
      statusElement.innerHTML = '<i></i> ANALISIS GAGAL';
    }
    const actions = document.querySelector('#ai-actions');
    if (actions) actions.innerHTML = '<li>Analisis AI tidak dapat dimuat. Coba lagi.</li>';
    const runButton = document.querySelector('#ai-run');
    if (runButton) runButton.disabled = false;
  }
}

const aiRunButton = document.querySelector('#ai-run');
if (aiRunButton) aiRunButton.addEventListener('click', () => { if (activeAttack) runAiAnalysis(activeAttack, true); });
const aiRecoverButton = document.querySelector('#ai-recover');
if (aiRecoverButton) aiRecoverButton.addEventListener('click', () => { animateRecovery(); });

function focusMapTab() {
  const mapElement = document.querySelector('#map-frame');
  if (mapElement) mapElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
  try { window.focus(); } catch (error) {}
}

function loadAttack(id, focus = true) {
  let attempt = 0;
  const fetchAttack = () => {
    fetch(`/api/serangan/${encodeURIComponent(id)}`)
      .then((response) => {
        if (!response.ok) throw new Error('Serangan belum tersedia.');
        return response.json();
      })
      .then((attack) => {
        if (attack.resolved) return;
        viewedAttackId = attack.id;
        renderAttack(attack);
        if (focus) focusMapTab();
      })
      .catch(() => {
        attempt += 1;
        if (attempt < 15) setTimeout(fetchAttack, 400);
      });
  };
  fetchAttack();
}

/* Heartbeat so the console can detect this dashboard tab */
function beat() {
  try { localStorage.setItem('garuda-watch-heartbeat', String(Date.now())); } catch (error) {}
}
beat();
setInterval(beat, 1500);

/* Listen for attacks pushed from the red team console (same origin) */
if ('BroadcastChannel' in window) {
  const attackChannel = new BroadcastChannel('garuda-attacks');
  attackChannel.onmessage = (event) => {
    const data = event.data;
    if (data && data.type === 'attack' && typeof data.attackId === 'string') loadAttack(data.attackId);
  };
}

if (initialAttackId) {
  loadAttack(initialAttackId, true);
} else {
  fetch('/api/insiden-aktif')
    .then((response) => (response.ok ? response.json() : { active: null }))
    .then((data) => {
      if (data && data.active && typeof data.active.id === 'string') loadAttack(data.active.id, false);
    })
    .catch(() => {});
}

/* Polling insiden aktif: serangan yang diluncurkan dari konsol CLI (sumber
   lintas-origin, tidak bisa memakai BroadcastChannel) tetap tampil otomatis
   di dashboard yang sudah terbuka — tanpa refresh halaman. */
let viewedAttackId = initialAttackId || null;
setInterval(() => {
  fetch('/api/insiden-aktif')
    .then((response) => (response.ok ? response.json() : { active: null }))
    .then((data) => {
      const active = data && data.active;
      if (active && typeof active.id === 'string' && !active.resolved) {
        if (active.id !== viewedAttackId) loadAttack(active.id, true);
        return;
      }
      /* Direlewasi dari luar (CLI 'pulihkan' atau diatasi dari sisi lain) →
         hentikan animasi + sirine pada dashboard. */
      if (!active && viewedAttackId && activeAttack && !activeAttack.resolved) {
        viewedAttackId = null;
        stopAttackAnimation();
      }
    })
    .catch(() => {});
}, 2000);

/* Site probe simulation */
const probeBody = document.querySelector('#probe-body');
const probeRowEls = probeBody ? [...probeBody.querySelectorAll('.probe-row')] : [];
const probeRunButton = document.querySelector('#probe-run');
const probeSort = document.querySelector('#probe-sort');
const probeCountEls = {
  online: document.querySelector('#probe-count-online'),
  warning: document.querySelector('#probe-count-warning'),
  offline: document.querySelector('#probe-count-offline'),
  maintenance: document.querySelector('#probe-count-maintenance')
};
const probeConditionLabels = { online: 'NORMAL', warning: 'LATENSI TINGGI', offline: 'TIDAK MERESPONS', maintenance: 'PEMELIHARAAN' };
const probeStatusOrder = { offline: 0, warning: 1, maintenance: 2, online: 3 };
let probeFilter = 'all';
let probing = false;

function formatAgo(seconds) {
  if (seconds < 5) return 'baru saja';
  if (seconds < 60) return `${seconds} dtk lalu`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} mnt lalu`;
  return `${Math.floor(minutes / 60)} jam lalu`;
}

function updateProbeTime(row) {
  const cell = row.querySelector('[data-checked]');
  if (cell) cell.textContent = formatAgo(Number(row.dataset.checkedSec) || 0);
}

function probeTick() {
  probeRowEls.forEach((row) => {
    row.dataset.checkedSec = String((Number(row.dataset.checkedSec) || 0) + 1);
    updateProbeTime(row);
  });
}

function recomputeProbeCounts() {
  const counts = { online: 0, warning: 0, offline: 0, maintenance: 0 };
  probeRowEls.forEach((row) => { counts[row.dataset.status] = (counts[row.dataset.status] || 0) + 1; });
  Object.entries(probeCountEls).forEach(([key, element]) => { if (element) element.textContent = counts[key] || 0; });
}

function applyProbeFilter() {
  probeRowEls.forEach((row) => {
    row.hidden = !(probeFilter === 'all' || row.dataset.status === probeFilter);
  });
}

function sortProbeRows() {
  const mode = probeSort ? probeSort.value : 'status';
  const sorted = [...probeRowEls].sort((left, right) => {
    /* Baris situs yang diserang selalu di atas agar tetap fokus */
    const leftHit = left.classList.contains('attacked') ? 1 : 0;
    const rightHit = right.classList.contains('attacked') ? 1 : 0;
    if (leftHit !== rightHit) return rightHit - leftHit;
    if (mode === 'latency-desc' || mode === 'latency-asc') {
      const leftValue = Number(left.dataset.baseLatency) || 0;
      const rightValue = Number(right.dataset.baseLatency) || 0;
      return mode === 'latency-desc' ? rightValue - leftValue : leftValue - rightValue;
    }
    if (mode === 'checked') return (Number(left.dataset.checkedSec) || 0) - (Number(right.dataset.checkedSec) || 0);
    if (mode === 'name') return left.dataset.name.localeCompare(right.dataset.name);
    return (probeStatusOrder[left.dataset.status] ?? 9) - (probeStatusOrder[right.dataset.status] ?? 9);
  });
  sorted.forEach((row) => probeBody.appendChild(row));
}

/* Serangan: sorot baris situs target + burukkan nilai respon & latensi sampai dipulihkan */
let attackedProbeRow = null;
const probeAttackProfiles = {
  critical: { response: '503', note: 'LAYANAN JATUH', loss: 62, spike: 3.1 },
  high: { response: '503', note: 'DEGRADASI', loss: 31, spike: 2.4 },
  medium: { response: '403', note: 'TERBLOKIR', loss: 12, spike: 1.7 }
};

function focusProbeRow(row) {
  const wrap = probeBody.closest('.probe-table-wrap');
  if (!wrap) return;
  wrap.scrollTo({ top: Math.max(0, row.offsetTop - wrap.clientHeight / 2), behavior: 'smooth' });
}

function applyProbeAttackEffects(row, level) {
  const base = Number(row.dataset.baseLatency) || 0;
  const profile = probeAttackProfiles[level] || probeAttackProfiles.medium;
  const value = Math.max(240, Math.round(base * profile.spike * (0.9 + Math.random() * 0.25)));
  const latencyCell = row.querySelector('[data-latency]');
  const latencyBar = row.querySelector('[data-lat-bar]');
  const lossCell = row.querySelector('[data-loss]');
  const responseCell = row.querySelector('[data-response]');
  const conditionCell = row.querySelector('[data-condition]');

  /* Latensi melonjak, keep hilang tiba-tiba, respon gagal — efek tampil terus sampai pemulihan */
  if (latencyCell) latencyCell.textContent = `${value} ms`;
  if (latencyBar) {
    latencyBar.style.width = `${Math.min(100, Math.round(value / 9))}%`;
    latencyBar.style.background = 'var(--red)';
  }
  if (lossCell) lossCell.textContent = `${Math.min(100, Math.round(profile.loss * (0.8 + Math.random() * 0.4)))}%`;
  if (responseCell) responseCell.textContent = profile.response;
  if (conditionCell) {
    conditionCell.textContent = `SERANGAN · ${profile.note}`;
    conditionCell.className = 'condition condition-attacked';
  }
  /* Simpan latensi terdampak agar urutan latensi mengangkat baris ini ke posisi atas */
  row.dataset.baseLatency = String(value);
  row.dataset.checkedSec = '0';
  updateProbeTime(row);
  row.classList.remove('probe-flash');
}

function markProbeAttack(attack) {
  if (!probeBody || !attack.site) return;
  clearProbeAttack();
  const row = probeRowEls.find((candidate) => candidate.dataset.siteId === attack.site.id);
  if (!row) return;
  attackedProbeRow = row;
  row.classList.add('attacked');
  row.hidden = false; /* tembus filter agar baris terdampak tetap terlihat */
  applyProbeAttackEffects(row, severityLevel(attack.detections || []));
  focusProbeRow(row);
  recomputeProbeCounts();
  sortProbeRows();
}

function clearProbeAttack() {
  const row = attackedProbeRow;
  if (!row) return;
  attackedProbeRow = null;
  row.classList.remove('attacked');
  const latencyBar = row.querySelector('[data-lat-bar]');
  const conditionCell = row.querySelector('[data-condition]');
  if (latencyBar) latencyBar.style.background = '';
  if (conditionCell) conditionCell.className = `condition condition-${row.dataset.status}`;
  /* Kembalikan latensi dasar dari data situs, lalu isi ulang nilai normal */
  const site = siteData.find((candidate) => candidate.id === row.dataset.siteId);
  if (site) row.dataset.baseLatency = String(Number(site.latency) || 0);
  applyProbeResult(row);
  recomputeProbeCounts();
  applyProbeFilter();
  sortProbeRows();
}

function applyProbeResult(row) {
  const status = row.dataset.status;
  const base = Number(row.dataset.baseLatency) || 0;
  const latencyCell = row.querySelector('[data-latency]');
  const latencyBar = row.querySelector('[data-lat-bar]');
  const lossCell = row.querySelector('[data-loss]');
  const responseCell = row.querySelector('[data-response]');
  const tlsCell = row.querySelector('[data-tls]');
  const conditionCell = row.querySelector('[data-condition]');

  if (status === 'offline') {
    if (latencyCell) latencyCell.textContent = '—';
    if (latencyBar) { latencyBar.style.width = '100%'; latencyBar.style.background = 'var(--red)'; }
    if (lossCell) lossCell.textContent = '100%';
    if (responseCell) responseCell.textContent = 'TIMEOUT';
    if (tlsCell) tlsCell.textContent = '—';
  } else {
    const factor = status === 'warning' ? 0.7 + Math.random() * 0.55 : 0.85 + Math.random() * 0.3;
    const value = Math.max(18, Math.round(base * factor));
    if (latencyCell) latencyCell.textContent = `${value} ms`;
    if (latencyBar) { latencyBar.style.width = `${Math.min(100, Math.round(value / 9))}%`; latencyBar.style.background = ''; }
    if (lossCell) lossCell.textContent = status === 'warning' ? `${2 + Math.round(Math.random() * 7)}%` : '0%';
    if (responseCell) responseCell.textContent = status === 'warning' ? '503' : '200';
    if (tlsCell) tlsCell.textContent = status === 'warning' ? 'TLS 1.2' : 'TLS 1.3';
  }

  if (conditionCell) {
    conditionCell.textContent = probeConditionLabels[status] || status.toUpperCase();
    conditionCell.className = `condition condition-${status}`;
  }
  row.dataset.checkedSec = '0';
  updateProbeTime(row);
  row.classList.add('probe-flash');
  setTimeout(() => row.classList.remove('probe-flash'), 600);
}

async function runProbe() {
  if (probing) return;
  probing = true;
  if (probeRunButton) { probeRunButton.disabled = true; probeRunButton.classList.add('running'); }
  const rows = probeRowEls.filter((row) => !row.hidden);
  rows.forEach((row) => row.classList.add('probing'));
  for (const row of rows) {
    await delay(60 + Math.random() * 120);
    row.classList.remove('probing');
    /* Situs yang masih terdampak serangan tidak dinormalisasi oleh pemeriksaan manual */
    if (row === attackedProbeRow) continue;
    applyProbeResult(row);
  }
  recomputeProbeCounts();
  sortProbeRows();
  probing = false;
  if (probeRunButton) { probeRunButton.disabled = false; probeRunButton.classList.remove('running'); }
}

if (probeRunButton) probeRunButton.addEventListener('click', runProbe);
document.querySelectorAll('.probe-filter').forEach((button) => {
  button.addEventListener('click', () => {
    probeFilter = button.dataset.filter;
    document.querySelectorAll('.probe-filter').forEach((item) => item.classList.toggle('active', item === button));
    applyProbeFilter();
  });
});
if (probeSort) probeSort.addEventListener('change', sortProbeRows);

probeRowEls.forEach(updateProbeTime);
recomputeProbeCounts();
sortProbeRows();
setInterval(probeTick, 1000);
/* Toggle minimalkan panel kiri */
(() => {
  const railToggle = document.querySelector('#rail-toggle');
  if (!railToggle) return;
  try {
    /* Default tertutup; hanya buka kembali jika pengguna pernah membukanya. */
    if (localStorage.getItem('gs-rail-collapsed') === '0') document.body.classList.remove('rail-collapsed');
    else document.body.classList.add('rail-collapsed');
  } catch (error) {
    document.body.classList.add('rail-collapsed');
  }
  railToggle.setAttribute('aria-pressed', document.body.classList.contains('rail-collapsed') ? 'true' : 'false');
  railToggle.addEventListener('click', () => {
    const collapsed = document.body.classList.toggle('rail-collapsed');
    railToggle.setAttribute('aria-pressed', collapsed ? 'true' : 'false');
    try { localStorage.setItem('gs-rail-collapsed', collapsed ? '1' : '0'); } catch (error) {}
    setTimeout(() => { if (typeof map !== 'undefined' && map.invalidateSize) map.invalidateSize(); }, 240);
  });
})();
/* Menu hamburger: buka/tutup rail (laci navigasi) di tampilan mobile */
(() => {
  const toggle = document.querySelector('#nav-toggle');
  const backdrop = document.querySelector('#rail-backdrop');
  const railNav = document.querySelector('#rail-nav');
  if (!toggle) return;

  const setOpen = (open) => {
    document.body.classList.toggle('nav-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'Tutup menu navigasi' : 'Buka menu navigasi');
    if (backdrop) backdrop.hidden = !open;
  };

  const isOpen = () => document.body.classList.contains('nav-open');

  toggle.addEventListener('click', () => setOpen(!isOpen()));
  if (backdrop) backdrop.addEventListener('click', () => setOpen(false));

  /* Tutup laci saat salah satu tautan navigasi dipilih */
  if (railNav) {
    railNav.addEventListener('click', (event) => {
      if (event.target.closest('a')) setOpen(false);
    });
  }

  /* Tutup laci dengan tombol Escape */
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen()) setOpen(false);
  });

  /* Pastikan laci tertutup bila ukuran jendela melebar ke layout desktop */
  const desktop = window.matchMedia('(min-width: 821px)');
  const onDesktop = (event) => { if (event.matches) setOpen(false); };
  if (desktop.addEventListener) desktop.addEventListener('change', onDesktop);
  else if (desktop.addListener) desktop.addListener(onDesktop);
})();
/* Tandai item aktif pada nav bar mobile (berdasarkan path & hash) */
(() => {
  const links = [...document.querySelectorAll('.mobile-nav-link')];
  if (!links.length) return;

  const sync = () => {
    const path = window.location.pathname;
    const hash = window.location.hash;
    let active = null;

    if (path === '/') {
      /* Di dashboard: HOME aktif; pindah bila hash menunjuk panel tertentu. */
      if (hash === '#ai-panel') active = links.find((l) => l.hash === '#ai-panel');
      else active = links.find((l) => l.getAttribute('href') === '/');
    } else if (path.startsWith('/situs-dummy')) {
      active = links.find((l) => l.pathname.startsWith('/situs-dummy'));
    } else if (path.startsWith('/laporan')) {
      active = links.find((l) => l.pathname.startsWith('/laporan'));
    }

    links.forEach((l) => l.classList.toggle('active', l === active));
  };

  sync();
  window.addEventListener('hashchange', sync);
  window.addEventListener('popstate', sync);
})();
/* Denyut angka Dashboard Situasi agar terasa hidup (simulasi, fluktuasi kecil) */
/* Lebar bar dari server (atribut data-width) diterapkan saat halaman dimuat. */
(() => {
  document.querySelectorAll('[data-width]').forEach((bar) => {
    bar.style.width = `${bar.dataset.width || 0}%`;
  });
})();
(() => {
  const personelChip = document.querySelector('.stat-chip[data-tick="personel"]');
  if (!personelChip) return;
  const valueEl = personelChip.querySelector('[data-value]');
  const base = Number(personelChip.dataset.base);
  if (!valueEl || !Number.isFinite(base)) return;
  setInterval(() => {
    const drift = Math.round((Math.random() - 0.5) * 6);
    valueEl.textContent = Math.max(0, base + drift);
  }, 4000);
})();
