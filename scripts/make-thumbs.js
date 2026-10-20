#!/usr/bin/env node
// Generate thumbnail 16 situs dummy: node scripts/make-thumbs.js
// Server dijalankan sementara oleh skrip ini; hasil: public/thumbs/<siteId>.jpg
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer-core');
const { kodamSites } = require('./../src/kodam-sites');

const chromePath = process.env.CHROME_PATH
  || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 3199;
const outDir = path.join(__dirname, '..', 'public', 'thumbs');
fs.mkdirSync(outDir, { recursive: true });

async function waitFor(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await fetch(url);
      return;
    } catch { await new Promise((resolve) => setTimeout(resolve, 300)); }
  }
  throw new Error('Server tidak merespons dalam waktu wajar.');
}

(async () => {
  const server = spawn(process.execPath, ['src/server.js'], {
    env: { ...process.env, PORT: String(port) },
    stdio: 'ignore'
  });
  try {
    await waitFor(`http://127.0.0.1:${port}/`);
    const browser = await puppeteer.launch({
      executablePath: chromePath,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
      defaultViewport: { width: 800, height: 450, deviceScaleFactor: 1 }
    });
    const page = await browser.newPage();
    let failed = 0;
    for (const site of kodamSites) {
      try {
        await page.goto(`http://127.0.0.1:${port}/situs-dummy/${site.id}`, { waitUntil: 'networkidle0', timeout: 20000 });
        const file = path.join(outDir, `${site.id}.jpg`);
        await page.screenshot({ path: file, type: 'jpeg', quality: 72 });
        const kb = Math.round(fs.statSync(file).size / 1024);
        console.log(`${site.id}.jpg (${kb} KB)`);
      } catch {
        failed += 1;
        console.error(`Gagal: ${site.id}`);
      }
    }
    await browser.close();
    console.log(failed ? `Selesai dengan ${failed} gagal.` : 'Semua thumbnail tersimpan di public/thumbs/.');
    if (failed) process.exitCode = 1;
  } finally {
    server.kill();
  }
})();
