[]docs/Garuda Shield_ Pusat Operasi Siber.png
# GARUDA SHIELD

> **Purwarupa kategori Defensive Shield — pemantauan situs dummy IT/OT dengan peta offline, konsol simulasi serangan, rule engine deteksi, dan alur tindak lanjut insiden.**
>
> Kartika Cyber Hackathon 2026 · Pusat Siber Angkatan Darat (PUSSIBERAD) × CODEPOLITAN

GARUDA SHIELD adalah demonstrator yang memperlihatkan alur *event → deteksi → alert → tindak lanjut* dalam lingkungan yang aman, terkontrol, dan dapat diulang. Seluruh target, event, status, metrik, koordinat, dan hasil analisis adalah **data demo/sintetis** — aplikasi **tidak melakukan probe jaringan, pemindaian, pemblokiran, atau perubahan perangkat/jaringan** sama sekali.

---

## Fitur Utama

| Modul | Penjelasan |
|---|---|
| **Dashboard peta situasi** | 16 endpoint dummy (15 Kodam + 1 Nusantara) pada peta vektor Indonesia yang disajikan lokal — tanpa tile internet, tanpa server pihak ketiga. |
| **Inventaris situs** | Pencarian, filter status (Normal / Perhatian / Offline / Maintenance), detail endpoint: latensi, uptime simulasi, URL `.test`, tautan situs dummy. |
| **Simulasi pemeriksaan situs** | Tabel pemeriksaan per endpoint (respons, TLS, latensi, kehilangan paket, kondisi) yang berjalan lokal tanpa request jaringan. |
| **Konsol Red Team** | 5 modul pertahanan diuji: Smart IDS/IPS, Threat Intelligence Platform, Automated Incident Response, Zero-Day Detection, Encryption Tool. Serangan dibuat sebagai event sintetis — tidak ada paket ke target. |
| **Rule engine deteksi** | Lonjakan login gagal (AUTH-001), koneksi IT→OT tanpa persetujuan (NET-004), tulis OT di luar jadwal (OT-007), pola pemindaian port (IDS-001), indikator ancaman (TIP-002), rantai serangan multi tahap (AIR-003), aktor tak dikenal (ZDD-004), eksfiltrasi terenkripsi (ENC-005). |
| **Panel AI penanganan insiden** | Analisis heuristik lokal (default) — status Aman/Butuh Tindakan, keyakinan, ringkasan, tindakan disarankan, checklist pemulihan, dan pelacakan asal serangan berbasis metadata. Integrasi Groq (opsional) untuk ringkasan insiden. |
| **Laporan insiden siap cetak** | Halaman `GET /laporan/:attackId` yang menyusun laporan dari operator ke pimpinan: identitas target & metode, penilaian, ringkasan analisis + tindakan yang direkomendasikan, tabel alert beserta status tindak lanjut, pelacakan asal serangan, playbook respons, jejak audit penanganan, dan bagian pengesahan dua tanda tangan — lengkap dengan stempel "SELURUH DATA SIMULASI" pada kop dan disclaimer di footer. Dicetak atau disimpan sebagai PDF langsung lewat dialog print browser (Ctrl+P), tanpa dependensi tambahan. |
| **Audit & pemulihan** | Perubahan status alert tercatat di audit trail lokal; tombol "Pulihkan situs" menuntaskan insiden simulasi dan menghentikan alarm/animasi. |

## Cuplikan Layar

### 1. Dashboard Peta Situasi — gambaran menyeluruh seluruh wilayah

![Dashboard peta situasi GARUDA SHIELD](karya/1.png)

Halaman utama menampilkan KPI ringkas (16 situs dipantau, 12 normal, 3 perlu ditinjau, latensi rata-rata 298 ms), peta vektor Indonesia dengan penanda berwarna per status, panel detail situs terpilih (IV/Diponegoro — 155 ms, uptime 99,89%), serta inventaris endpoint dengan pencarian dan filter. Peta sepenuhnya dibangun dari GeoJSON lokal (`public/data/indonesia-province-simple.json`) dan Leaflet yang disajikan dari `public/vendor/leaflet/` — banjir tile ("TANPA TILE INTERNET") memastikan demo tetap berjalan offline.

### 2. Panel AI — hasil analisis insiden dan checklist pemulihan

![Panel AI dan checklist pemulihan](karya/2.png)

Setelah insiden, panel AI menilai kondisi: **AMAN · SITUS PULIH**, keyakinan 85%, ringkasan berbahasa Indonesia (mis. "Port scan dari jaringan internal tidak terdeteksi, namun sudah diblokir dan log ditingkatkan"). Di sisi kiri tindakan yang disarankan (blokir IP 10.66.13.9, tingkatkan logging, notifikasi SOC, forensik, perbarui konfigurasi IDS/IPS); di sisi kanan kelima langkah pemulihan tercentang satu per satu. Pelacakan asal serangan menampilkan alamat internal RFC1918 beserta keyakinan lokasi dan catatan keterbatasannya — apa adunya jujur bahwa alamat di belakang VPN/Tor tidak dapat dipastikan dari metadata tunggal.

### 3. Simulasi pemeriksaan situs — tabel kondisi per endpoint

![Tabel simulasi pemeriksaan situs](karya/3.png)

Tabel pemeriksaan menampilkan kondisi tiap endpoint: kode + kota, badge respons (200/503/TIMEOUT), versi TLS, latensi berikut bar grafiknya, persentase kehilangan paket, waktu pemeriksaan terakhir, dan label kondisi (NORMAL / LATENSI TINGGI / TIDAK MERESPONS / PEMELIHARAAN). Filter chip serta pengurutan (kondisi, latensi, nama, waktu) tersedia; tombol "Jalankan pemeriksaan" menganimasikan baris satu per satu — semuanya simulasi lokal, **tanpa request jaringan**.

### 4. Konsol Red Team — memicu skenario terhadap modul pertahanan

![Konsol tim penyerang](karya/4.png)

`/konsol` memilih target dummy (dari 16 situs, dengan pencarian dan filter latensi) lalu memilih salah satu dari 5 modul pertahanan yang diuji: **IDS-001** Smart IDS/IPS (port scan) — TERPILIH: **AIR-003** Automated Incident Response (intrusi multi tahap IT ke OT) — **TIP-002** Threat Intelligence Platform, **ZDD-004** Zero-Day Detection, **ENC-005** Encryption Tool (eksfiltrasi terenkripsi). Baris "Keluaran" menampilkan log serangan: modul → target, jumlah event, dan opsional setiap alert terpicu, serta "Respons otomatis" dari playbook mitigasi. Pita atas ("SIMULASI DEFENSIF · SERANGAN TIDAK NYATA · TARGET ADALAH SITUS DUMMY LOKAL") menegaskan aman dan terkendali.

### 5. Dashboard menerima serangan — deteksi, tindak lanjut, dan pemulihan

![Dashboard menerima insiden serangan](karya/5.png)

Saat serangan diluncurkan, dashboard memantau, memarahi: penanda merah muncul tepat di koordinat target (XVII/Cenderawasih) dengan cincin denyut beranimasi; popup kutip detail: **OT-007** (KRITIS) perintah tulis OT di luar jadwal, **AIR-003** (KRITIS) rantai serangan multi tahap, **NET-004** (SEDANG) koneksi IT→OT tanpa zona IT ke OT; plus aksi playbook (isolasi segmen OT, cabut sesi, dokumentasi insiden). Tautan detail di kiri ikon seperti gambar sisipan serangan muncul juga di peta; panel AI beralih ke **BUTUH TINDAKAN** (keyakinan 85%) beserta tindakan dan status pemulihan. Alarm audio, tautan "Situs dummy target", dan tombol "Pulihkan situs" menuntaskan alur end-to-end. Tombol **Cetak laporan ↗** di panel AI membuka laporan insiden operator→pimpinan yang utuh dan siap disimpan sebagai PDF — memenuhi kebutuhan pelaporan dari operator lapangan ke pimpinan satuan dalam satu klik.

---

## Cara Menjalankan

Persyaratan: **Node.js 22.5+** (memakai modul SQLite bawaan `node:sqlite`).

```powershell
npm install     # paket: express 5 + ejs
npm test        # pengujian otomatis (node --test)
npm start       # menyalakan server di http://localhost:3000
```

Server mengikat ke `127.0.0.1:3000` (atur `PORT` bila port 3000 terpakai).

| Rute | Keterangan |
|---|---|
| `GET /` | Dashboard peta, KPI, alert, audit, tabel pemeriksaan. |
| `GET /konsol` | Konsol tim penyerang (simulasi). |
| `GET /situs-dummy/:siteId` | Detail situs dummy (domain `.test`). |
| `POST /api/serangan` | Jalankan metode simulasi, simpan event, kembalikan deteksi. |
| `POST /api/events` | Ingest satu event standar (login, koneksi, protocol_write, dll). |
| `GET /api/insiden-aktif` · `GET /api/serangan/:id` | Baca insiden simulasi. |
| `POST /api/analisis` | Analisis insiden — heuristik lokal atau Groq (opsional). |
| `POST /api/pulihkan` | Tandai insiden pulih. |
| `GET /laporan/:attackId` | Laporan insiden siap cetak (operator ke pimpinan; print browser untuk PDF). |
| `POST /alerts/:id/status` · `POST /demo/reset` | Ubah status alert / reset data demo. |

Opsional: set `GROQ_API_KEY` (+ `GROQ_MODEL`) di `.env` untuk mengaktifkan analisis via Groq; tanpa environment variable, aplikasi tetap berjalan penuh memakai heuristik lokal.

## Struktur Proyek

```
src/              server Express 5 (server.js), SQLite via node:sqlite (db.js),
                  rule engine (detector.js), skenario konsol (threats.js),
                  pelacakan asal simulasi (geoip.js), data situs (kodam-sites.js), views EJS
public/           CSS/JS per halaman, Leaflet vendored, GeoJSON provinsi, suara alarm
data/             demo-events.json (seed) + SQLite lokal (dibuat otomatis, jangan dibagikan)
test/             pengujian rule engine dan konsistensi inventory (node --test)
docs/             proposal, dokumentasi teknis, naskah demo, slide, ceklist
```

## Batasan dan Keselamatan

- Seluruh target, koordinat, status, latensi, uptime, HTTP, TLS, dan sumber serangan adalah **data sintetis**.
- Bukan layanan monitoring produksi; tidak melakukan DNS lookup, HTTP probe, pemindaian, pemblokiran, atau perubahan perangkat/jaringan.
- Peta bersifat skematik (batas provinsi data © superpikar), bukan pemetaan operasional.
- Belum ada autentikasi/otorisasi produksi — **jangan dibuka ke jaringan publik**; jangan memasukkan data operasional atau rahasia.

Dokumen pendukung lengkap ada di [`docs/`](docs/): [proposal.md](docs/proposal.md), [technical.md](docs/technical.md), [demo-script.md](docs/demo-script.md), [presentation-slides.md](docs/presentation-slides.md), [ceklist.md](docs/ceklist.md).
