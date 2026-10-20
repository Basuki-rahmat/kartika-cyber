# Proposal Solusi GARUDA SHIELD

## Ringkasan

GARUDA SHIELD adalah purwarupa kategori **Defensive Shield (Penangkalan)** untuk memperlihatkan bagaimana operator dapat melihat status simulasi layanan, meninjau alert, dan memahami alur penanganan insiden pada satu aplikasi. Purwarupa menggabungkan dashboard peta offline berisi 16 endpoint dummy dengan konsol simulasi yang menghasilkan event dan alert secara lokal.

## Masalah dan konteks

Dalam lingkungan IT/OT, operator perlu menyaring banyak sinyal, memahami alasan sebuah alert muncul, lalu menyampaikan tindak lanjut dengan cepat. Purwarupa ini mengeksplorasi alur informasi tersebut melalui data sintetis. Data dalam demo tidak mewakili situs, aset, topologi, lokasi fasilitas, ataupun kondisi jaringan TNI AD.

## Solusi

GARUDA SHIELD menyediakan dua tampilan yang saling melengkapi:

- **Dashboard pemantauan:** peta vektor offline dan inventory 16 endpoint dummy dengan pencarian, filter status, detail endpoint, event, alert, dan status tindak lanjut.
- **Konsol simulasi:** lima skenario terkontrol untuk Smart IDS/IPS, Threat Intelligence Platform, Automated Incident Response, Zero-Day Detection, dan Encryption Tool. Skenario membuat event sintetis untuk memicu rule engine, bukan mengirim trafik ke target.
- **Laporan insiden siap cetak:** halaman `GET /laporan/:attackId` menyusun laporan dari operator ke pimpinan — identitas target dan metode, penilaian, analisis operator, tabel alert beserta status tindak lanjut, pelacakan asal serangan, playbook respons, jejak audit, dan bagian pengesahan — siap disimpan sebagai PDF lewat dialog print browser tanpa dependensi tambahan.

Rule engine menilai pola seperti lonjakan login gagal, koneksi IT-ke-OT tanpa persetujuan, penulisan protokol OT di luar jendela maintenance, pola koneksi berulang, dan indikator ancaman yang disediakan data demo. Alert menyajikan severity, bukti, rekomendasi, dan status yang dapat ditinjau. Analisis insiden menggunakan heuristik lokal secara default; integrasi Groq opsional tersedia untuk ringkasan insiden sintetis.

## Manfaat yang dituju

- Membuat alur event menjadi alert dan tindak lanjut lebih mudah dipahami dalam demonstrasi.
- Menyediakan skenario yang dapat diulang untuk latihan dan evaluasi purwarupa.
- Memperlihatkan pemisahan antara deteksi, bukti, rekomendasi, dan pencatatan status.
- Menjaga demo aman untuk dibagikan dengan menggunakan target dan data sintetis, tanpa koneksi ke sistem yang dipantau.

## Ruang lingkup dan implementasi

- Node.js, Express, EJS, JavaScript browser, dan SQLite lokal.
- Leaflet dan GeoJSON provinsi disajikan lokal tanpa basemap tiles.
- 15 marker bernama Kodam dan satu marker Nusantara; seluruh label, koordinat, status, latensi, uptime, HTTP, dan TLS merupakan data demo.
- Ingest event lokal melalui `POST /api/events`; konsol menjalankan simulasi dan mengirimkan event ke penyimpanan lokal.
- Test otomatis menggunakan `node --test`.

## Batasan dan keselamatan

GARUDA SHIELD adalah demonstrator, bukan layanan monitoring produksi. Tidak melakukan DNS lookup, HTTP probe, pemindaian, pemblokiran, atau perubahan jaringan/perangkat. Peta bersifat skematik, bukan batas geografis atau pemetaan operasional resmi. Hasil pelacakan sumber dan atribusi juga sintetis, bukan intelijen nyata. Integrasi Groq bersifat opsional; jika diaktifkan, ringkasan insiden sintetis dikirim ke layanan Groq. Jangan masukkan data operasional atau rahasia.

## Kelayakan implementasi

Purwarupa sengaja dibangun dengan biaya implementasi rendah tanpa mengorbankan alur inti deteksi dan tindak lanjut:

- **Teknologi minimal dan tahan keterbatasan jaringan.** Satu proses Node.js (LTS 22.5+) dengan SQLite bawaan; tidak butuh database server, layanan cloud, maupun bundler. Peta memakai Leaflet dan GeoJSON yang disajikan lokal sehingga aplikasi tetap operatif di jaringan tertutup (LAN kantor/kampung siber) tanpa akses internet.
- **Sumber daya kecil.** Berjalan pada laptop kantor biasa; kebutuhan memori dan disk jauh di bawah layanan monitoring komersial. Instalasi cukup `npm install && npm start`, dengan pengujian otomatis `npm test`.
- **Tahapan penerapan bertahap** sebelum dipertimbangkan di lingkungan riil (semuanya di luar lingkup purwarupa ini):
  1. Uji penerimaan dengan data sintetis dan peninjauan proses kerja operator bersama pengguna.
  2. Otorisasi tertulis pemilik aset, kajian keamanan/privasi, serta penetapan kebutuhan dan sumber data yang tervalidasi.
  3. Penerapan terisolasi dengan kontrol akses, autentikasi, pencatatan audit, retensi data, dan integrasi sumber event nyata satu per satu secara bertahap.
  4. Operasional harian: observabilitas, pencadangan, prosedur respons yang disetujui, dan pelatihan operator.
- **Risiko utama dan mitigasinya.** Ketergantungan layanan eksternal dimitigasi dengan heuristik lokal (Groq hanya opsional). Risiko salah paham data demo dimitigasi dengan stempel mode demo pada dashboard, konsol, halaman dummy, dan laporan insiden. Risiko penyalahgunaan dimitigasi dengan tidak menyediakan kemampuan probe/pemblokiran sama sekali.