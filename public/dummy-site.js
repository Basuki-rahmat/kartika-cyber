(() => {
  const root = document.documentElement;
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const toast = document.querySelector('#toast');
  let toastTimer;

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2400);
  }

  /* Theme toggle */
  const themeToggle = document.querySelector('#theme-toggle');
  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    if (themeToggle) themeToggle.setAttribute('aria-pressed', String(theme === 'dark'));
    try { localStorage.setItem('gs-dummy-theme', theme); } catch (error) {}
  }
  if (themeToggle) {
    themeToggle.setAttribute('aria-pressed', String(root.getAttribute('data-theme') === 'dark'));
    themeToggle.addEventListener('click', () => {
      applyTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });
  }

  /* Live clock */
  const clock = document.querySelector('#header-clock');
  function tick() {
    if (clock) {
      clock.textContent = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date());
    }
  }
  if (clock) { tick(); window.setInterval(tick, 1000); }

  /* Mobile nav */
  const navToggle = document.querySelector('#nav-toggle');
  const siteNav = document.querySelector('#site-nav');
  if (navToggle && siteNav) {
    navToggle.addEventListener('click', () => {
      const open = siteNav.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', String(open));
    });
    siteNav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
      siteNav.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    }));
  }

  /* Scroll progress + back to top */
  const progressBar = document.querySelector('#progress-bar');
  const toTop = document.querySelector('#to-top');
  function onScroll() {
    const doc = document.documentElement;
    const max = doc.scrollHeight - doc.clientHeight;
    if (progressBar) progressBar.style.width = `${max > 0 ? (doc.scrollTop / max) * 100 : 0}%`;
    if (toTop) toTop.classList.toggle('visible', doc.scrollTop > 420);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  if (toTop) toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: prefersReduced ? 'auto' : 'smooth' }));

  /* Reveal on scroll */
  const revealItems = [...document.querySelectorAll('.reveal')];
  if (prefersReduced || !('IntersectionObserver' in window)) {
    revealItems.forEach((item) => item.classList.add('in'));
  } else {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -40px 0px' });
    revealItems.forEach((item) => revealObserver.observe(item));
  }

  /* Count-up stats */
  const counters = [...document.querySelectorAll('[data-count]')];
  function animateCount(element) {
    const target = Number(element.dataset.count) || 0;
    if (prefersReduced) { element.textContent = target.toLocaleString('id-ID'); return; }
    const duration = 1100;
    const start = performance.now();
    function step(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      element.textContent = Math.round(target * eased).toLocaleString('id-ID');
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  if (!('IntersectionObserver' in window)) {
    counters.forEach((element) => { element.textContent = Number(element.dataset.count || 0).toLocaleString('id-ID'); });
  } else {
    const countObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { animateCount(entry.target); countObserver.unobserve(entry.target); }
      });
    }, { threshold: 0.5 });
    counters.forEach((element) => countObserver.observe(element));
  }

  /* News search + filter */
  const newsItems = [...document.querySelectorAll('.news-item')];
  const newsSearch = document.querySelector('#news-search');
  const newsEmpty = document.querySelector('#news-empty');
  const newsVisible = document.querySelector('#news-visible');
  let newsFilter = 'all';
  let newsTerm = '';

  function applyNewsFilter() {
    let visible = 0;
    newsItems.forEach((item) => {
      const matchesFilter = newsFilter === 'all' || item.dataset.category === newsFilter;
      const matchesTerm = !newsTerm || item.dataset.title.includes(newsTerm) || item.textContent.toLowerCase().includes(newsTerm);
      const show = matchesFilter && matchesTerm;
      item.hidden = !show;
      if (show) visible += 1;
    });
    if (newsVisible) newsVisible.textContent = String(visible).padStart(2, '0');
    if (newsEmpty) newsEmpty.hidden = visible !== 0;
  }

  if (newsSearch) {
    newsSearch.addEventListener('input', (event) => {
      newsTerm = event.target.value.trim().toLowerCase();
      applyNewsFilter();
    });
  }
  document.querySelectorAll('.news-filter').forEach((button) => {
    button.addEventListener('click', () => {
      newsFilter = button.dataset.filter;
      document.querySelectorAll('.news-filter').forEach((item) => item.classList.toggle('active', item === button));
      applyNewsFilter();
    });
  });
  applyNewsFilter();

  /* Service cards */
  document.querySelectorAll('.service-card').forEach((card) => {
    card.addEventListener('click', () => showToast(`${card.dataset.service} · hanya simulasi`));
  });

  /* Copy to clipboard */
  document.querySelectorAll('[data-copy]').forEach((button) => {
    button.addEventListener('click', async () => {
      const value = button.dataset.copy;
      try {
        await navigator.clipboard.writeText(value);
        showToast('Alamat uji disalin (simulasi)');
      } catch (error) {
        showToast(value);
      }
    });
  });

  /* Keyboard shortcut for news search */
  document.addEventListener('keydown', (event) => {
    const tag = document.activeElement ? document.activeElement.tagName : '';
    if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(tag) && newsSearch) {
      event.preventDefault();
      newsSearch.focus();
    }
  });

  /* Mode dampak serangan: pantau /api/insiden-aktif secara live */
  const siteId = root.dataset ? root.dataset.siteId : '';
  if (siteId) {
    const overlay = document.querySelector('#attack-overlay');
    let attackVisible = document.body.classList.contains('under-attack');
    let reloadPending = false;

    function enterAttack(record) {
      if (attackVisible && overlay) return;
      document.body.classList.add('attack-enter');
      window.setTimeout(() => document.body.classList.remove('attack-enter'), 900);
      document.body.classList.add('under-attack');
      attackVisible = true;
      reloadPending = true;
    }

    function leaveAttack() {
      if (!attackVisible) return;
      attackVisible = false;
      reloadPending = false;
      document.body.classList.remove('under-attack');
      if (toast) showToast('Situs web dipulihkan · efek serangan dihentikan (simulasi)');
      reloadPending = true;
    }

    async function pollIncident() {
      try {
        const res = await fetch('/api/insiden-aktif', { headers: { accept: 'application/json' } });
        if (!res.ok) return;
        const data = await res.json();
        const active = data && data.active && data.active.site && data.active.site.id === siteId ? data.active : null;
        if (active) enterAttack(active);
        else leaveAttack();
        if (reloadPending && !attackVisible) {
          reloadPending = false;
          window.setTimeout(() => window.location.reload(), 1200);
        }
      } catch (error) {}
    }

    pollIncident();
    window.setInterval(pollIncident, 3000);
  }
})();