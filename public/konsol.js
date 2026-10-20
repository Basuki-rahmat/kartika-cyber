(() => {
  const toastEl = document.querySelector('#toast');
  let toastTimer;

  function showToast(message, warn = false) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.toggle('warn', warn);
    toastEl.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), 2800);
  }

  const attackChannel = ('BroadcastChannel' in window) ? new BroadcastChannel('garuda-attacks') : null;

  function dashboardIsOpen() {
    try {
      const last = Number(window.localStorage.getItem('garuda-watch-heartbeat') || 0);
      return Date.now() - last < 4000;
    } catch (error) {
      return false;
    }
  }

  /* Clock */
  const clock = document.querySelector('#clock');
  function tick() {
    if (clock) clock.textContent = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date());
  }
  if (clock) { tick(); window.setInterval(tick, 1000); }

  /* Scroll progress */
  const progressBar = document.querySelector('#progress-bar');
  window.addEventListener('scroll', () => {
    const doc = document.documentElement;
    const max = doc.scrollHeight - doc.clientHeight;
    if (progressBar) progressBar.style.width = `${max > 0 ? (doc.scrollTop / max) * 100 : 0}%`;
  }, { passive: true });

  /* Target filtering */
  const targetOptions = [...document.querySelectorAll('.target-option')];
  const targetSearch = document.querySelector('#target-search');
  const targetEmpty = document.querySelector('#target-empty');
  const targetCount = document.querySelector('#target-count');

  function filterTargets() {
    const term = (targetSearch ? targetSearch.value : '').trim().toLowerCase();
    let visible = 0;
    targetOptions.forEach((option) => {
      const show = !term || option.dataset.name.toLowerCase().includes(term);
      option.hidden = !show;
      if (show) visible += 1;
    });
    if (targetEmpty) targetEmpty.hidden = visible !== 0;
    if (targetCount) targetCount.textContent = String(visible);
  }
  if (targetSearch) targetSearch.addEventListener('input', filterTargets);

  /* Selection state */
  const selectedTargetEl = document.querySelector('#selected-target');
  const selectedMethodEl = document.querySelector('#selected-method');
  const launchButton = document.querySelector('#launch-button');
  let selectedSite = null;
  let selectedMethod = null;
  let busy = false;

  function syncLaunchState() {
    if (selectedTargetEl) selectedTargetEl.textContent = selectedSite ? `${selectedSite.name} · ${selectedSite.code}` : 'Belum dipilih';
    if (selectedMethodEl) selectedMethodEl.textContent = selectedMethod ? `${selectedMethod.name} · ${selectedMethod.code}` : 'Belum dipilih';
    if (launchButton) launchButton.disabled = busy || !selectedSite || !selectedMethod;
  }

  targetOptions.forEach((option) => {
    option.addEventListener('click', () => {
      targetOptions.forEach((item) => item.classList.toggle('selected', item === option));
      selectedSite = {
        id: option.dataset.siteId,
        name: option.dataset.siteName,
        code: option.dataset.siteCode,
        city: option.dataset.siteCity,
        status: option.dataset.siteStatus
      };
      syncLaunchState();
    });
  });

  document.querySelectorAll('.method-card').forEach((card) => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.method-card').forEach((item) => item.classList.toggle('selected', item === card));
      selectedMethod = { id: card.dataset.methodId, name: card.dataset.methodName, code: card.dataset.methodCode };
      syncLaunchState();
    });
  });

  document.querySelector('#reset-selection').addEventListener('click', () => {
    targetOptions.forEach((item) => item.classList.remove('selected'));
    document.querySelectorAll('.method-card').forEach((item) => item.classList.remove('selected'));
    if (targetSearch) targetSearch.value = '';
    filterTargets();
    selectedSite = null;
    selectedMethod = null;
    syncLaunchState();
    showToast('Pilihan direset');
  });

  /* Output log */
  const logList = document.querySelector('#log-list');
  const outputEmpty = document.querySelector('#output-empty');
  const detectionCount = document.querySelector('#detection-count');
  let totalDetections = 0;

  function severityLabel(severity) {
    return severity === 'critical' ? 'KRITIS' : severity.toUpperCase();
  }

  function renderLog(result, timeLabel, popupBlocked, dashboardOpen) {
    if (outputEmpty) outputEmpty.hidden = true;
    totalDetections += result.detections.length;
    if (detectionCount) detectionCount.textContent = `${totalDetections} ALERT`;

    const item = document.createElement('li');
    item.className = 'log-item';

    const head = document.createElement('div');
    head.className = 'log-head';
    head.innerHTML = `
      <span class="log-title"><span class="tag tag-launch">SERANGAN DILUNCURKAN</span>${result.method.name} → ${result.site.name}</span>
      <span class="log-time">${timeLabel}</span>`;

    const body = document.createElement('div');
    body.className = 'log-body';

    const tags = document.createElement('div');
    tags.className = 'log-tags';
    tags.style.marginBottom = '12px';
    tags.innerHTML = `
      <span class="tag tag-target">TARGET ${result.site.code}</span>
      <span class="tag tag-method">${result.method.code}</span>
      <span class="tag tag-launch">${result.eventCount} EVENT</span>`;
    body.appendChild(tags);

    const note = document.createElement('p');
    note.className = 'log-note';
    note.textContent = dashboardOpen
      ? 'Serangan dikirim ke tab peta pemantauan yang sudah terbuka · pindah ke tab tersebut untuk melihat efeknya.'
      : popupBlocked
        ? 'Popup diblokir browser. Izinkan popup untuk membuka peta dashboard pemantauan.'
        : 'Peta dashboard pemantauan dibuka di jendela baru · penanda serangan beranimasi muncul pada koordinat target.';
    body.appendChild(note);

    if (result.detections.length === 0) {
      const none = document.createElement('p');
      none.className = 'no-detection';
      none.textContent = 'Tidak ada aturan deteksi yang terpicu.';
      body.appendChild(none);
    } else {
      result.detections.forEach((detection) => {
        const row = document.createElement('div');
        row.className = 'detection';
        row.innerHTML = `
          <span class="sev sev-${detection.severity}">${severityLabel(detection.severity)}</span>
          <span class="detection-rule">${detection.ruleId}</span>
          <span class="detection-title">${detection.title}</span>`;
        body.appendChild(row);
      });
    }

    const response = document.createElement('div');
    response.className = 'response-block';
    const items = result.responses.map((step) => `<li>${step}</li>`).join('');
    response.innerHTML = `<span class="response-title">RESPONS OTOMATIS</span><ul class="response-list">${items}</ul>`;
    body.appendChild(response);

    item.appendChild(head);
    item.appendChild(body);
    logList.prepend(item);
  }

  function makeAttackId() {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    } catch (error) {}
    return `atk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  async function launch(site, method, attackId, popupBlocked, dashboardOpen) {
    busy = true;
    syncLaunchState();
    if (launchButton) launchButton.disabled = true;
    try {
      const response = await fetch('/api/serangan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId: site.id, methodId: method.id, attackId })
      });
      if (!response.ok) throw new Error('request failed');
      const result = await response.json();
      renderLog(result, new Date().toLocaleTimeString('id-ID'), popupBlocked, dashboardOpen);
      const critical = result.detections.filter((detection) => detection.severity === 'critical').length;
      showToast(`${result.detections.length} alert terpicu${critical ? ` · ${critical} kritis` : ''}`);
    } catch (error) {
      showToast('Gagal meluncurkan simulasi.', true);
    } finally {
      busy = false;
      syncLaunchState();
    }
  }

  if (launchButton) {
    launchButton.addEventListener('click', () => {
      if (!selectedSite || !selectedMethod || busy) return;
      const attackId = makeAttackId();
      const dashboardOpen = Boolean(attackChannel) && dashboardIsOpen();
      let popupBlocked = false;
      if (dashboardOpen) {
        attackChannel.postMessage({ type: 'attack', attackId });
        showToast('Serangan dikirim ke tab peta pemantauan');
      } else {
        const url = `/?attack=${encodeURIComponent(attackId)}#map`;
        const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
        popupBlocked = !newWindow;
        if (popupBlocked) showToast('Popup diblokir. Izinkan popup untuk jendela baru.', true);
      }
      launch(selectedSite, selectedMethod, attackId, popupBlocked, dashboardOpen);
    });
  }

  document.addEventListener('keydown', (event) => {
    const tag = document.activeElement ? document.activeElement.tagName : '';
    if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(tag) && targetSearch) {
      event.preventDefault();
      targetSearch.focus();
    }
  });

  syncLaunchState();
})();