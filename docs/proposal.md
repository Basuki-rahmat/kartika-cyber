# Proposal Solusi GARUDA SHIELD

## Ringkasan

GARUDA SHIELD adalah purwarupa kategori **Defensive Shield (Penangkalan)** untuk memperlihatkan bagaimana operator dapat melihat status simulasi layanan, meninjau alert, dan memahami alur penanganan insiden pada satu aplikasi. Purwarupa menggabungkan dashboard peta offline berisi 16 endpoint dummy dengan konsol simulasi yang menghasilkan event dan alert secara lokal.

## Masalah dan konteks

Dalam lingkungan IT/OT, operator perlu menyaring banyak sinyal, memahami alasan sebuah alert muncul, lalu menyampaikan tindak lanjut dengan cepat. Purwarupa ini mengeksplorasi alur informasi tersebut melalui data sintetis. Data dalam demo tidak mewakili situs, aset, topologi, lokasi fasilitas, ataupun kondisi jaringan TNI AD.

## Solusi

GARUDA SHIELD menyediakan dua tampilan yang saling melengkapi:

- **Dashboard pemantauan:** peta vektor offline dan inventory 16 endpoint dummy dengan pencarian, filter status, detail endpoint, event, alert, dan status tindak lanjut.
- **Konsol simulasi:** lima skenario terkontrol untuk Smart IDS/IPS, Threat Intelligence Platform, Automated Incident Response, Zero-Day Detection, dan Encryption Tool. Skenario membuat event sintetis untuk memicu rule engine, bukan mengirim trafik ke target.

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

## Pengembangan lanjutan

Integrasi nyata hanya dapat dipertimbangkan setelah ada otorisasi tertulis pemilik aset, kebutuhan dan sumber data tervalidasi, kajian keamanan serta privasi, kontrol akses, pencatatan audit, prosedur respons yang disetujui, dan pengujian bertahap di lingkungan terisolasi. Tidak satu pun integrasi tersebut termasuk dalam purwarupa ini.