# Naskah Video Demo GARUDA SHIELD

Durasi sasaran: 3-4 menit. Jalankan aplikasi lokal sebelum merekam: `npm start`, lalu buka `http://localhost:3000/` dan `http://localhost:3000/konsol`.

## Persiapan rekaman

- Gunakan ukuran layar yang membuat peta, ringkasan, dan alert terbaca.
- Pastikan dashboard dan konsol dapat dibuka; siapkan browser tanpa data pribadi.
- Jangan tampilkan `.env`, API key, terminal berisi rahasia, atau data operasional.
- Untuk hasil analisis yang dapat diulang tanpa layanan eksternal, gunakan mode heuristik lokal (tanpa `GROQ_API_KEY`).
- Rekam layar dan suara narator; file video final belum disertakan di repository.

## Naskah dan urutan layar

### 1. Pembuka - 20 detik

**Layar:** Dashboard GARUDA SHIELD.

**Narasi:**

> GARUDA SHIELD adalah purwarupa kategori Defensive Shield. Demo ini memperlihatkan dashboard pemantauan sintetis dan alur deteksi insiden. Seluruh target, event, status, metrik, serta koordinat yang terlihat adalah data demo, bukan kondisi sistem nyata.

### 2. Peta dan inventory - 40 detik

**Layar:** Geser peta, pilih satu marker, tunjukkan detail, lalu gunakan pencarian atau filter status.

**Narasi:**

> Dashboard menampilkan 16 endpoint dummy pada peta vektor yang disajikan lokal. Operator dapat mencari endpoint, menyaring status, dan membuka detailnya. Nilai latensi, uptime, HTTP, dan TLS ditampilkan untuk kebutuhan simulasi saja; aplikasi tidak melakukan probe jaringan.

### 3. Jalankan simulasi - 60 detik

**Layar:** Buka `/konsol`, pilih target dummy, pilih metode `Automated Incident Response`, lalu jalankan simulasi. Kembali ke tab dashboard.

**Narasi:**

> Dari konsol, saya memilih target dan skenario. Aplikasi membuat event sintetis secara lokal, misalnya koneksi IT-ke-OT yang tidak disetujui diikuti penulisan protokol OT di luar jadwal. Tidak ada paket yang dikirim ke target.

### 4. Tinjau alert dan tindak lanjut - 60 detik

**Layar:** Tunjukkan alert baru, severity, bukti, dan rekomendasi. Ubah status alert lalu tunjukkan audit trail. Jika waktu cukup, tunjukkan ringkasan analisis insiden.

**Narasi:**

> Rule engine menghubungkan event dengan aturan deteksi, menampilkan severity, bukti, dan rekomendasi. Status alert dapat diperbarui dan perubahannya dicatat di audit lokal. Analisis tersedia secara heuristik lokal; integrasi Groq opsional dan hanya menerima ringkasan insiden sintetis.

### 5. Penutup - 30 detik

**Layar:** Kembali ke dashboard; tunjukkan label/batas demo.

**Narasi:**

> GARUDA SHIELD membantu menjelaskan alur dari event, deteksi, sampai tindak lanjut dalam lingkungan demo yang dapat diulang. Ini belum menjadi monitoring produksi dan tidak terhubung ke jaringan nyata. Penerapan nyata memerlukan otorisasi, data yang tervalidasi, kontrol akses, serta pengujian di lingkungan yang disetujui.

## Setelah merekam

- [ ] Pastikan durasi dan suara narasi jelas.
- [ ] Tinjau ulang video dari awal sampai akhir dan pastikan tidak ada rahasia/data pribadi.
- [ ] Unggah video ke penyimpanan yang disetujui penyelenggara.
- [ ] Uji izin akses tautan menggunakan sesi browser lain.
- [ ] Catat tautan video final di `ceklist.md` atau formulir submission.
