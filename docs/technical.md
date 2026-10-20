# Dokumentasi Teknis GARUDA SHIELD

## Arsitektur

- **Runtime:** Node.js 22.5+ dengan modul SQLite bawaan `node:sqlite`.
- **Web:** Express 5, template EJS, dan JavaScript browser tanpa bundler.
- **Peta:** Leaflet lokal di `public/vendor/leaflet/`; batas provinsi dibaca dari `public/data/indonesia-province-simple.json` (32 fitur, atribusi `© superpikar`). Tidak menggunakan basemap tiles.
- **Penyimpanan:** SQLite lokal di `data/garuda-shield.sqlite`; tabel dan indeks dibuat saat startup.
- **Deteksi:** `detectEvents()` di `src/detector.js` menghasilkan alert dari event. Fingerprint unik mencegah alert yang sama dimasukkan berulang kali.
- **Data inventory:** `src/kodam-sites.js` menyediakan 16 endpoint dummy untuk peta dan konsol simulasi.
- **Analisis opsional:** heuristik lokal selalu tersedia. Jika `GROQ_API_KEY` disetel, ringkasan insiden sintetis dapat dikirim ke API Groq; model dapat diatur lewat `GROQ_MODEL`.

## Antarmuka

- `/` menampilkan dashboard peta, ringkasan event/alert, inventory, dan detail endpoint.
- `/konsol` menampilkan pemilih target dummy dan lima metode simulasi. Event dibuat oleh aplikasi dan tidak menghasilkan trafik ke target.
- `/situs-dummy/:siteId` menampilkan halaman detail dummy.
- Dashboard menyediakan filter/pencarian, perubahan status alert, audit lokal, dan reset data demo.

## Deteksi dan event

Rule engine mengenali lonjakan lima login gagal untuk akun/aset yang sama dalam sepuluh menit, koneksi IT-ke-OT yang tidak disetujui, penulisan protokol OT di luar jendela maintenance, pola lima koneksi dari sumber yang sama dalam lima menit, sumber yang cocok dengan indikator demo, serta event transfer massal yang dihasilkan oleh skenario konsol.

Jenis event yang diterima oleh endpoint publik lokal `/api/events`: `login_success`, `login_failed`, `connection_open`, `protocol_write`, `telemetry_read`, `backup_complete`, dan `heartbeat`. Metode konsol dapat membuat bentuk event internal tambahan seperti `bulk_transfer` untuk simulasi lokal.

## Model data

- `events`: aset, zona, zona sumber/tujuan, sumber, akun, jenis event, waktu ISO-8601, atribut persetujuan/jadwal, dan payload demo.
- `alerts`: fingerprint, aturan pemicu, severity, rekomendasi, aset, bukti, waktu, serta status (`new`, `acknowledged`, `in_progress`, `resolved`).
- `audit_log`: perubahan status lokal, waktu, dan aktor demo.

Koordinat, nama endpoint, status, latensi, uptime, HTTP, dan TLS pada inventory adalah data sintetis. Koordinat hanya dipakai untuk marker peta demo, bukan lokasi fasilitas atau pemetaan operasional.

## Endpoint HTTP utama

- `POST /api/events`: validasi dan simpan satu event JSON sintetis, lalu hitung alert. Field wajib: `assetId`, `zone` (`IT`/`OT`), `source`, dan `eventType`; field opsional mencakup `sourceZone`, `targetZone`, `approved`, `inMaintenanceWindow`, `account`, dan `occurredAt`. Timestamp tidak valid atau lebih dari lima menit di masa depan ditolak.
- `POST /api/serangan`: jalankan metode simulasi terhadap situs dummy, menyimpan event, dan mengembalikan deteksi.
- `GET /api/insiden-aktif` dan `GET /api/serangan/:id`: baca insiden simulasi.
- `POST /api/analisis`: analisis insiden dengan heuristik lokal atau Groq opsional.
- `POST /api/pulihkan`: tandai insiden simulasi pulih; tidak mengubah sistem atau perangkat.
- `POST /alerts/:id/status`: ubah status alert lokal dan tulis audit trail.
- `GET /laporan/:attackId`: halaman laporan insiden siap cetak dari operator ke pimpinan. Isinya mencakup identitas target dan metode, penilaian insiden, analisis operator, tabel alert beserta status tindak lanjut, pelacakan asal serangan, playbook respons, dan jejak audit, lengkap dengan stempel mode demo. Cetak memakai dialog print browser (Ctrl+P) untuk menyimpan PDF; laporan disusun ulang dari data insiden dan analisis yang ada.
- `POST /demo/reset`: hapus dan muat ulang event/alert demo.

Contoh respons sukses `POST /api/events`:

```json
{
  "id": "generated-event-id",
  "detectedAlertIds": [1]
}
```

## Menjalankan dan menguji

```powershell
npm install
npm test
npm start
```

Server bind ke `127.0.0.1` pada port `3000` secara default. Atur variabel `PORT` jika port tersebut tidak tersedia. Data demo disimpan lokal; jangan membagikan file database karena dapat berisi data percobaan lokal.

## Batasan keamanan dan produksi

Aplikasi bukan layanan monitoring produksi dan tidak melakukan DNS lookup, HTTP probe, pemindaian, pemblokiran, atau perubahan perangkat/jaringan. Semua target dan hasil pelacakan sumber hanya simulasi. Integrasi Groq opsional mengirim ringkasan insiden demo ke layanan eksternal. Server tidak memiliki autentikasi/otorisasi produksi dan tidak boleh dibuka ke jaringan publik. Autentikasi, perlindungan CSRF, rate limiting, retensi/ekspor audit, validasi skema formal, migrasi, observabilitas, HA, serta kajian keselamatan integrasi belum termasuk.