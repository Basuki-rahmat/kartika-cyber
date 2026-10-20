# Materi Slide Presentasi GARUDA SHIELD

Draft isi slide dan catatan pembicara untuk presentasi sekitar 7-9 menit. Isi nama tim/anggota sebelum dipindahkan ke PowerPoint, Google Slides, atau Canva. Slide ini adalah naskah sumber; belum diekspor menjadi PDF/PPTX.

---

## Slide 1 - GARUDA SHIELD

**Purwarupa Defensive Shield untuk simulasi deteksi dan tindak lanjut insiden IT/OT**

- Tim: [Nama Tim]
- Anggota: [Nama Anggota 1], [Nama Anggota 2], [Nama Anggota 3]
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

- Dashboard peta lokal untuk gambaran inventory endpoint dummy.
- Konsol untuk menghasilkan skenario event sintetis.
- Rule engine yang mengubah pola event menjadi alert dengan severity, bukti, dan rekomendasi.
- Audit status dan analisis insiden lokal untuk mendukung alur demo.

**Catatan pembicara:**

Tunjukkan hubungan kedua tampilan: konsol membuat skenario, dashboard memperlihatkan deteksi dan tindak lanjutnya.

---

## Slide 4 - Cara Kerja Purwarupa

1. Pilih target dummy dan skenario di konsol.
2. Aplikasi membuat event sintetis dan menyimpannya di SQLite lokal.
3. Rule engine mengevaluasi pola event dan membuat alert.
4. Operator meninjau bukti/rekomendasi dan memperbarui status.
5. Perubahan status tercatat di audit trail demo.

**Catatan pembicara:**

Semua langkah berlangsung di aplikasi lokal. Tidak ada trafik serangan atau probe yang dikirim ke target.

---

## Slide 5 - Demo Fitur

- 16 endpoint dummy pada peta vektor offline.
- Pencarian, filter status, dan detail endpoint.
- Lima skenario konsol: Smart IDS/IPS, Threat Intelligence Platform, Automated Incident Response, Zero-Day Detection, Encryption Tool.
- Alert berisi severity, bukti, rekomendasi, serta status.

**Catatan pembicara:**

Demo langsung: buka peta, pilih endpoint; pindah ke konsol, pilih target dan Automated Incident Response; jalankan simulasi; kembali ke dashboard untuk membaca alert. Akhiri dengan pembaruan status/audit.

---

## Slide 6 - Teknologi dan Verifikasi

- Node.js 22.5+, Express 5, EJS, JavaScript, SQLite.
- Leaflet dan GeoJSON lokal; tanpa basemap tiles.
- Pengujian otomatis: `npm test`.
- Analisis insiden heuristik lokal; integrasi Groq opsional.

**Catatan pembicara:**

Jelaskan alasan pendekatan lokal: mudah dijalankan dan skenario dapat diulang tanpa ketergantungan jaringan. Bila Groq diaktifkan, hanya ringkasan insiden sintetis yang dikirim ke layanan eksternal.

---

## Slide 7 - Batasan dan Keselamatan

- Target, koordinat, status, latensi, uptime, HTTP, TLS, dan sumber insiden adalah data sintetis.
- Tidak ada DNS lookup, HTTP probe, pemindaian, pemblokiran, atau perubahan perangkat/jaringan.
- Peta bersifat skematik dan bukan pemetaan operasional.
- Bukan layanan monitoring produksi; belum memiliki autentikasi/otorisasi produksi.

**Catatan pembicara:**

Nyatakan batasan dengan jelas. Hasil lokasi sumber dan analisis bukan intelijen atau atribusi nyata.

---

## Slide 8 - Nilai dan Langkah Berikutnya

- Nilai demo: alur event ke alert dan tindak lanjut lebih mudah diperagakan.
- Langkah berikutnya: validasi kebutuhan, otorisasi pemilik aset, data tervalidasi, kontrol akses, audit, dan uji terisolasi.
- GARUDA SHIELD adalah titik awal diskusi, bukan integrasi produksi.

**Catatan pembicara:**

Tutup dengan manfaat purwarupa dan syarat yang diperlukan sebelum integrasi nyata. Hindari menjanjikan kesiapan operasional.
