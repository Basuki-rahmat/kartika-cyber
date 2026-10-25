# Materi Slide Presentasi GARUDA SHIELD

Draft isi slide dan catatan pembicara untuk presentasi sekitar 7-9 menit. Isi nama tim/anggota sebelum dipindahkan ke PowerPoint, Google Slides, atau Canva. Slide ini adalah naskah sumber; belum diekspor menjadi PDF/PPTX.

---

## Slide 1 - GARUDA SHIELD

**Purwarupa Defensive Shield untuk simulasi deteksi dan tindak lanjut insiden IT/OT**

- Tim: Cyber Community
- Anggota: Fitria Khasanan, Basuki Rahmat, Frida Panjaitan
- Kartika Cyber Hackathon 2026

**Catatan pembicara:**

Perkenalkan tim dan tujuan. Tegaskan sejak awal bahwa semua target, event, status, serta metrik dalam demonstrasi adalah sintetis.

---

## Slide 2 - Tantangan yang Diangkat

- Operator perlu memilah banyak sinyal dan memahami konteks sebuah alert.
- Event lintas zona IT/OT perlu ditinjau dengan bukti dan alur tindak lanjut yang jelas.
- Demo keamanan perlu aman, terkontrol, dan bisa diulang.

**Catatan pembicara:**

Ini adalah masalah yang menjadi inspirasi purwarupa, bukan klaim bahwa aplikasi sudah terhubung atau mengukur kondisi operasional TNI AD.

---

## Slide 3 - Solusi

- Dashboard peta lokal: 16 endpoint dummy (15 Kodam + Nusantara demo) dengan popup thumbnail, panel detail, inventaris berstatus.
- Tabel simulasi pemeriksaan situs: respons HTTP, TLS, latensi, kehilangan paket, dan kondisi tiap endpoint — semuanya lokal tanpa probe jaringan.
- Konsol Red Team: pilih target, lima modul pertahanan yang diuji, dan profil asal penyerang (IP, lokasi tampak, ASN, VPN/Tor) — termasuk preset Shanghai, Moskow, Frankfurt, Amsterdam, atau kustom.
- Rule engine delapan aturan deteksi (AUTH-001, NET-004, OT-007, IDS-001, TIP-002, AIR-003, ZDD-004, ENC-005) yang menghasilkan alert bersertifikasi severity, bukti, dan rekomendasi.
- Panel AI penanganan insiden: analisis lokal/Groq, tindakan disarankan, checklist pemulihan, pelacakan asal serangan.
- Alarm sirine insiden, mode dampak halaman situs dummy, audit status, dan laporan insiden siap cetak (operator ke pimpinan).

**Catatan pembicara:**

Tunjukkan hubungan tampilan: konsol membuat skenario dan profil penyerang, dashboard memperlihatkan deteksi, dampak pada situs dummy, dan tindak lanjutnya.

---

## Slide 4 - Cara Kerja Purwarupa

1. Pilih target dummy, modul pertahanan, dan profil asal penyerang di konsol.
2. Aplikasi membuat event sintetis dan menyimpannya di SQLite lokal.
3. Rule engine mengevaluasi pola event dan membuat alert.
4. Alarm sirine berbunyi; halaman situs dummy target masuk mode dampak serangan (simulasi).
5. Operator meninjau bukti/rekomendasi di panel AI, lalu menekan "Pulihkan situs" untuk mengeksekusi playbook pemulihan.
6. Perubahan status tercatat di audit trail demo; laporan operator→pimpinan dapat dicetak.

**Catatan pembicara:**

Semua langkah berlangsung di aplikasi lokal. Tidak ada trafik serangan atau probe yang dikirim ke target. Analisis AI tidak otomatis memulihkan — pemulihan selalu merupakan aksi eksplisit operator.

---

## Slide 5 - Demo Fitur

- 16 endpoint dummy pada peta vektor offline (Leaflet lokal, GeoJSON provinsi, tanpa tile internet) dengan popup berthumbnail.
- Pencarian, filter status, detail endpoint, serta tabel pemeriksaan (200/503/TIMEOUT, TLS, latensi, packet loss, kondisi) dengan filter chip dan pengurutan.
- Lima skenario konsol: Smart IDS/IPS (IDS-001), Threat Intelligence Platform (TIP-002), Automated Incident Response (AIR-003), Zero-Day Detection (ZDD-004), Encryption Tool (ENC-005).
- Panel 03 Asal Penyerang: preset Default, Shanghai, Moskow, Frankfurt·VPN, Amsterdam·Tor, atau kustom (IP, lokasi, lintang/bujur, ASN, bendera VPN/Tor).
- Alert berisi severity, bukti, rekomendasi, serta status (new → acknowledged → in_progress → resolved).
- Panel AI penanganan insiden: status AMAN/BUTUH TINDAKAN, keyakinan, ringkasan, tindakan disarankan, checklist pemulihan, dan pelacakan asal serangan — dengan tombol "Pulihkan situs" dan "Cetak laporan" yang terpisah.
- Alarm sirine air-raid (fallback Web Audio) dan mode dampak halaman situs dummy (`/situs-dummy/:siteId`) saat insiden aktif.
- Laporan insiden siap cetak (`/laporan/:attackId`) lengkap: identitas target, penilaian, analisis, alert + status tindak lanjut, pelacakan asal, playbook respons, jejak audit, konteks 16 situs Kodam (bagian F), riwayat serangan sesi (bagian G), serta pengesahan dua tanda tangan dan stempel "SELURUH DATA SIMULASI".

**Catatan pembicara:**

Demo langsung: buka peta, pilih endpoint; pindah ke konsol, pilih target, Automated Incident Response, dan profil asal penyerang (mis. Frankfurt·VPN); jalankan simulasi; kembali ke dashboard untuk membaca alert, mendengar alarm, dan melihat mode dampak situs dummy. Akhiri dengan "Pulihkan situs"/audit, lalu klik "Cetak laporan" di panel AI untuk memperlihatkan laporan operator→pimpinan yang siap disimpan sebagai PDF.

---

## Slide 6 - Teknologi dan Verifikasi

- Node.js 22.5+ (modul SQLite bawaan `node:sqlite`), Express 5, EJS, JavaScript tanpa bundler.
- Leaflet dan GeoJSON lokal; thumbnail situs disajikan dari `public/thumbs/`; tanpa basemap tiles.
- Pengujian otomatis: `npm test` (rule engine, konsistensi inventory, scanner vendor CSS).
- Analisis insiden heuristik lokal (default); integrasi Groq opsional melalui `GROQ_API_KEY`/`GROQ_MODEL`.
- Kemudahan jalankan: `start.bat` / `stop.bat` atau `npm start` di `http://localhost:3000`.

**Catatan pembicara:**

Jelaskan alasan pendekatan lokal: mudah dijalankan dan skenario dapat diulang tanpa ketergantungan jaringan. Bila Groq diaktifkan, hanya ringkasan insiden sintetis yang dikirim ke layanan eksternal; tanpa API key, analisis tetap berjalan penuh secara lokal.

---

## Slide 7 - Batasan dan Keselamatan

- Target, koordinat, status, latensi, uptime, HTTP, TLS, dan sumber insiden adalah data sintetis.
- Tidak ada DNS lookup, HTTP probe, pemindaian, pemblokiran, atau perubahan perangkat/jaringan.
- Peta bersifat skematik dan bukan pemetaan operasional; profil asal penyerang adalah metadata simulasi, bukan atribusi nyata.
- Bukan layanan monitoring produksi; server hanya mengikat ke `127.0.0.1` dan belum memiliki autentikasi/otorisasi produksi.

**Catatan pembicara:**

Nyatakan batasan dengan jelas. Hasil lokasi sumber dan analisis bukan intelijen atau atribusi nyata — alamat di balik VPN/Tor tidak dapat dipastikan dari metadata tunggal.

---

## Slide 8 - Kelayakan dan Langkah Berikutnya

- Kelayakan: satu proses Node.js + SQLite bawaan; peta offline; berjalan di jaringan tertutup tanpa layanan cloud.
- Nilai demo: alur event → alert → dampak situs dummy → tindak lanjut → laporan insiden lebih mudah diperagakan, lengkap dengan alarm dan profil penyerang.
- Langkah berikutnya: validasi kebutuhan, otorisasi pemilik aset, data tervalidasi, kontrol akses, audit, dan uji terisolasi.
- GARUDA SHIELD adalah titik awal diskusi, bukan integrasi produksi.

**Catatan pembicara:**

Tutup dengan manfaat purwarupa, kelayakan implementasinya, dan syarat yang diperlukan sebelum integrasi nyata. Hindari menjanjikan kesiapan operasional.
