const siteData = JSON.parse(document.querySelector('#site-data').textContent);
const siteRows = [...document.querySelectorAll('.site-row')];
const mapFrame = document.querySelector('#map-frame');
let activeFilter = 'all';
let searchTerm = '';
const markers = new Map();
const map = L.map('map', {
  attributionControl: true,
  zoomControl: false,
  scrollWheelZoom: false
}).setView([-2.5, 118], 4);
let pendingAttackView = null;

const statusNames = {
  online: 'NORMAL',
  warning: 'PERHATIAN',
  offline: 'OFFLINE',
  maintenance: 'MAINTENANCE'
};

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
    const matchesFilter = activeFilter === 'all'
      || (activeFilter === 'attention' && ['warning', 'offline'].includes(status))
      || status === activeFilter;
    const matchesSearch = row.dataset.name.toLowerCase().includes(searchTerm);
    const visible = matchesFilter && matchesSearch;
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
  if (event.key === 'Escape') document.querySelector('#site-search').blur();
});

document.querySelector('#zoom-in').addEventListener('click', () => map.zoomIn());
document.querySelector('#zoom-out').addEventListener('click', () => map.zoomOut());
document.querySelector('#zoom-reset').addEventListener('click', () => {
  const visibleSites = siteData.filter((site) => {
    const row = siteRows.find((candidate) => candidate.dataset.siteId === site.id);
    return row && !row.hidden;
  });
  if (visibleSites.length) map.fitBounds(L.latLngBounds(visibleSites.map((site) => [site.lat, site.lng])), { padding: [22, 22], maxZoom: 5 });
});

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
    map.fitBounds(provinceLayer.getBounds(), { padding: [18, 18] });
    map.attributionControl.setPrefix('GARUDA SHIELD');
    map.invalidateSize();
    if (pendingAttackView) map.setView(pendingAttackView, 6);
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

const attackColor = { critical: '#ff4d6d', high: '#ffbb55', medium: '#48d183' };
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
  const closeButton = document.querySelector('#attack-alert-close');
  if (closeButton) closeButton.onclick = () => { alertElement.hidden = true; };
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
  runAiAnalysis(attack);
}

/* Incident alarm — file sirine serangan udara (mp3 loop); fallback Web Audio wail naik-turun */
const alarmAudio = document.querySelector('#alarm-audio');
const alarmButton = document.querySelector('#alarm-toggle');
let alarmMuted = false;
try { alarmMuted = localStorage.getItem('garuda-alarm-muted') === '1'; } catch (error) {}

let alarmCtx = null;
let alarmGain = null;
let sirenOscs = null;

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

function sirenRunning() {
  return Boolean(alarmCtx && alarmGain && alarmGain.gain.value > 0.01);
}

function startSiren() {
  if (!openSiren()) return false;
  if (alarmCtx.state === 'suspended' && typeof alarmCtx.resume === 'function') alarmCtx.resume().catch(() => {});
  const now = alarmCtx.currentTime;
  alarmGain.gain.cancelScheduledValues(now);
  alarmGain.gain.setTargetAtTime(0.12, now, 0.08);
  return true;
}

function stopSiren(hard) {
  if (!alarmCtx || !alarmGain) return;
  const now = alarmCtx.currentTime;
  alarmGain.gain.cancelScheduledValues(now);
  alarmGain.gain.setTargetAtTime(0.0001, now, 0.04);
  if (hard === true) setTimeout(cleanupSiren, 320);
}

function cleanupSiren() {
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

function updateAlarmButton(active) {
  if (!alarmButton) return;
  if (!active) {
    alarmButton.hidden = true;
    return;
  }
  alarmButton.hidden = false;
  alarmButton.classList.toggle('muted', alarmMuted);
  alarmButton.classList.remove('blocked');
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
    if (playback && typeof playback.catch === 'function') {
      playback.catch(() => {
        if (!startSiren() && alarmButton) {
          alarmButton.classList.add('blocked');
          alarmButton.textContent = 'AKTIFKAN ALARM';
        }
      });
    }
    return;
  }
  startSiren();
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
    const active = sirenRunning() || (alarmAudio && !alarmAudio.paused);
    if (!active && !alarmMuted) {
      startAlarm();
      return;
    }
    alarmMuted = !alarmMuted;
    try { localStorage.setItem('garuda-alarm-muted', alarmMuted ? '1' : '0'); } catch (error) {}
    if (alarmMuted) {
      stopSiren(true);
      if (alarmAudio) alarmAudio.pause();
    }
    if (!alarmMuted) startAlarm();
    updateAlarmButton(true);
  });
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
  map.closePopup();
  const frame = document.querySelector('#map-frame');
  if (frame) frame.style.setProperty('--attack-color', '#48d183');
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
    applyProbeResult(row);
    row.classList.remove('probing');
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
    if (localStorage.getItem('gs-rail-collapsed') === '1') document.body.classList.add('rail-collapsed');
  } catch (error) {}
  railToggle.setAttribute('aria-pressed', document.body.classList.contains('rail-collapsed') ? 'true' : 'false');
  railToggle.addEventListener('click', () => {
    const collapsed = document.body.classList.toggle('rail-collapsed');
    railToggle.setAttribute('aria-pressed', collapsed ? 'true' : 'false');
    try { localStorage.setItem('gs-rail-collapsed', collapsed ? '1' : '0'); } catch (error) {}
    setTimeout(() => { if (typeof map !== 'undefined' && map.invalidateSize) map.invalidateSize(); }, 240);
  });
})();
