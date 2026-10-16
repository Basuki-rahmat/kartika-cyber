# KARTIKA CYBER HACKATHON 2026 - PLAN
## Project: GARUDA SHIELD LITE
## Target: Solusi Keamanan Siber Situs Vital TNI AD + Kesempatan Tentara Siber TNI AD
## Dev Spec: Core i7 / RAM 16GB / VGA 4GB (Windows)
## Stack Aktual: Node.js 1 port 3000 (Express) â€” Tested OK
## Status: MVP Hari 1-2 SELESAI + Login Role + PDF

---

## 1. Ringkasan Eksekutif

**Nama Produk:** GARUDA SHIELD LITE - AI Web Defender untuk Situs Vital TNI AD

**Masalah utama TNI AD (berdasar Pussansiad, Kartika CSIRT, BSSN 2024-2025):**
- Ancaman fisik: Web Defacement, DDoS (50.15% serangan 2024), Malware/Ransomware (93.57% serangan 2025), Phishing, APT
- Ancaman non-fisik: Hoaks, disinformasi, deepfake yang menyerang mindset prajurit & keluarga
- Internal: SDM siber kurang, deteksi manual/lambat, belum ada SOC di Kodam/Korem, semua laporan numpuk ke Kartika CSIRT pusat

**Solusi (sudah jadi):** Dashboard komandan 1-port yang:
1. Deteksi deface + auto-rollback 10 detik
2. WAF Lite: block SQLi/XSS/Traversal + rate-limit 60 req/menit + auto-block DDoS
3. Peta gelar 10 situs (8 Kodam + Pussansiad + Kartika CSIRT) + tombol Isolasi/Pulihkan khusus Komandan
4. Cek hoaks AI Lite offline (0 VRAM) + Laporan TXT + PDF format Kartika CSIRT
5. Login peran: Komandan (kontrol penuh) vs Operator (view + lapor)

**Kenapa menarik juri (7.5 -> 9/10):** Menjawab misi Kartika CSIRT (deteksi-respons-pulihkan), demo live dramatis 5 menit, chain-of-command jelas, ringan (RAM <100MB), offline-capable, sesuai Perpres 82/2022 IIV.

---

## 2. Arsitektur Aktual (Hemat Resource)

```
[ Juri / Attacker ] --> [ Express WAF middleware ] --> [ /situs-dummy ]
                                   |
                                   v
                    [ in-memory: sites[10] + logs[200] + blockedIPs ]
                                   |
                                   v
              [ public/index.html: Tailwind + Leaflet + Chart.js ]
                                   |
                                   v
              [ /api/report (TXT) + /api/report.pdf (PDFKit) ]
```

- 1 proses Node, 1 port 3000. Tanpa Docker, ELK, DB server, build step.
- RAM terukur: ~80-100MB. Tanpa GPU wajib.
- AI berat tidak di lokal, pakai rule-based + opsional Gemini API.

**Struktur folder aktual `c:\laragon\www\kartika-cyber\`:**
```
kartika-cyber/
â”œâ”€â”€ plan.md
â”œâ”€â”€ plan.txt
â”œâ”€â”€ package.json         # express + pdfkit saja
â”œâ”€â”€ server.js            # backend 1-port + WAF + auth + PDF
â”œâ”€â”€ public/
â”‚   â””â”€â”€ index.html       # dashboard responsif modern interaktif
â””â”€â”€ node_modules/
```

**API yang sudah tested:**
- `GET /` `GET /situs-dummy` `GET /api/status` `GET /api/logs`
- `POST /api/login` `POST /api/logout` `GET /api/me`
- `POST /api/simulate/deface|sqli|ddos|reset` (Komandan only)
- `POST /api/isolate|restore|block-ip` (Komandan only)
- `POST /api/analyze-hoaks` (semua role) + `POST /api/ai-analyst` (narasi taktis) + `POST /api/ai-advisor` (perintah taktis)
- `POST /api/simulate/deface|sqli|ddos|honeypot(S-04)` (SEL MERAH â€” bebas tanpa login) + `POST /api/simulate/reset` (Komandan)
- `GET /api/mesh/status` + `POST /api/mesh/uplink|sync` (node taktis, Komandan)
- `GET /api/report` (TXT) + `GET /api/report.pdf?klas=RAHASIA|TERBATAS|BIASA` (Lapinsiber kop dinas + cap klasifikasi + IOC + audit)
- `GET /api/audit` + `GET /api/iocs` (khusus personel login â€” akuntabilitas & forensik)
- `GET /api/status` kini mengembalikan per-situs: `localIp`, `cpu`, `ram`, `waf` + `live` hash

---

## 3. MVP â€” Status Pengerjaan

### Hari 1 - Core Defender [SELESAI]
- [x] `GET /situs-dummy` jadi target demo
- [x] WAF: block `UNION SELECT, <script>, ../../`, rate-limit, log in-memory
- [x] Monitor hash sha256 + flag `defaced` + auto-rollback 10 detik
- [x] Dashboard: statistik, log live 3 detik, grafik, peta Leaflet 10 Kodam, tombol Isolasi/Pulihkan

### Hari 2 - Role + AI + Laporan [SELESAI]
- [x] Auth: `komandan/garuda123` (full) vs `operator/kodam123` (view+lapor). Anon 401, operator 403 untuk aksi sensitif â€” tested
- [x] Cek hoaks Groq + fallback rule-based offline (0 VRAM) â€” tested
- [x] Laporan TXT + PDF (`Laporan-Insiden-Kartika-CSIRT.pdf`): kop, waktu, pelapor+peran, ringkasan, status situs, 20 log, Perpres 82/2022
- [x] Panel simulasi demo + reset. Tested: deface/sqli/ddos/reset semua OK

### Hari 3 - Komando & Forensik [SELESAI]
- [x] Role switcher 1-klik (âš¡ Masuk Komandan/Operator) + Log Audit Akses (siapa memerintah apa â€” tested, anon 401)
- [x] Rantai komando eskalasi: operator mengajukan isolasi + alasan â†’ komandan SETUJUI/TOLAK (operator tak bisa eksekusi langsung â€” tested 403 â†’ PENDING â†’ ISOLATED)
- [x] Tabel IOC aktif (IP penyerang + status blokir, hash baseline/tercemar, pola muatan + MITRE)
- [x] PDF dinas militer: kop PUSSANSIAD/Kartika CSIRT + cap RAHASIA/TERBATAS/BIASA + IOC + audit + kolom TTD
- [x] Peta Leaflet + batas 32 provinsi asli (superpikar/indonesia-geojson, disalin lokal 180KB ke `public/data/`): tanpa tile luar, tanpa API key, jalan offline; legenda ðŸŸ¢ðŸŸ¡ðŸ”´, marker denyut, garis serangan animasi per skenario, popup IP/CPU/RAM/WAF, baris Kodam bisa diklik
- [x] Playbook SOP Hijau/Kuning/Merah otomatis mengikuti kondisi gelar (Perpres 82/2022 IIV)
### Hari 5 - Target, Sorotan & Anti-VPN [SELESAI]
- [x] Portal per-situs (10 Kodam, konten + baseline masing-masing); skenario menerima `siteId` â€” tested S-01 ke Kodam-IM
- [x] Biru dramatis: banner serangan, peta flyTo + popup sasaran, baris berdenyut, iframe korban mengikuti situs diserang, busur serangan dari tag skenario
- [x] Atribusi aktor (sidik UA+bahasa+pola): 1 sidik 3 IP = indikasi VPN â†’ BLOKIR SERENTAK lintas-IP + audit; X-Forwarded-For dicatat â€” tested AKTOR-01(vpn,q)
- [x] Mode VPN di konsol merah (S-02/S-03 rotasi 3 IP): S-02 VPN â†’ 9 verdict + karantina; S-03 biasa tetap putus #61
- [x] Senjata modern S-05 (semprotan kredensial T1110, kunci di upaya #6), S-06 (intip kerentanan T1595 via radar 404, cium di #11), S-07 (unggah webshell T1505, aturan WAF baru) â€” ketiganya lewat mesin asli + popup terminal penyerang â€” tested

### Hari 4 - Taktis Lapangan [SELESAI]
- [x] Mesh node taktis: outbox store-and-forward, simulasi satelit putus/pulih, sinkron manual â€” tested (5 paket antre â†’ tersinkron)
- [x] Honeypot: umpan `/dokumen-rahasia-kodam`, `/login-bais` (tangkap kredensial), `/admin-backup`; tripwire â†’ sidik + KUNCI PERMANEN; S-04 tested 3/3 terperangkap
- [x] Penasihat taktis AI: baca log â†’ kelompok MITRE â†’ perintah bertenggat + eskalasi IIV (Groq, fallback offline) â€” tested
- [x] Pemanggil Groq tunggal anti-gagal (toleran model reasoning, budget token besar)
- [x] Dua dashboard terpisah total: `index.html` = BIRU steril (tanpa tombol serang; observasi + reaksi otomatis + komando + lapor) dan `redteam.html` = MERAH (arsenal S-01..S-07, konsol + popup terminal, pilih Kodam, mode VPN, tanpa login); konsol latihan kebal blokir IP â€” tested
- [x] Layout biru: portal korban sejajar peta (mengikuti situs diserang + hash); ruang perang = cermin musuh + perisai; grafik + hoaks baris sendiri
- [x] Portal korban modern tema TNI AD (hero, statistik, berita, agenda, footer dinas, emas-hijau; versi diretas merah) - tested render 6,3KB
- [x] Geolokasi pelaku: geoip-lite luring (tanpa API key); IP latihan jujur dinyatakan tak dapat dipetakan; IP publik ke kota/negara + marker merah di peta + link Google Maps per pelaku - tested

### Tidak Dikerjakan (sengaja, hemat spek)
- Tidak training model, tidak Docker/K8s, tidak Suricata/Wazuh full, tidak LLM 7B lokal, tidak Puppeteer (PDF pakai PDFKit).

---

## 4. Tech Stack Final

| Komponen | Pilih | Alasan |
|---|---|---|
| Runtime | Node 24 + Express 4 | 1 port 3000, RAM kecil, tanpa Laragon/MySQL |
| Frontend | HTML + Tailwind CDN + Leaflet + Chart.js | Responsif, modern, tanpa build |
| Store | In-memory + Map/Set (max 200 log) | Tanpa SQLite/MySQL, reset sekali klik |
| WAF | Regex SQLi/XSS/Traversal + rate-limit | Tanpa ModSecurity |
| Auth | Token random in-memory (x-token header) | Tanpa JWT lib / Redis, cukup untuk demo |
| PDF | PDFKit | Murni JS, tanpa Chrome headless |
| AI Hoaks | Groq API (`openai/gpt-oss-20b`) + fallback rule-based offline | Cepat, gratis, 0 VRAM. Key di `.env` (gitignored). Offline tetap jalan |
| AI Anomaly | Grafik + threshold + log (sklearn opsional, belum perlu) | CPU only jika ditambah |

---

## 5. Skenario Demo 5 Menit â€” Ruang Perang 3 Layar + Analis AI

1. **Buka (30 det):** Scroll ke RUANG PERANG. Kiri: portal Kodam hidup (iframe). Tengah: terminal red-team. Kanan: perisai + hash live.
2. **Serang bebas (30 det):** Tanpa login, luncurkan S-03 sebagai SEL MERAH â€” peta menguning, terminal merah, perisai mencatat. Siapa pun (termasuk juri) boleh menekan.
3. **S-01 (90 det):** LUNCURKAN â†’ layar korban berubah merah DISERANG, terminal hacker mengetik muatan, perisai mencatat [T1491], portal pulih otomatis. Analis AI membacakan laporan medan laga.
4. **S-02 + S-03 (90 det):** Terminal menampilkan tiap muatan + HTTP 403 mesin; banjir terhenti di request #61. AI menilai profil pelaku + rekomendasi.
5. **Closing (60 det):** Unduh PDF CSIRT. "Tiga layar, satu mesin, satu komando."

Prinsip: red-team menyuntikkan muatan asli, MESIN DETEKSI TUNGGAL yang menilai. Monitor integritas hash jalan tiap 5 detik.

---

## 6. Roadmap ke Tentara Siber

- Fase 1 (Hackathon, kini): Single-node LITE seperti di atas â€” DONE
- Fase 2 (3 bulan): Multi-node 3 Kodam, threat-intel sharing antar node, MFA passkey, alert Telegram/WA, ganti store ke SQLite untuk persist
- Fase 3 (6 bulan): Integrasi helpdesk Kartika CSIRT, korelasi APT, audit Perpres 82/2022, hardening auth (hash + expiry + rate-limit login)

---

## 7. Operasional Laptop (i7/16GB/4GB)

- [x] Saat demo: hanya Node + 1 Chrome. Tutup Docker/VS Code berat jika lag.
- [x] Jangan load model 7B lokal. Jika mau offline LLM, cukup `qwen2.5:3b-instruct-q4` (~2GB VRAM).
- [x] Siapkan hotspot HP cadangan (tile OSM butuh internet). Fallback: screenshot peta jika offline total.
- [x] Sebelum naik panggung: `POST /api/simulate/reset` dengan token Komandan untuk state bersih.

**Jalankan:**
```powershell
cd C:\laragon\www\kartika-cyber
npm start
# http://localhost:3000
```
Wajib restart (`Ctrl+C` lalu `npm start` ulang) setiap habis update `server.js` â€” Node membaca file saat start. Blokir IP tersimpan di memori, jadi restart juga membersihkan lockout.

**Desain anti-lockout (management plane out-of-band, praktik SOC asli):**
dashboard, login, dan laporan tidak ikut rate-limit/penolakan IP-blokir agar konsol komando tetap hidup saat serangan. Inspeksi muatan tetap berlaku di semua jalur. Token Komandan melewati limiter di semua endpoint sehingga reset selalu bisa dilakukan.

---

## 8. Langkah Berikutnya (Opsional)

1. Alert Telegram (bot token gratis) saat deface â€” 20 baris kode
2. Persist log ke `data/logs.json` agar survive restart
3. Ganti cek hoaks ke Gemini Flash API (tambah 1 env key, fallback rule-based tetap jalan)
4. Video demo 2 menit + slide arsitektur 1 halaman untuk juri non-teknis

## 6. Kredensial Demo (RAHASIA PRESENTER - jangan tampil di layar)
- Akun asli: NRP `310102` / `garuda1945` - sesi bersih, unduh asli
- Akun KENARI (bocor di OSINT merah): NRP `310101` / `kartika1945` - pemakai otomatis dicap musuh, disambut seolah berhasil, diberi DOKUMEN MADU palsu, alarm diam-diam ke biru - tested
