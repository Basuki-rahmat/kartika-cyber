# GARUDA SHIELD LITE

**AI Web Defender untuk Situs Vital TNI AD** — Sistem pertahanan siber terpadu berbasis Node.js dengan 1 port (3000), dirancang untuk perangkat low-spec (i7 / 16GB / VGA 4GB). Tanpa database berat, tanpa build step.

---

## Daftar Isi

1. [Latar Belakang Masalah](#latar-belakang-masalah)
2. [Dampak & Kelayakan (Impact & Feasibility)](#dampak--kelayakan-impact--feasibility)
3. [Ringkasan Teknis](#ringkasan-teknis)
4. [Arsitektur](#arsitektur)
5. [Fitur Utama](#fitur-utama)
6. [Persyaratan Sistem](#persyaratan-sistem)
7. [Instalasi & Menjalankan](#instalasi--menjalankan)
8. [Kredensial & Peran](#kredensial--peran)
9. [Halaman & Rute](#halaman--rute)
10. [API Endpoint](#api-endpoint)
11. [Skenario Latihan (Red Team)](#skenario-latihan-red-team)
12. [Konfigurasi Environment](#konfigurasi-environment)
13. [Struktur Proyek](#struktur-proyek)
14. [Keamanan & Batasan](#keamanan--batasan)
15. [Troubleshooting](#troubleshooting)

---

## Latar Belakang Masalah

Portal digital TNI AD menghadapi ancaman siber yang terus berkembang:

- **Defacement situs** — kerusakan citra institusi di mata publik
- **Injeksi SQL/XSS** — eksploitasi kerentanan aplikasi web
- **DDoS** — gangguan layanan publik
- **Kebocoran data personel** — pencurian informasi terbatas
- **Hoaks/disinformasi** — serangan psikologis yang menarget prajurit

Seluruh 10 Kodam + Pussansiad + Kartika CSIRT memerlukan pertahanan yang terpadu, bukan parsial.

---

## Dampak & Kelayakan (Impact & Feasibility)

### Dampak Nyata
| Aspek | Dampak |
|---|---|
| **Cakupan** | 10 Kodam + Pussansiad + Kartika CSIRT dalam 1 platform |
| **Respons** | Deteksi < 5 detik, auto-rollback 10 detik |
| **Biaya** | Rp 0 — open source, tanpa lisensi, tanpa API key wajib |
| **SDM** | Cukup 1 operator + 1 komandan, tanpa keahlian khusus |
| **Regulasi** | Sesuai Perpres 82/2022 (IIV) |

### Kelayakan Implementasi
| Kriteria | Status |
|---|---|
| **Perangkat** | Low-spec (i7/16GB/4GB) — cocok untuk Kodam |
| **Instalasi** | 1 perintah: `npm install && npm start` |
| **Dependensi** | 4 package npm, tanpa database, tanpa Docker |
| **Jaringan** | Single port 3000, tanpa firewall kompleks |
| **Offline** | GeoIP & peta provinsi jalan tanpa internet |
| **Maintenance** | Zero — stateless, restart = reset |

### Keunggulan Kompetitif
- **Mesin deteksi tunggal** — skenario uji dievaluasi mesin yang sama dengan trafik nyata
- **Rantai komando** — pemisahan tugas operator/komandan sesuai SOP militer
- **Mesh taktis** — store-and-forward saat uplink putus
- **Jejak audit** — akuntabilitas penuh setiap perintah
- **AI analysis** — integrasi Groq untuk analisis hoaks & laporan

---

## Ringkasan Teknis

GARUDA SHIELD LITE adalah platform latihan pertahanan siber (blue team) yang mensimulasikan perlindungan terhadap portal-portal TNI AD. Sistem ini menggabungkan:

- **WAF Lite** — deteksi SQL Injection, XSS, Path Traversal, Webshell upload
- **Rate Limiting & DDoS Protection** — pembatasan 60 request/menit per IP
- **Honeypot Taktis** — direktori umpan yang mengunci IP secara permanen saat disentuh
- **Atribusi Aktor** — sidik perilaku (UA + bahasa) untuk melacak penyerang meski berganti IP
- **Deteksi VPN/Proxy** — identifikasi X-Forwarded-For dan pergantian IP dengan sidik sama
- **Integritas Monitoring** — auto-rollback defacement dalam 10 detik
- **Mesh Taktis** — store-and-forward saat uplink ke Kartika CSIRT terputus
- **Rantai Komando** — eskalasi operator → persetujuan komandan untuk isolasi situs
- **Jejak Audit** — setiap perintah tercatat siapa–apa–kapan
- **AI Analysis** — integrasi Groq AI untuk analisis hoaks dan laporan

---

## Arsitektur

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT BROWSER                        │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ index    │  │ redteam.html │  │ /situs-dummy      │  │
│  │ (Blue)   │  │ (Red Team)   │  │ (Portal Target)   │  │
│  └────┬─────┘  └──────┬───────┘  └────────┬──────────┘  │
└───────┼────────────────┼───────────────────┼─────────────┘
        │                │                   │
        ▼                ▼                   ▼
┌─────────────────────────────────────────────────────────┐
│              EXPRESS SERVER (port 3000)                   │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │           WAF LITE MIDDLEWARE                    │    │
│  │  SQLi │ XSS │ Traversal │ Webshell │ Rate Limit  │    │
│  └────────────────────┬────────────────────────────┘    │
│                       │                                  │
│  ┌────────────────────▼────────────────────────────┐    │
│  │         MESIN DETEKSI TUNGGAL                    │    │
│  │  evaluateThreat() — dipakai trafik nyata & simulasi│   │
│  └────────────────────┬────────────────────────────┘    │
│                       │                                  │
│  ┌────────────────────▼────────────────────────────┐    │
│  │         SISTEM MODUL:                            │    │
│  │  • Honeypot Tripwire                            │    │
│  │  • Atribusi Aktor (fingerprint perilaku)        │    │
│  │  • GeoIP Lookup (offline, geoip-lite)           │    │
│  │  • Integrity Monitor (hash baseline, 5s poll)   │    │
│  │  • Mesh Outbox (store-and-forward)              │    │
│  │  • Auth & Session (in-memory token)             │    │
│  │  • Audit Trail (jejak akuntabilitas)            │    │
│  │  • AI Analysis (Groq API)                       │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

---

## Fitur Utama

### 1. WAF Lite (Web Application Firewall)
| Jenis Serangan | Teknik MITRE ATT&CK | Aksi |
|---|---|---|
| SQL Injection | T1190 | Blokir request |
| Cross-Site Scripting | T1189 | Blokir request |
| Path Traversal | T1083 | Blokir request |
| Webshell Upload | T1505 | Blokir request |
| Brute Force Login | T1110 | Blokir IP setelah 5 upaya/menit |
| Vulnerability Scanning | T1595 | Blokir IP setelah 10 probe/2 menit |
| DDoS / Flood | T1498 | Blokir IP setelah 60 req/menit |

### 2. Honeypot Taktis
Tiga direktori umpan yang tidak ditautkan dari mana pun:
- `/dokumen-rahasia-kodam` — arsip palsu
- `/login-bais` — halaman login palsu
- `/admin-backup` — halaman phpMyAdmin palsu

Siapa pun yang menyentuh → sidik jari direkam → IP dikunci permanen.

### 3. Atribusi Aktor & Deteksi VPN
- Fingerprint = hash(User-Agent + Accept-Language)
- 3 IP dengan fingerprint sama → indikasi VPN/proxy → semua IP diblokir serentak
- X-Forwarded-For dicatat sebagai indikasi proxy

### 4. Integritas & Auto-Recovery
- Hash SHA-256 konten portal dibandingkan baseline setiap 5 detik
- Perubahan terdeteksi → status ATTACK → auto-rollback dalam 10 detik

### 5. Mesh Taktis (Store-and-Forward)
- Saat uplink ke Kartika CSIRT putus, peristiwa antre di outbox lokal (maks 500 paket)
- Saat uplink pulih, outbox tersinkron otomatis

### 6. Rantai Komando
- **Operator**: mengajukan isolasi situs (PENDING)
- **Komandan**: menyetujui/menolak pengajuan
- Operator TIDAK PERNAH bisa mengeksekusi isolasi langsung

### 7. Jejak Audit
Setiap perintah tercatat: waktu, aktor, aksi, target, detail. Maks 100 entri.

---

## Persyaratan Sistem

| Komponen | Minimum |
|---|---|
| OS | Windows 10/11, Linux, macOS |
| Node.js | v16+ (disarankan v18+) |
| RAM | 2 GB |
| Storage | 500 MB |
| Jaringan | Port 3000 terbuka |

---

## Instalasi

```bash
# Clone atau masuk ke direktori proyek
cd C:\laragon\www\kartika-cyber

# Install dependencies
npm install
```

---

## Menjalankan Server

### Cara 1: start.bat (Windows)
Double-click file `start.bat` di folder proyek.

### Cara 2: Command Line
```bash
npm start
```

### Cara 3: Node langsung
```bash
node server.js
```

Server akan berjalan di `http://localhost:3000`

---

## Kredensial & Peran

| Username | Password | Peran | Hak Akses |
|---|---|---|---|
| `komandan` | `garuda123` | Komandan | Full: approve/reject isolasi, kontrol uplink, blokir IP, reset situs |
| `operator` | `kodam123` | Operator | View dashboard, ajukan isolasi, lihat log & audit |

**Catatan**: Kredensial disimpan in-memory (hardcoded). Session hilang saat server restart.

---

## Halaman & Rute

| Rute | Deskripsi | Akses |
|---|---|---|
| `/` | Dashboard Blue Team (peta, status, log) | Publik |
| `/redteam.html` | Konsol Red Team (simulasi serangan) | Publik |
| `/situs-dummy?site=<id>` | Portal target (bisa di-deface) | Publik |
| `/dokumen-rahasia-kodam` | Honeypot — arsip palsu | Publik (jebakan) |
| `/login-bais` | Honeypot — login palsu | Publik (jebakan) |
| `/admin-backup` | Honeypot — phpMyAdmin palsu | Publik (jebakan) |

### Daftar Situs Target (query param `?site=`)
- `kodam-im` — Kodam Iskandar Muda
- `kodam-bb` — Kodam Bukit Barisan
- `kodam-slw` — Kodam Siliwangi
- `kodam-dip` — Kodam Diponegoro
- `kodam-brw` — Kodam Brawijaya
- `kodam-udayana` — Kodam Udayana
- `kodam-hasanuddin` — Kodam Hasanuddin
- `kodam-cenderawasih` — Kodam Cenderawasih
- `pussansiad` — Pussansiad (Pusat)
- `kartika-csirt` — Kartika CSIRT

---

## API Endpoint

### Status & Monitoring
| Method | Endpoint | Deskripsi |
|---|---|---|
| GET | `/api/status` | Status semua situs (UP/ATTACK/ISOLATED) + metrik |
| GET | `/api/logs` | Log peristiwa keamanan (maks 200) |
| GET | `/api/audit` | Jejak audit (maks 50) |
| GET | `/api/me` | Info session login |
| GET | `/api/iocs` | Indikator kompromi (IP terblokir, aktor) |
| GET | `/api/mesh/status` | Status mesh node & outbox |
| GET | `/api/requests` | Daftar pengajuan isolasi |
| GET | `/api/ai-status` | Status koneksi Groq AI |

### Autentikasi
| Method | Endpoint | Deskripsi |
|---|---|---|
| POST | `/api/login` | Login (username + password) |
| POST | `/api/logout` | Logout |

### Manajemen (Komandan)
| Method | Endpoint | Deskripsi |
|---|---|---|
| POST | `/api/mesh/uplink` | Simulasi putus/pulih uplink |
| POST | `/api/mesh/sync` | Sinkron manual outbox |
| POST | `/api/requests/:id/approve` | Setujui isolasi |
| POST | `/api/requests/:id/reject` | Tolak isolasi |

### Operator
| Method | Endpoint | Deskripsi |
|---|---|---|
| POST | `/api/requests` | Ajukan isolasi situs |

### AI & Laporan
| Method | Endpoint | Deskripsi |
|---|---|---|
| GET | `/api/analyze-hoaks` | Analisis hoaks via Groq AI |
| GET | `/api/report` | Laporan HTML |
| GET | `/api/report.pdf` | Laporan PDF (via PDFKit) |

### Simulasi (Red Team)
| Method | Endpoint | Deskripsi |
|---|---|---|
| POST | `/api/simulate/sqli` | Simulasi SQL Injection |
| POST | `/api/simulate/xss` | Simulasi XSS |
| POST | `/api/simulate/ddos` | Simulasi DDoS flood |
| POST | `/api/simulate/scan` | Simulasi vulnerability scan |
| POST | `/api/simulate/bruteforce` | Simulasi brute force |
| POST | `/api/simulate/deface` | Simulasi defacement |
| POST | `/api/simulate/webshell` | Simulasi upload webshell |

---

## Skenario Latihan (Red Team)

Buka `/redteam.html` untuk akses konsol penyerang. Tersedia arsenal:

1. **SQL Injection** — kirim payload SQLi ke portal
2. **XSS Attack** — kirim script berbahaya
3. **DDoS Flood** — kirim request massal
4. **Vulnerability Scan** — probe path-path samar
5. **Brute Force** — semprot kredensial ke login palsu
6. **Defacement** — ubah konten portal (auto-rollback 10 detik)
7. **Webshell Upload** — coba unggah file berbahaya

Semua serangan dievaluasi oleh **mesin deteksi yang sama** dengan trafik nyata.

---

## Konfigurasi Environment

File `.env`:

```env
PORT=3000
GROQ_API_KEY=gsk_xxx
GROQ_MODEL=openai/gpt-oss-20b
NODE_ID=NODE-TAKTIS-01
```

| Variabel | Default | Deskripsi |
|---|---|---|
| `PORT` | 3000 | Port server |
| `GROQ_API_KEY` | — | API key Groq untuk AI analysis |
| `GROQ_MODEL` | `openai/gpt-oss-20b` | Model Groq |
| `NODE_ID` | `NODE-TAKTIS-01` | Identitas mesh node |

---

## Struktur Proyek

```
kartika-cyber/
├── server.js           # Express server + semua logika
├── package.json        # Dependencies & scripts
├── start.bat           # Windows launcher
├── .env                # Environment variables
├── README.md           # File ini
├── public/
│   ├── index.html      # Dashboard Blue Team
│   ├── redteam.html    # Konsol Red Team
│   └── data/           # Data statis
└── node_modules/       # Dependencies (npm install)
```

---

## Keamanan & Batasan

- **Kredensial hardcoded** — tidak untuk produksi
- **Session in-memory** — hilang saat restart
- **GeoIP offline** — IP lokal/latihan tidak dapat dipetakan
- **Tanpa database** — semua state di RAM
- **Single port** — semua layanan di port 3000
- **Rate limit** — 60 req/menit per IP (management plane dikecualikan)

---

## Troubleshooting

| Masalah | Solusi |
|---|---|
| `EADDRINUSE` port 3000 | Kill proses yang pakai port 3000 atau ganti `PORT` di `.env` |
| `Cannot find module` | Jalankan `npm install` |
| AI analysis failed | Cek `GROQ_API_KEY` di `.env` |
| Session hilang | Normal — in-memory, login ulang |
| IP terblokir | Restart server untuk reset `blockedIPs` |

---

## Lisensi

Proyek ini dibuat untuk keperluan latihan dan edukasi pertahanan siber TNI AD.
