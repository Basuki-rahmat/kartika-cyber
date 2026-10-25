#!/usr/bin/env node
// Generate gambar Open Graph: node scripts/make-og.js
// Hasil: public/og-image.png (1200x630) — dibutuhkan saat share link dashboard ke medsos.
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

const chromePath = process.env.CHROME_PATH
  || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const outDir = path.join(__dirname, '..', 'public');
const heroUrl = `file:///${path.join(outDir, 'kartika-hero.png').replace(/\\/g, '/')}`;
const cardPath = path.join(outDir, '_og-card.html');
const cardUrl = `file:///${cardPath.replace(/\\/g, '/')}`;

const cardHtml = `<!doctype html>
<html>
<head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; }
  body {
    width: 1200px; height: 630px; overflow: hidden; position: relative;
    background: #06130d; font-family: 'Segoe UI', 'Arial', sans-serif;
  }
  .hero {
    position: absolute; inset: 0;
    background: url('kartika-hero.png') 56% 0 / cover no-repeat;
  }
  .veil {
    position: absolute; inset: 0;
    background: linear-gradient(to top, rgba(4,10,7,.97) 0%, rgba(4,10,7,.88) 18%, rgba(4,10,7,.45) 32%, rgba(4,10,7,0) 50%);
  }
  .plate {
    position: absolute; left: 0; right: 0; bottom: 0;
    display: flex; align-items: flex-end; gap: 22px;
    padding: 20px 44px 24px;
    background: rgba(4,10,7,.92);
    border-top: 1px solid rgba(99,224,122,.28);
  }
  .shield {
    width: 56px; flex: none;
    display: flex; align-items: center; justify-content: center;
  }
  .shield svg { width: 48px; height: 55px; }
  .copy { flex: 1; min-width: 0; }
  .kicker {
    font-size: 19px; letter-spacing: .32em; color: #d8f5b8; font-weight: 600;
    text-shadow: 0 2px 10px rgba(0,0,0,.85); white-space: nowrap;
  }
  .title {
    margin-top: 4px;
    font-size: 40px; line-height: 1.06; font-weight: 800; color: #ffffff;
    letter-spacing: .01em; text-shadow: 0 3px 14px rgba(0,0,0,.9); white-space: nowrap;
  }
  .title span { color: #63e07a; }
  .subtitle {
    margin-top: 5px; font-size: 18px; color: #d3e6d9; letter-spacing: .04em;
    text-shadow: 0 2px 10px rgba(0,0,0,.85); white-space: nowrap;
  }
  .badge {
    flex: none; margin-left: 4px; margin-bottom: 2px;
    border: 1px solid #63e07a; color: #baf7c6; background: rgba(10,26,16,.75);
    padding: 9px 16px; border-radius: 5px;
    font-size: 15px; letter-spacing: .18em; font-weight: 600;
  }
</style></head>
<body>
  <div class="hero"></div>
  <div class="veil"></div>
  <div class="plate">
    <span class="shield"><svg viewBox="0 0 48 48" fill="none">
      <path d="M24 4 42 11v12c0 11-7 18-18 22C13 41 6 34 6 23V11z" fill="#0b2417" stroke="#63e07a" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="m15 25 6 6 13-15" stroke="#63e07a" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </svg></span>
    <div class="copy">
      <div class="kicker">KARTIKA CYBER 2026 · KATEGORI DEFENSIVE SHIELD</div>
      <div class="title">GARUDA <span>SHIELD</span> — PUSSIBERAD TNI AD</div>
      <div class="subtitle">Peta &amp; konsol simulasi pertahanan siber · deteksi insiden · analisis AI · penangkalan</div>
    </div>
    <div class="badge">DEMO</div>
  </div>
</body>
</html>`;

(async () => {
  fs.writeFileSync(cardPath, cardHtml);
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'],
    defaultViewport: { width: 1200, height: 630, deviceScaleFactor: 1 }
  });
  try {
    const page = await browser.newPage();
    await page.goto(cardUrl, { waitUntil: 'networkidle0' });
    await page.screenshot({ path: path.join(outDir, 'og-image.png') });
  } finally {
    await browser.close();
    fs.rmSync(cardPath, { force: true });
  }
  console.log('og-image.png selesai dibuat di public/og-image.png (1200x630).');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
